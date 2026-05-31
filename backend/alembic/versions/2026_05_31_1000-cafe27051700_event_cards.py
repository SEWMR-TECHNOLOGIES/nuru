"""Event card editor + pledge thank-you cards

Creates three tables:
  - card_templates: discovered SVG card templates (seeded from static/cards/)
  - event_cards: per-event customized text for a chosen template
  - sent_event_cards: delivery log for personalized thank-you cards

Revision ID: cafe27051700
Revises: cafe27051600
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision = "cafe27051700"
down_revision = "cafe27051600"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "card_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("category", sa.Text, nullable=False, index=True),
        sa.Column("slug", sa.Text, nullable=False, unique=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("svg_path", sa.Text, nullable=False),
        sa.Column("thumbnail_path", sa.Text, nullable=True),
        sa.Column("metadata_json", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "event_cards",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("event_id", UUID(as_uuid=True), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("card_template_id", UUID(as_uuid=True), sa.ForeignKey("card_templates.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("category", sa.Text, nullable=False),
        sa.Column("custom_text_values", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_by_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("updated_by_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_event_cards_active_per_category "
        "ON event_cards (event_id, category) WHERE is_active = true"
    )

    op.create_table(
        "sent_event_cards",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("event_id", UUID(as_uuid=True), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("contributor_id", UUID(as_uuid=True), sa.ForeignKey("event_contributors.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("event_card_id", UUID(as_uuid=True), sa.ForeignKey("event_cards.id", ondelete="SET NULL"), nullable=True),
        sa.Column("recipient_name", sa.Text, nullable=False),
        sa.Column("recipient_phone", sa.Text, nullable=True),
        sa.Column("rendered_card_url", sa.Text, nullable=True),
        sa.Column("delivery_channel", sa.Text, nullable=False, server_default=sa.text("'whatsapp'")),
        sa.Column("delivery_status", sa.Text, nullable=False, server_default=sa.text("'pending'")),
        sa.Column("whatsapp_message_id", sa.Text, nullable=True),
        sa.Column("sms_message_id", sa.Text, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("sent_by_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "idx_sent_event_cards_event_contrib_sent",
        "sent_event_cards",
        ["event_id", "contributor_id", sa.text("sent_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("idx_sent_event_cards_event_contrib_sent", table_name="sent_event_cards")
    op.drop_table("sent_event_cards")
    op.execute("DROP INDEX IF EXISTS uq_event_cards_active_per_category")
    op.drop_table("event_cards")
    op.drop_table("card_templates")
