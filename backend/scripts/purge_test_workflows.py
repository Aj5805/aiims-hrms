"""Remove inactive E2E / ASCII test workflow configs left by test runs.

Usage:
    cd backend && python scripts/purge_test_workflows.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import settings


def purge_inactive_test_workflows(session: Session) -> tuple[int, int]:
    steps_result = session.execute(
        text("""
            DELETE FROM workflow_steps
            WHERE config_id IN (
                SELECT id FROM workflow_configs
                WHERE is_active = false
                  AND (
                    config_name LIKE 'E2E_%'
                    OR config_name LIKE 'ASCII Test%'
                  )
            )
        """)
    )
    configs_result = session.execute(
        text("""
            DELETE FROM workflow_configs
            WHERE is_active = false
              AND (
                config_name LIKE 'E2E_%'
                OR config_name LIKE 'ASCII Test%'
              )
        """)
    )
    return configs_result.rowcount or 0, steps_result.rowcount or 0


def main() -> None:
    engine = create_engine(settings.DATABASE_URL_SYNC)
    with Session(engine) as session:
        configs_deleted, steps_deleted = purge_inactive_test_workflows(session)
        session.commit()
    print(f"Removed {configs_deleted} inactive test workflow config(s), {steps_deleted} step(s).")


if __name__ == "__main__":
    main()
