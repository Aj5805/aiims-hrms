"""Designation CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.database import get_db
from app.schemas import DesignationCreate, DesignationResponse

router = APIRouter(prefix="/designations", tags=["designations"])


@router.get("", response_model=list[DesignationResponse])
async def list_designations(
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR", "NODAL_OFFICER", "NODAL_OFFICE")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            SELECT d.id, d.name, d.grade_pay_level, c.code AS category_code
            FROM designations d
            LEFT JOIN employee_categories c ON d.category_id = c.id
            ORDER BY d.name
        """)
    )
    return [
        DesignationResponse(id=str(r.id), name=r.name, grade_pay_level=r.grade_pay_level, category_code=r.category_code)
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
            SELECT d.id, d.name, d.grade_pay_level, c.code AS category_code
            FROM designations d LEFT JOIN employee_categories c ON d.category_id = c.id
            WHERE d.id = :id
        """),
        {"id": did},
    )
    r = result.fetchone()
    return DesignationResponse(id=str(r.id), name=r.name, grade_pay_level=r.grade_pay_level, category_code=r.category_code)