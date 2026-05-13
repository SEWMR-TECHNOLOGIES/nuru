"""moment media_deleted_at

Revision ID: c7d8e9f0a1b2
Revises: c6d7e8f9a0b1
Create Date: 2026-05-13 10:00:00
"""
from typing import Sequence, Union
from alembic import op


revision: str = "c7d8e9f0a1b2"
down_revision: Union[str, None] = "c6d7e8f9a0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE user_moments
          ADD COLUMN IF NOT EXISTS media_deleted_at TIMESTAMP NULL;
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_moments_expires_media_deleted
          ON user_moments (expires_at)
          WHERE media_deleted_at IS NULL;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_user_moments_expires_media_deleted;")
    op.execute("ALTER TABLE user_moments DROP COLUMN IF EXISTS media_deleted_at;")
