"""Phase 5 leave-balance verification on a clean schema."""

import asyncio
import json
import os
import sys
from typing import Any

import httpx
from sqlalchemy import create_engine, text as sa_text

BASE = "http://testserver"
ADMIN_USER = "admin"
ADMIN_PASS = "E2eAdmin#123"


def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    sys.exit(1)


def assert_equal(actual: Any, expected: Any, label: str) -> None:
    if actual != expected:
        fail(f"{label}: expected {expected!r}, got {actual!r}")
    print(f"[OK] {label}: {actual!r}")


def assert_true(condition: bool, label: str) -> None:
    if not condition:
        fail(label)
    print(f"[OK] {label}")


def set_deterministic_admin_password() -> None:
    from app.auth.jwt import hash_password
    from app.core.config import settings

    engine = create_engine(settings.DATABASE_URL_SYNC)
    with engine.connect() as conn:
        # Clean up stale data from previous Phase 5 test runs to ensure repeatability
        conn.execute(sa_text("DELETE FROM leave_approvals WHERE application_id IN (SELECT id FROM leave_applications WHERE employee_id IN (SELECT id FROM employees WHERE emp_code LIKE 'HRMS40%'))"))
        conn.execute(sa_text("DELETE FROM leave_applications WHERE employee_id IN (SELECT id FROM employees WHERE emp_code LIKE 'HRMS40%')"))
        conn.execute(sa_text("DELETE FROM leave_balances WHERE employee_id IN (SELECT id FROM employees WHERE emp_code LIKE 'HRMS40%') OR leave_year IN (2027, 2028)"))
        conn.execute(sa_text("DELETE FROM users WHERE employee_id IN (SELECT id FROM employees WHERE emp_code LIKE 'HRMS40%')"))
        conn.execute(sa_text("DELETE FROM employees WHERE emp_code LIKE 'HRMS40%'"))
        conn.execute(sa_text("DELETE FROM holiday_master WHERE holiday_name = 'Projection Test Holiday'"))
        conn.execute(sa_text("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, is_active = true"))

        result = conn.execute(
            sa_text(
                "UPDATE users SET password_hash = :ph, must_change_password = false "
                "WHERE username = 'admin' AND is_active = true"
            ),
            {"ph": hash_password(ADMIN_PASS)},
        )
        conn.commit()
    if result.rowcount != 1:
        fail("Unable to set deterministic admin password")
    print(f"[OK] admin password set to {ADMIN_PASS}")


def query_one(sql: str, params: dict[str, Any]) -> dict[str, Any] | None:
    from app.core.config import settings

    engine = create_engine(settings.DATABASE_URL_SYNC)
    with engine.connect() as conn:
        row = conn.execute(sa_text(sql), params).mappings().first()
        return dict(row) if row else None


def query_scalar(sql: str, params: dict[str, Any]) -> Any:
    from app.core.config import settings

    engine = create_engine(settings.DATABASE_URL_SYNC)
    with engine.connect() as conn:
        return conn.execute(sa_text(sql), params).scalar()


async def expect_status(response: httpx.Response, expected: int, label: str) -> Any:
    try:
        body = response.json()
    except Exception:
        body = response.text[:1000]
    if response.status_code != expected:
        fail(f"{label}: HTTP {response.status_code}, expected {expected}, body={json.dumps(body, default=str)}")
    print(f"[OK] {label}: HTTP {response.status_code}")
    return body


async def ensure_department(client: httpx.AsyncClient, headers: dict[str, str], code: str, name: str) -> None:
    response = await client.post(
        "/api/v1/departments",
        json={"code": code, "name": name, "managing_office": "ESTABLISHMENT"},
        headers=headers,
    )
    if response.status_code not in (201, 409):
        await expect_status(response, 201, f"create department {code}")


async def ensure_designation(client: httpx.AsyncClient, headers: dict[str, str], name: str) -> None:
    response = await client.post(
        "/api/v1/designations",
        json={"name": name, "grade_pay_level": "Level-7"},
        headers=headers,
    )
    if response.status_code not in (201, 409):
        await expect_status(response, 201, f"create designation {name}")


