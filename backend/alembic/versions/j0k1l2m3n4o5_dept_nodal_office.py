"""Department → nodal office mapping for HOD routing and nodal scope.

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-07-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "j0k1l2m3n4o5"
down_revision: Union[str, None] = "i9j0k1l2m3n4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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
    op.execute("DROP INDEX IF EXISTS uq_nodal_offices_active_scheme")


def downgrade() -> None:
    op.execute(
        """
        CREATE UNIQUE INDEX uq_nodal_offices_active_scheme
        ON nodal_offices (leave_scheme)
        WHERE is_active = true
        """
    )
    op.drop_index("ix_departments_nodal_office_id", table_name="departments")
    op.drop_column("departments", "nodal_office_id")
