"""add daily_limit and limit_resets_at to user

Revision ID: 4fb09b7f30ec
Revises: 0db27fa26920
Create Date: 2026-09-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4fb09b7f30ec'
down_revision: Union[str, Sequence[str], None] = '0db27fa26920'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('user', sa.Column('daily_limit', sa.Integer(), nullable=True))
    op.add_column('user', sa.Column('limit_resets_at', sa.DateTime(), nullable=True))
    # Backfill existing rows before enforcing NOT NULL: give existing accounts
    # the default quota and a fresh window starting a day from now.
    op.execute('UPDATE "user" SET daily_limit = 20 WHERE daily_limit IS NULL')
    op.execute("UPDATE \"user\" SET limit_resets_at = now() + interval '1 day' WHERE limit_resets_at IS NULL")
    op.alter_column('user', 'daily_limit', nullable=False)
    op.alter_column('user', 'limit_resets_at', nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user', 'limit_resets_at')
    op.drop_column('user', 'daily_limit')
