# Public Events Routes - /events/...
# Handles public event discovery, RSVP, and contribution pages

import math
import uuid
from datetime import datetime

import pytz
from fastapi import APIRouter, Depends, Body
from sqlalchemy import func as sa_func, or_
from sqlalchemy.orm import Session

from core.database import get_db
from models import (
    Event, EventType, EventImage, EventAttendee, EventInvitation,
    EventGuestPlusOne, EventSetting, EventContribution,
    EventContributionTarget, EventVenueCoordinate, Currency, User,
    EventCommitteeMember, RSVPStatusEnum, UserContributor, GuestTypeEnum,
)
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")

router = APIRouter(prefix="/events", tags=["Public Events"])


# ──────────────────────────────────────────────
# Shared helpers
# ──────────────────────────────────────────────

def _currency_code(db: Session, currency_id) -> str | None:
    if not currency_id:
        return None
    cur = db.query(Currency).filter(Currency.id == currency_id).first()
    return cur.code.strip() if cur else None


def _public_event_dict(db: Session, event: Event) -> dict:
    """Build a public-safe event summary."""
    event_type = db.query(EventType).filter(EventType.id == event.event_type_id).first()
    vc = db.query(EventVenueCoordinate).filter(EventVenueCoordinate.event_id == event.id).first()
    settings = db.query(EventSetting).filter(EventSetting.event_id == event.id).first()

    images = (
        db.query(EventImage).filter(EventImage.event_id == event.id)
        .order_by(EventImage.is_featured.desc(), EventImage.created_at.asc()).all()
    )
    images_list = [{"id": str(img.id), "image_url": img.image_url, "is_featured": img.is_featured} for img in images]

    cover = event.cover_image_url
    if not cover:
        for img in images_list:
            if img["is_featured"]:
                cover = img["image_url"]
                break
        if not cover and images_list:
            cover = images_list[0]["image_url"]

    guest_count = db.query(sa_func.count(EventAttendee.id)).filter(EventAttendee.event_id == event.id).scalar() or 0
    organizer = db.query(User).filter(User.id == event.organizer_id).first()

    return {
        "id": str(event.id),
        "title": event.name,
        "description": event.description,
        "event_type": {
            "id": str(event_type.id), "name": event_type.name, "icon": event_type.icon
        } if event_type else None,
        "start_date": event.start_date.isoformat() if event.start_date else None,
        "start_time": event.start_time.strftime("%H:%M") if event.start_time else None,
        "end_date": event.end_date.isoformat() if event.end_date else None,
        "location": event.location,
        "venue": vc.venue_name if vc else None,
        "venue_address": vc.formatted_address if vc else None,
        "cover_image": cover,
        "images": images_list,
        "theme_color": event.theme_color,
        "dress_code": event.dress_code,
        "special_instructions": event.special_instructions,
        "guest_count": guest_count,
        "organizer": {
            "name": f"{organizer.first_name} {organizer.last_name}" if organizer else None,
        },
        "status": "published" if (event.status.value if hasattr(event.status, "value") else event.status) == "confirmed" else (event.status.value if hasattr(event.status, "value") else event.status),
        "created_at": event.created_at.isoformat() if event.created_at else None,
    }


