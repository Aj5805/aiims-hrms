"""Deferred alignment items: master is_active, HOD assignments, nodal hierarchy, immutable ledger.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "departments",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "designations",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "leave_types",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )

    op.create_table(
        "dept_hod_assignments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("department_id", UUID(as_uuid=True), sa.ForeignKey("departments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("hod_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("assigned_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.UniqueConstraint("department_id", "hod_user_id", name="uq_dept_hod"),
    )
    op.create_index("ix_dept_hod_dept_id", "dept_hod_assignments", ["department_id"])
    op.create_index("ix_dept_hod_user_id", "dept_hod_assignments", ["hod_user_id"])
    op.execute(
        """
        CREATE UNIQUE INDEX uq_dept_hod_active_dept
        ON dept_hod_assignments (department_id)
        WHERE is_active = true
        """
    )

    op.add_column(
        "users",
        sa.Column("parent_nodal_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )

    op.create_table(
        "leave_balance_ledger",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("balance_id", UUID(as_uuid=True), sa.ForeignKey("leave_balances.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("leave_type_id", UUID(as_uuid=True), sa.ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False),
        sa.Column("leave_year", sa.Integer(), nullable=False),
        sa.Column("txn_type", sa.String(30), nullable=False),
        sa.Column("amount", sa.Numeric(8, 2), nullable=False),
        sa.Column("field_affected", sa.String(30), nullable=False),
        sa.Column("reference_type", sa.String(30), nullable=True),
        sa.Column("reference_id", UUID(as_uuid=True), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("actor_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("impersonated_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("snapshot", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_lbl_balance_id", "leave_balance_ledger", ["balance_id"])
    op.create_index("ix_lbl_employee_id", "leave_balance_ledger", ["employee_id", "leave_type_id"])
    op.create_index("ix_lbl_created_at", "leave_balance_ledger", ["created_at"])

    op.execute(
        """
        CREATE OR REPLACE FUNCTION leave_balance_ledger_no_mutation()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'leave_balance_ledger is append-only — UPDATE and DELETE are not permitted';
        END;
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_leave_balance_ledger_no_update
        BEFORE UPDATE ON leave_balance_ledger
        FOR EACH ROW EXECUTE FUNCTION leave_balance_ledger_no_mutation()
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_leave_balance_ledger_no_delete
        BEFORE DELETE ON leave_balance_ledger
        FOR EACH ROW EXECUTE FUNCTION leave_balance_ledger_no_mutation()
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_leave_balance_ledger_no_delete ON leave_balance_ledger")
    op.execute("DROP TRIGGER IF EXISTS trg_leave_balance_ledger_no_update ON leave_balance_ledger")
    op.execute("DROP FUNCTION IF EXISTS leave_balance_ledger_no_mutation()")
    op.drop_index("ix_lbl_created_at", table_name="leave_balance_ledger")
    op.drop_index("ix_lbl_employee_id", table_name="leave_balance_ledger")
    op.drop_index("ix_lbl_balance_id", table_name="leave_balance_ledger")
    op.drop_table("leave_balance_ledger")

    op.drop_column("users", "parent_nodal_user_id")

    op.execute("DROP INDEX IF EXISTS uq_dept_hod_active_dept")
    op.drop_index("ix_dept_hod_user_id", table_name="dept_hod_assignments")
    op.drop_index("ix_dept_hod_dept_id", table_name="dept_hod_assignments")
    op.drop_table("dept_hod_assignments")

    op.drop_column("leave_types", "is_active")
    op.drop_column("designations", "is_active")
    op.drop_column("departments", "is_active")
