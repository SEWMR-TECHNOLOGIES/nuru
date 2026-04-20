"""messaging perf indexes for inbox + chat hot paths

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-04-21 12:00:00.000000

Speeds up:
- /messages/                     (inbox listing per user, ordered by recency)
- /messages/{conversation_id}    (paginated chat history, newest first)
- /messages/unread/count         (unread fan-out across the user's conversations)
- last-message + unread-count batch loaders in build_conversation_dicts

Idempotent (IF NOT EXISTS) so it's safe to re-run on any environment whose DB
may already have a subset of these from earlier model declarations.
"""
from alembic import op


revision = "a3b4c5d6e7f8"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


# Plain indexes — created with IF NOT EXISTS so reruns are safe.
INDEXES = [
    # Inbox listing: WHERE user_one_id = :me ORDER BY updated_at DESC
    ("idx_conversations_user_one_updated_desc", "conversations", "(user_one_id, updated_at DESC)"),
    ("idx_conversations_user_two_updated_desc", "conversations", "(user_two_id, updated_at DESC)"),
    # Chat pagination: WHERE conversation_id = :c ORDER BY created_at DESC LIMIT 50
    ("idx_messages_conv_created_desc", "messages", "(conversation_id, created_at DESC)"),
    # Reply-to lookups for thread rendering
    ("idx_messages_reply_to_id", "messages", "(reply_to_id)"),
    # Sender lookup (delete-my-message, batch hydration)
    ("idx_messages_sender_id", "messages", "(sender_id)"),
]


# Partial indexes — narrow the index to "unread, not from me" rows which is
# what /unread/count and the inbox unread badge actually filter on. Much
# smaller than a full (conversation_id, is_read) index and far faster.
PARTIAL_INDEXES = [
    (
        "idx_messages_conv_unread_partial",
        "messages",
        "(conversation_id, sender_id) WHERE is_read = false",
    ),
]


def upgrade() -> None:
    for name, table, cols in INDEXES:
        op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table} {cols}")
    for name, table, cols in PARTIAL_INDEXES:
        op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table} {cols}")
    op.execute("ANALYZE conversations")
    op.execute("ANALYZE messages")


def downgrade() -> None:
    for name, _, _ in INDEXES + PARTIAL_INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
