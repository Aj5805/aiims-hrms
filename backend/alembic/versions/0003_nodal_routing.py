"""Migration 0003 — Nodal routing: dept_nodal_assignments table.

Maps each department to its assigned nodal officer (user).
A department can have only one active nodal officer at a time.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_nodal_routing"
down_revision = "0002_auth_lockout_columns"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "dept_nodal_assignments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "department_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("departments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "nodal_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "assigned_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.UniqueConstraint("department_id", "nodal_user_id", name="uq_dept_nodal"),
    )
    op.create_index("ix_dept_nodal_dept_id", "dept_nodal_assignments", ["department_id"])
    op.create_index("ix_dept_nodal_user_id", "dept_nodal_assignments", ["nodal_user_id"])


def downgrade():
    op.drop_index("ix_dept_nodal_user_id", table_name="dept_nodal_assignments")
    op.drop_index("ix_dept_nodal_dept_id", table_name="dept_nodal_assignments")
    op.drop_table("dept_nodal_assignments")
