from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base


# ──────────────────────────────────────────────
# Booking Requests
# ──────────────────────────────────────────────

class ServiceBookingRequest(Base):
    __tablename__ = 'service_booking_requests'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_service_id = Column(UUID(as_uuid=True), ForeignKey('user_services.id', ondelete='CASCADE'))
    requester_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='SET NULL'))
    package_id = Column(UUID(as_uuid=True), ForeignKey('service_packages.id'))
    message = Column(Text)
    proposed_price = Column(Numeric)
    quoted_price = Column(Numeric)
    deposit_required = Column(Numeric)
    deposit_paid = Column(Boolean, default=False)
    vendor_notes = Column(Text)
    status = Column(Text, default='pending')
    responded_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user_service = relationship("UserService", back_populates="booking_requests")
    requester = relationship("User", back_populates="booking_requests")
    event = relationship("Event", back_populates="booking_requests")
    package = relationship("ServicePackage", back_populates="booking_requests")
