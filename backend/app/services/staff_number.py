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
    "preview_next_staff_number",
    "resolve_staff_group",
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


def _sequence_from_emp_code(emp_code: str) -> tuple[str, int] | None:
    code = str(emp_code).strip().upper()
    for group_code, pattern in _PREFIX_PATTERNS.items():
        match = pattern.match(code)
        if match:
            sequence = int(match.group(1))
            return group_code, sequence if sequence >= 1 else None
    return None


def validate_staff_group(group_code: str) -> str:
    code = (group_code or "").strip().upper()
    if code not in STAFF_GROUP_CODES:
        raise StaffNumberError(
            f"Unknown staff group '{group_code}'. "
            f"Allowed: {', '.join(sorted(STAFF_GROUP_CODES))}"
        )
    return code


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
    """Increment the group sequence and return the new employee code (caller must commit)."""
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
