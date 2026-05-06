"""event_sponsors table

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-05-05 10:00:00
"""
from typing import Sequence, Union

from alembic import op


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS event_sponsors (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            user_service_id uuid NOT NULL REFERENCES user_services(id) ON DELETE CASCADE,
            vendor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            invited_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status text NOT NULL DEFAULT 'pending',
            message text,
            contribution_amount numeric(12,2),
            response_note text,
            responded_at timestamp,
            created_at timestamp NOT NULL DEFAULT now(),
            updated_at timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_event_sponsors_event ON event_sponsors(event_id, status);
        CREATE INDEX IF NOT EXISTS idx_event_sponsors_service ON event_sponsors(user_service_id, status);
        CREATE INDEX IF NOT EXISTS idx_event_sponsors_vendor ON event_sponsors(vendor_user_id, status);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_event_sponsors_active
          ON event_sponsors(event_id, user_service_id)
          WHERE status IN ('pending','accepted');
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS event_sponsors;")
