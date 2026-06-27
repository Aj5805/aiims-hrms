"""Seed 008 â€” Nodal Routing Test Data.

Creates full test dataset for the department-based nodal routing system:
  - 1  admin user  (username: admin,       password: password)
  - 10 departments (testDept1..10)
  - 10 designations (testDesig1..10)
  - 10 leave types  (testLeaveType1..10)
  - 10 HOD employees + users (testHod1..10), one per dept
  - 10 Nodal Officer employees + users (testNodal1..10), one per dept
  - 10 Staff employees + users (testStaff1..10), one per dept
  - dept_nodal_assignments: each testDept maps to its testNodal
  - Per-dept workflow configs:  STAFF -> HOD -> NODAL_OFFICER (final)
  - Leave balances (all 10 leave types, 15 days each) for every staff member

GATED: Only runs if APP_ENV != "production".
All passwords: password
"""

import os
import uuid
from sqlalchemy import text
from app.auth.jwt import hash_password

N = 10
PH = None  # computed once below


def _ph():
    return hash_password("password")


def _upsert_dept(session, code, name):
    session.execute(
        text("INSERT INTO departments (id, code, name) VALUES (uuid_generate_v4(), :c, :n) ON CONFLICT (code) DO NOTHING"),
        {"c": code, "n": name},
    )
    row = session.execute(text("SELECT id FROM departments WHERE code = :c"), {"c": code}).fetchone()
    return str(row[0])


def _upsert_desig(session, name, cat_id):
    session.execute(
        text("INSERT INTO designations (id, name, grade_pay_level, category_id) VALUES (uuid_generate_v4(), :n, 'Level 7', :cat) ON CONFLICT (name) DO NOTHING"),
        {"n": name, "cat": cat_id},
    )
    row = session.execute(text("SELECT id FROM designations WHERE name = :n"), {"n": name}).fetchone()
    return str(row[0])




def _upsert_employee(session, emp_code, name, cat_id, dept_id, desig_id, email):
    session.execute(
        text("""
            INSERT INTO employees
                (id, emp_code, name, gender, doj, category_id, department_id, designation_id, email, has_institutional_email)
            VALUES
                (uuid_generate_v4(), :ec, :n, 'Other', '2022-01-01', :cat, :dept, :desig, :email, true)
            ON CONFLICT (emp_code) DO UPDATE SET
                name = EXCLUDED.name,
                department_id = EXCLUDED.department_id,
                designation_id = EXCLUDED.designation_id,
                category_id = EXCLUDED.category_id,
                email = EXCLUDED.email
        """),
        {"ec": emp_code, "n": name, "cat": cat_id, "dept": dept_id, "desig": desig_id, "email": email},
    )
    row = session.execute(text("SELECT id FROM employees WHERE emp_code = :ec"), {"ec": emp_code}).fetchone()
    return str(row[0])


def _upsert_user(session, username, role, emp_id):
    session.execute(
        text("""
            INSERT INTO users
                (id, username, password_hash, role, employee_id, is_active, must_change_password,
                 failed_login_attempts, locked_until, tokens_valid_from)
            VALUES
                (uuid_generate_v4(), :un, :ph, :role, :eid, true, false, 0, NULL, now())
            ON CONFLICT (username) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                role = EXCLUDED.role,
                employee_id = EXCLUDED.employee_id,
                is_active = true,
                must_change_password = false,
                failed_login_attempts = 0,
                locked_until = NULL,
                tokens_valid_from = now()
        """),
        {"un": username, "ph": _ph(), "role": role, "eid": emp_id},
    )
    row = session.execute(text("SELECT id FROM users WHERE username = :un"), {"un": username}).fetchone()
    return str(row[0])


