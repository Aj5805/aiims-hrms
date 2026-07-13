"""Holiday master routes."""

from datetime import date
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.database import get_db

router = APIRouter(prefix="/holiday-master", tags=["holiday-master"])


_MASTER_VIEWER_ROLES = ("ADMIN", "DIRECTOR", "HOD", "NODAL_OFFICER", "NODAL_OFFICE", "STAFF")


@router.get("")
async def list_holidays(
    year: int = Query(None),
    _: dict = Depends(require_role(*_MASTER_VIEWER_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    query = "SELECT * FROM holiday_master"
    params: dict = {}
    if year:
        query += " WHERE year = :year"
        params["year"] = year
    query += " ORDER BY holiday_date"
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("", status_code=201)
async def create_holiday(
    body: dict,
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    hid = str(uuid.uuid4())
    holiday_date = date.fromisoformat(body["holiday_date"])
    try:
        await db.execute(text("""
            INSERT INTO holiday_master (id, year, holiday_date, holiday_name, holiday_type, applicable_to)
            VALUES (:id, :year, :date, :name, :type, :app)
        """), {
            "id": hid, "year": body["year"], "date": holiday_date,
            "name": body["holiday_name"], "type": body["holiday_type"],
            "app": body.get("applicable_to", "ALL"),
        })
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail=f"Holiday on {body['holiday_date']} with type {body['holiday_type']} already exists")
    result = await db.execute(text("SELECT * FROM holiday_master WHERE id = :id"), {"id": hid})
    return dict(result.fetchone()._mapping)


@router.put("/{holiday_id}")
async def update_holiday(
    holiday_id: str,
    body: dict,
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    editable = ["holiday_name", "holiday_type", "applicable_to"]
    updates = {k: v for k, v in body.items() if k in editable}
    if not updates:
        raise HTTPException(status_code=400, detail="No editable fields")
    set_c = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = holiday_id
    await db.execute(text(f"UPDATE holiday_master SET {set_c} WHERE id = :id"), updates)
    await db.commit()
    result = await db.execute(text("SELECT * FROM holiday_master WHERE id = :id"), {"id": holiday_id})
    return dict(result.fetchone()._mapping)


@router.delete("/{holiday_id}")
async def delete_holiday(
    holiday_id: str,
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(text("DELETE FROM holiday_master WHERE id = :id"), {"id": holiday_id})
    await db.commit()
    return {"message": "Deleted"}
