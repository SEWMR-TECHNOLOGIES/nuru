"""Payment / Wallet / Settlement models for Nuru (Phase 1).

Design principles:
  * All customer money first lands in Nuru collection accounts. Beneficiary
    payout details are NEVER used at checkout — they are used later by the
    settlement layer.
  * Every transaction snapshots the commission, currency, country, provider
    and method at the moment of payment. Historical transactions must NEVER
    re-resolve live config.
  * Providers and commissions are admin-managed via dedicated tables so we
    can scale to new countries without code changes.
  * Wallet movements are recorded in a strict double-entry ledger so we can
    reconcile any balance at any point in time.
"""

from sqlalchemy import (
    Column, Boolean, DateTime, Integer, Numeric, Text, String,
    ForeignKey, UniqueConstraint, Index, Enum,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.base import Base
from models.enums import (
    PaymentProviderTypeEnum,
    PaymentTargetTypeEnum,
    TransactionStatusEnum,
    WalletEntryTypeEnum,
    PayoutMethodTypeEnum,
)


# ──────────────────────────────────────────────
# Admin-managed: providers (collection + payout)
# ──────────────────────────────────────────────

class PaymentProvider(Base):
    """Mobile money networks and banks supported per country.

    Admins add/disable providers from the dashboard; frontend loads the
    active list dynamically. Never hardcode this in the apps.
    """
    __tablename__ = "payment_providers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    country_code = Column(String(2), nullable=False)            # e.g. "TZ", "KE"
    currency_code = Column(String(3), nullable=False)           # e.g. "TZS", "KES"
    provider_type = Column(
        Enum(PaymentProviderTypeEnum, name="payment_provider_type_enum"),
        nullable=False,
    )
    name = Column(Text, nullable=False)                          # e.g. "MPESA", "CRDB BANK"
    code = Column(Text, nullable=False)                          # internal short code, e.g. "MPESA_TZ", "CRDB"
    gateway_code = Column(Text, nullable=True)                   # what we send to SasaPay etc. ("VODACOM", "TIGO")
    logo_url = Column(Text, nullable=True)
    is_collection_enabled = Column(Boolean, nullable=False, default=True)   # can collect money
    is_payout_enabled = Column(Boolean, nullable=False, default=True)       # can pay out money
    is_active = Column(Boolean, nullable=False, default=True)
    display_order = Column(Integer, nullable=False, default=0)
    metadata_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("country_code", "code", name="uq_payment_provider_country_code"),
        Index("ix_payment_provider_active_country", "country_code", "is_active"),
    )


# ──────────────────────────────────────────────
# Admin-managed: per-country commission settings
# ──────────────────────────────────────────────

class CommissionSetting(Base):
    """Flat commission charged per transaction, per country.

    Initial values: TZ = 50 TZS, KE = 2 KES. Admin can change anytime.
    The value is SNAPSHOTTED into each Transaction at payment time — never
    join back to this table for historical math.
    """
    __tablename__ = "commission_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    country_code = Column(String(2), nullable=False)
    currency_code = Column(String(3), nullable=False)
    commission_amount = Column(Numeric(12, 2), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        # Only one active commission per country at any time (enforced in code +
        # by partial index for safety).
        Index(
            "ux_commission_active_per_country",
            "country_code",
            unique=True,
            postgresql_where=(Column("is_active") == True),  # noqa: E712
        ),
    )


# ──────────────────────────────────────────────
# Wallet — one per (user, currency)
# ──────────────────────────────────────────────

class Wallet(Base):
    """Per-currency wallet for a user. Most users have a single wallet, but
    cross-border use cases (TZ user receiving KES tickets) may create
    multiple wallets — one per currency."""
    __tablename__ = "wallets"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    currency_code = Column(String(3), nullable=False)
    available_balance = Column(Numeric(14, 2), nullable=False, server_default="0")
    pending_balance = Column(Numeric(14, 2), nullable=False, server_default="0")
    total_received = Column(Numeric(14, 2), nullable=False, server_default="0")
    total_sent = Column(Numeric(14, 2), nullable=False, server_default="0")
    total_withdrawn = Column(Numeric(14, 2), nullable=False, server_default="0")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="wallets")

    __table_args__ = (
        UniqueConstraint("user_id", "currency_code", name="uq_wallet_user_currency"),
        Index("ix_wallet_user", "user_id"),
    )


