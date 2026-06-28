"""Add system settings and broadcasts

Revision ID: 1a253f58099e
Revises: 0003_nodal_routing
Create Date: 2026-06-28 17:36:10.378319

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1a253f58099e'
down_revision: Union[str, None] = '0003_nodal_routing'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # system_settings table
    op.create_table(
        'system_settings',
        sa.Column('key', sa.String(100), primary_key=True),
        sa.Column('value', sa.JSON(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_by', sa.UUID(), sa.ForeignKey('users.id'), nullable=True)
    )
    
    # Initialize maintenance_mode setting to false
    op.execute("INSERT INTO system_settings (key, value) VALUES ('maintenance_mode', 'false'::json)")

    # system_broadcasts table
    op.create_table(
        'system_broadcasts',
        sa.Column('id', sa.UUID(), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('type', sa.String(50), nullable=False, server_default='info'), # info, warning, error
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.UUID(), sa.ForeignKey('users.id'), nullable=True)
    )


def downgrade() -> None:
    op.drop_table('system_broadcasts')
    op.drop_table('system_settings')