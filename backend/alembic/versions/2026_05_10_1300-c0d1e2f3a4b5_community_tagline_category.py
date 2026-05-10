"""add tagline and category columns to communities

Revision ID: c0d1e2f3a4b5
Revises: b9c0d1e2f3a4
Create Date: 2026-05-10 13:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = "c0d1e2f3a4b5"
down_revision: Union[str, None] = "b9c0d1e2f3a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE communities
            ADD COLUMN IF NOT EXISTS tagline TEXT,
            ADD COLUMN IF NOT EXISTS category TEXT
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE communities
            DROP COLUMN IF EXISTS tagline,
            DROP COLUMN IF EXISTS category
        """
    )
