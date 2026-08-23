"""Add BusinessSummary table

Revision ID: 8c58b3a2deb8
Revises: 70a727a6ea72
Create Date: 2026-08-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '8c58b3a2deb8'
down_revision: Union[str, Sequence[str], None] = '70a727a6ea72'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('businesssummary',
    sa.Column('stock_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('accession_number', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('content', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['stock_id'], ['stock.id'], ),
    sa.PrimaryKeyConstraint('stock_id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('businesssummary')
