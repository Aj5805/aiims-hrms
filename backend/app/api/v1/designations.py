"""Designation CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.database import get_db
from app.schemas import DesignationCreate, DesignationResponse, DesignationUpdate

router = APIRouter(prefix="/designations", tags=["designations"])


@router.get("", response_model=list[DesignationResponse])
async def list_designations(
    include_inactive: bool = Query(False),
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR", "NODAL_OFFICER", "NODAL_OFFICE", "HOD", "STAFF")),
    db: AsyncSession = Depends(get_db),
):
    inactive_clause = "" if include_inactive else " AND d.is_active = true"
    result = await db.execute(
        text(f"""
            SELECT d.id, d.name, d.grade_pay_level, d.is_active, c.code AS category_code
            FROM designations d
            LEFT JOIN employee_categories c ON d.category_id = c.id
            WHERE 1=1{inactive_clause}
            ORDER BY d.name
        """)
    )
    return [
        DesignationResponse(
            id=str(r.id), name=r.name, grade_pay_level=r.grade_pay_level,
            category_code=r.category_code, is_active=bool(r.is_active),
        )
        for r in result.fetchall()
    ]


@router.post("", response_model=DesignationResponse, status_code=201)
async def create_designation(
    body: DesignationCreate,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    cat_id = None
    if body.category_code:
        cr = await db.execute(text("SELECT id FROM employee_categories WHERE code = :c"), {"c": body.category_code})
        c_row = cr.fetchone()
        if not c_row:
            raise HTTPException(status_code=400, detail=f"Unknown category: {body.category_code}")
        cat_id = str(c_row[0])

    did = str(uuid.uuid4())
    try:
        await db.execute(
            text("INSERT INTO designations (id, name, grade_pay_level, category_id) VALUES (:id, :name, :gpl, :cid)"),
            {"id": did, "name": body.name, "gpl": body.grade_pay_level, "cid": cat_id},
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail=f"Designation '{body.name}' already exists")

    result = await db.execute(
        text("""
            SELECT d.id, d.name, d.grade_pay_level, d.is_active, c.code AS category_code
            FROM designations d LEFT JOIN employee_categories c ON d.category_id = c.id
            WHERE d.id = :id
        """),
        {"id": did},
    )
    r = result.fetchone()
    return DesignationResponse(
        id=str(r.id), name=r.name, grade_pay_level=r.grade_pay_level,
        category_code=r.category_code, is_active=bool(r.is_active),
    )


@router.put("/{designation_id}", response_model=DesignationResponse)
async def update_designation(
    designation_id: str,
    body: DesignationUpdate,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    updates: dict = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.grade_pay_level is not None:
        updates["grade_pay_level"] = body.grade_pay_level
    if body.is_active is not None:
        updates["is_active"] = body.is_active
    if body.category_code is not None:
        if body.category_code:
            cr = await db.execute(text("SELECT id FROM employee_categories WHERE code = :c"), {"c": body.category_code})
            c_row = cr.fetchone()
            if not c_row:
                raise HTTPException(status_code=400, detail=f"Unknown category: {body.category_code}")
            updates["category_id"] = str(c_row[0])
        else:
            updates["category_id"] = None

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["did"] = designation_id
    await db.execute(text(f"UPDATE designations SET {set_clause} WHERE id = :did"), updates)
    await db.commit()

    result = await db.execute(
        text("""
            SELECT d.id, d.name, d.grade_pay_level, d.is_active, c.code AS category_code
            FROM designations d LEFT JOIN employee_categories c ON d.category_id = c.id
            WHERE d.id = :id
        """),
        {"id": designation_id},
    )
    r = result.fetchone()
    if not r:
        raise HTTPException(status_code=404)
    return DesignationResponse(
        id=str(r.id), name=r.name, grade_pay_level=r.grade_pay_level,
        category_code=r.category_code, is_active=bool(r.is_active),
    )
