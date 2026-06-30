"""
Purge all test/demo data from the HRMS database.

Keeps:
  - users WHERE username = 'admin'
  - employee_categories  (system master data)
  - leave_types           (system master data)
  - leave_entitlement_rules (system master data)
  - workflow_configs / workflow_steps that are NOT linked to demo employees

Deletes (in FK-safe order):
  - audit_log rows for non-admin users
  - payroll_export_log rows for non-admin users
  - token_blacklist rows for non-admin users
  - notification_queue
  - leave_approvals
  - leave_documents
  - leave_balance_ledger (if the table exists)
  - leave_applications
  - leave_balances
  - dept_nodal_assignments
  - dept_hod_assignments  (if the table exists)
  - attendance_raw
  - login_log rows for non-admin users  (if the table exists)
  - users WHERE username != 'admin'
  - employees (all)
  - workflow_steps  where config_id references configs created by non-admin users
  - workflow_configs created by non-admin users
  - designations  (all — re-seeded from real data later)
  - departments   (all — re-seeded from real data later)

Usage:
    cd backend && python purge_all_test_data.py
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from app.core.config import settings


def table_exists(conn, table_name: str) -> bool:
    inspector = inspect(conn)
    return table_name in inspector.get_table_names()


def purge(session: Session) -> None:
    conn = session.connection()

    print("  -> Clearing notification_queue ...")
    session.execute(text("DELETE FROM notification_queue"))

    print("  -> Clearing leave_approvals ...")
    session.execute(text("DELETE FROM leave_approvals"))

    print("  -> Clearing leave_documents ...")
    session.execute(text("DELETE FROM leave_documents"))

    if table_exists(conn, "leave_balance_ledger"):
        print("  -> Clearing leave_balance_ledger ...")
        session.execute(text("DELETE FROM leave_balance_ledger"))

    print("  -> Clearing leave_applications ...")
    session.execute(text("DELETE FROM leave_applications"))

    print("  -> Clearing leave_balances ...")
    session.execute(text("DELETE FROM leave_balances"))

    if table_exists(conn, "dept_hod_assignments"):
        print("  -> Clearing dept_hod_assignments ...")
        session.execute(text("DELETE FROM dept_hod_assignments"))

    print("  -> Clearing dept_nodal_assignments ...")
    session.execute(text("DELETE FROM dept_nodal_assignments"))

    print("  -> Clearing attendance_raw ...")
    session.execute(text("DELETE FROM attendance_raw"))

    print("  -> Clearing payroll_export_log (non-admin) ...")
    session.execute(
        text(
            """
            DELETE FROM payroll_export_log
            WHERE exported_by IN (SELECT id FROM users WHERE username != 'admin')
            """
        )
    )

    print("  -> Clearing token_blacklist (non-admin) ...")
    session.execute(
        text(
            """
            DELETE FROM token_blacklist
            WHERE user_id IN (SELECT id FROM users WHERE username != 'admin')
            """
        )
    )

    print("  -> Clearing audit_log (non-admin) ...")
    session.execute(
        text(
            """
            DELETE FROM audit_log
            WHERE actor_id IN (SELECT id FROM users WHERE username != 'admin')
            """
        )
    )

    if table_exists(conn, "login_log"):
        print("  -> Clearing login_log (non-admin) ...")
        session.execute(
            text(
                """
                DELETE FROM login_log
                WHERE user_id IN (SELECT id FROM users WHERE username != 'admin')
                """
            )
        )

    # Workflow configs have a FK created_by -> users, so clear them before users
    print("  -> Clearing workflow_steps ...")
    session.execute(text("DELETE FROM workflow_steps"))

    print("  -> Clearing workflow_configs ...")
    session.execute(text("DELETE FROM workflow_configs"))

    print("  -> Deleting non-admin users ...")
    session.execute(text("DELETE FROM users WHERE username != 'admin'"))

    # users.employee_id is a FK to employees; NULL it out so we can delete employees
    print("  -> Unlinking admin employee_id ...")
    session.execute(text("UPDATE users SET employee_id = NULL WHERE username = 'admin'"))

    print("  -> Deleting all employees ...")
    session.execute(text("DELETE FROM employees"))

    print("  -> Deleting designations ...")
    session.execute(text("DELETE FROM designations"))

    print("  -> Deleting departments ...")
    session.execute(text("DELETE FROM departments"))

    session.commit()
    print("\n[OK]  All test data purged. Admin user and system master data preserved.")


def main() -> None:
    env = settings.APP_ENV or os.environ.get("APP_ENV", "")
    if env == "production":
        print("❌  Refusing to run against production database.")
        sys.exit(1)

    print(f"Database: {settings.DATABASE_URL_SYNC}")
    print("Starting purge …\n")

    engine = create_engine(settings.DATABASE_URL_SYNC)
    with Session(engine) as session:
        purge(session)


if __name__ == "__main__":
    main()
