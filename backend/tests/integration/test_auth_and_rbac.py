"""Integration test: auth flow -- login, refresh, logout, lockout."""

from datetime import datetime, timedelta

import httpx
import pytest
from sqlalchemy import create_engine, text

from app.auth.jwt import hash_password
from app.core.config import settings
from main import app


def _reset_staff_account() -> None:
    engine = create_engine(settings.DATABASE_URL_SYNC)
    with engine.connect() as conn:
        row = conn.execute(text("SELECT id FROM users WHERE username = 'staff'")).fetchone()
        if not row:
            raise AssertionError("Seeded 'staff' user is required for integration lockout test")
        conn.execute(
            text(
                """
                UPDATE users
                SET password_hash = :password_hash,
                    failed_login_attempts = 0,
                    locked_until = NULL,
                    must_change_password = false,
                    is_active = true
                WHERE username = 'staff'
                """
            ),
            {"password_hash": hash_password("password")},
        )
        conn.commit()


def _get_staff_lock_state() -> tuple[int, object]:
    engine = create_engine(settings.DATABASE_URL_SYNC)
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT failed_login_attempts, locked_until FROM users WHERE username = 'staff'")
        ).fetchone()
        if not row:
            raise AssertionError("Seeded 'staff' user is required for integration lockout test")
        return int(row[0] or 0), row[1]


@pytest.mark.integration
class TestAuthFlow:
    def test_login_returns_tokens(self):
        """Login with valid credentials returns access_token + user."""
        pass  # Requires test fixtures

    def test_login_invalid_rejected(self):
        """Login with wrong password -> 401."""
        pass

    def test_logout_blacklists_token(self):
        """After logout, using old access token -> 401."""
        pass

    @pytest.mark.asyncio
    async def test_lockout_after_5_failures(self):
        """DB-backed lockout sets after 5 failures and blocks the next attempt."""
        _reset_staff_account()

        for index in range(5):
            transport = httpx.ASGITransport(app=app, client=(f"10.0.0.{index + 1}", 5000 + index))
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                response = await client.post("/api/v1/auth/login", json={"username": "staff", "password": "wrong-pass"})
                assert response.status_code == 401

        failed_attempts, locked_until = _get_staff_lock_state()
        assert failed_attempts == 5
        assert locked_until is not None

        lock_transport = httpx.ASGITransport(app=app, client=("10.0.0.50", 5050))
        async with httpx.AsyncClient(transport=lock_transport, base_url="http://testserver") as client:
            locked_response = await client.post("/api/v1/auth/login", json={"username": "staff", "password": "password"})
            assert locked_response.status_code == 429
            assert "temporarily locked" in locked_response.json()["detail"].lower()

        engine = create_engine(settings.DATABASE_URL_SYNC)
        with engine.connect() as conn:
            conn.execute(
                text("UPDATE users SET locked_until = :locked_until WHERE username = 'staff'"),
                {"locked_until": datetime.utcnow() - timedelta(minutes=1)},
            )
            conn.commit()

        success_transport = httpx.ASGITransport(app=app, client=("10.0.0.99", 5099))
        async with httpx.AsyncClient(transport=success_transport, base_url="http://testserver") as client:
            success_response = await client.post("/api/v1/auth/login", json={"username": "staff", "password": "password"})
            assert success_response.status_code == 200

        failed_attempts, locked_until = _get_staff_lock_state()
        assert failed_attempts == 0
        assert locked_until is None

    def test_must_change_password_forced(self):
        """User with flag -> prompt to change password before other actions."""
        pass


@pytest.mark.integration
class TestRBACScoping:
    def test_staff_cannot_view_others(self):
        """STAFF role -> GET /leave-applications returns only own."""
        pass

    def test_hod_sees_department(self):
        """HOD sees only own department employees."""
        pass

    def test_director_sees_all(self):
        """DIRECTOR sees all applications."""
        pass


@pytest.mark.integration
class TestConcurrent:
    def test_overlap_constraint(self):
        """Two overlapping APPROVED applications -> DB constraint violation."""
        pass

    def test_balance_race_condition(self):
        """Simultaneous approvals -> only one balance deduction succeeds."""
        pass
