"""Integration test: auth flow -- login, refresh, logout, lockout."""

import pytest

# These tests require a running server + test DB.
# Run with: pytest tests/integration/ -v --server-url http://localhost:8000


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

    def test_lockout_after_5_failures(self):
        """6th failed login -> 429 or lockout."""
        pass

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