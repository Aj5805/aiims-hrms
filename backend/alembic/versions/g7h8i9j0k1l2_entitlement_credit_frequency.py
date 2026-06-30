"""Add credit_frequency to leave_entitlement_rules."""

from alembic import op
import sqlalchemy as sa

revision = "g7h8i9j0k1l2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "leave_entitlement_rules",
        sa.Column(
            "credit_frequency",
            sa.String(20),
            nullable=False,
            server_default="ANNUAL",
            comment="ANNUAL | HALF_YEARLY | MONTHLY",
        ),
    )
    op.execute("""
        UPDATE leave_entitlement_rules ler
        SET credit_frequency = 'HALF_YEARLY'
        FROM leave_types lt
        WHERE ler.leave_type_id = lt.id AND lt.code = 'EL'
    """)
    op.execute("""
        UPDATE leave_entitlement_rules ler
        SET credit_frequency = 'MONTHLY'
        WHERE COALESCE(ler.prorata_rate, 0) > 0
          AND ler.credit_frequency = 'ANNUAL'
    """)


def downgrade():
    op.drop_column("leave_entitlement_rules", "credit_frequency")
