from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Text, Enum
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
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

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
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages")
    reply_to = relationship("Message", back_populates="replies", remote_side="Message.id")
    replies = relationship("Message", back_populates="reply_to")
