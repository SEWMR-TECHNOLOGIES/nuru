"""user_settings: notification_language preference

Revision ID: d8b1c2e3f4a5
Revises: c7a0e1f2b3d4
Create Date: 2026-05-22 10:00:00.000000

Adds a per-user preference controlling the language used for outgoing
SMS / WhatsApp / push / in-app notifications. Default is Swahili
('sw'); existing users are backfilled to 'sw'.
"""
from alembic import op
import sqlalchemy as sa


revision = "d8b1c2e3f4a5"
down_revision = "c7a0e1f2b3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE user_settings
            ADD COLUMN IF NOT EXISTS notification_language VARCHAR(2)
            NOT NULL DEFAULT 'sw';
        """
    )
    # Explicit backfill for any rows that might have been created with NULL
    # historically. Idempotent.
    op.execute(
        """
        UPDATE user_settings
        SET notification_language = 'sw'
        WHERE notification_language IS NULL
           OR notification_language NOT IN ('sw', 'en');
        """
    )
    op.execute(
        """
        ALTER TABLE user_settings
            ADD CONSTRAINT user_settings_notification_language_chk
            CHECK (notification_language IN ('sw', 'en'));
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE user_settings
            DROP CONSTRAINT IF EXISTS user_settings_notification_language_chk;
        """
    )
    op.execute(
        """
        ALTER TABLE user_settings
            DROP COLUMN IF EXISTS notification_language;
        """
    )
