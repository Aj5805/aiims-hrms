"""Seed 003 — CCS leave entitlement rules (calendar year; same rules for all regular staff)."""

from sqlalchemy import text

CCS_CATEGORIES = ("FACULTY", "NURSING", "ADMIN")

# (leave_type, year_ref, days_per_year, prorata_rate, year1_days, year2_plus_days,
#  max_stretch, max_tenure, carry_forward, special_rules)
_CCS_LEAVE_RULES = [
    ("EL", "CALENDAR", 30, 2.5, None, None, None, None, True, None),
    ("HPL", "CALENDAR", 20, 1.67, None, None, None, None, False, None),
    ("CL", "CALENDAR", 8, None, None, None, 8, None, False, None),
    ("ML", "CALENDAR", 180, None, None, None, None, None, False, None),
    ("PL", "CALENDAR", 15, None, None, None, None, None, False, None),
    ("CCL", "CALENDAR", 730, None, None, None, None, None, False, None),
    ("COMMUTED", "CALENDAR", None, None, None, None, None, None, False, None),
]


def _get_id(session, table, code):
    return session.execute(
        text(f"SELECT id FROM {table} WHERE code = :code"), {"code": code}
    ).fetchone()[0]


def run(session):
    count = 0
    for cat_code in CCS_CATEGORIES:
        cat_id = _get_id(session, "employee_categories", cat_code)
        for (lt_code, year_ref, dpy, pr, y1, y2, max_stretch, max_tenure, cf, special) in _CCS_LEAVE_RULES:
            lt_id = _get_id(session, "leave_types", lt_code)
            existing = session.execute(
                text("""SELECT id FROM leave_entitlement_rules
                        WHERE category_id = :cat_id AND leave_type_id = :lt_id"""),
                {"cat_id": cat_id, "lt_id": lt_id},
            ).fetchone()
            if existing:
                continue
            session.execute(
                text("""
                    INSERT INTO leave_entitlement_rules
                        (category_id, leave_type_id, year_ref, days_per_year,
                         prorata_rate, year1_days, year2_plus_days,
                         max_at_a_stretch, max_in_tenure, carry_forward, special_rules)
                    VALUES
                        (:cat_id, :lt_id, :year_ref, :dpy,
                         :pr, :y1, :y2,
                         :max_stretch, :max_tenure, :cf, CAST(:special AS jsonb))
                """),
                {
                    "cat_id": cat_id, "lt_id": lt_id, "year_ref": year_ref,
                    "dpy": dpy, "pr": pr, "y1": y1, "y2": y2,
                    "max_stretch": max_stretch, "max_tenure": max_tenure,
                    "cf": cf, "special": special,
                },
            )
            count += 1
    print(f"Seeded {count} CCS entitlement rules.")
