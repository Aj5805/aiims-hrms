"""Attendance report and leave-sync pipeline (biometric integration reserved)."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import employee_scope, get_current_user, require_role
from app.core.database import get_db
from app.services.attendance_report import fetch_attendance_report, sync_attendance_from_leave

router = APIRouter(prefix="/attendance", tags=["attendance"])

ATTENDANCE_VIEW_ROLES = (
    "ADMIN",
    "DIRECTOR",
    "NODAL_OFFICER",
    "NODAL_OFFICE",
    "HOD",
    "STAFF",
)
ATTENDANCE_SYNC_ROLES = ("ADMIN", "NODAL_OFFICER", "NODAL_OFFICE")


def _resolve_employee_filter(scope: dict, employee_id: str | None) -> list[str] | None:
    if scope["scope"] == "all":
        return [employee_id] if employee_id else None
    allowed = scope.get("employee_ids") or []
    if employee_id:
        if employee_id not in allowed:
            raise HTTPException(status_code=403, detail="Not authorized for this employee")
        return [employee_id]
    return allowed


@router.get("/report")
async def attendance_report(
    from_date: str = Query(...),
    to_date: str = Query(...),
    employee_id: str | None = Query(None),
    department_id: str | None = Query(None),
    sync: bool = Query(False, description="Refresh leave-derived rows before returning"),
    current_user: dict = Depends(get_current_user),
    scope: dict = Depends(employee_scope),
    db: AsyncSession = Depends(get_db),
):
    """Daily attendance view — stage 1 from approved leave; biometric review is future."""
    fd = date.fromisoformat(from_date)
    td = date.fromisoformat(to_date)
    if fd > td:
        raise HTTPException(status_code=400, detail="from_date must be <= to_date")

    employee_ids = _resolve_employee_filter(scope, employee_id)
    if sync:
        await sync_attendance_from_leave(db, from_date=fd, to_date=td, employee_ids=employee_ids)

    rows = await fetch_attendance_report(
        db,
        from_date=fd,
        to_date=td,
        employee_ids=employee_ids,
        department_id=department_id,
    )
    return {
        "from_date": from_date,
        "to_date": to_date,
        "count": len(rows),
        "pipeline": {
            "stage_1": "leave_derived",
            "stage_2": "biometric_import (future)",
            "stage_3": "review_match (future)",
            "stage_4": "final_attendance (future)",
        },
        "rows": rows,
    }


@router.post("/sync-from-leave")
async def sync_from_leave(
    body: dict,
    _: dict = Depends(require_role(*ATTENDANCE_SYNC_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    """Rebuild leave-derived attendance rows for a date range."""
    from_date = date.fromisoformat(body["from_date"])
    to_date = date.fromisoformat(body["to_date"])
    employee_ids = body.get("employee_ids")
    result = await sync_attendance_from_leave(
        db,
        from_date=from_date,
        to_date=to_date,
        employee_ids=employee_ids,
    )
    await db.commit()
    return result


@router.get("/pipeline-status")
async def pipeline_status(
    current_user: dict = Depends(get_current_user),
):
    """Describe the attendance pipeline stages for UI and future biometric hookup."""
    return {
        "stages": [
            {
                "order": 1,
                "key": "leave_derived",
                "label": "Leave data",
                "status": "active",
                "description": "Approved leave marks days as ON_LEAVE; working days as ON_DUTY.",
            },
            {
                "order": 2,
                "key": "biometric_import",
                "label": "Biometric import",
                "status": "planned",
                "description": "Punch data lands in attendance_raw; linked to attendance_daily.",
            },
            {
                "order": 3,
                "key": "review_match",
                "label": "Review",
                "status": "planned",
                "description": "Compare leave vs biometric; flag MATCHED or CONFLICT.",
            },
            {
                "order": 4,
                "key": "final_attendance",
                "label": "Final attendance",
                "status": "planned",
                "description": "Authorized officer confirms final_status for payroll.",
            },
        ],
        "biometric_table": "attendance_raw",
        "daily_table": "attendance_daily",
    }
