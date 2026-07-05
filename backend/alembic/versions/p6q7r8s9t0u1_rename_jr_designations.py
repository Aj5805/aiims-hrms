"""Rename JR designations to detailed Academic / Non-Academic names.

Revision ID: p6q7r8s9t0u1
Revises: o5p6q7r8s9t0
"""

from typing import Sequence, Union

from alembic import op

revision: str = "p6q7r8s9t0u1"
down_revision: Union[str, None] = "o5p6q7r8s9t0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (old_name, new_name, category_code)
_JR_RENAMES = (
    ("Junior Resident", "Junior Resident (Non-Academic)", "JR_NA"),
    ("P.G. Student", "Junior Resident (Academic)", "JR_ACAD"),
    ("P.G.Student", "Junior Resident (Academic)", "JR_ACAD"),
)


def _rename_designation(old_name: str, new_name: str, category_code: str) -> None:
    op.execute(
        f"""
        DO $$
        DECLARE
            old_id uuid;
            new_id uuid;
            cat_id uuid;
        BEGIN
            SELECT id INTO cat_id FROM employee_categories WHERE code = '{category_code}';
            IF cat_id IS NULL THEN
                RETURN;
            END IF;

            SELECT id INTO old_id FROM designations WHERE name = '{old_name}';
            IF old_id IS NULL THEN
                RETURN;
            END IF;

            SELECT id INTO new_id FROM designations WHERE name = '{new_name}';
            IF new_id IS NOT NULL THEN
                UPDATE employees SET designation_id = new_id WHERE designation_id = old_id;
                DELETE FROM designations WHERE id = old_id;
                RETURN;
            END IF;

            UPDATE designations
            SET name = '{new_name}', category_id = cat_id
            WHERE id = old_id;
        END $$;
        """
    )


def upgrade() -> None:
    for old_name, new_name, category_code in _JR_RENAMES:
        _rename_designation(old_name, new_name, category_code)


def downgrade() -> None:
    _rename_designation("Junior Resident (Non-Academic)", "Junior Resident", "JR_ACAD")
    _rename_designation("Junior Resident (Academic)", "P.G. Student", "JR_ACAD")
