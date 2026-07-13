"""
E2E test script for AIIMS HRMS leave workflow.
Uses httpx.AsyncClient with ASGI transport — no server needed.

Harness: after DB rebuild+seed+init_admin the E2E sets the admin password
         deterministically via direct DB hash update (no copy-pasting).
         Fixed password: E2eAdmin#123

Steps (original):
  S0  workflow_seed_admin login -> 401 (not 500)
  S1  Admin login
  S2a Create approver users (HOD, ESTAB, REGISTRAR)
  S2b Create departments + designations + employees HRMS001..HRMS004
  S2c POST holiday 2026-07-15
  S3  POST opening balance HRMS004 CL=8
  S4  GET balance -> closing_balance==8
  S5  POST leave application HRMS004 CL 2026-07-21/22 -> 201, applied_days==2
  S6  HOD approve -> UNDER_REVIEW
  S7  ESTAB approve -> UNDER_REVIEW
  S8  REGISTRAR approve (final) -> APPROVED, balance deducted
  S9  GET balance -> closing_balance==6, availed==2
  S10 GET leave-register report
  S11 GET payroll-export CSV
  S12 GET sanction-pdf -> 200, content-type=application/pdf, body starts %PDF, len>1000

New gap assertions:
  A   Opening-balance idempotency: POST /opening TWICE -> closing_balance still 8
       + note on annual-credit double-count risk
  B   Duplicate -> 409: dept, designation, employee, holiday
  C   STAFF scope: HRMS004 login, GET /leave-applications -> 200 (no ANY-array error)
  D   Sanction PDF: 200, %PDF header, >1000 bytes (already S12 after reportlab)
"""

import asyncio
import json
import os
import sys
import uuid

import httpx
from sqlalchemy import create_engine, text as sa_text

BASE = "http://testserver"
ADMIN_USER = "admin"
FIXED_ADMIN_PASS = "E2eAdmin#123"   # set deterministically before S1


# ─── helpers ────────────────────────────────────────────────────────────────

def ok(label, r, expected_status=None):
    status_ok = (expected_status is None and r.status_code < 300) or r.status_code == expected_status
    try:
        body = r.json()
    except Exception:
        body = r.text[:500]
    if status_ok:
        print(f"  [OK]  {label}  HTTP {r.status_code}")
    else:
        print(f"  [FAIL] {label}  HTTP {r.status_code}  expected {expected_status}")
        print(f"         Response: {json.dumps(body, default=str)[:2000]}")
        sys.exit(1)
    return body


def fail(label, r, expected_status):
    try:
        body = r.json()
    except Exception:
        body = r.text[:500]
    if r.status_code == expected_status:
        print(f"  [OK]  {label}  HTTP {r.status_code} (expected {expected_status})")
    else:
        print(f"  [FAIL] {label}  HTTP {r.status_code}  expected {expected_status}")
        print(f"         Response: {json.dumps(body, default=str)[:2000]}")
        sys.exit(1)
    return body


def set_deterministic_admin_password():
    """
    Directly update the admin user's password_hash to FIXED_ADMIN_PASS so
    we never need to copy-paste a randomly generated password.
    Uses the sync engine (same pattern as init_admin.py / seeds).
    """
    # Import after chdir so .env is found
    from app.core.config import settings
    from app.auth.jwt import hash_password

    engine = create_engine(settings.DATABASE_URL_SYNC)
    ph = hash_password(FIXED_ADMIN_PASS)
    with engine.connect() as conn:
        # Clean up stale data from previous E2E test runs to ensure repeatability
        conn.execute(sa_text("DELETE FROM notification_queue WHERE application_id IN (SELECT id FROM leave_applications WHERE employee_id IN (SELECT id FROM employees WHERE emp_code LIKE 'HRMS%' OR emp_code = 'RES001'))"))
        conn.execute(sa_text("""
            DELETE FROM notification_queue
            WHERE recipient_id IN (
                SELECT id FROM users
                WHERE username IN ('hod_user', 'nodal_user', 'registrar_nodal', 'HRMS004', 'RES001')
                   OR employee_id IN (SELECT id FROM employees WHERE emp_code LIKE 'HRMS%')
            )
        """))
        conn.execute(sa_text("DELETE FROM leave_approvals WHERE application_id IN (SELECT id FROM leave_applications WHERE employee_id IN (SELECT id FROM employees WHERE emp_code LIKE 'HRMS%' OR emp_code = 'RES001'))"))
        conn.execute(sa_text("DELETE FROM leave_approvals WHERE approver_id IN (SELECT id FROM users WHERE username IN ('hod_user', 'nodal_user', 'registrar_nodal', 'HRMS004') OR employee_id IN (SELECT id FROM employees WHERE emp_code LIKE 'HRMS%' OR emp_code = 'RES001'))"))
        conn.execute(sa_text("DELETE FROM leave_applications WHERE employee_id IN (SELECT id FROM employees WHERE emp_code LIKE 'HRMS%' OR emp_code = 'RES001')"))
        conn.execute(sa_text("TRUNCATE leave_balance_ledger"))
        conn.execute(sa_text("DELETE FROM leave_balances WHERE employee_id IN (SELECT id FROM employees WHERE emp_code LIKE 'HRMS%' OR emp_code = 'RES001')"))
        conn.execute(sa_text("""
            UPDATE workflow_configs SET is_active = false
            WHERE config_name NOT IN ('Regular Staff — Default (All Types, All Durations)')
              AND config_name NOT LIKE 'Resident — Default (%)'
        """))
        conn.execute(sa_text("""
            UPDATE workflow_configs SET is_active = true
            WHERE config_name = 'Regular Staff — Default (All Types, All Durations)'
               OR config_name LIKE 'Resident — Default (%)'
        """))
        conn.execute(sa_text("""
            WITH cfg AS (
                SELECT id FROM workflow_configs
                WHERE config_name = 'Regular Staff — Default (All Types, All Durations)'
                LIMIT 1
            )
            UPDATE workflow_steps SET approver_role = 'HOD', is_final_authority = false
            WHERE config_id = (SELECT id FROM cfg) AND step_order = 1
        """))
        conn.execute(sa_text("""
            WITH cfg AS (
                SELECT id FROM workflow_configs
                WHERE config_name = 'Regular Staff — Default (All Types, All Durations)'
                LIMIT 1
            )
            UPDATE workflow_steps SET approver_role = 'NODAL_OFFICER', is_final_authority = true
            WHERE config_id = (SELECT id FROM cfg) AND step_order = 2
        """))
        conn.execute(sa_text("""
            DELETE FROM workflow_steps ws
            WHERE ws.step_order > 2
              AND ws.config_id IN (
                  SELECT id FROM workflow_configs
                  WHERE config_name = 'Regular Staff — Default (All Types, All Durations)'
                     OR config_name LIKE 'Resident — Default (%)'
              )
              AND NOT EXISTS (SELECT 1 FROM leave_approvals la WHERE la.step_id = ws.id)
        """))
        conn.execute(sa_text("DELETE FROM token_blacklist WHERE user_id IN (SELECT id FROM users WHERE username IN ('hod_user', 'nodal_user', 'registrar_nodal', 'HRMS004', 'RES001') OR employee_id IN (SELECT id FROM employees WHERE emp_code LIKE 'HRMS%' OR emp_code = 'RES001'))"))
        conn.execute(sa_text("""
            UPDATE workflow_steps SET specific_approver_id = NULL
            WHERE specific_approver_id IN (
                SELECT id FROM users
                WHERE username IN ('hod_user', 'nodal_user', 'registrar_nodal', 'HRMS004', 'RES001')
                   OR employee_id IN (SELECT id FROM employees WHERE emp_code LIKE 'HRMS%' OR emp_code = 'RES001')
            )
        """))
        conn.execute(sa_text("DELETE FROM users WHERE username IN ('hod_user', 'nodal_user', 'registrar_nodal', 'HRMS004', 'RES001') OR employee_id IN (SELECT id FROM employees WHERE emp_code LIKE 'HRMS%' OR emp_code = 'RES001')"))
        conn.execute(sa_text("DELETE FROM employees WHERE emp_code LIKE 'HRMS%' OR emp_code = 'RES001'"))
        conn.execute(sa_text("DELETE FROM holiday_master WHERE holiday_date = '2026-07-15'::date"))
        conn.execute(sa_text("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, is_active = true"))
        
        result = conn.execute(
            sa_text("UPDATE users SET password_hash = :ph, must_change_password = false WHERE username = 'admin' AND is_active = true"),
            {"ph": ph},
        )
        conn.commit()
        if result.rowcount == 0:
            print("  [FAIL] set_deterministic_admin_password: no active admin row found")
            sys.exit(1)
    print(f"  [OK]  admin password set to '{FIXED_ADMIN_PASS}' (must_change_password=false)")


