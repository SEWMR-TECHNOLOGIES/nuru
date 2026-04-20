"""Customer-facing payment endpoints.

POST /payments/initiate
    Body: { target_type, target_id, gross_amount, currency_code, country_code,
            method_type, provider_id?, payment_channel, phone_number?,
            payment_description, beneficiary_user_id? }
    Response: { transaction, checkout_request_id?, next_action }

GET  /payments/{transaction_id}/status         → polled by frontend
POST /payments/callback                         → SasaPay webhook (no auth)
GET  /payments/providers                        → active providers for a country
GET  /payments/my-transactions                  → payer history
"""

from datetime import datetime, timezone


def _iso_utc(dt):
    """Serialize a datetime as a UTC ISO-8601 string with explicit ``+00:00``.

    Database columns are timezone-naive but values are stored in UTC, so
    naive timestamps are tagged with UTC before being serialized. Without
    this the frontend interprets them as local time and shows wrong
    timezones on receipts and history rows.
    """
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()
from decimal import Decimal
import uuid as uuid_lib
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from core.database import get_db
from utils.auth import get_current_user
from utils.helpers import api_response, paginate
from models.users import User
from models.payments import (
    Transaction, MobilePaymentAttempt, PaymentCallbackLog,
    PaymentProvider, Wallet,
)
from models.ticketing import EventTicket
from models.enums import (
    PaymentTargetTypeEnum, TransactionStatusEnum, PaymentStatusEnum,
)
from services.payment_gateway import gateway, PaymentGateway
from services.transaction_service import create_transaction
from services.wallet_service import get_or_create_wallet, credit_available, commission_charge


router = APIRouter(prefix="/payments", tags=["payments"])

TARGET_TYPE_ALIASES = {
    "event_ticket": PaymentTargetTypeEnum.ticket.value,
    "ticket_purchase": PaymentTargetTypeEnum.ticket.value,
    "event_contribution": PaymentTargetTypeEnum.contribution.value,
    "service_booking": PaymentTargetTypeEnum.booking.value,
    "payout": PaymentTargetTypeEnum.withdrawal.value,
}


# Phrases the gateway returns as a generic "we got your query" ack — these
# are NOT failure descriptions and must never be persisted as failure_reason.
_GATEWAY_ACK_NOISE = (
    "your request has been received",
    "check your callback url",
    "request received",
    "queued for processing",
    "staged for processing",
)


def _clean_failure_reason(reason):
    """Strip gateway acknowledgement noise so users see a real failure cause.

    SasaPay's status-query may answer ``{"status": true, "message": "Your
    request has been received. Check your callback url for response"}`` while
    the real result is in flight via the webhook. That message is meaningless
    to end users and must never appear under a "Failure reason" label.
    """
    if not reason:
        return None
    text = str(reason).strip()
    if not text:
        return None
    low = text.lower()
    for noise in _GATEWAY_ACK_NOISE:
        if noise in low:
            return None
    return text


def _failure_reason_from_callbacks(db: Session, tx, attempt) -> Optional[str]:
    """Inspect persisted callback rows for this tx and return a human reason.

    Used when the gateway's status-query is silent (returns the async ack
    "Your request has been received…") but a real C2B callback has already
    landed on /payments/callback with a non-zero ResultCode. We match
    callbacks via:
      • PaymentCallbackLog.transaction_id == tx.id (post-link)
      • PaymentCallbackLog.checkout_request_id == attempt.checkout_request_id
        (rows that arrived before linkage was possible)
    """
    conds = [PaymentCallbackLog.transaction_id == tx.id]
    if attempt and attempt.checkout_request_id:
        conds.append(PaymentCallbackLog.checkout_request_id == attempt.checkout_request_id)
    from sqlalchemy import or_ as _or
    rows = (
        db.query(PaymentCallbackLog)
        .filter(_or(*conds))
        .order_by(PaymentCallbackLog.received_at.desc())
        .limit(10)
        .all()
    )
    for r in rows:
        p = r.payload or {}
        if not isinstance(p, dict):
            continue
        rc = p.get("ResultCode") if p.get("ResultCode") is not None else p.get("ResponseCode")
        if rc is None or str(rc) == "0":
            continue
        reason = (
            p.get("ResultDesc")
            or p.get("ResultDescription")
            or p.get("ResponseDescription")
            or p.get("detail")
        )
        cleaned = _clean_failure_reason(reason)
        if cleaned:
            return cleaned
        # Even with no description, surface the code so the user gets a hint
        return f"Gateway error (code {rc})."
    return None


# ──────────────────────────────────────────────
# Serializers
# ──────────────────────────────────────────────

def _serialize_tx(tx: Transaction) -> dict:
    return {
        "id": str(tx.id),
        "transaction_code": tx.transaction_code,
        "target_type": tx.target_type.value if tx.target_type else None,
        "target_id": str(tx.target_id) if tx.target_id else None,
        "country_code": tx.country_code,
        "currency_code": tx.currency_code,
        "gross_amount": float(tx.gross_amount or 0),
        "commission_amount": float(tx.commission_amount or 0),
        "net_amount": float(tx.net_amount or 0),
        "method_type": tx.method_type,
        "provider_name": tx.provider_name,
        "payment_channel": tx.payment_channel,
        "external_reference": tx.external_reference,
        "payment_description": tx.payment_description,
        "status": tx.status.value if tx.status else None,
        "failure_reason": tx.failure_reason,
        "initiated_at": _iso_utc(tx.initiated_at),
        "confirmed_at": _iso_utc(tx.confirmed_at),
        "completed_at": _iso_utc(tx.completed_at),
    }


def _normalize_target_type(target_type_raw: str) -> PaymentTargetTypeEnum:
    normalized = TARGET_TYPE_ALIASES.get((target_type_raw or "").strip(), (target_type_raw or "").strip())
    try:
        return PaymentTargetTypeEnum(normalized)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid target_type.")


def _payer_label(user: Optional[User]) -> str:
    if not user:
        return "a Nuru user"
    name = " ".join(filter(None, [getattr(user, "first_name", None), getattr(user, "last_name", None)])).strip()
    return name or getattr(user, "phone", None) or getattr(user, "email", None) or "a Nuru user"


