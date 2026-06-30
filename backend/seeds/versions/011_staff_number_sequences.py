"""Seed global staff number sequence and sync counter from existing numeric emp codes."""

import re

from sqlalchemy import text

from app.data.staff_number_groups import GLOBAL_SEQUENCE_CODE, STAFF_NUMBER_BASE, STAFF_NUMBER_WIDTH

_NUMERIC_CODE = re.compile(r"^1\d{6}$")


def run(session):
    session.execute(
        text(
            """
            INSERT INTO staff_number_sequences (group_code, label, prefix, pad_width, last_number)
            VALUES (:code, 'Institution-wide', '', :pad, 0)
            ON CONFLICT (group_code) DO UPDATE SET
                label = EXCLUDED.label,
                prefix = EXCLUDED.prefix,
                pad_width = EXCLUDED.pad_width
            """
        ),
        {"code": GLOBAL_SEQUENCE_CODE, "pad": STAFF_NUMBER_WIDTH},
    )

    max_num = 0
    for (emp_code,) in session.execute(text("SELECT emp_code FROM employees")).fetchall():
        code = str(emp_code).strip()
        if _NUMERIC_CODE.match(code):
            sequence = int(code) - STAFF_NUMBER_BASE
            if sequence >= 1:
                max_num = max(max_num, sequence)

    if max_num > 0:
        session.execute(
            text(
                """
                UPDATE staff_number_sequences
                SET last_number = GREATEST(last_number, :max_num), updated_at = now()
                WHERE group_code = :g
                """
            ),
            {"g": GLOBAL_SEQUENCE_CODE, "max_num": max_num},
        )
        print(f"    global staff number counter synced to sequence {max_num} (next {max_num + 1:07d} → {STAFF_NUMBER_BASE + max_num + 1})")
