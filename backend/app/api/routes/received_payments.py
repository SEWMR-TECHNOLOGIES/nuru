"""Received-payments endpoints.

Surface successful (or in-flight) Transactions to the people who are owed
the money — event organizers (contributions / tickets) and service vendors
(bookings) — without ever crediting their wallet. The wallet is reserved
for explicit top-ups only; everything else lives in these views.

Endpoints:
  GET /received-payments/events/{event_id}/contributions
  GET /received-payments/events/{event_id}/tickets
  GET /received-payments/services/{service_id}
  GET /received-payments/my/tickets
  GET /received-payments/my/contributions

Each row includes gross, commission, net, gateway reference, payer,
status and timestamps so the UI can show a full audit trail.

Offline-confirmed payments — buyers who declared "I already paid via
another method" and were approved by the organiser — are NOT stored in
the Transactions table. We merge them in here from the offline-claim
tables (TicketOfflineClaim, EventContribution.payment_channel) so that
they appear seamlessly alongside gateway payments in every list.
"""

from typing import Optional, List, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from core.database import get_db
from utils.auth import get_current_user
from utils.helpers import api_response
from models.users import User
from models.events import Event
from models.services import UserService
from models.payments import Transaction
from models.enums import PaymentTargetTypeEnum, TransactionStatusEnum, ContributionStatusEnum
from models.contributions import EventContribution, EventContributor, UserContributor
from models.ticket_offline_claims import TicketOfflineClaim
from models.ticketing import EventTicketClass
from models.references import Currency

router = APIRouter(prefix="/received-payments", tags=["received-payments"])


def _event_currency(db: Session, event: Event) -> str:
    """Resolve the currency code for an event, defaulting to TZS."""
    if getattr(event, "currency_id", None):
        cur = db.query(Currency).filter(Currency.id == event.currency_id).first()
        if cur and getattr(cur, "code", None):
            return cur.code.strip()
    return "TZS"


# ──────────────────────────────────────────────
# Serialisers
# ──────────────────────────────────────────────

def _serialize_received(tx: Transaction, payer: Optional[User]) -> Dict[str, Any]:
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
        "is_offline": False,
    }


def _serialize_offline_ticket_claim(
    claim: TicketOfflineClaim,
    *,
    currency_code: str,
    description: Optional[str],
) -> Dict[str, Any]:
    """Render a TicketOfflineClaim in the same shape as a Transaction.

    Maps the claim status onto the transaction-status vocabulary the UI
    already speaks: confirmed → credited, pending → pending, rejected → failed.
    """
    confirmed_at = claim.reviewed_at.isoformat() if claim.reviewed_at else None
    initiated_at = claim.created_at.isoformat() if claim.created_at else None
    status_map = {
        "confirmed": TransactionStatusEnum.credited.value,
        "pending": TransactionStatusEnum.pending.value,
        "rejected": TransactionStatusEnum.failed.value,
    }
    mapped_status = status_map.get(claim.status, TransactionStatusEnum.pending.value)
    return {
        "id": f"oc-tkt-{claim.id}",
        "transaction_code": claim.transaction_code or f"OFFLINE-{str(claim.id)[:8].upper()}",
        "target_type": PaymentTargetTypeEnum.ticket.value,
        "target_id": str(claim.issued_ticket_id) if claim.issued_ticket_id else None,
        "currency_code": currency_code,
        "gross_amount": float(claim.amount or 0),
        # Offline payments bypass the gateway → no commission yet.
        "commission_amount": 0.0,
        "net_amount": float(claim.amount or 0),
        "method_type": claim.payment_channel,
        "provider_name": claim.provider_name,
        "external_reference": claim.transaction_code,
        "internal_reference": None,
        "status": mapped_status,
        "payer_user_id": str(claim.claimant_user_id) if claim.claimant_user_id else None,
        "payer_name": claim.claimant_name,
        "payer_phone": claim.claimant_phone,
        "description": description,
        "initiated_at": initiated_at,
        "confirmed_at": confirmed_at,
        "completed_at": confirmed_at,
        "is_offline": True,
    }


