"""Seed 004 — Resident leave entitlement rules (calendar year; unified JR/SR academic & non-academic)."""

from sqlalchemy import text

RESIDENT_CATEGORIES = ("JR_ACAD", "SR_ACAD", "JR_NA", "SR_NA")

# (leave_type, year_ref, days_per_year, prorata_rate, year1_days, year2_plus_days,
#  max_stretch, max_tenure, special_rules, credit_freq)
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
        "ANNUAL",
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
        "NONE",
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
        '{"tenure_extension": true, "gender_eligibility": "FEMALE_ONLY", "max_times_in_service": 2}',
        "NONE",
    ),
    ("PL", "TENURE", None, None, None, None, None, 15, '{"gender_eligibility": "MALE_ONLY", "max_times_in_service": 2}', "NONE"),
]


def _get_id(session, table, code):
    return session.execute(
        text(f"SELECT id FROM {table} WHERE code = :code"), {"code": code}
    ).fetchone()[0]


def run(session):
    count = 0
    for cat_code in RESIDENT_CATEGORIES:
        cat_id = _get_id(session, "employee_categories", cat_code)
        for (lt_code, year_ref, dpy, pr, y1, y2, max_stretch, max_tenure, special, credit_freq) in _RESIDENT_LEAVE_RULES:
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
                        (category_id, leave_type_id, year_ref, credit_frequency, days_per_year,
                         prorata_rate, year1_days, year2_plus_days,
                         max_at_a_stretch, max_in_tenure, special_rules)
                    VALUES
                        (:cat_id, :lt_id, :year_ref, :cfreq, :dpy,
                         :pr, :y1, :y2,
                         :max_stretch, :max_tenure, CAST(:special AS jsonb))
                """),
                {
                    "cat_id": cat_id, "lt_id": lt_id, "year_ref": year_ref,
                    "cfreq": credit_freq, "dpy": dpy, "pr": pr, "y1": y1, "y2": y2,
                    "max_stretch": max_stretch, "max_tenure": max_tenure,
                    "special": special,
                },
            )
            count += 1

    # Align existing DB rows to annual (not monthly) resident credit
    session.execute(
        text("""
            UPDATE leave_entitlement_rules ler
            SET special_rules = NULL,
                credit_frequency = 'ANNUAL',
                year_ref = 'CALENDAR'
            FROM leave_types lt
            WHERE ler.leave_type_id = lt.id
              AND lt.code = 'ANNUAL_RES'
        """)
    )
    session.execute(
        text("""
            UPDATE leave_entitlement_rules ler
            SET credit_frequency = 'NONE'
            FROM leave_types lt
            WHERE ler.leave_type_id = lt.id
              AND lt.code IN ('EOL', 'ML', 'PL')
              AND ler.year_ref = 'TENURE'
        """)
    )
    print(f"Seeded {count} resident entitlement rules.")
