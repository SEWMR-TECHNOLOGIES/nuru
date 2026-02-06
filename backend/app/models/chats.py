# models/chat.py
# Contains chat/conversation models, including live chat sessions

from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import ConversationTypeEnum, ChatSessionStatusEnum  # make sure these enums exist

class Conversation(Base):
    __tablename__ = 'conversations'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    type = Column(Enum(ConversationTypeEnum, name="conversation_type"), nullable=False)
    user_one_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    user_two_id = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    service_id = Column(UUID(as_uuid=True), ForeignKey('user_services.id'))
    last_read_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    user_one = relationship("User", foreign_keys=[user_one_id])
    user_two = relationship("User", foreign_keys=[user_two_id])
    service = relationship("UserService")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = 'messages'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    conversation_id = Column(UUID(as_uuid=True), ForeignKey('conversations.id', ondelete='CASCADE'))
    sender_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    message_text = Column(Text, nullable=False)
    attachments = Column(JSONB, default=list)
    is_read = Column(Boolean, default=False)
    reply_to_id = Column(UUID(as_uuid=True), ForeignKey('messages.id'), nullable=True)
    created_at = Column(DateTime, default=func.now())

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User")
    reply_to = relationship("Message", remote_side=[id])

class LiveChatSession(Base):
    __tablename__ = 'live_chat_sessions'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey('support_tickets.id', ondelete='SET NULL'), nullable=True)
    status = Column(Enum(ChatSessionStatusEnum, name="chat_session_status"), default="waiting")
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    wait_time_seconds = Column(Integer)
    duration_seconds = Column(Integer)
    rating = Column(Integer)
    feedback = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    user = relationship("User", foreign_keys=[user_id])
    agent = relationship("User", foreign_keys=[agent_id])
    ticket = relationship("SupportTicket")
    messages = relationship("LiveChatMessage", back_populates="session", cascade="all, delete-orphan")

class LiveChatMessage(Base):
    __tablename__ = 'live_chat_messages'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    session_id = Column(UUID(as_uuid=True), ForeignKey('live_chat_sessions.id', ondelete='CASCADE'), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    is_agent = Column(Boolean, default=False)
    is_system = Column(Boolean, default=False)
    message_text = Column(Text, nullable=False)
    attachments = Column(JSONB, default=list)
    created_at = Column(DateTime, default=func.now())

    session = relationship("LiveChatSession", back_populates="messages")
    sender = relationship("User")
