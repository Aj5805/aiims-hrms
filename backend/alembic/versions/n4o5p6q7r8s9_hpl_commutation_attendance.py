"""HPL commutation flag, remove COMMUTED leave type, attendance daily pipeline.

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "n4o5p6q7r8s9"
down_revision: Union[str, None] = "m3n4o5p6q7r8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _purge_commuted_leave_type():
    op.execute("""
        DELETE FROM leave_documents ld
        USING leave_applications a
        JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE ld.application_id = a.id AND lt.code = 'COMMUTED'
    """)
    op.execute("""
        DELETE FROM leave_approvals la
        USING leave_applications a
        JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE la.application_id = a.id AND lt.code = 'COMMUTED'
    """)
    op.execute("""
        DELETE FROM leave_balance_ledger lbl
        USING leave_balances lb
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lbl.balance_id = lb.id AND lt.code = 'COMMUTED'
    """)
    op.execute("""
        DELETE FROM leave_applications a
        USING leave_types lt
        WHERE a.leave_type_id = lt.id AND lt.code = 'COMMUTED'
    """)
    op.execute("""
        DELETE FROM leave_balances lb
        USING leave_types lt
        WHERE lb.leave_type_id = lt.id AND lt.code = 'COMMUTED'
    """)
    op.execute("""
        DELETE FROM leave_entitlement_rules ler
        USING leave_types lt
        WHERE ler.leave_type_id = lt.id AND lt.code = 'COMMUTED'
    """)
    op.execute("DELETE FROM leave_types WHERE code = 'COMMUTED'")
    op.execute("""
        UPDATE leave_types
        SET validation_rules = jsonb_set(
            COALESCE(validation_rules, '{}'::jsonb),
            '{incompatible_types}',
            '["EL", "HPL", "EOL"]'::jsonb,
            true
        )
        WHERE code = 'CL'
    """)


def upgrade():
    op.add_column(
        "leave_applications",
        sa.Column("is_commuted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )

    op.create_table(
        "attendance_daily",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("employees.id"), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("leave_derived_status", sa.String(20), nullable=True, comment="ON_LEAVE | ON_DUTY"),
        sa.Column("leave_type_code", sa.String(20), nullable=True),
        sa.Column("leave_application_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leave_applications.id"), nullable=True),
        sa.Column("is_commuted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("biometric_status", sa.String(20), nullable=True, comment="PRESENT | ABSENT | LATE | PARTIAL"),
        sa.Column("biometric_raw_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("attendance_raw.id"), nullable=True),
        sa.Column(
            "review_status",
            sa.String(20),
            server_default="PENDING",
            nullable=False,
            comment="PENDING | MATCHED | CONFLICT | OVERRIDDEN",
        ),
        sa.Column(
            "final_status",
            sa.String(20),
            nullable=False,
            comment="PRESENT | ABSENT | ON_LEAVE | HOLIDAY | WEEKEND | ON_DUTY",
        ),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finalized_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("employee_id", "attendance_date", name="uq_attendance_daily_emp_date"),
    )
    op.create_index("ix_attendance_daily_date", "attendance_daily", ["attendance_date"])

    _purge_commuted_leave_type()


def downgrade():
    op.drop_index("ix_attendance_daily_date", table_name="attendance_daily")
    op.drop_table("attendance_daily")
    op.drop_column("leave_applications", "is_commuted")
