"""messaging: encryption framing + reply snapshots

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-04-26 10:00:00.000000

Adds three things to the messaging tables, all backward compatible:

* ``conversations.is_encrypted`` — flag exposed to clients so the chat UI can
  show the "end-to-end encrypted" banner. Defaults to ``true`` for new
  conversations; existing rows default to ``false`` so they keep behaving as
  legacy plaintext.
* ``messages.encryption_version`` — ``NULL`` / ``'plain'`` for legacy rows,
  ``'v1'`` for the transport-framed envelope used by the new mobile client.
* ``messages.reply_snapshot_text`` + ``reply_snapshot_sender`` — captured at
  send-time when a user quotes another message, so the quoted preview survives
  edits/deletes of the original.

Idempotent — every column is guarded so this can run safely on environments
where columns were added out-of-band.
"""
from alembic import op
import sqlalchemy as sa


revision = "f5a6b7c8d9e0"
down_revision = "e4f5a6b7c8d9"
branch_labels = None
depends_on = None


def _has_column(bind, table: str, column: str) -> bool:
    insp = sa.inspect(bind)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()

    # conversations.is_encrypted
    if not _has_column(bind, "conversations", "is_encrypted"):
        op.add_column(
            "conversations",
            sa.Column(
                "is_encrypted",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),  # safe default for existing rows
            ),
        )
        # Flip default for *new* rows to true, keeping historical rows untouched.
        op.alter_column(
            "conversations",
            "is_encrypted",
            server_default=sa.text("true"),
        )

    # messages.encryption_version
    if not _has_column(bind, "messages", "encryption_version"):
        op.add_column(
            "messages",
            sa.Column("encryption_version", sa.Text(), nullable=True),
        )

    # messages.reply_snapshot_text
    if not _has_column(bind, "messages", "reply_snapshot_text"):
        op.add_column(
            "messages",
            sa.Column("reply_snapshot_text", sa.Text(), nullable=True),
        )

    # messages.reply_snapshot_sender
    if not _has_column(bind, "messages", "reply_snapshot_sender"):
        op.add_column(
            "messages",
            sa.Column("reply_snapshot_sender", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, "messages", "reply_snapshot_sender"):
        op.drop_column("messages", "reply_snapshot_sender")
    if _has_column(bind, "messages", "reply_snapshot_text"):
        op.drop_column("messages", "reply_snapshot_text")
    if _has_column(bind, "messages", "encryption_version"):
        op.drop_column("messages", "encryption_version")
    if _has_column(bind, "conversations", "is_encrypted"):
        op.drop_column("conversations", "is_encrypted")
