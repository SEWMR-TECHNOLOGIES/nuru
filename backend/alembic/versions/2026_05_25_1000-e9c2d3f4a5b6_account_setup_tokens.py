"""account_setup_tokens table + users must_change_password / temp pw / setup completion

Revision ID: e9c2d3f4a5b6
Revises: d8b1c2e3f4a5
Create Date: 2026-05-25 10:00:00.000000

Adds the secure tokenised account-setup flow used when one Nuru user
registers another. The temporary password is no longer sent over
WhatsApp — instead a one-time URL is delivered via the Meta-approved
Utility template `nuru_welcome_registered_by_*` with a dynamic URL
button. Mobile/SMS callers may still send a temporary password and the
new `users.must_change_password` flag forces a password change on the
first login.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "e9c2d3f4a5b6"
down_revision = "d8b1c2e3f4a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "account_setup_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.Text, nullable=False, unique=True),
        sa.Column("purpose", sa.Text, nullable=False, server_default="account_setup"),
        sa.Column("delivery_channel", sa.Text, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("used_at", sa.DateTime, nullable=True),
        sa.Column("extra", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index(
        "idx_account_setup_tokens_user_active",
        "account_setup_tokens", ["user_id"],
        postgresql_where=sa.text("used_at IS NULL"),
    )

    op.add_column("users", sa.Column(
        "must_change_password", sa.Boolean, nullable=False,
        server_default=sa.text("false"),
    ))
    op.add_column("users", sa.Column(
        "temporary_password_expires_at", sa.DateTime, nullable=True,
    ))
    op.add_column("users", sa.Column(
        "account_setup_completed_at", sa.DateTime, nullable=True,
    ))


def downgrade() -> None:
    op.drop_column("users", "account_setup_completed_at")
    op.drop_column("users", "temporary_password_expires_at")
    op.drop_column("users", "must_change_password")
    op.drop_index("idx_account_setup_tokens_user_active",
                  table_name="account_setup_tokens")
    op.drop_table("account_setup_tokens")
