"""
Escrow Service — Phase 1.1
==========================
Pure logic for the booking money state machine. No HTTP, no money movement.

The booking lifecycle (string-compatible with legacy `bookings.status` text):

    pending → accepted → funds_secured → in_progress → delivered → released
                                                              ↘ disputed
              ↘ rejected | cancelled               ↘ refunded

Public helpers used by API routes:
  - get_or_create_hold(db, booking)
  - record_deposit_paid(db, booking, amount, actor_id)
  - record_balance_paid(db, booking, amount, actor_id)
  - release_to_vendor(db, booking, *, reason, actor_id)
  - refund_to_organiser(db, booking, amount, *, reason, actor_id)
  - mark_settled_to_vendor(db, hold, admin_id, external_ref)
  - serialize_hold(db, hold)

NOTE: This is a LOGICAL ledger only. Real MPesa/card payouts to vendors are
done outside the system and recorded by the admin via mark_settled_to_vendor.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

import pytz
from sqlalchemy.orm import Session

from models import (
    ServiceBookingRequest,
    EscrowHold,
    EscrowTransaction,
    EscrowHoldStatusEnum,
    EscrowTransactionTypeEnum,
    UserService,
)

EAT = pytz.timezone("Africa/Nairobi")
ZERO = Decimal("0")


# ── Internal helpers ──────────────────────────────────────────────────────

def _to_decimal(value) -> Decimal:
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _now() -> datetime:
    return datetime.now(EAT).replace(tzinfo=None)


def _set_booking_status(booking: ServiceBookingRequest, status: str) -> None:
    """Single point of truth for booking status transitions."""
    booking.status = status
    booking.updated_at = _now()


def _write_tx(
    db: Session,
    hold: EscrowHold,
    booking: ServiceBookingRequest,
    *,
    tx_type: EscrowTransactionTypeEnum,
    amount: Decimal,
    actor_id: Optional[str] = None,
    reason: Optional[str] = None,
    notes: Optional[str] = None,
    external_ref: Optional[str] = None,
) -> EscrowTransaction:
    tx = EscrowTransaction(
        hold_id=hold.id,
        booking_id=booking.id,
        type=tx_type,
        amount=amount,
        currency=hold.currency or "KES",
        actor_user_id=actor_id,
        reason_code=reason,
        notes=notes,
        external_ref=external_ref,
    )
    db.add(tx)
    return tx


# ── Public helpers ────────────────────────────────────────────────────────

def get_or_create_hold(db: Session, booking: ServiceBookingRequest) -> EscrowHold:
    """Idempotently materialise the hold row for a booking."""
    hold = (
        db.query(EscrowHold)
        .filter(EscrowHold.booking_id == booking.id)
        .first()
    )
    if hold:
        return hold

    # Resolve vendor (service owner) and organiser (requester)
    vendor_id = None
    if booking.user_service_id:
        svc = (
            db.query(UserService)
            .filter(UserService.id == booking.user_service_id)
            .first()
        )
        if svc:
            vendor_id = svc.user_id

    total = _to_decimal(booking.quoted_price or booking.proposed_price or 0)
    deposit = _to_decimal(booking.deposit_required or 0)
    balance = max(ZERO, total - deposit)

    hold = EscrowHold(
        booking_id=booking.id,
        vendor_user_id=vendor_id,
        organiser_user_id=booking.requester_user_id,
        currency="KES",
        amount_total=total,
        amount_deposit=deposit,
        amount_balance=balance,
        status=EscrowHoldStatusEnum.pending,
    )
    db.add(hold)
    db.flush()
    return hold


def record_deposit_paid(
    db: Session,
    booking: ServiceBookingRequest,
    amount,
    actor_id: Optional[str] = None,
) -> EscrowHold:
    """Organiser paid the deposit → funds secured."""
    hold = get_or_create_hold(db, booking)
    amt = _to_decimal(amount or hold.amount_deposit)
    hold.amount_deposit = max(hold.amount_deposit, amt)
    hold.status = EscrowHoldStatusEnum.held
    _write_tx(
        db, hold, booking,
        tx_type=EscrowTransactionTypeEnum.HOLD_DEPOSIT,
        amount=amt,
        actor_id=actor_id,
        reason="deposit_paid",
    )
    booking.deposit_paid = True
    _set_booking_status(booking, "funds_secured")
    return hold


def record_balance_paid(
    db: Session,
    booking: ServiceBookingRequest,
    amount,
    actor_id: Optional[str] = None,
) -> EscrowHold:
    """Organiser paid the remaining balance — fully funded."""
    hold = get_or_create_hold(db, booking)
    amt = _to_decimal(amount or hold.amount_balance)
    hold.amount_balance = max(hold.amount_balance, amt)
    hold.status = EscrowHoldStatusEnum.held
    _write_tx(
        db, hold, booking,
        tx_type=EscrowTransactionTypeEnum.HOLD_BALANCE,
        amount=amt,
        actor_id=actor_id,
        reason="balance_paid",
    )
    return hold


def release_to_vendor(
    db: Session,
    booking: ServiceBookingRequest,
    *,
    reason: str = "manual_release",
    actor_id: Optional[str] = None,
) -> EscrowHold:
    """Release everything currently held to the vendor side of the ledger.

    This does NOT move real money — it only flips the ledger. Admin must then
    call ``mark_settled_to_vendor`` once the actual MPesa/card payout is done.
    """
    hold = get_or_create_hold(db, booking)
    holding = _to_decimal(hold.amount_deposit) + _to_decimal(hold.amount_balance) \
        - _to_decimal(hold.amount_released) - _to_decimal(hold.amount_refunded)
    if holding <= 0:
        return hold

    hold.amount_released = _to_decimal(hold.amount_released) + holding
    hold.status = EscrowHoldStatusEnum.released
    _write_tx(
        db, hold, booking,
        tx_type=EscrowTransactionTypeEnum.RELEASE_TO_VENDOR,
        amount=holding,
        actor_id=actor_id,
        reason=reason,
    )
    _set_booking_status(booking, "released")
    return hold


def refund_to_organiser(
    db: Session,
    booking: ServiceBookingRequest,
    amount,
    *,
    reason: str = "manual_refund",
    actor_id: Optional[str] = None,
) -> EscrowHold:
    hold = get_or_create_hold(db, booking)
    amt = _to_decimal(amount)
    if amt <= 0:
        return hold
    hold.amount_refunded = _to_decimal(hold.amount_refunded) + amt
    holding = _to_decimal(hold.amount_deposit) + _to_decimal(hold.amount_balance) \
        - _to_decimal(hold.amount_released) - _to_decimal(hold.amount_refunded)
    if holding <= 0:
        hold.status = EscrowHoldStatusEnum.refunded
        _set_booking_status(booking, "refunded")
    else:
        hold.status = EscrowHoldStatusEnum.partially_released
    _write_tx(
        db, hold, booking,
        tx_type=EscrowTransactionTypeEnum.REFUND_TO_ORGANISER,
        amount=amt,
        actor_id=actor_id,
        reason=reason,
    )
    return hold


def mark_settled_to_vendor(
    db: Session,
    hold: EscrowHold,
    admin_id: str,
    external_ref: Optional[str] = None,
) -> EscrowHold:
    """Admin records that real MPesa/card payout to vendor has been completed."""
    hold.settled_to_vendor_at = _now()
    hold.settled_by_admin_id = admin_id
    booking = (
        db.query(ServiceBookingRequest)
        .filter(ServiceBookingRequest.id == hold.booking_id)
        .first()
    )
    if booking:
        _write_tx(
            db, hold, booking,
            tx_type=EscrowTransactionTypeEnum.SETTLED_TO_VENDOR,
            amount=_to_decimal(hold.amount_released),
            actor_id=admin_id,
            reason="admin_settled",
            external_ref=external_ref,
        )
    return hold


def schedule_auto_release(
    hold: EscrowHold,
    event_date: Optional[datetime],
    hours_after_event: int = 48,
) -> None:
    """Set the auto_release_at timestamp once we know the event date."""
    if not event_date:
        return
    if isinstance(event_date, str):
        return
    base = event_date if isinstance(event_date, datetime) else datetime.combine(
        event_date, datetime.min.time()
    )
    hold.auto_release_at = base + timedelta(hours=hours_after_event)


# ── Serialization ─────────────────────────────────────────────────────────

def serialize_tx(tx: EscrowTransaction) -> dict:
    return {
        "id": str(tx.id),
        "type": tx.type.value if hasattr(tx.type, "value") else tx.type,
        "amount": float(tx.amount or 0),
        "currency": tx.currency,
        "reason_code": tx.reason_code,
        "notes": tx.notes,
        "external_ref": tx.external_ref,
        "actor_user_id": str(tx.actor_user_id) if tx.actor_user_id else None,
        "created_at": tx.created_at.isoformat() if tx.created_at else None,
    }


def serialize_hold(hold: EscrowHold, include_transactions: bool = True) -> dict:
    held = (
        _to_decimal(hold.amount_deposit) + _to_decimal(hold.amount_balance)
        - _to_decimal(hold.amount_released) - _to_decimal(hold.amount_refunded)
    )
    return {
        "id": str(hold.id),
        "booking_id": str(hold.booking_id),
        "currency": hold.currency,
        "amount_total": float(hold.amount_total or 0),
        "amount_deposit": float(hold.amount_deposit or 0),
        "amount_balance": float(hold.amount_balance or 0),
        "amount_released": float(hold.amount_released or 0),
        "amount_refunded": float(hold.amount_refunded or 0),
        "amount_currently_held": float(max(ZERO, held)),
        "status": hold.status.value if hasattr(hold.status, "value") else hold.status,
        "auto_release_at": hold.auto_release_at.isoformat() if hold.auto_release_at else None,
        "settled_to_vendor_at": hold.settled_to_vendor_at.isoformat() if hold.settled_to_vendor_at else None,
        "vendor_user_id": str(hold.vendor_user_id) if hold.vendor_user_id else None,
        "organiser_user_id": str(hold.organiser_user_id) if hold.organiser_user_id else None,
        "created_at": hold.created_at.isoformat() if hold.created_at else None,
        "updated_at": hold.updated_at.isoformat() if hold.updated_at else None,
        "transactions": [serialize_tx(t) for t in (hold.transactions or [])] if include_transactions else None,
    }