def _upsert_admin(session):
    """Central admin user â€” not linked to an employee."""
    session.execute(
        text("""
            INSERT INTO users
                (id, username, password_hash, role, employee_id, is_active, must_change_password,
                 failed_login_attempts, locked_until, tokens_valid_from)
            VALUES
                (uuid_generate_v4(), 'admin', :ph, 'ADMIN', NULL, true, false, 0, NULL, now())
            ON CONFLICT (username) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                role = 'ADMIN',
                is_active = true,
                must_change_password = false,
                failed_login_attempts = 0,
                locked_until = NULL,
                tokens_valid_from = now()
        """),
        {"ph": _ph()},
    )


def _assign_nodal(session, dept_id, nodal_user_id):
    """Set the nodal officer for a department. Deactivate old, insert new."""
    session.execute(
        text("""
            UPDATE dept_nodal_assignments
            SET is_active = false
            WHERE department_id = :did AND nodal_user_id != :uid
        """),
        {"did": dept_id, "uid": nodal_user_id},
    )
    session.execute(
        text("""
            INSERT INTO dept_nodal_assignments (id, department_id, nodal_user_id, is_active)
            VALUES (uuid_generate_v4(), :did, :uid, true)
            ON CONFLICT (department_id, nodal_user_id)
            DO UPDATE SET is_active = true
        """),
        {"did": dept_id, "uid": nodal_user_id},
    )


def _create_nodal_workflow(session, admin_user_id, dept_id, dept_name):
    """Create a 2-step workflow for a specific department: HOD -> NODAL_OFFICER (final)."""
    config_name = f"Nodal Workflow â€” {dept_name}"
    existing = session.execute(
        text("SELECT id FROM workflow_configs WHERE config_name = :n"), {"n": config_name}
    ).fetchone()
    if existing:
        return str(existing[0])

    cid = str(uuid.uuid4())
    session.execute(
        text("""
            INSERT INTO workflow_configs
                (id, config_name, category_id, leave_type_id, min_days, max_days, created_by)
            VALUES (:id, :n, NULL, NULL, 1, NULL, :cby)
        """),
        {"id": cid, "n": config_name, "cby": admin_user_id},
    )
    # Step 1: HOD (department-scoped, not final)
    session.execute(
        text("""
            INSERT INTO workflow_steps
                (config_id, step_order, approver_role, approver_office, sla_hours, is_final_authority)
            VALUES (:cid, 1, 'HOD', 'Department', 48, false)
        """),
        {"cid": cid},
    )
    # Step 2: NODAL_OFFICER (final authority)
    session.execute(
        text("""
            INSERT INTO workflow_steps
                (config_id, step_order, approver_role, approver_office, sla_hours, is_final_authority)
            VALUES (:cid, 2, 'NODAL_OFFICER', 'Nodal Office', 72, true)
        """),
        {"cid": cid},
    )
    return cid


