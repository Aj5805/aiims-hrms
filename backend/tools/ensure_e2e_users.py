"""Ensure journey test users (staff/hod/nodal) without purging manual data.

Used by Playwright globalSetup and integration/security tests.
"""

from __future__ import annotations

import uuid

from sqlalchemy import create_engine, text

from app.auth.jwt import hash_password
from app.core.config import settings

JOURNEY_PASSWORD = "password"
STAFF_EMP_CODE = "TEST_STAFF"
STAFF_NAME = "Staff User"


def _engine():
    return create_engine(settings.DATABASE_URL_SYNC)


def _lookup_id(conn, table: str, column: str, value: str) -> str | None:
    row = conn.execute(
        text(f"SELECT id FROM {table} WHERE {column} = :v"),
        {"v": value},
    ).fetchone()
    return str(row[0]) if row else None


def _upsert_user(
    conn,
    *,
    username: str,
    role: str,
    password: str,
    employee_id: str | None = None,
    must_change_password: bool = False,
) -> str:
    existing = conn.execute(
        text("SELECT id FROM users WHERE username = :u"),
        {"u": username},
    ).fetchone()
    ph = hash_password(password)
    if existing:
        uid = str(existing[0])
        conn.execute(
            text(
                """
                UPDATE users
                SET password_hash = :ph, role = :role, employee_id = :eid,
                    is_active = true, must_change_password = :mcp,
                    failed_login_attempts = 0, locked_until = NULL
                WHERE id = :id
                """
            ),
            {
                "ph": ph,
                "role": role,
                "eid": employee_id,
                "mcp": must_change_password,
                "id": uid,
            },
        )
        return uid

    uid = str(uuid.uuid4())
    conn.execute(
        text(
            """
            INSERT INTO users
                (id, username, password_hash, role, employee_id, is_active, must_change_password,
                 failed_login_attempts, locked_until)
            VALUES
                (:id, :u, :ph, :role, :eid, true, :mcp, 0, NULL)
            """
        ),
        {
            "id": uid,
            "u": username,
            "ph": ph,
            "role": role,
            "eid": employee_id,
            "mcp": must_change_password,
        },
    )
    return uid


def _ensure_staff_employee(conn) -> str:
    dept_id = _lookup_id(conn, "departments", "code", "ADMIN")
    desig_id = _lookup_id(conn, "designations", "name", "Accounts Officer")
    cat_id = _lookup_id(conn, "employee_categories", "code", "ADMIN")
    if not dept_id or not desig_id or not cat_id:
        raise RuntimeError("AIIMS masters missing — run seeds 009/010 first.")

    existing = conn.execute(
        text("SELECT id FROM employees WHERE emp_code = :ec"),
        {"ec": STAFF_EMP_CODE},
    ).fetchone()
    if existing:
        return str(existing[0])

    eid = str(uuid.uuid4())
    conn.execute(
        text(
            """
            INSERT INTO employees
                (id, emp_code, name, gender, dob, doj, category_id, department_id,
                 designation_id, email, staff_group, is_active)
            VALUES
                (:id, :ec, :nm, 'MALE', '1990-01-01', '2020-07-01', :cat, :dept, :des,
                 'staff.user@aiims.ac.in', 'DEP', true)
            """
        ),
        {
            "id": eid,
            "ec": STAFF_EMP_CODE,
            "nm": STAFF_NAME,
            "cat": cat_id,
            "dept": dept_id,
            "des": desig_id,
        },
    )
    return eid


def _ensure_opening_balance(conn, employee_id: str, leave_code: str = "EL", opening: float = 10.0) -> None:
    year = conn.execute(text("SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int")).scalar()
    conn.execute(
        text(
            """
            INSERT INTO leave_balances
                (id, employee_id, leave_type_id, leave_year, year_start_date, opening_balance, credited)
            SELECT gen_random_uuid(), :eid, lt.id, :yr, make_date(:yr, 1, 1), :ob, 0
            FROM leave_types lt
            WHERE lt.code = :ltc
            AND NOT EXISTS (
                SELECT 1 FROM leave_balances lb
                WHERE lb.employee_id = :eid AND lb.leave_type_id = lt.id AND lb.leave_year = :yr
            )
            """
        ),
        {"eid": employee_id, "ltc": leave_code, "yr": int(year), "ob": opening},
    )


def _ensure_hod_assignment(conn, department_id: str, hod_user_id: str) -> None:
    row = conn.execute(
        text(
            """
            SELECT hod_user_id FROM dept_hod_assignments
            WHERE department_id = :did AND is_active = true
            LIMIT 1
            """
        ),
        {"did": department_id},
    ).fetchone()
    if row and str(row[0]) == hod_user_id:
        return
    conn.execute(
        text(
            """
            UPDATE dept_hod_assignments SET is_active = false
            WHERE department_id = :did AND is_active = true
            """
        ),
        {"did": department_id},
    )
    conn.execute(
        text(
            """
            INSERT INTO dept_hod_assignments (id, department_id, hod_user_id, is_active)
            VALUES (:id, :did, :hod, true)
            """
        ),
        {"id": str(uuid.uuid4()), "did": department_id, "hod": hod_user_id},
    )


def _ensure_nodal_officer(conn, nodal_user_id: str, scheme: str = "CCS") -> None:
    conn.execute(
        text(
            """
            UPDATE users SET role = 'NODAL_OFFICER' WHERE id = :uid
            """
        ),
        {"uid": nodal_user_id},
    )
    conn.execute(
        text(
            """
            UPDATE nodal_offices
            SET officer_user_id = :uid
            WHERE leave_scheme = :scheme AND is_active = true
            """
        ),
        {"uid": nodal_user_id, "scheme": scheme},
    )


def ensure_users(
    *,
    password: str = JOURNEY_PASSWORD,
    staff_must_change_password: bool = True,
) -> None:
    """Idempotent: creates staff/hod/nodal journey users."""
    with _engine().begin() as conn:
        staff_eid = _ensure_staff_employee(conn)
        dept_id = _lookup_id(conn, "departments", "code", "ADMIN")

        staff_uid = _upsert_user(
            conn,
            username="staff",
            role="STAFF",
            password=password,
            employee_id=staff_eid,
            must_change_password=staff_must_change_password,
        )

        hod_uid = _upsert_user(
            conn,
            username="hod",
            role="HOD",
            password=password,
            employee_id=None,
            must_change_password=False,
        )
        if dept_id:
            _ensure_hod_assignment(conn, dept_id, hod_uid)

        nodal_uid = _upsert_user(
            conn,
            username="nodal",
            role="NODAL_OFFICER",
            password=password,
            employee_id=None,
            must_change_password=False,
        )
        _ensure_nodal_officer(conn, nodal_uid, "CCS")

        _ensure_opening_balance(conn, staff_eid, "EL", 10.0)

        # Keep staff user row in sync if employee existed under another username
        conn.execute(
            text("UPDATE users SET employee_id = :eid WHERE id = :uid"),
            {"eid": staff_eid, "uid": staff_uid},
        )

    print("Journey users ready: staff, hod, nodal (password=password).")


if __name__ == "__main__":
    ensure_users()
