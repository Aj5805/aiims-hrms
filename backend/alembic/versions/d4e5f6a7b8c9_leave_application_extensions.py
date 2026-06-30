"""Leave application kind, parent link, MC flag.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-30
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "leave_applications",
        sa.Column(
            "application_kind",
            sa.String(20),
            server_default="NEW",
            nullable=False,
            comment="NEW | CANCELLATION | MODIFICATION",
        ),
    )
    op.add_column(
        "leave_applications",
        sa.Column(
            "parent_application_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("leave_applications.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "leave_applications",
        sa.Column("mc_attached", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.create_index(
        "ix_leave_applications_parent",
        "leave_applications",
        ["parent_application_id"],
    )


def downgrade():
    op.drop_index("ix_leave_applications_parent", table_name="leave_applications")
    op.drop_column("leave_applications", "mc_attached")
    op.drop_column("leave_applications", "parent_application_id")
    op.drop_column("leave_applications", "application_kind")
