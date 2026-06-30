"""User management routes (admin only)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role, get_current_user
from app.auth.jwt import hash_password
from app.core.database import get_db

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", status_code=201)
async def create_user(
    body: dict,
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    username = body.get("username")
    role = body.get("role")
    if not username or not role:
        raise HTTPException(status_code=400, detail="username and role are required")

    allowed_roles = {
        "STAFF",
        "HOD",
        "DEAN_ACADEMIC",
        "REGISTRAR",
        "ESTABLISHMENT",
        "ESTABLISHMENT_OFFICER",
        "DIRECTOR",
        "ADMIN",
        "NODAL_OFFICER",
        "NODAL_OFFICE",
    }
    if role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role}")

    normalized_role = "ESTABLISHMENT_OFFICER" if role == "ESTABLISHMENT" else role
    password = body.get("password") or username
    employee_id = body.get("employee_id")
    must_change_password = body.get("must_change_password", True)
    parent_nodal_user_id = body.get("parent_nodal_user_id")

    if role == "NODAL_OFFICE" and parent_nodal_user_id:
        parent = await db.execute(
            text("SELECT role FROM users WHERE id = :pid AND is_active = true"),
            {"pid": parent_nodal_user_id},
        )
        p_row = parent.fetchone()
        if not p_row or p_row.role != "NODAL_OFFICER":
            raise HTTPException(status_code=400, detail="parent_nodal_user_id must be an active NODAL_OFFICER")

    user_id = str(uuid.uuid4())
    try:
        await db.execute(
            text("""
                INSERT INTO users (id, username, password_hash, employee_id, role, is_active, must_change_password, parent_nodal_user_id)
                VALUES (:id, :username, :password_hash, :employee_id, :role, true, :must_change_password, :parent_nodal)
            """),
            {
                "id": user_id,
                "username": username,
                "password_hash": hash_password(password),
                "employee_id": employee_id,
                "role": normalized_role,
                "must_change_password": must_change_password,
                "parent_nodal": parent_nodal_user_id,
            },
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Username or employee already has a user")
    return {
        "id": user_id,
        "username": username,
        "role": normalized_role,
        "employee_id": employee_id,
        "is_active": True,
        "must_change_password": must_change_password,
    }


@router.get("")
async def list_users(
    role: str = Query(None),
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    query = """
        SELECT u.id, u.username, u.role, u.is_active, u.must_change_password, 
               u.employee_id, u.last_login, u.created_at, u.parent_nodal_user_id,
               e.emp_code, e.name, d.name AS department_name, des.name AS designation_name,
               pn.username AS parent_nodal_username
        FROM users u
        LEFT JOIN employees e ON u.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN designations des ON e.designation_id = des.id
        LEFT JOIN users pn ON u.parent_nodal_user_id = pn.id
    """
    params: dict = {}
    if role:
        query += " WHERE u.role = :role"
        params["role"] = role
    query += " ORDER BY u.username"
    result = await db.execute(text(query), params)
    return [
        {
            "id": str(r.id), "username": r.username, "role": r.role,
            "is_active": r.is_active, "must_change_password": r.must_change_password,
            "employee_id": str(r.employee_id) if r.employee_id else None,
            "last_login": str(r.last_login) if r.last_login else None,
            "created_at": str(r.created_at),
            "emp_code": r.emp_code,
            "name": r.name,
            "department_name": r.department_name,
            "designation_name": r.designation_name,
            "parent_nodal_user_id": str(r.parent_nodal_user_id) if r.parent_nodal_user_id else None,
            "parent_nodal_username": r.parent_nodal_username,
        }
        for r in result.fetchall()
    ]


@router.put("/{user_id}")
async def update_user(
    user_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "NODAL_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    """Update user role, active status, or force password reset flag."""
    target_user_res = await db.execute(
        text("SELECT u.role, u.employee_id, e.department_id FROM users u LEFT JOIN employees e ON u.employee_id = e.id WHERE u.id = :uid"),
        {"uid": user_id}
    )
    target_user = target_user_res.fetchone()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if current_user["role"] == "NODAL_OFFICER":
        if target_user.role not in ("STAFF", "HOD"):
            raise HTTPException(status_code=403, detail="Not authorized to modify this user's role type")
        if "role" in body and body["role"] not in ("STAFF", "HOD"):
            raise HTTPException(status_code=403, detail="Not authorized to assign this role")
            
        nodal_check = await db.execute(
            text("SELECT 1 FROM dept_nodal_assignments WHERE nodal_user_id = :uid AND department_id = :did AND is_active = true"),
            {"uid": current_user["user_id"], "did": target_user.department_id}
        )
        if not nodal_check.fetchone():
            raise HTTPException(status_code=403, detail="Not authorized to modify users in this department")

    allowed = ["role", "is_active", "must_change_password", "parent_nodal_user_id"]
    updates = {k: v for k, v in body.items() if k in allowed}
    if "parent_nodal_user_id" in updates and updates["parent_nodal_user_id"]:
        parent = await db.execute(
            text("SELECT role FROM users WHERE id = :pid AND is_active = true"),
            {"pid": updates["parent_nodal_user_id"]},
        )
        p_row = parent.fetchone()
        if not p_row or p_row.role != "NODAL_OFFICER":
            raise HTTPException(status_code=400, detail="parent_nodal_user_id must be an active NODAL_OFFICER")
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["uid"] = user_id
    await db.execute(text(f"UPDATE users SET {set_clause} WHERE id = :uid"), updates)
    await db.commit()
    return {"message": "User updated"}
