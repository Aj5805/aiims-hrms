"""Seed 004 — Resident leave entitlement rules (calendar year; unified JR/SR academic & non-academic)."""

from sqlalchemy import text

RESIDENT_CATEGORIES = ("JR_ACAD", "SR_ACAD", "JR_NA", "SR_NA")

# (leave_type, year_ref, days_per_year, prorata_rate, year1_days, year2_plus_days,
#  max_stretch, max_tenure, special_rules)
_RESIDENT_LEAVE_RULES = [
    (
        "ANNUAL_RES",
        "CALENDAR",
        30,
        2.5,
        None,
        None,
        None,
        None,
        None,
    ),
    (
        "EOL",
        "TENURE",
        None,
        None,
        None,
        None,
        None,
        30,
        '{"tenure_extension": true}',
    ),
    (
        "ML",
        "TENURE",
        None,
        None,
        None,
        None,
        None,
        180,
        '{"tenure_extension": true}',
    ),
    ("PL", "TENURE", None, None, None, None, None, 15, None),
]


def _get_id(session, table, code):
    return session.execute(
        text(f"SELECT id FROM {table} WHERE code = :code"), {"code": code}
    ).fetchone()[0]


def run(session):
    count = 0
    for cat_code in RESIDENT_CATEGORIES:
        cat_id = _get_id(session, "employee_categories", cat_code)
        for (lt_code, year_ref, dpy, pr, y1, y2, max_stretch, max_tenure, special) in _RESIDENT_LEAVE_RULES:
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
                         max_at_a_stretch, max_in_tenure, special_rules)
                    VALUES
                        (:cat_id, :lt_id, :year_ref, :dpy,
                         :pr, :y1, :y2,
                         :max_stretch, :max_tenure, CAST(:special AS jsonb))
                """),
                {
                    "cat_id": cat_id, "lt_id": lt_id, "year_ref": year_ref,
                    "dpy": dpy, "pr": pr, "y1": y1, "y2": y2,
                    "max_stretch": max_stretch, "max_tenure": max_tenure,
                    "special": special,
                },
            )
            count += 1

    # Align existing DB rows to annual (not monthly) resident credit
    session.execute(
        text("""
            UPDATE leave_entitlement_rules ler
            SET special_rules = NULL
            FROM leave_types lt
            WHERE ler.leave_type_id = lt.id
              AND lt.code = 'ANNUAL_RES'
              AND COALESCE(ler.special_rules->>'credit_by_month', 'false') = 'true'
        """)
    )
    print(f"Seeded {count} resident entitlement rules.")
