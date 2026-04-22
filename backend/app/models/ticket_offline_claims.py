"""TicketOfflineClaim — buyer-declared off-platform ticket payments.

Mirrors the offline-claim flow for contributions, but for ticket purchases.
On approval, real EventTicket rows are minted via the existing helper.
The seller (event organiser) reviews these from a dedicated queue and can
see all submitted audit details (channel, provider, txn code, receipt image).
"""
from sqlalchemy import (
    Column, ForeignKey, DateTime, Integer, Numeric, Text,
    UniqueConstraint, Index, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.base import Base


class TicketOfflineClaim(Base):
    __tablename__ = "ticket_offline_claims"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    ticket_class_id = Column(UUID(as_uuid=True), ForeignKey("event_ticket_classes.id", ondelete="CASCADE"), nullable=False)
    claimant_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    claimant_name = Column(Text, nullable=False)
    claimant_phone = Column(Text, nullable=True)
    claimant_email = Column(Text, nullable=True)
    quantity = Column(Integer, nullable=False, server_default="1")
    amount = Column(Numeric(12, 2), nullable=False)
    payment_channel = Column(Text, nullable=False)             # mobile_money | bank
    provider_name = Column(Text, nullable=True)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("payment_providers.id", ondelete="SET NULL"), nullable=True)
    payer_account = Column(Text, nullable=True)
    transaction_code = Column(Text, nullable=False)
    receipt_image_url = Column(Text, nullable=True)
    status = Column(Text, nullable=False, server_default="pending")  # pending|confirmed|rejected
    rejection_reason = Column(Text, nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    issued_ticket_id = Column(UUID(as_uuid=True), ForeignKey("event_tickets.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("payment_channel IN ('mobile_money', 'bank')", name="ck_ticket_offline_claims_channel"),
        CheckConstraint("status IN ('pending', 'confirmed', 'rejected')", name="ck_ticket_offline_claims_status"),
        UniqueConstraint("ticket_class_id", "transaction_code", name="uq_ticket_offline_claims_class_txn"),
        Index("idx_ticket_offline_claims_event_status", "event_id", "status"),
        Index("idx_ticket_offline_claims_claimant", "claimant_user_id"),
    )

    event = relationship("Event")
    ticket_class = relationship("EventTicketClass")
    claimant = relationship("User", foreign_keys=[claimant_user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
