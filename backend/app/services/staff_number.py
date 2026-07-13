"""Atomic per-group staff-number allocation (prefixed, unique, never reused)."""

from __future__ import annotations

import re

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.staff_number_groups import (
    STAFF_GROUP_CODES,
    STAFF_NUMBER_GROUPS,
    format_staff_number,
    resolve_staff_group,
)

__all__ = [
    "STAFF_GROUP_CODES",
    "STAFF_NUMBER_GROUPS",
    "allocate_staff_number",
    "assert_emp_code_available",
    "check_emp_code_available",
    "normalize_emp_code",
    "parse_emp_code",
    "preview_next_staff_number",
    "resolve_new_staff_number",
    "resolve_staff_group",
    "sync_sequence_from_emp_code",
    "validate_emp_code_for_group",
    "sync_sequences_from_employees",
    "validate_staff_group",
]


class StaffNumberError(ValueError):
    pass


_PREFIX_PATTERNS: dict[str, re.Pattern[str]] = {
    code: re.compile(
        rf"^{re.escape(spec['prefix'])}(\d{{{spec['pad_width']}}})$"
    )
    for code, spec in STAFF_NUMBER_GROUPS.items()
}


def normalize_emp_code(value: str | None) -> str:
    return (value or "").strip().upper()


def parse_emp_code(emp_code: str) -> tuple[str, int]:
    """Return (staff_group_code, sequence) or raise if not a known prefixed number."""
    code = normalize_emp_code(emp_code)
    if not code:
        raise StaffNumberError("Staff number cannot be empty")
    for group_code, pattern in _PREFIX_PATTERNS.items():
        match = pattern.match(code)
        if match:
            sequence = int(match.group(1))
            if sequence < 1:
                raise StaffNumberError(f"Staff number sequence must be at least 1 (got {code})")
            return group_code, sequence
    prefixes = ", ".join(spec["prefix"] for spec in STAFF_NUMBER_GROUPS.values())
    raise StaffNumberError(
        f"Staff number must use a known prefix with 4 digits (e.g. ADM0001). Allowed prefixes: {prefixes}"
    )


def _sequence_from_emp_code(emp_code: str) -> tuple[str, int] | None:
    try:
        return parse_emp_code(emp_code)
    except StaffNumberError:
        return None


def validate_emp_code_for_group(emp_code: str, staff_group: str) -> str:
    """Ensure code matches group prefix; return normalized code."""
    group = validate_staff_group(staff_group)
    parsed_group, _seq = parse_emp_code(emp_code)
    if parsed_group != group:
        expected = STAFF_NUMBER_GROUPS[group]["prefix"]
        raise StaffNumberError(
            f"Staff number must start with {expected} for this staff group (got {normalize_emp_code(emp_code)})"
        )
    return normalize_emp_code(emp_code)


def validate_staff_group(group_code: str) -> str:
    code = (group_code or "").strip().upper()
    if code not in STAFF_GROUP_CODES:
        raise StaffNumberError(
            f"Unknown staff group '{group_code}'. "
            f"Allowed: {', '.join(sorted(STAFF_GROUP_CODES))}"
        )
    return code


async def check_emp_code_available(
    db: AsyncSession,
    emp_code: str,
    *,
    exclude_employee_id: str | None = None,
) -> tuple[bool, str | None]:
    """Fast duplicate probe. Returns (available, conflict_message)."""
    code = normalize_emp_code(emp_code)
    if not code:
        return False, "Staff number cannot be empty"

    params: dict = {"c": code}
    exclude_sql = ""
    if exclude_employee_id:
        params["eid"] = exclude_employee_id
        exclude_sql = "AND e.id <> :eid"

    emp = await db.execute(
        text(
            f"""
            SELECT emp_code, name FROM employees e
            WHERE UPPER(TRIM(e.emp_code)) = :c {exclude_sql}
            LIMIT 1
            """
        ),
        params,
    )
    row = emp.fetchone()
    if row:
        return False, f"Staff number already assigned to {row.name} ({row.emp_code})"

    user_params: dict = {"c": code}
    user_exclude = ""
    if exclude_employee_id:
        user_params["eid"] = exclude_employee_id
        user_exclude = "AND (u.employee_id IS NULL OR u.employee_id <> :eid)"

    user = await db.execute(
        text(
            f"""
            SELECT u.username, e.name AS emp_name
            FROM users u
            LEFT JOIN employees e ON e.id = u.employee_id
            WHERE UPPER(u.username) = :c {user_exclude}
            LIMIT 1
            """
        ),
        user_params,
    )
    urow = user.fetchone()
    if urow:
        label = urow.emp_name or urow.username
        return False, f"Login username already in use ({label})"

    return True, None


