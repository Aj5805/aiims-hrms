"""Leave approvals -- inbox, action, recall, bulk."""

import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.dependencies import get_current_user, require_role
from app.core.database import get_db
from app.services.notifications import notify_event
from app.services.leave_ledger import record_leave_ledger

router = APIRouter(prefix="/leave-approvals", tags=["leave-approvals"])


async def _record_avail_ledger(
    db: AsyncSession,
    balance_id: str,
    days: float,
    application_id: str,
    actor_id: str,
    impersonated_by: str | None,
    reversal: bool = False,
):
    meta = await db.execute(
        text("SELECT employee_id, leave_type_id, leave_year FROM leave_balances WHERE id = :bid"),
        {"bid": balance_id},
    )
    row = meta.fetchone()
    if not row:
        return
    signed = -abs(days) if reversal else abs(days)
    await record_leave_ledger(
        db,
        balance_id=balance_id,
        employee_id=str(row.employee_id),
        leave_type_id=str(row.leave_type_id),
        leave_year=int(row.leave_year),
        txn_type="REVERSAL" if reversal else "AVAIL",
        amount=signed if reversal else abs(days),
        field_affected="availed",
        reference_type="application",
        reference_id=application_id,
        reason="Leave recalled" if reversal else "Leave approved",
        actor_id=actor_id,
        impersonated_by=impersonated_by,
    )


async def _resolve_applicant_user(db: AsyncSession, employee_id: str | None):
    if not employee_id:
        return None
    result = await db.execute(text("SELECT id FROM users WHERE employee_id = :eid AND is_active = true ORDER BY created_at LIMIT 1"), {"eid": employee_id})
    row = result.fetchone()
    return str(row[0]) if row and row[0] else None


def _format_date(value: str | None):
    return value.isoformat() if value else None


async def _resolve_approver_user(db: AsyncSession, config_id: str, step_order: int, employee_id: str | None = None):
    """Resolve which user should act on the given workflow step.

    For NODAL_OFFICER steps, looks up dept_nodal_assignments using the
    applicant's department — enabling per-department routing.
    """
    step_result = await db.execute(
        text("SELECT id, approver_role, specific_approver_id FROM workflow_steps WHERE config_id = :cid AND step_order = :so LIMIT 1"),
        {"cid": config_id, "so": step_order},
    )
    step_row = step_result.fetchone()
    if not step_row:
        return None
    step_dict = dict(step_row._mapping)

    if step_dict.get("specific_approver_id"):
        return str(step_dict["specific_approver_id"])

    approver_role = step_dict["approver_role"]

    if approver_role == "HOD" and employee_id:
        hod_result = await db.execute(
            text("""
                SELECT dha.hod_user_id
                FROM dept_hod_assignments dha
                JOIN employees e ON e.department_id = dha.department_id
                WHERE e.id = :eid AND dha.is_active = true
                ORDER BY dha.assigned_at DESC
                LIMIT 1
            """),
            {"eid": employee_id},
        )
        hod_row = hod_result.fetchone()
        if hod_row and hod_row[0]:
            return str(hod_row[0])
        dept_hod = await db.execute(
            text("""
                SELECT u.id
                FROM users u
                JOIN employees hod_e ON u.employee_id = hod_e.id
                JOIN employees app_e ON app_e.department_id = hod_e.department_id
                WHERE app_e.id = :eid AND u.role = 'HOD' AND u.is_active = true
                ORDER BY u.created_at
                LIMIT 1
            """),
            {"eid": employee_id},
        )
        dept_row = dept_hod.fetchone()
        if dept_row and dept_row[0]:
            return str(dept_row[0])
        return None

    # Department-aware routing for NODAL_OFFICER
    if approver_role == "NODAL_OFFICER" and employee_id:
        nodal_result = await db.execute(
            text("""
                SELECT dna.nodal_user_id
                FROM dept_nodal_assignments dna
                JOIN employees e ON e.department_id = dna.department_id
                WHERE e.id = :eid AND dna.is_active = true
                ORDER BY dna.assigned_at DESC
                LIMIT 1
            """),
            {"eid": employee_id},
        )
        nodal_row = nodal_result.fetchone()
        if nodal_row and nodal_row[0]:
            return str(nodal_row[0])
        return None

    user_result = await db.execute(
        text("SELECT id FROM users WHERE role = :role AND is_active = true ORDER BY created_at LIMIT 1"),
        {"role": approver_role},
    )
    user_row = user_result.fetchone()
    return str(user_row[0]) if user_row and user_row[0] else None


