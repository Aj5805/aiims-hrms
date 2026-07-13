"""Workflow config API -- CRUD + simulate."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.core.database import get_db
from app.services.leave_rules import is_category_leave_type_eligible
from app.services.workflow_resolver import (
    entitlement_blocked_message,
    list_workflow_configs_with_steps,
    no_match_message,
    normalize_code,
    resolve_workflow_config,
    simulation_requires_both_message,
)

router = APIRouter(prefix="/workflow-configs", tags=["workflow-configs"])


_MASTER_VIEWER_ROLES = ("ADMIN", "DIRECTOR", "HOD", "NODAL_OFFICER", "NODAL_OFFICE")


@router.get("")
async def list_configs(
    _: dict = Depends(require_role(*_MASTER_VIEWER_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    return await list_workflow_configs_with_steps(db)


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
    _: dict = Depends(require_role("ADMIN")),
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
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    sid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO workflow_steps (
            id, config_id, step_order, approver_role, approver_office,
            specific_approver_id, sla_hours, is_final_authority, skip_if_self_applicant
        )
        VALUES (:id, :cid, :so, :role, :office, :specific_id, :sla, :final, :skip_self)
    """), {
        "id": sid, "cid": config_id, "so": body["step_order"],
        "role": body["approver_role"], "office": body.get("approver_office"),
        "specific_id": body.get("specific_approver_id"),
        "sla": body.get("sla_hours", 48),
        "final": body.get("is_final_authority", False),
        "skip_self": body.get("skip_if_self_applicant", True),
    })
    await db.commit()
    return {"id": sid, "message": "Step added"}


@router.put("/{config_id}/steps/{step_id}")
async def update_step(
    config_id: str,
    step_id: str,
    body: dict,
    _: dict = Depends(require_role("ADMIN")),
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
    _: dict = Depends(require_role("ADMIN")),
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
    cat_code = normalize_code(body.get("category_code"))
    lt_code = normalize_code(body.get("leave_type_code"))
    days = float(body.get("days", 1) or 1)
    criteria = {
        "category_code": cat_code,
        "leave_type_code": lt_code,
        "days": days,
    }

    if not cat_code or not lt_code:
        return {
            "matched": False,
            "eligible": False,
            "message": simulation_requires_both_message(),
            "criteria": criteria,
        }

    if not await is_category_leave_type_eligible(db, cat_code, lt_code):
        return {
            "matched": False,
            "eligible": False,
            "message": entitlement_blocked_message(cat_code, lt_code),
            "criteria": criteria,
        }

    cfg = await resolve_workflow_config(db, cat_code, lt_code, days)
    if not cfg:
        return {
            "matched": False,
            "eligible": True,
            "message": no_match_message(cat_code, lt_code, days),
            "criteria": criteria,
        }

    return {
        "matched": True,
        "eligible": True,
        "config": cfg,
        "criteria": criteria,
    }
