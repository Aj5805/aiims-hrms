"""Staff number sequences per staff group.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_GROUPS = [
    ("admin", "Administration", "ADM", 5),
    ("faculty", "Faculty", "FAC", 5),
    ("nursingofficer", "Nursing Officer", "NO", 4),
    ("seniorNursingofficer", "Senior Nursing Officer", "SNO", 4),
    ("collegeOfNursing", "College of Nursing", "CON", 4),
    ("SR", "Senior Resident", "SR", 4),
    ("JR", "Junior Resident", "JR", 4),
    ("PG", "P.G. Student", "PG", 4),
]


def upgrade() -> None:
    op.create_table(
        "staff_number_sequences",
        sa.Column("group_code", sa.String(50), primary_key=True),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("prefix", sa.String(10), nullable=False),
        sa.Column("pad_width", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("last_number", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    seq = sa.table(
        "staff_number_sequences",
        sa.column("group_code", sa.String),
        sa.column("label", sa.String),
        sa.column("prefix", sa.String),
        sa.column("pad_width", sa.Integer),
        sa.column("last_number", sa.Integer),
    )
    op.bulk_insert(
        seq,
        [
            {
                "group_code": code,
                "label": label,
                "prefix": prefix,
                "pad_width": pad,
                "last_number": 0,
            }
            for code, label, prefix, pad in _GROUPS
        ],
    )


def downgrade() -> None:
    op.drop_table("staff_number_sequences")