def run(session):
    if os.environ.get("APP_ENV") == "production":
        print("Skipping nodal routing test data in production.")
        return

    # â”€â”€ Central admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    _upsert_admin(session)
    admin_user = session.execute(text("SELECT id FROM users WHERE username = 'admin'")).fetchone()
    admin_user_id = str(admin_user[0])

    # â”€â”€ Category: use ADMIN (CCS scheme, suits general staff) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    cat = session.execute(text("SELECT id FROM employee_categories WHERE code = 'ADMIN'")).fetchone()
    if not cat:
        print("ERROR: ADMIN employee category missing â€” run seed 001 first.")
        return
    cat_id = str(cat[0])

    # â”€â”€ Fetch existing leave types ─────────────────────────────────────────
    lt_res = session.execute(text("SELECT id FROM leave_types")).fetchall()
    lt_ids = [str(r[0]) for r in lt_res]
    if not lt_ids:
        print("ERROR: No leave types found. Please run seed 002 first.")
        return
    print(f"  - Found {len(lt_ids)} existing leave types")

    # â”€â”€ Departments 1-10 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    dept_ids = {}
    for i in range(1, N + 1):
        dept_ids[i] = _upsert_dept(session, f"TDEPT{i:02d}", f"testDept{i}")
    print(f"  âœ“ Upserted {N} departments")

    # â”€â”€ Designations 1-10 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    desig_ids = {}
    for i in range(1, N + 1):
        desig_ids[i] = _upsert_desig(session, f"testDesig{i}", cat_id)
    print(f"  âœ“ Upserted {N} designations")

    # â”€â”€ HOD employees + users (one per dept) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    hod_user_ids = {}
    for i in range(1, N + 1):
        emp_id = _upsert_employee(
            session,
            emp_code=f"THOD{i:02d}",
            name=f"HOD User {i}",
            cat_id=cat_id,
            dept_id=dept_ids[i],
            desig_id=desig_ids[i],
            email=f"hod{i}@test.aiims",
        )
        hod_user_ids[i] = _upsert_user(session, f"testHod{i}", "HOD", emp_id)
    print(f"  âœ“ Upserted {N} HOD users")

    # â”€â”€ Nodal Officer employees + users (one per dept) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    nodal_user_ids = {}
    for i in range(1, N + 1):
        emp_id = _upsert_employee(
            session,
            emp_code=f"TNDL{i:02d}",
            name=f"Nodal Officer {i}",
            cat_id=cat_id,
            dept_id=dept_ids[i],
            desig_id=desig_ids[i],
            email=f"nodal{i}@test.aiims",
        )
        nodal_user_ids[i] = _upsert_user(session, f"testNodal{i}", "NODAL_OFFICER", emp_id)
    print(f"  âœ“ Upserted {N} nodal officer users")

    # â”€â”€ Staff employees + users (one per dept) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    staff_emp_ids = {}
    for i in range(1, N + 1):
        emp_id = _upsert_employee(
            session,
            emp_code=f"TSTAFF{i:02d}",
            name=f"Staff User {i}",
            cat_id=cat_id,
            dept_id=dept_ids[i],
            desig_id=desig_ids[i],
            email=f"staff{i}@test.aiims",
        )
        _upsert_user(session, f"testStaff{i}", "STAFF", emp_id)
        staff_emp_ids[i] = emp_id
    print(f"  âœ“ Upserted {N} staff users")

    # â”€â”€ Dept â†’ Nodal assignments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for i in range(1, N + 1):
        _assign_nodal(session, dept_ids[i], nodal_user_ids[i])
    print(f"  âœ“ Assigned {N} deptâ†’nodal mappings")

    # â”€â”€ Per-dept workflow configs (HOD â†’ NODAL_OFFICER) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for i in range(1, N + 1):
        _create_nodal_workflow(session, admin_user_id, dept_ids[i], f"testDept{i}")
    print(f"  âœ“ Created {N} per-dept workflow configs (HOD â†’ NODAL_OFFICER)")

    # ── Leave balances for all staff (all existing leave types, 15 days opening) ────
    for i in range(1, N + 1):
        for lt_id in lt_ids:
            session.execute(
                text("""
                    INSERT INTO leave_balances
                        (id, employee_id, leave_type_id, leave_year, year_start_date, opening_balance, credited)
                    VALUES (uuid_generate_v4(), :eid, :ltid, 2026, '2026-04-01'::date, 15, 0)
                    ON CONFLICT DO NOTHING
                """),
                {"eid": staff_emp_ids[i], "ltid": lt_id},
            )
    print(f"  - Seeded leave balances ({N} staff × {len(lt_ids)} leave types)")

    print(
        f"\nSeed 008 complete. Summary:\n"
        f"  admin      : username=admin,       password=password  (central login, no employee)\n"
        f"  Staff      : testStaff1..{N}      password=password\n"
        f"  HODs       : testHod1..{N}         password=password\n"
        f"  Nodal Offrs: testNodal1..{N}       password=password\n"
        f"  Departments: testDept1..{N}\n"
        f"  Designations: testDesig1..{N}\n"
        f"  Leave Types : testLeaveType1..{N}\n"
        f"  Routing     : Staff â†’ HOD of dept â†’ Nodal Officer of dept (final)\n"
    )
