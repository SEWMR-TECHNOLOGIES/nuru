from sqlalchemy import Column, ForeignKey, DateTime, Numeric, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base


class OfflineVendorPayment(Base):
    """Manually-logged payment to an event service vendor (paid outside platform)."""
    __tablename__ = 'offline_vendor_payments'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False)
    event_service_id = Column(UUID(as_uuid=True), ForeignKey('event_services.id', ondelete='CASCADE'), nullable=False)
    vendor_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    recorded_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(Text, nullable=False, default='TZS')
    method = Column(Text)            # cash | bank | mobile_money | other
    reference = Column(Text)
    note = Column(Text)
    otp_code_hash = Column(Text, nullable=False)
    otp_expires_at = Column(DateTime(timezone=True), nullable=False)
    otp_attempts = Column(Integer, nullable=False, default=0)
    status = Column(Text, nullable=False, default='pending')  # pending|confirmed|cancelled|expired|rejected
    confirmed_at = Column(DateTime(timezone=True))
    cancelled_at = Column(DateTime(timezone=True))
    expense_id = Column(UUID(as_uuid=True), ForeignKey('event_expenses.id', ondelete='SET NULL'))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