async def assert_emp_code_available(
    db: AsyncSession,
    emp_code: str,
    *,
    exclude_employee_id: str | None = None,
) -> str:
    """Raise StaffNumberError if staff number or login username is taken."""
    code = normalize_emp_code(emp_code)
    ok, message = await check_emp_code_available(db, code, exclude_employee_id=exclude_employee_id)
    if not ok:
        raise StaffNumberError(message or "Staff number is not available")
    return code


async def bump_sequence_for_emp_code(db: AsyncSession, emp_code: str) -> None:
    """Advance group counter so auto-allot never reuses a manually assigned number."""
    parsed = _sequence_from_emp_code(emp_code)
    if not parsed:
        return
    group_code, sequence = parsed
    await db.execute(
        text(
            """
            UPDATE staff_number_sequences
            SET last_number = GREATEST(last_number, :seq), updated_at = now()
            WHERE group_code = :g
            """
        ),
        {"g": group_code, "seq": sequence},
    )


async def preview_next_staff_number(db: AsyncSession, staff_group: str) -> str:
    group = validate_staff_group(staff_group)
    row = await db.execute(
        text("SELECT last_number FROM staff_number_sequences WHERE group_code = :g"),
        {"g": group},
    )
    found = row.fetchone()
    if not found:
        raise StaffNumberError(f"Staff number sequence for group '{group}' is not configured")
    return format_staff_number(group, int(found[0]) + 1)


async def allocate_staff_number(db: AsyncSession, staff_group: str) -> str:
    """Increment the group sequence atomically and return the new employee code."""
    group = validate_staff_group(staff_group)
    row = await db.execute(
        text(
            """
            UPDATE staff_number_sequences
            SET last_number = last_number + 1, updated_at = now()
            WHERE group_code = :g
            RETURNING last_number
            """
        ),
        {"g": group},
    )
    updated = row.fetchone()
    if not updated:
        raise StaffNumberError(f"Staff number sequence for group '{group}' is not configured")
    return format_staff_number(group, int(updated[0]))


async def resolve_new_staff_number(
    db: AsyncSession,
    *,
    staff_group: str,
    manual_code: str | None = None,
) -> str:
    """
    Allocate or validate a staff number for onboarding.
    Manual codes must match the staff group prefix; sequence counter is synced.
    """
    group = validate_staff_group(staff_group)
    if manual_code and manual_code.strip():
        code = validate_emp_code_for_group(manual_code, group)
        await assert_emp_code_available(db, code)
        await bump_sequence_for_emp_code(db, code)
        return code

    code = await allocate_staff_number(db, group)
    ok, message = await check_emp_code_available(db, code)
    if not ok:
        raise StaffNumberError(
            message or f"Allocated staff number {code} is already in use — run sequence sync"
        )
    return code


async def sync_sequence_from_emp_code(db: AsyncSession, emp_code: str) -> None:
    """Alias for bump_sequence_for_emp_code (used after profile edits)."""
    await bump_sequence_for_emp_code(db, emp_code)


async def sync_sequences_from_employees(db: AsyncSession) -> dict[str, int]:
    """Raise each group counter to the highest matching emp_code already in use."""
    rows = await db.execute(text("SELECT emp_code FROM employees"))
    max_by_group: dict[str, int] = {code: 0 for code in STAFF_GROUP_CODES}
    for (emp_code,) in rows.fetchall():
        parsed = _sequence_from_emp_code(emp_code)
        if parsed:
            group_code, sequence = parsed
            max_by_group[group_code] = max(max_by_group[group_code], sequence)

    for group_code, max_num in max_by_group.items():
        if max_num > 0:
            await db.execute(
                text(
                    """
                    UPDATE staff_number_sequences
                    SET last_number = GREATEST(last_number, :max_num), updated_at = now()
                    WHERE group_code = :g
                    """
                ),
                {"g": group_code, "max_num": max_num},
            )
    return max_by_group
