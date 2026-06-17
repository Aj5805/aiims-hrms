"""Seed 003 â€” CCS leave entitlement rules for Regular Staff."""

from sqlalchemy import text


def _get_id(session, table, code):
    return session.execute(
        text(f"SELECT id FROM {table} WHERE code = :code"), {"code": code}
    ).fetchone()[0]


CCS_RULES = [
    # (cat, lt, year_ref, dpy, prorata, yr1, yr2+, max_stretch, max_tenure, carry_fwd, special)
    ("FACULTY", "EL",       "FINANCIAL", 30,  None, 15, 30,  None, None, True,  None),
    ("NURSING", "EL",       "FINANCIAL", 30,  None, 15, 30,  None, None, True,  None),
    ("ADMIN",   "EL",       "FINANCIAL", 30,  None, 15, 30,  None, None, True,  None),
    ("FACULTY", "HPL",      "FINANCIAL", 20,  None, 10, 20,  None, None, False, None),
    ("NURSING", "HPL",      "FINANCIAL", 20,  None, 10, 20,  None, None, False, None),
    ("ADMIN",   "HPL",      "FINANCIAL", 20,  None, 10, 20,  None, None, False, None),
    ("FACULTY", "CL",       "CALENDAR",  8,   None, 8,  8,   5,    None, False, None),
    ("NURSING", "CL",       "CALENDAR",  8,   None, 8,  8,   5,    None, False, None),
    ("ADMIN",   "CL",       "CALENDAR",  8,   None, 8,  8,   5,    None, False, None),
    ("FACULTY", "ML",       "CALENDAR",  180, None, 180,180, None, None, False, None),
    ("NURSING", "ML",       "CALENDAR",  180, None, 180,180, None, None, False, None),
    ("ADMIN",   "ML",       "CALENDAR",  180, None, 180,180, None, None, False, None),
    ("FACULTY", "PL",       "CALENDAR",  15,  None, 15, 15,  None, None, False, None),
    ("NURSING", "PL",       "CALENDAR",  15,  None, 15, 15,  None, None, False, None),
    ("ADMIN",   "PL",       "CALENDAR",  15,  None, 15, 15,  None, None, False, None),
    ("FACULTY", "CCL",      "CALENDAR",  730, None, 730,730, None, None, False, None),
    ("NURSING", "CCL",      "CALENDAR",  730, None, 730,730, None, None, False, None),
    ("ADMIN",   "CCL",      "CALENDAR",  730, None, 730,730, None, None, False, None),
    ("FACULTY", "COMMUTED", "FINANCIAL", None,None, None,None,None, None, False, None),
    ("NURSING", "COMMUTED", "FINANCIAL", None,None, None,None,None, None, False, None),
    ("ADMIN",   "COMMUTED", "FINANCIAL", None,None, None,None,None, None, False, None),
]


def run(session):
    count = 0
    for (cat_code, lt_code, year_ref, dpy, pr, y1, y2,
         max_stretch, max_tenure, cf, special) in CCS_RULES:
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
                     max_at_a_stretch, max_in_tenure, carry_forward, special_rules)
                VALUES
                    (:cat_id, :lt_id, :year_ref, :dpy,
                     :pr, :y1, :y2,
                     :max_stretch, :max_tenure, :cf, CAST(:special AS jsonb))
            """),
            {"cat_id": cat_id, "lt_id": lt_id, "year_ref": year_ref,
             "dpy": dpy, "pr": pr, "y1": y1, "y2": y2,
             "max_stretch": max_stretch, "max_tenure": max_tenure,
             "cf": cf, "special": special},
        )
        count += 1
    print(f"Seeded {count} CCS entitlement rules.")
