"""Phase 8 security hardening proof checks."""

import asyncio
import io
import os
import sys
from datetime import datetime, timedelta

import httpx
from openpyxl import Workbook
from sqlalchemy import create_engine, text

from app.auth.jwt import hash_password
from app.core.config import settings

BASE = "http://testserver"


def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    sys.exit(1)


def sync_execute(sql: str, params: dict | None = None):
    engine = create_engine(settings.DATABASE_URL_SYNC)
    with engine.connect() as conn:
        result = conn.execute(text(sql), params or {})
        conn.commit()
        return result


def reset_staff_account() -> None:
    sync_execute(
        """
        UPDATE users
        SET password_hash = :password_hash,
            failed_login_attempts = 0,
            locked_until = NULL,
            must_change_password = false,
            is_active = true
        WHERE username = 'staff'
        """,
        {"password_hash": hash_password("password")},
    )


def reset_admin_account() -> None:
    sync_execute(
        """
        UPDATE users
        SET password_hash = :password_hash,
            failed_login_attempts = 0,
            locked_until = NULL,
            must_change_password = false,
            is_active = true
        WHERE username = 'admin'
        """,
        {"password_hash": hash_password("password")},
    )



def get_staff_lock_state() -> tuple[int, object]:
    row = sync_execute(
        "SELECT failed_login_attempts, locked_until FROM users WHERE username = 'staff'"
    ).fetchone()
    if not row:
        fail("Seeded 'staff' user missing")
    return int(row[0] or 0), row[1]


async def login_with_ip(username: str, password: str, ip: str) -> httpx.Response:
    from main import app

    transport = httpx.ASGITransport(app=app, client=(ip, 5000))
    async with httpx.AsyncClient(transport=transport, base_url=BASE) as client:
        return await client.post("/api/v1/auth/login", json={"username": username, "password": password})


