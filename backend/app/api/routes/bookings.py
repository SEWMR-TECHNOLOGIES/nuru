# Bookings Routes - /bookings/...
# Handles booking management for clients and vendors

import uuid
from datetime import datetime

import pytz
from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from core.database import get_db
from models import ServiceBookingRequest, UserService, Event, User
from utils.auth import get_current_user
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/bookings", tags=["Bookings"])


def _booking_dict(db, b):
    service = db.query(UserService).filter(UserService.id == b.user_service_id).first() if b.user_service_id else None
    requester = db.query(User).filter(User.id == b.requester_user_id).first() if b.requester_user_id else None
    # Vendor is the service owner
    vendor = None
    if service and service.user_id:
        vendor = db.query(User).filter(User.id == service.user_id).first()
    event = db.query(Event).filter(Event.id == b.event_id).first() if b.event_id else None

    return {
        "id": str(b.id),
        "service": {"id": str(service.id), "title": service.title} if service else None,
        "client": {"id": str(requester.id), "name": f"{requester.first_name} {requester.last_name}"} if requester else None,
        "vendor": {"id": str(vendor.id), "name": f"{vendor.first_name} {vendor.last_name}"} if vendor else None,
        "event": {"id": str(event.id), "title": event.name} if event else None,
        "status": b.status if isinstance(b.status, str) else (b.status.value if hasattr(b.status, "value") else b.status),
        "message": b.message,
        "proposed_price": float(b.proposed_price) if b.proposed_price else None,
        "quoted_price": float(b.quoted_price) if b.quoted_price else None,
        "deposit_required": float(b.deposit_required) if b.deposit_required else None,
        "deposit_paid": b.deposit_paid,
        "vendor_notes": b.vendor_notes,
        "created_at": b.created_at.isoformat() if b.created_at else None,
        "updated_at": b.updated_at.isoformat() if b.updated_at else None,
    }


@router.get("/")
def get_my_bookings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bookings = db.query(ServiceBookingRequest).filter(ServiceBookingRequest.requester_user_id == current_user.id).order_by(ServiceBookingRequest.created_at.desc()).all()
    return standard_response(True, "Bookings retrieved successfully", [_booking_dict(db, b) for b in bookings])


@router.get("/received")
def get_received_bookings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Find bookings for services owned by the current user
    my_service_ids = [s.id for s in db.query(UserService.id).filter(UserService.user_id == current_user.id).all()]
    if not my_service_ids:
        return standard_response(True, "Received bookings retrieved successfully", [])
    bookings = db.query(ServiceBookingRequest).filter(ServiceBookingRequest.user_service_id.in_(my_service_ids)).order_by(ServiceBookingRequest.created_at.desc()).all()
    return standard_response(True, "Received bookings retrieved successfully", [_booking_dict(db, b) for b in bookings])


@router.get("/{booking_id}")
def get_booking(booking_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        bid = uuid.UUID(booking_id)
    except ValueError:
        return standard_response(False, "Invalid booking ID")

    b = db.query(ServiceBookingRequest).filter(ServiceBookingRequest.id == bid).first()
    if not b:
        return standard_response(False, "Booking not found")

    return standard_response(True, "Booking retrieved successfully", _booking_dict(db, b))


@router.put("/{booking_id}")
def update_booking(booking_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        bid = uuid.UUID(booking_id)
    except ValueError:
        return standard_response(False, "Invalid booking ID")

    b = db.query(ServiceBookingRequest).filter(ServiceBookingRequest.id == bid).first()
    if not b:
        return standard_response(False, "Booking not found")

    if "message" in body: b.message = body["message"]
    if "budget" in body: b.budget = body["budget"]
    b.updated_at = datetime.now(EAT)
    db.commit()

    return standard_response(True, "Booking updated successfully", _booking_dict(db, b))


@router.post("/{booking_id}/cancel")
def cancel_booking(booking_id: str, body: dict = Body(default={}), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        bid = uuid.UUID(booking_id)
    except ValueError:
        return standard_response(False, "Invalid booking ID")

    b = db.query(ServiceBookingRequest).filter(ServiceBookingRequest.id == bid).first()
    if not b:
        return standard_response(False, "Booking not found")

    b.status = "cancelled"
    b.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Booking cancelled successfully")


@router.post("/{booking_id}/respond")
def respond_to_booking(booking_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        bid = uuid.UUID(booking_id)
    except ValueError:
        return standard_response(False, "Invalid booking ID")

    b = db.query(ServiceBookingRequest).filter(ServiceBookingRequest.id == bid).first()
    if not b:
        return standard_response(False, "Booking not found")

    if "status" in body: b.status = body["status"]
    if "quoted_price" in body: b.quoted_price = body["quoted_price"]
    if "response_message" in body: b.vendor_response = body["response_message"]
    b.responded_at = datetime.now(EAT)
    b.updated_at = datetime.now(EAT)
    db.commit()

    return standard_response(True, "Response recorded successfully", _booking_dict(db, b))


@router.post("/{booking_id}/accept-quote")
def accept_quote(booking_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        bid = uuid.UUID(booking_id)
    except ValueError:
        return standard_response(False, "Invalid booking ID")

    b = db.query(ServiceBookingRequest).filter(ServiceBookingRequest.id == bid, ServiceBookingRequest.requester_user_id == current_user.id).first()
    if not b:
        return standard_response(False, "Booking not found")

    b.status = "accepted"
    b.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Quote accepted successfully")


@router.post("/{booking_id}/pay-deposit")
def pay_deposit(booking_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        bid = uuid.UUID(booking_id)
    except ValueError:
        return standard_response(False, "Invalid booking ID")

    b = db.query(ServiceBookingRequest).filter(ServiceBookingRequest.id == bid).first()
    if not b:
        return standard_response(False, "Booking not found")

    b.deposit_paid = True
    b.status = "deposit_paid"
    b.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Deposit recorded successfully")


@router.post("/{booking_id}/complete")
def mark_booking_complete(booking_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        bid = uuid.UUID(booking_id)
    except ValueError:
        return standard_response(False, "Invalid booking ID")

    b = db.query(ServiceBookingRequest).filter(ServiceBookingRequest.id == bid).first()
    if not b:
        return standard_response(False, "Booking not found")

    b.status = "completed"
    b.completed_at = datetime.now(EAT)
    b.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Booking marked as completed")


@router.post("/{booking_id}/request-payment")
def request_final_payment(booking_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        bid = uuid.UUID(booking_id)
    except ValueError:
        return standard_response(False, "Invalid booking ID")

    b = db.query(ServiceBookingRequest).filter(ServiceBookingRequest.id == bid).first()
    if not b:
        return standard_response(False, "Booking not found")

    b.payment_requested = True
    b.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Payment request sent to client")


@router.post("/{booking_id}/pay-balance")
def pay_balance(booking_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        bid = uuid.UUID(booking_id)
    except ValueError:
        return standard_response(False, "Invalid booking ID")

    b = db.query(ServiceBookingRequest).filter(ServiceBookingRequest.id == bid).first()
    if not b:
        return standard_response(False, "Booking not found")

    b.balance_paid = True
    b.status = "paid"
    b.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Balance paid successfully")
