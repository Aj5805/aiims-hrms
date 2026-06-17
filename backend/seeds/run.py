"""Base seed runner â€” loads seed scripts in order against the database.

Usage:
    cd backend && python seeds/run.py

Each seed in seeds/versions/ is executed in filename order.
Seeds are idempotent (safe to re-run).
"""

import importlib
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings


def run_seeds():
    engine = create_engine(settings.DATABASE_URL_SYNC)
    versions_dir = os.path.join(os.path.dirname(__file__), "versions")

    seed_files = sorted(
        f for f in os.listdir(versions_dir)
        if f.endswith(".py") and f != "__init__.py"
    )

    print(f"Found {len(seed_files)} seed scripts.")

    with Session(engine) as session:
        for seed_file in seed_files:
            mod_name = f"seeds.versions.{seed_file[:-3]}"
            print(f"  Running: {seed_file} ... ", end="")
            try:
                mod = importlib.import_module(mod_name)
                mod.run(session)
                session.commit()
                print("OK")
            except Exception as e:
                session.rollback()
                print(f"FAILED -- {e}")
                raise

    print("All seeds complete.")


if __name__ == "__main__":
    run_seeds()