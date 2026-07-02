"""Nodal offices master — category-based leave routing (CCS→Establishment, RESIDENCY→Registrar).

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-07-01

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "i9j0k1l2m3n4"
down_revision: Union[str, None] = "h8i9j0k1l2m3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "nodal_offices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(30), nullable=False, unique=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("leave_scheme", sa.String(20), nullable=False, comment="CCS | RESIDENCY"),
        sa.Column("officer_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_nodal_offices_leave_scheme", "nodal_offices", ["leave_scheme"])
    op.create_index("ix_nodal_offices_officer_user_id", "nodal_offices", ["officer_user_id"])
    op.execute(
        """
        CREATE UNIQUE INDEX uq_nodal_offices_active_scheme
        ON nodal_offices (leave_scheme)
        WHERE is_active = true
        """
    )

    op.add_column(
        "users",
        sa.Column("nodal_office_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("nodal_offices.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_users_nodal_office_id", "users", ["nodal_office_id"])


def downgrade() -> None:
    op.drop_index("ix_users_nodal_office_id", table_name="users")
    op.drop_column("users", "nodal_office_id")
    op.execute("DROP INDEX IF EXISTS uq_nodal_offices_active_scheme")
    op.drop_index("ix_nodal_offices_officer_user_id", table_name="nodal_offices")
    op.drop_index("ix_nodal_offices_leave_scheme", table_name="nodal_offices")
    op.drop_table("nodal_offices")
