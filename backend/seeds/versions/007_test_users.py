"""Seed 007 — Central admin login only (no test employees).

GATED: Only runs if APP_ENV != "production".
"""

import os

from sqlalchemy import text

from app.auth.jwt import hash_password


def run(session):
    if os.environ.get("APP_ENV") == "production":
        print("Skipping admin seed in production environment.")
        return

    session.execute(
        text(
            """
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
            """
        ),
        {"ph": hash_password("password")},
    )
    print("Seeded central admin (username=admin, password=password).")
