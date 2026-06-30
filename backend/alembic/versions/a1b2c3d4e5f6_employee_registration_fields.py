"""add staff registration fields to employees

Revision ID: a1b2c3d4e5f6
Revises: 3ff2b9a5c642
Create Date: 2026-06-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "3ff2b9a5c642"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Personal
    op.add_column("employees", sa.Column("initial", sa.String(20), nullable=True))
    op.add_column("employees", sa.Column("address", sa.Text(), nullable=True))
    op.add_column("employees", sa.Column("permanent_address", sa.Text(), nullable=True))
    op.add_column("employees", sa.Column("marital_status", sa.String(20), nullable=True))
    op.add_column("employees", sa.Column("father_name", sa.String(200), nullable=True))
    op.add_column("employees", sa.Column("blood_group", sa.String(10), nullable=True))
    op.add_column("employees", sa.Column("photo", sa.String(500), nullable=True))
    # Contact
    op.add_column("employees", sa.Column("mobile", sa.String(15), nullable=True))
    op.add_column("employees", sa.Column("alt_mobile", sa.String(15), nullable=True))
    # Education
    op.add_column("employees", sa.Column("last_qualification", sa.String(200), nullable=True))
    # Employment extras
    op.add_column("employees", sa.Column("doj_actual", sa.Date(), nullable=True))
    op.add_column("employees", sa.Column("dol_last_working", sa.Date(), nullable=True))
    op.add_column("employees", sa.Column("next_increment_date", sa.Date(), nullable=True))
    op.add_column("employees", sa.Column("staff_group", sa.String(50), nullable=True))
    op.add_column(
        "employees",
        sa.Column("is_physically_handicapped", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column("employees", sa.Column("type_of_flat", sa.String(50), nullable=True))
    # Social (govt forms)
    op.add_column("employees", sa.Column("caste_category", sa.String(30), nullable=True))
    op.add_column("employees", sa.Column("religion", sa.String(50), nullable=True))
    # Banking
    op.add_column("employees", sa.Column("bank_account_no", sa.String(30), nullable=True))
    op.add_column("employees", sa.Column("bank_name", sa.String(150), nullable=True))
    op.add_column("employees", sa.Column("ifsc_code", sa.String(15), nullable=True))
    # IDs & payroll
    op.add_column("employees", sa.Column("pan", sa.String(10), nullable=True))
    op.add_column("employees", sa.Column("aadhaar", sa.String(12), nullable=True))
    op.add_column("employees", sa.Column("nps_or_gpf_no", sa.String(30), nullable=True))
    op.add_column("employees", sa.Column("pfms_code", sa.String(30), nullable=True))
    # Pay snapshot
    op.add_column("employees", sa.Column("grade", sa.String(20), nullable=True))
    op.add_column("employees", sa.Column("pay_level", sa.String(20), nullable=True))


def downgrade() -> None:
    for col in (
        "pay_level", "grade", "pfms_code", "nps_or_gpf_no", "aadhaar", "pan",
        "ifsc_code", "bank_name", "bank_account_no", "religion", "caste_category",
        "type_of_flat", "is_physically_handicapped", "staff_group", "next_increment_date",
        "dol_last_working", "doj_actual", "last_qualification", "alt_mobile", "mobile",
        "photo", "blood_group", "father_name", "marital_status", "permanent_address",
        "address", "initial",
    ):
        op.drop_column("employees", col)
