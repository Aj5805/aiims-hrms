"""Seed 023 — Administration staff use ADM prefix (not DEP).

Adds ADM sequence row and updates staff_group for ADMIN-category employees still on DEP.
Existing DEP-prefixed emp codes are left unchanged (legacy).
"""

from sqlalchemy import text

from app.data.staff_number_groups import STAFF_NUMBER_GROUPS


def run(session):
    spec = STAFF_NUMBER_GROUPS["ADM"]
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
            "code": "ADM",
            "label": spec["label"],
            "prefix": spec["prefix"],
            "pad": spec["pad_width"],
        },
    )

    result = session.execute(
        text(
            """
            UPDATE employees e
            SET staff_group = 'ADM'
            FROM employee_categories c
            WHERE e.category_id = c.id
              AND c.code = 'ADMIN'
              AND e.staff_group = 'DEP'
            """
        ),
    )
    if result.rowcount:
        print(f"  Updated staff_group DEP → ADM for {result.rowcount} admin employee(s)")
