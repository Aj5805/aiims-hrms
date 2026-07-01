"""Seed per-group staff number sequences and sync counters from existing emp codes."""

import re

from sqlalchemy import text

from app.data.staff_number_groups import STAFF_NUMBER_GROUPS

_PREFIX_PATTERNS: dict[str, re.Pattern[str]] = {
    code: re.compile(
        rf"^{re.escape(spec['prefix'])}(\d{{{spec['pad_width']}}})$"
    )
    for code, spec in STAFF_NUMBER_GROUPS.items()
}


def run(session):
    for code, spec in STAFF_NUMBER_GROUPS.items():
        session.execute(
            text(
                """
                INSERT INTO staff_number_sequences (group_code, label, prefix, pad_width, last_number)
                VALUES (:code, :label, :prefix, :pad, 0)
                ON CONFLICT (group_code) DO UPDATE SET
                    label = EXCLUDED.label,
                    prefix = EXCLUDED.prefix,
                    pad_width = EXCLUDED.pad_width
                """
            ),
            {
                "code": code,
                "label": spec["label"],
                "prefix": spec["prefix"],
                "pad": spec["pad_width"],
            },
        )

    max_by_group = {code: 0 for code in STAFF_NUMBER_GROUPS}
    for (emp_code,) in session.execute(text("SELECT emp_code FROM employees")).fetchall():
        code = str(emp_code).strip().upper()
        for group_code, pattern in _PREFIX_PATTERNS.items():
            match = pattern.match(code)
            if match:
                sequence = int(match.group(1))
                if sequence >= 1:
                    max_by_group[group_code] = max(max_by_group[group_code], sequence)

    for group_code, max_num in max_by_group.items():
        if max_num > 0:
            session.execute(
                text(
                    """
                    UPDATE staff_number_sequences
                    SET last_number = GREATEST(last_number, :max_num), updated_at = now()
                    WHERE group_code = :g
                    """
                ),
                {"g": group_code, "max_num": max_num},
            )
            spec = STAFF_NUMBER_GROUPS[group_code]
            print(
                f"    {group_code} counter synced to {max_num} "
                f"(next {spec['prefix']}{max_num + 1:0{spec['pad_width']}d})"
            )
