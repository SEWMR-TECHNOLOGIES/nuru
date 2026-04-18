"""
Cancellation refund calculator — Phase 1.2
==========================================
Pure function that, given (booking, cancelling_party, cancel_at), returns the
breakdown of who gets what under the Nuru policy doc tiers:

  Tier 1 Flexible  : 7d cutoff
  Tier 2 Moderate  : 14d / 7d split
  Tier 3 Strict    : 21d / 14d split
  Universal 48h rule overrides for organiser cancellations.
  Vendor cancellation: 100% refund to organiser.

Output dict shape used by both the preview endpoint and the cancel endpoint:
{
  "tier": "moderate",
  "cancelling_party": "organiser" | "vendor",
  "deposit": 3000, "balance": 7000, "total": 10000,
  "refund_to_organiser": 3500,
  "vendor_retention": 6500,
  "deposit_refunded": 0, "deposit_retained": 3000,
  "balance_refunded": 3500, "balance_retained": 3500,
  "reason_code": "moderate_14d_to_7d",
  "human_summary": "Cancelled 10 days before event under Moderate tier ...",
  "hours_until_event": 240,
}
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

import pytz
from sqlalchemy.orm import Session

from models import (
    ServiceBookingRequest,
    UserService,
    ServiceType,
    Event,
    CancellationTierEnum,
)


EAT = pytz.timezone("Africa/Nairobi")
ZERO = Decimal("0")


def _D(v) -> Decimal:
    if v is None:
        return ZERO
    return v if isinstance(v, Decimal) else Decimal(str(v))


def _now() -> datetime:
    return datetime.now(EAT).replace(tzinfo=None)


@dataclass
class RefundBreakdown:
    tier: str
    cancelling_party: str
    deposit: Decimal
    balance: Decimal
    total: Decimal
    refund_to_organiser: Decimal
    vendor_retention: Decimal
    deposit_refunded: Decimal
    deposit_retained: Decimal
    balance_refunded: Decimal
    balance_retained: Decimal
    reason_code: str
    human_summary: str
    hours_until_event: float

    def to_dict(self) -> dict:
        return {
            "tier": self.tier,
            "cancelling_party": self.cancelling_party,
            "deposit": float(self.deposit),
            "balance": float(self.balance),
            "total": float(self.total),
            "refund_to_organiser": float(self.refund_to_organiser),
            "vendor_retention": float(self.vendor_retention),
            "deposit_refunded": float(self.deposit_refunded),
            "deposit_retained": float(self.deposit_retained),
            "balance_refunded": float(self.balance_refunded),
            "balance_retained": float(self.balance_retained),
            "reason_code": self.reason_code,
            "human_summary": self.human_summary,
            "hours_until_event": self.hours_until_event,
        }


def _tier_for_booking(db: Session, booking: ServiceBookingRequest) -> str:
    if not booking.user_service_id:
        return CancellationTierEnum.moderate.value
    svc = (
        db.query(UserService)
        .filter(UserService.id == booking.user_service_id)
        .first()
    )
    if not svc or not svc.service_type_id:
        return CancellationTierEnum.moderate.value
    st = db.query(ServiceType).filter(ServiceType.id == svc.service_type_id).first()
    if not st or not st.cancellation_tier:
        return CancellationTierEnum.moderate.value
    val = st.cancellation_tier
    return val.value if hasattr(val, "value") else str(val)


def _event_start(db: Session, booking: ServiceBookingRequest) -> Optional[datetime]:
    if not booking.event_id:
        return None
    ev = db.query(Event).filter(Event.id == booking.event_id).first()
    if not ev or not ev.start_date:
        return None
    if isinstance(ev.start_date, datetime):
        return ev.start_date
    return datetime.combine(ev.start_date, datetime.min.time())


def _flexible(deposit: Decimal, balance: Decimal, days: float) -> tuple:
    if days > 7:
        return deposit, balance, "flexible_full_refund"
    if days >= 2:
        # deposit kept; 70% of balance refunded
        return ZERO, balance * Decimal("0.70"), "flexible_7d_to_48h"
    return ZERO, ZERO, "flexible_within_48h_no_refund"


def _moderate(deposit: Decimal, balance: Decimal, days: float) -> tuple:
    if days > 14:
        return deposit, balance, "moderate_full_refund"
    if days > 7:
        return ZERO, balance * Decimal("0.50"), "moderate_14d_to_7d"
    if days >= 2:
        return ZERO, ZERO, "moderate_7d_to_48h"
    return ZERO, ZERO, "moderate_within_48h_no_refund"


def _strict(deposit: Decimal, balance: Decimal, days: float) -> tuple:
    if days > 21:
        return deposit, balance, "strict_full_refund"
    if days > 14:
        return ZERO, balance * Decimal("0.50"), "strict_21d_to_14d"
    if days >= 2:
        return ZERO, ZERO, "strict_14d_to_48h"
    return ZERO, ZERO, "strict_within_48h_no_refund"


_TIER_FN = {
    "flexible": _flexible,
    "moderate": _moderate,
    "strict": _strict,
}


def calculate(
    db: Session,
    booking: ServiceBookingRequest,
    cancelling_party: str,
    cancel_at: Optional[datetime] = None,
) -> RefundBreakdown:
    """Return a deterministic refund breakdown for `booking`."""
    if cancelling_party not in ("organiser", "vendor"):
        cancelling_party = "organiser"

    cancel_at = cancel_at or _now()
    tier = _tier_for_booking(db, booking)

    total = _D(booking.quoted_price or booking.proposed_price or 0)
    deposit = _D(booking.deposit_required or 0)
    if deposit > total:
        deposit = total
    balance = max(ZERO, total - deposit)

    event_start = _event_start(db, booking)
    if event_start:
        delta = event_start - cancel_at
        hours = delta.total_seconds() / 3600
        days = delta.total_seconds() / 86400
    else:
        # No event date → treat as far in future to allow full refund.
        hours = 24 * 365
        days = 365

    # Vendor cancellation always = full refund.
    if cancelling_party == "vendor":
        refund_dep, refund_bal = deposit, balance
        reason = "vendor_cancellation_full_refund"
    else:
        # Organiser cancelling — universal 48h rule applies (overrides tier).
        if hours < 48:
            refund_dep, refund_bal, reason = ZERO, ZERO, "organiser_within_48h_no_refund"
        else:
            fn = _TIER_FN.get(tier, _moderate)
            refund_dep, refund_bal, reason = fn(deposit, balance, days)

    refund = (refund_dep + refund_bal).quantize(Decimal("0.01"))
    retention = (total - refund).quantize(Decimal("0.01"))

    summary = _human_summary(tier, cancelling_party, days, refund, total)

    return RefundBreakdown(
        tier=tier,
        cancelling_party=cancelling_party,
        deposit=deposit,
        balance=balance,
        total=total,
        refund_to_organiser=refund,
        vendor_retention=retention,
        deposit_refunded=refund_dep.quantize(Decimal("0.01")),
        deposit_retained=(deposit - refund_dep).quantize(Decimal("0.01")),
        balance_refunded=refund_bal.quantize(Decimal("0.01")),
        balance_retained=(balance - refund_bal).quantize(Decimal("0.01")),
        reason_code=reason,
        human_summary=summary,
        hours_until_event=round(hours, 1),
    )


def _human_summary(tier: str, party: str, days: float, refund: Decimal, total: Decimal) -> str:
    if party == "vendor":
        return "Vendor is cancelling. The full booking amount will be refunded to the organiser."
    pct = 0 if total == 0 else int((refund / total) * 100)
    when = (
        f"{int(days)} days before the event" if days >= 1
        else f"{int(days * 24)} hours before the event"
    )
    return (
        f"Cancelling {when} under the {tier.title()} tier. "
        f"You will be refunded {pct}% of the total amount."
    )
