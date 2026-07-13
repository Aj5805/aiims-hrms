"""API v1 router -- Phases 2-8."""

from fastapi import APIRouter
from app.api.v1.attendance import router as attendance_router
from app.api.v1.auth import router as auth_router
from app.api.v1.employees import router as employees_router
from app.api.v1.departments import router as departments_router
from app.api.v1.designations import router as designations_router
from app.api.v1.users import router as users_router
from app.api.v1.leave_types import router as leave_types_router
from app.api.v1.leave_entitlement_rules import router as entitlement_router
from app.api.v1.holiday_master import router as holiday_router
from app.api.v1.workflow_configs import router as workflow_router
from app.api.v1.leave_balances import router as balances_router
from app.api.v1.leave_applications import router as applications_router
from app.api.v1.leave_approvals import router as approvals_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.reports import router as reports_router
from app.api.v1.admin import router as admin_router
from app.api.v1.broadcasts import router as broadcasts_router
from app.api.v1.nodal_offices import router as nodal_offices_router
from app.api.v1.hod_assignments import router as hod_assignments_router

router = APIRouter()
for r in [auth_router, employees_router, departments_router, designations_router, users_router,
          leave_types_router, entitlement_router, holiday_router, workflow_router, balances_router,
          applications_router, approvals_router, notifications_router, reports_router, admin_router,
          broadcasts_router, nodal_offices_router, hod_assignments_router, attendance_router]:
    router.include_router(r)

@router.get("/ping")
async def ping():
    return {"ping": "pong"}


@router.get("/system/time")
async def system_time():
    """Server clock for UI — returns local server timezone."""
    from datetime import datetime

    now = datetime.now().astimezone()
    return {
        "server_time": now.isoformat(),
        "timezone": str(now.tzinfo),
        "unix_ms": int(now.timestamp() * 1000),
    }