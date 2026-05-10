"""event invitation template selection

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-05-07 10:00:00
"""
from typing import Sequence, Union

from alembic import op


revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE events
            ADD COLUMN IF NOT EXISTS invitation_template_id text,
            ADD COLUMN IF NOT EXISTS invitation_accent_color text,
            ADD COLUMN IF NOT EXISTS invitation_sample_names jsonb;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE events
            DROP COLUMN IF EXISTS invitation_template_id,
            DROP COLUMN IF EXISTS invitation_accent_color,
            DROP COLUMN IF EXISTS invitation_sample_names;
        """
    )
