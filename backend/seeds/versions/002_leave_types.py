"""Seed 002 â€” Leave types (all CCS + Residency)."""

from sqlalchemy import text

LEAVE_TYPES = []

def run(session):
    for (code, name, scheme, is_acc, max_acc, requires_mc, min_mc,
         count_hol, half_day, carry_fwd, validation_rules) in LEAVE_TYPES:
        existing = session.execute(
            text("SELECT id FROM leave_types WHERE code = :code"),
            {"code": code},
        ).fetchone()
        if existing:
            continue
        session.execute(
            text("""
                INSERT INTO leave_types
                    (code, name, scheme, is_accumulating, max_accumulation,
                     requires_mc, min_days_for_mc, count_holidays,
                     is_half_day_allowed, carry_forward, validation_rules)
                VALUES
                    (:code, :name, :scheme, :is_acc, :max_acc,
                     :requires_mc, :min_mc, :count_hol,
                     :half_day, :carry_fwd, CAST(:vrules AS jsonb))
            """),
            {"code": code, "name": name, "scheme": scheme,
             "is_acc": is_acc, "max_acc": max_acc,
             "requires_mc": requires_mc, "min_mc": min_mc,
             "count_hol": count_hol, "half_day": half_day,
             "carry_fwd": carry_fwd, "vrules": validation_rules},
        )
    print(f"Seeded {len(LEAVE_TYPES)} leave types.")
