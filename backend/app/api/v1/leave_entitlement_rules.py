"""Leave entitlement rules routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.database import get_db

router = APIRouter(prefix="/leave-entitlement-rules", tags=["entitlement-rules"])


@router.get("")
async def list_rules(
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "DEAN_ACADEMIC", "REGISTRAR", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
        SELECT r.*, c.code AS category_code, lt.code AS leave_type_code
        FROM leave_entitlement_rules r
        JOIN employee_categories c ON r.category_id = c.id
        JOIN leave_types lt ON r.leave_type_id = lt.id
        ORDER BY c.code, lt.code
    """))
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("", status_code=201)
async def create_rule(
    body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    cat = await db.execute(text("SELECT id FROM employee_categories WHERE code = :c"), {"c": body["category_code"]})
    c_row = cat.fetchone()
    if not c_row:
        raise HTTPException(status_code=400, detail="Unknown category")
    lt = await db.execute(text("SELECT id FROM leave_types WHERE code = :c"), {"c": body["leave_type_code"]})
    lt_row = lt.fetchone()
    if not lt_row:
        raise HTTPException(status_code=400, detail="Unknown leave type")

    rid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO leave_entitlement_rules
            (id, category_id, leave_type_id, year_ref, credit_frequency, days_per_year, prorata_rate,
             year1_days, year2_plus_days, max_at_a_stretch, max_in_tenure, carry_forward, special_rules)
        VALUES (:id, :cid, :lid, :yr, :cfreq, :dpy, :pr, :y1, :y2, :ms, :mt, :cf, :sr::jsonb)
    """), {
        "id": rid, "cid": str(c_row[0]), "lid": str(lt_row[0]),
        "yr": body.get("year_ref", "CALENDAR"),
        "cfreq": body.get("credit_frequency", "ANNUAL"),
        "dpy": body.get("days_per_year"), "pr": body.get("prorata_rate"),
        "y1": body.get("year1_days"), "y2": body.get("year2_plus_days"),
        "ms": body.get("max_at_a_stretch"), "mt": body.get("max_in_tenure"),
        "cf": body.get("carry_forward", False), "sr": body.get("special_rules"),
    })
    await db.commit()
    return {"id": rid, "message": "Created"}


@router.put("/{rule_id}")
async def update_rule(
    rule_id: str,
    body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    editable = ["days_per_year", "prorata_rate", "year1_days", "year2_plus_days",
                "max_at_a_stretch", "max_in_tenure", "carry_forward", "credit_frequency"]
    updates = {k: v for k, v in body.items() if k in editable}
    if not updates:
        raise HTTPException(status_code=400, detail="No editable fields")
    set_c = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = rule_id
    await db.execute(text(f"UPDATE leave_entitlement_rules SET {set_c} WHERE id = :id"), updates)
    await db.commit()
    return {"message": "Updated"}