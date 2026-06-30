"""Workflow config API -- CRUD + simulate."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.core.database import get_db

router = APIRouter(prefix="/workflow-configs", tags=["workflow-configs"])


_MASTER_VIEWER_ROLES = ("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR", "HOD", "DEAN_ACADEMIC")


@router.get("")
async def list_configs(
    _: dict = Depends(require_role(*_MASTER_VIEWER_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
        SELECT wc.*, c.code AS category_code, lt.code AS leave_type_code
        FROM workflow_configs wc
        LEFT JOIN employee_categories c ON wc.category_id = c.id
        LEFT JOIN leave_types lt ON wc.leave_type_id = lt.id
        ORDER BY wc.config_name
    """))
    configs = []
    for r in result.fetchall():
        cfg = dict(r._mapping)
        steps_result = await db.execute(
            text("SELECT * FROM workflow_steps WHERE config_id = :cid ORDER BY step_order"),
            {"cid": cfg["id"]})
        cfg["steps"] = [dict(s._mapping) for s in steps_result.fetchall()]
        configs.append(cfg)
    return configs


@router.post("", status_code=201)
async def create_config(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cid = str(uuid.uuid4())
    try:
        await db.execute(text("""
            INSERT INTO workflow_configs (id, config_name, category_id, leave_type_id, min_days, max_days, is_active, created_by)
            VALUES (:id, :name, :cat, :lt, :min_d, :max_d, :active, :cb)
        """), {
            "id": cid, "name": body["config_name"],
            "cat": body.get("category_id"),
            "lt": body.get("leave_type_id"),
            "min_d": body.get("min_days", 1), "max_d": body.get("max_days"),
            "active": body.get("is_active", True),
            "cb": current_user["user_id"],
        })
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail=f"Workflow config '{body['config_name']}' already exists")
    return {"id": cid, "message": "Created"}


@router.put("/{config_id}")
async def update_config(
    config_id: str,
    body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    editable = ["config_name", "category_id", "leave_type_id", "min_days", "max_days", "is_active"]
    updates = {k: v for k, v in body.items() if k in editable}
    if not updates:
        raise HTTPException(status_code=400, detail="No editable fields")
    set_c = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = config_id
    await db.execute(
        text(f"UPDATE workflow_configs SET {set_c}, version = version + 1, updated_at = NOW() WHERE id = :id"),
        updates,
    )
    await db.commit()
    return {"message": "Updated"}


@router.post("/{config_id}/steps", status_code=201)
async def add_step(
    config_id: str,
    body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    sid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO workflow_steps (id, config_id, step_order, approver_role, approver_office, specific_approver_id, sla_hours, is_final_authority)
        VALUES (:id, :cid, :so, :role, :office, :specific_id, :sla, :final)
    """), {
        "id": sid, "cid": config_id, "so": body["step_order"],
        "role": body["approver_role"], "office": body.get("approver_office"),
        "specific_id": body.get("specific_approver_id"),
        "sla": body.get("sla_hours", 48), "final": body.get("is_final_authority", False),
    })
    await db.commit()
    return {"id": sid, "message": "Step added"}


@router.put("/{config_id}/steps/{step_id}")
async def update_step(
    config_id: str,
    step_id: str,
    body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    editable = ["step_order", "approver_role", "approver_office", "sla_hours", "is_final_authority", "skip_if_self_applicant"]
    updates = {k: v for k, v in body.items() if k in editable}
    if updates:
        set_c = ", ".join(f"{k} = :{k}" for k in updates)
        updates["id"] = step_id
        await db.execute(
            text(f"UPDATE workflow_steps SET {set_c} WHERE id = :id AND config_id = :cid"),
            {**updates, "cid": config_id}
        )
        await db.commit()
    return {"message": "Updated"}


@router.delete("/{config_id}/steps/{step_id}")
async def delete_step(
    config_id: str,
    step_id: str,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        text("DELETE FROM workflow_steps WHERE id = :id AND config_id = :cid"),
        {"id": step_id, "cid": config_id}
    )
    await db.commit()
    return {"message": "Deleted"}


@router.post("/simulate")
async def simulate_workflow(
    body: dict,
    _: dict = Depends(require_role(*_MASTER_VIEWER_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    """Given category_code, leave_type_code, and days, return the matching workflow chain."""
    cat_code = body.get("category_code")
    lt_code = body.get("leave_type_code")
    days = int(body.get("days", 1))

    query = """
        SELECT wc.* FROM workflow_configs wc
        LEFT JOIN employee_categories c ON wc.category_id = c.id
        LEFT JOIN leave_types lt ON wc.leave_type_id = lt.id
        WHERE wc.is_active = true
          AND (wc.category_id IS NULL OR c.code = :cat)
          AND (wc.leave_type_id IS NULL OR lt.code = :lt)
          AND wc.min_days <= :days
          AND (wc.max_days IS NULL OR wc.max_days >= :days)
        ORDER BY
          (CASE WHEN wc.category_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
          (CASE WHEN wc.leave_type_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
          wc.min_days DESC
        LIMIT 1
    """
    result = await db.execute(text(query), {"cat": cat_code, "lt": lt_code, "days": days})
    cfg = result.fetchone()
    if not cfg:
        return {"matched": False, "message": "No workflow config matched"}

    cfg_dict = dict(cfg._mapping)
    steps = await db.execute(
        text("SELECT * FROM workflow_steps WHERE config_id = :cid ORDER BY step_order"),
        {"cid": cfg_dict["id"]})
    cfg_dict["steps"] = [dict(s._mapping) for s in steps.fetchall()]
    return {"matched": True, "config": cfg_dict}