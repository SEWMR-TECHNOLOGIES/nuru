# Nuru Cards Routes - /nuru-cards/...

import uuid
from datetime import datetime

import pytz
from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from core.database import get_db
from models import NuruCard, NuruCardOrder, User, EventAttendee
from utils.auth import get_current_user
from utils.helpers import standard_response
from utils.validation_functions import validate_tanzanian_phone

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/nuru-cards", tags=["Nuru Cards"])


@router.get("/")
def get_my_cards(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cards = db.query(NuruCard).filter(NuruCard.user_id == current_user.id).all()
    return standard_response(True, "Cards retrieved", [{
        "id": str(c.id),
        "card_number": c.card_number,
        "card_type": c.card_type.value if hasattr(c.card_type, 'value') else (c.card_type or "standard"),
        "status": c.status or ("active" if c.is_active else "inactive"),
        "holder_name": c.holder_name,
        "nfc_enabled": c.nfc_enabled,
        "template": c.template,
        "valid_from": c.valid_from.isoformat() if c.valid_from else None,
        "valid_until": c.valid_until.isoformat() if c.valid_until else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    } for c in cards])


@router.get("/my-orders")
def get_my_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get all card orders for the current user."""
    orders = db.query(NuruCardOrder).filter(NuruCardOrder.user_id == current_user.id).order_by(NuruCardOrder.created_at.desc()).all()
    return standard_response(True, "Orders retrieved", [{
        "id": str(o.id),
        "card_type": o.card_type.value if hasattr(o.card_type, 'value') else o.card_type,
        "status": o.status.value if hasattr(o.status, 'value') else o.status,
        "amount": float(o.amount) if o.amount else 0,
        "delivery_name": o.delivery_name,
        "delivery_city": o.delivery_city,
        "payment_ref": o.payment_ref,
        "created_at": o.created_at.isoformat() if o.created_at else None,
    } for o in orders])


@router.get("/{card_id}")
def get_card_details(card_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(card_id)
    except ValueError:
        return standard_response(False, "Invalid card ID")
    card = db.query(NuruCard).filter(NuruCard.id == cid, NuruCard.user_id == current_user.id).first()
    if not card:
        return standard_response(False, "Card not found")
    return standard_response(True, "Card details retrieved", {
        "id": str(card.id),
        "card_number": card.card_number,
        "card_type": card.card_type.value if hasattr(card.card_type, 'value') else (card.card_type or "standard"),
        "status": card.status or ("active" if card.is_active else "inactive"),
        "holder_name": card.holder_name,
        "nfc_enabled": card.nfc_enabled,
        "template": card.template,
        "valid_from": card.valid_from.isoformat() if card.valid_from else None,
        "valid_until": card.valid_until.isoformat() if card.valid_until else None,
    })


@router.post("/orders")
def order_card_legacy(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.now(EAT)
    order = NuruCardOrder(id=uuid.uuid4(), user_id=current_user.id, card_type=body.get("card_type", "regular"), status="pending", created_at=now, updated_at=now)
    db.add(order)
    db.commit()
    return standard_response(True, "Card order placed successfully", {"order_id": str(order.id)})


@router.post("/order")
def order_card(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Order a new Nuru Card (API doc 17.3)"""
    import random, string
    now = datetime.now(EAT)

    card_type = body.get("type", "standard")
    holder_name = body.get("holder_name", "").strip()
    if not holder_name:
        return standard_response(False, "Holder name is required")

    # Prevent duplicate pending orders of the same card type
    existing_pending = db.query(NuruCardOrder).filter(
        NuruCardOrder.user_id == current_user.id,
        NuruCardOrder.card_type == card_type,
        NuruCardOrder.status == "pending",
    ).first()
    if existing_pending:
        return standard_response(False, f"You already have a pending {card_type} card order")

    # Generate card number
    seq = ''.join(random.choices(string.digits, k=6))
    card_number = f"NURU-{now.strftime('%Y')}-{seq}"

    delivery = body.get("delivery_address", {})

    # Validate delivery phone
    delivery_phone = delivery.get("phone", "")
    if delivery_phone:
        try:
            delivery_phone = validate_tanzanian_phone(delivery_phone)
        except ValueError as e:
            return standard_response(False, str(e))

    # Create order
    order = NuruCardOrder(
        id=uuid.uuid4(),
        user_id=current_user.id,
        card_type=card_type,
        quantity=1,
        delivery_name=holder_name,
        delivery_phone=delivery_phone,
        delivery_address=delivery.get("street", ""),
        delivery_city=delivery.get("city", ""),
        delivery_postal_code=delivery.get("postal_code", ""),
        delivery_instructions=body.get("template", ""),
        status="pending",
        amount=0 if card_type == "standard" else 50000,
        payment_ref=body.get("payment_method", "mpesa"),
        created_at=now,
        updated_at=now,
    )
    db.add(order)

    # Create the card itself
    card = NuruCard(
        id=uuid.uuid4(),
        user_id=current_user.id,
        card_number=card_number,
        card_type=card_type,
        status="active",
        holder_name=holder_name,
        nfc_enabled=body.get("nfc_enabled", False),
        template=body.get("template", ""),
        is_active=True,
        issued_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(card)
    db.commit()

    return standard_response(True, "Card order placed successfully", {
        "order_id": str(order.id),
        "card_id": str(card.id),
        "card_number": card_number,
        "type": card_type,
        "status": "pending",
        "amount": order.amount,
        "created_at": now.isoformat(),
    })


@router.get("/orders/{order_id}")
def get_order_status(order_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        oid = uuid.UUID(order_id)
    except ValueError:
        return standard_response(False, "Invalid order ID")
    order = db.query(NuruCardOrder).filter(NuruCardOrder.id == oid, NuruCardOrder.user_id == current_user.id).first()
    if not order:
        return standard_response(False, "Order not found")
    return standard_response(True, "Order status retrieved", {"id": str(order.id), "status": order.status, "card_type": order.card_type})


@router.post("/{card_id}/activate")
def activate_card(card_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(card_id)
    except ValueError:
        return standard_response(False, "Invalid card ID")
    card = db.query(NuruCard).filter(NuruCard.id == cid, NuruCard.user_id == current_user.id).first()
    if not card:
        return standard_response(False, "Card not found")
    card.status = "active"
    card.activated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Card activated successfully")


@router.post("/{card_id}/suspend")
def suspend_card(card_id: str, body: dict = Body(default={}), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(card_id)
    except ValueError:
        return standard_response(False, "Invalid card ID")
    card = db.query(NuruCard).filter(NuruCard.id == cid, NuruCard.user_id == current_user.id).first()
    if not card:
        return standard_response(False, "Card not found")
    card.status = "suspended"
    db.commit()
    return standard_response(True, "Card suspended")


@router.post("/{card_id}/reactivate")
def reactivate_card(card_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(card_id)
    except ValueError:
        return standard_response(False, "Invalid card ID")
    card = db.query(NuruCard).filter(NuruCard.id == cid, NuruCard.user_id == current_user.id).first()
    if not card:
        return standard_response(False, "Card not found")
    card.status = "active"
    db.commit()
    return standard_response(True, "Card reactivated")


@router.post("/{card_id}/replace")
def order_replacement(card_id: str, body: dict = Body(default={}), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.now(EAT)
    order = NuruCardOrder(id=uuid.uuid4(), user_id=current_user.id, card_type="replacement", status="pending", created_at=now, updated_at=now)
    db.add(order)
    db.commit()
    return standard_response(True, "Replacement card ordered", {"order_id": str(order.id)})


@router.post("/verify")
def verify_card(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    card_number = body.get("card_number", "").strip()
    if not card_number:
        return standard_response(False, "Card number is required")
    card = db.query(NuruCard).filter(NuruCard.card_number == card_number, NuruCard.status == "active").first()
    if not card:
        return standard_response(False, "Card not found or inactive")
    user = db.query(User).filter(User.id == card.user_id).first()
    return standard_response(True, "Card verified", {"card_id": str(card.id), "user_name": f"{user.first_name} {user.last_name}" if user else None, "card_type": card.card_type})


@router.post("/check-in")
def check_in_with_card(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    card_number = body.get("card_number", "").strip()
    event_id = body.get("event_id", "").strip()
    if not card_number or not event_id:
        return standard_response(False, "Card number and event ID are required")

    card = db.query(NuruCard).filter(NuruCard.card_number == card_number, NuruCard.status == "active").first()
    if not card:
        return standard_response(False, "Card not found or inactive")

    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")

    att = db.query(EventAttendee).filter(EventAttendee.event_id == eid, EventAttendee.attendee_id == card.user_id).first()
    if not att:
        return standard_response(False, "Guest not found for this event")

    if att.checked_in:
        return standard_response(False, "Already checked in")

    now = datetime.now(EAT)
    att.checked_in = True
    att.checked_in_at = now
    db.commit()

    user = db.query(User).filter(User.id == card.user_id).first()
    return standard_response(True, "Check-in successful", {"guest_name": f"{user.first_name} {user.last_name}" if user else None, "checked_in_at": now.isoformat()})


@router.get("/{card_id}/check-ins")
def get_check_in_history(card_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Check-in history retrieved", [])


@router.put("/{card_id}/design")
def update_card_design(card_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Card design updated")


@router.get("/{card_id}/benefits")
def get_card_benefits(card_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Benefits retrieved", {"benefits": ["Priority check-in at events", "Digital invitation cards", "QR code for seamless entry"]})
