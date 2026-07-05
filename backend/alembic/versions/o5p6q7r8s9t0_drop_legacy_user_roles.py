"""Remap legacy user roles (ESTABLISHMENT_OFFICER, REGISTRAR, DEAN_ACADEMIC) to current set.

Revision ID: o5p6q7r8s9t0
Revises: n4o5p6q7r8s9
"""

from typing import Sequence, Union

from alembic import op

revision: str = "o5p6q7r8s9t0"
down_revision: Union[str, None] = "n4o5p6q7r8s9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        UPDATE users SET role = 'NODAL_OFFICER'
        WHERE role IN ('ESTABLISHMENT_OFFICER', 'REGISTRAR', 'ESTABLISHMENT')
          AND id IN (SELECT officer_user_id FROM nodal_offices WHERE officer_user_id IS NOT NULL)
    """)
    op.execute("""
        UPDATE users SET role = 'STAFF'
        WHERE role IN ('ESTABLISHMENT_OFFICER', 'REGISTRAR', 'ESTABLISHMENT', 'DEAN_ACADEMIC')
    """)
    op.execute("""
        UPDATE workflow_steps SET approver_role = 'NODAL_OFFICER'
        WHERE approver_role IN ('ESTABLISHMENT_OFFICER', 'REGISTRAR', 'DEAN_ACADEMIC')
    """)


def downgrade() -> None:
    pass
