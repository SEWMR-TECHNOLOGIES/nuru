from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Text, Enum, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import ConversationTypeEnum


# ──────────────────────────────────────────────
# Messaging Tables
# ──────────────────────────────────────────────

class Conversation(Base):
    __tablename__ = 'conversations'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    type = Column(Enum(ConversationTypeEnum, name="conversation_type_enum"), nullable=False)
    user_one_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    user_two_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    service_id = Column(UUID(as_uuid=True), ForeignKey('user_services.id'))
    last_read_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    # Transport-framing flag. New conversations default to encrypted; legacy
    # rows stay False so old clients keep working as before.
    is_encrypted = Column(Boolean, nullable=False, server_default="true", default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Mirrors existing DB indexes (idx_conversations_user_one/two/service) and
    # adds composite (user_*, updated_at) for inbox listings sorted by recency.
    __table_args__ = (
        Index('idx_conversations_user_one', 'user_one_id'),
        Index('idx_conversations_user_two', 'user_two_id'),
        Index('idx_conversations_service', 'service_id'),
        Index('idx_conversations_user_one_updated', 'user_one_id', 'updated_at'),
        Index('idx_conversations_user_two_updated', 'user_two_id', 'updated_at'),
    )

    # Relationships
    user_one = relationship("User", back_populates="conversations_as_one", foreign_keys=[user_one_id])
    user_two = relationship("User", back_populates="conversations_as_two", foreign_keys=[user_two_id])
    service = relationship("UserService", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation")


class Message(Base):
    __tablename__ = 'messages'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    conversation_id = Column(UUID(as_uuid=True), ForeignKey('conversations.id', ondelete='CASCADE'))
    sender_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    message_text = Column(Text, nullable=False)
    attachments = Column(JSONB, server_default="'[]'::jsonb")
    is_read = Column(Boolean, default=False)
    reply_to_id = Column(UUID(as_uuid=True), ForeignKey('messages.id'))
    # NULL / 'plain' = legacy plaintext; 'v1' = transport-framed envelope.
    encryption_version = Column(Text, nullable=True)
    # Snapshot of the quoted message at send-time, so the preview survives
    # edits/deletes of the original. Only populated when reply_to_id is set.
    reply_snapshot_text = Column(Text, nullable=True)
    reply_snapshot_sender = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    # Critical for fast message-list pagination (per conversation, newest first)
    # and unread-count queries (conversation_id, is_read).
    __table_args__ = (
        Index('idx_messages_conv_created', 'conversation_id', 'created_at'),
        Index('idx_messages_sender', 'sender_id'),
        Index('idx_messages_conv_unread', 'conversation_id', 'is_read'),
        Index('idx_messages_reply_to', 'reply_to_id'),
    )

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages")
    reply_to = relationship("Message", back_populates="replies", remote_side="Message.id")
    replies = relationship("Message", back_populates="reply_to")


class ConversationHide(Base):
    """Per-user soft-delete: lets a user hide a conversation from their inbox.

    The chat reappears for that user when a new message arrives after
    ``hidden_at``. Deleting only affects the calling user — the other
    participant still sees the full thread.
    """
    __tablename__ = 'conversation_hides'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    conversation_id = Column(UUID(as_uuid=True), ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    hidden_at = Column(DateTime, server_default=func.now(), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (
        Index('ix_conv_hides_user', 'user_id'),
        Index('ix_conv_hides_conv', 'conversation_id'),
    )
