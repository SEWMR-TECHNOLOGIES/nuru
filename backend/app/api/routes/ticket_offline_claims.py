"""Ticket offline-claim routes — buyers declare 'I already paid via another
method' for a ticket purchase. Sellers (event organisers) review the claim
in a queue and either confirm (mints real EventTicket rows) or reject.

Mirrors the contribution offline-claim flow but lives under /ticketing/.
"""
import secrets
import uuid
from datetime import datetime
from typing import Optional, List

import pytz
from fastapi import APIRouter, Depends, Body, File, Form, UploadFile, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from core.database import get_db
from models import (
    User, Event, EventTicketClass, EventTicket,
    TicketOrderStatusEnum, PaymentStatusEnum, PaymentMethodEnum,
    TicketApprovalStatusEnum,
)
from models.ticket_offline_claims import TicketOfflineClaim
from utils.auth import get_current_user
from utils.helpers import standard_response


EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/ticketing", tags=["Ticketing — Offline Claims"])


def _claim_dict(claim: TicketOfflineClaim, *, include_audit: bool = True) -> dict:
    """Serialise a claim. Audit fields hidden when caller lacks audit access."""
    d = {
        "id": str(claim.id),
        "event_id": str(claim.event_id),
        "ticket_class_id": str(claim.ticket_class_id),
        "claimant_name": claim.claimant_name,
        "claimant_phone": claim.claimant_phone,
        "claimant_email": claim.claimant_email,
        "quantity": claim.quantity,
        "amount": float(claim.amount or 0),
        "transaction_code": claim.transaction_code,
        "status": claim.status,
        "created_at": claim.created_at.isoformat() if claim.created_at else None,
        "reviewed_at": claim.reviewed_at.isoformat() if claim.reviewed_at else None,
    }
    if include_audit:
        d.update({
            "payment_channel": claim.payment_channel,
            "provider_name": claim.provider_name,
            "provider_id": str(claim.provider_id) if claim.provider_id else None,
            "payer_account": claim.payer_account,
            "receipt_image_url": claim.receipt_image_url,
            "rejection_reason": claim.rejection_reason,
            "issued_ticket_id": str(claim.issued_ticket_id) if claim.issued_ticket_id else None,
        })
    return d


