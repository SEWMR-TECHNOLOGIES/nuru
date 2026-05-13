"""Offline vendor payments — manually-logged payments to event service vendors.

Flow:
  1. Organiser logs payment → 6-digit OTP SMS sent to vendor.
  2. Vendor confirms with OTP → expense recorded, event committee notified,
     vendor receives a confirmation SMS noting any remaining agreed balance.
  3. The amount is NOT credited to the vendor wallet (offline payment).
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.database import get_db
from models import (
    Event, EventService, EventExpense, EventCommitteeMember,
    CommitteePermission, User, UserService, Currency,
    OfflineVendorPayment,
)
from utils.auth import get_current_user
from utils.helpers import standard_response
from utils.sms import _send as sms_send
from utils.notify import create_notification


router = APIRouter(prefix="/user-events", tags=["Offline Vendor Payments"])

OTP_TTL_MINUTES = 10
MAX_OTP_ATTEMPTS = 5


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _hash_otp(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _currency_code(db: Session, currency_id) -> str:
    if not currency_id:
        return "TZS"
    cur = db.query(Currency).filter(Currency.id == currency_id).first()
    return (cur.code.strip() if cur and cur.code else "TZS")


def _format_amount(currency: str, amount) -> str:
    try:
        return f"{currency} {float(amount):,.0f}"
    except Exception:
        return f"{currency} {amount}"


def _is_organiser_or_committee(db: Session, event: Event, user: User) -> bool:
    if str(event.organizer_id) == str(user.id):
        return True
    cm = db.query(EventCommitteeMember).filter(
        EventCommitteeMember.event_id == event.id,
        EventCommitteeMember.user_id == user.id,
    ).first()
    if not cm:
        return False
    perm = db.query(CommitteePermission).filter(
        CommitteePermission.committee_member_id == cm.id
    ).first()
    return bool(perm and (perm.can_manage_expenses or perm.can_manage_budget))


def _vendor_display_name(db: Session, vendor_user_id, event_service_id) -> str:
    user = db.query(User).filter(User.id == vendor_user_id).first() if vendor_user_id else None
    if user:
        full = f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
        if full:
            return full
    es = db.query(EventService).filter(EventService.id == event_service_id).first()
    if es and es.provider_user_service_id:
        svc = db.query(UserService).filter(UserService.id == es.provider_user_service_id).first()
        if svc and svc.title:
            return svc.title
    return "Vendor"


def _service_title(db: Session, event_service: EventService) -> str:
    if event_service.provider_user_service_id:
        svc = db.query(UserService).filter(UserService.id == event_service.provider_user_service_id).first()
        if svc and svc.title:
            return svc.title
    return "Service"


def _serialize(db: Session, p: OfflineVendorPayment, *, include_vendor_view: bool = False) -> dict:
    es = db.query(EventService).filter(EventService.id == p.event_service_id).first()
    vendor_name = _vendor_display_name(db, p.vendor_user_id, p.event_service_id)
    service_title = _service_title(db, es) if es else "Service"
    recorder = db.query(User).filter(User.id == p.recorded_by).first() if p.recorded_by else None
    return {
        "id": str(p.id),
        "event_id": str(p.event_id),
        "event_service_id": str(p.event_service_id),
        "provider_user_service_id": str(es.provider_user_service_id) if es and es.provider_user_service_id else None,
        "vendor_user_id": str(p.vendor_user_id) if p.vendor_user_id else None,
        "vendor_name": vendor_name,
        "service_title": service_title,
        "recorded_by": str(p.recorded_by) if p.recorded_by else None,
        "recorded_by_name": (
            f"{(recorder.first_name or '').strip()} {(recorder.last_name or '').strip()}".strip()
            if recorder else None
        ),
        "amount": float(p.amount or 0),
        "currency": p.currency or "TZS",
        "method": p.method,
        "reference": p.reference,
        "note": p.note,
        "status": p.status,
        "otp_expires_at": p.otp_expires_at.isoformat() if p.otp_expires_at else None,
        "confirmed_at": p.confirmed_at.isoformat() if p.confirmed_at else None,
        "cancelled_at": p.cancelled_at.isoformat() if p.cancelled_at else None,
        "expense_id": str(p.expense_id) if p.expense_id else None,
        "agreed_price": float(es.agreed_price) if es and es.agreed_price else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


# ──────────────────────────────────────────────
# Log offline payment (organiser)
# ──────────────────────────────────────────────

class LogPaymentBody(BaseModel):
    amount: float = Field(..., gt=0)
    method: Optional[str] = None         # cash | bank | mobile_money | other
    reference: Optional[str] = None
    note: Optional[str] = None


@router.post("/{event_id}/services/{event_service_id}/offline-payments")
def log_offline_payment(
    event_id: str,
    event_service_id: str,
    body: LogPaymentBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
        esid = uuid.UUID(event_service_id)
    except ValueError:
        return standard_response(False, "Invalid identifier.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found.")

    if not _is_organiser_or_committee(db, event, current_user):
        return standard_response(False, "You do not have permission to log payments for this event.")

    es = db.query(EventService).filter(
        EventService.id == esid,
        EventService.event_id == eid,
    ).first()
    if not es:
        return standard_response(False, "Service assignment not found.")

    vendor_user = db.query(User).filter(User.id == es.provider_user_id).first() if es.provider_user_id else None
    if not vendor_user:
        return standard_response(False, "Vendor account is not linked to this assignment.")
    if not vendor_user.phone:
        return standard_response(False, "Vendor has no phone number on file.")

    code = _generate_otp()
    currency = _currency_code(db, event.currency_id)

    p = OfflineVendorPayment(
        id=uuid.uuid4(),
        event_id=eid,
        event_service_id=esid,
        vendor_user_id=vendor_user.id,
        recorded_by=current_user.id,
        amount=body.amount,
        currency=currency,
        method=(body.method or "").strip() or None,
        reference=(body.reference or "").strip() or None,
        note=(body.note or "").strip() or None,
        otp_code_hash=_hash_otp(code),
        otp_expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES),
        status="pending",
    )
    db.add(p)
    db.commit()
    db.refresh(p)

    # SMS the vendor — payment claim with confirmation code
    organiser_name = f"{(current_user.first_name or '').strip()} {(current_user.last_name or '').strip()}".strip() or "An organiser"
    amt_str = _format_amount(currency, body.amount)
    service_title = _service_title(db, es) if es else "your service"
    msg = (
        f"NURU PAYMENT\n"
        f"Hello {vendor_user.first_name or ''}, {organiser_name} has made a payment claim of "
        f"{amt_str} for your service \"{service_title}\" at {event.name}. "
        f"Use this code to confirm the payment: {code}. "
        f"Code expires in {OTP_TTL_MINUTES} minutes."
    )
    try:
        sms_send(vendor_user.phone, msg)
    except Exception as e:
        print(f"[offline_payments] SMS send failed: {e}")

    # In-app notification to vendor
    try:
        create_notification(
            db, vendor_user.id, current_user.id,
            "payment_received",
            f"reports paying you {amt_str} for {event.name}. Confirm in Nuru.",
            reference_id=eid,
            reference_type="event",
            message_data={
                "offline_payment_id": str(p.id),
                "amount": float(body.amount),
                "currency": currency,
            },
        )
        db.commit()
    except Exception as e:
        print(f"[offline_payments] notify vendor failed: {e}")

    return standard_response(True, "Payment logged. OTP sent to vendor.", _serialize(db, p))


# ──────────────────────────────────────────────
# Vendor: list everything across their bookings
# ──────────────────────────────────────────────

@router.get("/me/offline-payments")
def list_my_offline_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(OfflineVendorPayment).filter(
        OfflineVendorPayment.vendor_user_id == current_user.id,
    ).order_by(OfflineVendorPayment.created_at.desc()).all()
    return standard_response(True, "OK", {"items": [_serialize(db, r) for r in rows]})


# ──────────────────────────────────────────────
# List for an event (organiser/committee view)
# ──────────────────────────────────────────────

@router.get("/{event_id}/offline-payments")
def list_event_offline_payments(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event id.")
    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found.")

    is_priv = _is_organiser_or_committee(db, event, current_user)
    q = db.query(OfflineVendorPayment).filter(OfflineVendorPayment.event_id == eid)
    if not is_priv:
        # Vendor view: only their own rows
        q = q.filter(OfflineVendorPayment.vendor_user_id == current_user.id)
    rows = q.order_by(OfflineVendorPayment.created_at.desc()).all()
    return standard_response(True, "OK", {"items": [_serialize(db, r) for r in rows]})


# ──────────────────────────────────────────────
# Confirm OTP (vendor)
# ──────────────────────────────────────────────

class ConfirmBody(BaseModel):
    otp: str = Field(..., min_length=4, max_length=10)


@router.post("/offline-payments/{payment_id}/confirm")
def confirm_offline_payment(
    payment_id: str,
    body: ConfirmBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid.UUID(payment_id)
    except ValueError:
        return standard_response(False, "Invalid payment id.")

    p = db.query(OfflineVendorPayment).filter(OfflineVendorPayment.id == pid).first()
    if not p:
        return standard_response(False, "Payment not found.")
    if str(p.vendor_user_id) != str(current_user.id):
        return standard_response(False, "Only the vendor can confirm this payment.")
    if p.status != "pending":
        return standard_response(False, f"Payment is already {p.status}.")

    now = datetime.now(timezone.utc)
    expires = p.otp_expires_at
    # tolerate naive timestamps from older drivers
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires and now > expires:
        p.status = "expired"
        db.commit()
        return standard_response(False, "OTP expired. Ask the organiser to resend.")

    if p.otp_attempts >= MAX_OTP_ATTEMPTS:
        p.status = "expired"
        db.commit()
        return standard_response(False, "Too many attempts. Ask the organiser to resend.")

    if _hash_otp(body.otp.strip()) != p.otp_code_hash:
        p.otp_attempts = (p.otp_attempts or 0) + 1
        db.commit()
        return standard_response(False, "Incorrect code.")

    # Mark confirmed
    p.status = "confirmed"
    p.confirmed_at = now

    event = db.query(Event).filter(Event.id == p.event_id).first()
    es = db.query(EventService).filter(EventService.id == p.event_service_id).first()
    vendor_name = _vendor_display_name(db, p.vendor_user_id, p.event_service_id)
    service_title = _service_title(db, es) if es else "Service"

    # Create the expense record
    expense = EventExpense(
        id=uuid.uuid4(),
        event_id=p.event_id,
        recorded_by=p.recorded_by,
        category="Vendor Payment",
        description=f"Paid {vendor_name} for {service_title}",
        amount=p.amount,
        payment_method=p.method or "offline",
        payment_reference=p.reference,
        vendor_name=vendor_name,
        vendor_id=es.provider_user_service_id if es else None,
        notes=f"Offline payment confirmed by vendor (OTP). {p.note or ''}".strip(),
    )
    db.add(expense)
    db.flush()
    p.expense_id = expense.id
    db.commit()

    # Compute remaining balance vs agreed
    remaining_msg = ""
    remaining_amount_str = ""
    try:
        if es and es.agreed_price:
            paid = (
                db.query(OfflineVendorPayment)
                .filter(
                    OfflineVendorPayment.event_service_id == es.id,
                    OfflineVendorPayment.status == "confirmed",
                )
                .all()
            )
            paid_total = sum(float(x.amount or 0) for x in paid)
            agreed = float(es.agreed_price)
            remaining = max(agreed - paid_total, 0.0)
            remaining_amount_str = _format_amount(p.currency, remaining)
            if remaining <= 0:
                remaining_msg = " You have now been paid in full."
            else:
                remaining_msg = f" Remaining amount is {remaining_amount_str}."
    except Exception:
        pass

    # Resolve organiser display name for messages
    organiser_name = "the organiser"
    try:
        if event and event.organizer_id:
            org_user = db.query(User).filter(User.id == event.organizer_id).first()
            if org_user:
                organiser_name = (
                    f"{org_user.first_name or ''} {org_user.last_name or ''}".strip()
                    or organiser_name
                )
    except Exception:
        pass

    event_name = event.name if event else "the event"
    amt_str = _format_amount(p.currency, p.amount)

    # SMS the vendor confirming receipt
    try:
        if current_user.phone:
            vendor_first = current_user.first_name or vendor_name
            sms_send(
                current_user.phone,
                (
                    f"NURU PAYMENT\n"
                    f"Hello {vendor_first}, you have received a payment of "
                    f"{amt_str} from {organiser_name} for {event_name}."
                    f"{remaining_msg}"
                ),
            )
    except Exception as e:
        print(f"[offline_payments] confirm SMS failed: {e}")

    # Notify event committee + organiser (in-app + SMS + WhatsApp), mirroring expense flow
    try:
        from utils.whatsapp import _send_whatsapp  # local import to avoid cycles
    except Exception:
        _send_whatsapp = None  # type: ignore

    ev_msg = f"{vendor_name} confirmed receipt of {amt_str} for {event_name}."

    def _send_payment_sms_wa(user_id):
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user or not user.phone:
                print(f"[offline_payments] no phone for user {user_id}, skipping SMS")
                return
            sms_msg = (
                f"NURU PAYMENT\n"
                f"Hello {user.first_name or ''}, {vendor_name} has confirmed receipt of "
                f"{amt_str} from {organiser_name} for {event_name}."
                f"{remaining_msg} Open Nuru for full details."
            )
            try:
                sms_send(user.phone, sms_msg)
            except Exception as se:
                print(f"[offline_payments] notify SMS failed for {user_id}: {se}")
            if _send_whatsapp is not None:
                try:
                    _send_whatsapp("expense_recorded", user.phone, {
                        "recipient_name": user.first_name or "",
                        "recorder_name": vendor_name,
                        "amount": amt_str,
                        "category": "Vendor Payment",
                        "event_name": event_name,
                    })
                except Exception as we:
                    print(f"[offline_payments] notify WA failed for {user_id}: {we}")
        except Exception as e:
            print(f"[offline_payments] _send_payment_sms_wa unexpected error: {e}")

    def _safe_notify(user_id):
        try:
            create_notification(
                db, user_id, current_user.id,
                "expense_recorded", ev_msg,
                reference_id=p.event_id, reference_type="event",
                message_data={
                    "offline_payment_id": str(p.id),
                    "expense_id": str(expense.id),
                    "amount": float(p.amount),
                    "currency": p.currency,
                },
            )
        except Exception as ne:
            print(f"[offline_payments] create_notification failed for {user_id}: {ne}")
            try:
                db.rollback()
            except Exception:
                pass

    recipients: set = set()

    # Organiser — always notified in-app (audit trail). SMS skipped only if
    # the organiser is the same person who just confirmed (e.g. organiser is
    # also the vendor on their own event), to avoid SMS-ing themselves.
    if event and event.organizer_id:
        recipients.add(str(event.organizer_id))
        _safe_notify(event.organizer_id)
        if str(event.organizer_id) != str(current_user.id):
            _send_payment_sms_wa(event.organizer_id)

    # Committee members — notify ALL committee members so the whole team has visibility
    try:
        members = db.query(EventCommitteeMember).filter(
            EventCommitteeMember.event_id == p.event_id
        ).all()
    except Exception as e:
        print(f"[offline_payments] committee fetch failed: {e}")
        members = []

    for m in members:
        try:
            if not m.user_id or str(m.user_id) == str(current_user.id):
                continue
            if str(m.user_id) in recipients:
                continue
            perm = db.query(CommitteePermission).filter(
                CommitteePermission.committee_member_id == m.id
            ).first()
            if not (perm and (perm.can_manage_expenses or perm.can_view_expenses)):
                continue
            recipients.add(str(m.user_id))
            _safe_notify(m.user_id)
            _send_payment_sms_wa(m.user_id)
        except Exception as e:
            print(f"[offline_payments] committee loop error: {e}")
            continue

    try:
        db.commit()
    except Exception as e:
        print(f"[offline_payments] final commit failed: {e}")
        try:
            db.rollback()
        except Exception:
            pass

    return standard_response(True, "Payment confirmed.", _serialize(db, p))


# ──────────────────────────────────────────────
# Resend OTP
# ──────────────────────────────────────────────

@router.post("/offline-payments/{payment_id}/resend-otp")
def resend_offline_payment_otp(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid.UUID(payment_id)
    except ValueError:
        return standard_response(False, "Invalid payment id.")
    p = db.query(OfflineVendorPayment).filter(OfflineVendorPayment.id == pid).first()
    if not p:
        return standard_response(False, "Payment not found.")
    event = db.query(Event).filter(Event.id == p.event_id).first()
    if not event:
        return standard_response(False, "Event not found.")
    if not _is_organiser_or_committee(db, event, current_user):
        return standard_response(False, "Not allowed.")
    if p.status != "pending":
        return standard_response(False, f"Cannot resend — payment is {p.status}.")

    code = _generate_otp()
    p.otp_code_hash = _hash_otp(code)
    p.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES)
    p.otp_attempts = 0
    db.commit()

    vendor = db.query(User).filter(User.id == p.vendor_user_id).first()
    es = db.query(EventService).filter(EventService.id == p.event_service_id).first()
    service_title = _service_title(db, es) if es else "your service"
    organiser_name = f"{(current_user.first_name or '').strip()} {(current_user.last_name or '').strip()}".strip() or "An organiser"
    amt_str = _format_amount(p.currency, p.amount)
    if vendor and vendor.phone:
        try:
            sms_send(
                vendor.phone,
                (
                    f"NURU PAYMENT\n"
                    f"Hello {vendor.first_name or ''}, {organiser_name} has made a payment claim of "
                    f"{amt_str} for your service \"{service_title}\" at {event.name}. "
                    f"Use this code to confirm the payment: {code}. "
                    f"Code expires in {OTP_TTL_MINUTES} minutes."
                ),
            )
        except Exception as e:
            print(f"[offline_payments] resend SMS failed: {e}")

    return standard_response(True, "OTP resent.", _serialize(db, p))


# ──────────────────────────────────────────────
# Cancel pending
# ──────────────────────────────────────────────

@router.post("/offline-payments/{payment_id}/cancel")
def cancel_offline_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid.UUID(payment_id)
    except ValueError:
        return standard_response(False, "Invalid payment id.")
    p = db.query(OfflineVendorPayment).filter(OfflineVendorPayment.id == pid).first()
    if not p:
        return standard_response(False, "Payment not found.")
    event = db.query(Event).filter(Event.id == p.event_id).first()
    if not event or not _is_organiser_or_committee(db, event, current_user):
        return standard_response(False, "Not allowed.")
    if p.status != "pending":
        return standard_response(False, f"Cannot cancel — payment is {p.status}.")
    p.status = "cancelled"
    p.cancelled_at = datetime.now(timezone.utc)
    db.commit()
    return standard_response(True, "Cancelled.", _serialize(db, p))
