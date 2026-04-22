"""EventMessagingTemplate — per-event saved customisations for the
contributor messaging composer.

Stores the most-recently-used `message_template`, `payment_info`, and
`contact_phone` values per (event, case_type) so the organiser doesn't have
to retype them every time they open the messaging panel.
"""
from sqlalchemy import (
    Column, ForeignKey, DateTime, Text, UniqueConstraint, Index,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.base import Base


class EventMessagingTemplate(Base):
    __tablename__ = "event_messaging_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    case_type = Column(Text, nullable=False)  # no_contribution | partial | completed
    message_template = Column(Text, nullable=True)
    payment_info = Column(Text, nullable=True)
    contact_phone = Column(Text, nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "case_type IN ('no_contribution', 'partial', 'completed')",
            name="ck_event_messaging_templates_case",
        ),
        UniqueConstraint("event_id", "case_type", name="uq_event_messaging_templates_event_case"),
        Index("idx_event_messaging_templates_event", "event_id"),
    )

    event = relationship("Event")
