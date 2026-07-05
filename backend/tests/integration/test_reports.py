"""Phase 6/7/8 report and admin proof checks."""

import asyncio
import os
import sys

import httpx

from tests.helpers import ensure_journey_users, expect_status, login, set_admin_password

BASE = "http://testserver"


def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    sys.exit(1)


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


async def expect_json_preview(
    client: httpx.AsyncClient,
    path: str,
    headers: dict[str, str],
    label: str,
) -> None:
    response = await client.get(path, headers=headers)
    body = await expect_status(response, 200, label)
    if not isinstance(body, (list, dict)):
        fail(f"{label}: expected JSON object or array")
    print(f"[OK] {label}: json preview rows={len(body) if isinstance(body, list) else 'object'}")


async def expect_forbidden(client: httpx.AsyncClient, path: str, headers: dict[str, str], label: str) -> None:
    response = await client.get(path, headers=headers)
    await expect_status(response, 403, label)


async def main() -> None:
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    set_admin_password("password")
    ensure_journey_users(staff_must_change_password=False)

    from main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url=BASE) as client:
        nodal_headers = await login(client, "nodal", "password")
        staff_headers = await login(client, "staff", "password")
        admin_headers = await login(client, "admin", "password")

        await expect_report(
            client,
            "/api/v1/reports/leave-register?from_date=2026-07-01&to_date=2026-07-31&format=xlsx",
            nodal_headers,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "leave-register xlsx nodal officer",
        )
        await expect_json_preview(
            client,
            "/api/v1/reports/leave-register?from_date=2026-07-01&to_date=2026-07-31&format=json",
            nodal_headers,
            "leave-register json preview",
        )
        await expect_forbidden(
            client,
            "/api/v1/reports/leave-register?from_date=2026-07-01&to_date=2026-07-31&format=xlsx",
            staff_headers,
            "leave-register disallowed staff",
        )

        await expect_report(
            client,
            "/api/v1/reports/leave-abstract?from_date=2026-07-01&to_date=2026-07-31",
            nodal_headers,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "leave-abstract xlsx nodal officer",
        )

        await expect_report(
            client,
            "/api/v1/reports/pending-applications",
            nodal_headers,
            "application/pdf",
            "pending-applications pdf nodal officer",
        )

        await expect_report(
            client,
            "/api/v1/reports/balance-summary?as_of_date=2026-07-31",
            nodal_headers,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "balance-summary xlsx nodal officer",
        )

        await expect_report(
            client,
            "/api/v1/reports/leave-calendar?month=2026-07",
            nodal_headers,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "leave-calendar xlsx nodal officer",
        )

        await expect_report(
            client,
            "/api/v1/reports/payroll-export?from_date=2026-07-01&to_date=2026-07-31&export_type=LOP",
            nodal_headers,
            "text/csv",
            "payroll-export csv nodal officer",
        )

        admin_health = await client.get("/api/v1/admin/health-dashboard", headers=admin_headers)
        await expect_status(admin_health, 200, "health-dashboard admin")
        health_payload = admin_health.json()
        for key in ("queue_depth", "db_pool_size", "db_pool_checked_in", "recent_errors_24h", "error_rate", "last_backup"):
            if key not in health_payload:
                fail(f"health-dashboard missing key {key}")
        print(f"[OK] health-dashboard keys present: {sorted(health_payload.keys())}")

        summary = await client.get("/api/v1/admin/summary", headers=admin_headers)
        await expect_status(summary, 200, "admin summary")
        summary_payload = summary.json()
        for key in ("employees", "users", "workflow", "hod"):
            if key not in summary_payload:
                fail(f"admin summary missing key {key}")
        print(f"[OK] admin summary keys present: {sorted(summary_payload.keys())}")

        audit_response = await client.get(
            "/api/v1/admin/audit-log?from_date=2026-01-01&to_date=2026-12-31&limit=5",
            headers=admin_headers,
        )
        await expect_status(audit_response, 200, "audit-log with date range")

    print("\nREPORT PROOF PASSED")


if __name__ == "__main__":
    asyncio.run(main())


def test_reports() -> None:
    asyncio.run(main())
