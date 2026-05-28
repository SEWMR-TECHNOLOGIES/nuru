"""meeting_redirect_tokens table

Revision ID: f0d4e5b6c7a8
Revises: e9c2d3f4a5b6
Create Date: 2026-05-25 11:00:00.000000

Adds a short-lived redirect-token table so WhatsApp meeting invitations
can use a Meta-approved dynamic URL button with a stable
`https://nuru.tz/m/` prefix. The actual meeting URL (Nuru room or any
future external URL such as Zoom / Google Meet / Jitsi) is never exposed
in the WhatsApp body; the recipient taps the button, hits the
short-lived token endpoint, and is redirected to the real URL.

Tokens are:
- single-use-ish (we don't burn on first hit because the same recipient
  may reopen the link from WhatsApp history, but we cap by expires_at)
- bound to a meeting + participant where possible
- url-safe and unguessable (32 bytes of entropy, stored hashed)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "f0d4e5b6c7a8"
down_revision = "e9c2d3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "meeting_redirect_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        # Short opaque public token that appears in the URL. NOT a secret on
        # its own — the URL is meant to be tapped — but it's unguessable so
        # nobody can enumerate active meetings.
        sa.Column("token", sa.Text, nullable=False, unique=True),
        sa.Column(
            "meeting_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("event_meetings.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("target_url", sa.Text, nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("revoked_at", sa.DateTime, nullable=True),
        sa.Column("last_used_at", sa.DateTime, nullable=True),
        sa.Column("use_count", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "idx_meeting_redirect_tokens_meeting",
        "meeting_redirect_tokens",
        ["meeting_id"],
    )
    op.create_index(
        "idx_meeting_redirect_tokens_active",
        "meeting_redirect_tokens",
        ["expires_at"],
        postgresql_where=sa.text("revoked_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "idx_meeting_redirect_tokens_active",
        table_name="meeting_redirect_tokens",
    )
    op.drop_index(
        "idx_meeting_redirect_tokens_meeting",
        table_name="meeting_redirect_tokens",
    )
    op.drop_table("meeting_redirect_tokens")
