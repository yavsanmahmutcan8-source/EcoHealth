"""phase_13_calories_and_distance

Adds MET-based calorie infrastructure:
  - user.total_calories_burned (Float, default 0)
  - activity.distance_km        (Float, default 0)
  - category.calorie_met        (Float, default 4.0, NOT NULL)
Then seeds MET values for common category names.

Revision ID: c84a1f2e6d9b
Revises: bd70b6ce6dba
Create Date: 2026-05-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c84a1f2e6d9b'
down_revision: Union[str, Sequence[str], None] = 'bd70b6ce6dba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Reference MET table (scientific defaults). Admin can tune per category later.
MET_SEED = {
    "Yoga": 2.5,
    "Walking": 3.5,
    "Hiking": 6.0,
    "Running": 9.8,
    "Cycling": 7.5,
    "Swimming": 8.0,
    "Climbing": 8.0,
    "Kayaking": 5.0,
    "Skiing": 7.0,
    "Snowboarding": 5.3,
    "Surfing": 3.0,
    "Dancing": 5.0,
    "Pilates": 3.0,
    "CrossFit": 8.0,
    "Strength": 6.0,
    "HIIT": 8.0,
}


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('user', sa.Column('total_calories_burned', sa.Float(), server_default='0', nullable=True))
    op.add_column('activity', sa.Column('distance_km', sa.Float(), server_default='0', nullable=True))
    op.add_column('category', sa.Column('calorie_met', sa.Float(), server_default='4.0', nullable=False))

    # Seed MET values for any existing categories whose name matches the reference table.
    conn = op.get_bind()
    for name, met in MET_SEED.items():
        conn.execute(
            sa.text('UPDATE category SET calorie_met = :met WHERE name = :name'),
            {"met": met, "name": name},
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('category', 'calorie_met')
    op.drop_column('activity', 'distance_km')
    op.drop_column('user', 'total_calories_burned')
