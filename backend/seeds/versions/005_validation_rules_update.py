"""Seed 005 — Harden leave-type validation_rules (EL notice, CL weekends)."""

from sqlalchemy import text


def run(session):
    updates = [
        (
            "CL",
            '{"no_combination": true, "incompatible_types": ["EL", "HPL", "EOL"], "max_absence_span": 8, "max_per_stretch": 8}',
        ),
        ("EL", '{"min_notice_days": 3}'),
        ("ANNUAL_RES", '{"min_notice_days": 3}'),
    ]
    for code, rules in updates:
        session.execute(
            text("""
                UPDATE leave_types
                SET validation_rules = CAST(:rules AS jsonb)
                WHERE code = :code
            """),
            {"code": code, "rules": rules},
        )
    print(f"Updated validation_rules for {len(updates)} leave types.")
