"""Seed 007 — Test Users for E2E Journeys.

Creates real login-able accounts for STAFF, HOD, ESTABLISHMENT_OFFICER,
REGISTRAR, DEAN_ACADEMIC, DIRECTOR, ADMIN — each linked to a real employee row.

GATED: Only runs if APP_ENV != "production".
"""

import os
import uuid
import secrets
from sqlalchemy import text
from app.auth.jwt import hash_password

def run(session):
    if os.environ.get("APP_ENV") == "production":
        print("Skipping test users in production environment.")
        return

    # 1. Create Department
    dept_id = str(uuid.uuid4())
    session.execute(
        text("INSERT INTO departments (id, code, name) VALUES (:id, :c, :n) ON CONFLICT (code) DO NOTHING"),
        {"id": dept_id, "c": "TEST_DEPT", "n": "Test Department"}
    )
    dept_res = session.execute(text("SELECT id FROM departments WHERE code = 'TEST_DEPT'")).fetchone()
    if not dept_res:
        return
    dept_id = str(dept_res[0])

    # 2. Create Designations
    cat_res = session.execute(text("SELECT id FROM employee_categories WHERE code = 'ADMIN'")).fetchone()
    if not cat_res:
        print("ERROR: ADMIN category not found")
        return
    cat_id = str(cat_res[0])

    desig_id = str(uuid.uuid4())
    session.execute(
        text("INSERT INTO designations (id, name, grade_pay_level, category_id) VALUES (:id, :n, :gpl, :cat) ON CONFLICT (name) DO NOTHING"),
        {"id": desig_id, "n": "Test Staff", "gpl": "Level 10", "cat": cat_id}
    )
    desig_res = session.execute(text("SELECT id FROM designations WHERE name = 'Test Staff'")).fetchone()
    desig_id = str(desig_res[0])

    # 3. Create Employees
    employees = [
        {"emp_code": "TEST_STAFF", "name": "Staff User", "email": "staff@test.com", "role": "STAFF"},
        {"emp_code": "TEST_HOD", "name": "HOD User", "email": "hod@test.com", "role": "HOD"},
        {"emp_code": "TEST_ESTAB", "name": "Estab User", "email": "estab@test.com", "role": "ESTABLISHMENT_OFFICER"},
        {"emp_code": "TEST_REGISTRAR", "name": "Registrar User", "email": "registrar@test.com", "role": "REGISTRAR"},
        {"emp_code": "TEST_DEAN", "name": "Dean User", "email": "dean@test.com", "role": "DEAN_ACADEMIC"},
        {"emp_code": "TEST_DIRECTOR", "name": "Director User", "email": "director@test.com", "role": "DIRECTOR"},
        {"emp_code": "TEST_ADMIN", "name": "Admin User", "email": "admin@test.com", "role": "ADMIN"},
    ]

    for e in employees:
        emp_id = str(uuid.uuid4())
        session.execute(
            text("""
                INSERT INTO employees 
                    (id, emp_code, name, gender, doj, category_id, department_id, designation_id, email, has_institutional_email)
                VALUES 
                    (:id, :ec, :n, 'Other', '2020-01-01', :cat, :dept, :desig, :email, true)
                ON CONFLICT (emp_code) DO NOTHING
            """),
            {"id": emp_id, "ec": e["emp_code"], "n": e["name"], "cat": cat_id, "dept": dept_id, "desig": desig_id, "email": e["email"]}
        )

        emp_res = session.execute(text("SELECT id FROM employees WHERE emp_code = :ec"), {"ec": e["emp_code"]}).fetchone()
        real_emp_id = str(emp_res[0])

        uid = str(uuid.uuid4())
        username = e["role"].lower()
        if username == "establishment_officer":
            username = "estab"
        elif username == "dean_academic":
            username = "dean"
            
        must_change_password = e["role"] == "STAFF"
        session.execute(
            text("""
                INSERT INTO users (id, username, password_hash, role, employee_id, is_active, must_change_password)
                VALUES (:id, :un, :ph, :role, :eid, true, :must_change_password)
                ON CONFLICT (username) DO UPDATE SET
                    password_hash = :ph,
                    must_change_password = :must_change_password,
                    is_active = true,
                    employee_id = :eid,
                    role = :role
            """),
            {
                "id": uid,
                "un": username,
                "ph": hash_password("password"),
                "role": e["role"],
                "eid": real_emp_id,
                "must_change_password": must_change_password,
            }
        )

    # 4. Seed initial balance for TEST_STAFF so they can apply for leave
    session.execute(
        text("""
            INSERT INTO leave_balances 
                (id, employee_id, leave_type_id, leave_year, year_start_date, opening_balance, credited)
            SELECT gen_random_uuid(), e.id, lt.id, 2026, '2026-04-01'::date, 10, 0
            FROM employees e
            JOIN leave_types lt ON lt.code = 'EL'
            WHERE e.emp_code = 'TEST_STAFF'
            AND NOT EXISTS (
                SELECT 1 FROM leave_balances lb2 
                WHERE lb2.employee_id = e.id AND lb2.leave_type_id = lt.id AND lb2.leave_year = 2026
            )
        """)
    )

    print("Seeded 7 test users (staff, hod, estab, registrar, dean, director, admin) mapped to real employees. All passwords are 'password'.")
