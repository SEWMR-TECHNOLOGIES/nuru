# models/notifications.py
# Contains notification model

from sqlalchemy import Column, Text, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.base import Base
from models.enums import NotificationTypeEnum

class Notification(Base):
    __tablename__ = 'notifications'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    recipient_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    sender_ids = Column(JSONB, default=list)
    type = Column(Enum(NotificationTypeEnum, name="notification_type"), nullable=False)
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    reference_type = Column(Text, nullable=True)
    message_template = Column(Text, nullable=False)
    message_data = Column(JSONB, default=dict, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

    recipient = relationship("User", backref="notifications")
