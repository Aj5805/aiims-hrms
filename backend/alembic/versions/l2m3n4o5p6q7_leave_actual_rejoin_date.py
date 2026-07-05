"""Add actual_rejoin_date to leave applications.

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-07-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "l2m3n4o5p6q7"
down_revision: Union[str, None] = "k1l2m3n4o5p6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column(
        "leave_applications",
        sa.Column(
            "actual_rejoin_date",
            sa.Date(),
            nullable=True,
            comment="First day back at duty after cut-short modification",
        ),
    )


def downgrade():
    op.drop_column("leave_applications", "actual_rejoin_date")
