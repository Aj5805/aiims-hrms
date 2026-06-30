"""Leave application -- submit, list, detail, withdraw, cancel/modify requests."""

import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, employee_scope
from app.core.database import get_db
from app.services.leave_rules import is_leave_type_eligible
from app.services.leave_transaction import assert_sufficient_balance
from app.services.leave_validation import validate_leave_application, validate_workflow_day_limits
from app.services.notifications import notify_event

router = APIRouter(prefix="/leave-applications", tags=["leave-applications"])


async def _resolve_user_for_employee(db: AsyncSession, employee_id: str | None):
    if not employee_id:
        return None
    result = await db.execute(
        text("SELECT id FROM users WHERE employee_id = :eid AND is_active = true ORDER BY created_at LIMIT 1"),
        {"eid": employee_id},
    )
    row = result.fetchone()
    return str(row[0]) if row and row[0] else None


async def _resolve_approver_user(db: AsyncSession, config_id: str, step_order: int):
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
    user_result = await db.execute(
        text("SELECT id FROM users WHERE role = :role AND is_active = true ORDER BY created_at LIMIT 1"),
        {"role": step_dict["approver_role"]},
    )
    user_row = user_result.fetchone()
    return str(user_row[0]) if user_row and user_row[0] else None


async def _authorize_employee(scope: dict, current_user: dict, emp_id: str, db: AsyncSession) -> None:
    user_res = await db.execute(
        text("SELECT employee_id FROM users WHERE id = :uid"),
        {"uid": current_user["user_id"]},
    )
    user_row = user_res.fetchone()
    own_emp_id = str(user_row[0]) if user_row and user_row[0] else None
    if scope["scope"] != "all" and emp_id != own_emp_id and emp_id not in (scope.get("employee_ids") or []):
        raise HTTPException(status_code=403, detail="Not authorized to apply leave for this employee")


async def _resolve_workflow(db: AsyncSession, cat_code: str, leave_type_code: str) -> str:
    wf = await db.execute(
        text("""
        SELECT wc.id FROM workflow_configs wc
        LEFT JOIN employee_categories c ON wc.category_id = c.id
        LEFT JOIN leave_types wlt ON wc.leave_type_id = wlt.id
        WHERE wc.is_active = true
          AND (wc.category_id IS NULL OR c.code = :cat)
          AND (wc.leave_type_id IS NULL OR wlt.code = :ltc)
        ORDER BY (CASE WHEN wc.category_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
                 (CASE WHEN wc.leave_type_id IS NOT NULL THEN 1 ELSE 0 END) DESC
        LIMIT 1
    """),
        {"cat": cat_code, "ltc": leave_type_code},
    )
    wf_row = wf.fetchone()
    if not wf_row:
        raise HTTPException(status_code=400, detail="No applicable workflow configuration found")
    return str(wf_row.id)


async def _check_date_overlap(
    db: AsyncSession,
    employee_id: str,
    from_date: date,
    to_date: date,
    *,
    exclude_ids: list[str] | None = None,
) -> None:
    exclude_ids = exclude_ids or []
    query = """
        SELECT id FROM leave_applications
        WHERE employee_id = :eid
          AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED')
          AND from_date <= :td AND to_date >= :fd
    """
    params: dict = {"eid": employee_id, "fd": from_date, "td": to_date}
    if exclude_ids:
        query += " AND id != ALL(:exclude)"
        params["exclude"] = exclude_ids
    query += " LIMIT 1"
    overlap = await db.execute(text(query), params)
    if overlap.fetchone():
        raise HTTPException(status_code=400, detail="Dates overlap with an existing active leave application")


async def _generate_app_number(db: AsyncSession) -> str:
    yr = datetime.utcnow().year
    count_result = await db.execute(
        text("SELECT COUNT(*) FROM leave_applications WHERE app_number LIKE :pat"),
        {"pat": f"HRMS/{yr}/%"},
    )
    seq = count_result.fetchone()[0] + 1
    return f"HRMS/{yr}/{seq:05d}"


