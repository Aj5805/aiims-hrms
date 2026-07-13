"""Build approval movement trail for a leave application."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.leave_approvals import _resolve_approver_user

ROLE_LABELS = {
    "HOD": "Head of Department",
    "NODAL_OFFICER": "Nodal Officer",
    "SPECIFIC_USER": "Designated approver",
    "ADMIN": "Administration",
}

ACTIVE_STATUSES = frozenset({"SUBMITTED", "UNDER_REVIEW"})
TERMINAL_STATUSES = frozenset({"REJECTED", "WITHDRAWN", "CANCELLED", "RECALLED"})

_TEAM_TRAIL_ROLES = frozenset({"HOD", "NODAL_OFFICER", "NODAL_OFFICE", "DIRECTOR"})


def _employee_in_viewer_scope(scope: dict | None, employee_id: str) -> bool:
    if not scope:
        return False
    employee_ids = scope.get("employee_ids")
    if employee_ids is None:
        return True
    return employee_id in employee_ids


async def _user_display_name(db: AsyncSession, user_id: str | None) -> str | None:
    if not user_id:
        return None
    result = await db.execute(
        text("""
            SELECT COALESCE(e.name, u.username) AS display_name
            FROM users u
            LEFT JOIN employees e ON u.employee_id = e.id
            WHERE u.id = :uid
        """),
        {"uid": user_id},
    )
    row = result.fetchone()
    return row[0] if row else None


async def _matches_inbox_approver(
    db: AsyncSession,
    *,
    user_id: str,
    role: str,
    employee_id: str,
    config_id: str,
    current_step_order: int,
    status: str,
) -> bool:
    """Same visibility rules as GET /leave-approvals/inbox — approvers must see the trail."""
    if status not in ACTIVE_STATUSES:
        return False

    step_res = await db.execute(
        text("""
            SELECT ws.approver_role, ws.specific_approver_id
            FROM workflow_steps ws
            WHERE ws.config_id = :cid AND ws.step_order = :so
            LIMIT 1
        """),
        {"cid": config_id, "so": current_step_order},
    )
    step = step_res.fetchone()
    if not step:
        return False

    approver_role = step.approver_role
    specific_id = step.specific_approver_id

    if approver_role == "SPECIFIC_USER" and specific_id and str(specific_id) == user_id:
        return True

    if approver_role == role and approver_role not in ("NODAL_OFFICER", "SPECIFIC_USER"):
        if role == "HOD":
            actor_emp = await db.execute(
                text("SELECT employee_id FROM users WHERE id = :uid"),
                {"uid": user_id},
            )
            actor_row = actor_emp.fetchone()
            actor_emp_id = str(actor_row[0]) if actor_row and actor_row[0] else None
            if actor_emp_id and actor_emp_id == employee_id:
                return False
        return True

    if approver_role == "NODAL_OFFICER" and role == "NODAL_OFFICER":
        nodal_match = await db.execute(
            text("""
                SELECT 1
                FROM nodal_offices no
                JOIN employee_categories c ON c.id = (
                    SELECT category_id FROM employees WHERE id = :eid
                )
                WHERE no.officer_user_id = :uid
                  AND no.is_active = true
                  AND no.leave_scheme = c.leave_scheme
                LIMIT 1
            """),
            {"uid": user_id, "eid": employee_id},
        )
        return nodal_match.fetchone() is not None

    return False


async def can_view_trail(
    db: AsyncSession,
    *,
    user_id: str,
    role: str,
    application_id: str,
    employee_id: str,
    config_id: str,
    current_step_order: int,
    status: str,
    employee_scope: dict | None = None,
) -> bool:
    if role == "ADMIN":
        return True

    if role in _TEAM_TRAIL_ROLES and _employee_in_viewer_scope(employee_scope, employee_id):
        return True

    applicant_user = await db.execute(
        text("SELECT id FROM users WHERE employee_id = :eid AND is_active = true ORDER BY created_at LIMIT 1"),
        {"eid": employee_id},
    )
    applicant_row = applicant_user.fetchone()
    if applicant_row and str(applicant_row[0]) == user_id:
        return True

    acted = await db.execute(
        text("SELECT 1 FROM leave_approvals WHERE application_id = :aid AND approver_id = :uid LIMIT 1"),
        {"aid": application_id, "uid": user_id},
    )
    if acted.fetchone():
        return True

    if await _matches_inbox_approver(
        db,
        user_id=user_id,
        role=role,
        employee_id=employee_id,
        config_id=config_id,
        current_step_order=current_step_order,
        status=status,
    ):
        return True

    if status in ACTIVE_STATUSES:
        current_approver = await _resolve_approver_user(db, config_id, current_step_order, employee_id)
        if current_approver == user_id:
            return True

    return False


def _step_status(
    *,
    step_order: int,
    current_step_order: int,
    app_status: str,
    has_action: bool,
) -> str:
    if has_action:
        return "completed"
    if app_status == "APPROVED":
        return "skipped" if step_order <= current_step_order else "not_reached"
    if app_status in TERMINAL_STATUSES:
        if step_order > current_step_order:
            return "not_reached"
        if step_order == current_step_order:
            return "not_reached"
        return "skipped"
    if step_order < current_step_order:
        return "skipped"
    if step_order == current_step_order and app_status in ACTIVE_STATUSES:
        return "current"
    return "pending"


def _action_label(action: str | None, *, is_final: bool) -> str | None:
    if not action:
        return None
    if action == "APPROVED":
        return "Approved" if is_final else "Approved & forwarded"
    if action == "FORWARDED":
        return "Forwarded"
    if action == "REJECTED":
        return "Rejected"
    if action == "MODIFIED":
        return "Modified & forwarded"
    if action == "RETURNED":
        return "Returned"
    if action == "RECALLED":
        return "Recalled"
    return action.replace("_", " ").title()


async def build_approval_trail(db: AsyncSession, application_id: str) -> dict | None:
    app_res = await db.execute(
        text("""
            SELECT a.id, a.app_number, a.status, a.current_step_order, a.config_id, a.employee_id,
                   a.submitted_at, a.last_action_at, e.name AS employee_name, e.emp_code
            FROM leave_applications a
            JOIN employees e ON a.employee_id = e.id
            WHERE a.id = :id
        """),
        {"id": application_id},
    )
    app = app_res.fetchone()
    if not app:
        return None
    app_dict = dict(app._mapping)

    steps_res = await db.execute(
        text("""
            SELECT ws.id AS step_id, ws.step_order, ws.approver_role, ws.approver_office,
                   ws.is_final_authority,
                   la.id AS approval_id, la.action, la.acted_at, la.remarks,
                   la.approver_id,
                   COALESCE(e.name, u.username) AS actor_name
            FROM workflow_steps ws
            LEFT JOIN leave_approvals la ON ws.id = la.step_id AND la.application_id = :leave_id
            LEFT JOIN users u ON la.approver_id = u.id
            LEFT JOIN employees e ON u.employee_id = e.id
            WHERE ws.config_id = :config_id
            ORDER BY ws.step_order ASC
        """),
        {"leave_id": application_id, "config_id": app_dict["config_id"]},
    )

    steps: list[dict] = []
    for row in steps_res.fetchall():
        step = dict(row._mapping)
        expected_user_id = await _resolve_approver_user(
            db,
            str(app_dict["config_id"]),
            step["step_order"],
            str(app_dict["employee_id"]),
        )
        expected_name = await _user_display_name(db, expected_user_id)
        step_status = _step_status(
            step_order=step["step_order"],
            current_step_order=app_dict["current_step_order"],
            app_status=app_dict["status"],
            has_action=bool(step.get("action")),
        )
        steps.append(
            {
                "step_order": step["step_order"],
                "approver_role": step["approver_role"],
                "role_label": ROLE_LABELS.get(step["approver_role"], step["approver_role"]),
                "approver_office": step.get("approver_office"),
                "is_final_authority": bool(step.get("is_final_authority")),
                "step_status": step_status,
                "expected_approver_name": expected_name,
                "action": step.get("action"),
                "action_label": _action_label(step.get("action"), is_final=bool(step.get("is_final_authority"))),
                "actor_name": step.get("actor_name"),
                "acted_at": step["acted_at"].isoformat() if step.get("acted_at") else None,
                "remarks": step.get("remarks"),
            }
        )

    submitted_at = app_dict.get("submitted_at")
    current_holder = None
    if app_dict["status"] in ACTIVE_STATUSES:
        holder_id = await _resolve_approver_user(
            db,
            str(app_dict["config_id"]),
            app_dict["current_step_order"],
            str(app_dict["employee_id"]),
        )
        current_holder = {
            "step_order": app_dict["current_step_order"],
            "approver_name": await _user_display_name(db, holder_id),
            "role_label": ROLE_LABELS.get(
                next((s["approver_role"] for s in steps if s["step_order"] == app_dict["current_step_order"]), ""),
                "",
            ),
            "since": (app_dict.get("last_action_at") or submitted_at).isoformat()
            if (app_dict.get("last_action_at") or submitted_at)
            else None,
        }

    return {
        "application": {
            "id": str(app_dict["id"]),
            "app_number": app_dict["app_number"],
            "status": app_dict["status"],
            "current_step_order": app_dict["current_step_order"],
            "submitted_at": submitted_at.isoformat() if submitted_at else None,
            "employee_name": app_dict["employee_name"],
            "emp_code": app_dict["emp_code"],
        },
        "submitted_by": {
            "name": app_dict["employee_name"],
            "acted_at": submitted_at.isoformat() if submitted_at else None,
        },
        "current_with": current_holder,
        "steps": steps,
    }