async def ensure_employee(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    emp_code: str,
    name: str,
    category_code: str,
) -> str:
    payload = {
        "emp_code": emp_code,
        "name": name,
        "gender": "MALE",
        "doj": "2018-08-20",
        "category_code": category_code,
        "department_code": "EST",
        "designation_name": "Section Officer",
    }
    response = await client.post("/api/v1/employees", json=payload, headers=headers)
    if response.status_code == 201:
        data = response.json()
        print(f"[OK] create employee {emp_code}: HTTP 201")
        return data["id"]
    if response.status_code != 409:
        await expect_status(response, 201, f"create employee {emp_code}")

    list_response = await client.get(f"/api/v1/employees?search={emp_code}", headers=headers)
    items = await expect_status(list_response, 200, f"lookup employee {emp_code}")
    match = next((item for item in items if item["emp_code"] == emp_code), None)
    if not match:
        fail(f"Employee {emp_code} missing after 409")
    print(f"[OK] employee {emp_code} already exists")
    return match["id"]


async def main() -> None:
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    set_deterministic_admin_password()

    from main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url=BASE) as client:
        login = await client.post("/api/v1/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
        login_body = await expect_status(login, 200, "admin login")
        headers = {"Authorization": f"Bearer {login_body['access_token']}"}

        await ensure_department(client, headers, "EST", "Establishment")
        await ensure_designation(client, headers, "Section Officer")

        admin_emp_id = await ensure_employee(client, headers, "HRMS401", "Phase5 Admin", "ADMIN")
        await ensure_employee(client, headers, "HRMS402", "Phase5 Faculty", "FACULTY")
        el_type = query_one("SELECT id FROM leave_types WHERE code = 'EL'", {})
        if not el_type:
            fail("EL leave type not seeded")

        holiday = await client.post(
            "/api/v1/holiday-master",
            json={
                "year": 2028,
                "holiday_date": "2028-04-12",
                "holiday_name": "Projection Test Holiday",
                "holiday_type": "GAZETTED",
                "applicable_to": "ALL",
            },
            headers=headers,
        )
        if holiday.status_code not in (201, 409):
            await expect_status(holiday, 201, "create projection holiday")

        opening = await client.post(
            "/api/v1/leave-balances/opening",
            json=[
                {"emp_code": "HRMS401", "leave_type_code": "EL", "opening_balance": 290},
                {"emp_code": "HRMS401", "leave_type_code": "HPL", "opening_balance": 40},
                {"emp_code": "HRMS402", "leave_type_code": "EL", "opening_balance": 100},
                {"emp_code": "HRMS402", "leave_type_code": "HPL", "opening_balance": 10},
            ],
            headers=headers,
        )
        await expect_status(opening, 200, "seed opening balances")

        annual = await client.post(
            "/api/v1/leave-balances/credit/annual",
            json={"year_start": "2027-01-01", "leave_year": 2027},
            headers=headers,
        )
        annual_body = await expect_status(annual, 200, "annual credit 2027")
        expected_annual_rows = int(query_scalar("""
            SELECT COUNT(*)
            FROM employees e
            JOIN employee_categories c ON c.id = e.category_id
            JOIN leave_entitlement_rules ler ON ler.category_id = c.id
            JOIN leave_types lt ON lt.id = ler.leave_type_id
            WHERE ler.year_ref = 'CALENDAR'
              AND (
                COALESCE(ler.days_per_year, 0) > 0
                OR COALESCE(ler.prorata_rate, 0) > 0
              )
        """, {}))
        assert_equal(annual_body["rows_affected"], expected_annual_rows, "annual credit inserted rows")

        admin_2027_el = query_one(
            """
            SELECT opening_balance, credited, closing_balance
            FROM leave_balances lb
            JOIN employees e ON e.id = lb.employee_id
            JOIN leave_types lt ON lt.id = lb.leave_type_id
            WHERE e.emp_code = 'HRMS401' AND lt.code = 'EL' AND lb.leave_year = 2027
            """,
            {},
        )
        admin_2027_hpl = query_one(
            """
            SELECT opening_balance, credited, closing_balance
            FROM leave_balances lb
            JOIN employees e ON e.id = lb.employee_id
            JOIN leave_types lt ON lt.id = lb.leave_type_id
            WHERE e.emp_code = 'HRMS401' AND lt.code = 'HPL' AND lb.leave_year = 2027
            """,
            {},
        )
        assert_true(admin_2027_el is not None, "EL 2027 row exists after annual credit")
        assert_true(admin_2027_hpl is not None, "HPL 2027 row exists after annual credit")
        assert_equal(float(admin_2027_el["opening_balance"]), 290.0, "EL opening carried from prior closing")
        assert_equal(float(admin_2027_el["credited"]), 15.0, "EL H1 half-yearly credit amount")
        assert_equal(float(admin_2027_el["closing_balance"]), 305.0, "EL closing after H1 credit")

        annual_h2 = await client.post(
            "/api/v1/leave-balances/credit/annual",
            json={"year_start": "2027-07-01", "leave_year": 2027, "credit_period": 2},
            headers=headers,
        )
        await expect_status(annual_h2, 200, "annual credit H2 2027")

        admin_2027_el = query_one(
            """
            SELECT opening_balance, credited, closing_balance
            FROM leave_balances lb
            JOIN employees e ON e.id = lb.employee_id
            JOIN leave_types lt ON lt.id = lb.leave_type_id
            WHERE e.emp_code = 'HRMS401' AND lt.code = 'EL' AND lb.leave_year = 2027
            """,
            {},
        )
        assert_equal(float(admin_2027_el["credited"]), 30.0, "EL full year after H2 credit")
        assert_equal(float(admin_2027_el["closing_balance"]), 320.0, "EL closing after full year credit")
        assert_equal(float(admin_2027_hpl["opening_balance"]), 40.0, "HPL opening carried from prior closing")
        assert_equal(float(admin_2027_hpl["credited"]), 20.0, "HPL annual credit amount")
        assert_equal(float(admin_2027_hpl["closing_balance"]), 60.0, "HPL closing after annual credit")

        annual_again = await client.post(
            "/api/v1/leave-balances/credit/annual",
            json={"year_start": "2027-01-01", "leave_year": 2027},
            headers=headers,
        )
        annual_again_body = await expect_status(annual_again, 200, "annual credit rerun 2027")
        assert_equal(annual_again_body["rows_affected"], 0, "annual credit idempotent rerun")

        carry = await client.post(
            "/api/v1/leave-balances/carryforward",
            json={"source_year": 2027, "target_year": 2028, "year_start": "2028-01-01"},
            headers=headers,
        )
        carry_body = await expect_status(carry, 200, "carry-forward 2027->2028")
        expected_carry_rows = int(query_scalar("""
            SELECT COUNT(*)
            FROM leave_balances lb
            JOIN leave_types lt ON lt.id = lb.leave_type_id
            WHERE lb.leave_year = 2027 AND lt.carry_forward = true
        """, {}))
        assert_equal(carry_body["rows_affected"], expected_carry_rows, "carry-forward inserted eligible rows only")

        admin_2028_el = query_one(
            """
            SELECT opening_balance, credited, closing_balance, lb.id
            FROM leave_balances lb
            JOIN employees e ON e.id = lb.employee_id
            JOIN leave_types lt ON lt.id = lb.leave_type_id
            WHERE e.emp_code = 'HRMS401' AND lt.code = 'EL' AND lb.leave_year = 2028
            """,
            {},
        )
        admin_2028_hpl = query_one(
            """
            SELECT lb.id
            FROM leave_balances lb
            JOIN employees e ON e.id = lb.employee_id
            JOIN leave_types lt ON lt.id = lb.leave_type_id
            WHERE e.emp_code = 'HRMS401' AND lt.code = 'HPL' AND lb.leave_year = 2028
            """,
            {},
        )
        assert_true(admin_2028_el is not None, "EL 2028 carry-forward row exists")
        assert_equal(float(admin_2028_el["opening_balance"]), 300.0, "EL carry-forward capped at 300")
        assert_equal(float(admin_2028_el["credited"]), 0.0, "carry-forward row has zero credited")
        assert_true(admin_2028_hpl is None, "HPL does not carry forward")

        no_reason = await client.put(
            f"/api/v1/leave-balances/{admin_2028_el['id']}/manual-adjust",
            json={"field": "credited", "amount": 5},
            headers=headers,
        )
        await expect_status(no_reason, 400, "manual adjust requires reason")

        adjust = await client.put(
            f"/api/v1/leave-balances/{admin_2028_el['id']}/manual-adjust",
            json={"field": "credited", "amount": 5, "reason": "Phase 5 test adjustment"},
            headers=headers,
        )
        await expect_status(adjust, 200, "manual adjust with reason")

        adjusted_row = query_one(
            "SELECT credited, closing_balance FROM leave_balances WHERE id = :bid",
            {"bid": admin_2028_el["id"]},
        )
        assert_equal(float(adjusted_row["credited"]), 5.0, "manual adjust updates credited")
        assert_equal(float(adjusted_row["closing_balance"]), 305.0, "manual adjust updates closing balance")

        audit_row = query_one(
            """
            SELECT after_state
            FROM audit_log
            WHERE entity_type = 'leave_balance' AND entity_id = :bid
            ORDER BY created_at DESC
            LIMIT 1
            """,
            {"bid": admin_2028_el["id"]},
        )
        assert_true(audit_row is not None, "manual adjust audit row created")
        audit_payload = audit_row["after_state"]
        if isinstance(audit_payload, str):
            audit_payload = json.loads(audit_payload)
        assert_equal(audit_payload["reason"], "Phase 5 test adjustment", "audit payload includes reason")

        ledger = await client.get(
            f"/api/v1/leave-balances/{admin_emp_id}/ledger/{el_type['id']}",
            headers=headers,
        )
        ledger_body = await expect_status(ledger, 200, "EL ledger")
        manual_events = [entry for entry in ledger_body["transactions"] if entry["entry_type"] == "manual_adjustment"]
        assert_true(len(manual_events) >= 1, "ledger exposes manual adjustment events")
        assert_equal(manual_events[-1]["reason"], "Phase 5 test adjustment", "ledger manual adjustment reason")

        project_before = query_one(
            "SELECT closing_balance FROM leave_balances WHERE id = :bid",
            {"bid": admin_2028_el["id"]},
        )
        projection = await client.get(
            f"/api/v1/leave-balances/{admin_emp_id}/project",
            params={"from_date": "2028-04-10", "to_date": "2028-04-14", "leave_type_code": "EL"},
            headers=headers,
        )
        projection_body = await expect_status(projection, 200, "projection first call")
        assert_equal(float(projection_body["current_balance"]), 305.0, "projection reads current balance")
        assert_equal(projection_body["requested_days"], 4, "projection excludes holiday from working days")
        assert_equal(float(projection_body["projected_balance"]), 301.0, "projection computes hypothetical balance")
        assert_equal(projection_body["cached"], False, "projection first call is uncached")

        projection_cached = await client.get(
            f"/api/v1/leave-balances/{admin_emp_id}/project",
            params={"from_date": "2028-04-10", "to_date": "2028-04-14", "leave_type_code": "EL"},
            headers=headers,
        )
        projection_cached_body = await expect_status(projection_cached, 200, "projection second call")
        assert_equal(projection_cached_body["cached"], True, "projection second call served from cache")

        project_after = query_one(
            "SELECT closing_balance FROM leave_balances WHERE id = :bid",
            {"bid": admin_2028_el["id"]},
        )
        assert_equal(
            float(project_before["closing_balance"]),
            float(project_after["closing_balance"]),
            "projection does not mutate stored balance",
        )

    print("\nPHASE 5 BACKEND TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(main())


def test_leave_balances() -> None:
    asyncio.run(main())
