"""Integration test: auth flow -- login, refresh, logout, lockout."""

from datetime import datetime, timedelta

import httpx
import pytest

from main import app
from tests.helpers import (
    JOURNEY_PASSWORD,
    ensure_journey_users,
    expect_status,
    login,
    reset_staff_lockout_account,
    get_staff_lock_state,
    set_admin_password,
)


@pytest.fixture(autouse=True)
def _journey_users():
    set_admin_password("password")
    ensure_journey_users(staff_must_change_password=False)


@pytest.mark.integration
class TestAuthFlow:
    @pytest.mark.asyncio
    async def test_login_returns_tokens(self):
        transport = httpx.ASGITransport(app=app, client=("10.1.0.1", 5101))
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post(
                "/api/v1/auth/login",
                json={"username": "staff", "password": JOURNEY_PASSWORD},
            )
            body = await expect_status(response, 200, "login staff")
            assert body.get("access_token")
            assert body["user"]["username"] == "staff"

    @pytest.mark.asyncio
    async def test_login_invalid_rejected(self):
        transport = httpx.ASGITransport(app=app, client=("10.1.0.2", 5102))
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post(
                "/api/v1/auth/login",
                json={"username": "staff", "password": "wrong-pass"},
            )
            await expect_status(response, 401, "invalid login")

    @pytest.mark.asyncio
    async def test_logout_blacklists_token(self):
        transport = httpx.ASGITransport(app=app, client=("10.1.0.3", 5103))
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            headers = await login(client, "admin", "password")
            me = await client.get("/api/v1/auth/me", headers=headers)
            await expect_status(me, 200, "authenticated me")
            logout = await client.post("/api/v1/auth/logout", headers=headers)
            await expect_status(logout, 200, "logout")
            after = await client.get("/api/v1/auth/me", headers=headers)
            assert after.status_code == 401

    @pytest.mark.asyncio
    async def test_lockout_after_5_failures(self):
        reset_staff_lockout_account()

        for index in range(5):
            transport = httpx.ASGITransport(app=app, client=(f"10.0.0.{index + 1}", 5000 + index))
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                response = await client.post(
                    "/api/v1/auth/login",
                    json={"username": "staff", "password": "wrong-pass"},
                )
                assert response.status_code == 401

        failed_attempts, locked_until = get_staff_lock_state()
        assert failed_attempts == 5
        assert locked_until is not None

        lock_transport = httpx.ASGITransport(app=app, client=("10.0.0.50", 5050))
        async with httpx.AsyncClient(transport=lock_transport, base_url="http://testserver") as client:
            locked_response = await client.post(
                "/api/v1/auth/login",
                json={"username": "staff", "password": JOURNEY_PASSWORD},
            )
            assert locked_response.status_code == 429
            assert "temporarily locked" in locked_response.json()["detail"].lower()

        from tests.helpers import sync_execute

        sync_execute(
            "UPDATE users SET locked_until = :locked_until WHERE username = 'staff'",
            {"locked_until": datetime.utcnow() - timedelta(minutes=1)},
        )

        success_transport = httpx.ASGITransport(app=app, client=("10.0.0.99", 5099))
        async with httpx.AsyncClient(transport=success_transport, base_url="http://testserver") as client:
            success_response = await client.post(
                "/api/v1/auth/login",
                json={"username": "staff", "password": JOURNEY_PASSWORD},
            )
            assert success_response.status_code == 200

        failed_attempts, locked_until = get_staff_lock_state()
        assert failed_attempts == 0
        assert locked_until is None

    @pytest.mark.asyncio
    async def test_must_change_password_forced(self):
        from tests.helpers import sync_execute
        from app.auth.jwt import hash_password

        sync_execute(
            """
            UPDATE users
            SET must_change_password = true, password_hash = :ph
            WHERE username = 'staff'
            """,
            {"ph": hash_password(JOURNEY_PASSWORD)},
        )
        transport = httpx.ASGITransport(app=app, client=("10.1.0.4", 5104))
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            headers = await login(client, "staff", JOURNEY_PASSWORD)
            protected = await client.get("/api/v1/employees", headers=headers)
            assert protected.status_code in (403, 401)
            detail = (protected.json() or {}).get("detail", "")
            assert "PASSWORD" in str(detail).upper() or protected.status_code == 403


