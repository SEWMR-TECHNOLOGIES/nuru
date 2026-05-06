"""App version settings table for force-update prompts.

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-05-04 10:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, None] = "a2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS app_version_settings (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            platform text NOT NULL UNIQUE,
            latest_version text NOT NULL DEFAULT '1.0.0',
            latest_build integer NOT NULL DEFAULT 1,
            min_supported_build integer NOT NULL DEFAULT 1,
            force_update boolean NOT NULL DEFAULT false,
            update_url text,
            message text,
            created_at timestamp NOT NULL DEFAULT now(),
            updated_at timestamp NOT NULL DEFAULT now()
        );
        """
    )
    # Seed default rows for android and ios
    op.execute(
        """
        INSERT INTO app_version_settings (platform, latest_version, latest_build, min_supported_build, update_url, message)
        VALUES
          ('android', '1.0.0', 1, 1, 'https://play.google.com/store/apps/details?id=tz.nuru.app', 'A new Nuru update is available.'),
          ('ios', '1.0.0', 1, 1, 'https://apps.apple.com/app/nuru', 'A new Nuru update is available.')
        ON CONFLICT (platform) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS app_version_settings;")
