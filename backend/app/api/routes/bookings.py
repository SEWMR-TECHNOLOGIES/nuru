# Bookings Routes - /bookings/...
# Handles booking management for clients and vendors

import uuid
from datetime import datetime

import pytz
from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from core.database import get_db
from models import ServiceBookingRequest, UserService, Event, User, EventService
from utils.auth import get_current_user
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/bookings", tags=["Bookings"])


def _get_primary_image(service):
    """Get primary image for a service, checking images relation and cover_image."""
    if hasattr(service, 'images') and service.images:
        for img in service.images:
            if hasattr(img, 'is_featured') and img.is_featured:
                return img.image_url
        return service.images[0].image_url
    if hasattr(service, 'cover_image_url') and service.cover_image_url:
        return service.cover_image_url
    return None


def _user_avatar(user):
    """Get avatar URL from user profile."""
    if user and hasattr(user, 'profile') and user.profile:
        return user.profile.profile_picture_url
    return None


def _booking_dict(db, b):
    service = db.query(UserService).filter(UserService.id == b.user_service_id).first() if b.user_service_id else None
    requester = db.query(User).filter(User.id == b.requester_user_id).first() if b.requester_user_id else None
    # Vendor is the service owner
    vendor = None
    if service and service.user_id:
        vendor = db.query(User).filter(User.id == service.user_id).first()
    event = db.query(Event).filter(Event.id == b.event_id).first() if b.event_id else None

    # Build enriched service dict
    service_dict = None
    if service:
        service_dict = {
            "id": str(service.id),
            "title": service.title,
            "primary_image": _get_primary_image(service),
            "category": service.category.name if hasattr(service, 'category') and service.category else None,
        }

    # Build enriched client dict
    client_dict = None
    if requester:
        client_dict = {
            "id": str(requester.id),
            "name": f"{requester.first_name} {requester.last_name}",
            "avatar": _user_avatar(requester),
            "phone": requester.phone,
            "email": requester.email,
        }

    # Build enriched vendor dict
    vendor_dict = None
    if vendor:
        vendor_dict = {
            "id": str(vendor.id),
            "name": f"{vendor.first_name} {vendor.last_name}",
            "avatar": _user_avatar(vendor),
            "phone": vendor.phone,
            "email": vendor.email,
        }

    # Build enriched event dict
    event_dict = None
    if event:
        event_date_str = None
        if event.start_date:
            event_date_str = event.start_date.isoformat() if hasattr(event.start_date, 'isoformat') else str(event.start_date)
        event_dict = {
            "id": str(event.id),
            "title": event.name,
            "date": event_date_str,
            "start_time": event.start_time if hasattr(event, 'start_time') else None,
            "end_time": event.end_time if hasattr(event, 'end_time') else None,
            "location": event.location,
            "venue": event.venue if hasattr(event, 'venue') else None,
            "guest_count": event.expected_guests if hasattr(event, 'expected_guests') else None,
        }

    return {
        "id": str(b.id),
        "service": service_dict,
        "client": client_dict,
        "provider": vendor_dict,
        "event": event_dict,
        "event_name": event.name if event else None,
        "event_date": event_dict["date"] if event_dict else None,
        "event_type": None,
        "location": event.location if event else None,
        "venue": event.venue if event and hasattr(event, 'venue') else None,
        "guest_count": event.expected_guests if event and hasattr(event, 'expected_guests') else None,
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
    items = [_booking_dict(db, b) for b in bookings]
    summary = {
        "total": len(items),
        "pending": sum(1 for b in items if b["status"] == "pending"),
        "accepted": sum(1 for b in items if b["status"] == "accepted"),
        "rejected": sum(1 for b in items if b["status"] == "rejected"),
        "completed": sum(1 for b in items if b["status"] == "completed"),
        "cancelled": sum(1 for b in items if b["status"] == "cancelled"),
    }
    return standard_response(True, "Bookings retrieved successfully", {"bookings": items, "summary": summary})


@router.get("/received")
def get_received_bookings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Find bookings for services owned by the current user
    my_service_ids = [s.id for s in db.query(UserService.id).filter(UserService.user_id == current_user.id).all()]
    if not my_service_ids:
        return standard_response(True, "Received bookings retrieved successfully", {"bookings": [], "summary": {"total": 0, "pending": 0, "accepted": 0, "rejected": 0, "completed": 0, "cancelled": 0}})
    bookings = db.query(ServiceBookingRequest).filter(ServiceBookingRequest.user_service_id.in_(my_service_ids)).order_by(ServiceBookingRequest.created_at.desc()).all()
    items = [_booking_dict(db, b) for b in bookings]
    summary = {
        "total": len(items),
        "pending": sum(1 for b in items if b["status"] == "pending"),
        "accepted": sum(1 for b in items if b["status"] == "accepted"),
        "rejected": sum(1 for b in items if b["status"] == "rejected"),
        "completed": sum(1 for b in items if b["status"] == "completed"),
        "cancelled": sum(1 for b in items if b["status"] == "cancelled"),
    }
    return standard_response(True, "Received bookings retrieved successfully", {"bookings": items, "summary": summary})


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

    # Verify current user owns the service
    service = db.query(UserService).filter(UserService.id == b.user_service_id).first()
    if not service or str(service.user_id) != str(current_user.id):
        return standard_response(False, "You are not authorized to respond to this booking")

    new_status = body.get("status")
    if new_status: b.status = new_status
    if "quoted_price" in body: b.quoted_price = body["quoted_price"]
    if "deposit_required" in body: b.deposit_required = body["deposit_required"]
    if "message" in body: b.vendor_notes = body["message"]
    if "reason" in body and new_status == "rejected": b.vendor_notes = body.get("reason", "")
    b.responded_at = datetime.now(EAT)
    b.updated_at = datetime.now(EAT)

    # Sync quoted_price → EventService.agreed_price so the calendar shows correct price
    if new_status == "accepted" and b.event_id and b.user_service_id:
        es = db.query(EventService).filter(
            EventService.event_id == b.event_id,
            EventService.provider_user_service_id == b.user_service_id
        ).first()
        if es:
            if b.quoted_price:
                es.agreed_price = b.quoted_price
            if new_status == "accepted":
                es.service_status = "confirmed"
            es.updated_at = datetime.now(EAT)

    db.commit()

    # SMS & notification to event organizer
    if new_status in ("accepted", "rejected") and b.requester_user_id:
        try:
            requester = db.query(User).filter(User.id == b.requester_user_id).first()
            event = db.query(Event).filter(Event.id == b.event_id).first() if b.event_id else None
            event_name = event.name if event else "your event"
            service_name = service.title if service else "service"

            if new_status == "accepted":
                from utils.notify import notify_booking_accepted
                notify_booking_accepted(db, b.requester_user_id, current_user.id, b.event_id, event_name, service_name)
                db.commit()
                # SMS
                if requester and requester.phone:
                    from utils.sms import _send
                    _send(requester.phone, f"Hello {requester.first_name}, {current_user.first_name} {current_user.last_name} has accepted your booking for {service_name} at {event_name}. Open Nuru app for details.")
            elif new_status == "rejected":
                from utils.notify import create_notification
                create_notification(db, b.requester_user_id, current_user.id, "booking_rejected", f"declined your booking for {service_name} at {event_name}", reference_id=b.event_id, reference_type="event")
                db.commit()
        except Exception:
            pass

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
