"""event groups perf indexes for chat reactions hot path

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-04-21 11:00:00.000000

Hot-path indexes for the reactions endpoint and chat polling.
Idempotent (IF NOT EXISTS).
"""
from alembic import op


revision = "f2a3b4c5d6e7"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


INDEXES = [
    ("idx_event_group_members_group_user", "event_group_members", "(group_id, user_id)"),
    ("idx_event_group_members_group", "event_group_members", "(group_id)"),
    ("idx_egm_reactions_msg_member_emoji", "event_group_message_reactions", "(message_id, member_id, emoji)"),
    ("idx_egm_reactions_message", "event_group_message_reactions", "(message_id)"),
    ("idx_event_group_messages_group_created_desc", "event_group_messages", "(group_id, created_at DESC)"),
]


def upgrade() -> None:
    for name, table, cols in INDEXES:
        op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table} {cols}")
    op.execute("ANALYZE event_group_members")
    op.execute("ANALYZE event_group_message_reactions")
    op.execute("ANALYZE event_group_messages")


def downgrade() -> None:
    for name, _, _ in INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