# ──────────────────────────────────────────────
# Payment Profile — beneficiary payout details
# ──────────────────────────────────────────────

class PaymentProfile(Base):
    """How a user wants to RECEIVE money (payouts/settlements).

    Never used during checkout. Only used by the settlement worker when
    paying funds out from Nuru → beneficiary.
    """
    __tablename__ = "payment_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    country_code = Column(String(2), nullable=False)
    currency_code = Column(String(3), nullable=False)
    method_type = Column(
        Enum(PayoutMethodTypeEnum, name="payout_method_type_enum"),
        nullable=False,
    )
    # Optional FK to providers table — kept nullable so legacy/manual entries work.
    provider_id = Column(UUID(as_uuid=True), ForeignKey("payment_providers.id"), nullable=True)
    network_name = Column(Text, nullable=True)            # for mobile money
    phone_number = Column(Text, nullable=True)            # international format e.g. 255712345678
    bank_name = Column(Text, nullable=True)               # for bank
    account_number = Column(Text, nullable=True)
    account_holder_name = Column(Text, nullable=False)
    is_completed = Column(Boolean, nullable=False, default=False)
    is_verified = Column(Boolean, nullable=False, default=False)
    is_default = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="payment_profiles")
    provider = relationship("PaymentProvider")

    __table_args__ = (
        Index("ix_payment_profile_user", "user_id"),
        Index(
            "ux_payment_profile_one_default",
            "user_id",
            unique=True,
            postgresql_where=(Column("is_default") == True),  # noqa: E712
        ),
    )


# ──────────────────────────────────────────────
# Transactions — the source of truth for money movement
# ──────────────────────────────────────────────

class Transaction(Base):
    """One row per money-movement intent. Snapshots EVERYTHING needed to
    reconstruct the transaction without joining live config tables."""
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    transaction_code = Column(Text, nullable=False, unique=True)   # human-friendly e.g. NRU-TXN-2026-000123

    # Parties
    payer_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    beneficiary_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # What is being paid for
    target_type = Column(
        Enum(PaymentTargetTypeEnum, name="payment_target_type_enum"),
        nullable=False,
    )
    target_id = Column(UUID(as_uuid=True), nullable=True)          # event_id / ticket_order_id / booking_id …

    # Snapshot of country + currency at payment time
    country_code = Column(String(2), nullable=False)
    currency_code = Column(String(3), nullable=False)

    # Money breakdown
    gross_amount = Column(Numeric(14, 2), nullable=False)
    commission_amount = Column(Numeric(14, 2), nullable=False, server_default="0")
    net_amount = Column(Numeric(14, 2), nullable=False)            # gross - commission
    commission_snapshot = Column(JSONB, nullable=True)             # {country, currency, amount, source_id}

    # Provider snapshot
    method_type = Column(Text, nullable=False)                     # "mobile_money" / "bank" / "wallet"
    provider_name = Column(Text, nullable=True)                    # "MPESA", "CRDB", …
    provider_id = Column(UUID(as_uuid=True), ForeignKey("payment_providers.id"), nullable=True)
    payment_channel = Column(Text, nullable=True)                  # "stk_push", "wallet_balance", …

    # External / internal references
    external_reference = Column(Text, nullable=True)               # gateway checkout id / receipt no
    internal_reference = Column(Text, nullable=True)               # our own merchant_request_id

    # Description (must be highly descriptive — see spec)
    payment_description = Column(Text, nullable=False)

    # Lifecycle
    status = Column(
        Enum(TransactionStatusEnum, name="transaction_status_enum"),
        nullable=False,
        server_default="pending",
    )
    failure_reason = Column(Text, nullable=True)

    # Full payload snapshots (debug + audit)
    api_request_payload_snapshot = Column(JSONB, nullable=True)
    api_response_payload_snapshot = Column(JSONB, nullable=True)
    callback_payload_snapshot = Column(JSONB, nullable=True)

    # Timestamps
    initiated_at = Column(DateTime, server_default=func.now())
    confirmed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    payer = relationship("User", foreign_keys=[payer_user_id])
    beneficiary = relationship("User", foreign_keys=[beneficiary_user_id])
    provider = relationship("PaymentProvider")

    __table_args__ = (
        Index("ix_transaction_payer", "payer_user_id"),
        Index("ix_transaction_beneficiary", "beneficiary_user_id"),
        Index("ix_transaction_target", "target_type", "target_id"),
        Index("ix_transaction_status_created", "status", "created_at"),
        Index("ix_transaction_external_ref", "external_reference"),
    )


