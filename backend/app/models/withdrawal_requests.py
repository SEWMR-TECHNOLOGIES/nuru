"""Withdrawal Request model — Nuru-mediated payouts.

Withdrawals are NOT processed through SasaPay payouts. They are admin-mediated:

  1. User submits a request from a wallet → funds move available → pending (hold).
  2. An admin reviews the request and either approves (sends money outside the
     system, e.g. mobile-money manual transfer) or rejects (releases the hold).
  3. On approval the wallet records a `withdrawal` ledger entry — pending → 0,
     total_withdrawn += amount.

This model owns the request lifecycle. The wallet ledger remains the source of
truth for balances.
"""

from sqlalchemy import (
    Column, DateTime, Numeric, Text, String,
    ForeignKey, Index, Enum,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.base import Base
from models.enums import WithdrawalRequestStatusEnum


class WithdrawalRequest(Base):
    """A user-submitted request for Nuru admins to pay out wallet funds.

    The amount is held on the wallet (available → pending) at submission so a
    user cannot double-spend while admins review.
    """
    __tablename__ = "withdrawal_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    request_code = Column(Text, nullable=False, unique=True)  # e.g. NRU-WD-2026-000123

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    wallet_id = Column(UUID(as_uuid=True), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False)
    payment_profile_id = Column(
        UUID(as_uuid=True), ForeignKey("payment_profiles.id", ondelete="SET NULL"), nullable=True
    )

    currency_code = Column(String(3), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    user_note = Column(Text, nullable=True)

    # Snapshot of payout details at request time so changes to the payment profile
    # don't break audit history.
    payout_method = Column(Text, nullable=True)               # mobile_money / bank
    payout_provider_name = Column(Text, nullable=True)        # MPESA, CRDB, …
    payout_account_holder = Column(Text, nullable=True)
    payout_account_number = Column(Text, nullable=True)       # phone or bank acct
    payout_snapshot = Column(JSONB, nullable=True)            # full pp dict at request

    status = Column(
        Enum(WithdrawalRequestStatusEnum, name="withdrawal_request_status_enum"),
        nullable=False,
        server_default="pending",
    )
    admin_note = Column(Text, nullable=True)
    admin_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    external_reference = Column(Text, nullable=True)          # e.g. mobile-money receipt no
    hold_ledger_entry_id = Column(UUID(as_uuid=True), ForeignKey("wallet_ledger_entries.id"), nullable=True)
    settle_ledger_entry_id = Column(UUID(as_uuid=True), ForeignKey("wallet_ledger_entries.id"), nullable=True)

    requested_at = Column(DateTime, server_default=func.now())
    reviewed_at = Column(DateTime, nullable=True)
    settled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", foreign_keys=[user_id])
    admin = relationship("User", foreign_keys=[admin_user_id])
    wallet = relationship("Wallet")
    payment_profile = relationship("PaymentProfile")

    __table_args__ = (
        Index("ix_withdrawal_user", "user_id"),
        Index("ix_withdrawal_status_created", "status", "created_at"),
        Index("ix_withdrawal_wallet", "wallet_id"),
    )
