"""event invitation card templates (designer)

Revision ID: f7a8b9c0d1e2
Revises: d5e6f7a8b9c0
Create Date: 2026-05-10 10:00:00
"""
from typing import Sequence, Union

from alembic import op


revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS event_invitation_card_templates (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            organizer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name text NOT NULL DEFAULT 'Untitled design',
            design_json jsonb NOT NULL DEFAULT '{}'::jsonb,
            preview_image_url text,
            is_active boolean NOT NULL DEFAULT false,
            canvas_width integer NOT NULL DEFAULT 1080,
            canvas_height integer NOT NULL DEFAULT 1350,
            status text NOT NULL DEFAULT 'draft',
            platform text NOT NULL DEFAULT 'web',
            version integer NOT NULL DEFAULT 1,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS ix_eict_event_id ON event_invitation_card_templates(event_id);
        CREATE INDEX IF NOT EXISTS ix_eict_organizer_id ON event_invitation_card_templates(organizer_id);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_eict_active_per_event
            ON event_invitation_card_templates(event_id) WHERE is_active = true;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS uq_eict_active_per_event;
        DROP INDEX IF EXISTS ix_eict_organizer_id;
        DROP INDEX IF EXISTS ix_eict_event_id;
        DROP TABLE IF EXISTS event_invitation_card_templates;
        """
    )
