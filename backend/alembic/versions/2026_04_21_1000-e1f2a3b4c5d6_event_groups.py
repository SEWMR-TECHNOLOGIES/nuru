"""event groups workspace

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-04-21 10:00:00

Adds the event-group chat workspace:
  * event_groups
  * event_group_members
  * event_group_messages
  * event_group_message_reactions
  * event_group_invite_tokens
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "d0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


GROUP_MEMBER_ROLE = postgresql.ENUM(
    "organizer", "committee", "contributor", "guest",
    name="group_member_role_enum",
)
GROUP_MESSAGE_TYPE = postgresql.ENUM(
    "text", "image", "system",
    name="group_message_type_enum",
)


def upgrade() -> None:
    bind = op.get_bind()
    GROUP_MEMBER_ROLE.create(bind, checkfirst=True)
    GROUP_MESSAGE_TYPE.create(bind, checkfirst=True)

    # event_groups
    op.create_table(
        "event_groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("event_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("events.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("is_closed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("closed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_event_groups_event", "event_groups", ["event_id"])
    op.create_index("ix_event_groups_created_by", "event_groups", ["created_by"])

    # event_group_members
    op.create_table(
        "event_group_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("group_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("event_groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("guest_name", sa.Text(), nullable=True),
        sa.Column("guest_phone", sa.Text(), nullable=True),
        sa.Column("contributor_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("user_contributors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("role",
                  postgresql.ENUM("organizer", "committee", "contributor", "guest",
                                  name="group_member_role_enum", create_type=False),
                  nullable=False, server_default="contributor"),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("last_read_at", sa.DateTime(), nullable=True),
        sa.Column("is_muted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("joined_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("group_id", "user_id", name="uq_group_user"),
    )
    op.create_index("ix_group_members_group", "event_group_members", ["group_id"])
    op.create_index("ix_group_members_user", "event_group_members", ["user_id"])
    op.create_index("ix_group_members_contributor", "event_group_members", ["contributor_id"])

    # event_group_messages
    op.create_table(
        "event_group_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("group_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("event_groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_member_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("event_group_members.id", ondelete="SET NULL"), nullable=True),
        sa.Column("message_type",
                  postgresql.ENUM("text", "image", "system",
                                  name="group_message_type_enum", create_type=False),
                  nullable=False, server_default="text"),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=True),
        sa.Column("reply_to_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("event_group_messages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_group_messages_group_created",
                    "event_group_messages", ["group_id", "created_at"])
    op.create_index("ix_group_messages_sender",
                    "event_group_messages", ["sender_member_id"])
    op.create_index("ix_group_messages_created_at",
                    "event_group_messages", ["created_at"])

    # reactions
    op.create_table(
        "event_group_message_reactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("message_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("event_group_messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("member_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("event_group_members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("emoji", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("message_id", "member_id", "emoji",
                            name="uq_message_member_emoji"),
    )
    op.create_index("ix_msg_reactions_message",
                    "event_group_message_reactions", ["message_id"])

    # invite tokens
    op.create_table(
        "event_group_invite_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("group_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("event_groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contributor_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("user_contributors.id", ondelete="CASCADE"), nullable=True),
        sa.Column("token", sa.String(64), nullable=False, unique=True),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_invite_tokens_group",
                    "event_group_invite_tokens", ["group_id"])
    op.create_index("ix_invite_tokens_contributor",
                    "event_group_invite_tokens", ["contributor_id"])


def downgrade() -> None:
    op.drop_index("ix_invite_tokens_contributor", table_name="event_group_invite_tokens")
    op.drop_index("ix_invite_tokens_group", table_name="event_group_invite_tokens")
    op.drop_table("event_group_invite_tokens")

    op.drop_index("ix_msg_reactions_message", table_name="event_group_message_reactions")
    op.drop_table("event_group_message_reactions")

    op.drop_index("ix_group_messages_created_at", table_name="event_group_messages")
    op.drop_index("ix_group_messages_sender", table_name="event_group_messages")
    op.drop_index("ix_group_messages_group_created", table_name="event_group_messages")
    op.drop_table("event_group_messages")

    op.drop_index("ix_group_members_contributor", table_name="event_group_members")
    op.drop_index("ix_group_members_user", table_name="event_group_members")
    op.drop_index("ix_group_members_group", table_name="event_group_members")
    op.drop_table("event_group_members")

    op.drop_index("ix_event_groups_created_by", table_name="event_groups")
    op.drop_index("ix_event_groups_event", table_name="event_groups")
    op.drop_table("event_groups")

    bind = op.get_bind()
    GROUP_MESSAGE_TYPE.drop(bind, checkfirst=True)
    GROUP_MEMBER_ROLE.drop(bind, checkfirst=True)
