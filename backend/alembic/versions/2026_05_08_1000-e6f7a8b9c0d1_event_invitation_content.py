"""event invitation content (per-template editable copy)

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-05-08 10:00:00
"""
from typing import Sequence, Union

from alembic import op


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # JSONB blob holding per-template editable copy:
    #   { headline, sub_headline, host_line, body, footer_note,
    #     dress_code_label, rsvp_label, ... }
    # Optional — when null, the template renders its own defaults.
    op.execute(
        """
        ALTER TABLE events
            ADD COLUMN IF NOT EXISTS invitation_content jsonb;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE events
            DROP COLUMN IF EXISTS invitation_content;
        """
    )
