"""performance indexes for feed, conversations, messages

Revision ID: a1b2c3d4e5f6
Revises: 84e7d1d50c70
Create Date: 2026-04-18 12:00:00.000000

Adds high-value composite indexes that the SQLAlchemy models now declare.
All statements use IF NOT EXISTS because several of these indexes were
previously created out-of-band (see all db indexes.csv) and may already exist.
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "84e7d1d50c70"
branch_labels = None
depends_on = None


# (index_name, table, columns)
INDEXES = [
    # conversations
    ("idx_conversations_user_one", "conversations", "(user_one_id)"),
    ("idx_conversations_user_two", "conversations", "(user_two_id)"),
    ("idx_conversations_service", "conversations", "(service_id)"),
    ("idx_conversations_user_one_updated", "conversations", "(user_one_id, updated_at DESC)"),
    ("idx_conversations_user_two_updated", "conversations", "(user_two_id, updated_at DESC)"),
    # messages
    ("idx_messages_conv_created", "messages", "(conversation_id, created_at DESC)"),
    ("idx_messages_sender", "messages", "(sender_id)"),
    ("idx_messages_conv_unread", "messages", "(conversation_id, is_read)"),
    ("idx_messages_reply_to", "messages", "(reply_to_id)"),
    # user_feeds (feed ranking + timeline)
    ("idx_user_feeds_active_created", "user_feeds", "(is_active, created_at DESC)"),
    ("idx_user_feeds_user_active_created", "user_feeds", "(user_id, is_active, created_at DESC)"),
    ("idx_user_feeds_visibility_created", "user_feeds", "(visibility, created_at DESC)"),
    ("idx_user_feeds_shared_event", "user_feeds", "(shared_event_id)"),
]


def upgrade() -> None:
    for name, table, cols in INDEXES:
        op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table} {cols}")
    op.execute("ANALYZE")


def downgrade() -> None:
    for name, _, _ in INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