def _serialize_offline_contribution(
    c: EventContribution,
    contributor: Optional[UserContributor],
    *,
    currency_code: str,
    description: Optional[str],
) -> Dict[str, Any]:
    payer_name = contributor.name if contributor else c.contributor_name
    payer_phone = contributor.phone if contributor else None
    confirmed_at = c.confirmed_at.isoformat() if c.confirmed_at else None
    initiated_at = (
        c.claim_submitted_at.isoformat() if c.claim_submitted_at
        else (c.created_at.isoformat() if c.created_at else None)
    )
    return {
        "id": f"oc-con-{c.id}",
        "transaction_code": c.transaction_ref or f"OFFLINE-{str(c.id)[:8].upper()}",
        "target_type": PaymentTargetTypeEnum.contribution.value,
        "target_id": str(c.event_id) if c.event_id else None,
        "currency_code": currency_code,
        "gross_amount": float(c.amount or 0),
        "commission_amount": 0.0,
        "net_amount": float(c.amount or 0),
        "method_type": c.payment_channel,
        "provider_name": c.provider_name,
        "external_reference": c.transaction_ref,
        "internal_reference": None,
        "status": TransactionStatusEnum.credited.value,
        "payer_user_id": (
            str(contributor.contributor_user_id) if contributor and contributor.contributor_user_id else None
        ),
        "payer_name": payer_name,
        "payer_phone": payer_phone,
        "description": description,
        "initiated_at": initiated_at,
        "confirmed_at": confirmed_at,
        "completed_at": confirmed_at,
        "is_offline": True,
    }


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

VISIBLE_STATUSES = (
    TransactionStatusEnum.credited,
)

# Buyers / contributors should see the FULL lifecycle of their attempts so
# they can retry failed gateway charges, watch in-flight ones, and reprint
# completed receipts. Organisers stay on `VISIBLE_STATUSES` (credited only).
MY_VISIBLE_STATUSES = (
    TransactionStatusEnum.pending,
    TransactionStatusEnum.processing,
    TransactionStatusEnum.paid,
    TransactionStatusEnum.credited,
    TransactionStatusEnum.failed,
)


def _retryable(row: Dict[str, Any]) -> bool:
    """A failed gateway charge (mobile_money / bank via SasaPay) can be
    retried by re-initiating against the same target. Wallet-funded payments
    and offline-confirmed claims cannot — those are out-of-band."""
    if row.get("is_offline"):
        return False
    if row.get("status") != TransactionStatusEnum.failed.value:
        return False
    method = (row.get("method_type") or "").lower()
    return method in ("mobile_money", "bank")


def _enrich_ticket_rows(db: Session, rows: List[Dict[str, Any]]) -> None:
    """Attach event + ticket-class context to ticket payment rows so the
    mobile UI can render a rich receipt without follow-up calls."""
    from models.ticketing import EventTicket
    ticket_ids = []
    for r in rows:
        tid = r.get("target_id")
        if tid and not r.get("is_offline"):
            try:
                ticket_ids.append(UUID(tid))
            except Exception:
                pass
    if not ticket_ids:
        return
    tickets = (
        db.query(EventTicket, EventTicketClass, Event)
        .join(EventTicketClass, EventTicketClass.id == EventTicket.ticket_class_id)
        .join(Event, Event.id == EventTicket.event_id)
        .filter(EventTicket.id.in_(ticket_ids))
        .all()
    )
    by_id = {str(t.id): (t, tc, ev) for t, tc, ev in tickets}
    for r in rows:
        bundle = by_id.get(r.get("target_id") or "")
        if not bundle:
            continue
        tk, tc, ev = bundle
        r["event_id"] = str(ev.id)
        r["event_name"] = ev.name
        r["event_cover_image"] = getattr(ev, "cover_image_url", None)
        r["event_start_date"] = ev.start_date.isoformat() if ev.start_date else None
        r["event_location"] = ev.location
        r["ticket_class_id"] = str(tc.id)
        r["ticket_class_name"] = tc.name
        r["ticket_id"] = str(tk.id)
        r["ticket_code"] = tk.ticket_code
        r["ticket_quantity"] = tk.quantity or 1
    # Decorate retry hint for every row (also covers offline → False).
    for r in rows:
        r["can_retry"] = _retryable(r)


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