def _format_purpose(target_type: PaymentTargetTypeEnum) -> str:
    return {
        PaymentTargetTypeEnum.ticket: "Ticket Purchase",
        PaymentTargetTypeEnum.contribution: "Event Contribution",
        PaymentTargetTypeEnum.booking: "Service Booking",
        PaymentTargetTypeEnum.wallet_topup: "Wallet Top-up",
        PaymentTargetTypeEnum.withdrawal: "Wallet Withdrawal",
        PaymentTargetTypeEnum.settlement: "Settlement",
    }.get(target_type, "Payment")


def _enrich_payment_description(
    *,
    target_type: PaymentTargetTypeEnum,
    user_supplied: str,
    payer: Optional[User],
    transaction_code: Optional[str] = None,
) -> str:
    """Always store a Nuru-branded, audit-friendly description.

    Format: ``Nuru · {Purpose} · {Detail} · by {Payer}[ · ref {code}]``
    Keeps any meaningful detail the caller already typed in.
    """
    purpose = _format_purpose(target_type)
    detail = (user_supplied or "").strip()
    parts = ["Nuru", purpose]
    if detail:
        parts.append(detail)
    parts.append(f"by {_payer_label(payer)}")
    if transaction_code:
        parts.append(f"ref {transaction_code}")
    return " · ".join(parts)


def _ledger_text(prefix: str, tx: Transaction, payer: Optional[User]) -> str:
    """Wallet ledger row text — explicit and Nuru-branded."""
    purpose = _format_purpose(tx.target_type)
    return (
        f"Nuru · {prefix} · {purpose} · by {_payer_label(payer)} · "
        f"ref {tx.transaction_code}"
    )


def _sync_target_after_payment(db: Session, tx: Transaction):
    """Propagate a successful payment to the underlying resource.

    Handles:
      • ticket      → mark EventTicket as paid
      • contribution → record a confirmed EventContribution so the contributor's
        "My contributions" totals update automatically (idempotent).
    """
    if not tx.target_id:
        return

    # ── Tickets ────────────────────────────────────────────────────────────
    if tx.target_type == PaymentTargetTypeEnum.ticket:
        ticket = db.query(EventTicket).filter(EventTicket.id == tx.target_id).first()
        if not ticket:
            return
        ticket.payment_status = PaymentStatusEnum.completed
        ticket.payment_ref = tx.transaction_code
        return

    # ── Event contributions ────────────────────────────────────────────────
    if tx.target_type == PaymentTargetTypeEnum.contribution:
        from models.contributions import (
            UserContributor, EventContributor, EventContribution,
        )
        from models.enums import ContributionStatusEnum, PaymentMethodEnum
        from sqlalchemy import func as _sa_func

        event_id = tx.target_id
        payer_id = tx.payer_user_id
        if not payer_id:
            return

        # Idempotency: skip if we've already recorded this transaction.
        existing = db.query(EventContribution).filter(
            EventContribution.event_id == event_id,
            EventContribution.transaction_ref == tx.transaction_code,
        ).first()
        if existing:
            if existing.confirmation_status != ContributionStatusEnum.confirmed:
                existing.confirmation_status = ContributionStatusEnum.confirmed
                existing.confirmed_at = existing.confirmed_at or datetime.utcnow()
            return

        payer = db.query(User).filter(User.id == payer_id).first()
        if not payer:
            return

        # Find (or create) the EventContributor row for this payer on the event.
        # Match via contributor_user_id first, then phone equivalence.
        ec = (
            db.query(EventContributor)
            .join(UserContributor, UserContributor.id == EventContributor.contributor_id)
            .filter(
                EventContributor.event_id == event_id,
                UserContributor.contributor_user_id == payer_id,
            )
            .first()
        )

        if not ec and getattr(payer, "phone", None):
            phone_digits = "".join(ch for ch in str(payer.phone) if ch.isdigit())[-9:]
            if phone_digits:
                ec = (
                    db.query(EventContributor)
                    .join(UserContributor, UserContributor.id == EventContributor.contributor_id)
                    .filter(
                        EventContributor.event_id == event_id,
                        _sa_func.right(
                            _sa_func.regexp_replace(UserContributor.phone, r'[^0-9]', '', 'g'),
                            9,
                        ) == phone_digits,
                    )
                    .first()
                )

        # If the payer isn't listed as a contributor yet, create a self-contributor
        # + EventContributor pair so the payment is still recorded against the event.
        if not ec:
            from models.events import Event
            event = db.query(Event).filter(Event.id == event_id).first()
            if not event:
                return
            display_name = (
                f"{(payer.first_name or '').strip()} {(payer.last_name or '').strip()}".strip()
                or payer.phone
                or "Contributor"
            )
            # Reuse an existing UserContributor row owned by the organiser if one
            # already maps to this payer, otherwise create one.
            uc = db.query(UserContributor).filter(
                UserContributor.user_id == event.organizer_id,
                UserContributor.contributor_user_id == payer_id,
            ).first()
            if not uc:
                uc = UserContributor(
                    user_id=event.organizer_id,
                    contributor_user_id=payer_id,
                    name=display_name,
                    email=getattr(payer, "email", None),
                    phone=getattr(payer, "phone", None),
                )
                db.add(uc)
                db.flush()
            ec = EventContributor(
                event_id=event_id,
                contributor_id=uc.id,
                pledge_amount=0,
            )
            db.add(ec)
            db.flush()

        contact = {}
        if getattr(payer, "phone", None):
            contact["phone"] = payer.phone
        if getattr(payer, "email", None):
            contact["email"] = payer.email

        contributor_name = (
            ec.contributor.name if ec.contributor and ec.contributor.name
            else f"{(payer.first_name or '').strip()} {(payer.last_name or '').strip()}".strip()
            or "Contributor"
        )

        # Map payment method loosely — mobile money is the dominant rail.
        pm = None
        try:
            mt = (tx.method_type or "").lower()
            if "cash" in mt:
                pm = PaymentMethodEnum.cash
            else:
                pm = PaymentMethodEnum.mobile
        except Exception:
            pm = None

        now = datetime.utcnow()
        contribution = EventContribution(
            event_id=event_id,
            event_contributor_id=ec.id,
            contributor_name=contributor_name,
            contributor_contact=contact or None,
            amount=tx.net_amount or tx.gross_amount,
            payment_method=pm,
            transaction_ref=tx.transaction_code,
            recorded_by=payer_id,
            confirmation_status=ContributionStatusEnum.confirmed,
            confirmed_at=now,
            contributed_at=now,
        )
        db.add(contribution)
        db.flush()
        return


