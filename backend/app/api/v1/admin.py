"""Admin panel routes -- audit log, health dashboard, session management."""

from datetime import date, datetime, timedelta
from pathlib import Path

from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.auth.roles import is_assignable_role, normalize_role
from app.core.config import settings
from app.core.database import engine, get_db

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/audit-log")
async def audit_log(
    entity_type: str | None = Query(None),
    actor_id: str | None = Query(None),
    action: str | None = Query(None),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    skip: int = Query(0),
    limit: int = Query(50),
    _: dict = Depends(require_role("ADMIN", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    query = "SELECT * FROM audit_log WHERE 1=1"
    params: dict[str, object] = {"skip": skip, "limit": limit}

    if entity_type:
        query += " AND entity_type = :entity_type"
        params["entity_type"] = entity_type
    if actor_id:
        query += " AND actor_id = :actor_id"
        params["actor_id"] = actor_id
    if action:
        query += " AND action = :action"
        params["action"] = action
    if from_date:
        query += " AND created_at >= :from_ts"
        params["from_ts"] = datetime.combine(date.fromisoformat(from_date), datetime.min.time())
    if to_date:
        query += " AND created_at < :to_ts"
        params["to_ts"] = datetime.combine(date.fromisoformat(to_date), datetime.min.time()) + timedelta(days=1)

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :skip"
    result = await db.execute(text(query), params)
    return [dict(row._mapping) for row in result.fetchall()]


POLICY_CATEGORY_CODES = ("FACULTY", "NURSING", "ADMIN", "JR_ACAD", "SR_ACAD", "JR_NA", "SR_NA")


async def _scalar_count(db: AsyncSession, query: str, params: dict | None = None) -> int:
    result = await db.execute(text(query), params or {})
    return int(result.scalar() or 0)


@router.get("/summary")
async def admin_summary(
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Institution-wide counts for the admin dashboard — one round-trip."""
    employees_total = await _scalar_count(db, "SELECT COUNT(*) FROM employees")
    employees_active = await _scalar_count(db, "SELECT COUNT(*) FROM employees WHERE is_active = true")
    pending_leaves = await _scalar_count(
        db,
        "SELECT COUNT(*) FROM leave_applications WHERE status IN ('SUBMITTED', 'UNDER_REVIEW')",
    )
    departments_without_hod = await _scalar_count(
        db,
        """
        SELECT COUNT(*) FROM departments d
        WHERE d.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM dept_hod_assignments dha
            WHERE dha.department_id = d.id AND dha.is_active = true
          )
        """,
    )
    policy_gaps = await _scalar_count(
        db,
        """
        SELECT COUNT(*) FROM (
            SELECT c.code AS category_code, lt.code AS leave_type_code
            FROM employee_categories c
            CROSS JOIN leave_types lt
            WHERE (
                (c.leave_scheme = 'CCS' AND lt.scheme IN ('CCS', 'BOTH'))
                OR (c.leave_scheme = 'RESIDENCY' AND lt.scheme IN ('RESIDENCY', 'BOTH'))
            )
            AND COALESCE(lt.is_active, true) = true
            AND NOT EXISTS (
                SELECT 1 FROM leave_entitlement_rules ler
                WHERE ler.category_id = c.id AND ler.leave_type_id = lt.id
            )
        ) missing
        """,
    )

    role_rows = await db.execute(
        text("""
            SELECT role, COUNT(*) AS cnt
            FROM users
            WHERE COALESCE(is_active, true) = true
            GROUP BY role
            ORDER BY role
        """)
    )
    users_by_role = {row.role: int(row.cnt) for row in role_rows.fetchall()}

    users_unmapped = await _scalar_count(
        db,
        "SELECT COUNT(*) FROM users WHERE employee_id IS NULL AND COALESCE(is_active, true) = true",
    )
    users_reset_pending = await _scalar_count(
        db,
        "SELECT COUNT(*) FROM users WHERE must_change_password = true AND COALESCE(is_active, true) = true",
    )
    users_inactive = await _scalar_count(
        db,
        "SELECT COUNT(*) FROM users WHERE COALESCE(is_active, true) = false",
    )
    users_active = sum(users_by_role.values())

    async def _master_counts(table: str) -> dict[str, int]:
        active = await _scalar_count(
            db,
            f"SELECT COUNT(*) FROM {table} WHERE COALESCE(is_active, true) = true",
        )
        inactive = await _scalar_count(
            db,
            f"SELECT COUNT(*) FROM {table} WHERE COALESCE(is_active, true) = false",
        )
        return {"active": active, "inactive": inactive, "total": active + inactive}

    departments = await _master_counts("departments")
    designations = await _master_counts("designations")
    leave_types = await _master_counts("leave_types")
    nodal_offices = await _master_counts("nodal_offices")

    nodal_scheme_rows = await db.execute(
        text("""
            SELECT leave_scheme, COUNT(*) AS cnt
            FROM nodal_offices
            WHERE COALESCE(is_active, true) = true
            GROUP BY leave_scheme
        """)
    )
    nodal_by_scheme = {row.leave_scheme: int(row.cnt) for row in nodal_scheme_rows.fetchall()}

    maintenance_res = await db.execute(text("SELECT value FROM system_settings WHERE key = 'maintenance_mode'"))
    maintenance_row = maintenance_res.fetchone()
    maintenance_mode = bool(maintenance_row and maintenance_row.value == "true")

    attention_count = (
        users_unmapped
        + users_reset_pending
        + policy_gaps
        + pending_leaves
        + departments_without_hod
        + (1 if maintenance_mode else 0)
    )

    return {
        "employees": {"total": employees_total, "active": employees_active},
        "users": {
            "active": users_active,
            "inactive": users_inactive,
            "unmapped": users_unmapped,
            "reset_pending": users_reset_pending,
            "by_role": users_by_role,
        },
        "workflow": {"pending_applications": pending_leaves},
        "hod": {"departments_without_hod": departments_without_hod},
        "policy": {"missing_rules": policy_gaps, "categories": list(POLICY_CATEGORY_CODES)},
        "masters": {
            "departments": departments,
            "designations": designations,
            "leave_types": leave_types,
            "nodal_offices": nodal_offices,
            "nodal_by_scheme": nodal_by_scheme,
        },
        "maintenance_mode": maintenance_mode,
        "attention_items": attention_count,
    }


@router.get("/health-dashboard")
async def health_dashboard(
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    queue_depth = await db.execute(text("SELECT COUNT(*) FROM notification_queue WHERE status = 'PENDING'"))
    pending_count = int(queue_depth.scalar() or 0)

    error_count = await db.execute(
        text("SELECT COUNT(*) FROM notification_queue WHERE status = 'FAILED' AND created_at > now() - interval '24 hours'")
    )
    recent_errors = int(error_count.scalar() or 0)

    total_recent = await db.execute(text("SELECT COUNT(*) FROM notification_queue WHERE created_at > now() - interval '24 hours'"))
    total_recent_notifications = int(total_recent.scalar() or 0)
    error_rate = round(recent_errors / total_recent_notifications, 4) if total_recent_notifications else 0.0

    backup_dir = Path(settings.BACKUP_DIR)
    last_backup = None
    if backup_dir.exists() and backup_dir.is_dir():
        backup_files = [path for path in backup_dir.iterdir() if path.is_file()]
        if backup_files:
            latest = max(backup_files, key=lambda item: item.stat().st_mtime)
            last_backup = datetime.fromtimestamp(latest.stat().st_mtime).isoformat()

    pool = engine.pool
    return {
        "queue_depth": pending_count,
        "recent_errors_24h": recent_errors,
        "error_rate": error_rate,
        "db_pool_size": pool.size(),
        "db_pool_checked_in": pool.checkedin(),
        "last_backup": last_backup,
    }


@router.post("/force-logout/{user_id}")
async def force_logout(user_id: str, _: dict = Depends(require_role("ADMIN")), db: AsyncSession = Depends(get_db)):
    await db.execute(
        text("INSERT INTO token_blacklist (jti, user_id, expires_at) SELECT uuid_generate_v4(), :user_id, now() + interval '8 hours'"),
        {"user_id": user_id},
    )
    await db.commit()
    return {"message": "All sessions invalidated"}

@router.post("/maintenance-mode")
async def toggle_maintenance_mode(
    enable: bool = Query(...),
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    value = "true" if enable else "false"
    await db.execute(
        text("UPDATE system_settings SET value = :val::json, updated_at = now() WHERE key = 'maintenance_mode'"),
        {"val": f'"{value}"' if value == "true" else "false"} # proper JSON representation
    )
    await db.commit()
    return {"maintenance_mode": enable}

@router.get("/maintenance-mode")
async def get_maintenance_mode(
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(text("SELECT value FROM system_settings WHERE key = 'maintenance_mode'"))
    row = res.fetchone()
    is_enabled = False
    if row and row.value == "true":
        is_enabled = True
    return {"maintenance_mode": is_enabled}


@router.get("/workflow/{leave_id}")
async def get_workflow_diagnostics(
    leave_id: str,
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    # Fetch application info
    app_res = await db.execute(
        text("""
            SELECT id, app_number, status, current_step_order, config_id
            FROM leave_applications
            WHERE id = :leave_id
        """),
        {"leave_id": leave_id}
    )
    app = app_res.fetchone()
    if not app:
        return {"error": "Leave application not found"}

    # Fetch workflow steps and their approval status
    steps_res = await db.execute(
        text("""
            SELECT ws.id as step_id, ws.step_order, ws.approver_role, ws.approver_office, ws.is_final_authority,
                   la.id as approval_id, la.action, la.acted_at, la.remarks, u.email as approver_email, u.first_name, u.last_name
            FROM workflow_steps ws
            LEFT JOIN leave_approvals la ON ws.id = la.step_id AND la.application_id = :leave_id
            LEFT JOIN users u ON la.approver_id = u.id
            WHERE ws.config_id = :config_id
            ORDER BY ws.step_order ASC
        """),
        {"leave_id": leave_id, "config_id": app.config_id}
    )
    
    steps = []
    for row in steps_res.fetchall():
        steps.append(dict(row._mapping))
        
    return {
        "application": dict(app._mapping),
        "steps": steps
    }


@router.post("/workflow/{leave_id}/override")
async def override_workflow(
    leave_id: str,
    admin_user: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    # Fetch application
    app_res = await db.execute(
        text("SELECT id, status, current_step_order, config_id FROM leave_applications WHERE id = :leave_id"),
        {"leave_id": leave_id}
    )
    app = app_res.fetchone()
    if not app:
        return {"error": "Leave application not found"}

    if app.status == "APPROVED":
        return {"error": "Already approved"}

    # Force approve
    await db.execute(
        text("UPDATE leave_applications SET status = 'APPROVED', last_action_at = now() WHERE id = :leave_id"),
        {"leave_id": leave_id}
    )

    # Log in audit_log
    await db.execute(
        text("""
            INSERT INTO audit_log (entity_type, entity_id, actor_id, impersonated_by, action, changes)
            VALUES ('leave_application', :leave_id, :actor_id, :impersonated_by, 'ADMIN_OVERRIDE_APPROVE', '{"status": "APPROVED"}')
        """),
        {
            "leave_id": leave_id, 
            "actor_id": admin_user["user_id"],
            "impersonated_by": admin_user.get("impersonated_by")
        }
    )

    # Insert a leave approval record for the current step (or final step)
    # Find the current step
    step_res = await db.execute(
        text("SELECT id FROM workflow_steps WHERE config_id = :config_id AND step_order = :step_order"),
        {"config_id": app.config_id, "step_order": app.current_step_order}
    )
    step = step_res.fetchone()
    if step:
        await db.execute(
            text("""
                INSERT INTO leave_approvals (application_id, step_id, approver_id, step_order, action, remarks, acted_at)
                VALUES (:application_id, :step_id, :approver_id, :step_order, 'APPROVED', 'SYSTEM (Admin Override)', now())
            """),
            {
                "application_id": leave_id,
                "step_id": step.id,
                "approver_id": admin_user["user_id"],
                "step_order": app.current_step_order
            }
        )

    await db.commit()
    return {"message": "Application forcefully approved"}


class BulkRoleAssignment(BaseModel):
    user_id: str
    role: str

class BulkRoleRequest(BaseModel):
    assignments: List[BulkRoleAssignment]

@router.put("/bulk-roles")
async def bulk_update_roles(
    req: BulkRoleRequest,
    admin_user: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    updates = 0
    for assignment in req.assignments:
        if not is_assignable_role(assignment.role):
            raise HTTPException(status_code=400, detail=f"Invalid role: {assignment.role}")

        normalized_role = normalize_role(assignment.role)
        res = await db.execute(
            text("UPDATE users SET role = :role WHERE id = :id"),
            {"role": normalized_role, "id": assignment.user_id}
        )
        updates += res.rowcount
        
        # Optionally, insert into audit_log
        if res.rowcount > 0:
            await db.execute(
                text("""
                    INSERT INTO audit_log (entity_type, entity_id, actor_id, impersonated_by, action, changes)
                    VALUES ('user', :user_id, :actor_id, :impersonated_by, 'UPDATE_ROLE', :changes)
                """),
                {
                    "user_id": assignment.user_id,
                    "actor_id": admin_user["user_id"],
                    "impersonated_by": admin_user.get("impersonated_by"),
                    "changes": f'{{"role": "{normalized_role}"}}'
                }
            )

    await db.commit()
    return {"message": f"Successfully updated {updates} roles."}
