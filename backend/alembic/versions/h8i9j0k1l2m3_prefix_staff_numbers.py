"""Switch staff numbering to per-group prefixed sequences (FAC0001, NUR0001, …).

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-07-01

"""
from typing import Sequence, Union

from alembic import op


revision: str = "h8i9j0k1l2m3"
down_revision: Union[str, None] = "g7h8i9j0k1l2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_GROUPS = [
    ("FAC", "Faculty", "FAC", 4),
    ("NUR", "Nursing Officer", "NUR", 4),
    ("NFS", "Senior Nursing Officer", "NFS", 4),
    ("DEP", "Administration / Department", "DEP", 4),
    ("CON", "College of Nursing", "CON", 4),
    ("PGJR", "Junior Resident (Academic)", "PGJR", 4),
    ("PGNA", "P.G. Student / JR (Non-Academic)", "PGNA", 4),
    ("SRAC", "Senior Resident (Academic)", "SRAC", 4),
    ("SRNA", "Senior Resident (Non-Academic)", "SRNA", 4),
]

_LEGACY_GROUPS = (
    "GLOBAL",
    "admin",
    "faculty",
    "nursingofficer",
    "seniorNursingofficer",
    "collegeOfNursing",
    "SR",
    "JR",
    "PG",
)


def upgrade() -> None:
    op.execute(
        f"DELETE FROM staff_number_sequences WHERE group_code IN ({', '.join(repr(g) for g in _LEGACY_GROUPS)})"
    )
    for code, label, prefix, pad in _GROUPS:
        op.execute(
            f"""
            INSERT INTO staff_number_sequences (group_code, label, prefix, pad_width, last_number)
            VALUES ('{code}', '{label}', '{prefix}', {pad}, 0)
            ON CONFLICT (group_code) DO UPDATE SET
                label = EXCLUDED.label,
                prefix = EXCLUDED.prefix,
                pad_width = EXCLUDED.pad_width
            """
        )

    for code, _, prefix, pad in _GROUPS:
        op.execute(
            f"""
            UPDATE staff_number_sequences AS s
            SET last_number = GREATEST(
                s.last_number,
                COALESCE((
                    SELECT MAX(
                        substring(e.emp_code from '{prefix}(\\d{{{pad}}})')::integer
                    )
                    FROM employees e
                    WHERE upper(e.emp_code) ~ '^{prefix}\\d{{{pad}}}$'
                ), 0)
            ),
            updated_at = now()
            WHERE s.group_code = '{code}'
            """
        )


def downgrade() -> None:
    op.execute(
        f"DELETE FROM staff_number_sequences WHERE group_code IN ({', '.join(repr(g) for g, *_ in _GROUPS)})"
    )
    op.execute(
        """
        INSERT INTO staff_number_sequences (group_code, label, prefix, pad_width, last_number)
        VALUES ('GLOBAL', 'Institution-wide', '', 7, 0)
        ON CONFLICT (group_code) DO NOTHING
        """
    )