async def admin_headers(ip: str) -> dict[str, str]:
    response = await login_with_ip("admin", "password", ip)
    if response.status_code != 200:
        fail(f"Admin login failed for proof setup: HTTP {response.status_code}, body={response.text}")
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def main() -> None:
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    print("\n=== Phase 8 Security Proof ===")
    
    # Explicitly enable rate limiting for the security proof checks
    from app.core.rate_limit import limiter
    limiter.enabled = True

    from main import app

    print("\n--- Lockout check ---")
    reset_admin_account()
    reset_staff_account()
    for index in range(5):
        response = await login_with_ip("staff", "wrong-pass", f"10.0.1.{index + 1}")
        if response.status_code != 401:
            fail(f"Lockout setup attempt {index + 1}: expected 401, got {response.status_code}")
    attempts, locked_until = get_staff_lock_state()
    if attempts != 5 or locked_until is None:
        fail(f"Lockout state incorrect after 5 failures: attempts={attempts}, locked_until={locked_until}")
    print(f"[OK] After 5 failures: failed_login_attempts={attempts}, locked_until={locked_until}")

    sixth = await login_with_ip("staff", "password", "10.0.1.6")
    if sixth.status_code != 429:
        fail(f"6th attempt should be locked: got HTTP {sixth.status_code}")
    print(f"[OK] 6th attempt returns lockout HTTP {sixth.status_code}")

    sync_execute(
        "UPDATE users SET locked_until = :locked_until WHERE username = 'staff'",
        {"locked_until": datetime.utcnow() - timedelta(minutes=1)},
    )
    success = await login_with_ip("staff", "password", "10.0.1.7")
    if success.status_code != 200:
        fail(f"Successful login after lock expiry/reset failed: HTTP {success.status_code}, body={success.text}")
    attempts, locked_until = get_staff_lock_state()
    if attempts != 0 or locked_until is not None:
        fail(f"Successful login did not reset lock state: attempts={attempts}, locked_until={locked_until}")
    print("[OK] Successful login resets failed_login_attempts=0 and locked_until=NULL")

    print("\n--- Password complexity check ---")
    headers = await admin_headers("10.0.2.1")
    weak_reset_transport = httpx.ASGITransport(app=app, client=("10.0.2.2", 5001))
    async with httpx.AsyncClient(transport=weak_reset_transport, base_url=BASE) as client:
        weak_reset = await client.post(
            "/api/v1/auth/change-password",
            json={"user_id": str(success.json()["user"]["id"]), "new_password": "weakpass"},
            headers=headers,
        )
    if weak_reset.status_code not in (400, 422):
        fail(f"Weak password reset should be rejected: got HTTP {weak_reset.status_code}")
    print(f"[OK] Weak password rejected on admin reset: HTTP {weak_reset.status_code}")

    print("\n--- Rate limit check ---")
    for index in range(5):
        response = await login_with_ip("ghost-user", "bad-pass", "10.0.3.1")
        if response.status_code != 401:
            fail(f"Rate-limit setup attempt {index + 1}: expected 401, got {response.status_code}")
    sixth_rate = await login_with_ip("ghost-user", "bad-pass", "10.0.3.1")
    if sixth_rate.status_code != 429:
        fail(f"6th login within a minute should rate-limit: got HTTP {sixth_rate.status_code}")
    print("[OK] 6th /auth/login within a minute returns HTTP 429")

    print("\n--- Upload validation check ---")
    upload_headers = await admin_headers("10.0.4.1")

    wrong_csv_transport = httpx.ASGITransport(app=app, client=("10.0.4.2", 5002))
    async with httpx.AsyncClient(transport=wrong_csv_transport, base_url=BASE) as client:
        wrong_csv = await client.post(
            "/api/v1/employees/import",
            files={"file": ("employees.txt", b"bad", "text/plain")},
            headers=upload_headers,
        )
    if wrong_csv.status_code != 400:
        fail(f"Wrong CSV type should be rejected with 400: got {wrong_csv.status_code}")
    print("[OK] Wrong employees/import type rejected with HTTP 400")

    oversized_csv_transport = httpx.ASGITransport(app=app, client=("10.0.4.3", 5003))
    async with httpx.AsyncClient(transport=oversized_csv_transport, base_url=BASE) as client:
        oversized_csv = await client.post(
            "/api/v1/employees/import",
            files={"file": ("employees.csv", b"x" * (6 * 1024 * 1024), "text/csv")},
            headers=upload_headers,
        )
    if oversized_csv.status_code != 400:
        fail(f"Oversized CSV should be rejected with 400: got {oversized_csv.status_code}")
    print("[OK] Oversized employees/import rejected with HTTP 400")

    wrong_xlsx_transport = httpx.ASGITransport(app=app, client=("10.0.4.4", 5004))
    async with httpx.AsyncClient(transport=wrong_xlsx_transport, base_url=BASE) as client:
        wrong_xlsx = await client.post(
            "/api/v1/leave-balances/opening/import",
            files={"file": ("opening.csv", b"bad", "text/csv")},
            headers=upload_headers,
        )
    if wrong_xlsx.status_code != 400:
        fail(f"Wrong XLSX type should be rejected with 400: got {wrong_xlsx.status_code}")
    print("[OK] Wrong opening/import type rejected with HTTP 400")

    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["emp_code", "leave_type_code", "opening_balance"])
    sheet.append(["TEST_STAFF", "EL", 10])
    workbook_bytes = io.BytesIO()
    workbook.save(workbook_bytes)
    padded = workbook_bytes.getvalue() + (b"0" * (6 * 1024 * 1024))
    oversized_xlsx_transport = httpx.ASGITransport(app=app, client=("10.0.4.5", 5005))
    async with httpx.AsyncClient(transport=oversized_xlsx_transport, base_url=BASE) as client:
        oversized_xlsx = await client.post(
            "/api/v1/leave-balances/opening/import",
            files={
                "file": (
                    "opening.xlsx",
                    padded,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            headers=upload_headers,
        )
    if oversized_xlsx.status_code != 400:
        fail(f"Oversized XLSX should be rejected with 400: got {oversized_xlsx.status_code}")
    print("[OK] Oversized opening/import rejected with HTTP 400")

    print("\nPHASE 8 SECURITY PROOF PASSED")


if __name__ == "__main__":
    asyncio.run(main())


def test_security() -> None:
    asyncio.run(main())
