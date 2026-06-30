"""Seed 005 — Harden leave-type validation_rules (EL notice, CL weekends)."""

from sqlalchemy import text


def run(session):
    updates = [
        (
            "CL",
            '{"no_prefix_suffix_holidays": true, "no_prefix_suffix_weekends": true, "no_combination": true, "max_per_stretch": 5}',
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
