"""add signup_intents + event_role columns to user_profiles

Revision ID: a4b5c6d7e8f9
Revises: f3a4b5c6d7e8
Create Date: 2026-05-11 12:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = "a4b5c6d7e8f9"
down_revision: Union[str, None] = "f3a4b5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE user_profiles
            ADD COLUMN IF NOT EXISTS signup_intents JSONB
            NOT NULL DEFAULT '[]'::jsonb;
        ALTER TABLE user_profiles
            ADD COLUMN IF NOT EXISTS event_role TEXT;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE user_profiles DROP COLUMN IF EXISTS signup_intents;
        ALTER TABLE user_profiles DROP COLUMN IF EXISTS event_role;
        """
    )
