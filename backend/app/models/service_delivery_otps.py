"""Service-Delivery OTP — Phase 1.3
==================================
Mandatory check-in code for every booking. Vendor taps "Arrived" → backend
issues a 6-digit code → organiser shares it in person → vendor enters it →
backend marks the booking as delivered. Escrow release is blocked until this
happens.

Tables:
  - service_delivery_otps   (one active row per booking; new "Arrived" creates a fresh row)

The confirmed flag also lands on event_services.delivery_confirmed_at when
applicable, but for Phase 1.3 the source of truth is this table + the
booking's status transition to "delivered".
"""

from sqlalchemy import Column, ForeignKey, DateTime, Integer, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.base import Base


class ServiceDeliveryOtp(Base):
    __tablename__ = "service_delivery_otps"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    booking_id = Column(
        UUID(as_uuid=True),
        ForeignKey("service_booking_requests.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_service_id = Column(
        UUID(as_uuid=True),
        ForeignKey("event_services.id", ondelete="SET NULL"),
        nullable=True,
    )

    code = Column(Text, nullable=False)  # 6-digit numeric, stored plain (short-lived)

    # Who acted
    issued_by_vendor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    confirmed_by_vendor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    # Lifecycle
    issued_at = Column(DateTime, server_default=func.now(), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    confirmed_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)

    attempts = Column(Integer, default=0, nullable=False)
    status = Column(Text, default="active", nullable=False)
    # status values: active | confirmed | expired | cancelled | locked

    notes = Column(Text)

    booking = relationship("ServiceBookingRequest")

    __table_args__ = (
        Index("idx_delivery_otps_booking_status", "booking_id", "status"),
        Index("idx_delivery_otps_expires", "expires_at"),
    )
