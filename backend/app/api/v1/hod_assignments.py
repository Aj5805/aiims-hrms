"""Head of Department (HOD) department assignments."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.database import get_db

router = APIRouter(prefix="/hod-assignments", tags=["hod-assignments"])

_ADMIN_ROLES = ("ADMIN", "ESTABLISHMENT_OFFICER", "NODAL_OFFICER")


@router.get("")
async def list_hod_assignments(
    department_code: str | None = None,
    active_only: bool = True,
    current_user: dict = Depends(require_role(*_ADMIN_ROLES, "REGISTRAR")),
    db: AsyncSession = Depends(get_db),
):
    query = """
        SELECT dha.id, dha.department_id, dha.hod_user_id, dha.is_active, dha.assigned_at,
               d.code AS department_code, d.name AS department_name,
               u.username AS hod_username,
               e.name AS hod_employee_name, e.emp_code AS hod_emp_code
        FROM dept_hod_assignments dha
        JOIN departments d ON dha.department_id = d.id
        JOIN users u ON dha.hod_user_id = u.id
        LEFT JOIN employees e ON u.employee_id = e.id
        WHERE u.role = 'HOD'
    """
    params: dict = {}
    if active_only:
        query += " AND dha.is_active = true"
    if department_code:
        query += " AND d.code = :dept_code"
        params["dept_code"] = department_code
    if current_user["role"] == "NODAL_OFFICER":
        query += """
          AND d.id IN (
              SELECT department_id FROM dept_nodal_assignments
              WHERE nodal_user_id = :nodal_uid AND is_active = true
          )
        """
        params["nodal_uid"] = current_user["user_id"]
    query += " ORDER BY d.name"
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("", status_code=201)
async def create_hod_assignment(
    body: dict,
    current_user: dict = Depends(require_role(*_ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    department_id = body.get("department_id")
    hod_user_id = body.get("hod_user_id")
    if not department_id or not hod_user_id:
        raise HTTPException(status_code=400, detail="department_id and hod_user_id are required")

    user_row = await db.execute(
        text("SELECT role FROM users WHERE id = :uid AND is_active = true"),
        {"uid": hod_user_id},
    )
    u = user_row.fetchone()
    if not u or u.role != "HOD":
        raise HTTPException(status_code=400, detail="User must have active HOD role")

    if current_user["role"] == "NODAL_OFFICER":
        nodal_check = await db.execute(
            text(
                "SELECT 1 FROM dept_nodal_assignments "
                "WHERE nodal_user_id = :uid AND department_id = :did AND is_active = true"
            ),
            {"uid": current_user["user_id"], "did": department_id},
        )
        if not nodal_check.fetchone():
            raise HTTPException(status_code=403, detail="Not authorized for this department")

    await db.execute(
        text("UPDATE dept_hod_assignments SET is_active = false WHERE department_id = :did AND is_active = true"),
        {"did": department_id},
    )

    aid = str(uuid.uuid4())
    try:
        await db.execute(
            text("""
                INSERT INTO dept_hod_assignments (id, department_id, hod_user_id, is_active, assigned_by)
                VALUES (:id, :did, :uid, true, :by)
            """),
            {"id": aid, "did": department_id, "uid": hod_user_id, "by": current_user["user_id"]},
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Assignment conflict")

    return {"id": aid, "message": "HOD assigned to department"}


@router.put("/{assignment_id}")
async def update_hod_assignment(
    assignment_id: str,
    body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    is_active = body.get("is_active")
    if is_active is None:
        raise HTTPException(status_code=400, detail="is_active is required")
    result = await db.execute(
        text("UPDATE dept_hod_assignments SET is_active = :active WHERE id = :id RETURNING id"),
        {"active": bool(is_active), "id": assignment_id},
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Assignment not found")
    await db.commit()
    return {"message": "Assignment updated"}


@router.get("/hod-users")
async def list_hod_users(
    _: dict = Depends(require_role(*_ADMIN_ROLES, "REGISTRAR")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            SELECT u.id, u.username, e.name AS employee_name, e.emp_code,
                   d.name AS department_name
            FROM users u
            LEFT JOIN employees e ON u.employee_id = e.id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE u.role = 'HOD' AND u.is_active = true
            ORDER BY u.username
        """)
    )
    return [dict(r._mapping) for r in result.fetchall()]
