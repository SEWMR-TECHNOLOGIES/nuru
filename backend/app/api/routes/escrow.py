"""Escrow API routes — Phase 1.1

Endpoints:
  GET   /escrow/booking/:booking_id           → hold + transaction history
  POST  /escrow/booking/:booking_id/release    → vendor-side release (after delivery)
  POST  /escrow/booking/:booking_id/refund     → refund N to organiser
  POST  /escrow/holds/:hold_id/mark-settled    → admin: real payout done
"""

import uuid

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from models import (
    EscrowHold,
    ServiceBookingRequest,
    User,
    UserService,
)
from services import escrow_service as escrow
from utils.auth import get_current_user
from utils.helpers import standard_response

router = APIRouter(prefix="/escrow", tags=["Escrow"])


def _is_vendor(db: Session, booking: ServiceBookingRequest, user_id) -> bool:
    if not booking.user_service_id:
        return False
    svc = db.query(UserService).filter(UserService.id == booking.user_service_id).first()
    return bool(svc and str(svc.user_id) == str(user_id))


def _is_organiser(booking: ServiceBookingRequest, user_id) -> bool:
    return booking.requester_user_id and str(booking.requester_user_id) == str(user_id)


def _get_booking(db: Session, booking_id: str):
    try:
        bid = uuid.UUID(booking_id)
    except ValueError:
        return None
    return (
        db.query(ServiceBookingRequest)
        .filter(ServiceBookingRequest.id == bid)
        .first()
    )


@router.get("/booking/{booking_id}")
def get_escrow_for_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = _get_booking(db, booking_id)
    if not booking:
        return standard_response(False, "Booking not found")
    if not (_is_vendor(db, booking, current_user.id) or _is_organiser(booking, current_user.id)):
        return standard_response(False, "Not authorized")

    hold = escrow.get_or_create_hold(db, booking)
    db.commit()
    db.refresh(hold)
    return standard_response(True, "Escrow retrieved", escrow.serialize_hold(hold))


@router.post("/booking/{booking_id}/release")
def release_booking_funds(
    booking_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Organiser-confirmed release after delivery (or admin)."""
    booking = _get_booking(db, booking_id)
    if not booking:
        return standard_response(False, "Booking not found")
    if not _is_organiser(booking, current_user.id):
        return standard_response(False, "Only the organiser can release funds")

    # Phase 1.3: BLOCK release until service-delivery OTP has been confirmed.
    from services import delivery_otp_service as otp_svc
    if not otp_svc.is_delivery_confirmed(db, booking.id):
        return standard_response(
            False,
            "Funds cannot be released yet — vendor must complete the on-site check-in code first.",
        )

    reason = body.get("reason") or "organiser_released"
    hold = escrow.release_to_vendor(db, booking, reason=reason, actor_id=current_user.id)
    db.commit()
    db.refresh(hold)
    return standard_response(True, "Funds released to vendor side of ledger",
                             escrow.serialize_hold(hold))


@router.post("/booking/{booking_id}/refund")
def refund_booking(
    booking_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = _get_booking(db, booking_id)
    if not booking:
        return standard_response(False, "Booking not found")
    # Vendor or admin may issue refund; organiser cannot self-refund.
    if not _is_vendor(db, booking, current_user.id):
        return standard_response(False, "Only the vendor can issue a refund here")

    amount = body.get("amount")
    if not amount:
        return standard_response(False, "Amount is required")
    reason = body.get("reason") or "vendor_refund"
    hold = escrow.refund_to_organiser(db, booking, amount, reason=reason,
                                      actor_id=current_user.id)
    db.commit()
    db.refresh(hold)
    return standard_response(True, "Refund recorded", escrow.serialize_hold(hold))


@router.post("/holds/{hold_id}/mark-settled")
def mark_hold_settled(
    hold_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin only: record that the real MPesa/card payout to vendor is done."""
    # Light admin check — relies on AdminUser table. Tighten later.
    from models import AdminUser
    is_admin = (
        db.query(AdminUser).filter(AdminUser.user_id == current_user.id).first()
        is not None
    )
    if not is_admin:
        return standard_response(False, "Admin only")

    try:
        hid = uuid.UUID(hold_id)
    except ValueError:
        return standard_response(False, "Invalid hold ID")
    hold = db.query(EscrowHold).filter(EscrowHold.id == hid).first()
    if not hold:
        return standard_response(False, "Hold not found")

    escrow.mark_settled_to_vendor(db, hold, current_user.id, body.get("external_ref"))
    db.commit()
    db.refresh(hold)
    return standard_response(True, "Hold marked as settled", escrow.serialize_hold(hold))
