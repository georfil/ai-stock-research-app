"""change financialline period from str to int

Revision ID: 702dc86f7300
Revises: c6e7032b31ac
Create Date: 2026-09-06 17:00:23.027989

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '702dc86f7300'
down_revision: Union[str, Sequence[str], None] = 'c6e7032b31ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Existing periods are stored as ISO dates (e.g. "2024-12-31") — take the
    # leading 4 digits as the year when converting the column to an integer.
    op.alter_column(
        'financialline', 'period',
        existing_type=sa.VARCHAR(),
        type_=sa.INTEGER(),
        postgresql_using="substring(period from 1 for 4)::integer",
        existing_nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Lossy: the original month/day cannot be recovered, so this restores
    # only the year as a string (e.g. 2024 -> "2024").
    op.alter_column(
        'financialline', 'period',
        existing_type=sa.INTEGER(),
        type_=sa.VARCHAR(),
        existing_nullable=False,
    )
