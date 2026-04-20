"""Wallet service — atomic balance updates with double-entry ledger.

Every public method:
  1. Locks the wallet row FOR UPDATE
  2. Computes balance_before / balance_after
  3. Mutates the wallet
  4. Inserts a WalletLedgerEntry
  5. Returns the entry — caller is responsible for db.commit()

Never mutate Wallet.* outside this service.
"""

from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from models.payments import Wallet, WalletLedgerEntry
from models.enums import WalletEntryTypeEnum


# ──────────────────────────────────────────────
# Wallet retrieval / creation
# ──────────────────────────────────────────────

def get_or_create_wallet(db: Session, user_id: UUID, currency_code: str) -> Wallet:
    """Idempotent — one wallet per (user, currency)."""
    currency_code = currency_code.upper()
    wallet = (
        db.query(Wallet)
        .filter(Wallet.user_id == user_id, Wallet.currency_code == currency_code)
        .first()
    )
    if wallet:
        return wallet
    wallet = Wallet(user_id=user_id, currency_code=currency_code)
    db.add(wallet)
    db.flush()
    return wallet


def lock_wallet(db: Session, wallet_id: UUID) -> Wallet:
    """Pessimistic row lock — must be called inside a transaction."""
    return (
        db.query(Wallet)
        .filter(Wallet.id == wallet_id)
        .with_for_update()
        .one()
    )


# ──────────────────────────────────────────────
# Mutations
# ──────────────────────────────────────────────

def _record_entry(
    db: Session,
    wallet: Wallet,
    entry_type: WalletEntryTypeEnum,
    amount: Decimal,
    balance_before: Decimal,
    balance_after: Decimal,
    description: str,
    transaction_id: Optional[UUID] = None,
    metadata: Optional[dict] = None,
) -> WalletLedgerEntry:
    entry = WalletLedgerEntry(
        wallet_id=wallet.id,
        transaction_id=transaction_id,
        entry_type=entry_type,
        amount=amount,
        balance_before=balance_before,
        balance_after=balance_after,
        description=description,
        metadata_json=metadata,
    )
    db.add(entry)
    db.flush()
    return entry


def credit_available(
    db: Session,
    wallet: Wallet,
    amount: Decimal,
    description: str,
    transaction_id: Optional[UUID] = None,
    metadata: Optional[dict] = None,
) -> WalletLedgerEntry:
    """Add to available_balance + total_received."""
    if amount <= 0:
        raise ValueError("credit amount must be positive")
    locked = lock_wallet(db, wallet.id)
    before = Decimal(str(locked.available_balance))
    after = before + amount
    locked.available_balance = after
    locked.total_received = Decimal(str(locked.total_received)) + amount
    return _record_entry(
        db, locked, WalletEntryTypeEnum.credit, amount, before, after,
        description, transaction_id, metadata,
    )


def debit_available(
    db: Session,
    wallet: Wallet,
    amount: Decimal,
    description: str,
    transaction_id: Optional[UUID] = None,
    metadata: Optional[dict] = None,
    allow_negative: bool = False,
) -> WalletLedgerEntry:
    """Subtract from available_balance + add to total_sent."""
    if amount <= 0:
        raise ValueError("debit amount must be positive")
    locked = lock_wallet(db, wallet.id)
    before = Decimal(str(locked.available_balance))
    if not allow_negative and before < amount:
        raise ValueError("Insufficient wallet balance.")
    after = before - amount
    locked.available_balance = after
    locked.total_sent = Decimal(str(locked.total_sent)) + amount
    return _record_entry(
        db, locked, WalletEntryTypeEnum.debit, amount, before, after,
        description, transaction_id, metadata,
    )


def hold(
    db: Session,
    wallet: Wallet,
    amount: Decimal,
    description: str,
    transaction_id: Optional[UUID] = None,
    metadata: Optional[dict] = None,
) -> WalletLedgerEntry:
    """Move funds available → pending (e.g. payout requested)."""
    if amount <= 0:
        raise ValueError("hold amount must be positive")
    locked = lock_wallet(db, wallet.id)
    before = Decimal(str(locked.available_balance))
    if before < amount:
        raise ValueError("Insufficient wallet balance to hold.")
    locked.available_balance = before - amount
    locked.pending_balance = Decimal(str(locked.pending_balance)) + amount
    return _record_entry(
        db, locked, WalletEntryTypeEnum.hold, amount, before, before - amount,
        description, transaction_id, metadata,
    )


def release(
    db: Session,
    wallet: Wallet,
    amount: Decimal,
    description: str,
    transaction_id: Optional[UUID] = None,
    metadata: Optional[dict] = None,
) -> WalletLedgerEntry:
    """Move funds pending → available (hold reversed)."""
    if amount <= 0:
        raise ValueError("release amount must be positive")
    locked = lock_wallet(db, wallet.id)
    pending = Decimal(str(locked.pending_balance))
    if pending < amount:
        raise ValueError("Pending balance lower than release amount.")
    before = Decimal(str(locked.available_balance))
    locked.pending_balance = pending - amount
    locked.available_balance = before + amount
    return _record_entry(
        db, locked, WalletEntryTypeEnum.release, amount, before, before + amount,
        description, transaction_id, metadata,
    )


def withdrawal(
    db: Session,
    wallet: Wallet,
    amount: Decimal,
    description: str,
    transaction_id: Optional[UUID] = None,
    metadata: Optional[dict] = None,
) -> WalletLedgerEntry:
    """Settled payout to beneficiary — pending → 0, total_withdrawn += amount."""
    if amount <= 0:
        raise ValueError("withdrawal amount must be positive")
    locked = lock_wallet(db, wallet.id)
    pending = Decimal(str(locked.pending_balance))
    if pending < amount:
        raise ValueError("Pending balance lower than withdrawal amount.")
    before = pending
    locked.pending_balance = pending - amount
    locked.total_withdrawn = Decimal(str(locked.total_withdrawn)) + amount
    return _record_entry(
        db, locked, WalletEntryTypeEnum.withdrawal, amount, before, before - amount,
        description, transaction_id, metadata,
    )


def commission_charge(
    db: Session,
    wallet: Wallet,
    amount: Decimal,
    description: str,
    transaction_id: Optional[UUID] = None,
    metadata: Optional[dict] = None,
) -> WalletLedgerEntry:
    """Audit-only entry for the commission slice — does NOT change balance.
    The net amount is what hits the beneficiary; this row makes the
    commission visible in the ledger."""
    locked = lock_wallet(db, wallet.id)
    bal = Decimal(str(locked.available_balance))
    return _record_entry(
        db, locked, WalletEntryTypeEnum.commission, amount, bal, bal,
        description, transaction_id, metadata,
    )
