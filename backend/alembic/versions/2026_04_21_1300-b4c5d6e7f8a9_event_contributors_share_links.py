"""event_contributors share links (guest contribution payment URLs)

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-04-21 13:00:00.000000

Adds the columns + unique partial index needed to issue public, hashed-token
payment links to non-Nuru contributors. See app/services/share_links.py and
app/api/routes/public_contributions.py for usage.

Idempotent (IF NOT EXISTS) so re-running over an env where the raw SQL
sibling (app/migrations/2026_04_20_event_contributors_share_links.sql) was
already applied is safe.
"""
from alembic import op


revision = "b4c5d6e7f8a9"
down_revision = "a3b4c5d6e7f8"
branch_labels = None
depends_on = None


COLUMNS = [
    "share_token_hash             TEXT      NULL",
    "share_token_created_at       TIMESTAMP NULL",
    "share_token_expires_at       TIMESTAMP NULL",
    "share_token_revoked_at       TIMESTAMP NULL",
    "share_link_last_opened_at    TIMESTAMP NULL",
    "share_link_sms_last_sent_at  TIMESTAMP NULL",
]


def upgrade() -> None:
    for col in COLUMNS:
        op.execute(f"ALTER TABLE event_contributors ADD COLUMN IF NOT EXISTS {col};")

    # Hot path: every public page load looks up by SHA-256 hash of the token.
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_event_contributors_share_token_hash
          ON event_contributors(share_token_hash)
          WHERE share_token_hash IS NOT NULL;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_event_contributors_share_token_hash;")
    op.execute(
        """
        ALTER TABLE event_contributors
          DROP COLUMN IF EXISTS share_link_sms_last_sent_at,
          DROP COLUMN IF EXISTS share_link_last_opened_at,
          DROP COLUMN IF EXISTS share_token_revoked_at,
          DROP COLUMN IF EXISTS share_token_expires_at,
          DROP COLUMN IF EXISTS share_token_created_at,
          DROP COLUMN IF EXISTS share_token_hash;
        """
    )
