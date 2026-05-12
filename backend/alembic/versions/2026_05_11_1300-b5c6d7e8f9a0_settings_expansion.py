"""Settings expansion - notifications, privacy, security, preferences, sessions

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
Create Date: 2026-05-11 13:00:00
"""
from typing import Sequence, Union
from alembic import op

revision: str = "b5c6d7e8f9a0"
down_revision: Union[str, None] = "a4b5c6d7e8f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    ALTER TABLE user_settings
      ADD COLUMN IF NOT EXISTS sms_notifications boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS login_alerts boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS marketing_emails boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS weekly_digest boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS rsvp_notifications boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS contribution_notifications boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS mention_notifications boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS quiet_hours_start text DEFAULT '22:00',
      ADD COLUMN IF NOT EXISTS quiet_hours_end text DEFAULT '07:00',
      ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TZS',
      ADD COLUMN IF NOT EXISTS theme text DEFAULT 'system',
      ADD COLUMN IF NOT EXISTS date_format text DEFAULT 'DD/MM/YYYY',
      ADD COLUMN IF NOT EXISTS time_format text DEFAULT '24h',
      ADD COLUMN IF NOT EXISTS two_factor_secret text;
    """)

    op.execute("""
    ALTER TABLE user_privacy_settings
      ADD COLUMN IF NOT EXISTS show_last_seen boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS show_read_receipts boolean DEFAULT true;
    """)

    op.execute("""
    ALTER TABLE user_sessions
      ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS last_active_at timestamp DEFAULT now(),
      ADD COLUMN IF NOT EXISTS device_name text,
      ADD COLUMN IF NOT EXISTS user_agent text;
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active);")


def downgrade() -> None:
    pass
