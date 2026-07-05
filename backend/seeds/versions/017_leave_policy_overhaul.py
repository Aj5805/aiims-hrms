"""Seed 017 — Leave policy overhaul: tenure pools, gender rules, half-yearly EL/HPL."""

from sqlalchemy import text

# CCS categories get ML/PL/CCL as tenure pools with gender / times-in-service rules.
_CCS_TENURE_UPDATES = [
    # leave_type, max_in_tenure, max_times_in_service, gender_eligibility
    ("ML", 180, 2, "FEMALE_ONLY"),
    ("PL", 15, 2, "MALE_ONLY"),
    ("CCL", 730, None, "FEMALE_ONLY"),
]

_CCS_CATEGORIES = ("FACULTY", "NURSING", "ADMIN")
_RESIDENT_CATEGORIES = ("JR_ACAD", "SR_ACAD", "JR_NA", "SR_NA")


def _update_leave_type_flags(session):
    session.execute(
        text("""
            UPDATE leave_types
            SET requires_mc = false, min_days_for_mc = NULL
            WHERE code IN ('HPL', 'ML', 'PL', 'COMMUTED')
        """)
    )


def _update_ccs_tenure_rules(session):
    for cat_code in _CCS_CATEGORIES:
        for lt_code, max_tenure, max_times, gender in _CCS_TENURE_UPDATES:
            special = {"gender_eligibility": gender}
            if max_times is not None:
                special["max_times_in_service"] = max_times
            session.execute(
                text("""
                    UPDATE leave_entitlement_rules ler
                    SET year_ref = 'TENURE',
                        days_per_year = NULL,
                        prorata_rate = NULL,
                        credit_frequency = 'NONE',
                        max_in_tenure = :mt,
                        special_rules = CAST(:special AS jsonb)
                    FROM employee_categories c, leave_types lt
                    WHERE ler.category_id = c.id
                      AND ler.leave_type_id = lt.id
                      AND c.code = :cat
                      AND lt.code = :lt
                """),
                {"cat": cat_code, "lt": lt_code, "mt": max_tenure, "special": __import__("json").dumps(special)},
            )

    # EL / HPL — half-yearly credit (15 + 15 and 10 + 10 per calendar year)
    for lt_code in ("EL", "HPL"):
        session.execute(
            text("""
                UPDATE leave_entitlement_rules ler
                SET credit_frequency = 'HALF_YEARLY',
                    year_ref = 'CALENDAR'
                FROM leave_types lt
                WHERE ler.leave_type_id = lt.id AND lt.code = :lt
            """),
            {"lt": lt_code},
        )


def _update_resident_tenure_rules(session):
    for cat_code in _RESIDENT_CATEGORIES:
        session.execute(
            text("""
                UPDATE leave_entitlement_rules ler
                SET special_rules = CAST(:special AS jsonb)
                FROM employee_categories c, leave_types lt
                WHERE ler.category_id = c.id
                  AND ler.leave_type_id = lt.id
                  AND c.code = :cat AND lt.code = 'ML'
            """),
            {"cat": cat_code, "special": '{"gender_eligibility": "FEMALE_ONLY", "max_times_in_service": 2, "tenure_extension": true}'},
        )
        session.execute(
            text("""
                UPDATE leave_entitlement_rules ler
                SET special_rules = CAST(:special AS jsonb)
                FROM employee_categories c, leave_types lt
                WHERE ler.category_id = c.id
                  AND ler.leave_type_id = lt.id
                  AND c.code = :cat AND lt.code = 'PL'
            """),
            {"cat": cat_code, "special": '{"gender_eligibility": "MALE_ONLY", "max_times_in_service": 2}'},
        )


def run(session):
    _update_leave_type_flags(session)
    _update_ccs_tenure_rules(session)
    _update_resident_tenure_rules(session)
    print("Applied leave policy overhaul (tenure pools, gender rules, half-yearly EL/HPL).")
