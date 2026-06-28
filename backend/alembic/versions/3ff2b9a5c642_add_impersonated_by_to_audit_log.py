"""add impersonated_by to audit_log

Revision ID: 3ff2b9a5c642
Revises: 1a253f58099e
Create Date: 2026-06-28 18:25:52.509234

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3ff2b9a5c642'
down_revision: Union[str, None] = '1a253f58099e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('audit_log', sa.Column('impersonated_by', sa.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))


def downgrade() -> None:
    op.drop_constraint('audit_log_impersonated_by_fkey', 'audit_log', type_='foreignkey')
    op.drop_column('audit_log', 'impersonated_by')