# ──────────────────────────────────────────────
# Wallet ledger — strict double-entry
# ──────────────────────────────────────────────

class WalletLedgerEntry(Base):
    """Append-only ledger of every change to a wallet's balance.

    Every credit/debit MUST write a row here with balance_before and
    balance_after captured atomically. Used for reconciliation, statements
    and dispute investigation.
    """
    __tablename__ = "wallet_ledger_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    wallet_id = Column(UUID(as_uuid=True), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id"), nullable=True)
    entry_type = Column(
        Enum(WalletEntryTypeEnum, name="wallet_entry_type_enum"),
        nullable=False,
    )
    amount = Column(Numeric(14, 2), nullable=False)
    balance_before = Column(Numeric(14, 2), nullable=False)
    balance_after = Column(Numeric(14, 2), nullable=False)
    description = Column(Text, nullable=False)
    metadata_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    wallet = relationship("Wallet", backref="ledger_entries")
    transaction = relationship("Transaction", backref="ledger_entries")

    __table_args__ = (
        Index("ix_ledger_wallet_created", "wallet_id", "created_at"),
        Index("ix_ledger_transaction", "transaction_id"),
    )


# ──────────────────────────────────────────────
# Mobile-money attempt — per gateway STK push
# ──────────────────────────────────────────────

class MobilePaymentAttempt(Base):
    """One row per STK-push / mobile-money attempt against a transaction.
    A single transaction may have multiple attempts (retry, wrong PIN…)."""
    __tablename__ = "mobile_payment_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False)
    gateway = Column(Text, nullable=True)                         # e.g. "SASAPAY"
    provider_name = Column(Text, nullable=True)                   # "MPESA", "MIXX BY YAS", …
    network_code = Column(Text, nullable=True)                    # "VODACOM", "TIGO", …
    phone_number = Column(Text, nullable=False)                   # international
    amount = Column(Numeric(14, 2), nullable=False)
    merchant_request_id = Column(Text, nullable=True)
    checkout_request_id = Column(Text, nullable=True)
    payment_request_id = Column(Text, nullable=True)               # SasaPay PaymentRequestID
    transaction_reference = Column(Text, nullable=True)            # SasaPay TransactionCode
    third_party_trans_id = Column(Text, nullable=True)             # SasaPay ThirdPartyTransID
    source_channel = Column(Text, nullable=True)                   # callback SourceChannel ("M-PESA", …)
    bill_ref_number = Column(Text, nullable=True)                  # callback BillRefNumber
    requested_amount = Column(Numeric(14, 2), nullable=True)       # callback RequestedAmount
    paid_amount = Column(Numeric(14, 2), nullable=True)            # callback TransAmount (actual)
    customer_mobile = Column(Text, nullable=True)                  # callback CustomerMobile
    transaction_date = Column(Text, nullable=True)                 # callback TransactionDate (YYYYMMDDHHMMSS)
    result_code = Column(Text, nullable=True)                      # callback ResultCode
    result_desc = Column(Text, nullable=True)                      # callback ResultDesc
    status = Column(Text, nullable=False, server_default="pending")  # pending/paid/failed
    response_payload = Column(JSONB, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    transaction = relationship("Transaction", backref="mobile_attempts")

    __table_args__ = (
        Index("ix_mobile_attempt_checkout", "checkout_request_id"),
        Index("ix_mobile_attempt_transaction", "transaction_id"),
    )


# ──────────────────────────────────────────────
# Callback log — raw webhook payloads from gateways
# ──────────────────────────────────────────────

class PaymentCallbackLog(Base):
    """Raw inbound webhook payloads for audit. Append-only."""
    __tablename__ = "payment_callback_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    gateway = Column(Text, nullable=True)
    checkout_request_id = Column(Text, nullable=True)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id"), nullable=True)
    payload = Column(JSONB, nullable=False)
    headers = Column(JSONB, nullable=True)
    processed = Column(Boolean, nullable=False, default=False)
    processing_error = Column(Text, nullable=True)
    received_at = Column(DateTime, server_default=func.now())

    transaction = relationship("Transaction")

    __table_args__ = (
        Index("ix_callback_checkout", "checkout_request_id"),
        Index("ix_callback_transaction", "transaction_id"),
    )
