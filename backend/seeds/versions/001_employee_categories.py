"""Seed 001 â€” Employee categories (7 categories)."""

from sqlalchemy import text

CATEGORIES = [
    ("FACULTY",  "Faculty",                          "CCS",       False, None),
    ("NURSING",  "Nursing Staff",                    "CCS",       False, None),
    ("ADMIN",    "Non-Faculty / Administration",     "CCS",       False, None),
    ("JR_ACAD",  "Junior Resident (Academic)",       "RESIDENCY", True,  36),
    ("SR_ACAD",  "Senior Resident (Academic)",       "RESIDENCY", True,  36),
    ("JR_NA",    "Junior Resident (Non-Academic)",   "RESIDENCY", True,  6),
    ("SR_NA",    "Senior Resident (Non-Academic)",   "RESIDENCY", True,  6),
]


def run(session):
    for code, name, scheme, tenure_based, tenure_months in CATEGORIES:
        existing = session.execute(
            text("SELECT id FROM employee_categories WHERE code = :code"),
            {"code": code},
        ).fetchone()
        if existing:
            continue
        session.execute(
            text("""
                INSERT INTO employee_categories (code, name, leave_scheme, tenure_based, tenure_months)
                VALUES (:code, :name, :scheme, :tenure_based, :tenure_months)
            """),
            {"code": code, "name": name, "scheme": scheme,
             "tenure_based": tenure_based, "tenure_months": tenure_months},
        )
    print(f"Seeded {len(CATEGORIES)} employee categories.")