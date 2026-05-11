"""phase_14_loops_and_distance_required

Adds:
  - category.requires_distance (Boolean, default True)
  - activity.is_loop           (Boolean, default False)
  - activity.lap_count         (Integer, default 1)

Seeds requires_distance = False for categories whose calorie burn is
purely time-driven (no meaningful distance): Yoga, Rock Climbing,
Bird Watching, Gardening, Pilates.

Revision ID: d92c7f4b8e15
Revises: c84a1f2e6d9b
Create Date: 2026-05-11 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd92c7f4b8e15'
down_revision: Union[str, Sequence[str], None] = 'c84a1f2e6d9b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NON_DISTANCE_CATEGORIES = [
    "Yoga",
    "Pilates",
    "Rock Climbing",
    "Bird Watching",
    "Gardening",
    "Strength",
    "CrossFit",
    "HIIT",
    "Dancing",
]


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('category', sa.Column('requires_distance', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('activity', sa.Column('is_loop', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('activity', sa.Column('lap_count', sa.Integer(), server_default='1', nullable=False))

    conn = op.get_bind()
    for name in NON_DISTANCE_CATEGORIES:
        conn.execute(
            sa.text('UPDATE category SET requires_distance = false WHERE name = :name'),
            {"name": name},
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('activity', 'lap_count')
    op.drop_column('activity', 'is_loop')
    op.drop_column('category', 'requires_distance')