def _notify_payment_received(db: Session, tx: Transaction) -> None:
    """Fan-out SMS notifications for a successfully credited payment.

    Sends to:
      • the payer        — confirmation of their payment
      • the beneficiary  — funds-received notice (organizer / vendor / self)
      • the admin line   — ops heads-up so they can reconcile externally

    All sends are best-effort and silently log failures — they must never
    break the payment commit path.
    """
    try:
        from utils.sms import (
            sms_payment_received, sms_payment_confirmed_to_payer,
            sms_organizer_contribution_received, sms_vendor_booking_paid,
            sms_admin_payment_alert, get_admin_notify_phone,
        )
    except Exception as e:
        print(f"[payments] sms imports failed: {e}")
        return

    payer = (
        db.query(User).filter(User.id == tx.payer_user_id).first()
        if tx.payer_user_id else None
    )
    payer_name = _payer_label(payer)
    payer_phone = getattr(payer, "phone", None) if payer else None
    purpose = _format_purpose(tx.target_type)
    amount = float(tx.net_amount or tx.gross_amount or 0)
    currency = tx.currency_code or "TZS"
    method = (tx.provider_name or tx.method_type or "").strip() or None
    code = tx.transaction_code

    # ── 1. Confirm to the payer (skip for top-ups: same person as recipient)
    if payer_phone and tx.target_type != PaymentTargetTypeEnum.wallet_topup:
        try:
            sms_payment_confirmed_to_payer(
                phone=payer_phone, payer_name=payer_name,
                purpose=purpose, amount=float(tx.gross_amount or 0),
                currency=currency, transaction_code=code,
            )
        except Exception as e:
            print(f"[payments] sms_payment_confirmed_to_payer failed: {e}")

    # ── 2. Notify the recipient (specialised per target type)
    target_label = None
    try:
        if tx.target_type == PaymentTargetTypeEnum.wallet_topup:
            if payer and getattr(payer, "phone", None):
                sms_payment_received(
                    phone=payer.phone, payer_name=payer_name, purpose=purpose,
                    amount=amount, currency=currency, transaction_code=code,
                    payee_label="your Nuru wallet",
                )
            target_label = "wallet top-up"

        elif tx.target_type == PaymentTargetTypeEnum.contribution and tx.target_id:
            from models.events import Event
            event = db.query(Event).filter(Event.id == tx.target_id).first()
            organizer = (
                db.query(User).filter(User.id == event.organizer_id).first()
                if event and event.organizer_id else None
            )
            target_label = event.name if event else "event contribution"
            if organizer and getattr(organizer, "phone", None):
                sms_organizer_contribution_received(
                    phone=organizer.phone,
                    organizer_name=_payer_label(organizer),
                    contributor_name=payer_name,
                    event_title=event.name if event else "your event",
                    amount=amount, currency=currency, transaction_code=code,
                )

        elif tx.target_type == PaymentTargetTypeEnum.booking and tx.target_id:
            from models.bookings import ServiceBookingRequest
            from models import UserService
            booking = db.query(ServiceBookingRequest).filter(
                ServiceBookingRequest.id == tx.target_id
            ).first()
            service = (
                db.query(UserService).filter(UserService.id == booking.user_service_id).first()
                if booking and booking.user_service_id else None
            )
            vendor = (
                db.query(User).filter(User.id == service.user_id).first()
                if service and service.user_id else None
            )
            target_label = service.title if service else "service booking"
            if vendor and getattr(vendor, "phone", None):
                sms_vendor_booking_paid(
                    phone=vendor.phone,
                    vendor_name=_payer_label(vendor),
                    client_name=payer_name,
                    service_title=service.title if service else "your service",
                    amount=amount, currency=currency, transaction_code=code,
                )

        elif tx.beneficiary_user_id:
            recipient = db.query(User).filter(User.id == tx.beneficiary_user_id).first()
            if recipient and getattr(recipient, "phone", None):
                sms_payment_received(
                    phone=recipient.phone, payer_name=payer_name, purpose=purpose,
                    amount=amount, currency=currency, transaction_code=code,
                    payee_label="your Nuru account",
                )
    except Exception as e:
        print(f"[payments] beneficiary notify failed: {e}")

    # ── 3. Admin heads-up — always
    try:
        admin_phone = get_admin_notify_phone(db)
        sms_admin_payment_alert(
            phone=admin_phone, payer_name=payer_name, payer_phone=payer_phone,
            purpose=purpose, amount=float(tx.gross_amount or 0), currency=currency,
            transaction_code=code, method=method, target_label=target_label,
        )
    except Exception as e:
        print(f"[payments] sms_admin_payment_alert failed: {e}")


# ──────────────────────────────────────────────
# Providers (dynamic, admin-managed)
# ──────────────────────────────────────────────

@router.get("/providers")
def list_providers(
    country_code: str = Query(..., min_length=2, max_length=2),
    purpose: str = Query("collection", regex="^(collection|payout)$"),
    db: Session = Depends(get_db),
):
    q = db.query(PaymentProvider).filter(
        PaymentProvider.country_code == country_code.upper(),
        PaymentProvider.is_active == True,  # noqa: E712
    )
    if purpose == "collection":
        q = q.filter(PaymentProvider.is_collection_enabled == True)  # noqa: E712
    else:
        q = q.filter(PaymentProvider.is_payout_enabled == True)  # noqa: E712
    rows = q.order_by(PaymentProvider.display_order, PaymentProvider.name).all()
    return api_response(True, "Providers retrieved.", [
        {
            "id": str(r.id),
            "country_code": r.country_code,
            "currency_code": r.currency_code,
            "provider_type": r.provider_type.value if r.provider_type else None,
            "name": r.name,
            "code": r.code,
            "logo_url": r.logo_url,
            "display_order": r.display_order,
        }
        for r in rows
    ])


# ──────────────────────────────────────────────
# Public fee preview
# ──────────────────────────────────────────────

@router.get("/fee-preview")
def fee_preview(
    country_code: str = Query(..., min_length=2, max_length=2),
    currency_code: str = Query(..., min_length=3, max_length=3),
    target_type: str = Query(...),
    gross_amount: float = Query(..., gt=0),
    db: Session = Depends(get_db),
):
    """Preview fees so the checkout UI can show 'You pay = amount + fee'.

    Top-ups never carry a commission; everything else adds the active
    `CommissionSetting` flat fee on top of the requested amount.
    """
    from services.commission_service import resolve_commission_snapshot, commission_amount_from_snapshot
    target_enum = _normalize_target_type(target_type)
    snap = resolve_commission_snapshot(db, country_code.upper(), currency_code.upper())
    fee = float(commission_amount_from_snapshot(snap))
    if target_enum == PaymentTargetTypeEnum.wallet_topup:
        fee = 0.0
    total = float(gross_amount) + fee
    return api_response(True, "Fee preview.", {
        "requested_amount": float(gross_amount),
        "commission_amount": fee,
        "total_charged": total,
        "currency_code": currency_code.upper(),
        "country_code": country_code.upper(),
        "target_type": target_enum.value,
    })


