"""drop stockreport table

Revision ID: 854ad5de7061
Revises: 702dc86f7300
Create Date: 2026-09-07 13:26:03.585457

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '854ad5de7061'
down_revision: Union[str, Sequence[str], None] = '702dc86f7300'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_table('stockreport')


def downgrade() -> None:
    """Downgrade schema."""
    # Recreated exactly as c8eefee9910f (the initial migration) declared it.
    op.create_table(
        'stockreport',
        sa.Column('id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('content', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
