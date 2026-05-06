from sqlalchemy import Column, ForeignKey, DateTime, Numeric, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base


class EventSponsor(Base):
    """An invitation/record of a vendor (UserService) sponsoring an event.

    Status flow: pending → accepted | declined | cancelled.
    Organizer creates pending row; vendor (service owner) responds.
    """
    __tablename__ = "event_sponsors"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    user_service_id = Column(UUID(as_uuid=True), ForeignKey("user_services.id", ondelete="CASCADE"), nullable=False)
    vendor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    invited_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(Text, nullable=False, default="pending")  # pending|accepted|declined|cancelled
    message = Column(Text)
    contribution_amount = Column(Numeric(12, 2))
    response_note = Column(Text)
    responded_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    event = relationship("Event")
    user_service = relationship("UserService")
    vendor = relationship("User", foreign_keys=[vendor_user_id])
    invited_by = relationship("User", foreign_keys=[invited_by_user_id])

    __table_args__ = (
        Index("idx_event_sponsors_event", "event_id", "status"),
        Index("idx_event_sponsors_service", "user_service_id", "status"),
        Index("idx_event_sponsors_vendor", "vendor_user_id", "status"),
    )
