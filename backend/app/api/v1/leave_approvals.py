"""Leave approvals -- inbox, action, recall, bulk."""

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.dependencies import get_current_user, require_role
from app.core.database import get_db

router = APIRouter(prefix="/leave-approvals", tags=["leave-approvals"])


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
          AND (ws.approver_role = :role OR (ws.approver_role = 'SPECIFIC_USER' AND ws.specific_approver_id = :uid))
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

    app = await db.execute(text("SELECT * FROM leave_applications WHERE id = :id FOR UPDATE"), {"id": application_id})
    app_row = app.fetchone()
    if not app_row: raise HTTPException(status_code=404)
    if app_row.status not in ("SUBMITTED", "UNDER_REVIEW"): raise HTTPException(status_code=400, detail=f"Already {app_row.status}")

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
                    await db.execute(text("UPDATE leave_balances SET availed = availed + :days, last_updated = now() WHERE id = :bid"), {"days": float(modified_days), "bid": str(bal_row[0])})
                await db.execute(text("UPDATE leave_applications SET status = 'APPROVED', last_action_at = now() WHERE id = :id"), {"id": application_id})
            else:
                await db.execute(text("UPDATE leave_applications SET status = 'UNDER_REVIEW', current_step_order = current_step_order + 1, last_action_at = now() WHERE id = :id"), {"id": application_id})
                
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
                await db.execute(text("UPDATE leave_balances SET availed = availed + :days, last_updated = now() WHERE id = :bid"), {"days": float(app_row.applied_days), "bid": str(bal_row[0])})
            await db.execute(text("UPDATE leave_applications SET status = 'APPROVED', last_action_at = now() WHERE id = :id"), {"id": application_id})
        else:
            await db.execute(text("UPDATE leave_applications SET status = 'UNDER_REVIEW', current_step_order = current_step_order + 1, last_action_at = now() WHERE id = :id"), {"id": application_id})

    await db.commit()
    return {"message": action}


@router.post("/{application_id}/recall")
async def recall_application(application_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    app = await db.execute(text("SELECT * FROM leave_applications WHERE id = :id FOR UPDATE"), {"id": application_id})
    app_row = app.fetchone()
    if not app_row: raise HTTPException(status_code=404)
    if app_row.status != "APPROVED": raise HTTPException(status_code=400, detail="Only APPROVED leave can be recalled")
    bal = await db.execute(text("SELECT id FROM leave_balances WHERE employee_id = :eid AND leave_type_id = :lid ORDER BY leave_year DESC LIMIT 1 FOR UPDATE"), {"eid": str(app_row.employee_id), "lid": str(app_row.leave_type_id)})
    bal_row = bal.fetchone()
    if bal_row:
        await db.execute(text("UPDATE leave_balances SET availed = GREATEST(0, availed - :days), last_updated = now() WHERE id = :bid"), {"days": float(app_row.applied_days), "bid": str(bal_row[0])})
    await db.execute(text("UPDATE leave_applications SET status = 'RECALLED', last_action_at = now() WHERE id = :id"), {"id": application_id})
    await db.commit()
    return {"message": "Recalled -- balance restored"}