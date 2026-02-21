import secrets
import traceback
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from models import (
    User, Event, EventTicketClass, EventTicket,
    TicketStatusEnum, TicketOrderStatusEnum, PaymentStatusEnum,
)
from utils.auth import get_current_user, get_optional_user
from utils.helpers import standard_response

router = APIRouter(prefix="/ticketing", tags=["Ticketing"])


# ──────────────────────────────────────────────
# Get ticket classes for an event (public)
# ──────────────────────────────────────────────
@router.get("/events/{event_id}/ticket-classes")
def get_ticket_classes(
    event_id: str,
    db: Session = Depends(get_db),
):
    """Get all ticket classes for a public ticketed event."""
    try:
        eid = UUID(event_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid event ID")

    event = db.query(Event).filter(Event.id == eid, Event.is_public == True, Event.sells_tickets == True).first()
    if not event:
        return standard_response(False, "Event not found or does not sell tickets")

    classes = db.query(EventTicketClass).filter(
        EventTicketClass.event_id == eid
    ).order_by(EventTicketClass.display_order).all()

    result = []
    for tc in classes:
        available = tc.quantity - tc.sold
        result.append({
            "id": str(tc.id),
            "name": tc.name,
            "description": tc.description,
            "price": float(tc.price),
            "quantity": tc.quantity,
            "sold": tc.sold,
            "available": available,
            "status": tc.status.value if tc.status else "available",
            "is_sold_out": available <= 0,
            "sale_start_date": str(tc.sale_start_date) if tc.sale_start_date else None,
            "sale_end_date": str(tc.sale_end_date) if tc.sale_end_date else None,
            "display_order": tc.display_order,
        })

    return standard_response(True, "Ticket classes retrieved", {
        "event_id": event_id,
        "event_name": event.name,
        "ticket_classes": result,
    })


# ──────────────────────────────────────────────
# Create/Update ticket classes (organizer)
# ──────────────────────────────────────────────
@router.post("/events/{event_id}/ticket-classes")
async def create_ticket_class(
    event_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new ticket class for an event."""
    try:
        eid = UUID(event_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid event ID")

    event = db.query(Event).filter(Event.id == eid, Event.organizer_id == current_user.id).first()
    if not event:
        return standard_response(False, "Event not found or you are not the organizer")

    payload = await request.json()
    name = payload.get("name", "").strip()
    price = payload.get("price")
    quantity = payload.get("quantity")
    description = payload.get("description", "").strip()

    if not name:
        return standard_response(False, "Ticket class name is required")
    if price is None or float(price) < 0:
        return standard_response(False, "Valid price is required")
    if not quantity or int(quantity) < 1:
        return standard_response(False, "Quantity must be at least 1")

    # Mark event as selling tickets
    event.sells_tickets = True
    event.is_public = True

    tc = EventTicketClass(
        event_id=eid,
        name=name,
        description=description,
        price=float(price),
        quantity=int(quantity),
        display_order=payload.get("display_order", 0),
        sale_start_date=payload.get("sale_start_date"),
        sale_end_date=payload.get("sale_end_date"),
    )
    db.add(tc)
    db.commit()
    db.refresh(tc)

    return standard_response(True, "Ticket class created", {"id": str(tc.id)})


@router.put("/ticket-classes/{class_id}")
async def update_ticket_class(
    class_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing ticket class."""
    try:
        cid = UUID(class_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid ticket class ID")

    tc = db.query(EventTicketClass).filter(EventTicketClass.id == cid).first()
    if not tc:
        return standard_response(False, "Ticket class not found")

    event = db.query(Event).filter(Event.id == tc.event_id, Event.organizer_id == current_user.id).first()
    if not event:
        return standard_response(False, "Not authorized")

    payload = await request.json()
    for field in ["name", "description", "price", "quantity", "display_order", "sale_start_date", "sale_end_date"]:
        if field in payload:
            if field == "price":
                setattr(tc, field, float(payload[field]))
            elif field == "quantity":
                new_qty = int(payload[field])
                if new_qty < tc.sold:
                    return standard_response(False, f"Cannot set quantity below {tc.sold} (already sold)")
                tc.quantity = new_qty
            else:
                setattr(tc, field, payload[field])

    if "status" in payload:
        try:
            tc.status = TicketStatusEnum(payload["status"])
        except (ValueError, KeyError):
            pass

    db.commit()
    return standard_response(True, "Ticket class updated")


@router.delete("/ticket-classes/{class_id}")
def delete_ticket_class(
    class_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a ticket class (only if no tickets sold)."""
    try:
        cid = UUID(class_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid ticket class ID")

    tc = db.query(EventTicketClass).filter(EventTicketClass.id == cid).first()
    if not tc:
        return standard_response(False, "Ticket class not found")

    event = db.query(Event).filter(Event.id == tc.event_id, Event.organizer_id == current_user.id).first()
    if not event:
        return standard_response(False, "Not authorized")

    if tc.sold > 0:
        return standard_response(False, "Cannot delete ticket class with sold tickets")

    db.delete(tc)
    db.commit()
    return standard_response(True, "Ticket class deleted")


# ──────────────────────────────────────────────
# Purchase tickets
# ──────────────────────────────────────────────
@router.post("/purchase")
async def purchase_ticket(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Purchase tickets for an event."""
    payload = await request.json()
    ticket_class_id = payload.get("ticket_class_id")
    quantity = int(payload.get("quantity", 1))

    if not ticket_class_id:
        return standard_response(False, "Ticket class ID is required")
    if quantity < 1:
        return standard_response(False, "Quantity must be at least 1")

    try:
        tcid = UUID(ticket_class_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid ticket class ID")

    tc = db.query(EventTicketClass).filter(EventTicketClass.id == tcid).first()
    if not tc:
        return standard_response(False, "Ticket class not found")

    available = tc.quantity - tc.sold
    if available < quantity:
        return standard_response(False, f"Only {available} tickets available for '{tc.name}'. You requested {quantity}.")

    total = float(tc.price) * quantity
    ticket_code = f"NTK-{secrets.token_hex(4).upper()}"

    ticket = EventTicket(
        ticket_class_id=tcid,
        event_id=tc.event_id,
        buyer_user_id=current_user.id,
        ticket_code=ticket_code,
        quantity=quantity,
        total_amount=total,
        buyer_name=f"{current_user.first_name} {current_user.last_name}",
        buyer_phone=current_user.phone,
        buyer_email=current_user.email,
        status=TicketOrderStatusEnum.confirmed,
        payment_status=PaymentStatusEnum.pending,
    )

    tc.sold += quantity
    if tc.sold >= tc.quantity:
        tc.status = TicketStatusEnum.sold_out

    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    return standard_response(True, "Ticket purchased successfully", {
        "ticket_id": str(ticket.id),
        "ticket_code": ticket_code,
        "quantity": quantity,
        "total_amount": total,
        "event_id": str(tc.event_id),
        "ticket_class": tc.name,
    })


# ──────────────────────────────────────────────
# Get my tickets
# ──────────────────────────────────────────────
@router.get("/my-tickets")
def get_my_tickets(
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all tickets purchased by the current user."""
    page = max(1, page)
    limit = max(1, min(limit, 50))
    offset = (page - 1) * limit

    query = db.query(EventTicket).filter(
        EventTicket.buyer_user_id == current_user.id
    ).order_by(EventTicket.created_at.desc())

    total = query.count()
    tickets = query.offset(offset).limit(limit).all()

    result = []
    for t in tickets:
        event = db.query(Event).filter(Event.id == t.event_id).first()
        tc = db.query(EventTicketClass).filter(EventTicketClass.id == t.ticket_class_id).first()
        result.append({
            "id": str(t.id),
            "ticket_code": t.ticket_code,
            "event": {
                "id": str(event.id) if event else None,
                "name": event.name if event else None,
                "start_date": str(event.start_date) if event and event.start_date else None,
                "location": event.location if event else None,
                "cover_image": event.cover_image_url if event else None,
            },
            "ticket_class": tc.name if tc else None,
            "quantity": t.quantity,
            "total_amount": float(t.total_amount),
            "status": t.status.value if t.status else "pending",
            "payment_status": t.payment_status.value if t.payment_status else "pending",
            "checked_in": t.checked_in,
            "created_at": str(t.created_at) if t.created_at else None,
        })

    return standard_response(True, "Tickets retrieved", {
        "tickets": result,
        "pagination": {
            "page": page, "limit": limit, "total_items": total,
            "total_pages": (total + limit - 1) // limit,
            "has_next": (page * limit) < total, "has_previous": page > 1
        }
    })


# ──────────────────────────────────────────────
# Get event tickets (organizer view)
# ──────────────────────────────────────────────
@router.get("/events/{event_id}/tickets")
def get_event_tickets(
    event_id: str,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all tickets sold for an event (organizer only)."""
    try:
        eid = UUID(event_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid event ID")

    event = db.query(Event).filter(Event.id == eid, Event.organizer_id == current_user.id).first()
    if not event:
        return standard_response(False, "Event not found or not authorized")

    page = max(1, page)
    limit = max(1, min(limit, 100))
    offset = (page - 1) * limit

    query = db.query(EventTicket).filter(EventTicket.event_id == eid).order_by(EventTicket.created_at.desc())
    total = query.count()
    tickets = query.offset(offset).limit(limit).all()

    result = []
    for t in tickets:
        tc = db.query(EventTicketClass).filter(EventTicketClass.id == t.ticket_class_id).first()
        result.append({
            "id": str(t.id),
            "ticket_code": t.ticket_code,
            "buyer_name": t.buyer_name,
            "buyer_phone": t.buyer_phone,
            "buyer_email": t.buyer_email,
            "ticket_class": tc.name if tc else None,
            "quantity": t.quantity,
            "total_amount": float(t.total_amount),
            "status": t.status.value if t.status else "pending",
            "payment_status": t.payment_status.value if t.payment_status else "pending",
            "checked_in": t.checked_in,
            "created_at": str(t.created_at) if t.created_at else None,
        })

    return standard_response(True, "Event tickets retrieved", {
        "tickets": result,
        "pagination": {
            "page": page, "limit": limit, "total_items": total,
            "total_pages": (total + limit - 1) // limit,
            "has_next": (page * limit) < total, "has_previous": page > 1
        }
    })


# ──────────────────────────────────────────────
# Get ticketed events (public, for right panel)
# ──────────────────────────────────────────────
@router.get("/events")
def get_ticketed_events(
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
):
    """Get all public events that sell tickets."""
    page = max(1, page)
    limit = max(1, min(limit, 50))
    offset = (page - 1) * limit

    query = db.query(Event).filter(
        Event.sells_tickets == True,
        Event.is_public == True,
    ).order_by(Event.start_date.asc())

    total = query.count()
    events = query.offset(offset).limit(limit).all()

    result = []
    for e in events:
        ticket_classes = db.query(EventTicketClass).filter(EventTicketClass.event_id == e.id).all()
        min_price = min([float(tc.price) for tc in ticket_classes], default=0) if ticket_classes else 0
        total_available = sum([(tc.quantity - tc.sold) for tc in ticket_classes]) if ticket_classes else 0

        result.append({
            "id": str(e.id),
            "name": e.name,
            "start_date": str(e.start_date) if e.start_date else None,
            "location": e.location,
            "cover_image": e.cover_image_url,
            "min_price": min_price,
            "total_available": total_available,
            "ticket_class_count": len(ticket_classes),
        })

    return standard_response(True, "Ticketed events retrieved", {
        "events": result,
        "pagination": {
            "page": page, "limit": limit, "total_items": total,
            "total_pages": (total + limit - 1) // limit,
            "has_next": (page * limit) < total, "has_previous": page > 1
        }
    })