async def _insert_application(
    db: AsyncSession,
    *,
    emp_id: str,
    wf_id: str,
    leave_type_id: str,
    from_date: date,
    to_date: date,
    applied_days: float,
    is_half_day: bool,
    half_day_session: str | None,
    reason: str,
    address: str,
    application_kind: str,
    parent_application_id: str | None,
    mc_attached: bool,
) -> tuple[str, str]:
    app_id = str(uuid.uuid4())
    app_number = await _generate_app_number(db)
    await db.execute(
        text("""
            INSERT INTO leave_applications
                (id, app_number, config_id, employee_id, leave_type_id, from_date, to_date, applied_days,
                 is_half_day, half_day_session, reason, address_during_leave, status, submitted_at,
                 application_kind, parent_application_id, mc_attached)
            VALUES (:id, :an, :cid, :eid, :lid, :fd, :td, :ad, :hd, :hds, :reason, :addr, 'SUBMITTED', now(),
                    :kind, :parent, :mc)
        """),
        {
            "id": app_id,
            "an": app_number,
            "cid": wf_id,
            "eid": emp_id,
            "lid": leave_type_id,
            "fd": from_date,
            "td": to_date,
            "ad": applied_days,
            "hd": is_half_day,
            "hds": half_day_session,
            "reason": reason,
            "addr": address,
            "kind": application_kind,
            "parent": parent_application_id,
            "mc": mc_attached,
        },
    )
    return app_id, app_number


