from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Integer, Text, Enum, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import PriorityLevelEnum, ChatSessionStatusEnum


# ──────────────────────────────────────────────
# Support Tables
# ──────────────────────────────────────────────

class SupportTicket(Base):
    __tablename__ = 'support_tickets'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    subject = Column(Text)
    status = Column(Text, default='open')
    priority = Column(Enum(PriorityLevelEnum, name="priority_level_enum"), default=PriorityLevelEnum.medium)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="support_tickets")
    messages = relationship("SupportMessage", back_populates="ticket")
    live_chat_sessions = relationship("LiveChatSession", back_populates="ticket")


class SupportMessage(Base):
    __tablename__ = 'support_messages'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    ticket_id = Column(UUID(as_uuid=True), ForeignKey('support_tickets.id', ondelete='CASCADE'))
    sender_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    is_agent = Column(Boolean, default=False)
    message_text = Column(Text, nullable=False)
    attachments = Column(JSONB, server_default="'[]'::jsonb")
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    ticket = relationship("SupportTicket", back_populates="messages")
    sender = relationship("User", back_populates="support_messages")


class FAQ(Base):
    __tablename__ = 'faqs'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    category = Column(Text)
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    helpful_count = Column(Integer, default=0)
    not_helpful_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class LiveChatSession(Base):
    __tablename__ = 'live_chat_sessions'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    ticket_id = Column(UUID(as_uuid=True), ForeignKey('support_tickets.id', ondelete='SET NULL'))
    status = Column(Enum(ChatSessionStatusEnum, name="chat_session_status_enum"), default=ChatSessionStatusEnum.waiting)
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    wait_time_seconds = Column(Integer)
    duration_seconds = Column(Integer)
    rating = Column(Integer)
    feedback = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint('rating >= 1 AND rating <= 5', name='ck_chat_rating_range'),
    )

    # Relationships
    user = relationship("User", back_populates="live_chat_sessions_as_user", foreign_keys=[user_id])
    agent = relationship("User", back_populates="live_chat_sessions_as_agent", foreign_keys=[agent_id])
    ticket = relationship("SupportTicket", back_populates="live_chat_sessions")
    chat_messages = relationship("LiveChatMessage", back_populates="session")


class LiveChatMessage(Base):
    __tablename__ = 'live_chat_messages'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    session_id = Column(UUID(as_uuid=True), ForeignKey('live_chat_sessions.id', ondelete='CASCADE'), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    is_agent = Column(Boolean, default=False)
    is_system = Column(Boolean, default=False)
    message_text = Column(Text, nullable=False)
    attachments = Column(JSONB, server_default="'[]'::jsonb")
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    session = relationship("LiveChatSession", back_populates="chat_messages")
    sender = relationship("User", back_populates="live_chat_messages")
