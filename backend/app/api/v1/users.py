"""User management routes (admin only)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
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
    }
    if role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role}")

    normalized_role = "ESTABLISHMENT_OFFICER" if role == "ESTABLISHMENT" else role
    password = body.get("password") or username
    employee_id = body.get("employee_id")
    must_change_password = body.get("must_change_password", True)

    user_id = str(uuid.uuid4())
    try:
        await db.execute(
            text("""
                INSERT INTO users (id, username, password_hash, employee_id, role, is_active, must_change_password)
                VALUES (:id, :username, :password_hash, :employee_id, :role, true, :must_change_password)
            """),
            {
                "id": user_id,
                "username": username,
                "password_hash": hash_password(password),
                "employee_id": employee_id,
                "role": normalized_role,
                "must_change_password": must_change_password,
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
    query = "SELECT id, username, role, is_active, must_change_password, employee_id, last_login, created_at FROM users"
    params: dict = {}
    if role:
        query += " WHERE role = :role"
        params["role"] = role
    query += " ORDER BY username"
    result = await db.execute(text(query), params)
    return [
        {
            "id": str(r.id), "username": r.username, "role": r.role,
            "is_active": r.is_active, "must_change_password": r.must_change_password,
            "employee_id": str(r.employee_id) if r.employee_id else None,
            "last_login": str(r.last_login) if r.last_login else None,
            "created_at": str(r.created_at),
        }
        for r in result.fetchall()
    ]


@router.put("/{user_id}")
async def update_user(
    user_id: str,
    body: dict,
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Update user role, active status, or force password reset flag."""
    allowed = ["role", "is_active", "must_change_password"]
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["uid"] = user_id
    await db.execute(text(f"UPDATE users SET {set_clause} WHERE id = :uid"), updates)
    await db.commit()
    return {"message": "User updated"}
