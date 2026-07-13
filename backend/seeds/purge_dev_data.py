"""Shared purge for dev/test databases — keeps username=admin and AIIMS masters."""

from sqlalchemy import text


def _table_exists(session, table_name: str) -> bool:
    row = session.execute(
        text(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = :name
            """
        ),
        {"name": table_name},
    ).fetchone()
    return row is not None


def purge_dev_staff(session) -> None:
    """Remove every employee and every user except username=admin."""
    session.execute(text("DELETE FROM notification_queue"))
    session.execute(text("DELETE FROM leave_approvals"))

    if _table_exists(session, "leave_documents"):
        session.execute(text("DELETE FROM leave_documents"))

    if _table_exists(session, "leave_balance_ledger"):
        # Row-level DELETE triggers block purge; TRUNCATE is safe for dev reset.
        session.execute(text("TRUNCATE leave_balance_ledger"))

    session.execute(text("DELETE FROM leave_applications"))
    session.execute(text("DELETE FROM leave_balances"))

    if _table_exists(session, "attendance_daily"):
        session.execute(text("DELETE FROM attendance_daily"))

    if _table_exists(session, "attendance_raw"):
        session.execute(text("DELETE FROM attendance_raw"))

    session.execute(
        text(
            """
            DELETE FROM payroll_export_log
            WHERE exported_by IN (SELECT id FROM users WHERE username != 'admin')
            """
        )
    )
    session.execute(
        text(
            """
            DELETE FROM token_blacklist
            WHERE user_id IN (SELECT id FROM users WHERE username != 'admin')
            """
        )
    )
    session.execute(
        text(
            """
            DELETE FROM audit_log
            WHERE actor_id IN (SELECT id FROM users WHERE username != 'admin')
            """
        )
    )

    if _table_exists(session, "login_log"):
        session.execute(
            text(
                """
                DELETE FROM login_log
                WHERE user_id IN (SELECT id FROM users WHERE username != 'admin')
                """
            )
        )

    if _table_exists(session, "employee_salary_assignments"):
        session.execute(text("DELETE FROM employee_salary_assignments"))

    session.execute(text("DELETE FROM dept_nodal_assignments"))

    if _table_exists(session, "dept_hod_assignments"):
        session.execute(text("DELETE FROM dept_hod_assignments"))

    if _table_exists(session, "nodal_offices"):
        session.execute(text("UPDATE nodal_offices SET officer_user_id = NULL"))

    session.execute(
        text(
            """
            UPDATE workflow_configs
            SET created_by = (SELECT id FROM users WHERE username = 'admin')
            WHERE created_by IN (SELECT id FROM users WHERE username != 'admin')
            """
        )
    )
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

    session.execute(text("UPDATE users SET employee_id = NULL WHERE username = 'admin'"))
    session.execute(
        text(
            """
            UPDATE users
            SET nodal_office_id = NULL,
                parent_nodal_user_id = NULL
            WHERE username != 'admin'
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


_KEEP_EMPLOYEES = "SELECT id FROM employees WHERE name ILIKE 'test%'"
_REMOVE_EMPLOYEES = "SELECT id FROM employees WHERE name NOT ILIKE 'test%'"
_KEEP_USERS = (
    "SELECT id FROM users WHERE username = 'admin'"
    f" OR employee_id IN ({_KEEP_EMPLOYEES})"
)
_REMOVE_USERS = (
    "SELECT id FROM users WHERE username != 'admin'"
    f" AND (employee_id IS NULL OR employee_id IN ({_REMOVE_EMPLOYEES}))"
)


def purge_non_test_staff(session) -> dict[str, int]:
    """Remove employees/users except those whose employee name starts with 'test' (plus admin).

    Keeps AIIMS department/designation masters untouched.
    """
    counts: dict[str, int] = {}

    def _count(label: str, sql: str) -> None:
        counts[label] = session.execute(text(sql)).scalar() or 0

    _count("employees_removed", f"SELECT count(*) FROM employees WHERE id IN ({_REMOVE_EMPLOYEES})")
    _count("employees_kept", f"SELECT count(*) FROM employees WHERE id IN ({_KEEP_EMPLOYEES})")
    _count("users_removed", f"SELECT count(*) FROM users WHERE id IN ({_REMOVE_USERS})")

    session.execute(
        text(
            f"""
            UPDATE employees
            SET reporting_officer_id = NULL
            WHERE reporting_officer_id IN ({_REMOVE_EMPLOYEES})
            """
        )
    )

    session.execute(
        text(
            f"""
            UPDATE leave_applications
            SET acting_arrangement_emp_id = NULL
            WHERE acting_arrangement_emp_id IN ({_REMOVE_EMPLOYEES})
            """
        )
    )

    session.execute(
        text(
            f"""
            DELETE FROM notification_queue
            WHERE application_id IN (
                SELECT id FROM leave_applications
                WHERE employee_id IN ({_REMOVE_EMPLOYEES})
            )
            """
        )
    )

    session.execute(
        text(
            f"""
            DELETE FROM leave_approvals
            WHERE application_id IN (
                SELECT id FROM leave_applications WHERE employee_id IN ({_REMOVE_EMPLOYEES})
            )
               OR approver_id IN ({_REMOVE_USERS})
            """
        )
    )

    if _table_exists(session, "leave_documents"):
        session.execute(
            text(
                f"""
                DELETE FROM leave_documents
                WHERE application_id IN (
                    SELECT id FROM leave_applications WHERE employee_id IN ({_REMOVE_EMPLOYEES})
                )
                """
            )
        )

    if _table_exists(session, "leave_balance_ledger"):
        session.execute(
            text("ALTER TABLE leave_balance_ledger DISABLE TRIGGER trg_leave_balance_ledger_no_delete")
        )
        session.execute(
            text(f"DELETE FROM leave_balance_ledger WHERE employee_id IN ({_REMOVE_EMPLOYEES})")
        )
        session.execute(
            text("ALTER TABLE leave_balance_ledger ENABLE TRIGGER trg_leave_balance_ledger_no_delete")
        )

    session.execute(
        text(f"DELETE FROM leave_applications WHERE employee_id IN ({_REMOVE_EMPLOYEES})")
    )
    session.execute(
        text(f"DELETE FROM leave_balances WHERE employee_id IN ({_REMOVE_EMPLOYEES})")
    )

    if _table_exists(session, "attendance_daily"):
        session.execute(
            text(f"DELETE FROM attendance_daily WHERE employee_id IN ({_REMOVE_EMPLOYEES})")
        )

    if _table_exists(session, "attendance_raw"):
        session.execute(
            text(f"DELETE FROM attendance_raw WHERE employee_id IN ({_REMOVE_EMPLOYEES})")
        )

    session.execute(
        text(
            f"""
            DELETE FROM payroll_export_log
            WHERE exported_by IN ({_REMOVE_USERS})
            """
        )
    )
    session.execute(
        text(f"DELETE FROM token_blacklist WHERE user_id IN ({_REMOVE_USERS})")
    )
    session.execute(
        text(f"DELETE FROM audit_log WHERE actor_id IN ({_REMOVE_USERS})")
    )

    if _table_exists(session, "login_log"):
        session.execute(
            text(f"DELETE FROM login_log WHERE user_id IN ({_REMOVE_USERS})")
        )

    if _table_exists(session, "employee_salary_assignments"):
        session.execute(
            text(
                f"DELETE FROM employee_salary_assignments WHERE employee_id IN ({_REMOVE_EMPLOYEES})"
            )
        )

    session.execute(
        text(f"DELETE FROM dept_nodal_assignments WHERE nodal_user_id IN ({_REMOVE_USERS})")
    )

    if _table_exists(session, "dept_hod_assignments"):
        session.execute(
            text(f"DELETE FROM dept_hod_assignments WHERE hod_user_id IN ({_REMOVE_USERS})")
        )

    if _table_exists(session, "nodal_offices"):
        session.execute(
            text(
                f"""
                UPDATE nodal_offices
                SET officer_user_id = NULL
                WHERE officer_user_id IN ({_REMOVE_USERS})
                """
            )
        )

    session.execute(
        text(
            f"""
            UPDATE workflow_configs
            SET created_by = (SELECT id FROM users WHERE username = 'admin')
            WHERE created_by IN ({_REMOVE_USERS})
            """
        )
    )
    session.execute(
        text(
            f"""
            UPDATE workflow_steps
            SET specific_approver_id = NULL
            WHERE specific_approver_id IN ({_REMOVE_USERS})
            """
        )
    )

    session.execute(
        text(
            f"""
            UPDATE users
            SET nodal_office_id = NULL,
                parent_nodal_user_id = NULL
            WHERE id IN ({_REMOVE_USERS})
               OR parent_nodal_user_id IN ({_REMOVE_USERS})
            """
        )
    )
    session.execute(text(f"DELETE FROM users WHERE id IN ({_REMOVE_USERS})"))
    session.execute(text(f"DELETE FROM employees WHERE id IN ({_REMOVE_EMPLOYEES})"))

    return counts
