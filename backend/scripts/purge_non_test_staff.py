"""Remove agent/demo staff; keep only employees whose name starts with 'test' (+ admin).

Usage:
    cd backend && python scripts/purge_non_test_staff.py
    cd backend && python scripts/purge_non_test_staff.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import settings
from seeds.purge_dev_data import _KEEP_EMPLOYEES, _REMOVE_EMPLOYEES, purge_non_test_staff


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Purge non-owner staff (keep name ILIKE 'test%%' + admin)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show counts only; do not delete",
    )
    args = parser.parse_args()

    if settings.APP_ENV == "production" or os.environ.get("APP_ENV") == "production":
        raise SystemExit("Refusing to purge in production.")

    engine = create_engine(settings.DATABASE_URL_SYNC)
    with Session(engine) as session:
        if args.dry_run:
            kept = session.execute(
                text(f"SELECT emp_code, name FROM employees WHERE id IN ({_KEEP_EMPLOYEES}) ORDER BY name")
            ).fetchall()
            removed = session.execute(
                text(
                    f"SELECT emp_code, name FROM employees WHERE id IN ({_REMOVE_EMPLOYEES}) ORDER BY name LIMIT 40"
                )
            ).fetchall()
            print(f"Would keep {len(kept)} employee(s):")
            for row in kept:
                print(f"  {row[0]} — {row[1]}")
            print(f"\nWould remove {session.execute(text(f'SELECT count(*) FROM employees WHERE id IN ({_REMOVE_EMPLOYEES})')).scalar()} employee(s), e.g.:")
            for row in removed:
                print(f"  {row[0]} — {row[1]}")
            return

        counts = purge_non_test_staff(session)
        session.commit()
        print(
            f"Done. Kept {counts['employees_kept']} test* employee(s); "
            f"removed {counts['employees_removed']} other employee(s) "
            f"and {counts['users_removed']} user login(s). Admin preserved."
        )


if __name__ == "__main__":
    main()