@router.post("", status_code=201)
async def submit_application(
    body: dict,
    current_user: dict = Depends(get_current_user),
    scope: dict = Depends(employee_scope),
    db: AsyncSession = Depends(get_db),
):
    """Submit a new leave application with full validation and pending-balance check."""
    emp_id = body["employee_id"]
    leave_type_code = body["leave_type_code"]
    from_date = date.fromisoformat(body["from_date"])
    to_date = date.fromisoformat(body["to_date"])
    is_half_day = body.get("is_half_day", False)
    half_day_session = body.get("half_day_session")
    reason = body["reason"]
    address = body.get("address_during_leave", "")
    mc_attached = bool(body.get("mc_attached", False))
    emergency_regular_combo = bool(body.get("emergency_regular_combo", False))

    await _authorize_employee(scope, current_user, emp_id, db)

    if from_date < date.today():
        raise HTTPException(status_code=400, detail="Backdated applications not allowed")

    lt = await db.execute(text("SELECT * FROM leave_types WHERE code = :c"), {"c": leave_type_code})
    lt_row = lt.fetchone()
    if not lt_row:
        raise HTTPException(status_code=400, detail=f"Unknown leave type: {leave_type_code}")
    lt_dict = dict(lt_row._mapping)

    emp = await db.execute(
        text("SELECT e.*, c.code AS cat_code FROM employees e JOIN employee_categories c ON e.category_id = c.id WHERE e.id = :eid"),
        {"eid": emp_id},
    )
    emp_row = emp.fetchone()
    if not emp_row:
        raise HTTPException(status_code=400, detail="Employee not found")
    emp_dict = dict(emp_row._mapping)

    if not await is_leave_type_eligible(db, emp_id, leave_type_code):
        raise HTTPException(
            status_code=400,
            detail=f"Leave type {leave_type_code} is not permitted for this employee category",
        )
    if is_half_day and not lt_dict.get("is_half_day_allowed"):
        raise HTTPException(status_code=400, detail="Half-day is not allowed for this leave type")

    applied_days = await validate_leave_application(
        db,
        employee_id=emp_id,
        leave_type=lt_dict,
        from_date=from_date,
        to_date=to_date,
        is_half_day=is_half_day,
        mc_attached=mc_attached,
        application_kind="NEW",
        emergency_regular_combo=emergency_regular_combo,
    )

    wf_id = await _resolve_workflow(db, emp_dict["cat_code"], leave_type_code)
    await validate_workflow_day_limits(db, wf_id, applied_days)

    await assert_sufficient_balance(db, emp_id, str(lt_row.id), from_date, applied_days)
    await _check_date_overlap(db, emp_id, from_date, to_date)

    app_id, app_number = await _insert_application(
        db,
        emp_id=emp_id,
        wf_id=wf_id,
        leave_type_id=str(lt_row.id),
        from_date=from_date,
        to_date=to_date,
        applied_days=applied_days,
        is_half_day=is_half_day,
        half_day_session=half_day_session,
        reason=reason,
        address=address,
        application_kind="NEW",
        parent_application_id=None,
        mc_attached=mc_attached,
    )

    try:
        applicant_user_id = await _resolve_user_for_employee(db, emp_id)
        approver_user_id = await _resolve_approver_user(db, wf_id, 1)
        await notify_event(
            db,
            "APP_SUBMITTED",
            app_id,
            {
                "app_number": app_number,
                "employee_name": emp_dict.get("name"),
                "applicant_name": emp_dict.get("name"),
                "approver_name": None,
                "leave_type": lt_dict.get("name") or lt_dict.get("code"),
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
                "days": applied_days,
                "status": "SUBMITTED",
                "reason": reason,
                "recipient_id": applicant_user_id,
                "approver_id": approver_user_id,
                "emp_code": emp_dict.get("emp_code"),
            },
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Dates overlap with an existing approved leave (concurrent submission)")

    return {"id": app_id, "app_number": app_number, "status": "SUBMITTED", "applied_days": applied_days}


@router.post("/change-request", status_code=201)
async def submit_change_request(
    body: dict,
    current_user: dict = Depends(get_current_user),
    scope: dict = Depends(employee_scope),
    db: AsyncSession = Depends(get_db),
):
    """Request cancellation or modification of an already approved leave."""
    emp_id = body["employee_id"]
    parent_id = body["parent_application_id"]
    request_kind = body["request_kind"].upper()
    reason = body["reason"]
    address = body.get("address_during_leave", "")
    mc_attached = bool(body.get("mc_attached", False))
    emergency_regular_combo = bool(body.get("emergency_regular_combo", False))

    if request_kind not in ("CANCELLATION", "MODIFICATION"):
        raise HTTPException(status_code=400, detail="request_kind must be CANCELLATION or MODIFICATION")

    await _authorize_employee(scope, current_user, emp_id, db)

    parent = await db.execute(
        text("""
            SELECT a.*, lt.code AS leave_type_code, lt.name AS leave_type_name, c.code AS cat_code
            FROM leave_applications a
            JOIN leave_types lt ON a.leave_type_id = lt.id
            JOIN employees e ON a.employee_id = e.id
            JOIN employee_categories c ON e.category_id = c.id
            WHERE a.id = :id
        """),
        {"id": parent_id},
    )
    parent_row = parent.fetchone()
    if not parent_row:
        raise HTTPException(status_code=404, detail="Original leave application not found")
    if str(parent_row.employee_id) != emp_id:
        raise HTTPException(status_code=403, detail="Cannot change another employee's leave")
    if parent_row.status != "APPROVED":
        raise HTTPException(status_code=400, detail="Only approved leave can be cancelled or modified")

    pending_change = await db.execute(
        text("""
            SELECT id FROM leave_applications
            WHERE parent_application_id = :pid AND status IN ('SUBMITTED', 'UNDER_REVIEW')
            LIMIT 1
        """),
        {"pid": parent_id},
    )
    if pending_change.fetchone():
        raise HTTPException(status_code=400, detail="A change request is already pending for this leave")

    lt = await db.execute(text("SELECT * FROM leave_types WHERE id = :id"), {"id": str(parent_row.leave_type_id)})
    lt_dict = dict(lt.fetchone()._mapping)

    if request_kind == "CANCELLATION":
        from_date = parent_row.from_date
        to_date = parent_row.to_date
        is_half_day = bool(parent_row.is_half_day)
        half_day_session = parent_row.half_day_session
        applied_days = float(parent_row.applied_days)
    else:
        from_date = date.fromisoformat(body["from_date"])
        to_date = date.fromisoformat(body["to_date"])
        is_half_day = body.get("is_half_day", False)
        half_day_session = body.get("half_day_session")
        applied_days = await validate_leave_application(
            db,
            employee_id=emp_id,
            leave_type=lt_dict,
            from_date=from_date,
            to_date=to_date,
            is_half_day=is_half_day,
            mc_attached=mc_attached,
            application_kind="MODIFICATION",
            parent_applied_days=float(parent_row.applied_days),
            emergency_regular_combo=emergency_regular_combo,
            exclude_application_ids=[parent_id],
        )
        delta = applied_days - float(parent_row.applied_days)
        if delta > 0:
            await assert_sufficient_balance(db, emp_id, str(parent_row.leave_type_id), from_date, delta)
        await _check_date_overlap(db, emp_id, from_date, to_date, exclude_ids=[parent_id])

    wf_id = await _resolve_workflow(db, parent_row.cat_code, parent_row.leave_type_code)
    if request_kind == "MODIFICATION":
        await validate_workflow_day_limits(db, wf_id, applied_days)

    app_id, app_number = await _insert_application(
        db,
        emp_id=emp_id,
        wf_id=wf_id,
        leave_type_id=str(parent_row.leave_type_id),
        from_date=from_date,
        to_date=to_date,
        applied_days=applied_days,
        is_half_day=is_half_day,
        half_day_session=half_day_session,
        reason=reason,
        address=address,
        application_kind=request_kind,
        parent_application_id=parent_id,
        mc_attached=mc_attached,
    )

    applicant_user_id = await _resolve_user_for_employee(db, emp_id)
    approver_user_id = await _resolve_approver_user(db, wf_id, 1)
    await notify_event(
        db,
        "APP_SUBMITTED",
        app_id,
        {
            "app_number": app_number,
            "employee_name": None,
            "applicant_name": None,
            "leave_type": parent_row.leave_type_name or parent_row.leave_type_code,
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
            "days": applied_days,
            "status": "SUBMITTED",
            "reason": reason,
            "recipient_id": applicant_user_id,
            "approver_id": approver_user_id,
            "change_kind": request_kind,
        },
    )
    await db.commit()
    return {
        "id": app_id,
        "app_number": app_number,
        "status": "SUBMITTED",
        "application_kind": request_kind,
        "applied_days": applied_days,
    }


@router.get("")
async def list_applications(
    status: str = Query(None),
    employee_id: str = Query(None),
    skip: int = Query(0),
    limit: int = Query(50),
    current_user: dict = Depends(get_current_user),
    scope: dict = Depends(employee_scope),
    db: AsyncSession = Depends(get_db),
):
    query = """
        SELECT a.*, e.name AS emp_name, e.emp_code, lt.code AS leave_type_code,
               p.app_number AS parent_app_number
        FROM leave_applications a
        JOIN employees e ON a.employee_id = e.id
        JOIN leave_types lt ON a.leave_type_id = lt.id
        LEFT JOIN leave_applications p ON a.parent_application_id = p.id
        WHERE 1=1
    """
    params = {}
    if scope["employee_ids"] is not None:
        query += " AND a.employee_id = ANY(:eids)"
        params["eids"] = scope["employee_ids"]
    if status:
        query += " AND a.status = :st"
        params["st"] = status
    if employee_id:
        query += " AND a.employee_id = :eid"
        params["eid"] = employee_id
    query += " ORDER BY a.created_at DESC LIMIT :lim OFFSET :skip"
    params["lim"] = limit
    params["skip"] = skip
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/{application_id}")
async def get_application(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
        SELECT a.*, e.name AS emp_name, e.emp_code, lt.code AS leave_type_code,
               p.app_number AS parent_app_number
        FROM leave_applications a
        JOIN employees e ON a.employee_id = e.id
        JOIN leave_types lt ON a.leave_type_id = lt.id
        LEFT JOIN leave_applications p ON a.parent_application_id = p.id
        WHERE a.id = :id
    """),
        {"id": application_id},
    )
    app = result.fetchone()
    if not app:
        raise HTTPException(status_code=404)
    return dict(app._mapping)


@router.put("/{application_id}/withdraw")
async def withdraw_application(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    app = await db.execute(text("SELECT status FROM leave_applications WHERE id = :id"), {"id": application_id})
    row = app.fetchone()
    if not row:
        raise HTTPException(status_code=404)
    if row.status not in ("SUBMITTED", "UNDER_REVIEW"):
        raise HTTPException(status_code=400, detail=f"Cannot withdraw in status {row.status}")
    await db.execute(
        text("UPDATE leave_applications SET status = 'WITHDRAWN', last_action_at = now() WHERE id = :id"),
        {"id": application_id},
    )
    app_row = await db.execute(
        text("""
            SELECT a.*, e.name AS employee_name, e.emp_code, lt.code AS leave_type_code, lt.name AS leave_type_name
            FROM leave_applications a
            JOIN employees e ON a.employee_id = e.id
            JOIN leave_types lt ON a.leave_type_id = lt.id
            WHERE a.id = :id
        """),
        {"id": application_id},
    )
    app_data = app_row.fetchone()
    if app_data:
        applicant_user_id = await _resolve_user_for_employee(db, str(app_data.employee_id))
        await notify_event(
            db,
            "APP_WITHDRAWN",
            application_id,
            {
                "app_number": app_data.app_number,
                "employee_name": app_data.employee_name,
                "applicant_name": app_data.employee_name,
                "leave_type": app_data.leave_type_name or app_data.leave_type_code,
                "recipient_id": applicant_user_id,
            },
        )
    await db.commit()
    return {"message": "Withdrawn"}


@router.get("/{application_id}/approval-trail")
async def approval_trail(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
        SELECT a.*, u.username
        FROM leave_approvals a
        JOIN users u ON a.approver_id = u.id
        WHERE a.application_id = :aid
        ORDER BY a.step_order
    """),
        {"aid": application_id},
    )
    return [dict(r._mapping) for r in result.fetchall()]