def _matches_search(row: Dict[str, Any], search: Optional[str]) -> bool:
    """In-Python search across an offline payment row (no SQL join needed)."""
    if not search:
        return True
    s = search.strip().lower()
    if not s:
        return True
    haystack = " ".join(
        str(row.get(k) or "")
        for k in (
            "transaction_code", "external_reference", "internal_reference",
            "payer_name", "payer_phone", "provider_name", "method_type",
            "description",
        )
    ).lower()
    return s in haystack


def _sort_key(row: Dict[str, Any]) -> str:
    """Sort merged rows by best available timestamp, descending."""
    return (
        row.get("completed_at")
        or row.get("confirmed_at")
        or row.get("initiated_at")
        or ""
    )


def _paginate_merged(rows: List[Dict[str, Any]], page: int, limit: int) -> Dict[str, Any]:
    total_items = len(rows)
    total_pages = max(1, (total_items + limit - 1) // limit)
    page = max(1, min(page, total_pages))
    start = (page - 1) * limit
    end = start + limit
    return {
        "payments": rows[start:end],
        "pagination": {
            "page": page,
            "limit": limit,
            "total_items": total_items,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        },
    }


def _hydrate_transactions(db: Session, txs: List[Transaction]) -> List[Dict[str, Any]]:
    payer_ids = [t.payer_user_id for t in txs if t.payer_user_id]
    payers = (
        db.query(User).filter(User.id.in_(payer_ids)).all()
        if payer_ids else []
    )
    by_id = {p.id: p for p in payers}
    return [_serialize_received(t, by_id.get(t.payer_user_id)) for t in txs]


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
# Routes — organiser / vendor side
# ──────────────────────────────────────────────

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
    event = _assert_event_owner(db, event_id, current_user)

    # 1. Gateway transactions (Transaction table)
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
    tx_rows = _hydrate_transactions(db, q.all())

    # 2. Offline-confirmed contributions (no Transaction row).
    # Detect them by the offline-claim audit field `payment_channel` being set
    # AND the row being confirmed (so pending claims don't pollute the list).
    offline_rows: List[Dict[str, Any]] = []
    if not status or status == TransactionStatusEnum.credited.value:
        offline_q = (
            db.query(EventContribution, UserContributor)
            .join(EventContributor, EventContributor.id == EventContribution.event_contributor_id)
            .join(UserContributor, UserContributor.id == EventContributor.contributor_id)
            .filter(
                EventContribution.event_id == event_id,
                EventContribution.payment_channel.isnot(None),
                EventContribution.confirmation_status == ContributionStatusEnum.confirmed,
            )
        )
        currency = _event_currency(db, event)
        description = f"Contribution · {event.name}"
        for c, contrib in offline_q.all():
            row = _serialize_offline_contribution(
                c, contrib, currency_code=currency, description=description,
            )
            if _matches_search(row, search):
                offline_rows.append(row)

    merged = sorted(tx_rows + offline_rows, key=_sort_key, reverse=True)
    return api_response(True, "Contribution payments retrieved.",
                        _paginate_merged(merged, page, limit))


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
    event = _assert_event_owner(db, event_id, current_user)
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
    tx_rows = _hydrate_transactions(db, q.all())

    # Offline-confirmed ticket claims
    offline_rows: List[Dict[str, Any]] = []
    if not status or status == TransactionStatusEnum.credited.value:
        currency = _event_currency(db, event)
        # Resolve ticket-class names for nicer descriptions.
        claims = (
            db.query(TicketOfflineClaim, EventTicketClass)
            .join(EventTicketClass, EventTicketClass.id == TicketOfflineClaim.ticket_class_id)
            .filter(
                TicketOfflineClaim.event_id == event_id,
                TicketOfflineClaim.status == "confirmed",
            )
            .all()
        )
        for claim, tc in claims:
            description = f"Ticket · {tc.name} · {event.name}"
            row = _serialize_offline_ticket_claim(
                claim, currency_code=currency, description=description,
            )
            if _matches_search(row, search):
                offline_rows.append(row)

    merged = sorted(tx_rows + offline_rows, key=_sort_key, reverse=True)
    return api_response(True, "Ticket payments retrieved.",
                        _paginate_merged(merged, page, limit))


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
    tx_rows = _hydrate_transactions(db, q.all())
    # Services don't have an offline-claim flow yet — just gateway rows.
    return api_response(True, "Service payments retrieved.",
                        _paginate_merged(tx_rows, page, limit))


# ──────────────────────────────────────────────
# Routes — buyer / contributor side ("My …")
# ──────────────────────────────────────────────

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
        Transaction.status.in_(MY_VISIBLE_STATUSES),
    )
    q = _apply_search(q, search)
    q = q.order_by(Transaction.created_at.desc())
    tx_rows = _hydrate_transactions(db, q.all())

    # Offline ticket claims this user submitted — surface every status
    # (pending / confirmed / rejected) so the buyer sees the full lifecycle.
    offline_rows: List[Dict[str, Any]] = []
    claims = (
        db.query(TicketOfflineClaim, EventTicketClass, Event)
        .join(EventTicketClass, EventTicketClass.id == TicketOfflineClaim.ticket_class_id)
        .join(Event, Event.id == TicketOfflineClaim.event_id)
        .filter(
            TicketOfflineClaim.claimant_user_id == current_user.id,
        )
        .all()
    )
    # Track confirmed claim transaction_codes so we can suppress any
    # orphan gateway pending Transactions that were superseded by an
    # off-platform approval.
    confirmed_codes = {
        (claim.transaction_code or "").strip().lower()
        for claim, _, _ in claims
        if claim.status == "confirmed" and claim.transaction_code
    }
    for claim, tc, ev in claims:
        currency = _event_currency(db, ev)
        description = f"Ticket · {tc.name} · {ev.name}"
        row = _serialize_offline_ticket_claim(
            claim, currency_code=currency, description=description,
        )
        # Enrich offline rows with the same event/class context.
        row["event_id"] = str(ev.id)
        row["event_name"] = ev.name
        row["event_cover_image"] = getattr(ev, "cover_image_url", None)
        row["event_start_date"] = ev.start_date.isoformat() if ev.start_date else None
        row["event_location"] = ev.location
        row["ticket_class_id"] = str(tc.id)
        row["ticket_class_name"] = tc.name
        row["ticket_quantity"] = claim.quantity or 1
        if _matches_search(row, search):
            offline_rows.append(row)

    # Drop pending gateway rows whose external_reference / transaction_code
    # already has a confirmed offline counterpart.
    if confirmed_codes:
        tx_rows = [
            r for r in tx_rows
            if r.get("status") != TransactionStatusEnum.pending.value
            or (str(r.get("external_reference") or "").strip().lower() not in confirmed_codes
                and str(r.get("transaction_code") or "").strip().lower() not in confirmed_codes)
        ]

    _enrich_ticket_rows(db, tx_rows)
    merged = sorted(tx_rows + offline_rows, key=_sort_key, reverse=True)
    # Final pass to ensure every row carries the can_retry flag.
    for r in merged:
        r.setdefault("can_retry", _retryable(r))
    return api_response(True, "Your ticket payments retrieved.",
                        _paginate_merged(merged, page, limit))


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
        Transaction.status.in_(MY_VISIBLE_STATUSES),
    )
    q = _apply_search(q, search)
    q = q.order_by(Transaction.created_at.desc())
    tx_rows = _hydrate_transactions(db, q.all())

    # Offline contributions this user paid (linked via UserContributor.contributor_user_id).
    offline_rows: List[Dict[str, Any]] = []
    offline_q = (
        db.query(EventContribution, UserContributor, Event)
        .join(EventContributor, EventContributor.id == EventContribution.event_contributor_id)
        .join(UserContributor, UserContributor.id == EventContributor.contributor_id)
        .join(Event, Event.id == EventContribution.event_id)
        .filter(
            UserContributor.contributor_user_id == current_user.id,
            EventContribution.payment_channel.isnot(None),
            EventContribution.confirmation_status == ContributionStatusEnum.confirmed,
        )
    )
    for c, contrib, ev in offline_q.all():
        currency = _event_currency(db, ev)
        description = f"Contribution · {ev.name}"
        row = _serialize_offline_contribution(
            c, contrib, currency_code=currency, description=description,
        )
        if _matches_search(row, search):
            offline_rows.append(row)

    merged = sorted(tx_rows + offline_rows, key=_sort_key, reverse=True)
    for r in merged:
        r.setdefault("can_retry", _retryable(r))
    return api_response(True, "Your contribution payments retrieved.",
                        _paginate_merged(merged, page, limit))
