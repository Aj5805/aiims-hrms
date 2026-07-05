"""Seed 018 — Correct entitlement rules: tenure pools, EL/HPL days, CL stretch, ANNUAL_RES."""

from sqlalchemy import text


def run(session):
    # Tenure pools are credited once at onboarding (max_in_tenure), not on an annual schedule.
    session.execute(
        text("""
            UPDATE leave_entitlement_rules
            SET credit_frequency = 'NONE'
            WHERE year_ref = 'TENURE'
        """)
    )

    # CCS: EL 30/yr and HPL 20/yr for all categories (half-yearly credits 15+15 and 10+10).
    for lt_code, days in (("EL", 30), ("HPL", 20)):
        session.execute(
            text("""
                UPDATE leave_entitlement_rules ler
                SET days_per_year = :days,
                    credit_frequency = 'HALF_YEARLY',
                    year_ref = 'CALENDAR'
                FROM employee_categories c, leave_types lt
                WHERE ler.category_id = c.id
                  AND ler.leave_type_id = lt.id
                  AND c.code IN ('FACULTY', 'NURSING', 'ADMIN')
                  AND lt.code = :lt
            """),
            {"lt": lt_code, "days": days},
        )

    # CL: DoPT max 8 days per stretch.
    session.execute(
        text("""
            UPDATE leave_entitlement_rules ler
            SET max_at_a_stretch = 8
            FROM leave_types lt
            WHERE ler.leave_type_id = lt.id AND lt.code = 'CL'
        """)
    )

    # Residents: annual credit once per calendar year (owner confirmed no monthly scheduler).
    session.execute(
        text("""
            UPDATE leave_entitlement_rules ler
            SET credit_frequency = 'ANNUAL',
                year_ref = 'CALENDAR'
            FROM leave_types lt
            WHERE ler.leave_type_id = lt.id AND lt.code = 'ANNUAL_RES'
        """)
    )

    # tenure_extension applies to residents only, not CCS staff ML.
    session.execute(
        text("""
            UPDATE leave_entitlement_rules ler
            SET special_rules = ler.special_rules - 'tenure_extension'
            FROM employee_categories c, leave_types lt
            WHERE ler.category_id = c.id
              AND ler.leave_type_id = lt.id
              AND c.code IN ('FACULTY', 'NURSING', 'ADMIN')
              AND lt.code = 'ML'
              AND ler.special_rules ? 'tenure_extension'
        """)
    )

    print("Applied entitlement corrections (tenure pools, EL/HPL days, CL stretch, ANNUAL_RES).")
