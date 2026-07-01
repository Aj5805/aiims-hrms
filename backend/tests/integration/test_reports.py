"""Phase 6/7/8 report and admin proof checks."""

import asyncio
import os
import sys

import httpx

BASE = "http://testserver"


def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    sys.exit(1)


async def expect_status(response: httpx.Response, expected: int, label: str) -> None:
    if response.status_code != expected:
        fail(f"{label}: expected HTTP {expected}, got {response.status_code}, body={response.text[:500]}")
    print(f"[OK] {label}: HTTP {response.status_code}")


async def login(client: httpx.AsyncClient, username: str, password: str) -> dict[str, str]:
    response = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    await expect_status(response, 200, f"login {username}")
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def expect_report(
    client: httpx.AsyncClient,
    path: str,
    headers: dict[str, str],
    expected_content_type: str,
    label: str,
) -> None:
    response = await client.get(path, headers=headers)
    await expect_status(response, 200, label)
    content_type = response.headers.get("content-type", "")
    if expected_content_type not in content_type:
        fail(f"{label}: expected content-type containing {expected_content_type!r}, got {content_type!r}")
    if len(response.content) == 0:
        fail(f"{label}: response body was empty")
    print(f"[OK] {label}: content-type={content_type}, bytes={len(response.content)}")


async def expect_forbidden(client: httpx.AsyncClient, path: str, headers: dict[str, str], label: str) -> None:
    response = await client.get(path, headers=headers)
    await expect_status(response, 403, label)


async def main() -> None:
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    from app.core.config import settings
    from app.auth.jwt import hash_password
    from sqlalchemy import create_engine, text

    engine = create_engine(settings.DATABASE_URL_SYNC)
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE users SET password_hash = :ph, failed_login_attempts = 0, locked_until = NULL, must_change_password = false WHERE username = 'admin'"),
            {"ph": hash_password("password")},
        )
        conn.commit()

    from main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url=BASE) as client:
        estab_headers = await login(client, "estab", "password")
        registrar_headers = await login(client, "registrar", "password")
        admin_headers = await login(client, "admin", "password")

        await expect_report(
            client,
            "/api/v1/reports/leave-register?from_date=2026-07-01&to_date=2026-07-31&format=xlsx",
            estab_headers,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "leave-register xlsx allowed role",
        )
        await expect_forbidden(
            client,
            "/api/v1/reports/leave-register?from_date=2026-07-01&to_date=2026-07-31&format=xlsx",
            admin_headers,
            "leave-register disallowed admin",
        )

        await expect_report(
            client,
            "/api/v1/reports/leave-abstract?from_date=2026-07-01&to_date=2026-07-31",
            estab_headers,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "leave-abstract xlsx allowed role",
        )
        await expect_forbidden(
            client,
            "/api/v1/reports/leave-abstract?from_date=2026-07-01&to_date=2026-07-31",
            admin_headers,
            "leave-abstract disallowed admin",
        )

        await expect_report(
            client,
            "/api/v1/reports/pending-applications",
            estab_headers,
            "application/pdf",
            "pending-applications pdf allowed role",
        )
        await expect_forbidden(
            client,
            "/api/v1/reports/pending-applications",
            admin_headers,
            "pending-applications disallowed admin",
        )

        await expect_report(
            client,
            "/api/v1/reports/balance-summary?as_of_date=2026-07-31",
            estab_headers,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "balance-summary xlsx allowed role",
        )
        await expect_forbidden(
            client,
            "/api/v1/reports/balance-summary?as_of_date=2026-07-31",
            admin_headers,
            "balance-summary disallowed admin",
        )

        await expect_report(
            client,
            "/api/v1/reports/leave-calendar?month=2026-07",
            estab_headers,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "leave-calendar xlsx allowed role",
        )
        await expect_forbidden(
            client,
            "/api/v1/reports/leave-calendar?month=2026-07",
            admin_headers,
            "leave-calendar disallowed admin",
        )

        await expect_report(
            client,
            "/api/v1/reports/payroll-export?from_date=2026-07-01&to_date=2026-07-31&export_type=LOP",
            registrar_headers,
            "text/csv",
            "payroll-export csv allowed registrar",
        )
        await expect_forbidden(
            client,
            "/api/v1/reports/payroll-export?from_date=2026-07-01&to_date=2026-07-31&export_type=LOP",
            admin_headers,
            "payroll-export disallowed admin",
        )

        admin_health = await client.get("/api/v1/admin/health-dashboard", headers=admin_headers)
        await expect_status(admin_health, 200, "health-dashboard admin")
        health_payload = admin_health.json()
        for key in ("queue_depth", "db_pool_size", "db_pool_checked_in", "recent_errors_24h", "error_rate", "last_backup"):
            if key not in health_payload:
                fail(f"health-dashboard missing key {key}")
        print(f"[OK] health-dashboard keys present: {sorted(health_payload.keys())}")

        audit_response = await client.get(
            "/api/v1/admin/audit-log?from_date=2026-01-01&to_date=2026-12-31&limit=5",
            headers=admin_headers,
        )
        await expect_status(audit_response, 200, "audit-log with date range")

    print("\nPHASE 7/8 REPORT PROOF PASSED")


if __name__ == "__main__":
    asyncio.run(main())


def test_reports() -> None:
    asyncio.run(main())
