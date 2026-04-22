"""Ticket reservation endpoints — airline-style "hold without paying" flow.

Reservations live in `event_tickets` rows with `status='reserved'` and a
non-null `reserved_until` timestamp. They block inventory until the user
either:
  * pays (the row converts to a normal `pending` order via /convert), or
  * cancels manually, or
  * the sweep job hard-deletes the row after `reserved_until` passes.

Expiry tier (time between now and event start):
  > 7 days   → 48h hold
  1–7 days   → 6h hold
  < 24h      → 30 min hold
  < 2h       → reservations DISABLED (must direct-pay)

Limits:
  * Max 1 active reservation per (user, ticket_class).

Endpoints exposed:
  POST   /ticketing/reserve
  POST   /ticketing/reservations/{ticket_id}/convert
  DELETE /ticketing/reservations/{ticket_id}
  GET    /ticketing/my-reservations
  POST   /ticketing/my-reservations/sweep        (auth, scoped)
  POST   /ticketing/reservations/sweep           (PUBLIC, idempotent — wired to a cron later)
"""
import secrets as _secrets
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from core.database import get_db
from models import (
    User, Event, EventTicketClass, EventTicket,
    TicketOrderStatusEnum, PaymentStatusEnum, TicketApprovalStatusEnum,
)
from utils.auth import get_current_user
from utils.helpers import standard_response


router = APIRouter(prefix="/ticketing", tags=["Ticketing — Reservations"])


# ──────────────────────────────────────────────
# Expiry tier (airline-style)
# ──────────────────────────────────────────────
def _event_start_dt(event: Event) -> datetime | None:
    """Best-effort event start datetime. Falls back to start_date alone.

    Some legacy rows store `start_date` as a plain `date` (no time component),
    which crashes when subtracted from a `datetime`. Coerce to midnight datetime
    so the math always works.
    """
    raw = event.start_date
    if not raw:
        return None
    # `datetime` is a subclass of `date`, so check datetime first.
    if isinstance(raw, datetime):
        return raw
    # Plain `date` — promote to midnight datetime.
    from datetime import time as _time
    return datetime.combine(raw, _time.min)


def _compute_reservation_expiry(event_start: datetime, now: datetime) -> datetime | None:
    """Return the deadline by which payment must be made, or None if reservations
    are disabled for this event (event starts in < 2 hours)."""
    if not event_start:
        # No date set — give a generous 48h hold
        return now + timedelta(hours=48)

    delta = event_start - now
    seconds = delta.total_seconds()

    if seconds < 2 * 3600:
        return None  # reservations disabled
    if seconds < 24 * 3600:
        hold = timedelta(minutes=30)
    elif seconds < 7 * 24 * 3600:
        hold = timedelta(hours=6)
    else:
        hold = timedelta(hours=48)

    deadline = now + hold
    # Never let the deadline cross the event start
    cutoff = event_start - timedelta(minutes=15)
    return min(deadline, cutoff)


# ──────────────────────────────────────────────
# Helper: occupied (non-rejected, non-cancelled) seat count
# ──────────────────────────────────────────────
def _blocked_qty(db: Session, ticket_class_id) -> int:
    """All quantity blocked against a ticket class (paid + reserved + pending)."""
    return int(db.query(sa_func.coalesce(sa_func.sum(EventTicket.quantity), 0)).filter(
        EventTicket.ticket_class_id == ticket_class_id,
        EventTicket.status.notin_([
            TicketOrderStatusEnum.rejected,
            TicketOrderStatusEnum.cancelled,
        ]),
    ).scalar())


def _reserved_qty(db: Session, ticket_class_id) -> int:
    return int(db.query(sa_func.coalesce(sa_func.sum(EventTicket.quantity), 0)).filter(
        EventTicket.ticket_class_id == ticket_class_id,
        EventTicket.status == TicketOrderStatusEnum.reserved,
    ).scalar())