def _build_notification_context(app_row, base_status: str, reason: str | None = None):
    return {
        "app_number": app_row.app_number,
        "employee_name": app_row.employee_name,
        "applicant_name": app_row.employee_name,
        "approver_name": None,
        "leave_type": app_row.leave_type_name or app_row.leave_type_code,
        "from_date": _format_date(app_row.from_date),
        "to_date": _format_date(app_row.to_date),
        "days": float(app_row.applied_days) if app_row.applied_days is not None else None,
        "status": base_status,
        "reason": reason,
    }


@router.get("/inbox")
async def approval_inbox(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    role = current_user["role"]
    user_id = current_user["user_id"]
    emp = await db.execute(text("SELECT employee_id FROM users WHERE id = :uid"), {"uid": user_id})
    emp_row = emp.fetchone()
    emp_id = str(emp_row[0]) if emp_row and emp_row[0] else None

    query = """
        SELECT DISTINCT a.*, e.name AS emp_name, e.emp_code, lt.code AS leave_type_code,
               ws.step_order, ws.sla_hours,
               EXTRACT(EPOCH FROM (now() - a.submitted_at))/3600 AS hours_pending
        FROM leave_applications a
        JOIN employees e ON a.employee_id = e.id
        JOIN leave_types lt ON a.leave_type_id = lt.id
        JOIN workflow_steps ws ON ws.config_id = a.config_id AND ws.step_order = a.current_step_order
        WHERE a.status IN ('SUBMITTED', 'UNDER_REVIEW')
          AND (
            (ws.approver_role = :role AND ws.approver_role != 'NODAL_OFFICER')
            OR (ws.approver_role = 'SPECIFIC_USER' AND ws.specific_approver_id = :uid)
            OR (
                ws.approver_role = 'NODAL_OFFICER'
                AND EXISTS (
                    SELECT 1 FROM dept_nodal_assignments dna
                    WHERE dna.nodal_user_id = :uid
                      AND dna.is_active = true
                      AND dna.department_id = e.department_id
                )
            )
          )
          AND NOT EXISTS (
              SELECT 1 FROM leave_approvals la
              WHERE la.application_id = a.id AND la.step_id = ws.id AND la.approver_id = :uid
          )
    """
    params = {"role": role, "uid": user_id}
    if role == "HOD" and emp_id:
        query += " AND a.employee_id != :emp_id"
        params["emp_id"] = emp_id
    query += " ORDER BY hours_pending DESC"

    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/team-availability")
async def team_availability(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    role = current_user["role"]
    user_id = current_user["user_id"]
    
    emp = await db.execute(text("SELECT e.department_id FROM employees e JOIN users u ON u.employee_id = e.id WHERE u.id = :uid"), {"uid": user_id})
    emp_row = emp.fetchone()
    my_dept_id = str(emp_row[0]) if emp_row and emp_row[0] else None

    query = """
        SELECT a.id, a.from_date, a.to_date, a.applied_days, e.name AS employee_name, e.emp_code, lt.code AS leave_type_code
        FROM leave_applications a
        JOIN employees e ON a.employee_id = e.id
        JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE a.status = 'APPROVED'
          AND a.to_date >= CURRENT_DATE
    """
    
    if role == "NODAL_OFFICER":
        query += """
          AND e.department_id IN (
              SELECT department_id FROM dept_nodal_assignments
              WHERE nodal_user_id = :uid AND is_active = true
          )
        """
    elif role == "HOD":
        if not my_dept_id:
            return []
        query += " AND e.department_id = :my_dept"
        
    query += " ORDER BY a.from_date ASC LIMIT 50"
    
    params = {"uid": user_id, "my_dept": my_dept_id}
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/availability-forecast")
async def availability_forecast(
    from_date: str,
    to_date: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dates × designations matrix: staff availability for HOD / Nodal scoped teams."""
    role = current_user["role"]
    if role not in ("HOD", "NODAL_OFFICER", "ADMIN", "ESTABLISHMENT_OFFICER", "DIRECTOR"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    start = datetime.strptime(from_date, "%Y-%m-%d").date()
    end = datetime.strptime(to_date, "%Y-%m-%d").date()
    if end < start:
        raise HTTPException(status_code=400, detail="to_date must be on or after from_date")
    if (end - start).days > 60:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 60 days")

    user_id = current_user["user_id"]
    emp = await db.execute(
        text("SELECT e.department_id FROM employees e JOIN users u ON u.employee_id = e.id WHERE u.id = :uid"),
        {"uid": user_id},
    )
    emp_row = emp.fetchone()
    my_dept_id = str(emp_row[0]) if emp_row and emp_row[0] else None

    staff_query = """
        SELECT e.id, des.name AS designation_name
        FROM employees e
        JOIN designations des ON e.designation_id = des.id
        WHERE e.is_active = true
    """
    staff_params: dict = {}
    if role == "HOD":
        if not my_dept_id:
            return {"dates": [], "designations": [], "cells": {}}
        staff_query += " AND e.department_id = :dept_id"
        staff_params["dept_id"] = my_dept_id
    elif role == "NODAL_OFFICER":
        staff_query += """
          AND e.department_id IN (
              SELECT department_id FROM dept_nodal_assignments
              WHERE nodal_user_id = :uid AND is_active = true
          )
        """
        staff_params["uid"] = user_id

    staff_result = await db.execute(text(staff_query), staff_params)
    staff_rows = staff_result.fetchall()
    if not staff_rows:
        return {"dates": [], "designations": [], "cells": {}}

    emp_ids = [str(r.id) for r in staff_rows]
    designations = sorted({r.designation_name for r in staff_rows})
    desg_totals = {d: sum(1 for r in staff_rows if r.designation_name == d) for d in designations}

    leave_query = """
        SELECT a.employee_id, a.from_date, a.to_date
        FROM leave_applications a
        WHERE a.status = 'APPROVED'
          AND a.employee_id = ANY(:emp_ids)
          AND a.to_date >= :start AND a.from_date <= :end
    """
    leave_result = await db.execute(
        text(leave_query),
        {"emp_ids": emp_ids, "start": start, "end": end},
    )
    leave_rows = leave_result.fetchall()

    emp_to_desg = {str(r.id): r.designation_name for r in staff_rows}
    dates = []
    cells: dict[str, dict[str, dict]] = {}
    d = start
    while d <= end:
        date_str = d.isoformat()
        dates.append(date_str)
        cells[date_str] = {}
        for desg in designations:
            on_leave = 0
            for lr in leave_rows:
                if emp_to_desg.get(str(lr.employee_id)) != desg:
                    continue
                if lr.from_date <= d <= lr.to_date:
                    on_leave += 1
            total = desg_totals[desg]
            cells[date_str][desg] = {
                "total": total,
                "on_leave": on_leave,
                "available": total - on_leave,
            }
        d += timedelta(days=1)

    return {"dates": dates, "designations": designations, "cells": cells}


@router.post("/{application_id}/action")
async def approve_action(application_id: str, body: dict, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    action = body["action"]
    remarks = body.get("remarks", "")
    modified_from_str = body.get("modified_from_date")
    modified_to_str = body.get("modified_to_date")
    modified_from = datetime.strptime(modified_from_str, "%Y-%m-%d").date() if modified_from_str else None
    modified_to = datetime.strptime(modified_to_str, "%Y-%m-%d").date() if modified_to_str else None
    modified_days = body.get("modified_days")
    user_id = current_user["user_id"]

    if action not in ("APPROVED", "REJECTED", "FORWARDED", "MODIFIED"):
        raise HTTPException(status_code=400, detail=f"Invalid action: {action}")
    if action == "REJECTED" and not remarks:
        raise HTTPException(status_code=400, detail="Remarks required")

    app = await db.execute(text("""
        SELECT a.*, e.name AS employee_name, e.emp_code, lt.code AS leave_type_code,
               lt.name AS leave_type_name
        FROM leave_applications a
        JOIN employees e ON a.employee_id = e.id
        JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE a.id = :id
        FOR UPDATE
    """), {"id": application_id})
    app_row = app.fetchone()
    if not app_row:
        raise HTTPException(status_code=404)
    if app_row.status not in ("SUBMITTED", "UNDER_REVIEW"):
        raise HTTPException(status_code=400, detail=f"Already {app_row.status}")

    step = await db.execute(text("""
        SELECT ws.* FROM workflow_steps ws
        WHERE ws.config_id = :cid AND ws.step_order = :so LIMIT 1
    """), {"cid": app_row.config_id, "so": app_row.current_step_order})
    step_row = step.fetchone()
    if not step_row: raise HTTPException(status_code=400, detail="No matching workflow step")
    step_dict = dict(step_row._mapping)

    if step_dict["approver_role"] == "SPECIFIC_USER":
        if str(step_dict.get("specific_approver_id")) != str(current_user["user_id"]):
            raise HTTPException(status_code=403, detail="Not authorized to approve this step (Specific User mismatch)")
    elif step_dict["approver_role"] == "NODAL_OFFICER":
        # Check that this user is the nodal officer for the applicant's department
        nodal_check = await db.execute(
            text("""
                SELECT 1 FROM dept_nodal_assignments dna
                JOIN employees e ON e.department_id = dna.department_id
                WHERE e.id = :eid AND dna.nodal_user_id = :uid AND dna.is_active = true
                LIMIT 1
            """),
            {"eid": str(app_row.employee_id), "uid": user_id},
        )
        if not nodal_check.fetchone():
            raise HTTPException(status_code=403, detail="Not authorized — you are not the nodal officer for this department")
    elif step_dict["approver_role"] != current_user["role"]:
        raise HTTPException(status_code=403, detail="Not authorized to approve this step")

    approval_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO leave_approvals
            (id, application_id, step_id, approver_id, step_order, action, remarks, modified_from_date, modified_to_date, modified_days)
        VALUES
            (:id, :aid, :sid, :uid, :so, :action, :remarks, :mfd, :mtd, :md)
    """), {
        "id": approval_id, "aid": application_id, "sid": step_dict["id"], "uid": user_id, "so": app_row.current_step_order,
        "action": action, "remarks": remarks, "mfd": modified_from, "mtd": modified_to, "md": modified_days,
    })

    if action == "REJECTED":
        await db.execute(text("UPDATE leave_applications SET status = 'REJECTED', last_action_at = now() WHERE id = :id"), {"id": application_id})
    elif action == "FORWARDED":
        await db.execute(text("UPDATE leave_applications SET status = 'UNDER_REVIEW', current_step_order = current_step_order + 1, last_action_at = now() WHERE id = :id"), {"id": application_id})
    elif action == "MODIFIED":
        overlap = await db.execute(text("""
            SELECT id FROM leave_applications
            WHERE employee_id = :eid AND id != :id
              AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED')
              AND from_date <= :td AND to_date >= :fd
            LIMIT 1
        """), {"eid": app_row.employee_id, "id": application_id, "fd": modified_from, "td": modified_to})
        if overlap.fetchone():
            raise HTTPException(status_code=400, detail="Modified dates overlap with another leave")

        bal = await db.execute(text("SELECT closing_balance FROM leave_balances WHERE employee_id = :eid AND leave_type_id = :lid ORDER BY leave_year DESC LIMIT 1"), {"eid": str(app_row.employee_id), "lid": str(app_row.leave_type_id)})
        bal_row = bal.fetchone()
        available = float(bal_row.closing_balance) if bal_row else 0
        if modified_days > available:
            raise HTTPException(status_code=400, detail="Insufficient balance for modified days")
        
        try:
            await db.execute(text("UPDATE leave_applications SET from_date = :fd, to_date = :td, applied_days = :md, last_action_at = now() WHERE id = :id"), {"fd": modified_from, "td": modified_to, "md": modified_days, "id": application_id})
            
            is_final = step_dict.get("is_final_authority", False)
            if is_final:
                bal = await db.execute(text("SELECT id FROM leave_balances WHERE employee_id = :eid AND leave_type_id = :lid ORDER BY leave_year DESC LIMIT 1 FOR UPDATE"), {"eid": str(app_row.employee_id), "lid": str(app_row.leave_type_id)})
                bal_row = bal.fetchone()
                if bal_row:
                    bid = str(bal_row[0])
                    await db.execute(text("UPDATE leave_balances SET availed = availed + :days, last_updated = now() WHERE id = :bid"), {"days": float(modified_days), "bid": bid})
                    await _record_avail_ledger(db, bid, float(modified_days), application_id, user_id, current_user.get("impersonated_by"))
                await db.execute(text("UPDATE leave_applications SET status = 'APPROVED', last_action_at = now() WHERE id = :id"), {"id": application_id})
            else:
                await db.execute(text("UPDATE leave_applications SET status = 'UNDER_REVIEW', current_step_order = current_step_order + 1, last_action_at = now() WHERE id = :id"), {"id": application_id})
                
            applicant_user_id = await _resolve_applicant_user(db, str(app_row.employee_id))
            next_approver_id = None
            if not is_final:
                next_approver_id = await _resolve_approver_user(db, str(app_row.config_id), app_row.current_step_order + 1, str(app_row.employee_id))
            notify_context = _build_notification_context(app_row, "UNDER_REVIEW" if not is_final else "APPROVED", remarks)
            notify_context.update({
                "recipient_id": applicant_user_id,
                "approver_id": next_approver_id,
                "original_from": _format_date(app_row.from_date),
                "original_to": _format_date(app_row.to_date),
                "modified_from": _format_date(modified_from),
                "modified_to": _format_date(modified_to),
            })
            notify_context["from_date"] = _format_date(modified_from)
            notify_context["to_date"] = _format_date(modified_to)
            notify_context["days"] = modified_days
            await notify_event(db, "APP_MODIFIED", application_id, notify_context)
            await db.commit()
            return {"message": action}
        except IntegrityError:
            await db.rollback()
            raise HTTPException(status_code=409, detail="Dates overlap with an existing approved leave (concurrent modification)")
    elif action == "APPROVED":
        is_final = step_dict.get("is_final_authority", False)
        if is_final:
            bal = await db.execute(text("SELECT id FROM leave_balances WHERE employee_id = :eid AND leave_type_id = :lid ORDER BY leave_year DESC LIMIT 1 FOR UPDATE"), {"eid": str(app_row.employee_id), "lid": str(app_row.leave_type_id)})
            bal_row = bal.fetchone()
            if bal_row:
                bid = str(bal_row[0])
                await db.execute(text("UPDATE leave_balances SET availed = availed + :days, last_updated = now() WHERE id = :bid"), {"days": float(app_row.applied_days), "bid": bid})
                await _record_avail_ledger(db, bid, float(app_row.applied_days), application_id, user_id, current_user.get("impersonated_by"))
            await db.execute(text("UPDATE leave_applications SET status = 'APPROVED', last_action_at = now() WHERE id = :id"), {"id": application_id})
        else:
            await db.execute(text("UPDATE leave_applications SET status = 'UNDER_REVIEW', current_step_order = current_step_order + 1, last_action_at = now() WHERE id = :id"), {"id": application_id})

    applicant_user_id = await _resolve_applicant_user(db, str(app_row.employee_id))
    base_notify_context = _build_notification_context(app_row, "REJECTED", remarks)
    if action == "REJECTED":
        base_notify_context.update({"status": "REJECTED", "recipient_id": applicant_user_id})
        await notify_event(db, "APP_REJECTED", application_id, base_notify_context)
    elif action == "APPROVED" and step_dict.get("is_final_authority", False):
        base_notify_context.update({"status": "APPROVED", "recipient_id": applicant_user_id})
        await notify_event(db, "APP_APPROVED", application_id, base_notify_context)
    elif action == "APPROVED" and not step_dict.get("is_final_authority", False):
        next_approver_id = await _resolve_approver_user(db, str(app_row.config_id), app_row.current_step_order + 1, str(app_row.employee_id))
        base_notify_context.update({"status": "UNDER_REVIEW", "approver_id": next_approver_id})
        await notify_event(db, "APPROVAL_REQUEST", application_id, base_notify_context)

    await db.commit()
    return {"message": action}


@router.post("/{application_id}/recall")
async def recall_application(application_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    app = await db.execute(text("""
        SELECT a.*, e.name AS employee_name, e.emp_code, lt.code AS leave_type_code,
               lt.name AS leave_type_name
        FROM leave_applications a
        JOIN employees e ON a.employee_id = e.id
        JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE a.id = :id
        FOR UPDATE
    """), {"id": application_id})
    app_row = app.fetchone()
    if not app_row:
        raise HTTPException(status_code=404)
    if app_row.status != "APPROVED":
        raise HTTPException(status_code=400, detail="Only APPROVED leave can be recalled")
    bal = await db.execute(text("SELECT id FROM leave_balances WHERE employee_id = :eid AND leave_type_id = :lid ORDER BY leave_year DESC LIMIT 1 FOR UPDATE"), {"eid": str(app_row.employee_id), "lid": str(app_row.leave_type_id)})
    bal_row = bal.fetchone()
    if bal_row:
        bid = str(bal_row[0])
        await db.execute(text("UPDATE leave_balances SET availed = GREATEST(0, availed - :days), last_updated = now() WHERE id = :bid"), {"days": float(app_row.applied_days), "bid": bid})
        await _record_avail_ledger(
            db, bid, float(app_row.applied_days), application_id,
            current_user["user_id"], current_user.get("impersonated_by"), reversal=True,
        )
    await db.execute(text("UPDATE leave_applications SET status = 'RECALLED', last_action_at = now() WHERE id = :id"), {"id": application_id})
    applicant_user_id = await _resolve_applicant_user(db, str(app_row.employee_id))
    withdraw_context = _build_notification_context(app_row, "RECALLED")
    withdraw_context.update({"recipient_id": applicant_user_id})
    await notify_event(db, "APP_WITHDRAWN", application_id, withdraw_context)
    await db.commit()
    return {"message": "Recalled -- balance restored"}