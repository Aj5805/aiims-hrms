"""Generate synthetic test data for UAT and performance testing.

Usage:
    cd backend && python -m scripts.generate_test_data

Requires faker: pip install faker
"""

import uuid
import random
from datetime import date, datetime, timedelta

# Add backend to path
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

try:
    from faker import Faker
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session
    from app.core.config import settings
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip install faker")
    sys.exit(1)

fake = Faker("en_IN")

CATEGORIES = ["FACULTY", "NURSING", "ADMIN", "JR_ACAD", "SR_ACAD", "JR_NA", "SR_NA"]
LEAVE_TYPES = ["EL", "HPL", "CL", "ML", "PL", "CCL", "OD", "COMP_OFF"]

def generate(employee_count=1000, app_count=50000):
    engine = create_engine(settings.DATABASE_URL_SYNC)
    with Session(engine) as session:
        print(f"Generating {employee_count} employees...")
        for i in range(employee_count):
            emp_code = f"EMP{i+1:06d}"
            cat_code = random.choice(CATEGORIES)
            name = fake.name()
            gender = random.choice(["MALE", "FEMALE", "OTHER"])
            doj = fake.date_between(start_date="-10y", end_date="-30d")
            session.execute(text("""
                INSERT INTO employees (id, emp_code, name, gender, doj, category_id, department_id, designation_id)
                VALUES (uuid_generate_v4(), :ec, :nm, :g, :doj,
                        (SELECT id FROM employee_categories WHERE code = :cc LIMIT 1),
                        (SELECT id FROM departments ORDER BY random() LIMIT 1),
                        (SELECT id FROM designations ORDER BY random() LIMIT 1))
                ON CONFLICT DO NOTHING
            """), {"ec": emp_code, "nm": name, "g": gender, "doj": doj, "cc": cat_code})
            if i % 200 == 0:
                print(f"  {i}/{employee_count}...")
                session.commit()
        session.commit()
        print(f"Generated {employee_count} employees.")

        # Opening balances
        emp_ids = [str(r[0]) for r in session.execute(text("SELECT id FROM employees LIMIT :n"), {"n": employee_count}).fetchall()]
        lt_ids = {r.code: str(r.id) for r in session.execute(text("SELECT id, code FROM leave_types")).fetchall()}
        for eid in emp_ids:
            for lt_code, lt_id in lt_ids.items():
                session.execute(text("""
                    INSERT INTO leave_balances (id, employee_id, leave_type_id, leave_year, year_start_date, opening_balance, credited)
                    VALUES (uuid_generate_v4(), :eid, :lid, 2026, '2026-04-01', 30, 30)
                    ON CONFLICT DO NOTHING
                """), {"eid": eid, "lid": lt_id})
        session.commit()
        print("Balances seeded.")

        # Leave applications
        print(f"Generating {app_count} applications...")
        for i in range(app_count):
            eid = random.choice(emp_ids)
            lt_code = random.choice(LEAVE_TYPES)
            lt_id = lt_ids[lt_code]
            start = fake.date_between(start_date="-2y", end_date="today")
            end = start + timedelta(days=random.randint(1, 5))
            status = random.choice(["APPROVED", "REJECTED", "WITHDRAWN"])
            yr = start.year
            seq = i + 1
            session.execute(text("""
                INSERT INTO leave_applications (id, app_number, config_id, employee_id, leave_type_id, from_date, to_date, applied_days, reason, status, submitted_at)
                VALUES (uuid_generate_v4(), :an, (SELECT id FROM workflow_configs LIMIT 1), :eid, :lid, :fd, :td, EXTRACT(DAY FROM :td::date - :fd::date) + 1, 'Test data', :st, :fd::timestamp)
            """), {"an": f"HRMS/{yr}/{seq:05d}", "eid": eid, "lid": lt_id, "fd": start, "td": end, "st": status})
            if i % 5000 == 0:
                print(f"  {i}/{app_count}...")
                session.commit()
        session.commit()
        print(f"Generated {app_count} applications.")
        print("Done.")

if __name__ == "__main__":
    generate()