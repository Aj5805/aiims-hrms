"""Purge all dev/test employees and users (keeps central admin), then optional re-seed.

Usage:
    cd backend && python scripts/purge_test_data.py
    cd backend && python scripts/purge_test_data.py --reseed
"""

from __future__ import annotations

import argparse
import importlib
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from seeds.purge_dev_data import purge_dev_staff


def main() -> None:
    parser = argparse.ArgumentParser(description="Purge dev/test HRMS data")
    parser.add_argument(
        "--reseed",
        action="store_true",
        help="After purge, register 20 sample staff (seed 012)",
    )
    args = parser.parse_args()

    if settings.APP_ENV == "production" or os.environ.get("APP_ENV") == "production":
        raise SystemExit("Refusing to purge in production.")

    engine = create_engine(settings.DATABASE_URL_SYNC)
    with Session(engine) as session:
        purge_dev_staff(session)
        session.commit()
        print("Purged all employees and non-admin users (admin login kept).")

        if args.reseed:
            mod = importlib.import_module("seeds.versions.012_sample_staff")
            mod._seed_sample_staff(session)
            session.commit()
            print("Re-seeded sample staff.")


if __name__ == "__main__":
    main()
