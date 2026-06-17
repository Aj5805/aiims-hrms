"""Clear E2E-only leave workflow state for TEST_* employees."""

import os

from sqlalchemy import create_engine, text

from app.core.config import settings


def main():
    if os.environ.get("APP_ENV") != "test":
      raise RuntimeError("reset_test_state.py is test-only; set APP_ENV=test")

    engine = create_engine(settings.DATABASE_URL_SYNC)
    with engine.begin() as conn:
        app_ids = conn.execute(
            text(
                """
                SELECT a.id
                FROM leave_applications a
                JOIN employees e ON e.id = a.employee_id
                WHERE e.emp_code LIKE 'TEST_%'
                """
            )
        ).scalars().all()

        if app_ids:
            conn.execute(text("DELETE FROM notification_queue WHERE application_id = ANY(:app_ids)"), {"app_ids": app_ids})
            conn.execute(text("DELETE FROM leave_documents WHERE application_id = ANY(:app_ids)"), {"app_ids": app_ids})
            conn.execute(text("DELETE FROM leave_approvals WHERE application_id = ANY(:app_ids)"), {"app_ids": app_ids})
            conn.execute(text("DELETE FROM leave_applications WHERE id = ANY(:app_ids)"), {"app_ids": app_ids})

        test_user_ids = conn.execute(
            text(
                """
                SELECT u.id
                FROM users u
                JOIN employees e ON e.id = u.employee_id
                WHERE e.emp_code LIKE 'TEST_%'
                """
            )
        ).scalars().all()
        if test_user_ids:
            conn.execute(text("DELETE FROM token_blacklist WHERE user_id = ANY(:user_ids)"), {"user_ids": test_user_ids})

        conn.execute(
            text(
                """
                DELETE FROM leave_balances lb
                USING employees e
                WHERE lb.employee_id = e.id
                  AND e.emp_code LIKE 'TEST_%'
                """
            )
        )

    print("Cleared E2E test state for TEST_* employees.")


if __name__ == "__main__":
    main()
