"""Atomic institution-wide staff-number allocation (7-digit, unique, never reused)."""

from __future__ import annotations

import re

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.staff_number_groups import (
    GLOBAL_SEQUENCE_CODE,
    STAFF_GROUP_CODES,
    STAFF_NUMBER_BASE,
    STAFF_NUMBER_GROUPS,
    STAFF_NUMBER_WIDTH,
    format_staff_number,
    resolve_staff_group,
)

__all__ = [
    "STAFF_GROUP_CODES",
    "STAFF_NUMBER_GROUPS",
    "STAFF_NUMBER_WIDTH",
    "allocate_staff_number",
    "preview_next_staff_number",
    "resolve_staff_group",
    "sync_sequences_from_employees",
    "validate_staff_group",
]


class StaffNumberError(ValueError):
    pass


_NUMERIC_CODE = re.compile(r"^1\d{6}$")


def _sequence_from_emp_code(emp_code: str) -> int | None:
    code = str(emp_code).strip()
    if not _NUMERIC_CODE.match(code):
        return None
    sequence = int(code) - STAFF_NUMBER_BASE
    return sequence if sequence >= 1 else None


def validate_staff_group(group_code: str) -> str:
    code = (group_code or "").strip()
    if code not in STAFF_GROUP_CODES:
        raise StaffNumberError(
            f"Unknown staff group '{group_code}'. "
            f"Allowed: {', '.join(sorted(STAFF_GROUP_CODES))}"
        )
    return code


async def preview_next_staff_number(db: AsyncSession, staff_group: str | None = None) -> str:
    if staff_group:
        validate_staff_group(staff_group)
    row = await db.execute(
        text("SELECT last_number FROM staff_number_sequences WHERE group_code = :g"),
        {"g": GLOBAL_SEQUENCE_CODE},
    )
    found = row.fetchone()
    if not found:
        raise StaffNumberError("Global staff number sequence is not configured")
    return format_staff_number(int(found[0]) + 1)


async def allocate_staff_number(db: AsyncSession, staff_group: str) -> str:
    """Increment the global sequence and return the new employee code (caller must commit)."""
    validate_staff_group(staff_group)
    row = await db.execute(
        text(
            """
            UPDATE staff_number_sequences
            SET last_number = last_number + 1, updated_at = now()
            WHERE group_code = :g
            RETURNING last_number
            """
        ),
        {"g": GLOBAL_SEQUENCE_CODE},
    )
    updated = row.fetchone()
    if not updated:
        raise StaffNumberError("Global staff number sequence is not configured")
    return format_staff_number(int(updated[0]))


async def sync_sequences_from_employees(db: AsyncSession) -> int:
    """Raise the global counter to the highest numeric emp_code already in use."""
    rows = await db.execute(text("SELECT emp_code FROM employees"))
    max_num = 0
    for (emp_code,) in rows.fetchall():
        sequence = _sequence_from_emp_code(emp_code)
        if sequence is not None:
            max_num = max(max_num, sequence)
    if max_num > 0:
        await db.execute(
            text(
                """
                UPDATE staff_number_sequences
                SET last_number = GREATEST(last_number, :max_num), updated_at = now()
                WHERE group_code = :g
                """
            ),
            {"g": GLOBAL_SEQUENCE_CODE, "max_num": max_num},
        )
    return max_num
