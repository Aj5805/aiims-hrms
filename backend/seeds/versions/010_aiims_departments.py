"""Seed 010 — AIIMS department master (owner-provided list)."""

import uuid

from sqlalchemy import text

from seeds.data.aiims_departments import AIIMS_DEPARTMENTS


def run(session):
    inserted = 0
    skipped = 0
    for code, name in AIIMS_DEPARTMENTS:
        existing = session.execute(
            text("SELECT id FROM departments WHERE code = :code"),
            {"code": code},
        ).fetchone()
        if existing:
            skipped += 1
            continue
        session.execute(
            text("""
                INSERT INTO departments (id, code, name)
                VALUES (:id, :code, :name)
            """),
            {"id": str(uuid.uuid4()), "code": code, "name": name},
        )
        inserted += 1
    print(
        f"AIIMS departments: {inserted} added, {skipped} already present "
        f"({len(AIIMS_DEPARTMENTS)} in master list)."
    )
