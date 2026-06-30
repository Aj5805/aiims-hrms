"""Nodal officer / nodal office department assignments — Super Admin maintenance."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.database import get_db

router = APIRouter(prefix="/nodal-assignments", tags=["nodal-assignments"])

_ADMIN_ROLES = ("ADMIN", "ESTABLISHMENT_OFFICER")
_NODAL_USER_ROLES = ("NODAL_OFFICER", "NODAL_OFFICE")


@router.get("")
async def list_assignments(
    department_code: str | None = None,
    nodal_user_id: str | None = None,
    active_only: bool = True,
    _: dict = Depends(require_role(*_ADMIN_ROLES, "REGISTRAR")),
    db: AsyncSession = Depends(get_db),
):
    query = """
        SELECT dna.id, dna.department_id, dna.nodal_user_id, dna.is_active, dna.assigned_at,
               d.code AS department_code, d.name AS department_name,
               u.username AS nodal_username, u.role AS nodal_role,
               e.name AS nodal_employee_name
        FROM dept_nodal_assignments dna
        JOIN departments d ON dna.department_id = d.id
        JOIN users u ON dna.nodal_user_id = u.id
        LEFT JOIN employees e ON u.employee_id = e.id
        WHERE 1=1
    """
    params: dict = {}
    if active_only:
        query += " AND dna.is_active = true"
    if department_code:
        query += " AND d.code = :dept_code"
        params["dept_code"] = department_code
    if nodal_user_id:
        query += " AND dna.nodal_user_id = :nodal_uid"
        params["nodal_uid"] = nodal_user_id
    query += " ORDER BY d.name, u.username"
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("", status_code=201)
async def create_assignment(
    body: dict,
    current_user: dict = Depends(require_role(*_ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    department_id = body.get("department_id")
    nodal_user_id = body.get("nodal_user_id")
    if not department_id or not nodal_user_id:
        raise HTTPException(status_code=400, detail="department_id and nodal_user_id are required")

    user_row = await db.execute(
        text("SELECT role FROM users WHERE id = :uid AND is_active = true"),
        {"uid": nodal_user_id},
    )
    u = user_row.fetchone()
    if not u:
        raise HTTPException(status_code=404, detail="Nodal user not found")
    if u.role not in _NODAL_USER_ROLES:
        raise HTTPException(status_code=400, detail="User must have NODAL_OFFICER or NODAL_OFFICE role")

    dept_row = await db.execute(text("SELECT id FROM departments WHERE id = :did"), {"did": department_id})
    if not dept_row.fetchone():
        raise HTTPException(status_code=404, detail="Department not found")

    aid = str(uuid.uuid4())
    try:
        await db.execute(
            text("""
                INSERT INTO dept_nodal_assignments (id, department_id, nodal_user_id, is_active, assigned_by)
                VALUES (:id, :did, :uid, true, :by)
            """),
            {"id": aid, "did": department_id, "uid": nodal_user_id, "by": current_user["user_id"]},
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="This department–nodal user assignment already exists")

    return {"id": aid, "message": "Assignment created"}


@router.put("/{assignment_id}")
async def update_assignment(
    assignment_id: str,
    body: dict,
    _: dict = Depends(require_role(*_ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    is_active = body.get("is_active")
    if is_active is None:
        raise HTTPException(status_code=400, detail="is_active is required")

    result = await db.execute(
        text("UPDATE dept_nodal_assignments SET is_active = :active WHERE id = :id RETURNING id"),
        {"active": bool(is_active), "id": assignment_id},
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Assignment not found")
    await db.commit()
    return {"message": "Assignment updated", "is_active": bool(is_active)}


@router.get("/nodal-users")
async def list_nodal_users(
    _: dict = Depends(require_role(*_ADMIN_ROLES, "REGISTRAR")),
    db: AsyncSession = Depends(get_db),
):
    """Users eligible for department assignment."""
    result = await db.execute(
        text("""
            SELECT u.id, u.username, u.role, e.name AS employee_name, e.emp_code
            FROM users u
            LEFT JOIN employees e ON u.employee_id = e.id
            WHERE u.role IN ('NODAL_OFFICER', 'NODAL_OFFICE') AND u.is_active = true
            ORDER BY u.role, u.username
        """)
    )
    return [dict(r._mapping) for r in result.fetchall()]