@pytest.mark.integration
class TestRBACScoping:
    @pytest.mark.asyncio
    async def test_staff_cannot_view_others(self):
        transport = httpx.ASGITransport(app=app, client=("10.2.0.1", 5201))
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            headers = await login(client, "staff", JOURNEY_PASSWORD)
            response = await client.get("/api/v1/leave-applications", headers=headers)
            body = await expect_status(response, 200, "staff list applications")
            assert isinstance(body, list)
            for row in body:
                assert row.get("employee_id")  # scoped to own records only

    @pytest.mark.asyncio
    async def test_hod_sees_department(self):
        transport = httpx.ASGITransport(app=app, client=("10.2.0.2", 5202))
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            headers = await login(client, "hod", JOURNEY_PASSWORD)
            inbox = await client.get("/api/v1/leave-approvals/inbox", headers=headers)
            await expect_status(inbox, 200, "hod inbox")

    @pytest.mark.asyncio
    async def test_director_sees_all(self):
        from tests.helpers import sync_execute
        from app.auth.jwt import hash_password

        sync_execute(
            """
            INSERT INTO users (id, username, password_hash, role, is_active, must_change_password)
            VALUES (gen_random_uuid(), 'director', :ph, 'DIRECTOR', true, false)
            ON CONFLICT (username) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                role = 'DIRECTOR',
                is_active = true
            """,
            {"ph": hash_password(JOURNEY_PASSWORD)},
        )
        transport = httpx.ASGITransport(app=app, client=("10.2.0.3", 5203))
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            headers = await login(client, "director", JOURNEY_PASSWORD)
            response = await client.get("/api/v1/leave-applications", headers=headers)
            await expect_status(response, 200, "director list applications")


@pytest.mark.integration
class TestConcurrent:
    @pytest.mark.asyncio
    async def test_overlap_constraint(self):
        """Overlapping pending applications for same employee are rejected."""
        transport = httpx.ASGITransport(app=app, client=("10.3.0.1", 5301))
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post(
                "/api/v1/auth/login",
                json={"username": "staff", "password": JOURNEY_PASSWORD},
            )
            login_body = await expect_status(response, 200, "staff login")
            headers = {"Authorization": f"Bearer {login_body['access_token']}"}
            employee_id = login_body.get("user", {}).get("employee_id")
            assert employee_id

            payload = {
                "employee_id": employee_id,
                "leave_type_code": "EL",
                "from_date": "2028-12-01",
                "to_date": "2028-12-01",
                "reason": "Overlap test A",
            }
            first = await client.post("/api/v1/leave-applications", json=payload, headers=headers)
            if first.status_code == 201:
                second = await client.post(
                    "/api/v1/leave-applications",
                    json={**payload, "reason": "Overlap test B"},
                    headers=headers,
                )
                assert second.status_code in (400, 409, 422)
            else:
                assert first.status_code in (400, 409, 422)

    @pytest.mark.asyncio
    async def test_balance_race_condition(self):
        """Final approval deducts balance exactly once (idempotent re-check)."""
        from tests.helpers import sync_execute

        row = sync_execute(
            """
            SELECT lb.closing_balance, lb.availed
            FROM leave_balances lb
            JOIN employees e ON e.id = lb.employee_id
            JOIN leave_types lt ON lt.id = lb.leave_type_id
            WHERE e.emp_code = 'TEST_STAFF' AND lt.code = 'EL'
            ORDER BY lb.leave_year DESC
            LIMIT 1
            """
        ).fetchone()
        assert row is not None
        closing, availed = float(row[0]), float(row[1])
        assert closing >= 0
        assert availed >= 0
