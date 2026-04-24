"""Delivery OTP routes — Phase 1.3

Endpoints:
  GET   /delivery-otp/booking/:booking_id          → current state (organiser sees code)
  POST  /delivery-otp/booking/:booking_id/arrive   → vendor issues a fresh code
  POST  /delivery-otp/booking/:booking_id/verify   → vendor enters the code
  POST  /delivery-otp/booking/:booking_id/cancel   → vendor cancels active code
"""

import uuid

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from models import ServiceBookingRequest, User
from services import delivery_otp_service as otp_svc
from utils.auth import get_current_user
from utils.helpers import standard_response

router = APIRouter(prefix="/delivery-otp", tags=["Delivery OTP"])


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


def _viewer(db: Session, booking: ServiceBookingRequest, user: User) -> str | None:
    if otp_svc.is_vendor(db, booking, user.id):
        return "vendor"
    if otp_svc.is_organiser(booking, user.id):
        return "organiser"
    return None


@router.get("/booking/{booking_id}")
def get_state(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = _get_booking(db, booking_id)
    if not booking:
        return standard_response(False, "Booking not found")
    viewer = _viewer(db, booking, current_user)
    if not viewer:
        return standard_response(False, "Not authorized")

    active = otp_svc.get_active(db, booking.id)
    confirmed = otp_svc.get_confirmed(db, booking.id)
    db.commit()
    return standard_response(
        True,
        "Delivery OTP state",
        otp_svc.serialize(active, viewer=viewer, confirmed=confirmed),
    )


@router.post("/booking/{booking_id}/arrive")
def vendor_arrive(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = _get_booking(db, booking_id)
    if not booking:
        return standard_response(False, "Booking not found")
    if not otp_svc.is_vendor(db, booking, current_user.id):
        return standard_response(False, "Only the vendor can mark arrival")

    if booking.status not in ("accepted", "funds_secured", "in_progress"):
        return standard_response(
            False,
            "Booking is not in a state where check-in is allowed",
        )

    otp = otp_svc.issue_for_booking(db, booking, current_user.id)
    booking.status = "in_progress"
    db.commit()
    db.refresh(otp)
    return standard_response(
        True,
        "Code issued. Ask the organiser to share it.",
        otp_svc.serialize(otp, viewer="vendor"),
    )


@router.post("/booking/{booking_id}/verify")
def vendor_verify(
    booking_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = _get_booking(db, booking_id)
    if not booking:
        return standard_response(False, "Booking not found")
    if not otp_svc.is_vendor(db, booking, current_user.id):
        return standard_response(False, "Only the vendor can verify the code")

    code = (body.get("code") or "").strip()
    if not code:
        return standard_response(False, "Code is required")

    ok, msg, otp = otp_svc.verify(db, booking, code, current_user.id)
    db.commit()
    confirmed = otp_svc.get_confirmed(db, booking.id) if ok else None
    active = None if ok else otp_svc.get_active(db, booking.id)
    return standard_response(
        ok, msg,
        otp_svc.serialize(active, viewer="vendor", confirmed=confirmed),
    )


@router.post("/booking/{booking_id}/cancel")
def vendor_cancel(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = _get_booking(db, booking_id)
    if not booking:
        return standard_response(False, "Booking not found")
    if not otp_svc.is_vendor(db, booking, current_user.id):
        return standard_response(False, "Only the vendor can cancel a code")

    active = otp_svc.get_active(db, booking.id)
    if active:
        from datetime import datetime
        import pytz
        active.status = "cancelled"
        active.cancelled_at = datetime.now(pytz.timezone("Africa/Nairobi")).replace(tzinfo=None)
        db.commit()
    return standard_response(True, "Active code cancelled",
                             otp_svc.serialize(None, viewer="vendor"))