# ──────────────────────────────────────────────
# POST /ticketing/reserve
# ──────────────────────────────────────────────
@router.post("/reserve")
async def reserve_ticket(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Place an unpaid hold on a ticket class. Inventory is blocked until the
    deadline returned in the response."""
    payload = await request.json()
    ticket_class_id = payload.get("ticket_class_id")
    quantity = int(payload.get("quantity", 1))

    if not ticket_class_id:
        return standard_response(False, "Ticket class ID is required")
    if quantity < 1:
        return standard_response(False, "Quantity must be at least 1")

    try:
        tcid = UUID(ticket_class_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid ticket class ID")

    tc = db.query(EventTicketClass).filter(EventTicketClass.id == tcid).first()
    if not tc:
        return standard_response(False, "Ticket class not found")

    event = db.query(Event).filter(Event.id == tc.event_id).first()
    if not event:
        return standard_response(False, "Event not found")

    # Compute the deadline first — if event starts too soon, refuse the reservation.
    now = datetime.utcnow()
    event_start = _event_start_dt(event)
    deadline = _compute_reservation_expiry(event_start, now) if event_start else (now + timedelta(hours=48))
    if deadline is None:
        return standard_response(False, "Reservations are no longer accepted for this event — please pay directly.")

    # 1 active reservation per (user, class)
    existing = db.query(EventTicket).filter(
        EventTicket.ticket_class_id == tcid,
        EventTicket.buyer_user_id == current_user.id,
        EventTicket.status == TicketOrderStatusEnum.reserved,
    ).first()
    if existing:
        return standard_response(False, "You already have an active reservation for this ticket. Pay for it or cancel it first.")

    # Inventory check (paid + reserved + pending all count as blocked)
    blocked = _blocked_qty(db, tcid)
    available = tc.quantity - blocked
    if available < quantity:
        return standard_response(False, f"Only {available} tickets available for '{tc.name}'.")

    total = float(tc.price) * quantity
    code = f"NTK-{_secrets.token_hex(4).upper()}"

    ticket = EventTicket(
        ticket_class_id=tcid,
        event_id=tc.event_id,
        buyer_user_id=current_user.id,
        ticket_code=code,
        quantity=quantity,
        total_amount=total,
        buyer_name=f"{current_user.first_name} {current_user.last_name}",
        buyer_phone=current_user.phone,
        buyer_email=current_user.email,
        status=TicketOrderStatusEnum.reserved,
        payment_status=PaymentStatusEnum.pending,
        reserved_until=deadline,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    return standard_response(True, "Ticket reserved", {
        "ticket_id": str(ticket.id),
        "ticket_code": code,
        "quantity": quantity,
        "total_amount": total,
        "event_id": str(tc.event_id),
        "ticket_class": tc.name,
        "reserved_until": ticket.reserved_until.isoformat() if ticket.reserved_until else None,
        "seconds_remaining": max(0, int((ticket.reserved_until - now).total_seconds())) if ticket.reserved_until else 0,
    })


# ──────────────────────────────────────────────
# POST /ticketing/reservations/{ticket_id}/convert
# ──────────────────────────────────────────────
@router.post("/reservations/{ticket_id}/convert")
def convert_reservation_to_pending(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Promote a reservation to a normal pending order so the standard
    payment / offline-claim flows can pick it up."""
    try:
        tid = UUID(ticket_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid ticket ID")

    t = db.query(EventTicket).filter(EventTicket.id == tid).first()
    if not t or t.buyer_user_id != current_user.id:
        return standard_response(False, "Reservation not found")
    if t.status != TicketOrderStatusEnum.reserved:
        return standard_response(False, "This ticket is no longer a reservation.")
    if t.reserved_until and t.reserved_until < datetime.utcnow():
        # Expired between sweeps — treat as gone.
        db.delete(t)
        db.commit()
        return standard_response(False, "This reservation has expired.")

    t.status = TicketOrderStatusEnum.pending
    t.reserved_until = None
    db.commit()
    db.refresh(t)
    return standard_response(True, "Reservation ready for payment", {
        "ticket_id": str(t.id),
        "ticket_code": t.ticket_code,
        "total_amount": float(t.total_amount),
        "ticket_class_id": str(t.ticket_class_id),
        "quantity": t.quantity,
    })


# ──────────────────────────────────────────────
# DELETE /ticketing/reservations/{ticket_id}
# ──────────────────────────────────────────────
@router.delete("/reservations/{ticket_id}")
def cancel_reservation(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        tid = UUID(ticket_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid ticket ID")

    t = db.query(EventTicket).filter(EventTicket.id == tid).first()
    if not t or t.buyer_user_id != current_user.id:
        return standard_response(False, "Reservation not found")
    if t.status != TicketOrderStatusEnum.reserved:
        return standard_response(False, "This ticket is not a reservation.")
    db.delete(t)
    db.commit()
    return standard_response(True, "Reservation cancelled")


# ──────────────────────────────────────────────
# GET /ticketing/my-reservations
# ──────────────────────────────────────────────
@router.get("/my-reservations")
def list_my_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lightweight list for the My Tickets reservations panel.

    NOTE: This endpoint *also* sweeps the caller's expired reservations as a
    side-effect so the UI never shows stale rows."""
    now = datetime.utcnow()

    # Hard-delete any of THIS user's reservations that are already past due.
    db.query(EventTicket).filter(
        EventTicket.buyer_user_id == current_user.id,
        EventTicket.status == TicketOrderStatusEnum.reserved,
        EventTicket.reserved_until.isnot(None),
        EventTicket.reserved_until < now,
    ).delete(synchronize_session=False)
    db.commit()

    rows = db.query(EventTicket).filter(
        EventTicket.buyer_user_id == current_user.id,
        EventTicket.status == TicketOrderStatusEnum.reserved,
    ).order_by(EventTicket.reserved_until.asc()).all()

    out = []
    for t in rows:
        event = db.query(Event).filter(Event.id == t.event_id).first()
        tc = db.query(EventTicketClass).filter(EventTicketClass.id == t.ticket_class_id).first()
        deadline = t.reserved_until
        out.append({
            "id": str(t.id),
            "ticket_code": t.ticket_code,
            "ticket_class_id": str(t.ticket_class_id),
            "ticket_class": tc.name if tc else None,
            "quantity": t.quantity,
            "total_amount": float(t.total_amount),
            "reserved_until": deadline.isoformat() if deadline else None,
            "seconds_remaining": max(0, int((deadline - now).total_seconds())) if deadline else 0,
            "event": {
                "id": str(event.id) if event else None,
                "name": event.name if event else None,
                "start_date": str(event.start_date) if event and event.start_date else None,
                "location": event.location if event else None,
                "cover_image": event.cover_image_url if event else None,
            } if event else None,
        })
    return standard_response(True, "Reservations fetched", {"reservations": out})


# ──────────────────────────────────────────────
# POST /ticketing/my-reservations/sweep  (auth, user-scoped)
# ──────────────────────────────────────────────
@router.post("/my-reservations/sweep")
def sweep_my_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    deleted = db.query(EventTicket).filter(
        EventTicket.buyer_user_id == current_user.id,
        EventTicket.status == TicketOrderStatusEnum.reserved,
        EventTicket.reserved_until.isnot(None),
        EventTicket.reserved_until < now,
    ).delete(synchronize_session=False)
    db.commit()
    return standard_response(True, f"Swept {deleted} expired reservation(s)", {"deleted": int(deleted)})


# ──────────────────────────────────────────────
# POST /ticketing/reservations/sweep  (PUBLIC, idempotent)
# ──────────────────────────────────────────────
@router.post("/reservations/sweep")
def sweep_all_expired_reservations(db: Session = Depends(get_db)):
    """Hard-delete every reservation past its `reserved_until`. Public and
    idempotent — safe to wire into cron later. No data exposure: returns only
    the count."""
    now = datetime.utcnow()
    deleted = db.query(EventTicket).filter(
        EventTicket.status == TicketOrderStatusEnum.reserved,
        EventTicket.reserved_until.isnot(None),
        EventTicket.reserved_until < now,
    ).delete(synchronize_session=False)
    db.commit()
    return standard_response(True, f"Swept {deleted} expired reservation(s)", {"deleted": int(deleted)})