# ─── main ───────────────────────────────────────────────────────────────────

async def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    print("\n=== SETUP: Set deterministic admin password ===")
    set_deterministic_admin_password()

    from main import app
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url=BASE) as client:

        # ── S0 ──────────────────────────────────────────────────────────────
        print("\n=== S0: workflow_seed_admin returns 401 (not 500) ===")
        r = await client.post("/api/v1/auth/login",
                              json={"username": "workflow_seed_admin", "password": "anything"})
        fail("workflow_seed_admin login", r, 401)

        # ── S1 ──────────────────────────────────────────────────────────────
        print("\n=== S1: Admin login ===")
        r = await client.post("/api/v1/auth/login",
                              json={"username": ADMIN_USER, "password": FIXED_ADMIN_PASS})
        data = ok("admin login", r, 200)
        admin_token = data["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        print(f"  admin token acquired, user={data['user']['username']}, role={data['user']['role']}")

        # ── S2a ─────────────────────────────────────────────────────────────
        print("\n=== S2a: Create approver users ===")
        for uname, role, pwd in [
            ("hod_user",   "HOD",           "hod_pass123"),
            ("nodal_user", "NODAL_OFFICER", "nodal_pass123"),
        ]:
            r = await client.post(
                "/api/v1/users",
                json={"username": uname, "role": role, "password": pwd,
                      "must_change_password": False},
                headers=admin_headers,
            )
            if r.status_code == 409:
                print(f"  [OK]  {uname} already exists")
            else:
                ok(f"create {uname}", r, 201)

        # Assign nodal officer to Establishment office (CCS scheme)
        r = await client.get("/api/v1/nodal-offices", headers=admin_headers)
        offices = ok("list nodal offices", r, 200)
        estab_office = next((o for o in offices if o.get("leave_scheme") == "CCS"), None)
        if estab_office:
            r = await client.get("/api/v1/users", headers=admin_headers)
            users = ok("list users for nodal assign", r, 200)
            nodal_uid = next((u["id"] for u in users if u["username"] == "nodal_user"), None)
            if nodal_uid:
                r = await client.put(
                    f"/api/v1/nodal-offices/{estab_office['id']}",
                    json={"officer_user_id": nodal_uid},
                    headers=admin_headers,
                )
                ok("assign nodal_user to Establishment office", r, 200)

        # ── S2b ─────────────────────────────────────────────────────────────
        print("\n=== S2b: Create departments, designations, employees ===")

        for dept in [
            {"code": "EST",  "name": "Establishment",      "managing_office": "ESTABLISHMENT"},
            {"code": "DAO",  "name": "Dean Academic Office","managing_office": "DEAN_ACADEMIC"},
            {"code": "ANAT", "name": "Anatomy",            "managing_office": "ESTABLISHMENT"},
        ]:
            r = await client.post("/api/v1/departments", json=dept, headers=admin_headers)
            if r.status_code in (200, 201):
                print(f"  [OK]  dept {dept['code']} created HTTP {r.status_code}")
            elif r.status_code == 409:
                print(f"  [OK]  dept {dept['code']} already exists (409)")
            else:
                ok(f"create dept {dept['code']}", r, 201)

        for des in [
            {"name": "Section Officer",     "grade_pay_level": "Level-7"},
            {"name": "Assistant Registrar", "grade_pay_level": "Level-10"},
            {"name": "Professor",           "grade_pay_level": "Level-14"},
        ]:
            r = await client.post("/api/v1/designations", json=des, headers=admin_headers)
            if r.status_code in (200, 201):
                print(f"  [OK]  designation '{des['name']}' created HTTP {r.status_code}")
            elif r.status_code == 409:
                print(f"  [OK]  designation '{des['name']}' already exists (409)")
            else:
                ok(f"create designation {des['name']}", r, 201)

        emp_ids = {}
        _staff_groups = {"ADMIN": "ADM", "FACULTY": "FAC", "NURSING": "NUR"}
        for emp in [
            {"emp_code": "HRMS001", "name": "Alice Kumar", "gender": "FEMALE",
             "doj": "2020-01-15", "category_code": "ADMIN",
             "department_code": "EST", "designation_name": "Section Officer"},
            {"emp_code": "HRMS002", "name": "Bob Singh",   "gender": "MALE",
             "doj": "2019-06-01", "category_code": "FACULTY",
             "department_code": "ANAT","designation_name": "Professor"},
            {"emp_code": "HRMS003", "name": "Carol Das",   "gender": "FEMALE",
             "doj": "2021-03-10", "category_code": "NURSING",
             "department_code": "EST", "designation_name": "Section Officer"},
            {"emp_code": "HRMS004", "name": "David Rao",   "gender": "MALE",
             "doj": "2018-08-20", "category_code": "ADMIN",
             "department_code": "EST", "designation_name": "Section Officer"},
        ]:
            emp = {**emp, "staff_group": _staff_groups[emp["category_code"]]}
            r = await client.post("/api/v1/employees", json=emp, headers=admin_headers)
            if r.status_code == 201:
                body = r.json()
                emp_ids[emp["emp_code"]] = body["id"]
                print(f"  [OK]  employee {emp['emp_code']} created, user_id={body.get('user_id')}")
            elif r.status_code == 409:
                r2 = await client.get(f"/api/v1/employees?search={emp['emp_code']}",
                                      headers=admin_headers)
                items = ok(f"fetch {emp['emp_code']} after 409", r2, 200)
                if not items:
                    print(f"  [FAIL] {emp['emp_code']} not found after 409")
                    sys.exit(1)
                emp_ids[emp["emp_code"]] = items[0]["id"]
                print(f"  [OK]  employee {emp['emp_code']} already exists id={items[0]['id']}")
            else:
                ok(f"create employee {emp['emp_code']}", r, 201)

        if "HRMS004" not in emp_ids:
            r = await client.get("/api/v1/employees?search=HRMS004", headers=admin_headers)
            items = ok("fetch HRMS004", r, 200)
            emp_ids["HRMS004"] = items[0]["id"]

        hrms004_id = emp_ids["HRMS004"]
        print(f"  HRMS004 employee_id={hrms004_id}")

        r = await client.get("/api/v1/users", headers=admin_headers)
        all_users = ok("list users", r, 200)
        hrms004_users = [u for u in all_users if u.get("username") == "HRMS004"]
        if hrms004_users:
            print(f"  [OK]  HRMS004 STAFF login confirmed: username={hrms004_users[0]['username']} role={hrms004_users[0]['role']} is_active={hrms004_users[0]['is_active']}")
        else:
            print("  [WARN] HRMS004 STAFF login not found in users list")

        # ── S2c ─────────────────────────────────────────────────────────────
        print("\n=== S2c: POST holiday 2026-07-15 ===")
        r = await client.post("/api/v1/holiday-master", json={
            "year": 2026, "holiday_date": "2026-07-15",
            "holiday_name": "Test Gazetted Holiday",
            "holiday_type": "GAZETTED", "applicable_to": "ALL",
        }, headers=admin_headers)
        if r.status_code == 201:
            ok("create holiday 2026-07-15", r, 201)
        elif r.status_code == 409:
            print("  [OK]  holiday 2026-07-15 already exists (409)")
        else:
            ok("create holiday 2026-07-15", r, 201)

        # ── S3 ──────────────────────────────────────────────────────────────
        print("\n=== S3: POST opening balance HRMS004 CL=8 (first time) ===")
        r = await client.post("/api/v1/leave-balances/opening", json=[
            {"emp_code": "HRMS004", "leave_type_code": "CL", "opening_balance": 8}
        ], headers=admin_headers)
        body = ok("POST opening balance (1st)", r, 200)
        print(f"  result: {body}")

        # ── S4 ──────────────────────────────────────────────────────────────
        print("\n=== S4: GET HRMS004 CL balance — expect closing_balance=8 ===")
        r = await client.get(f"/api/v1/leave-balances/{hrms004_id}", headers=admin_headers)
        body = ok("GET balances after 1st opening", r, 200)
        balances = body["balances"]
        cl_bal = next((b for b in balances if b["leave_type_code"] == "CL"), None)
        if cl_bal is None:
            print(f"  [FAIL] CL balance not found. all balances: {balances}")
            sys.exit(1)
        closing = float(cl_bal["closing_balance"])
        print(f"  CL: opening={cl_bal['opening_balance']}, credited={cl_bal['credited']}, availed={cl_bal['availed']}, closing={closing}")
        if closing != 8.0:
            print(f"  [FAIL] Expected closing_balance=8, got {closing}")
            sys.exit(1)
        print(f"  [OK]  closing_balance={closing} == 8")

        # ── GAP A: idempotency ───────────────────────────────────────────────
        print("\n=== GAP A: Opening-balance idempotency (POST /opening twice) ===")
        r = await client.post("/api/v1/leave-balances/opening", json=[
            {"emp_code": "HRMS004", "leave_type_code": "CL", "opening_balance": 8}
        ], headers=admin_headers)
        body = ok("POST opening balance (2nd, idempotent)", r, 200)
        print(f"  result: {body}")

        r = await client.get(f"/api/v1/leave-balances/{hrms004_id}", headers=admin_headers)
        body = ok("GET balances after 2nd opening", r, 200)
        cl_bal2 = next((b for b in body["balances"] if b["leave_type_code"] == "CL"), None)
        closing2 = float(cl_bal2["closing_balance"])
        print(f"  CL after 2nd POST: opening={cl_bal2['opening_balance']}, credited={cl_bal2['credited']}, availed={cl_bal2['availed']}, closing={closing2}")
        if closing2 != 8.0:
            print(f"  [FAIL] GAP A idempotency: closing_balance should still be 8 after 2nd POST, got {closing2}")
            sys.exit(1)
        print(f"  [OK]  GAP A PASS: closing_balance={closing2} after double-POST == 8 (idempotent)")
        print(f"  [NOTE] Annual-credit-double-count risk: /credit/annual INSERTs a NEW row (guarded by NOT EXISTS).")
        print(f"         If run AFTER /opening for the same year, it will not insert (guard fires).")
        print(f"         If run BEFORE /opening, /opening UPDATEs credited=0 — wipes the annual credit.")
        print(f"         => These two operations are MUTUALLY EXCLUSIVE for the same year. Choose one.")
        print(f"         => For production: use /opening for Day-Zero import, /credit/annual for subsequent years only.")

        # ── GAP B: Duplicate -> 409 ──────────────────────────────────────────
        print("\n=== GAP B: Duplicate resources -> 409 (exercises new IntegrityError catch) ===")

        # B1: duplicate department
        r = await client.post("/api/v1/departments",
                              json={"code": "EST", "name": "Establishment Dupe",
                                    "managing_office": "ESTABLISHMENT"},
                              headers=admin_headers)
        if r.status_code == 409:
            print("  [OK]  GAP B dept dupe -> 409")
        else:
            print(f"  [FAIL] GAP B dept dupe: expected 409, got HTTP {r.status_code}: {r.text[:200]}")
            sys.exit(1)

        # B2: duplicate designation
        r = await client.post("/api/v1/designations",
                              json={"name": "Section Officer", "grade_pay_level": "Level-7"},
                              headers=admin_headers)
        if r.status_code == 409:
            print("  [OK]  GAP B designation dupe -> 409")
        else:
            print(f"  [FAIL] GAP B designation dupe: expected 409, got HTTP {r.status_code}: {r.text[:200]}")
            sys.exit(1)

        # B3: duplicate employee
        r = await client.post("/api/v1/employees", json={
            "emp_code": "HRMS004", "name": "David Rao Dupe", "gender": "MALE",
            "doj": "2018-08-20", "category_code": "ADMIN",
            "department_code": "EST", "designation_name": "Section Officer",
            "staff_group": "ADM",
        }, headers=admin_headers)
        if r.status_code == 409:
            print("  [OK]  GAP B employee dupe -> 409")
        else:
            print(f"  [FAIL] GAP B employee dupe: expected 409, got HTTP {r.status_code}: {r.text[:200]}")
            sys.exit(1)

        # B4: duplicate holiday
        r = await client.post("/api/v1/holiday-master", json={
            "year": 2026, "holiday_date": "2026-07-15",
            "holiday_name": "Duplicate Holiday", "holiday_type": "GAZETTED",
            "applicable_to": "ALL",
        }, headers=admin_headers)
        if r.status_code == 409:
            print("  [OK]  GAP B holiday dupe -> 409")
        else:
            print(f"  [FAIL] GAP B holiday dupe: expected 409, got HTTP {r.status_code}: {r.text[:200]}")
            sys.exit(1)

        # B5: duplicate leave_type
        r = await client.post("/api/v1/leave-types", json={
            "code": "CL", "name": "Casual Leave Dupe", "scheme": "BOTH"
        }, headers=admin_headers)
        if r.status_code == 409:
            print("  [OK]  GAP B leave_type dupe -> 409")
        else:
            print(f"  [FAIL] GAP B leave_type dupe: expected 409, got HTTP {r.status_code}: {r.text[:200]}")
            sys.exit(1)

        # B6: duplicate workflow_config (unique name per run — avoids version/FK cleanup)
        dupe_cfg_name = f"E2E_ASCII_DUPE_{uuid.uuid4().hex[:8]}"
        r = await client.post("/api/v1/workflow-configs", json={
            "config_name": dupe_cfg_name,
            "is_active": False,
        }, headers=admin_headers)
        if r.status_code != 201:
            print(f"  [FAIL] GAP B workflow_config create setup failed: {r.status_code}")
            sys.exit(1)

        r = await client.post("/api/v1/workflow-configs", json={
            "config_name": dupe_cfg_name
        }, headers=admin_headers)
        if r.status_code == 409:
            print("  [OK]  GAP B workflow_config dupe -> 409")
        else:
            print(f"  [FAIL] GAP B workflow_config dupe: expected 409, got HTTP {r.status_code}: {r.text[:200]}")
            sys.exit(1)

        # Remove inactive dupe probe so Masters workflows tab stays clean
        from sqlalchemy import create_engine, text as sa_text
        from app.core.config import settings
        with create_engine(settings.DATABASE_URL_SYNC).begin() as conn:
            conn.execute(
                sa_text("DELETE FROM workflow_steps WHERE config_id IN (SELECT id FROM workflow_configs WHERE config_name = :name)"),
                {"name": dupe_cfg_name},
            )
            conn.execute(
                sa_text("DELETE FROM workflow_configs WHERE config_name = :name"),
                {"name": dupe_cfg_name},
            )

        # Cleanup test config (deactivate API bumps version and can collide on re-runs)
        # B7: duplicate user
        r = await client.post("/api/v1/users", json={
            "username": ADMIN_USER, "password": "dupepassword", "role": "ADMIN"
        }, headers=admin_headers)
        if r.status_code == 409:
            print("  [OK]  GAP B user dupe -> 409")
        else:
            print(f"  [FAIL] GAP B user dupe: expected 409, got HTTP {r.status_code}: {r.text[:200]}")
            sys.exit(1)

        print("  [OK]  GAP B PASS: all duplicate -> 409 assertions passed")

        # ── GAP B Bulk: CSV Import SAVEPOINT ─────────────────────────────────
        print("\n=== GAP B Bulk: CSV Import SAVEPOINT (exercises per-row error without 500) ===")
        csv_content = (
            "emp_code,name,gender,doj,category,department,designation\n"
            "HRMS004,David Rao,MALE,2018-08-20,ADMIN,EST,Section Officer\n"  # Duplicate
            "HRMS005,Eva Green,FEMALE,2022-01-10,ADMIN,EST,Section Officer\n" # New
        )
        files = {"file": ("import.csv", csv_content, "text/csv")}
        r = await client.post("/api/v1/employees/import", files=files, headers=admin_headers)
        if r.status_code == 200:
            import_result = r.json()
            if import_result["error_count"] == 1 and import_result["success_count"] == 1:
                print("  [OK]  GAP B Bulk PASS: CSV import returned 1 error (duplicate), 1 success")
            else:
                print(f"  [FAIL] GAP B Bulk: Expected 1 error, 1 success, got {import_result}")
                sys.exit(1)
        else:
            print(f"  [FAIL] GAP B Bulk: Expected 200, got HTTP {r.status_code}: {r.text[:200]}")
            sys.exit(1)

        # Confirm STAFF login for HRMS004
        r = await client.post("/api/v1/auth/login", json={"username": "HRMS004", "password": "HRMS004"})
        staff_data = ok("HRMS004 STAFF login confirmed", r, 200)
        print(f"  HRMS004 STAFF login confirmed: username={staff_data['user']['username']} role={staff_data['user']['role']} is_active=True")
        staff_headers = {"Authorization": f"Bearer {staff_data['access_token']}"}

        # Clear must_change_password for the rest of the tests
        r = await client.post("/api/v1/auth/change-my-password", json={
            "current_password": "HRMS004", "new_password": "SafePassword123!"
        }, headers=staff_headers)
        ok("HRMS004 change-my-password", r, 200)

        # Re-login with new password
        r = await client.post("/api/v1/auth/login", json={"username": "HRMS004", "password": "SafePassword123!"})
        staff_data = ok("HRMS004 STAFF re-login", r, 200)
        staff_headers = {"Authorization": f"Bearer {staff_data['access_token']}"}

        # ── S5 ──────────────────────────────────────────────────────────────
        print("\n=== S5: POST leave application HRMS004 CL 2026-07-21/22 ===")
        r = await client.post("/api/v1/leave-applications", json={
            "employee_id": hrms004_id,
            "leave_type_code": "CL",
            "from_date": "2026-07-21",
            "to_date": "2026-07-22",
            "reason": "Personal work",
            "address_during_leave": "Home",
        }, headers=admin_headers)
        body = ok("submit leave application", r, 201)
        app_id = body["id"]
        applied_days = body["applied_days"]
        print(f"  app_id={app_id}, app_number={body['app_number']}, applied_days={applied_days}")
        if applied_days != 2:
            print(f"  [FAIL] Expected applied_days=2, got {applied_days}")
            sys.exit(1)
        print(f"  [OK]  applied_days={applied_days}")

        # ── GAP C: STAFF scope (ANY(:eids) asyncpg path) ─────────────────────
        print("\n=== GAP C: STAFF scope – GET /leave-applications as HRMS004 (ANY-array path) ===")
        r = await client.post("/api/v1/auth/login",
                              json={"username": "HRMS004", "password": "SafePassword123!"})
        staff_data = ok("HRMS004 STAFF login", r, 200)
        staff_headers = {"Authorization": f"Bearer {staff_data['access_token']}"}
        print(f"  HRMS004 role={staff_data['user']['role']}")

        r = await client.get("/api/v1/leave-applications", headers=staff_headers)
        body = ok("GET /leave-applications as STAFF", r, 200)
        print(f"  [OK]  GAP C PASS: STAFF GET returned HTTP 200, rows={len(body)}")
        print(f"         (No AmbiguousParameter/ANY-array error)")

        # 🚀 S6 🚀──────────────────────────────────────────────────────────────
        print("\n=== S6: HOD login and approve (step 1, non-final -> UNDER_REVIEW) ===")
        r = await client.post("/api/v1/auth/login",
                              json={"username": "hod_user", "password": "hod_pass123"})
        hod_data = ok("HOD login", r, 200)
        hod_headers = {"Authorization": f"Bearer {hod_data['access_token']}"}

        r = await client.post(f"/api/v1/leave-approvals/{app_id}/action",
                              json={"action": "APPROVED", "remarks": "Approved by HOD"},
                              headers=hod_headers)
        body = ok("HOD approve", r, 200)
        print(f"  result: {body}")

        r = await client.get(f"/api/v1/leave-applications/{app_id}", headers=admin_headers)
        app_body = ok("get application after HOD", r, 200)
        print(f"  status={app_body['status']}, current_step_order={app_body['current_step_order']}")
        if app_body["status"] != "UNDER_REVIEW":
            print(f"  [FAIL] Expected UNDER_REVIEW after HOD, got {app_body['status']}")
            sys.exit(1)
        print("  [OK]  status=UNDER_REVIEW after HOD approval")

        # ── S7 ──────────────────────────────────────────────────────────────
        print("\n=== S7: NODAL_OFFICER approve (step 2, final -> APPROVED + balance deducted) ===")
        r = await client.post("/api/v1/auth/login",
                              json={"username": "nodal_user", "password": "nodal_pass123"})
        nodal_data = ok("NODAL login", r, 200)
        nodal_headers = {"Authorization": f"Bearer {nodal_data['access_token']}"}

        r = await client.post(f"/api/v1/leave-approvals/{app_id}/action",
                              json={"action": "APPROVED", "remarks": "Sanctioned by Nodal Officer"},
                              headers=nodal_headers)
        body = ok("NODAL approve (final)", r, 200)
        print(f"  result: {body}")

        r = await client.get(f"/api/v1/leave-applications/{app_id}", headers=admin_headers)
        app_body = ok("get application after NODAL", r, 200)
        print(f"  status={app_body['status']}")
        if app_body["status"] != "APPROVED":
            print(f"  [FAIL] Expected APPROVED after NODAL, got {app_body['status']}")
            sys.exit(1)
        print("  [OK]  status=APPROVED")

        # ── S9 ──────────────────────────────────────────────────────────────
        print("\n=== S9: GET HRMS004 CL balance — expect closing_balance=6 (availed=2) ===")
        r = await client.get(f"/api/v1/leave-balances/{hrms004_id}", headers=admin_headers)
        body = ok("GET balances post-approval", r, 200)
        cl_bal = next((b for b in body["balances"] if b["leave_type_code"] == "CL"), None)
        if cl_bal is None:
            print("  [FAIL] CL balance not found post-approval")
            sys.exit(1)
        closing = float(cl_bal["closing_balance"])
        availed = float(cl_bal["availed"])
        print(f"  CL: opening={cl_bal['opening_balance']}, credited={cl_bal['credited']}, availed={availed}, closing={closing}")
        if closing != 6.0:
            print(f"  [FAIL] Expected closing_balance=6, got {closing}")
            sys.exit(1)
        if availed != 2.0:
            print(f"  [FAIL] Expected availed=2, got {availed}")
            sys.exit(1)
        print(f"  [OK]  closing_balance={closing}, availed={availed} — balance deduction confirmed")

        # 🚀 GAP D: SPECIFIC_USER approval (after balance check — avoids extra CL debit) 🚀
        print("\n=== GAP D: SPECIFIC_USER workflow test ===")

        r = await client.post("/api/v1/auth/login", json={"username": "hod_user", "password": "hod_pass123"})
        hod_gap_data = r.json()
        hod_gap_headers = {"Authorization": f"Bearer {hod_gap_data['access_token']}"}

        r = await client.post("/api/v1/auth/login", json={"username": "nodal_user", "password": "nodal_pass123"})
        nodal_data = r.json()
        nodal_headers = {"Authorization": f"Bearer {nodal_data['access_token']}"}
        nodal_user_id = nodal_data["user"]["id"]

        r = await client.get("/api/v1/leave-types", headers=admin_headers)
        cl_type_id = next(t["id"] for t in r.json() if t["code"] == "CL")
        temp_cfg_name = f"E2E_TEMP_SPECIFIC_USER_{uuid.uuid4().hex[:8]}"
        r = await client.post("/api/v1/workflow-configs", json={
            "leave_type_id": cl_type_id,
            "category_id": None,
            "config_name": temp_cfg_name,
            "is_active": True
        }, headers=admin_headers)
        temp_config_id = ok("Create TEMP SPECIFIC_USER config", r, 201)["id"]

        r = await client.post(f"/api/v1/workflow-configs/{temp_config_id}/steps", json={
            "step_order": 1,
            "approver_role": "SPECIFIC_USER",
            "specific_approver_id": nodal_user_id,
            "sla_hours": 24,
            "is_final_authority": True
        }, headers=admin_headers)
        ok("Add step to TEMP config", r, 201)

        r = await client.post("/api/v1/leave-applications", json={
            "employee_id": hrms004_id, "leave_type_code": "CL",
            "from_date": "2026-11-01", "to_date": "2026-11-01",
            "reason": "Specific test", "address_during_leave": "Home"
        }, headers=staff_headers)
        spec_app_id = ok("Submit app for SPECIFIC_USER", r, 201)["id"]

        r = await client.get("/api/v1/leave-approvals/inbox", headers=hod_gap_headers)
        hod_inbox = r.json()
        if any(a["id"] == spec_app_id for a in hod_inbox):
            print("  [FAIL] HOD saw SPECIFIC_USER app in inbox")
            sys.exit(1)
        r = await client.post(f"/api/v1/leave-approvals/{spec_app_id}/action", json={"action": "APPROVED", "remarks": "Test hod"}, headers=hod_gap_headers)
        if r.status_code != 403:
            print(f"  [FAIL] Expected 403 when HOD approves SPECIFIC_USER step, got {r.status_code}: {r.text}")
            sys.exit(1)

        r = await client.get("/api/v1/leave-approvals/inbox", headers=nodal_headers)
        nodal_inbox = r.json()
        if not any(a["id"] == spec_app_id for a in nodal_inbox):
            print("  [FAIL] NODAL (specific user) did NOT see app in inbox")
            sys.exit(1)
        r = await client.post(f"/api/v1/leave-approvals/{spec_app_id}/action", json={"action": "APPROVED", "remarks": "Test nodal"}, headers=nodal_headers)
        ok("SPECIFIC_USER approval", r, 200)

        r = await client.put(f"/api/v1/workflow-configs/{temp_config_id}", json={"is_active": False}, headers=admin_headers)
        ok("Deactivate TEMP config", r, 200)
        print("  [OK] GAP D PASS: SPECIFIC_USER inbox + auth enforced correctly")

        # ── S10 ─────────────────────────────────────────────────────────────
        print("\n=== S10: GET leave-register report ===")
        r = await client.get(
            "/api/v1/reports/leave-register?from_date=2026-07-01&to_date=2026-07-31",
            headers=admin_headers,
        )
        body = ok("leave register report", r, 200)
        print(f"  rows returned: {len(body)}")
        if body:
            print(f"  first row: {body[0]}")

        # ── S11 ─────────────────────────────────────────────────────────────
        print("\n=== S11: GET payroll-export CSV ===")
        r = await client.get(
            "/api/v1/reports/payroll-export?from_date=2026-07-01&to_date=2026-07-31&export_type=LOP",
            headers=admin_headers,
        )
        if r.status_code == 200:
            ct = r.headers.get("content-type", "")
            print(f"  [OK]  payroll-export HTTP 200, content-type={ct}")
            print(f"  CSV preview: {r.text[:200]}")
        else:
            try:
                body = r.json()
            except Exception:
                body = r.text[:500]
            print(f"  [FAIL] payroll-export HTTP {r.status_code}: {body}")
            sys.exit(1)

        # ── S12 / GAP D: sanction PDF ────────────────────────────────────────
        print("\n=== S12 / GAP D: GET sanction PDF (reportlab) ===")
        r = await client.get(f"/api/v1/reports/sanction-pdf/{app_id}", headers=admin_headers)
        if r.status_code != 200:
            try:
                body = r.json()
            except Exception:
                body = r.text[:500]
            print(f"  [FAIL] sanction-pdf HTTP {r.status_code}: {body}")
            sys.exit(1)
        ct = r.headers.get("content-type", "")
        pdf_bytes = r.content
        print(f"  HTTP 200, content-type={ct}, bytes={len(pdf_bytes)}")
        # assert content-type
        if "application/pdf" not in ct:
            print(f"  [FAIL] GAP D: content-type should be application/pdf, got {ct}")
            sys.exit(1)
        # assert PDF magic header
        if not pdf_bytes[:4] == b"%PDF":
            print(f"  [FAIL] GAP D: response body does not start with %PDF, got {pdf_bytes[:20]}")
            sys.exit(1)
        # assert non-trivial size
        if len(pdf_bytes) < 1000:
            print(f"  [FAIL] GAP D: PDF only {len(pdf_bytes)} bytes, expected >1000")
            sys.exit(1)
        print(f"  [OK]  GAP D PASS: content-type=application/pdf, starts with %PDF, len={len(pdf_bytes)}")

        # ── SCENARIO 1: RESIDENT CHAIN ──────────────────────────────────────
        print("\n=== SCENARIO 1: RESIDENT chain routing ===")
        r = await client.post("/api/v1/users", json={
            "username": "registrar_nodal", "role": "NODAL_OFFICER",
            "password": "registrar_pass123", "must_change_password": False,
        }, headers=admin_headers)
        if r.status_code not in (201, 409):
            print(f"  [FAIL] create registrar_nodal failed: {r.status_code}")
            sys.exit(1)

        r = await client.get("/api/v1/nodal-offices", headers=admin_headers)
        registrar_office = next((o for o in r.json() if o.get("leave_scheme") == "RESIDENCY"), None)
        if registrar_office:
            r = await client.get("/api/v1/users", headers=admin_headers)
            registrar_uid = next((u["id"] for u in r.json() if u["username"] == "registrar_nodal"), None)
            if registrar_uid:
                r = await client.put(
                    f"/api/v1/nodal-offices/{registrar_office['id']}",
                    json={"officer_user_id": registrar_uid},
                    headers=admin_headers,
                )
                ok("assign registrar_nodal to Registrar office", r, 200)

        r = await client.post("/api/v1/auth/login", json={"username": "registrar_nodal", "password": "registrar_pass123"})
        registrar_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

        # 2. Create Resident employee
        r = await client.post("/api/v1/employees", json={
            "emp_code": "RES001", "name": "Resident Doc", "gender": "FEMALE",
            "doj": "2025-01-01", "category_code": "JR_ACAD",
            "department_code": "ANAT", "designation_name": "Junior Resident (Academic)",
            "staff_group": "PGJR",
        }, headers=admin_headers)
        if r.status_code not in (201, 409):
            print(f"  [FAIL] create resident failed: {r.status_code}")
            sys.exit(1)
        
        res_id = None
        r = await client.get("/api/v1/employees?search=RES001", headers=admin_headers)
        res_items = r.json()
        if res_items: res_id = res_items[0]["id"]
        
        # 3. Add balance
        await client.post("/api/v1/leave-balances/opening", json=[{"emp_code": "RES001", "leave_type_code": "ANNUAL_RES", "opening_balance": 10}], headers=admin_headers)
        
        # 4. Submit leave
        r = await client.post("/api/v1/leave-applications", json={
            "employee_id": res_id, "leave_type_code": "ANNUAL_RES",
            "from_date": "2026-08-03", "to_date": "2026-08-04",
            "reason": "Resident leave", "address_during_leave": "Hostel"
        }, headers=admin_headers)
        res_app = ok("Resident leave submit", r, 201)
        res_app_id = res_app["id"]

        # 5. HOD approve
        r = await client.post(f"/api/v1/leave-approvals/{res_app_id}/action", json={"action": "APPROVED", "remarks": "OK HOD"}, headers=hod_headers)
        ok("HOD approve resident", r, 200)

        # 6. Registrar nodal officer approve (FINAL)
        r = await client.post(f"/api/v1/leave-approvals/{res_app_id}/action", json={"action": "APPROVED", "remarks": "OK Registrar Nodal"}, headers=registrar_headers)
        ok("Registrar nodal approve resident", r, 200)
        
        r = await client.get(f"/api/v1/leave-applications/{res_app_id}", headers=admin_headers)
        if r.json()["status"] != "APPROVED":
            print("  [FAIL] Resident leave not APPROVED after Registrar nodal officer.")
            sys.exit(1)
        print("  [OK] Resident routed HOD -> NODAL_OFFICER (Registrar) successfully.")

        # ── SCENARIO 2: REJECT ──────────────────────────────────────────────
        print("\n=== SCENARIO 2: REJECT with/without remarks ===")
        # Get balance BEFORE
        r_bal_before = await client.get(f"/api/v1/leave-balances/{hrms004_id}", headers=admin_headers)
        cl_bal_before = next((b for b in r_bal_before.json()["balances"] if b["leave_type_code"] == "CL"), None)
        
        # Submit a leave
        r = await client.post("/api/v1/leave-applications", json={
            "employee_id": hrms004_id, "leave_type_code": "CL",
            "from_date": "2026-08-10", "to_date": "2026-08-10",
            "reason": "To be rejected", "address_during_leave": "Home"
        }, headers=admin_headers)
        rej_app_id = r.json()["id"]

        # Reject without remarks -> 400
        r = await client.post(f"/api/v1/leave-approvals/{rej_app_id}/action", json={"action": "REJECTED", "remarks": ""}, headers=hod_headers)
        if r.status_code != 400:
            print("  [FAIL] Reject without remarks should be 400")
            sys.exit(1)
        print("  [OK] Reject without remarks -> 400")

        # Reject with remarks -> 200
        r = await client.post(f"/api/v1/leave-approvals/{rej_app_id}/action", json={"action": "REJECTED", "remarks": "No"}, headers=hod_headers)
        ok("Reject with remarks", r, 200)
        
        r = await client.get(f"/api/v1/leave-applications/{rej_app_id}", headers=admin_headers)
        if r.json()["status"] != "REJECTED":
            print("  [FAIL] Status should be REJECTED")
            sys.exit(1)
            
        r_bal_after = await client.get(f"/api/v1/leave-balances/{hrms004_id}", headers=admin_headers)
        cl_bal_after = next((b for b in r_bal_after.json()["balances"] if b["leave_type_code"] == "CL"), None)
        
        c_b = float(cl_bal_before["closing_balance"])
        c_a = float(cl_bal_after["closing_balance"])
        a_b = float(cl_bal_before["availed"])
        a_a = float(cl_bal_after["availed"])
        if c_a != c_b or a_a != a_b:
            print(f"  [FAIL] Balance changed on reject! before: c={c_b} a={a_b}, after: c={c_a} a={a_a}")
            sys.exit(1)
        print(f"  [OK] Leave REJECTED successfully. closing_before={c_b} / closing_after={c_a} / availed_before={a_b} / availed_after={a_a}")

        # ── SCENARIO 3: MODIFIED DAYS ───────────────────────────────────────
        print("\n=== SCENARIO 3: MODIFIED days tracking ===")
        # Get balance BEFORE
        r_bal_before3 = await client.get(f"/api/v1/leave-balances/{hrms004_id}", headers=admin_headers)
        cl_bal_before3 = next((b for b in r_bal_before3.json()["balances"] if b["leave_type_code"] == "CL"), None)
        
        r = await client.post("/api/v1/leave-applications", json={
            "employee_id": hrms004_id, "leave_type_code": "CL",
            "from_date": "2026-09-01", "to_date": "2026-09-03",
            "reason": "Mod test", "address_during_leave": "Home"
        }, headers=admin_headers)
        mod_app_id = r.json()["id"]

        r = await client.post(f"/api/v1/leave-approvals/{mod_app_id}/action", json={
            "action": "MODIFIED", "modified_from_date": "2026-09-01", "modified_to_date": "2026-09-02", "modified_days": 2.0
        }, headers=hod_headers)
        ok("MODIFIED action", r, 200)
        
        # Verify that it progressed
        r = await client.get(f"/api/v1/leave-applications/{mod_app_id}", headers=admin_headers)
        if r.json()["status"] != "UNDER_REVIEW" or r.json()["current_step_order"] != 2:
            print(f"  [FAIL] Expected UNDER_REVIEW and current_step_order=2 after MODIFIED by HOD, got {r.json()['status']} / {r.json()['current_step_order']}")
            sys.exit(1)
        print("  [OK] MODIFIED correctly advanced current_step_order and set UNDER_REVIEW")
        
        r = await client.post(f"/api/v1/leave-approvals/{mod_app_id}/action", json={"action": "APPROVED", "remarks": "OK"}, headers=nodal_headers)
        ok("NODAL approve modified", r, 200)

        # Check balance
        r_bal_after3 = await client.get(f"/api/v1/leave-balances/{hrms004_id}", headers=admin_headers)
        cl_bal_after3 = next((b for b in r_bal_after3.json()["balances"] if b["leave_type_code"] == "CL"), None)
        
        c_b3 = float(cl_bal_before3["closing_balance"])
        c_a3 = float(cl_bal_after3["closing_balance"])
        a_b3 = float(cl_bal_before3["availed"])
        a_a3 = float(cl_bal_after3["availed"])
        
        if c_a3 != c_b3 - 2.0 or a_a3 != a_b3 + 2.0:
            print(f"  [FAIL] Expected closing to drop by 2 and availed to increase by 2. before: c={c_b3} a={a_b3}, after: c={c_a3} a={a_a3}")
            sys.exit(1)
        print(f"  [OK] MODIFIED balance deducted correctly. closing_before={c_b3} / closing_after={c_a3} / availed_before={a_b3} / availed_after={a_a3}")

        # ── SCENARIO 4: RECALL ──────────────────────────────────────────────
        print("\n=== SCENARIO 4: RECALL ===")
        r = await client.post(f"/api/v1/leave-approvals/{mod_app_id}/action", json={"action": "RECALLED"}, headers=hod_headers)
        # Wait, recall is a separate endpoint POST /{id}/recall, not an action in approve_action!
        r = await client.post(f"/api/v1/leave-approvals/{mod_app_id}/recall", headers=admin_headers) # Caller doesn't matter much for this test
        ok("Recall leave", r, 200)

        r = await client.get(f"/api/v1/leave-applications/{mod_app_id}", headers=admin_headers)
        if r.json()["status"] != "RECALLED":
            print("  [FAIL] Status should be RECALLED")
            sys.exit(1)

        r = await client.get(f"/api/v1/leave-balances/{hrms004_id}", headers=admin_headers)
        cl_bal = next((b for b in r.json()["balances"] if b["leave_type_code"] == "CL"), None)
        expected_closing = c_a3 + 2.0
        expected_availed = a_a3 - 2.0
        if float(cl_bal["closing_balance"]) != expected_closing:
            print(f"  [FAIL] Expected closing {expected_closing} after RECALL, got {cl_bal['closing_balance']}")
            sys.exit(1)
        if float(cl_bal["availed"]) != expected_availed:
            print(f"  [FAIL] Expected availed {expected_availed} after RECALL, got {cl_bal['availed']}")
            sys.exit(1)
        print(f"  [OK] RECALL restored balance (closing={expected_closing}, availed={expected_availed}).")

        # 🚀 GAP E: Refresh Token Invalidation 🚀
        print("\n=== GAP E: Refresh token invalidation ===")
        from sqlalchemy import create_engine, text as sa_text
        from app.core.config import settings
        sync_engine = create_engine(settings.DATABASE_URL_SYNC)
        
        with sync_engine.connect() as conn:
            valid_from_before = conn.execute(sa_text("SELECT extract(epoch from tokens_valid_from) FROM users WHERE username='HRMS004'")).scalar()

        # Login to get refresh cookie
        r = await client.post("/api/v1/auth/login", json={"username": "HRMS004", "password": "SafePassword123!"})
        refresh_cookie = r.cookies.get("refresh_token")
        if not refresh_cookie:
            print("  [FAIL] No refresh token cookie returned on login")
            sys.exit(1)
            
        # Sleep 1.1s to guarantee the new token's iat is strictly older than the new valid_from minus 1.0s skew.
        await asyncio.sleep(1.1)
        
        # Change password
        r = await client.post("/api/v1/auth/change-my-password", 
                              json={"current_password": "SafePassword123!", "new_password": "SafePassword123!"},
                              headers={"Authorization": f"Bearer {r.json()['access_token']}"})
        if r.status_code != 200:
            print(f"  [FAIL] Failed to change password, got {r.status_code}")
            sys.exit(1)
            
        with sync_engine.connect() as conn:
            valid_from_after = conn.execute(sa_text("SELECT extract(epoch from tokens_valid_from) FROM users WHERE username='HRMS004'")).scalar()
            
        if valid_from_after <= valid_from_before:
            print(f"  [FAIL] tokens_valid_from did not advance: {valid_from_before} -> {valid_from_after}")
            sys.exit(1)
        print(f"  [OK] tokens_valid_from advanced from {valid_from_before} to {valid_from_after}")
            
        # Attempt to refresh with old cookie
        r = await client.post("/api/v1/auth/refresh", cookies={"refresh_token": refresh_cookie})
        if r.status_code != 401:
            print(f"  [FAIL] Expected 401 using old refresh token, got {r.status_code}: {r.text}")
            sys.exit(1)
        print("  [OK] Old refresh token correctly invalidated")
        
        # Get fresh token and verify it works
        r = await client.post("/api/v1/auth/login", json={"username": "HRMS004", "password": "SafePassword123!"})
        new_refresh_cookie = r.cookies.get("refresh_token")
        r = await client.post("/api/v1/auth/refresh", cookies={"refresh_token": new_refresh_cookie})
        if r.status_code != 200:
            print(f"  [FAIL] Expected 200 using new refresh token, got {r.status_code}: {r.text}")
            sys.exit(1)
        print("  [OK] Fresh refresh token successfully issues new tokens\n")

        # ── SCENARIO 5: CL BUSINESS RULES ───────────────────────────────────
        print("\n=== SCENARIO 5: CL BUSINESS RULES ===")
        # 5a. CL adjacent to holiday — allowed under DoPT (weekends/holidays may attach)
        r = await client.post("/api/v1/leave-applications", json={
            "employee_id": hrms004_id, "leave_type_code": "CL",
            "from_date": "2026-07-16", "to_date": "2026-07-16",
            "reason": "Adj", "address_during_leave": "Home"
        }, headers=admin_headers)
        body = ok("CL adjacent to holiday", r, 201)
        if float(body.get("applied_days", 0)) <= 0:
            print(f"  [FAIL] Expected debited CL days > 0, got {body.get('applied_days')}")
            sys.exit(1)
        print("  [OK] CL adjacent to holiday allowed (DoPT).")

        # 5b. Exceeds max stretch
        r = await client.post("/api/v1/leave-applications", json={
            "employee_id": hrms004_id, "leave_type_code": "CL",
            "from_date": "2026-10-01", "to_date": "2026-10-10",
            "reason": "Stretch", "address_during_leave": "Home"
        }, headers=admin_headers)
        if r.status_code != 400:
            print(f"  [FAIL] CL max stretch should 400, got {r.status_code}")
            sys.exit(1)
        print("  [OK] CL max stretch rejected.")

        # 5c. Overlapping dates
        # Submit a valid leave
        r = await client.post("/api/v1/leave-applications", json={
            "employee_id": hrms004_id, "leave_type_code": "CL",
            "from_date": "2026-12-01", "to_date": "2026-12-02",
            "reason": "Overlap1", "address_during_leave": "Home"
        }, headers=admin_headers)
        ok("Valid leave 1", r, 201)
        
        # Submit overlapping leave
        r = await client.post("/api/v1/leave-applications", json={
            "employee_id": hrms004_id, "leave_type_code": "CL",
            "from_date": "2026-12-02", "to_date": "2026-12-03",
            "reason": "Overlap2", "address_during_leave": "Home"
        }, headers=admin_headers)
        if r.status_code not in (400, 409):
            print(f"  [FAIL] Overlapping leave should 400/409, got {r.status_code}")
            sys.exit(1)
        print("  [OK] Overlapping leave rejected.")

        # ── SCENARIO 6: INSUFFICIENT BALANCE ────────────────────────────────
        print("\n=== SCENARIO 6: INSUFFICIENT BALANCE ===")
        r = await client.post("/api/v1/leave-applications", json={
            "employee_id": hrms004_id, "leave_type_code": "CL",
            "from_date": "2026-12-01", "to_date": "2026-12-20", # 20 days
            "reason": "Too much", "address_during_leave": "Home"
        }, headers=admin_headers)
        if r.status_code != 400:
            print(f"  [FAIL] Insufficient balance should 400, got {r.status_code}")
            sys.exit(1)
        print("  [OK] Insufficient balance rejected.")

        # ── SCENARIO 7: MUST_CHANGE_PASSWORD ENFORCEMENT ─────────────────────
        print("\n=== SCENARIO 7: MUST_CHANGE_PASSWORD ENFORCEMENT ===")
        # Get HRMS004 user_id
        r = await client.get("/api/v1/employees?search=HRMS004", headers=admin_headers)
        hrms004_user_id = r.json()[0]["user_id"]

        # Admin resets hrms004 password
        r = await client.post("/api/v1/auth/change-password", json={
            "user_id": hrms004_user_id, "new_password": "NewStrongPassword123!"
        }, headers=admin_headers)
        ok("Admin change-password", r, 200)

        # Login to get new token
        r = await client.post("/api/v1/auth/login", json={"username": "HRMS004", "password": "NewStrongPassword123!"})
        new_staff_data = ok("Staff login after reset", r, 200)
        new_staff_headers = {"Authorization": f"Bearer {new_staff_data['access_token']}"}
        if not new_staff_data["user"]["must_change_password"]:
            print("  [FAIL] Admin reset should set must_change_password=true")
            sys.exit(1)

        from app.core.config import settings

        # Call protected route — blocked only when FORCE_PASSWORD_CHANGE_ON_LOGIN is enabled
        r = await client.get("/api/v1/leave-applications", headers=new_staff_headers)
        if settings.FORCE_PASSWORD_CHANGE_ON_LOGIN:
            if r.status_code != 403 or "PASSWORD_CHANGE_REQUIRED" not in r.text:
                print(f"  [FAIL] Expected 403 PASSWORD_CHANGE_REQUIRED, got {r.status_code}")
                sys.exit(1)
            print("  [OK] Protected route blocked with 403 PASSWORD_CHANGE_REQUIRED")
        else:
            ok("Protected route while enforcement disabled", r, 200)
            print("  [OK] must_change_password flag set (enforcement disabled in config)")

        # Wrong current password -> 400
        r = await client.post("/api/v1/auth/change-my-password", json={
            "current_password": "WrongPassword!", "new_password": "AnotherNewPassword123!"
        }, headers=new_staff_headers)
        if r.status_code != 400:
            print(f"  [FAIL] Expected 400 for wrong current password, got {r.status_code}")
            sys.exit(1)
        print("  [OK] Wrong current password rejected")

        # Correct password change
        r = await client.post("/api/v1/auth/change-my-password", json={
            "current_password": "NewStrongPassword123!", "new_password": "AnotherNewPassword123!"
        }, headers=new_staff_headers)
        ok("Self change-my-password", r, 200)

        # Re-login to get updated user token
        r = await client.post("/api/v1/auth/login", json={"username": "HRMS004", "password": "AnotherNewPassword123!"})
        final_staff_data = ok("Staff login after self change", r, 200)
        final_staff_headers = {"Authorization": f"Bearer {final_staff_data['access_token']}"}
        if final_staff_data["user"]["must_change_password"]:
            print("  [FAIL] must_change_password should be false after self change")
            sys.exit(1)

        # Re-call protected route -> 200
        r = await client.get("/api/v1/leave-applications", headers=final_staff_headers)
        ok("Protected route after self change", r, 200)
        print("  [OK] must_change_password cleared after self-service change")

        # ── DONE ────────────────────────────────────────────────────────────
        print("\n" + "=" * 65)
        print("  ALL E2E STEPS PASSED  (S0-S12, Gaps A, B, C, D)")
        print("=" * 65)
        print("\nPASS/FAIL summary:")
        print("  S0  workflow_seed_admin -> 401                         PASS")
        print("  S1  admin login                                        PASS")
        print("  S2a create 3 approver users                            PASS")
        print("  S2b create depts/designations/employees + STAFF login  PASS")
        print("  S2c create holiday 2026-07-15                          PASS")
        print("  S3  opening balance CL=8                               PASS")
        print("  S4  closing_balance==8 after 1st opening               PASS")
        print("  GA  closing_balance==8 after 2nd opening (idempotent)  PASS")
        print("  GB  dept/desig/emp/holiday dupe -> 409                 PASS")
        print("  S5  submit leave application applied_days==2           PASS")
        print("  GC  STAFF GET /leave-applications -> 200               PASS")
        print("  S6  HOD approve -> UNDER_REVIEW                        PASS")
        print("  S7  NODAL approve (final) -> APPROVED                      PASS")
        print("  S9  closing_balance==6, availed==2                     PASS")
        print("  S10 leave-register report                              PASS")
        print("  S11 payroll-export CSV                                 PASS")
        print("  S12 sanction PDF %PDF header, >1000 bytes             PASS")


if __name__ == "__main__":
    asyncio.run(main())


def test_e2e_harness() -> None:
    asyncio.run(main())