# ──────────────────────────────────────────────
# Initiate payment
# ──────────────────────────────────────────────

@router.post("/initiate", status_code=201)
async def initiate_payment(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body.")

    # ─── Required fields
    target_type_raw = (payload.get("target_type") or "").strip()
    target_type = _normalize_target_type(target_type_raw)

    try:
        gross_amount = Decimal(str(payload.get("gross_amount") or "0"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid gross_amount.")
    if gross_amount <= 0:
        raise HTTPException(status_code=400, detail="gross_amount must be > 0.")

    country_code = (payload.get("country_code") or "").upper().strip()
    currency_code = (payload.get("currency_code") or "").upper().strip()
    if not country_code or not currency_code:
        raise HTTPException(status_code=400, detail="country_code and currency_code are required.")

    method_type = (payload.get("method_type") or "").strip()
    if method_type not in ("mobile_money", "bank", "wallet"):
        raise HTTPException(status_code=400, detail="method_type must be mobile_money|bank|wallet.")

    payment_description = (payload.get("payment_description") or "").strip()
    if len(payment_description) < 8:
        raise HTTPException(
            status_code=400,
            detail="payment_description must be highly descriptive (min 8 chars).",
        )

    payment_channel = (payload.get("payment_channel") or "stk_push").strip()
    target_id = payload.get("target_id")
    try:
        target_id_uuid = uuid_lib.UUID(str(target_id)) if target_id else None
    except Exception:
        target_id_uuid = None

    beneficiary_user_id = payload.get("beneficiary_user_id")
    try:
        beneficiary_uuid = uuid_lib.UUID(str(beneficiary_user_id)) if beneficiary_user_id else None
    except Exception:
        beneficiary_uuid = None

    # ─── Auto-resolve / verify the beneficiary for targets where it's
    # deterministically derivable from `target_id`. This is defence-in-depth:
    # the client should send `beneficiary_user_id`, but if it forgets (or
    # sends the wrong user), the wallet credit at confirmation time would
    # silently no-op or land in the wrong wallet. We resolve from the DB and
    # OVERRIDE any client-supplied value that disagrees, logging a warning.
    resolved_beneficiary: Optional[uuid_lib.UUID] = None
    try:
        if target_type == PaymentTargetTypeEnum.booking and target_id_uuid:
            from models.bookings import ServiceBookingRequest
            from models import UserService
            booking = db.query(ServiceBookingRequest).filter(
                ServiceBookingRequest.id == target_id_uuid
            ).first()
            if booking and booking.user_service_id:
                svc = db.query(UserService).filter(
                    UserService.id == booking.user_service_id
                ).first()
                if svc and svc.user_id:
                    resolved_beneficiary = svc.user_id
        elif target_type == PaymentTargetTypeEnum.contribution and target_id_uuid:
            from models.events import Event
            ev = db.query(Event).filter(Event.id == target_id_uuid).first()
            if ev and ev.organizer_id:
                resolved_beneficiary = ev.organizer_id
    except Exception as e:
        print(f"[payments] beneficiary auto-resolve failed: {e}")

    if resolved_beneficiary:
        if beneficiary_uuid and beneficiary_uuid != resolved_beneficiary:
            print(
                f"[payments] client-supplied beneficiary_user_id "
                f"{beneficiary_uuid} disagrees with target-derived "
                f"{resolved_beneficiary}; using derived value."
            )
        beneficiary_uuid = resolved_beneficiary

    # Sanity: block self-pay only for bookings (paying yourself for your own
    # service makes no sense). Contributions are explicitly allowed — an
    # organizer is welcome to seed their own event, and the resulting wallet
    # credit (net of commission) is the expected behaviour.
    if (
        beneficiary_uuid
        and beneficiary_uuid == current_user.id
        and target_type == PaymentTargetTypeEnum.booking
    ):
        raise HTTPException(
            status_code=400,
            detail="You cannot pay yourself for this booking.",
        )

    # ─── Provider snapshot (optional but recommended)
    provider_id = payload.get("provider_id")
    provider = None
    if provider_id:
        try:
            provider = db.query(PaymentProvider).filter(
                PaymentProvider.id == uuid_lib.UUID(str(provider_id)),
                PaymentProvider.is_active == True,  # noqa: E712
            ).first()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid provider_id.")
        if not provider or not provider.is_collection_enabled:
            raise HTTPException(status_code=400, detail="Provider not available for collection.")

    # ─── Build the transaction (with enriched, Nuru-branded description)
    enriched_description = _enrich_payment_description(
        target_type=target_type,
        user_supplied=payment_description,
        payer=current_user,
    )
    tx = create_transaction(
        db,
        payer_user_id=current_user.id,
        beneficiary_user_id=beneficiary_uuid,
        target_type=target_type,
        target_id=target_id_uuid,
        country_code=country_code,
        currency_code=currency_code,
        gross_amount=gross_amount,
        method_type=method_type,
        payment_description=enriched_description,
        provider_id=provider.id if provider else None,
        provider_name=provider.name if provider else None,
        payment_channel=payment_channel,
    )

    # ─── Branch by channel
    if payment_channel == "wallet_balance":
        # Pay from wallet — debit available, credit beneficiary if any.
        # NOTE: use `tx.gross_amount`, NOT the local `gross_amount` variable.
        # `create_transaction` inflates `gross_amount` by the commission for
        # non-topup targets so the payer is charged base + commission. The
        # local var still holds the pre-commission value the client sent.
        from services.wallet_service import debit_available
        payer_wallet = get_or_create_wallet(db, current_user.id, currency_code)
        try:
            debit_available(
                db, payer_wallet, Decimal(str(tx.gross_amount)),
                description=_ledger_text("Paid", tx, current_user),
                transaction_id=tx.id,
            )
        except ValueError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))

        if beneficiary_uuid:
            ben_wallet = get_or_create_wallet(db, beneficiary_uuid, currency_code)
            credit_available(
                db, ben_wallet, tx.net_amount,
                description=_ledger_text("Received", tx, current_user),
                transaction_id=tx.id,
            )
            if tx.commission_amount and tx.commission_amount > 0:
                commission_charge(
                    db, ben_wallet, tx.commission_amount,
                    description=_ledger_text("Commission", tx, current_user),
                    transaction_id=tx.id,
                )

        now = datetime.utcnow()
        tx.status = TransactionStatusEnum.credited
        tx.confirmed_at = now
        tx.completed_at = now
        _sync_target_after_payment(db, tx)
        _notify_payment_received(db, tx)
        db.commit()
        db.refresh(tx)
        return api_response(True, "Wallet payment completed.", {
            "transaction": _serialize_tx(tx),
            "next_action": "completed",
        })

    if method_type == "mobile_money":
        phone = PaymentGateway.normalize_phone_number(
            (payload.get("phone_number") or "").strip(),
            country_code,
        )
        if not phone:
            db.rollback()
            raise HTTPException(status_code=400, detail="phone_number is required for mobile money.")
        network_key = PaymentGateway.identify_network(phone, country_code)
        if network_key == "UNKNOWN":
            db.rollback()
            raise HTTPException(status_code=400, detail="Unsupported phone number network.")

        # IMPORTANT: charge the payer the *post-commission* total. `tx.gross_amount`
        # has already been inflated by the commission (see create_transaction);
        # the local `gross_amount` variable still holds the pre-commission value
        # the client sent. Sending the local value would push only the base
        # amount via STK and Nuru would absorb the commission.
        charge_amount = Decimal(str(tx.gross_amount))

        attempt = MobilePaymentAttempt(
            transaction_id=tx.id,
            gateway="SASAPAY",
            provider_name=provider.name if provider else network_key,
            network_code=PaymentGateway.gateway_code_for(network_key),
            phone_number=phone,
            amount=charge_amount,
        )
        db.add(attempt)
        db.flush()

        try:
            resp = await gateway.request_payment(
                phone_number=phone,
                amount=float(charge_amount),
                description=payment_description,
                merchant_request_id=str(attempt.id),
                country_code=country_code,
                currency=currency_code,
            )
        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=502, detail=f"Payment gateway error: {e}")

        attempt.merchant_request_id = resp.get("MerchantRequestID", "")
        attempt.checkout_request_id = resp.get("CheckoutRequestID", "")
        attempt.transaction_reference = resp.get("TransactionReference", "")
        attempt.response_payload = resp

        tx.status = TransactionStatusEnum.processing
        tx.external_reference = attempt.checkout_request_id or attempt.merchant_request_id
        tx.api_request_payload_snapshot = resp.get("_request_payload")
        tx.api_response_payload_snapshot = {k: v for k, v in resp.items() if k != "_request_payload"}
        db.commit()
        db.refresh(tx)

        return api_response(True, "Payment request sent. Confirm on your phone.", {
            "transaction": _serialize_tx(tx),
            "checkout_request_id": attempt.checkout_request_id,
            "next_action": "poll_status",
        })

    # bank — manual settlement for now
    db.commit()
    db.refresh(tx)
    return api_response(True, "Bank transfer recorded. Awaiting confirmation.", {
        "transaction": _serialize_tx(tx),
        "next_action": "manual_confirm",
    })


