"""add passcode column to event_meetings

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-05-11 10:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE event_meetings
            ADD COLUMN IF NOT EXISTS passcode VARCHAR(32);
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE event_meetings DROP COLUMN IF EXISTS passcode;")
