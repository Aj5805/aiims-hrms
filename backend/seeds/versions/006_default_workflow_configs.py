"""Seed 006 â€” Default workflow configs (baseline chains per category).

Regular staff:  HOD -> Establishment Officer -> Registrar
Residents:      HOD -> Dean Academic

Admin can customize these through the Phase 3 UI.
"""

import secrets
import uuid
from sqlalchemy import text

from app.auth.jwt import hash_password


def _ensure_user(session, username, role):
    existing = session.execute(
        text("SELECT id FROM users WHERE username = :username"), {"username": username}
    ).fetchone()
    if existing:
        return existing[0]
    uid = str(uuid.uuid4())
    session.execute(
        text("""
            INSERT INTO users (id, username, password_hash, role, is_active)
            VALUES (:id, :username, :ph, :role, false)
        """),
        {"id": uid, "username": username,
         "ph": hash_password(secrets.token_urlsafe(32)), "role": role},
    )
    return uid


def _create_workflow(session, admin_id, name, steps, category_id=None):
    existing = session.execute(
        text("SELECT id FROM workflow_configs WHERE config_name = :name"), {"name": name}
    ).fetchone()
    if existing:
        return
    cid = str(uuid.uuid4())
    session.execute(
        text("""
            INSERT INTO workflow_configs
                (id, config_name, category_id, leave_type_id, min_days, max_days, created_by)
            VALUES (:id, :name, :cat_id, NULL, 1, NULL, :created_by)
        """),
        {"id": cid, "name": name, "cat_id": category_id, "created_by": admin_id},
    )
    for step_order, role, office, sla, is_final in steps:
        session.execute(
            text("""
                INSERT INTO workflow_steps
                    (config_id, step_order, approver_role, approver_office, sla_hours, is_final_authority)
                VALUES (:config_id, :step_order, :role, :office, :sla, :is_final)
            """),
            {"config_id": cid, "step_order": step_order,
             "role": role, "office": office, "sla": sla, "is_final": is_final},
        )


def run(session):
    admin_id = _ensure_user(session, "workflow_seed_admin", "ADMIN")

    _create_workflow(session, admin_id,
        "Regular Staff — Default (All Types, All Durations)",
        [
            (1, "HOD",                   "Department",     48, False),
            (2, "ESTABLISHMENT_OFFICER", "Establishment",  72, False),
            (3, "REGISTRAR",             "Registrar Office",72, True),
        ]
    )

    residency_categories = session.execute(text("SELECT id, code FROM employee_categories WHERE code IN ('JR_ACAD', 'SR_ACAD', 'JR_NA', 'SR_NA')")).fetchall()
    for cat in residency_categories:
        _create_workflow(session, admin_id,
            f"Resident — Default ({cat.code})",
            [
                (1, "HOD",           "Department",          48, False),
                (2, "DEAN_ACADEMIC", "Dean Academic Office",72, True),
            ],
            category_id=cat.id
        )

    print("Seeded workflow configs (1 Regular, 4 Resident).")