# ──────────────────────────────────────────────
# Status polling
# ──────────────────────────────────────────────

async def _try_credit_beneficiary(db: Session, tx: Transaction):
    """Idempotent wallet credit.

    BUSINESS RULE: Wallet balances are reserved for explicit top-ups.
    Contributions, ticket purchases, service bookings, and other transfers
    flow through Nuru collection accounts and are surfaced to the
    beneficiary in dedicated "Received Payments" views — they MUST NOT
    inflate `Wallet.available_balance`.

    Only `wallet_topup` transactions credit a wallet here.
    """
    if tx.status == TransactionStatusEnum.credited:
        return

    # Only top-ups touch the wallet.
    if tx.target_type != PaymentTargetTypeEnum.wallet_topup:
        return

    recipient_id = tx.payer_user_id  # top-up payer == beneficiary
    if not recipient_id:
        return

    payer = (
        db.query(User).filter(User.id == tx.payer_user_id).first()
        if tx.payer_user_id else None
    )
    ben_wallet = get_or_create_wallet(db, recipient_id, tx.currency_code)
    credit_available(
        db, ben_wallet, Decimal(str(tx.net_amount or 0)),
        description=_ledger_text("Top-up", tx, payer),
        transaction_id=tx.id,
    )
    if tx.commission_amount and Decimal(str(tx.commission_amount)) > 0:
        commission_charge(
            db, ben_wallet, Decimal(str(tx.commission_amount)),
            description=_ledger_text("Commission", tx, payer),
            transaction_id=tx.id,
        )


def _resolve_tx(db: Session, identifier: str) -> Optional[Transaction]:
    """Look up a transaction by UUID or by human-readable transaction_code."""
    try:
        tid = uuid_lib.UUID(identifier)
        tx = db.query(Transaction).filter(Transaction.id == tid).first()
        if tx:
            return tx
    except (ValueError, AttributeError):
        pass
    return (
        db.query(Transaction)
        .filter(Transaction.transaction_code == identifier)
        .first()
    )


