"""Seed 014 — Align CL validation with DoPT/CCS executive instructions."""

from sqlalchemy import text

CL_RULES = (
    '{"no_combination": true, '
    '"incompatible_types": ["EL", "HPL", "COMMUTED", "EOL"], '
    '"max_absence_span": 8, "max_per_stretch": 8}'
)


def run(session):
    session.execute(
        text("""
            UPDATE leave_types
            SET validation_rules = CAST(:rules AS jsonb)
            WHERE code = 'CL'
        """),
        {"rules": CL_RULES},
    )
    session.execute(
        text("""
            UPDATE leave_entitlement_rules ler
            SET max_at_a_stretch = 8
            FROM leave_types lt
            WHERE ler.leave_type_id = lt.id AND lt.code = 'CL'
        """)
    )
    print("Updated CL validation rules and max_at_a_stretch to DoPT-aligned values.")
