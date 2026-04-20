"""Event Group Workspace models.

Represents a per-event chat/scoreboard workspace. One group per event.
Members include the organizer, committee members, all event contributors
(linked Nuru users) and "guest members" — non-Nuru contributors who joined
via a magic invite link and got a group-scoped JWT.
"""
from sqlalchemy import (
    Column, Boolean, ForeignKey, DateTime, Text, String, Index,
    UniqueConstraint, Enum,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from core.base import Base


class GroupMemberRoleEnum(str, enum.Enum):
    organizer = "organizer"
    committee = "committee"
    contributor = "contributor"
    guest = "guest"


class GroupMessageTypeEnum(str, enum.Enum):
    text = "text"
    image = "image"
    system = "system"


# ──────────────────────────────────────────────
# EventGroup — one per event
# ──────────────────────────────────────────────
class EventGroup(Base):
    __tablename__ = "event_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"),
                      nullable=False, unique=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    name = Column(Text, nullable=False)
    description = Column(Text)
    image_url = Column(Text)  # falls back to event.cover_image_url; UI shows initials when both null
    is_closed = Column(Boolean, nullable=False, default=False)  # auto-true after event end
    closed_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    members = relationship("EventGroupMember", back_populates="group",
                           cascade="all, delete-orphan")
    messages = relationship("EventGroupMessage", back_populates="group",
                            cascade="all, delete-orphan")
    invite_tokens = relationship("EventGroupInviteToken", back_populates="group",
                                 cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_event_groups_event", "event_id"),
        Index("ix_event_groups_created_by", "created_by"),
    )


# ──────────────────────────────────────────────
# EventGroupMember — full members + guest members
# ──────────────────────────────────────────────
class EventGroupMember(Base):
    __tablename__ = "event_group_members"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    group_id = Column(UUID(as_uuid=True), ForeignKey("event_groups.id", ondelete="CASCADE"),
                      nullable=False)
    # For Nuru users (organizer, committee, contributor with linked account)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=True)
    # For guest members (non-Nuru contributors who joined via invite link).
    # Stored separately so that if they later sign up & we link them, we can
    # promote them by setting user_id without losing message history.
    guest_name = Column(Text)
    guest_phone = Column(Text)
    # Optional link back to UserContributor when we added them automatically
    # so the scoreboard can resolve pledges/payments.
    contributor_id = Column(UUID(as_uuid=True),
                            ForeignKey("user_contributors.id", ondelete="SET NULL"),
                            nullable=True)
    role = Column(Enum(GroupMemberRoleEnum, name="group_member_role_enum"),
                  nullable=False, default=GroupMemberRoleEnum.contributor)
    is_admin = Column(Boolean, nullable=False, default=False)
    last_read_at = Column(DateTime)
    is_muted = Column(Boolean, nullable=False, default=False)
    joined_at = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    group = relationship("EventGroup", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])
    contributor = relationship("UserContributor", foreign_keys=[contributor_id])
    messages = relationship("EventGroupMessage", back_populates="sender_member")

    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_user"),
        Index("ix_group_members_group", "group_id"),
        Index("ix_group_members_user", "user_id"),
        Index("ix_group_members_contributor", "contributor_id"),
    )


# ──────────────────────────────────────────────
# EventGroupMessage — text / image / system
# ──────────────────────────────────────────────
class EventGroupMessage(Base):
    __tablename__ = "event_group_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    group_id = Column(UUID(as_uuid=True), ForeignKey("event_groups.id", ondelete="CASCADE"),
                      nullable=False)
    # Null for system messages
    sender_member_id = Column(UUID(as_uuid=True),
                              ForeignKey("event_group_members.id", ondelete="SET NULL"),
                              nullable=True)
    message_type = Column(Enum(GroupMessageTypeEnum, name="group_message_type_enum"),
                          nullable=False, default=GroupMessageTypeEnum.text)
    content = Column(Text)            # text body or system message
    image_url = Column(Text)          # populated when message_type = image
    metadata_json = Column(JSONB)     # arbitrary (e.g. {payment: {...}} for system msgs)
    reply_to_id = Column(UUID(as_uuid=True),
                         ForeignKey("event_group_messages.id", ondelete="SET NULL"),
                         nullable=True)
    is_deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    group = relationship("EventGroup", back_populates="messages")
    sender_member = relationship("EventGroupMember", back_populates="messages",
                                 foreign_keys=[sender_member_id])
    reactions = relationship("EventGroupMessageReaction", back_populates="message",
                             cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_group_messages_group_created", "group_id", "created_at"),
        Index("ix_group_messages_sender", "sender_member_id"),
    )


# ──────────────────────────────────────────────
# Reactions — WhatsApp style; one per (message, member, emoji)
# ──────────────────────────────────────────────
class EventGroupMessageReaction(Base):
    __tablename__ = "event_group_message_reactions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    message_id = Column(UUID(as_uuid=True),
                        ForeignKey("event_group_messages.id", ondelete="CASCADE"),
                        nullable=False)
    member_id = Column(UUID(as_uuid=True),
                       ForeignKey("event_group_members.id", ondelete="CASCADE"),
                       nullable=False)
    emoji = Column(String(16), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    message = relationship("EventGroupMessage", back_populates="reactions")

    __table_args__ = (
        UniqueConstraint("message_id", "member_id", "emoji", name="uq_message_member_emoji"),
        Index("ix_msg_reactions_message", "message_id"),
    )


# ──────────────────────────────────────────────
# Invite token — unique per phone+group, can be regenerated
# ──────────────────────────────────────────────
class EventGroupInviteToken(Base):
    __tablename__ = "event_group_invite_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    group_id = Column(UUID(as_uuid=True), ForeignKey("event_groups.id", ondelete="CASCADE"),
                      nullable=False)
    contributor_id = Column(UUID(as_uuid=True),
                            ForeignKey("user_contributors.id", ondelete="CASCADE"),
                            nullable=True)
    token = Column(String(64), nullable=False, unique=True)
    phone = Column(Text)
    name = Column(Text)
    used_at = Column(DateTime)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())

    group = relationship("EventGroup", back_populates="invite_tokens")

    __table_args__ = (
        Index("ix_invite_tokens_group", "group_id"),
        Index("ix_invite_tokens_contributor", "contributor_id"),
    )
