"""Leave types CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.core.database import get_db

router = APIRouter(prefix="/leave-types", tags=["leave-types"])


_MASTER_VIEWER_ROLES = ("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR", "HOD", "DEAN_ACADEMIC", "NODAL_OFFICER", "NODAL_OFFICE")
_STAFF_APPLY_ROLES = ("STAFF",)


@router.get("")
async def list_leave_types(
    include_inactive: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = current_user["role"]
    if role not in _MASTER_VIEWER_ROLES and role not in _STAFF_APPLY_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if role in _STAFF_APPLY_ROLES:
        include_inactive = False

    inactive_clause = "" if include_inactive else " AND is_active = true"
    result = await db.execute(text(f"SELECT * FROM leave_types WHERE 1=1{inactive_clause} ORDER BY code"))
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("", status_code=201)
async def create_leave_type(
    body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    lid = str(uuid.uuid4())
    cols = ["id", "code", "name", "scheme", "is_accumulating", "max_accumulation",
            "requires_mc", "min_days_for_mc", "count_holidays", "is_half_day_allowed",
            "carry_forward", "encashable", "is_active"]
    vals = {c: body.get(c) for c in cols if c != "id"}
    vals["id"] = lid
    if vals.get("is_active") is None:
        vals["is_active"] = True
    placeholders = ", ".join(f":{c}" for c in cols)
    try:
        await db.execute(
            text(f"INSERT INTO leave_types ({', '.join(cols)}) VALUES ({placeholders})"), vals)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail=f"Leave type '{body.get('code')}' already exists")
    
    result = await db.execute(text("SELECT * FROM leave_types WHERE id = :id"), {"id": lid})
    return dict(result.fetchone()._mapping)


@router.put("/{leave_type_id}")
async def update_leave_type(
    leave_type_id: str,
    body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    editable = ["name", "is_accumulating", "max_accumulation", "requires_mc",
                "min_days_for_mc", "count_holidays", "is_half_day_allowed",
                "carry_forward", "encashable", "validation_rules", "is_active"]
    updates = {k: v for k, v in body.items() if k in editable}
    if not updates:
        raise HTTPException(status_code=400, detail="No editable fields")
    set_c = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = leave_type_id
    await db.execute(text(f"UPDATE leave_types SET {set_c} WHERE id = :id"), updates)
    await db.commit()
    result = await db.execute(text("SELECT * FROM leave_types WHERE id = :id"), {"id": leave_type_id})
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404)
    return dict(row._mapping)
