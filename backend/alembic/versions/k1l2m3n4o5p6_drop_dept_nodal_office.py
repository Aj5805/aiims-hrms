"""Remove department → nodal office mapping (routing is category-only).

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-07-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "k1l2m3n4o5p6"
down_revision: Union[str, None] = "j0k1l2m3n4o5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_departments_nodal_office_id", table_name="departments")
    op.drop_column("departments", "nodal_office_id")


def downgrade() -> None:
    op.add_column(
        "departments",
        sa.Column(
            "nodal_office_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("nodal_offices.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_departments_nodal_office_id", "departments", ["nodal_office_id"])
