"""Switch staff numbering to single global 7-digit sequence.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-30

"""
from typing import Sequence, Union

from alembic import op


revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO staff_number_sequences (group_code, label, prefix, pad_width, last_number)
        VALUES ('GLOBAL', 'Institution-wide', '', 7, 0)
        ON CONFLICT (group_code) DO UPDATE SET
            label = EXCLUDED.label,
            prefix = EXCLUDED.prefix,
            pad_width = EXCLUDED.pad_width
        """
    )
    op.execute(
        """
        UPDATE staff_number_sequences AS s
        SET last_number = GREATEST(
            s.last_number,
            COALESCE((
                SELECT MAX(e.emp_code::bigint)
                FROM employees e
                WHERE e.emp_code ~ '^[0-9]{1,7}$'
            ), 0)
        ),
        updated_at = now()
        WHERE s.group_code = 'GLOBAL'
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM staff_number_sequences WHERE group_code = 'GLOBAL'")
