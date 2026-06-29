"""Seed 009 — AIIMS designation master (owner-provided list)."""

import uuid

from sqlalchemy import text

from seeds.data.aiims_designations import AIIMS_DESIGNATIONS


def run(session):
    cat_ids = {
        row[0]: str(row[1])
        for row in session.execute(text("SELECT code, id FROM employee_categories")).fetchall()
    }
    inserted = 0
    skipped = 0
    for name, category_code in AIIMS_DESIGNATIONS:
        cat_id = cat_ids.get(category_code)
        if not cat_id:
            print(f"  WARN: unknown category {category_code} for {name}")
            continue
        existing = session.execute(
            text("SELECT id FROM designations WHERE name = :name"),
            {"name": name},
        ).fetchone()
        if existing:
            skipped += 1
            continue
        session.execute(
            text("""
                INSERT INTO designations (id, name, grade_pay_level, category_id)
                VALUES (:id, :name, NULL, :cat)
            """),
            {"id": str(uuid.uuid4()), "name": name, "cat": cat_id},
        )
        inserted += 1
    print(f"AIIMS designations: {inserted} added, {skipped} already present ({len(AIIMS_DESIGNATIONS)} in master list).")