# ──────────────────────────────────────────────
# Submit an offline-payment claim for a ticket
# ──────────────────────────────────────────────
@router.post("/classes/{class_id}/offline-claim")
async def submit_ticket_offline_claim(
    class_id: str,
    quantity: int = Form(1),
    payment_channel: str = Form(...),
    transaction_code: str = Form(...),
    provider_id: Optional[str] = Form(None),
    provider_name: Optional[str] = Form(None),
    payer_account: Optional[str] = Form(None),
    receipt_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Buyer-submitted: 'I already paid for this ticket via another method.'

    Creates a pending TicketOfflineClaim. No EventTicket exists yet — that
    is minted only when the seller confirms. The seller is notified via
    SMS/WhatsApp + in-app immediately.
    """
    try:
        tcid = uuid.UUID(class_id)
    except ValueError:
        return standard_response(False, "Invalid ticket class ID")

    pc = (payment_channel or "").strip().lower()
    if pc not in ("mobile_money", "bank"):
        return standard_response(False, "payment_channel must be 'mobile_money' or 'bank'")

    txn = (transaction_code or "").strip()
    if len(txn) < 3:
        return standard_response(False, "Transaction code is required")

    if quantity < 1 or quantity > 50:
        return standard_response(False, "Quantity must be between 1 and 50")

    tc = db.query(EventTicketClass).filter(EventTicketClass.id == tcid).first()
    if not tc:
        return standard_response(False, "Ticket class not found")

    event = db.query(Event).filter(Event.id == tc.event_id).first()
    if not event or not event.sells_tickets:
        return standard_response(False, "Event not found or does not sell tickets")
    if event.ticket_approval_status != TicketApprovalStatusEnum.approved:
        return standard_response(False, "Ticket sales are not active for this event")

    # Capacity check (count pending claims toward sold so we don't oversell)
    current_sold = db.query(sa_func.coalesce(sa_func.sum(EventTicket.quantity), 0)).filter(
        EventTicket.ticket_class_id == tc.id,
        EventTicket.status.notin_([TicketOrderStatusEnum.rejected, TicketOrderStatusEnum.cancelled]),
    ).scalar() or 0
    pending_claims = db.query(sa_func.coalesce(sa_func.sum(TicketOfflineClaim.quantity), 0)).filter(
        TicketOfflineClaim.ticket_class_id == tc.id,
        TicketOfflineClaim.status == "pending",
    ).scalar() or 0
    available = tc.quantity - int(current_sold) - int(pending_claims)
    if available < quantity:
        return standard_response(False, f"Only {max(0, available)} tickets available for '{tc.name}'.")

    # Duplicate transaction code guard — the unique index will also catch it.
    dup = db.query(TicketOfflineClaim).filter(
        TicketOfflineClaim.ticket_class_id == tc.id,
        TicketOfflineClaim.transaction_code == txn,
    ).first()
    if dup:
        return standard_response(False, "This transaction code has already been submitted for this ticket")

    provider_uuid = None
    if provider_id:
        try:
            provider_uuid = uuid.UUID(provider_id)
        except ValueError:
            return standard_response(False, "Invalid provider_id")

    receipt_url = None
    if receipt_image and getattr(receipt_image, "filename", None):
        from utils.offline_claims import upload_receipt_image
        ok, msg, url = await upload_receipt_image(receipt_image, target_subdir="ticket-receipts")
        if not ok:
            return standard_response(False, msg)
        receipt_url = url

    claim = TicketOfflineClaim(
        id=uuid.uuid4(),
        event_id=event.id,
        ticket_class_id=tc.id,
        claimant_user_id=current_user.id,
        claimant_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or current_user.phone or "Buyer",
        claimant_phone=current_user.phone,
        claimant_email=current_user.email,
        quantity=quantity,
        amount=float(tc.price) * quantity,
        payment_channel=pc,
        provider_id=provider_uuid,
        provider_name=(provider_name or "").strip() or None,
        payer_account=(payer_account or "").strip() or None,
        transaction_code=txn,
        receipt_image_url=receipt_url,
        status="pending",
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)

    # Notify the organiser
    try:
        from utils.notify_channels import notify_user_wa_sms
        organizer = db.query(User).filter(User.id == event.organizer_id).first()
        if organizer and organizer.phone:
            msg = (
                f"Hello {organizer.first_name}, {claim.claimant_name} submitted an "
                f"off-platform payment claim for {quantity} × {tc.name} ticket(s) "
                f"({event.name}). Open Nuru to review and approve."
            )
            notify_user_wa_sms(organizer.phone, msg)
    except Exception as e:
        print(f"[ticket-offline-claim] organiser notify failed: {e}")

    return standard_response(True, "Payment claim submitted for approval", _claim_dict(claim))


# ──────────────────────────────────────────────
# Organiser: list claims for an event
# ──────────────────────────────────────────────
@router.get("/events/{event_id}/offline-claims")
def list_ticket_offline_claims(
    event_id: str,
    status: Optional[str] = Query(None, description="pending | confirmed | rejected"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")

    event = db.query(Event).filter(Event.id == eid, Event.organizer_id == current_user.id).first()
    if not event:
        return standard_response(False, "Only the event organiser can view ticket offline claims")

    q = db.query(TicketOfflineClaim).filter(TicketOfflineClaim.event_id == eid)
    if status in ("pending", "confirmed", "rejected"):
        q = q.filter(TicketOfflineClaim.status == status)
    claims = q.order_by(TicketOfflineClaim.created_at.desc()).all()

    return standard_response(True, "Claims fetched", {
        "claims": [_claim_dict(c, include_audit=True) for c in claims],
        "count": len(claims),
    })


# ──────────────────────────────────────────────
# Organiser: confirm a claim → mint real ticket(s)
# ──────────────────────────────────────────────
@router.post("/offline-claims/{claim_id}/confirm")
def confirm_ticket_offline_claim(
    claim_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(claim_id)
    except ValueError:
        return standard_response(False, "Invalid claim ID")

    claim = db.query(TicketOfflineClaim).filter(TicketOfflineClaim.id == cid).first()
    if not claim:
        return standard_response(False, "Claim not found")

    event = db.query(Event).filter(Event.id == claim.event_id, Event.organizer_id == current_user.id).first()
    if not event:
        return standard_response(False, "Only the event organiser can review this claim")

    if claim.status != "pending":
        return standard_response(False, f"Claim is already {claim.status}")

    tc = db.query(EventTicketClass).filter(EventTicketClass.id == claim.ticket_class_id).first()
    if not tc:
        return standard_response(False, "Ticket class no longer exists")

    # Mint a single EventTicket carrying the claim's quantity
    ticket_code = f"NTK-{secrets.token_hex(4).upper()}"
    method_enum = PaymentMethodEnum.mobile if claim.payment_channel == "mobile_money" else PaymentMethodEnum.bank
    ticket = EventTicket(
        id=uuid.uuid4(),
        ticket_class_id=tc.id,
        event_id=event.id,
        buyer_user_id=claim.claimant_user_id or current_user.id,
        ticket_code=ticket_code,
        quantity=claim.quantity,
        total_amount=claim.amount,
        payment_method=method_enum,
        payment_status=PaymentStatusEnum.completed,
        payment_ref=claim.transaction_code,
        status=TicketOrderStatusEnum.confirmed,
        buyer_name=claim.claimant_name,
        buyer_phone=claim.claimant_phone,
        buyer_email=claim.claimant_email,
    )
    db.add(ticket)
    db.flush()  # ensure event_tickets row exists before FK reference

    claim.status = "confirmed"
    claim.reviewed_by = current_user.id
    claim.reviewed_at = datetime.now(EAT)
    claim.issued_ticket_id = ticket.id
    db.commit()
    db.refresh(claim)

    # Notify the buyer
    try:
        from utils.notify_channels import notify_user_wa_sms
        if claim.claimant_phone:
            msg = (
                f"Hello {claim.claimant_name}, your off-platform payment for "
                f"{claim.quantity} × {tc.name} ticket(s) to {event.name} has been "
                f"confirmed. Ticket code: {ticket_code}. Show this at the gate."
            )
            notify_user_wa_sms(claim.claimant_phone, msg)
    except Exception as e:
        print(f"[ticket-offline-claim] buyer confirm notify failed: {e}")

    # Auto-deliver the ticket card via WhatsApp (fire-and-forget).
    try:
        if claim.claimant_phone:
            from utils.whatsapp_cards import wa_send_ticket
            ev_date = ""
            try:
                if getattr(event, "start_date", None):
                    ev_date = event.start_date.strftime("%a, %-d %b %Y")
            except Exception:
                try:
                    ev_date = event.start_date.strftime("%a, %d %b %Y") if getattr(event, "start_date", None) else ""
                except Exception:
                    pass
            wa_send_ticket(
                phone=claim.claimant_phone,
                event_id=str(event.id),
                ticket_code=ticket_code,
                buyer_name=claim.claimant_name or "Friend",
                event_name=event.name or "the event",
                event_date=ev_date or "",
                ticket_class=tc.name or "General",
                cover_image=(getattr(event, "cover_image_url", None) or ""),
                event_time=(getattr(event, "start_time", None).isoformat() if getattr(event, "start_time", None) else ""),
                venue=(getattr(event, "location", None) or ""),
            )
    except Exception as e:
        print(f"[ticket-offline-claim] wa_send_ticket failed: {e}")

    return standard_response(True, "Claim confirmed and ticket issued", {
        "claim": _claim_dict(claim),
        "ticket_code": ticket_code,
    })


# ──────────────────────────────────────────────
# Organiser: reject a claim
# ──────────────────────────────────────────────
@router.post("/offline-claims/{claim_id}/reject")
def reject_ticket_offline_claim(
    claim_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(claim_id)
    except ValueError:
        return standard_response(False, "Invalid claim ID")

    claim = db.query(TicketOfflineClaim).filter(TicketOfflineClaim.id == cid).first()
    if not claim:
        return standard_response(False, "Claim not found")

    event = db.query(Event).filter(Event.id == claim.event_id, Event.organizer_id == current_user.id).first()
    if not event:
        return standard_response(False, "Only the event organiser can review this claim")

    if claim.status != "pending":
        return standard_response(False, f"Claim is already {claim.status}")

    reason = (body.get("rejection_reason") or "").strip() or None
    claim.status = "rejected"
    claim.rejection_reason = reason
    claim.reviewed_by = current_user.id
    claim.reviewed_at = datetime.now(EAT)
    db.commit()

    try:
        from utils.notify_channels import notify_user_wa_sms
        if claim.claimant_phone:
            why = f" Reason: {reason}." if reason else ""
            msg = (
                f"Hello {claim.claimant_name}, your off-platform payment claim for "
                f"{event.name} could not be verified by the organiser.{why} "
                f"Please contact the organiser if you believe this is an error."
            )
            notify_user_wa_sms(claim.claimant_phone, msg)
    except Exception as e:
        print(f"[ticket-offline-claim] buyer reject notify failed: {e}")

    return standard_response(True, "Claim rejected", _claim_dict(claim))


# ──────────────────────────────────────────────
# Buyer: my submitted claims (lightweight history)
# ──────────────────────────────────────────────
@router.get("/my-offline-claims")
def my_ticket_offline_claims(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    claims = db.query(TicketOfflineClaim).filter(
        TicketOfflineClaim.claimant_user_id == current_user.id,
    ).order_by(TicketOfflineClaim.created_at.desc()).all()

    # The buyer themselves may always see all fields they submitted.
    return standard_response(True, "My claims fetched", {
        "claims": [_claim_dict(c, include_audit=True) for c in claims],
        "count": len(claims),
    })
