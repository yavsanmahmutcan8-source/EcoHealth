"""phase_10_11_12_user_creator_fields

Revision ID: bd70b6ce6dba
Revises: 9eaa982bca11
Create Date: 2026-05-08 11:57:55.244738

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bd70b6ce6dba'
down_revision: Union[str, Sequence[str], None] = '9eaa982bca11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('activity', sa.Column('creator_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'activity', 'user', ['creator_id'], ['id'])
    op.add_column('user', sa.Column('fitness_level', sa.String(), nullable=True))
    op.add_column('user', sa.Column('onboarding_complete', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('user', sa.Column('favorite_categories', sa.JSON(), nullable=True))
    op.add_column('user', sa.Column('creator_completions_count', sa.Integer(), server_default='0', nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user', 'creator_completions_count')
    op.drop_column('user', 'favorite_categories')
    op.drop_column('user', 'onboarding_complete')
    op.drop_column('user', 'fitness_level')
    op.drop_constraint(None, 'activity', type_='foreignkey')
    op.drop_column('activity', 'creator_id')
