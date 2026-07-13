"""Employee lifecycle actions — deactivate, reactivate, designation change, transfer."""

from __future__ import annotations

import json
import uuid
from datetime import date
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.leave_balance_bootstrap import bootstrap_leave_balances
from app.services.staff_number import resolve_staff_group

LIFECYCLE_ACTIONS = frozenset(
    {
        "deactivate",
        "reactivate",
        "change_designation",
        "transfer",
        # Legacy aliases
        "resign",
        "rejoin",
        "promote",
        "demote",
    }
)

_ACTION_ALIASES = {
    "resign": "deactivate",
    "rejoin": "reactivate",
    "promote": "change_designation",
    "demote": "change_designation",
}


def normalize_lifecycle_action(action: str) -> str:
    return _ACTION_ALIASES.get(action, action)


async def _fetch_employee_row(db: AsyncSession, employee_id: str):
    result = await db.execute(
        text(
            """
            SELECT e.id, e.emp_code, e.name, e.is_active, e.doj, e.dol_last_working,
                   e.category_id, e.department_id, e.designation_id, e.staff_group, e.pay_level,
                   c.code AS category_code, c.leave_scheme,
                   d.code AS department_code, d.name AS department_name,
                   des.name AS designation_name,
                   u.id AS user_id, u.role AS user_role, u.is_active AS user_is_active
            FROM employees e
            JOIN employee_categories c ON e.category_id = c.id
            JOIN departments d ON e.department_id = d.id
            JOIN designations des ON e.designation_id = des.id
            LEFT JOIN users u ON u.employee_id = e.id
            WHERE e.id = :eid
            """
        ),
        {"eid": employee_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Employee not found")
    return row


async def _assert_nodal_can_act(
    db: AsyncSession,
    user_id: str,
    role: str,
    employee_id: str,
    *,
    target_leave_scheme: str | None = None,
) -> None:
    if role not in ("NODAL_OFFICER", "NODAL_OFFICE"):
        return
    from app.services.nodal_routing import employee_in_nodal_scope, get_nodal_office_for_user

    if not await employee_in_nodal_scope(db, user_id, role, employee_id):
        raise HTTPException(status_code=403, detail="Not authorized for this employee")
    if target_leave_scheme:
        office = await get_nodal_office_for_user(db, user_id, role)
        if not office or office.leave_scheme != target_leave_scheme:
            raise HTTPException(status_code=403, detail="Not authorized for this staff category scheme")


async def _lookup_designation(
    db: AsyncSession,
    designation_name: str,
) -> Any:
    result = await db.execute(
        text(
            """
            SELECT des.id, des.category_id, c.code AS category_code, c.leave_scheme
            FROM designations des
            JOIN employee_categories c ON des.category_id = c.id
            WHERE des.name = :n AND COALESCE(des.is_active, true) = true
            """
        ),
        {"n": designation_name},
    )
    rows = result.fetchall()
    if not rows:
        raise HTTPException(status_code=400, detail=f"Unknown designation: {designation_name}")
    if len(rows) > 1:
        raise HTTPException(
            status_code=400,
            detail=f"Ambiguous designation name: {designation_name} — use a unique designation",
        )
    return rows[0]


async def _write_lifecycle_audit(
    db: AsyncSession,
    *,
    actor_id: str,
    impersonated_by: str | None,
    employee_id: str,
    action: str,
    before_state: dict,
    after_state: dict,
) -> None:
    await db.execute(
        text(
            """
            INSERT INTO audit_log (id, actor_id, impersonated_by, entity_type, entity_id, action, before_state, after_state)
            VALUES (:id, :aid, :impersonated_by, 'employee', :eid, :action, CAST(:before AS jsonb), CAST(:after AS jsonb))
            """
        ),
        {
            "id": str(uuid.uuid4()),
            "aid": actor_id,
            "impersonated_by": impersonated_by,
            "eid": employee_id,
            "action": f"EMPLOYEE_{action.upper()}",
            "before": json.dumps(before_state),
            "after": json.dumps(after_state),
        },
    )


def _snapshot(row) -> dict:
    return {
        "emp_code": row.emp_code,
        "name": row.name,
        "is_active": bool(row.is_active),
        "category_code": row.category_code,
        "department_code": row.department_code,
        "department_name": row.department_name,
        "designation_name": row.designation_name,
        "staff_group": row.staff_group,
        "pay_level": row.pay_level,
        "doj": row.doj.isoformat() if row.doj else None,
        "dol_last_working": row.dol_last_working.isoformat() if row.dol_last_working else None,
        "user_role": row.user_role,
        "user_is_active": bool(row.user_is_active) if row.user_is_active is not None else None,
    }


async def _deactivate_hod_if_needed(db: AsyncSession, user_id: str, user_role: str | None) -> None:
    if user_role != "HOD":
        return
    await db.execute(text("UPDATE users SET role = 'STAFF' WHERE id = :uid"), {"uid": user_id})
    await db.execute(
        text(
            """
            UPDATE dept_hod_assignments
            SET is_active = false
            WHERE hod_user_id = :uid AND is_active = true
            """
        ),
        {"uid": user_id},
    )


async def run_employee_lifecycle(
    db: AsyncSession,
    employee_id: str,
    body: dict,
    *,
    actor_id: str,
    impersonated_by: str | None,
    actor_role: str,
) -> dict:
    raw_action = body.get("action")
    if raw_action not in LIFECYCLE_ACTIONS:
        raise HTTPException(
            status_code=400,
            detail="action must be deactivate, reactivate, change_designation, or transfer",
        )
    action = normalize_lifecycle_action(raw_action)

    before_row = await _fetch_employee_row(db, employee_id)
    before = _snapshot(before_row)
    user_id = str(before_row.user_id) if before_row.user_id else None

    await _assert_nodal_can_act(db, actor_id, actor_role, employee_id)

    if action == "deactivate":
        if not before_row.is_active:
            raise HTTPException(status_code=400, detail="Employee is already inactive")
        dol = body.get("dol_last_working")
        await db.execute(
            text(
                """
                UPDATE employees
                SET is_active = false, dol_last_working = COALESCE(CAST(:dol AS date), CURRENT_DATE)
                WHERE id = :eid
                """
            ),
            {"eid": employee_id, "dol": dol},
        )
        if user_id:
            await db.execute(text("UPDATE users SET is_active = false WHERE id = :uid"), {"uid": user_id})
            await _deactivate_hod_if_needed(db, user_id, before_row.user_role)

    elif action == "reactivate":
        if before_row.is_active:
            raise HTTPException(status_code=400, detail="Employee is already active")
        rejoin_doj = body.get("doj")
        if rejoin_doj:
            await db.execute(
                text(
                    """
                    UPDATE employees
                    SET is_active = true, dol_last_working = NULL, doj = CAST(:doj AS date), doj_actual = CAST(:doj AS date)
                    WHERE id = :eid
                    """
                ),
                {"eid": employee_id, "doj": rejoin_doj},
            )
        else:
            await db.execute(
                text("UPDATE employees SET is_active = true, dol_last_working = NULL WHERE id = :eid"),
                {"eid": employee_id},
            )
        if user_id:
            await db.execute(text("UPDATE users SET is_active = true WHERE id = :uid"), {"uid": user_id})
        doj_row = await db.execute(text("SELECT doj FROM employees WHERE id = :eid"), {"eid": employee_id})
        doj_val = doj_row.fetchone()
        if doj_val and doj_val[0]:
            await bootstrap_leave_balances(
                db,
                employee_id,
                doj_val[0],
                actor_id=actor_id,
                impersonated_by=impersonated_by,
            )

    elif action == "change_designation":
        if not before_row.is_active:
            raise HTTPException(status_code=400, detail="Cannot change designation for an inactive employee")
        new_desg = body.get("designation_name")
        if not new_desg:
            raise HTTPException(status_code=400, detail="designation_name required")
        des_row = await _lookup_designation(db, new_desg)
        await _assert_nodal_can_act(
            db, actor_id, actor_role, employee_id, target_leave_scheme=des_row.leave_scheme
        )
        dept_code = before_row.department_code
        new_group = resolve_staff_group(
            designation_name=new_desg,
            category_code=des_row.category_code,
            department_code=dept_code,
        )
        updates: dict = {
            "desg_id": str(des_row.id),
            "cat_id": str(des_row.category_id),
            "eid": employee_id,
        }
        set_parts = ["designation_id = :desg_id", "category_id = :cat_id"]
        if new_group:
            updates["staff_group"] = new_group
            set_parts.append("staff_group = :staff_group")
        if body.get("pay_level"):
            updates["pay_level"] = str(body["pay_level"]).upper()
            set_parts.append("pay_level = :pay_level")
        await db.execute(
            text(f"UPDATE employees SET {', '.join(set_parts)} WHERE id = :eid"),
            updates,
        )
        doj_row = await db.execute(text("SELECT doj FROM employees WHERE id = :eid"), {"eid": employee_id})
        doj_val = doj_row.fetchone()
        if doj_val and doj_val[0]:
            await bootstrap_leave_balances(
                db,
                employee_id,
                doj_val[0],
                actor_id=actor_id,
                impersonated_by=impersonated_by,
            )

    elif action == "transfer":
        if not before_row.is_active:
            raise HTTPException(status_code=400, detail="Cannot transfer an inactive employee")
        dept_code = body.get("department_code")
        if not dept_code:
            raise HTTPException(status_code=400, detail="department_code required")
        dept = await db.execute(
            text("SELECT id, code FROM departments WHERE code = :c AND COALESCE(is_active, true) = true"),
            {"c": dept_code},
        )
        dept_row = dept.fetchone()
        if not dept_row:
            raise HTTPException(status_code=400, detail=f"Unknown department: {dept_code}")
        new_group = resolve_staff_group(
            designation_name=before_row.designation_name,
            category_code=before_row.category_code,
            department_code=dept_row.code,
        )
        updates = {"dept_id": str(dept_row.id), "eid": employee_id}
        set_parts = ["department_id = :dept_id"]
        if new_group:
            updates["staff_group"] = new_group
            set_parts.append("staff_group = :staff_group")
        await db.execute(
            text(f"UPDATE employees SET {', '.join(set_parts)} WHERE id = :eid"),
            updates,
        )

    reporting_officer_id = body.get("reporting_officer_id")
    if reporting_officer_id and action in ("transfer", "change_designation"):
        await db.execute(
            text("UPDATE employees SET reporting_officer_id = :roid WHERE id = :eid"),
            {"roid": reporting_officer_id, "eid": employee_id},
        )

    after_row = await _fetch_employee_row(db, employee_id)
    after = _snapshot(after_row)
    await _write_lifecycle_audit(
        db,
        actor_id=actor_id,
        impersonated_by=impersonated_by,
        employee_id=employee_id,
        action=action,
        before_state=before,
        after_state=after,
    )
    await db.commit()
    return {"message": f"Employee {action} completed", "employee_id": employee_id, "action": action}
