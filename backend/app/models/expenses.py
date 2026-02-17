from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base


# ──────────────────────────────────────────────
# Event Expenses Tables
# ──────────────────────────────────────────────

class EventExpense(Base):
    __tablename__ = 'event_expenses'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'), nullable=False)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    category = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    amount = Column(Numeric, nullable=False)
    payment_method = Column(Text)
    payment_reference = Column(Text)
    vendor_name = Column(Text)
    receipt_url = Column(Text)
    expense_date = Column(DateTime, server_default=func.now())
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    event = relationship("Event", back_populates="expenses")
    recorder = relationship("User", back_populates="recorded_expenses", foreign_keys=[recorded_by])
