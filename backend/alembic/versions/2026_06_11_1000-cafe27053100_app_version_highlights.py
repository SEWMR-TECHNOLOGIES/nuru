"""Add highlights JSONB column to app_version_settings for "What's new" list.

Revision ID: cafe27053100
Revises: cafe27053000
Create Date: 2026-06-11 10:00:00
"""
from typing import Sequence, Union

from alembic import op


revision: str = "cafe27053100"
down_revision: Union[str, None] = "cafe27053000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE app_version_settings
        ADD COLUMN IF NOT EXISTS highlights jsonb NOT NULL DEFAULT '[]'::jsonb;
        """
    )
    # Seed a default set of highlights for any existing row that has none.
    op.execute(
        """
        UPDATE app_version_settings
        SET highlights = '[
            {"title": "Smoother event planning", "description": "Create and manage events with a simpler, faster flow."},
            {"title": "Improved tickets & check-in", "description": "Easier ticket management and a faster, more reliable check-in experience."},
            {"title": "Faster group updates", "description": "Real-time updates in event groups so everyone stays in the loop."}
        ]'::jsonb
        WHERE highlights IS NULL OR jsonb_array_length(highlights) = 0;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE app_version_settings DROP COLUMN IF EXISTS highlights;")
