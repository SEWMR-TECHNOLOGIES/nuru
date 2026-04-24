"""
Escrow models — Phase 1.1
=========================
Logical-only ledger. No real money moves here; Nuru admin manually settles
MPesa/card payouts to vendors. These tables let the platform PROVE what is
held, what is owed, and what has been released, with a full append-only audit
trail.

Tables:
  - escrow_holds         (1 per booking, summarises current balance)
  - escrow_transactions  (append-only ledger; every change writes a row)

The booking state machine itself lives on
``ServiceBookingRequest.status`` (text), driven by helpers in
``services/escrow_service.py``.
"""

from sqlalchemy import Column, ForeignKey, DateTime, Numeric, Text, Enum, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.base import Base
from models.enums import (
    EscrowHoldStatusEnum,
    EscrowTransactionTypeEnum,
)


class EscrowHold(Base):
    """One row per booking — running summary of held funds."""
    __tablename__ = "escrow_holds"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    booking_id = Column(
        UUID(as_uuid=True),
        ForeignKey("service_booking_requests.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    event_service_id = Column(
        UUID(as_uuid=True),
        ForeignKey("event_services.id", ondelete="SET NULL"),
        nullable=True,
    )
    vendor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    organiser_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    currency = Column(Text, nullable=False, default="KES")
    amount_total = Column(Numeric(14, 2), nullable=False, default=0)
    amount_deposit = Column(Numeric(14, 2), nullable=False, default=0)
    amount_balance = Column(Numeric(14, 2), nullable=False, default=0)
    amount_released = Column(Numeric(14, 2), nullable=False, default=0)
    amount_refunded = Column(Numeric(14, 2), nullable=False, default=0)

    status = Column(
        Enum(EscrowHoldStatusEnum, name="escrow_hold_status_enum"),
        nullable=False,
        default=EscrowHoldStatusEnum.pending,
    )
    auto_release_at = Column(DateTime, nullable=True)
    settled_to_vendor_at = Column(DateTime, nullable=True)  # admin marks once MPesa B2C done
    settled_by_admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    booking = relationship("ServiceBookingRequest", back_populates="escrow_hold")
    transactions = relationship(
        "EscrowTransaction",
        back_populates="hold",
        cascade="all, delete-orphan",
        order_by="EscrowTransaction.created_at",
    )

    __table_args__ = (
        Index("idx_escrow_holds_status_release", "status", "auto_release_at"),
        Index("idx_escrow_holds_vendor_status", "vendor_user_id", "status"),
        Index("idx_escrow_holds_organiser_status", "organiser_user_id", "status"),
    )


class EscrowTransaction(Base):
    """Append-only ledger row. Never UPDATE/DELETE — only INSERT."""
    __tablename__ = "escrow_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    hold_id = Column(
        UUID(as_uuid=True),
        ForeignKey("escrow_holds.id", ondelete="CASCADE"),
        nullable=False,
    )
    booking_id = Column(
        UUID(as_uuid=True),
        ForeignKey("service_booking_requests.id", ondelete="CASCADE"),
        nullable=False,
    )

    type = Column(
        Enum(EscrowTransactionTypeEnum, name="escrow_transaction_type_enum"),
        nullable=False,
    )
    amount = Column(Numeric(14, 2), nullable=False)  # always positive
    currency = Column(Text, nullable=False, default="KES")

    # Free-form context
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    reason_code = Column(Text)  # e.g. "deposit_paid", "auto_release_48h", "dispute_split"
    notes = Column(Text)
    external_ref = Column(Text)  # mpesa/stripe ref if any

    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    hold = relationship("EscrowHold", back_populates="transactions")

    __table_args__ = (
        Index("idx_escrow_tx_hold_created", "hold_id", "created_at"),
        Index("idx_escrow_tx_booking_type", "booking_id", "type"),
    )
