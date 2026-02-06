# models/support.py
# Contains support ticketing and FAQ models

from sqlalchemy import Column, Text, Boolean, DateTime, Integer, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import PriorityLevelEnum  # make sure this enum exists

class SupportTicket(Base):
    __tablename__ = 'support_tickets'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    subject = Column(Text)
    status = Column(Text, default='open')  # could also make an enum if needed
    priority = Column(Enum(PriorityLevelEnum, name="priority_level"), default=PriorityLevelEnum.medium)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    user = relationship("User", backref="support_tickets")
    messages = relationship("SupportMessage", back_populates="ticket", cascade="all, delete-orphan")


class SupportMessage(Base):
    __tablename__ = 'support_messages'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    ticket_id = Column(UUID(as_uuid=True), ForeignKey('support_tickets.id', ondelete='CASCADE'))
    sender_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    is_agent = Column(Boolean, default=False)
    message_text = Column(Text, nullable=False)
    attachments = Column(JSONB, default=list)
    created_at = Column(DateTime, default=func.now())

    ticket = relationship("SupportTicket", back_populates="messages")
    sender = relationship("User")


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
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
