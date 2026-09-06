"""add is_admin to user

Revision ID: 92f10f928f67
Revises: 4fb09b7f30ec
Create Date: 2026-09-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '92f10f928f67'
down_revision: Union[str, Sequence[str], None] = '4fb09b7f30ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('user', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.alter_column('user', 'is_admin', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user', 'is_admin')
