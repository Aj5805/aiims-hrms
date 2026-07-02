"""Seed 015 — Default nodal offices (Establishment for CCS, Registrar for residents)."""

import uuid

from sqlalchemy import text


def run(session):
    offices = [
        ("ESTABLISHMENT", "Establishment", "CCS"),
        ("REGISTRAR", "Registrar Office", "RESIDENCY"),
    ]
    for code, name, scheme in offices:
        existing = session.execute(
            text("SELECT id FROM nodal_offices WHERE code = :code"),
            {"code": code},
        ).fetchone()
        if existing:
            continue
        session.execute(
            text("""
                INSERT INTO nodal_offices (id, code, name, leave_scheme, is_active)
                VALUES (:id, :code, :name, :scheme, true)
            """),
            {"id": str(uuid.uuid4()), "code": code, "name": name, "scheme": scheme},
        )
    print("Seeded nodal offices (Establishment + Registrar).")
