"""make datetime columns timezone-aware

Revision ID: c6e7032b31ac
Revises: 082fed19d848
Create Date: 2026-09-05 17:10:47.550590

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c6e7032b31ac'
down_revision: Union[str, Sequence[str], None] = '082fed19d848'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Existing values were always written as UTC but stored without an offset,
# so the cast must say "these naive values are UTC" explicitly — otherwise
# Postgres reinterprets them using the migration session's timezone setting.
COLUMNS = [
    ("businesssummary", "created_at"),
    ("chatmessage", "created_at"),
    ("chatsession", "created_at"),
    ("chatsession", "last_message_at"),
    ("filingsection", "created_at"),
    ("financials", "created_at"),
    ("user", "limit_resets_at"),
    ("watchlist", "created_at"),
]


def upgrade() -> None:
    """Upgrade schema."""
    for table, column in COLUMNS:
        op.alter_column(
            table, column,
            existing_type=postgresql.TIMESTAMP(),
            type_=sa.DateTime(timezone=True),
            existing_nullable=False,
            postgresql_using=f"{column} AT TIME ZONE 'UTC'",
        )


def downgrade() -> None:
    """Downgrade schema."""
    for table, column in reversed(COLUMNS):
        op.alter_column(
            table, column,
            existing_type=sa.DateTime(timezone=True),
            type_=postgresql.TIMESTAMP(),
            existing_nullable=False,
            postgresql_using=f"{column} AT TIME ZONE 'UTC'",
        )
