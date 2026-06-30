"""Shared purge for dev/test databases — keeps username=admin only."""

from sqlalchemy import text


def purge_dev_staff(session) -> None:
    """Remove every employee and every user except username=admin."""
    session.execute(text("DELETE FROM notification_queue"))
    session.execute(text("DELETE FROM leave_approvals"))
    session.execute(text("DELETE FROM leave_balance_ledger"))
    session.execute(text("DELETE FROM leave_applications"))
    session.execute(text("DELETE FROM leave_balances"))
    session.execute(
        text(
            """
            DELETE FROM login_log
            WHERE user_id IN (SELECT id FROM users WHERE username != 'admin')
            """
        )
    )
    session.execute(text("DELETE FROM dept_nodal_assignments"))
    session.execute(text("DELETE FROM dept_hod_assignments"))
    session.execute(
        text(
            """
            DELETE FROM workflow_steps
            WHERE config_id IN (
                SELECT id FROM workflow_configs
                WHERE config_name ILIKE '%testdept%'
                   OR config_name ILIKE '%test dept%'
            )
            """
        )
    )
    session.execute(
        text(
            """
            DELETE FROM workflow_configs
            WHERE config_name ILIKE '%testdept%'
               OR config_name ILIKE '%test dept%'
            """
        )
    )
    session.execute(text("DELETE FROM users WHERE username != 'admin'"))
    session.execute(text("DELETE FROM employees"))
    session.execute(
        text(
            """
            DELETE FROM designations
            WHERE name ~ '^testDesig[0-9]*$'
               OR name = 'Test Staff'
            """
        )
    )
    session.execute(
        text(
            """
            DELETE FROM departments
            WHERE code = 'TEST_DEPT'
               OR code ~ '^TDEPT[0-9]+$'
               OR name ~ '^testDept[0-9]+$'
            """
        )
    )