# ──────────────────────────────────────────────
# Search/Discover Public Events
# ──────────────────────────────────────────────
@router.get("/")
def search_events(
    q: str = None,
    event_type_id: str = None,
    location: str = None,
    start_after: str = None,
    start_before: str = None,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """Searches and filters public events."""
    from models import EventStatusEnum

    query = db.query(Event).filter(Event.is_public == True, Event.status == EventStatusEnum.confirmed)

    if q:
        search = f"%{q}%"
        query = query.filter(or_(Event.name.ilike(search), Event.description.ilike(search)))

    if event_type_id:
        try:
            query = query.filter(Event.event_type_id == uuid.UUID(event_type_id))
        except ValueError:
            pass

    if location:
        query = query.filter(Event.location.ilike(f"%{location}%"))

    if start_after:
        try:
            query = query.filter(Event.start_date >= datetime.fromisoformat(start_after.replace("Z", "+00:00")).date())
        except ValueError:
            pass

    if start_before:
        try:
            query = query.filter(Event.start_date <= datetime.fromisoformat(start_before.replace("Z", "+00:00")).date())
        except ValueError:
            pass

    query = query.order_by(Event.start_date.asc())

    total = query.count()
    total_pages = max(1, math.ceil(total / limit))
    events = query.offset((page - 1) * limit).limit(limit).all()

    return standard_response(True, "Public events retrieved successfully", {
        "events": [_public_event_dict(db, e) for e in events],
        "pagination": {
            "page": page, "limit": limit, "total_items": total,
            "total_pages": total_pages, "has_next": page < total_pages, "has_previous": page > 1,
        },
    })


# ──────────────────────────────────────────────
# Get Featured/Trending Events
# ──────────────────────────────────────────────
@router.get("/featured")
def get_featured_events(limit: int = 10, db: Session = Depends(get_db)):
    """Returns featured/trending public events."""
    from models import EventStatusEnum, PromotedEvent

    # Promoted events first, then by guest count
    promoted_ids = [
        r[0] for r in db.query(PromotedEvent.event_id)
        .filter(PromotedEvent.is_active == True).all()
    ]

    query = db.query(Event).filter(Event.is_public == True, Event.status == EventStatusEnum.confirmed)

    if promoted_ids:
        events = query.filter(Event.id.in_(promoted_ids)).limit(limit).all()
        if len(events) < limit:
            remaining = query.filter(~Event.id.in_(promoted_ids)).order_by(Event.created_at.desc()).limit(limit - len(events)).all()
            events.extend(remaining)
    else:
        events = query.order_by(Event.created_at.desc()).limit(limit).all()

    return standard_response(True, "Featured events retrieved successfully", [_public_event_dict(db, e) for e in events])


# ──────────────────────────────────────────────
# Get Nearby Events
# ──────────────────────────────────────────────
@router.get("/nearby")
def get_nearby_events(
    latitude: float = 0,
    longitude: float = 0,
    radius_km: float = 50,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """Returns events near a location."""
    from models import EventStatusEnum

    # Simple bounding box filter (~1 degree ≈ 111km)
    degree_offset = radius_km / 111.0

    event_ids = (
        db.query(EventVenueCoordinate.event_id)
        .filter(
            EventVenueCoordinate.latitude.between(latitude - degree_offset, latitude + degree_offset),
            EventVenueCoordinate.longitude.between(longitude - degree_offset, longitude + degree_offset),
        ).all()
    )
    ids = [r[0] for r in event_ids]

    if not ids:
        return standard_response(True, "No nearby events found", [])

    events = (
        db.query(Event)
        .filter(Event.id.in_(ids), Event.is_public == True, Event.status == EventStatusEnum.confirmed)
        .order_by(Event.start_date.asc())
        .limit(limit).all()
    )

    return standard_response(True, "Nearby events retrieved successfully", [_public_event_dict(db, e) for e in events])


# ──────────────────────────────────────────────
# Get Public Event Details
# ──────────────────────────────────────────────
@router.get("/{event_id}")
def get_public_event(event_id: str, db: Session = Depends(get_db)):
    """Returns public details of an event."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    if not event.is_public:
        return standard_response(False, "This event is not publicly visible")

    data = _public_event_dict(db, event)

    # Add contribution info if enabled
    settings = db.query(EventSetting).filter(EventSetting.event_id == eid).first()
    if settings and settings.contributions_enabled:
        ct = db.query(EventContributionTarget).filter(EventContributionTarget.event_id == eid).first()
        target = float(ct.target_amount) if ct else (float(settings.contribution_target_amount) if settings.contribution_target_amount else 0)
        current = float(db.query(sa_func.coalesce(sa_func.sum(EventContribution.amount), 0)).filter(EventContribution.event_id == eid).scalar())

        data["contribution_info"] = {
            "enabled": True,
            "target_amount": target,
            "current_amount": current,
            "progress_percentage": round((current / target * 100), 1) if target > 0 else 0,
            "currency": _currency_code(db, event.currency_id),
        }

    # Show schedule if public
    if settings and settings.show_committee:
        from models import EventScheduleItem
        schedule = db.query(EventScheduleItem).filter(EventScheduleItem.event_id == eid).order_by(EventScheduleItem.display_order.asc()).all()
        data["schedule"] = [{
            "title": si.title, "description": si.description,
            "start_time": si.start_time.isoformat() if si.start_time else None,
            "end_time": si.end_time.isoformat() if si.end_time else None,
        } for si in schedule]

    return standard_response(True, "Event retrieved successfully", data)


# ──────────────────────────────────────────────
# Get RSVP Page (Public)
# ──────────────────────────────────────────────
@router.get("/{event_id}/rsvp/{guest_id}")
def get_rsvp_page(event_id: str, guest_id: str, token: str = "", db: Session = Depends(get_db)):
    """Returns event details for the public RSVP page."""
    try:
        eid = uuid.UUID(event_id)
        gid = uuid.UUID(guest_id)
    except ValueError:
        return standard_response(False, "Invalid ID format")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    att = db.query(EventAttendee).filter(EventAttendee.id == gid, EventAttendee.event_id == eid).first()
    if not att:
        return standard_response(False, "Guest record not found")

    invitation = db.query(EventInvitation).filter(EventInvitation.id == att.invitation_id).first() if att.invitation_id else None
    if invitation and token and invitation.invitation_code != token:
        return standard_response(False, "Invalid RSVP token")

    settings = db.query(EventSetting).filter(EventSetting.event_id == eid).first()
    organizer = db.query(User).filter(User.id == event.organizer_id).first()
    vc = db.query(EventVenueCoordinate).filter(EventVenueCoordinate.event_id == eid).first()

    # Resolve guest name based on guest type
    guest_type = att.guest_type.value if hasattr(att.guest_type, "value") else (att.guest_type or "user")
    guest_name = None
    if guest_type == "contributor":
        if att.contributor_id:
            contributor = db.query(UserContributor).filter(UserContributor.id == att.contributor_id).first()
            guest_name = contributor.name if contributor else att.guest_name
        else:
            guest_name = att.guest_name
    else:
        user = db.query(User).filter(User.id == att.attendee_id).first() if att.attendee_id else None
        guest_name = f"{user.first_name} {user.last_name}" if user else att.guest_name

    return standard_response(True, "RSVP page retrieved", {
        "event": {
            "id": str(event.id),
            "title": event.name,
            "description": event.description,
            "start_date": event.start_date.isoformat() if event.start_date else None,
            "start_time": event.start_time.strftime("%H:%M") if event.start_time else None,
            "location": event.location,
            "venue": vc.venue_name if vc else None,
            "cover_image": event.cover_image_url,
            "theme_color": event.theme_color,
            "dress_code": event.dress_code,
            "special_instructions": event.special_instructions,
            "organizer_name": f"{organizer.first_name} {organizer.last_name}" if organizer else None,
        },
        "guest": {
            "id": str(att.id),
            "name": guest_name,
            "guest_type": guest_type,
            "rsvp_status": att.rsvp_status.value if hasattr(att.rsvp_status, "value") else att.rsvp_status,
        },
        "rsvp_settings": {
            "rsvp_enabled": settings.rsvp_enabled if settings else True,
            "rsvp_deadline": settings.rsvp_deadline.isoformat() if settings and settings.rsvp_deadline else None,
            "allow_plus_ones": settings.allow_plus_ones if settings else False,
            "max_plus_ones": settings.max_plus_ones if settings else 1,
            "require_meal_preference": settings.require_meal_preference if settings else False,
            "meal_options": settings.meal_options if settings else [],
        },
        "invitation_code": invitation.invitation_code if invitation else None,
    })


# ──────────────────────────────────────────────
# Submit RSVP (Public)
# ──────────────────────────────────────────────
@router.post("/{event_id}/rsvp")
def submit_rsvp(event_id: str, body: dict = Body(...), db: Session = Depends(get_db)):
    """Allows guests to respond to their invitation."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    guest_id = body.get("guest_id")
    token = body.get("token")
    rsvp_status = body.get("rsvp_status")

    if not guest_id or not token or not rsvp_status:
        return standard_response(False, "guest_id, token, and rsvp_status are required")

    try:
        gid = uuid.UUID(guest_id)
    except ValueError:
        return standard_response(False, "Invalid guest ID format")

    att = db.query(EventAttendee).filter(EventAttendee.id == gid, EventAttendee.event_id == eid).first()
    if not att:
        return standard_response(False, "Guest not found")

    invitation = db.query(EventInvitation).filter(EventInvitation.id == att.invitation_id).first() if att.invitation_id else None
    if not invitation or invitation.invitation_code != token:
        return standard_response(False, "Invalid or expired RSVP token")

    settings = db.query(EventSetting).filter(EventSetting.event_id == eid).first()
    if settings and settings.rsvp_deadline and settings.rsvp_deadline < datetime.now(EAT):
        return standard_response(False, "RSVP deadline has passed")

    now = datetime.now(EAT)
    att.rsvp_status = rsvp_status
    att.updated_at = now

    if "dietary_requirements" in body:
        att.dietary_restrictions = body["dietary_requirements"]
    if "meal_preference" in body:
        att.meal_preference = body["meal_preference"]

    # Handle plus ones
    if "plus_one_names" in body:
        db.query(EventGuestPlusOne).filter(EventGuestPlusOne.attendee_id == att.id).delete()
        for po_name in body.get("plus_one_names", []):
            db.add(EventGuestPlusOne(id=uuid.uuid4(), attendee_id=att.id, name=po_name, created_at=now, updated_at=now))

    invitation.rsvp_status = rsvp_status
    invitation.rsvp_at = now
    invitation.updated_at = now

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to record RSVP: {str(e)}")

    return standard_response(True, "RSVP recorded successfully", {
        "event": {"id": str(event.id), "title": event.name, "start_date": event.start_date.isoformat() if event.start_date else None, "location": event.location},
        "rsvp_status": rsvp_status,
    })


# ──────────────────────────────────────────────
# Public Contribution Page
# ──────────────────────────────────────────────
@router.get("/{event_id}/contribute")
def public_contribution_page(event_id: str, db: Session = Depends(get_db)):
    """Returns contribution page data for a public event."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    settings = db.query(EventSetting).filter(EventSetting.event_id == eid).first()
    ct = db.query(EventContributionTarget).filter(EventContributionTarget.event_id == eid).first()
    target = float(ct.target_amount) if ct else (float(settings.contribution_target_amount) if settings and settings.contribution_target_amount else 0)
    current = float(db.query(sa_func.coalesce(sa_func.sum(EventContribution.amount), 0)).filter(EventContribution.event_id == eid).scalar())
    count = db.query(sa_func.count(EventContribution.id)).filter(EventContribution.event_id == eid).scalar()

    organizer = db.query(User).filter(User.id == event.organizer_id).first()

    return standard_response(True, "Contribution page retrieved", {
        "event": {
            "id": str(event.id), "title": event.name, "cover_image": event.cover_image_url,
            "start_date": event.start_date.isoformat() if event.start_date else None,
            "host_names": f"{organizer.first_name} {organizer.last_name}" if organizer else None,
        },
        "contribution_info": {
            "enabled": settings.contributions_enabled if settings else False,
            "description": ct.description if ct else None,
            "target_amount": target, "current_amount": current,
            "progress_percentage": round((current / target * 100), 1) if target > 0 else 0,
            "contributor_count": count,
            "currency": _currency_code(db, event.currency_id),
        },
    })


# ──────────────────────────────────────────────
# Submit Public Contribution
# ──────────────────────────────────────────────
@router.post("/{event_id}/contribute")
def submit_public_contribution(event_id: str, body: dict = Body(...), db: Session = Depends(get_db)):
    """Submit a contribution to an event (no auth required)."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    amount = body.get("amount")
    if not amount or float(amount) <= 0:
        return standard_response(False, "Amount must be greater than 0")

    now = datetime.now(EAT)
    c = EventContribution(
        id=uuid.uuid4(), event_id=eid,
        contributor_name=body.get("contributor_name"),
        contributor_contact={"email": body.get("contributor_email"), "phone": body.get("contributor_phone")},
        amount=float(amount),
        payment_method=body.get("payment_method", "mobile"),
        contributed_at=now, created_at=now,
    )
    db.add(c)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to record contribution: {str(e)}")

    return standard_response(True, "Contribution recorded successfully", {
        "contribution_id": str(c.id), "payment_method": body.get("payment_method", "mobile"), "status": "pending",
    })


# ──────────────────────────────────────────────
# Accept Committee Invitation (Public)
# ──────────────────────────────────────────────
@router.post("/committee/accept")
def accept_committee_invitation(body: dict = Body(...), db: Session = Depends(get_db)):
    """Accepts a committee member invitation via token."""
    token = body.get("token")
    user_id = body.get("user_id")

    if not token:
        return standard_response(False, "Token is required")

    # Placeholder: decode token to find the committee membership
    return standard_response(True, "Invitation accepted successfully", {
        "message": "You have been added to the event committee",
    })
