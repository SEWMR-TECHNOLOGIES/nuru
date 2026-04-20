"""Received-payments endpoints.

Surface successful (or in-flight) Transactions to the people who are owed
the money — event organizers (contributions / tickets) and service vendors
(bookings) — without ever crediting their wallet. The wallet is reserved
for explicit top-ups only; everything else lives in these views.

Endpoints:
  GET /received-payments/events/{event_id}/contributions
  GET /received-payments/events/{event_id}/tickets
  GET /received-payments/services/{service_id}

Each row includes gross, commission, net, gateway reference, payer,
status and timestamps so the UI can show a full audit trail.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from core.database import get_db
from utils.auth import get_current_user
from utils.helpers import api_response, paginate
from models.users import User
from models.events import Event
from models.services import UserService
from models.payments import Transaction
from models.enums import PaymentTargetTypeEnum, TransactionStatusEnum

router = APIRouter(prefix="/received-payments", tags=["received-payments"])


# ──────────────────────────────────────────────
# Serialiser
# ──────────────────────────────────────────────

def _serialize_received(tx: Transaction, payer: Optional[User]) -> dict:
    payer_name = None
    payer_phone = None
    if payer:
        first = (payer.first_name or "").strip()
        last = (payer.last_name or "").strip()
        payer_name = f"{first} {last}".strip() or payer.phone
        payer_phone = payer.phone
    return {
        "id": str(tx.id),
        "transaction_code": tx.transaction_code,
        "target_type": tx.target_type.value if tx.target_type else None,
        "target_id": str(tx.target_id) if tx.target_id else None,
        "currency_code": tx.currency_code,
        "gross_amount": float(tx.gross_amount or 0),
        "commission_amount": float(tx.commission_amount or 0),
        "net_amount": float(tx.net_amount or 0),
        "method_type": tx.method_type,
        "provider_name": tx.provider_name,
        "external_reference": tx.external_reference,
        "internal_reference": tx.internal_reference,
        "status": tx.status.value if tx.status else None,
        "payer_user_id": str(tx.payer_user_id) if tx.payer_user_id else None,
        "payer_name": payer_name,
        "payer_phone": payer_phone,
        "description": tx.payment_description,
        "initiated_at": tx.initiated_at.isoformat() if tx.initiated_at else None,
        "confirmed_at": tx.confirmed_at.isoformat() if tx.confirmed_at else None,
        "completed_at": tx.completed_at.isoformat() if tx.completed_at else None,
    }


def _paged_received(db: Session, q, page: int, limit: int) -> dict:
    items, pagination = paginate(q, page=page, limit=limit)
    payer_ids = [t.payer_user_id for t in items if t.payer_user_id]
    payers = (
        db.query(User).filter(User.id.in_(payer_ids)).all()
        if payer_ids else []
    )
    by_id = {p.id: p for p in payers}
    return {
        "payments": [_serialize_received(t, by_id.get(t.payer_user_id)) for t in items],
        "pagination": pagination,
    }


def _apply_search(q, search: Optional[str]):
    """Filter transactions by free-text against tx code, references, payer
    name, or payer phone."""
    if not search:
        return q
    s = search.strip()
    if not s:
        return q
    like = f"%{s}%"
    q = q.outerjoin(User, User.id == Transaction.payer_user_id).filter(
        or_(
            Transaction.transaction_code.ilike(like),
            Transaction.external_reference.ilike(like),
            Transaction.internal_reference.ilike(like),
            User.phone.ilike(like),
            User.first_name.ilike(like),
            User.last_name.ilike(like),
        )
    )
    return q


# ──────────────────────────────────────────────
# Authorisation helpers
# ──────────────────────────────────────────────

def _assert_event_owner(db: Session, event_id: UUID, user: User) -> Event:
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
    if event.organizer_id != user.id:
        # NOTE: committee read-access would be added here once Committee
        # roles expose a "view payments" permission.
        raise HTTPException(status_code=403, detail="Forbidden.")
    return event


def _assert_service_owner(db: Session, service_id: UUID, user: User) -> UserService:
    svc = db.query(UserService).filter(UserService.id == service_id).first()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found.")
    if svc.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden.")
    return svc


# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────

VISIBLE_STATUSES = (
    TransactionStatusEnum.credited,
)


@router.get("/events/{event_id}/contributions")
def event_contribution_payments(
    event_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_event_owner(db, event_id, current_user)
    q = db.query(Transaction).filter(
        Transaction.target_type == PaymentTargetTypeEnum.contribution,
        Transaction.target_id == event_id,
        Transaction.status.in_(VISIBLE_STATUSES),
    )
    if status:
        try:
            q = q.filter(Transaction.status == TransactionStatusEnum(status))
        except ValueError:
            pass
    q = _apply_search(q, search)
    q = q.order_by(Transaction.created_at.desc())
    return api_response(True, "Contribution payments retrieved.",
                        _paged_received(db, q, page, limit))


@router.get("/events/{event_id}/tickets")
def event_ticket_payments(
    event_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_event_owner(db, event_id, current_user)
    # Tickets store target_id = ticket_id, not event_id. Resolve via the
    # ticketing table.
    from models.ticketing import EventTicket
    ticket_ids_subq = (
        db.query(EventTicket.id).filter(EventTicket.event_id == event_id).subquery()
    )
    q = db.query(Transaction).filter(
        Transaction.target_type == PaymentTargetTypeEnum.ticket,
        Transaction.target_id.in_(ticket_ids_subq),
        Transaction.status.in_(VISIBLE_STATUSES),
    )
    if status:
        try:
            q = q.filter(Transaction.status == TransactionStatusEnum(status))
        except ValueError:
            pass
    q = _apply_search(q, search)
    q = q.order_by(Transaction.created_at.desc())
    return api_response(True, "Ticket payments retrieved.",
                        _paged_received(db, q, page, limit))


@router.get("/services/{service_id}")
def service_payments(
    service_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_service_owner(db, service_id, current_user)
    from models.bookings import ServiceBookingRequest
    booking_ids_subq = (
        db.query(ServiceBookingRequest.id)
        .filter(ServiceBookingRequest.user_service_id == service_id)
        .subquery()
    )
    q = db.query(Transaction).filter(
        Transaction.target_type == PaymentTargetTypeEnum.booking,
        Transaction.target_id.in_(booking_ids_subq),
        Transaction.status.in_(VISIBLE_STATUSES),
    )
    if status:
        try:
            q = q.filter(Transaction.status == TransactionStatusEnum(status))
        except ValueError:
            pass
    q = _apply_search(q, search)
    q = q.order_by(Transaction.created_at.desc())
    return api_response(True, "Service payments retrieved.",
                        _paged_received(db, q, page, limit))


@router.get("/my/tickets")
def my_ticket_payments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The current user's ticket payment history (as a buyer)."""
    from models.ticketing import EventTicket
    ticket_ids_subq = (
        db.query(EventTicket.id)
        .filter(EventTicket.buyer_user_id == current_user.id)
        .subquery()
    )
    q = db.query(Transaction).filter(
        Transaction.target_type == PaymentTargetTypeEnum.ticket,
        Transaction.target_id.in_(ticket_ids_subq),
        Transaction.status.in_(VISIBLE_STATUSES),
    )
    q = _apply_search(q, search)
    q = q.order_by(Transaction.created_at.desc())
    return api_response(True, "Your ticket payments retrieved.",
                        _paged_received(db, q, page, limit))


@router.get("/my/contributions")
def my_contribution_payments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The current user's contribution payment history (payments they made)."""
    q = db.query(Transaction).filter(
        Transaction.target_type == PaymentTargetTypeEnum.contribution,
        Transaction.payer_user_id == current_user.id,
        Transaction.status.in_(VISIBLE_STATUSES),
    )
    q = _apply_search(q, search)
    q = q.order_by(Transaction.created_at.desc())
    return api_response(True, "Your contribution payments retrieved.",
                        _paged_received(db, q, page, limit))

