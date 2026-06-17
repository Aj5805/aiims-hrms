"""Leave application -- submit, list, detail, withdraw."""

import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, employee_scope
from app.core.database import get_db

router = APIRouter(prefix="/leave-applications", tags=["leave-applications"])


def _count_working_days(from_date: date, to_date: date, holidays: set[date]) -> int:
    total = 0
    d = from_date
    while d <= to_date:
        if d.weekday() < 5 and d not in holidays:
            total += 1
        d = date.fromordinal(d.toordinal() + 1)
    return total


@router.post("", status_code=201)
async def submit_application(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a leave application with full validation."""
    emp_id = body["employee_id"]
    leave_type_code = body["leave_type_code"]
    from_date = date.fromisoformat(body["from_date"])
    to_date = date.fromisoformat(body["to_date"])
    is_half_day = body.get("is_half_day", False)
    half_day_session = body.get("half_day_session")
    reason = body["reason"]
    address = body.get("address_during_leave", "")
    acting_emp_code = body.get("acting_arrangement_emp_code")

    if from_date > to_date:
        raise HTTPException(status_code=400, detail="from_date must be <= to_date")
    if from_date < date.today():
        raise HTTPException(status_code=400, detail="Backdated applications not allowed")

    # Resolve leave type
    lt = await db.execute(text("SELECT * FROM leave_types WHERE code = :c"), {"c": leave_type_code})
    lt_row = lt.fetchone()
    if not lt_row:
        raise HTTPException(status_code=400, detail=f"Unknown leave type: {leave_type_code}")
    lt_dict = dict(lt_row._mapping)

    # Get employee + category
    emp = await db.execute(text("SELECT e.*, c.code AS cat_code FROM employees e JOIN employee_categories c ON e.category_id = c.id WHERE e.id = :eid"), {"eid": emp_id})
    emp_row = emp.fetchone()
    if not emp_row:
        raise HTTPException(status_code=400, detail="Employee not found")
    emp_dict = dict(emp_row._mapping)

    # Load holidays in range
    holidays_result = await db.execute(text("SELECT holiday_date FROM holiday_master WHERE holiday_date BETWEEN :f AND :t"), {"f": from_date, "t": to_date})
    holiday_dates = {r[0] for r in holidays_result.fetchall()}

    # Day count
    if is_half_day:
        applied_days = 0.5
    else:
        applied_days = _count_working_days(from_date, to_date, holiday_dates)

    # CL validation
    if lt_dict["code"] == "CL":
        prev_day = date.fromordinal(from_date.toordinal() - 1)
        next_day = date.fromordinal(to_date.toordinal() + 1)
        adj_holidays = await db.execute(text("SELECT holiday_date FROM holiday_master WHERE holiday_date IN (:p, :n)"), {"p": prev_day, "n": next_day})
        if adj_holidays.fetchone():
            raise HTTPException(status_code=400, detail="CL cannot be prefixed/suffixed to holidays")
        if from_date != to_date and applied_days > 5:
            raise HTTPException(status_code=400, detail="CL max 5 days at a stretch")

    # Balance check
    bal = await db.execute(text("SELECT * FROM leave_balances WHERE employee_id = :eid AND leave_type_id = :lid ORDER BY leave_year DESC LIMIT 1"), {"eid": emp_id, "lid": str(lt_row.id)})
    bal_row = bal.fetchone()
    available = float(bal_row.closing_balance) if bal_row else 0
    if applied_days > available:
        raise HTTPException(status_code=400, detail=f"Insufficient balance: {available} available, {applied_days} requested")

    # Resolve workflow chain (most specific match)
    wf = await db.execute(text("""
        SELECT wc.id FROM workflow_configs wc
        LEFT JOIN employee_categories c ON wc.category_id = c.id
        LEFT JOIN leave_types wlt ON wc.leave_type_id = wlt.id
        WHERE wc.is_active = true
          AND (wc.category_id IS NULL OR c.code = :cat)
          AND (wc.leave_type_id IS NULL OR wlt.code = :ltc)
        ORDER BY (CASE WHEN wc.category_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
                 (CASE WHEN wc.leave_type_id IS NOT NULL THEN 1 ELSE 0 END) DESC
        LIMIT 1
    """), {"cat": emp_dict["cat_code"], "ltc": leave_type_code})
    wf_row = wf.fetchone()
    if not wf_row:
        raise HTTPException(status_code=400, detail="No applicable workflow configuration found")

    # Overlap validation (app-level)
    overlap = await db.execute(text("""
        SELECT id FROM leave_applications
        WHERE employee_id = :eid
          AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED')
          AND from_date <= :td AND to_date >= :fd
        LIMIT 1
    """), {"eid": emp_id, "fd": from_date, "td": to_date})
    if overlap.fetchone():
        raise HTTPException(status_code=400, detail="Dates overlap with an existing active leave application")

    # Generate app_number: HRMS/YYYY/NNNNN
    yr = datetime.utcnow().year
    count_result = await db.execute(text("SELECT COUNT(*) FROM leave_applications WHERE app_number LIKE :pat"), {"pat": f"HRMS/{yr}/%"})
    seq = count_result.fetchone()[0] + 1
    app_number = f"HRMS/{yr}/{seq:05d}"

    # Insert
    app_id = str(uuid.uuid4())
    try:
        await db.execute(text("""
            INSERT INTO leave_applications
                (id, app_number, config_id, employee_id, leave_type_id, from_date, to_date, applied_days,
                 is_half_day, half_day_session, reason, address_during_leave, status, submitted_at)
            VALUES (:id, :an, :cid, :eid, :lid, :fd, :td, :ad, :hd, :hds, :reason, :addr, 'SUBMITTED', now())
        """), {
            "id": app_id, "an": app_number, "cid": str(wf_row.id), "eid": emp_id, "lid": str(lt_row.id),
            "fd": from_date, "td": to_date, "ad": applied_days,
            "hd": is_half_day, "hds": half_day_session,
            "reason": reason, "addr": address,
        })
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Dates overlap with an existing approved leave (concurrent submission)")
    return {"id": app_id, "app_number": app_number, "status": "SUBMITTED", "applied_days": applied_days}


@router.get("")
async def list_applications(
    status: str = Query(None), employee_id: str = Query(None),
    skip: int = Query(0), limit: int = Query(50),
    current_user: dict = Depends(get_current_user),
    scope: dict = Depends(employee_scope),
    db: AsyncSession = Depends(get_db),
):
    query = """
        SELECT a.*, e.name AS emp_name, e.emp_code, lt.code AS leave_type_code
        FROM leave_applications a
        JOIN employees e ON a.employee_id = e.id
        JOIN leave_types lt ON a.leave_type_id = lt.id
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
async def get_application(application_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT a.*, e.name AS emp_name, e.emp_code, lt.code AS leave_type_code
        FROM leave_applications a
        JOIN employees e ON a.employee_id = e.id
        JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE a.id = :id
    """), {"id": application_id})
    app = result.fetchone()
    if not app: raise HTTPException(status_code=404)
    return dict(app._mapping)


@router.put("/{application_id}/withdraw")
async def withdraw_application(application_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    app = await db.execute(text("SELECT status FROM leave_applications WHERE id = :id"), {"id": application_id})
    row = app.fetchone()
    if not row: raise HTTPException(status_code=404)
    if row.status not in ("SUBMITTED", "UNDER_REVIEW"): raise HTTPException(status_code=400, detail=f"Cannot withdraw in status {row.status}")
    await db.execute(text("UPDATE leave_applications SET status = 'WITHDRAWN', last_action_at = now() WHERE id = :id"), {"id": application_id})
    await db.commit()
    return {"message": "Withdrawn"}


@router.get("/{application_id}/approval-trail")
async def approval_trail(application_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT a.*, u.username
        FROM leave_approvals a
        JOIN users u ON a.approver_id = u.id
        WHERE a.application_id = :aid
        ORDER BY a.step_order
    """), {"aid": application_id})
    return [dict(r._mapping) for r in result.fetchall()]