"""Stable per-recipient card URL mappings

Creates ``card_url_mappings`` so every (recipient, card_purpose, event,
related_entity) tuple maps to ONE stable public token and URL. Re-sending
the same card overwrites the underlying storage file but the token /
public URL never changes.

Revision ID: cafe27052200
Revises: cafe27052100
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision = "cafe27052200"
down_revision = "cafe27052100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "card_url_mappings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("card_context_key", sa.Text, nullable=False),
        sa.Column("token", sa.Text, nullable=False),
        sa.Column("recipient_type", sa.Text, nullable=False),
        sa.Column("recipient_id", UUID(as_uuid=True), nullable=False),
        sa.Column("card_purpose", sa.Text, nullable=False),
        sa.Column("event_id", UUID(as_uuid=True), nullable=True),
        sa.Column("related_entity_type", sa.Text, nullable=True),
        sa.Column("related_entity_id", UUID(as_uuid=True), nullable=True),
        sa.Column("template_slug", sa.Text, nullable=True),
        sa.Column("storage_path", sa.Text, nullable=True),
        sa.Column("storage_url", sa.Text, nullable=True),
        sa.Column("public_url", sa.Text, nullable=False),
        sa.Column("metadata_json", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("last_rendered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("card_context_key", name="uq_card_url_mappings_context_key"),
        sa.UniqueConstraint("token", name="uq_card_url_mappings_token"),
    )
    op.create_index(
        "idx_card_url_mappings_recipient",
        "card_url_mappings",
        ["recipient_type", "recipient_id"],
    )
    op.create_index(
        "idx_card_url_mappings_event_purpose",
        "card_url_mappings",
        ["event_id", "card_purpose"],
    )


def downgrade() -> None:
    op.drop_index("idx_card_url_mappings_event_purpose", table_name="card_url_mappings")
    op.drop_index("idx_card_url_mappings_recipient", table_name="card_url_mappings")
    op.drop_table("card_url_mappings")
