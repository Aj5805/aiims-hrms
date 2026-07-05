"""Nodal office routing — leave scheme (staff category) based."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_employee_leave_scheme(db: AsyncSession, employee_id: str) -> str | None:
    result = await db.execute(
        text("""
            SELECT c.leave_scheme
            FROM employees e
            JOIN employee_categories c ON c.id = e.category_id
            WHERE e.id = :eid
        """),
        {"eid": employee_id},
    )
    row = result.fetchone()
    return row[0] if row else None


async def get_nodal_office_for_scheme(db: AsyncSession, leave_scheme: str):
    result = await db.execute(
        text("""
            SELECT id, code, name, leave_scheme, officer_user_id, is_active
            FROM nodal_offices
            WHERE leave_scheme = :scheme AND is_active = true
            ORDER BY code
            LIMIT 1
        """),
        {"scheme": leave_scheme},
    )
    return result.fetchone()


async def get_nodal_office_for_employee(db: AsyncSession, employee_id: str):
    """Resolve nodal office from employee leave scheme (CCS → Establishment, RESIDENCY → Registrar)."""
    scheme = await get_employee_leave_scheme(db, employee_id)
    if not scheme:
        return None
    return await get_nodal_office_for_scheme(db, scheme)


async def get_nodal_officer_for_employee(db: AsyncSession, employee_id: str) -> str | None:
    office = await get_nodal_office_for_employee(db, employee_id)
    if office and office.officer_user_id:
        return str(office.officer_user_id)
    return None


async def get_nodal_office_for_user(db: AsyncSession, user_id: str, role: str):
    """Resolve which nodal office a NODAL_OFFICER or NODAL_OFFICE user belongs to."""
    if role == "NODAL_OFFICER":
        result = await db.execute(
            text("""
                SELECT id, code, name, leave_scheme, officer_user_id, is_active
                FROM nodal_offices
                WHERE officer_user_id = :uid AND is_active = true
                LIMIT 1
            """),
            {"uid": user_id},
        )
        return result.fetchone()

    result = await db.execute(
        text("""
            SELECT no.id, no.code, no.name, no.leave_scheme, no.officer_user_id, no.is_active
            FROM users u
            JOIN nodal_offices no ON no.id = u.nodal_office_id
            WHERE u.id = :uid AND no.is_active = true
            LIMIT 1
        """),
        {"uid": user_id},
    )
    row = result.fetchone()
    if row:
        return row

    result = await db.execute(
        text("""
            SELECT no.id, no.code, no.name, no.leave_scheme, no.officer_user_id, no.is_active
            FROM users u
            JOIN nodal_offices no ON no.officer_user_id = u.parent_nodal_user_id
            WHERE u.id = :uid AND no.is_active = true
            LIMIT 1
        """),
        {"uid": user_id},
    )
    return result.fetchone()


async def employee_in_nodal_scope(db: AsyncSession, nodal_user_id: str, role: str, employee_id: str) -> bool:
    office = await get_nodal_office_for_user(db, nodal_user_id, role)
    if not office:
        return False
    scheme = await get_employee_leave_scheme(db, employee_id)
    return scheme == office.leave_scheme


def nodal_scope_employee_ids_subquery() -> str:
    """SQL fragment: employees visible to nodal user (:nodal_uid / :nodal_role)."""
    return """
        SELECT e.id FROM employees e
        JOIN employee_categories c ON c.id = e.category_id
        JOIN nodal_offices no ON no.is_active = true AND (
            no.officer_user_id = :nodal_uid
            OR no.id IN (SELECT nodal_office_id FROM users WHERE id = :nodal_uid AND nodal_office_id IS NOT NULL)
            OR no.officer_user_id IN (SELECT parent_nodal_user_id FROM users WHERE id = :nodal_uid)
        )
        WHERE c.leave_scheme = no.leave_scheme
    """
