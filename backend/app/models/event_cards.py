"""SQLAlchemy models for the event card editor + pledge thank-you delivery."""
from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.base import Base


class CardTemplate(Base):
    __tablename__ = "card_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    category = Column(Text, nullable=False, index=True)
    slug = Column(Text, nullable=False, unique=True)
    name = Column(Text, nullable=False)
    svg_path = Column(Text, nullable=False)
    thumbnail_path = Column(Text)
    metadata_json = Column(JSONB, nullable=False, default=dict)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class EventCard(Base):
    __tablename__ = "event_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    card_template_id = Column(UUID(as_uuid=True), ForeignKey("card_templates.id", ondelete="RESTRICT"), nullable=False)
    category = Column(Text, nullable=False)
    custom_text_values = Column(JSONB, nullable=False, default=dict)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    updated_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    template = relationship("CardTemplate")


class SentEventCard(Base):
    __tablename__ = "sent_event_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    contributor_id = Column(UUID(as_uuid=True), ForeignKey("event_contributors.id", ondelete="SET NULL"), nullable=True, index=True)
    event_card_id = Column(UUID(as_uuid=True), ForeignKey("event_cards.id", ondelete="SET NULL"), nullable=True)
    recipient_name = Column(Text, nullable=False)
    recipient_phone = Column(Text)
    rendered_card_url = Column(Text)
    delivery_channel = Column(Text, nullable=False, default="whatsapp")
    delivery_status = Column(Text, nullable=False, default="pending")
    whatsapp_message_id = Column(Text)
    sms_message_id = Column(Text)
    error_message = Column(Text)
    sent_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    sent_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_sent_event_cards_event_contrib_sent", "event_id", "contributor_id", "sent_at"),
    )
