from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Text, Enum, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import WAMessageDirectionEnum, WAMessageStatusEnum


class WAConversation(Base):
    __tablename__ = 'wa_conversations'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    phone = Column(String(20), nullable=False, unique=True, index=True)
    contact_name = Column(String(255), default='')
    last_message = Column(Text, default='')
    last_activity_at = Column(DateTime, server_default=func.now())
    unread_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    messages = relationship("WAMessage", back_populates="conversation", order_by="WAMessage.created_at")


class WAMessage(Base):
    __tablename__ = 'wa_messages'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    conversation_id = Column(UUID(as_uuid=True), ForeignKey('wa_conversations.id', ondelete='CASCADE'), nullable=False, index=True)
    wa_message_id = Column(String(255), nullable=True, unique=True, index=True)
    direction = Column(Enum(WAMessageDirectionEnum, name="wa_message_direction_enum"), nullable=False)
    content = Column(Text, nullable=False)
    status = Column(Enum(WAMessageStatusEnum, name="wa_message_status_enum"), default=WAMessageStatusEnum.sent)
    created_at = Column(DateTime, server_default=func.now())

    conversation = relationship("WAConversation", back_populates="messages")