@router.get("/{transaction_id}/status")
async def transaction_status(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = _resolve_tx(db, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    if tx.payer_user_id != current_user.id and tx.beneficiary_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden.")

    if tx.status in (TransactionStatusEnum.paid, TransactionStatusEnum.credited):
        _sync_target_after_payment(db, tx)
        db.commit()
        db.refresh(tx)
        return api_response(True, "Transaction status.", _serialize_tx(tx))

    # Poll the gateway for any non-terminal mobile-money txn. We also re-poll
    # `failed` txns: gateways occasionally flip late callbacks from FAILED →
    # PAID (user retried PIN), and admins/users explicitly clicking "Refresh"
    # expect us to reconcile with the source of truth.
    attempt = (
        db.query(MobilePaymentAttempt)
        .filter(MobilePaymentAttempt.transaction_id == tx.id)
        .order_by(MobilePaymentAttempt.created_at.desc())
        .first()
    )
    repollable = (
        TransactionStatusEnum.processing,
        TransactionStatusEnum.pending,
        TransactionStatusEnum.failed,
    )
    if attempt and attempt.checkout_request_id and tx.status in repollable:
        gw_status, gw_reason = await gateway.check_transaction_status_detail(
            attempt.checkout_request_id
        )
        now = datetime.utcnow()
        if gw_status == "PAID":
            attempt.status = "paid"
            tx.status = TransactionStatusEnum.paid
            tx.confirmed_at = now
            tx.failure_reason = None  # clear stale failure note on late success
            await _try_credit_beneficiary(db, tx)
            _sync_target_after_payment(db, tx)
            tx.status = TransactionStatusEnum.credited
            tx.completed_at = now
            _notify_payment_received(db, tx)
            db.commit()
            db.refresh(tx)
        elif gw_status == "FAILED":
            attempt.status = "failed"
            tx.status = TransactionStatusEnum.failed
            tx.failure_reason = (
                _clean_failure_reason(gw_reason)
                or _failure_reason_from_callbacks(db, tx, attempt)
                or "Gateway reported failure (no reason returned)."
            )
            db.commit()
            db.refresh(tx)
        else:
            # gw_status == PENDING — the status-query was an async ack OR the
            # gateway is still mid-flight. Even so, a real C2B callback may
            # already have landed on /payments/callback for this checkout.
            # Lift `ResultDesc` from the most recent non-success callback so
            # users clicking "Refresh" see why their payment failed instead
            # of "Your request has been received…".
            cb_reason = _failure_reason_from_callbacks(db, tx, attempt)
            if cb_reason:
                if tx.status != TransactionStatusEnum.failed:
                    tx.status = TransactionStatusEnum.failed
                    attempt.status = "failed"
                if cb_reason != tx.failure_reason:
                    tx.failure_reason = cb_reason
                db.commit()
                db.refresh(tx)

    return api_response(True, "Transaction status.", _serialize_tx(tx))


# ──────────────────────────────────────────────
# Public receipt — no auth, safe subset only
# Used by the /shared/receipt/:code link recipients can open without an account.
# ──────────────────────────────────────────────

@router.get("/public/{transaction_code}")
def public_receipt(transaction_code: str, db: Session = Depends(get_db)):
    tx = (
        db.query(Transaction)
        .filter(Transaction.transaction_code == transaction_code)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Receipt not found.")
    # Only successful payments are shareable — pending/failed receipts leak
    # nothing meaningful and could be abused for phishing.
    if tx.status not in (TransactionStatusEnum.paid, TransactionStatusEnum.credited):
        raise HTTPException(status_code=404, detail="Receipt not available.")
    safe = _serialize_tx(tx)
    # Strip ops-only fields. Description already starts with "Nuru · …"
    safe.pop("failure_reason", None)
    return api_response(True, "Public receipt.", safe)



@router.get("/my-transactions")
def my_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    role: str = Query("all", regex="^(all|payer|beneficiary)$"),
    target_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Transaction)
    if role == "payer":
        q = q.filter(Transaction.payer_user_id == current_user.id)
    elif role == "beneficiary":
        q = q.filter(Transaction.beneficiary_user_id == current_user.id)
    else:
        q = q.filter(
            (Transaction.payer_user_id == current_user.id)
            | (Transaction.beneficiary_user_id == current_user.id)
        )

    if target_type:
        try:
            tt_enum = _normalize_target_type(target_type)
            q = q.filter(Transaction.target_type == tt_enum)
        except HTTPException:
            pass  # ignore invalid filter rather than 400 the wallet UI

    if status:
        try:
            q = q.filter(Transaction.status == TransactionStatusEnum(status))
        except ValueError:
            pass

    q = q.order_by(Transaction.created_at.desc())
    items, pagination = paginate(q, page=page, limit=limit)
    return api_response(True, "Transactions retrieved.", {
        "transactions": [_serialize_tx(t) for t in items],
        "pagination": pagination,
    })


# ──────────────────────────────────────────────
# ──────────────────────────────────────────────
# Webhook (no auth — idempotent)
#
# SasaPay sends TWO independent server-to-server notifications:
#   1. C2B Callback Results — POSTed to the per-request CallBackURL we send
#      with `request-payment`. Confirms the STK push outcome.
#   2. Instant Payment Notification (IPN) — POSTed to the merchant-wide IPN
#      URL configured on the SasaPay dashboard whenever a payment lands on
#      the merchant wallet. Used for till/paybill walk-ins and back-office
#      reconciliation. Field shape is different from the callback above.
#
# Both endpoints are idempotent: every payload is logged raw to
# PaymentCallbackLog, and a transaction can never be credited twice.
# ──────────────────────────────────────────────


def _resolve_attempt_from_payload(db: Session, payload: dict) -> Optional[MobilePaymentAttempt]:
    """Find the originating attempt for a webhook payload by trying every
    identifier SasaPay might echo back to us."""
    candidates_checkout = [
        payload.get("CheckoutRequestID"),
        payload.get("CheckoutRequestId"),
        payload.get("checkout_request_id"),
    ]
    for cid in candidates_checkout:
        if not cid:
            continue
        attempt = db.query(MobilePaymentAttempt).filter(
            MobilePaymentAttempt.checkout_request_id == cid
        ).first()
        if attempt:
            return attempt

    # Fall back to MerchantRequestID / our own AccountReference (== attempt.id)
    candidates_merchant = [
        payload.get("MerchantRequestID"),
        payload.get("MerchantRequestId"),
        payload.get("BillRefNumber"),
        payload.get("AccountReference"),
    ]
    for mid in candidates_merchant:
        if not mid:
            continue
        attempt = db.query(MobilePaymentAttempt).filter(
            MobilePaymentAttempt.merchant_request_id == str(mid)
        ).first()
        if attempt:
            return attempt
        # Our AccountReference is attempt.id — try that too.
        try:
            tid = uuid_lib.UUID(str(mid))
            attempt = db.query(MobilePaymentAttempt).filter(
                MobilePaymentAttempt.id == tid
            ).first()
            if attempt:
                return attempt
        except (ValueError, AttributeError):
            pass
    return None


async def _apply_successful_payment(db: Session, tx: Transaction, attempt: MobilePaymentAttempt,
                                     payload: dict) -> None:
    """Shared success path: idempotently credit + notify."""
    if tx.status in (TransactionStatusEnum.paid, TransactionStatusEnum.credited):
        return
    now = datetime.utcnow()
    attempt.status = "paid"
    # Persist gateway transaction codes for support/audit if SasaPay sent them.
    sasa_code = (
        payload.get("TransactionCode")
        or payload.get("TransID")
        or payload.get("ThirdPartyTransID")
    )
    if sasa_code and not attempt.transaction_reference:
        attempt.transaction_reference = str(sasa_code)
    if sasa_code:
        tx.external_reference = tx.external_reference or str(sasa_code)
    tx.status = TransactionStatusEnum.paid
    tx.confirmed_at = now
    tx.failure_reason = None
    tx.callback_payload_snapshot = payload
    await _try_credit_beneficiary(db, tx)
    _sync_target_after_payment(db, tx)
    tx.status = TransactionStatusEnum.credited
    tx.completed_at = now
    _notify_payment_received(db, tx)


@router.post("/callback")
async def payment_callback(request: Request, db: Session = Depends(get_db)):
    """SasaPay C2B Callback — invoked once per `request-payment` outcome.

    Spec sample::

        {
          "MerchantRequestID": "Test callbacks",
          "CheckoutRequestID": "542011ce-…-c4df09e18d74",
          "PaymentRequestID":  "PR6**3",
          "ResultCode": "0",
          "ResultDesc": "Transaction processed successfully.",
          "SourceChannel": "M-PESA",
          "TransAmount": "1.00",
          "BillRefNumber": "Test callbacks",
          "TransactionDate": "20240701105155",
          "CustomerMobile": "25470******0",
          "TransactionCode": "SPEJ***0O78GY2T",
          "ThirdPartyTransID": "SG1****1T5G"
        }

    The presence of ``Paid`` in our older payload shape is also tolerated
    so older SasaPay sandbox responses keep working.
    """
    try:
        payload = await request.json()
    except Exception:
        return {"status": "error", "message": "Invalid payload"}

    checkout_id = (
        payload.get("CheckoutRequestID")
        or payload.get("CheckoutRequestId")
        or payload.get("checkout_request_id")
        or ""
    )

    log = PaymentCallbackLog(
        gateway="SASAPAY_C2B",
        checkout_request_id=str(checkout_id) if checkout_id else None,
        payload=payload,
        headers={k: v for k, v in request.headers.items()},
        processed=False,
    )
    db.add(log)
    db.flush()

    attempt = _resolve_attempt_from_payload(db, payload)
    if not attempt:
        log.processing_error = "No matching attempt for callback payload."
        db.commit()
        # Always 200 OK — SasaPay retries on non-2xx and we have logged it.
        return {"status": "ok"}

    tx = db.query(Transaction).filter(Transaction.id == attempt.transaction_id).first()
    log.transaction_id = tx.id if tx else None

    result_code = str(payload.get("ResultCode", "")).strip()
    # `Paid` is older shape; current spec uses ResultCode == "0" alone.
    paid_raw = payload.get("Paid")
    paid_flag = paid_raw is True or str(paid_raw).strip().lower() == "true"
    success = result_code == "0" and (paid_flag or paid_raw is None)

    if tx and success:
        await _apply_successful_payment(db, tx, attempt, payload)
        log.processed = True
    elif tx and result_code and result_code != "0":
        attempt.status = "failed"
        tx.status = TransactionStatusEnum.failed
        tx.failure_reason = (
            _clean_failure_reason(payload.get("ResultDesc"))
            or _clean_failure_reason(payload.get("ResultDescription"))
            or f"Gateway error (code {result_code})."
        )
        tx.callback_payload_snapshot = payload
        log.processed = True

    db.commit()
    return {"status": "ok"}


@router.post("/ipn")
async def payment_ipn(request: Request, db: Session = Depends(get_db)):
    """SasaPay Instant Payment Notification — back-office reconciliation.

    Spec sample::

        {
          "MerchantCode": "6****8",
          "BusinessShortCode": "6****8",
          "InvoiceNumber": "INV-278-RID-6754",
          "PaymentMethod": "SasaPay",
          "TransID": "CDVISAIHD",
          "ThirdPartyTransID": "7***2",
          "FullName": "John kym Doe",
          "FirstName": "John", "MiddleName": "kym", "LastName": "Doe",
          "TransactionType": "C2B",
          "MSISDN": "2547*****5",
          "OrgAccountBalance": "10.00",
          "TransAmount": "10.00",
          "TransTime": "20240703062353",
          "BillRefNumber": "12345"
        }

    IPNs may arrive for payments that didn't originate from one of OUR
    request-payment calls (e.g. paybill walk-ins). When we can match
    `BillRefNumber` to a known transaction we credit it; otherwise we just
    log the payload so admins can reconcile manually.
    """
    try:
        payload = await request.json()
    except Exception:
        return {"status": "error", "message": "Invalid payload"}

    log = PaymentCallbackLog(
        gateway="SASAPAY_IPN",
        checkout_request_id=None,
        payload=payload,
        headers={k: v for k, v in request.headers.items()},
        processed=False,
    )
    db.add(log)
    db.flush()

    attempt = _resolve_attempt_from_payload(db, payload)
    if attempt:
        tx = db.query(Transaction).filter(Transaction.id == attempt.transaction_id).first()
        log.transaction_id = tx.id if tx else None
        if tx:
            await _apply_successful_payment(db, tx, attempt, payload)
            log.processed = True
    else:
        log.processing_error = "IPN with no matching attempt — manual reconcile."

    db.commit()
    return {"status": "ok"}


# ──────────────────────────────────────────────
# Admin / ops — inspect raw gateway callbacks
#
# Every inbound POST to /payments/callback and /payments/ipn is persisted
# to the `payment_callback_logs` table BEFORE we try to process it. These
# endpoints expose those rows so support can answer "did the gateway ever
# call us back?" and "what reason did the gateway give?".
# ──────────────────────────────────────────────

from api.routes.admin import require_admin  # noqa: E402  (avoid circular at import)
from models.admin import AdminUser  # noqa: E402


def _serialize_callback_log(log: PaymentCallbackLog) -> dict:
    return {
        "id": str(log.id),
        "gateway": log.gateway,
        "checkout_request_id": log.checkout_request_id,
        "transaction_id": str(log.transaction_id) if log.transaction_id else None,
        "processed": bool(log.processed),
        "processing_error": log.processing_error,
        "received_at": _iso_utc(getattr(log, "received_at", None)),
        "payload": log.payload,
        "headers": log.headers,
    }


@router.get("/admin/webhook-logs")
def admin_list_webhook_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    gateway_filter: Optional[str] = Query(None, alias="gateway"),
    processed: Optional[bool] = Query(None),
    checkout_request_id: Optional[str] = Query(None),
    transaction_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """List recent SasaPay callback / IPN payloads for ops debugging."""
    q = db.query(PaymentCallbackLog)
    if gateway_filter:
        q = q.filter(PaymentCallbackLog.gateway == gateway_filter)
    if processed is not None:
        q = q.filter(PaymentCallbackLog.processed == processed)
    if checkout_request_id:
        q = q.filter(PaymentCallbackLog.checkout_request_id == checkout_request_id)
    if transaction_id:
        try:
            q = q.filter(PaymentCallbackLog.transaction_id == uuid_lib.UUID(transaction_id))
        except Exception:
            pass

    total = q.count()
    rows = (
        q.order_by(PaymentCallbackLog.received_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return api_response(True, "Webhook logs.", {
        "items": [_serialize_callback_log(r) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
    })


@router.get("/admin/webhook-logs/by-transaction/{transaction_id}")
def admin_logs_for_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Return all callback rows tied to a given transaction (chronological).

    Includes rows matched via `transaction_id` AND rows whose
    `checkout_request_id` matches any attempt of this transaction — so even
    callbacks that arrived before we could link them appear here.
    """
    try:
        tx_uuid = uuid_lib.UUID(transaction_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid transaction id.")

    checkout_ids = [
        a.checkout_request_id for a in
        db.query(MobilePaymentAttempt)
        .filter(MobilePaymentAttempt.transaction_id == tx_uuid)
        .all()
        if a.checkout_request_id
    ]

    from sqlalchemy import or_  # local import keeps top of file clean
    conds = [PaymentCallbackLog.transaction_id == tx_uuid]
    if checkout_ids:
        conds.append(PaymentCallbackLog.checkout_request_id.in_(checkout_ids))

    rows = (
        db.query(PaymentCallbackLog)
        .filter(or_(*conds))
        .order_by(PaymentCallbackLog.received_at.asc())
        .all()
    )
    return api_response(True, "Callback logs for transaction.",
                        [_serialize_callback_log(r) for r in rows])


# ──────────────────────────────────────────────
# Pending-transaction background verifier
#
# A user-facing endpoint (`/payments/pending`) returns the caller's stale
# pending transactions so the browser/mobile client can poll status one by
# one. A separate worker endpoint (`/payments/verify-pending`) re-checks
# every stale transaction in the system — wired to a cron / Celery beat
# later but exposed now so the same reconciliation logic runs server-side.
#
# "Stale" = non-terminal status AND created more than VERIFY_AFTER_SECONDS
# ago. Terminal statuses (paid / credited / failed / cancelled) are
# excluded.
# ──────────────────────────────────────────────

VERIFY_AFTER_SECONDS = 30
VERIFY_MAX_AGE_HOURS = 24

_NON_TERMINAL = (
    TransactionStatusEnum.pending,
    TransactionStatusEnum.processing,
)


@router.get("/pending")
def my_pending_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pending transactions older than VERIFY_AFTER_SECONDS for the caller.

    The browser polls this every 15s; for each row returned it should call
    `/payments/{id}/status` which already drives gateway re-poll + credit.
    """
    from datetime import timedelta
    cutoff_old = datetime.utcnow() - timedelta(seconds=VERIFY_AFTER_SECONDS)
    cutoff_max = datetime.utcnow() - timedelta(hours=VERIFY_MAX_AGE_HOURS)
    rows = (
        db.query(Transaction)
        .filter(
            Transaction.payer_user_id == current_user.id,
            Transaction.status.in_(_NON_TERMINAL),
            Transaction.created_at <= cutoff_old,
            Transaction.created_at >= cutoff_max,
        )
        .order_by(Transaction.created_at.asc())
        .limit(20)
        .all()
    )
    return api_response(True, "Pending transactions.", {
        "transactions": [{
            "id": str(t.id),
            "transaction_code": t.transaction_code,
            "status": t.status.value if t.status else None,
            "target_type": t.target_type.value if t.target_type else None,
            "created_at": _iso_utc(t.created_at),
        } for t in rows],
    })


@router.post("/verify-pending")
async def verify_pending_transactions(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Worker entrypoint — re-poll every stale pending tx with the gateway.

    Public + unauthenticated for now (cron will be inside the VPS). Wrap
    with admin auth or shared-secret header when exposing externally.
    """
    from datetime import timedelta
    cutoff_old = datetime.utcnow() - timedelta(seconds=VERIFY_AFTER_SECONDS)
    cutoff_max = datetime.utcnow() - timedelta(hours=VERIFY_MAX_AGE_HOURS)

    txs = (
        db.query(Transaction)
        .filter(
            Transaction.status.in_(_NON_TERMINAL),
            Transaction.created_at <= cutoff_old,
            Transaction.created_at >= cutoff_max,
        )
        .order_by(Transaction.created_at.asc())
        .limit(limit)
        .all()
    )

    checked = 0
    promoted = 0
    failed = 0

    for tx in txs:
        attempt = (
            db.query(MobilePaymentAttempt)
            .filter(MobilePaymentAttempt.transaction_id == tx.id)
            .order_by(MobilePaymentAttempt.created_at.desc())
            .first()
        )
        if not attempt or not attempt.checkout_request_id:
            continue
        try:
            gw_status, gw_reason = await gateway.check_transaction_status_detail(
                attempt.checkout_request_id
            )
        except Exception as e:  # gateway hiccup — try again next tick
            print(f"[verify-pending] gateway error for {tx.transaction_code}: {e}")
            continue

        checked += 1
        now = datetime.utcnow()
        if gw_status == "PAID":
            attempt.status = "paid"
            tx.status = TransactionStatusEnum.paid
            tx.confirmed_at = now
            tx.failure_reason = None
            await _try_credit_beneficiary(db, tx)
            _sync_target_after_payment(db, tx)
            tx.status = TransactionStatusEnum.credited
            tx.completed_at = now
            try:
                _notify_payment_received(db, tx)
            except Exception as e:
                print(f"[verify-pending] notify failed for {tx.transaction_code}: {e}")
            promoted += 1
        elif gw_status == "FAILED":
            attempt.status = "failed"
            tx.status = TransactionStatusEnum.failed
            tx.failure_reason = (
                _clean_failure_reason(gw_reason)
                or _failure_reason_from_callbacks(db, tx, attempt)
                or "Gateway reported failure (no reason returned)."
            )
            failed += 1
        # else: still in flight — leave alone
        db.commit()

    return api_response(True, "Pending verification swept.", {
        "scanned": len(txs),
        "checked": checked,
        "promoted": promoted,
        "failed": failed,
    })
