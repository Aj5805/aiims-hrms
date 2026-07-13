"""Shared helpers for integration and security tests."""

from __future__ import annotations

import json
from typing import Any

import httpx
from sqlalchemy import create_engine, text as sa_text

from app.auth.jwt import hash_password
from app.core.config import settings
from app.data.staff_number_groups import CATEGORY_STAFF_GROUP_FALLBACK

BASE = "http://testserver"
ADMIN_USER = "admin"
ADMIN_PASS = "E2eAdmin#123"
JOURNEY_PASSWORD = "password"

CATEGORY_STAFF_GROUP = dict(CATEGORY_STAFF_GROUP_FALLBACK)


def staff_group_for_category(category_code: str) -> str:
    return CATEGORY_STAFF_GROUP.get(category_code, "ADM")


def employee_payload(
    *,
    emp_code: str,
    name: str,
    category_code: str,
    department_code: str = "ADMIN",
    designation_name: str = "Accounts Officer",
    gender: str = "MALE",
    doj: str = "2018-08-20",
) -> dict[str, Any]:
    return {
        "emp_code": emp_code,
        "name": name,
        "gender": gender,
        "doj": doj,
        "category_code": category_code,
        "department_code": department_code,
        "designation_name": designation_name,
        "staff_group": staff_group_for_category(category_code),
    }


def sync_execute(sql: str, params: dict | None = None):
    engine = create_engine(settings.DATABASE_URL_SYNC)
    with engine.connect() as conn:
        result = conn.execute(sa_text(sql), params or {})
        conn.commit()
        return result


def set_admin_password(password: str = ADMIN_PASS) -> None:
    sync_execute(
        """
        UPDATE users
        SET password_hash = :ph,
            failed_login_attempts = 0,
            locked_until = NULL,
            must_change_password = false,
            is_active = true
        WHERE username = :u
        """,
        {"ph": hash_password(password), "u": ADMIN_USER},
    )


def ensure_journey_users(**kwargs) -> None:
    """Create staff/hod/nodal users for E2E, Playwright, and integration tests."""
    from tools.ensure_e2e_users import ensure_users

    ensure_users(**kwargs)


def reset_staff_lockout_account(password: str = JOURNEY_PASSWORD) -> None:
    ensure_journey_users()
    sync_execute(
        """
        UPDATE users
        SET password_hash = :ph,
            failed_login_attempts = 0,
            locked_until = NULL,
            must_change_password = false,
            is_active = true
        WHERE username = 'staff'
        """,
        {"ph": hash_password(password)},
    )


def get_staff_lock_state() -> tuple[int, object]:
    row = sync_execute(
        "SELECT failed_login_attempts, locked_until FROM users WHERE username = 'staff'"
    ).fetchone()
    if not row:
        raise AssertionError("Journey user 'staff' missing — run ensure_journey_users()")
    return int(row[0] or 0), row[1]


async def expect_status(response: httpx.Response, expected: int, label: str) -> Any:
    try:
        body = response.json()
    except Exception:
        body = response.text[:1000]
    if response.status_code != expected:
        raise AssertionError(
            f"{label}: HTTP {response.status_code}, expected {expected}, "
            f"body={json.dumps(body, default=str)[:800]}"
        )
    return body


async def login(client: httpx.AsyncClient, username: str, password: str) -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    body = await expect_status(response, 200, f"login {username}")
    return {"Authorization": f"Bearer {body['access_token']}"}
