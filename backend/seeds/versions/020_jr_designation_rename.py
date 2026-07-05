"""Seed 020 — Resident designations: four detailed names matching staff groups."""

import uuid

from sqlalchemy import text

# Rename old short/duplicate names → canonical resident designations
RESIDENT_DESIGNATION_RENAMES = [
    ("P.G. Student", "Junior Resident (Academic)", "JR_ACAD"),
    ("Junior Resident", "Junior Resident (Non-Academic)", "JR_NA"),
    ("Senior Resident", "Senior Resident (Academic)", "SR_ACAD"),
    ("SR (Academic)", "Senior Resident (Academic)", "SR_ACAD"),
]

# Add if missing after renames
RESIDENT_DESIGNATIONS_TO_ENSURE = [
    ("Senior Resident (Non-Academic)", "SR_NA"),
]


def _lookup_id(session, name: str):
    row = session.execute(
        text("SELECT id FROM designations WHERE name = :name"),
        {"name": name},
    ).fetchone()
    return str(row[0]) if row else None


def _merge_designation(session, duplicate_name: str, canonical_name: str) -> None:
    dup_id = _lookup_id(session, duplicate_name)
    canon_id = _lookup_id(session, canonical_name)
    if not dup_id:
        return
    if not canon_id:
        session.execute(
            text("""
                UPDATE designations SET name = :canonical WHERE id = :dup_id
            """),
            {"canonical": canonical_name, "dup_id": dup_id},
        )
        print(f"  Renamed designation {duplicate_name!r} → {canonical_name!r}")
        return
    session.execute(
        text("UPDATE employees SET designation_id = :canon WHERE designation_id = :dup"),
        {"canon": canon_id, "dup": dup_id},
    )
    session.execute(text("DELETE FROM designations WHERE id = :dup"), {"dup": dup_id})
    print(f"  Merged duplicate designation {duplicate_name!r} into {canonical_name!r}")


def run(session):
    cat_ids = {
        row[0]: str(row[1])
        for row in session.execute(text("SELECT code, id FROM employee_categories")).fetchall()
    }

    for old_name, new_name, category_code in RESIDENT_DESIGNATION_RENAMES:
        cat_id = cat_ids.get(category_code)
        if not cat_id:
            print(f"  WARN: unknown category {category_code} for {new_name}")
            continue

        if not _lookup_id(session, old_name):
            continue

        if _lookup_id(session, new_name):
            _merge_designation(session, old_name, new_name)
            continue

        session.execute(
            text("""
                UPDATE designations
                SET name = :new_name, category_id = :cat_id
                WHERE name = :old_name
            """),
            {"old_name": old_name, "new_name": new_name, "cat_id": cat_id},
        )
        print(f"  Renamed designation {old_name!r} → {new_name!r} ({category_code})")

    for name, category_code in RESIDENT_DESIGNATIONS_TO_ENSURE:
        if _lookup_id(session, name):
            continue
        cat_id = cat_ids.get(category_code)
        if not cat_id:
            print(f"  WARN: unknown category {category_code} for {name}")
            continue
        session.execute(
            text("""
                INSERT INTO designations (id, name, grade_pay_level, category_id)
                VALUES (:id, :name, NULL, :cat)
            """),
            {"id": str(uuid.uuid4()), "name": name, "cat": cat_id},
        )
        print(f"  Added designation {name!r} ({category_code})")

    from app.data.staff_number_groups import STAFF_NUMBER_GROUPS

    for code, spec in STAFF_NUMBER_GROUPS.items():
        session.execute(
            text("""
                UPDATE staff_number_sequences
                SET label = :label
                WHERE group_code = :code
            """),
            {"code": code, "label": spec["label"]},
        )
