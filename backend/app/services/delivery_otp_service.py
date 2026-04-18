"""Service-Delivery OTP — Phase 1.3
==================================
Mandatory in-person check-in flow.

Flow:
  1. Vendor on site → POST /delivery-otp/booking/:id/arrive
       → backend invalidates any active OTP for the booking, generates a fresh
         6-digit code, stores it with a 2-hour expiry, returns it to the
         organiser. Vendor sees only "code issued, ask the organiser".
  2. Organiser shares the code verbally / via screen.
  3. Vendor enters it → POST /delivery-otp/booking/:id/verify
       → on success: marks booking as 'delivered', stamps event_services
         delivery_confirmed_at, unlocks escrow release.
       → 5 wrong attempts locks the OTP and a new "Arrived" must be issued.

Escrow release is blocked unless ``is_delivery_confirmed(booking)`` is True,
enforced inside ``escrow_service.release_to_vendor`` via the API layer.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import Optional

import pytz
from sqlalchemy.orm import Session

from models import (
    ServiceBookingRequest,
    UserService,
    EventService,
)
from models.service_delivery_otps import ServiceDeliveryOtp

EAT = pytz.timezone("Africa/Nairobi")
OTP_VALIDITY_MINUTES = 120  # 2 hours window on event day
MAX_ATTEMPTS = 5


def _now() -> datetime:
    return datetime.now(EAT).replace(tzinfo=None)


def _gen_code() -> str:
    # 6-digit numeric, padded
    return f"{secrets.randbelow(1_000_000):06d}"


# ── Authorisation helpers ─────────────────────────────────────────────────

def is_vendor(db: Session, booking: ServiceBookingRequest, user_id) -> bool:
    if not booking.user_service_id:
        return False
    svc = db.query(UserService).filter(UserService.id == booking.user_service_id).first()
    return bool(svc and str(svc.user_id) == str(user_id))


def is_organiser(booking: ServiceBookingRequest, user_id) -> bool:
    return booking.requester_user_id and str(booking.requester_user_id) == str(user_id)


# ── Core operations ───────────────────────────────────────────────────────

def issue_for_booking(
    db: Session,
    booking: ServiceBookingRequest,
    vendor_user_id,
) -> ServiceDeliveryOtp:
    """Vendor 'Arrived' → invalidate any active OTPs and issue a fresh one."""
    now = _now()

    # Invalidate any still-active OTPs for this booking
    actives = (
        db.query(ServiceDeliveryOtp)
        .filter(
            ServiceDeliveryOtp.booking_id == booking.id,
            ServiceDeliveryOtp.status == "active",
        )
        .all()
    )
    for old in actives:
        old.status = "cancelled"
        old.cancelled_at = now

    # Resolve event_service_id (best-effort)
    event_service_id = None
    if booking.event_id and booking.user_service_id:
        es = (
            db.query(EventService)
            .filter(
                EventService.event_id == booking.event_id,
                EventService.provider_user_service_id == booking.user_service_id,
            )
            .first()
        )
        if es:
            event_service_id = es.id

    otp = ServiceDeliveryOtp(
        booking_id=booking.id,
        event_service_id=event_service_id,
        code=_gen_code(),
        issued_by_vendor_id=vendor_user_id,
        issued_at=now,
        expires_at=now + timedelta(minutes=OTP_VALIDITY_MINUTES),
        attempts=0,
        status="active",
    )
    db.add(otp)
    db.flush()
    return otp


def get_active(db: Session, booking_id) -> Optional[ServiceDeliveryOtp]:
    """Latest active (non-expired, non-confirmed) OTP for a booking."""
    now = _now()
    otp = (
        db.query(ServiceDeliveryOtp)
        .filter(
            ServiceDeliveryOtp.booking_id == booking_id,
            ServiceDeliveryOtp.status == "active",
        )
        .order_by(ServiceDeliveryOtp.issued_at.desc())
        .first()
    )
    if not otp:
        return None
    if otp.expires_at and otp.expires_at < now:
        otp.status = "expired"
        return None
    return otp


def get_confirmed(db: Session, booking_id) -> Optional[ServiceDeliveryOtp]:
    return (
        db.query(ServiceDeliveryOtp)
        .filter(
            ServiceDeliveryOtp.booking_id == booking_id,
            ServiceDeliveryOtp.status == "confirmed",
        )
        .order_by(ServiceDeliveryOtp.confirmed_at.desc())
        .first()
    )


def is_delivery_confirmed(db: Session, booking_id) -> bool:
    return get_confirmed(db, booking_id) is not None


def verify(
    db: Session,
    booking: ServiceBookingRequest,
    code: str,
    vendor_user_id,
) -> tuple[bool, str, Optional[ServiceDeliveryOtp]]:
    """Vendor enters code → verify and mark delivered."""
    otp = get_active(db, booking.id)
    if not otp:
        return False, "No active code. Ask the organiser to confirm you tapped 'Arrived', or tap it again.", None

    if otp.attempts >= MAX_ATTEMPTS:
        otp.status = "locked"
        return False, "Too many wrong attempts. Tap 'Arrived' again to issue a new code.", otp

    submitted = (code or "").strip()
    if submitted != otp.code:
        otp.attempts = (otp.attempts or 0) + 1
        if otp.attempts >= MAX_ATTEMPTS:
            otp.status = "locked"
            return False, "Too many wrong attempts. Tap 'Arrived' again.", otp
        return False, f"Incorrect code. {MAX_ATTEMPTS - otp.attempts} attempts left.", otp

    # ✅ Confirmed
    now = _now()
    otp.status = "confirmed"
    otp.confirmed_at = now
    otp.confirmed_by_vendor_id = vendor_user_id

    # Stamp event_services if linked
    if otp.event_service_id:
        es = db.query(EventService).filter(EventService.id == otp.event_service_id).first()
        if es:
            es.delivery_confirmed_at = now
            es.delivery_confirmed_by_id = vendor_user_id

    # Move booking into delivered
    booking.status = "delivered"
    booking.updated_at = now
    return True, "Delivery confirmed", otp


# ── Serialization ─────────────────────────────────────────────────────────

def serialize(
    otp: Optional[ServiceDeliveryOtp],
    *,
    viewer: str,  # "vendor" | "organiser"
    confirmed: Optional[ServiceDeliveryOtp] = None,
) -> dict:
    """The organiser sees the code. The vendor never does."""
    base = {
        "active": None,
        "confirmed": None,
        "max_attempts": MAX_ATTEMPTS,
        "validity_minutes": OTP_VALIDITY_MINUTES,
    }
    if otp:
        base["active"] = {
            "id": str(otp.id),
            "status": otp.status,
            "issued_at": otp.issued_at.isoformat() if otp.issued_at else None,
            "expires_at": otp.expires_at.isoformat() if otp.expires_at else None,
            "attempts": otp.attempts or 0,
            # Code is exposed ONLY to organiser
            "code": otp.code if viewer == "organiser" else None,
        }
    if confirmed:
        base["confirmed"] = {
            "id": str(confirmed.id),
            "confirmed_at": confirmed.confirmed_at.isoformat() if confirmed.confirmed_at else None,
        }
    return base
