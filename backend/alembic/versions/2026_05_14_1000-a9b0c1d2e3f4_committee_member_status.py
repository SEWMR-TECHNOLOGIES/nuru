"""event_committee_members.status

Revision ID: a9b0c1d2e3f4
Revises: e9f0a1b2c3d4
Create Date: 2026-05-14 10:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "a9b0c1d2e3f4"
down_revision: Union[str, None] = "e9f0a1b2c3d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE event_committee_members
            ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_committee_members_event_status
            ON event_committee_members (event_id, status);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_committee_members_event_status;")
    op.execute("ALTER TABLE event_committee_members DROP COLUMN IF EXISTS status;")
