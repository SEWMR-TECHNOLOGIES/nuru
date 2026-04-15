from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Text, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import NotificationTypeEnum


# ──────────────────────────────────────────────
# Notifications
# ──────────────────────────────────────────────

class Notification(Base):
    __tablename__ = 'notifications'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    recipient_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    sender_ids = Column(JSONB)
    type = Column(Enum(NotificationTypeEnum, name="notification_type_enum"), nullable=False)
    reference_id = Column(UUID(as_uuid=True))
    reference_type = Column(Text)
    message_template = Column(Text, nullable=False)
    message_data = Column(JSONB, server_default="'{}'::jsonb")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    recipient = relationship("User", back_populates="notifications")
