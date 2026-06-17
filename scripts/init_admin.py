#!/usr/bin/env python3
"""
AIIMS HRMS â€” Bootstrap the first ADMIN user.

Usage:
    cd backend && python ../scripts/init_admin.py

Reads DATABASE_URL_SYNC from .env. Creates the initial ADMIN user if none exists.
The temporary password is printed to stdout; force-reset is enforced on first login.
"""

import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

try:
    from app.core.config import settings
except ImportError:
    print("ERROR: Cannot import app.core.config. Run from the project root.", file=sys.stderr)
    sys.exit(1)

try:
    import bcrypt
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session
    from sqlalchemy.exc import IntegrityError
except ImportError as e:
    print(f"ERROR: Missing dependency â€” {e}", file=sys.stderr)
    print("Install: pip install sqlalchemy bcrypt psycopg2-binary", file=sys.stderr)
    sys.exit(1)


def main():
    engine = create_engine(settings.DATABASE_URL_SYNC)

    with Session(engine) as session:
        existing = session.execute(
            text("SELECT id FROM users WHERE role = 'ADMIN' AND is_active = true LIMIT 1")
        ).fetchone()

        if existing:
            print("ADMIN user already exists. Skipping creation.")
            return

        admin_id = str(uuid.uuid4())
        password = os.urandom(8).hex()
        password_hash = bcrypt.hashpw(
            password.encode(), bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)
        ).decode()

        try:
            session.execute(
                text("""
                    INSERT INTO users (id, username, password_hash, role, is_active, must_change_password)
                    VALUES (:id, :username, :password_hash, 'ADMIN', true, true)
                """),
                {
                    "id": admin_id,
                    "username": "admin",
                    "password_hash": password_hash,
                },
            )
            session.commit()
            print("=" * 60)
            print("  ADMIN user created successfully!")
            print(f"  Username : admin")
            print(f"  Password : {password}")
            print("  âš ï¸  You will be forced to change this password on first login.")
            print("=" * 60)
        except IntegrityError:
            session.rollback()
            print("ADMIN user already exists (integrity check). Skipping.")
        except Exception as e:
            session.rollback()
            print(f"ERROR creating admin user: {e}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()