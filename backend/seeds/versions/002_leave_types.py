"""Seed 002 â€” Leave types (all CCS + Residency)."""

from sqlalchemy import text

LEAVE_TYPES = [
    ("EL",        "Earned Leave",              "CCS",       True,  300,  False, None, True,  False, True,  None),
    ("HPL",       "Half Pay Leave",            "CCS",       False, None, True,  3,    True,  False, False, None),
    ("CL",        "Casual Leave",              "CCS",       False, None, False, None, False, True,  False,
     '{"no_combination": true, "incompatible_types": ["EL", "HPL", "COMMUTED", "EOL"], "max_absence_span": 8, "max_per_stretch": 8}'),
    ("ML",        "Maternity Leave",           "BOTH",      False, None, True,  1,    True,  False, False, None),
    ("PL",        "Paternity Leave",           "BOTH",      False, None, False, None, True,  False, False, None),
    ("CCL",       "Child Care Leave",          "CCS",       False, None, False, None, True,  False, False, None),
    ("EOL",       "Extraordinary Leave",       "BOTH",      False, None, False, None, True,  False, False, None),
    ("OD",        "On Duty",                   "CCS",       False, None, False, None, True,  True,  False, None),
    ("STUDY",     "Study Leave",               "CCS",       False, None, False, None, True,  False, False, None),
    ("SABBATICAL","Sabbatical Leave",          "CCS",       False, None, False, None, True,  False, False, None),
    ("COMMUTED",  "Commuted Leave",            "CCS",       False, None, True,  1,    True,  False, False, None),
    ("COMP_OFF",  "Compensatory Off",          "CCS",       False, None, False, None, False, True,  False,
     '{"requires_remarks": true, "requires_attachment": true}'),
    ("ANNUAL_RES","Annual Leave (Resident)",   "RESIDENCY", False, None, False, None, True,  True,  False, None),
]
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
