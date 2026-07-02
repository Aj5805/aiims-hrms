"""Department CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Query
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role, get_current_user
from app.core.database import get_db
from app.schemas import DepartmentCreate, DepartmentResponse, DepartmentUpdate

router = APIRouter(prefix="/departments", tags=["departments"])


_MASTER_VIEW_ROLES = ("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR", "NODAL_OFFICER", "NODAL_OFFICE")


@router.get("", response_model=list[DepartmentResponse])
async def list_departments(
    include_inactive: bool = Query(False),
    current_user: dict = Depends(require_role(*_MASTER_VIEW_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    inactive_clause = "" if include_inactive else " AND is_active = true"
    result = await db.execute(
        text(f"""
            SELECT id, code, name, parent_dept_id, managing_office, is_active
            FROM departments
            WHERE 1=1{inactive_clause}
            ORDER BY name
        """)
    )
    return [
        DepartmentResponse(
            id=str(r.id), code=r.code, name=r.name,
            parent_dept_id=str(r.parent_dept_id) if r.parent_dept_id else None,
            managing_office=r.managing_office,
            is_active=bool(r.is_active),
        )
        for r in result.fetchall()
    ]


@router.post("", response_model=DepartmentResponse, status_code=201)
async def create_department(
    body: DepartmentCreate,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    parent_id = None
    if body.parent_dept_code:
        pr = await db.execute(text("SELECT id FROM departments WHERE code = :c"), {"c": body.parent_dept_code})
        p_row = pr.fetchone()
        if not p_row:
            raise HTTPException(status_code=400, detail=f"Parent department not found: {body.parent_dept_code}")
        parent_id = str(p_row[0])

    did = str(uuid.uuid4())
    try:
        await db.execute(
            text("INSERT INTO departments (id, code, name, parent_dept_id, managing_office) VALUES (:id, :code, :name, :pid, :mo)"),
            {"id": did, "code": body.code, "name": body.name, "pid": parent_id, "mo": body.managing_office},
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail=f"Department with code '{body.code}' already exists")

    result = await db.execute(
        text("SELECT id, code, name, parent_dept_id, managing_office, is_active FROM departments WHERE id = :id"), {"id": did}
    )
    r = result.fetchone()
    return DepartmentResponse(
        id=str(r.id), code=r.code, name=r.name,
        parent_dept_id=str(r.parent_dept_id) if r.parent_dept_id else None,
        managing_office=r.managing_office,
        is_active=bool(r.is_active),
    )


@router.put("/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: str,
    body: DepartmentUpdate,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    updates: dict = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.managing_office is not None:
        updates["managing_office"] = body.managing_office
    if body.is_active is not None:
        if not body.is_active:
            active_staff = await db.execute(
                text("SELECT 1 FROM employees WHERE department_id = :did AND is_active = true LIMIT 1"),
                {"did": department_id},
            )
            if active_staff.fetchone():
                raise HTTPException(status_code=400, detail="Cannot deactivate department with active staff")
        updates["is_active"] = body.is_active
    if updates:
        set_clause = ", ".join(f"{k} = :{k}" for k in updates)
        updates["eid"] = department_id
        await db.execute(text(f"UPDATE departments SET {set_clause} WHERE id = :eid"), updates)
        await db.commit()

    result = await db.execute(
        text("SELECT id, code, name, parent_dept_id, managing_office FROM departments WHERE id = :id"),
        {"id": department_id},
    )
    r = result.fetchone()
    if not r:
        raise HTTPException(status_code=404)
    return DepartmentResponse(
        id=str(r.id), code=r.code, name=r.name,
        parent_dept_id=str(r.parent_dept_id) if r.parent_dept_id else None,
        managing_office=r.managing_office,
        is_active=bool(r.is_active),
    )