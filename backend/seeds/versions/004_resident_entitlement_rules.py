"""Seed 004 â€” Resident leave entitlement rules (with VERIFY flag for SR_NA)."""

from sqlalchemy import text


def _get_id(session, table, code):
    return session.execute(
        text(f"SELECT id FROM {table} WHERE code = :code"), {"code": code}
    ).fetchone()[0]


# (cat, lt, year_ref, dpy, prorata, yr1, yr2+, max_stretch, max_tenure, special)
RESIDENT_RULES = []


def run(session):
    count = 0
    for (cat_code, lt_code, year_ref, dpy, pr, y1, y2,
         max_stretch, max_tenure, special) in RESIDENT_RULES:
        cat_id = _get_id(session, "employee_categories", cat_code)
        lt_id  = _get_id(session, "leave_types", lt_code)
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
                     max_at_a_stretch, max_in_tenure, special_rules)
                VALUES
                    (:cat_id, :lt_id, :year_ref, :dpy,
                     :pr, :y1, :y2,
                     :max_stretch, :max_tenure, CAST(:special AS jsonb))
            """),
            {"cat_id": cat_id, "lt_id": lt_id, "year_ref": year_ref,
             "dpy": dpy, "pr": pr, "y1": y1, "y2": y2,
             "max_stretch": max_stretch, "max_tenure": max_tenure, "special": special},
        )
        count += 1
    print(f"Seeded {count} resident entitlement rules.")
