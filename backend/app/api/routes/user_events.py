# User Events Routes - /user-events/...
# Handles event management for authenticated users

import json
import math
import os
import re
import uuid
from datetime import datetime
from typing import List, Optional

import httpx
import pytz
from fastapi import APIRouter, Depends, File, Form, UploadFile, Body
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from core.config import ALLOWED_IMAGE_EXTENSIONS, MAX_EVENT_IMAGES, MAX_IMAGE_SIZE, UPLOAD_SERVICE_URL
from core.database import get_db
from models import (
    Event, EventType, EventImage, EventVenueCoordinate, EventSetting,
    EventCommitteeMember, CommitteeRole, CommitteePermission,
    EventContributionTarget, EventContributor, EventContribution,
    ContributionThankYouMessage, UserContributor,
    EventInvitation, EventAttendee, EventGuestPlusOne,
    EventService, EventServicePayment, EventScheduleItem, EventBudgetItem,
    Currency, User, UserProfile, ServiceType, UserService,
    EventServiceStatusEnum, EventStatusEnum, PaymentMethodEnum, RSVPStatusEnum,
    EventTypeService, ServicePackage,
)
from utils.auth import get_current_user
from utils.helpers import format_price, standard_response
from utils.sms import (
    sms_guest_added, sms_committee_invite, sms_contribution_recorded,
    sms_contribution_target_set, sms_thank_you, sms_booking_notification,
)

EAT = pytz.timezone("Africa/Nairobi")
HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
VALID_STATUS_FILTERS = {"draft", "confirmed", "cancelled", "completed", "all"}

router = APIRouter(prefix="/user-events", tags=["User Events"])


# ──────────────────────────────────────────────
# Shared Helpers
# ──────────────────────────────────────────────

def _currency_code(db: Session, currency_id) -> str | None:
    if not currency_id:
        return None
    cur = db.query(Currency).filter(Currency.id == currency_id).first()
    return cur.code.strip() if cur else None


def _event_images(db: Session, event_id) -> list[dict]:
    rows = db.query(EventImage).filter(EventImage.event_id == event_id).order_by(EventImage.is_featured.desc(), EventImage.created_at.asc()).all()
    return [{"id": str(img.id), "image_url": img.image_url, "caption": img.caption, "is_featured": img.is_featured, "created_at": img.created_at.isoformat() if img.created_at else None} for img in rows]


def _pick_cover_image(event, images: list[dict]) -> str | None:
    if event.cover_image_url:
        return event.cover_image_url
    for img in images:
        if img.get("is_featured"):
            return img["image_url"]
    if images:
        return images[0]["image_url"]
    return None


def _guest_counts(db: Session, event_id) -> dict:
    rows = db.query(EventAttendee.rsvp_status, sa_func.count(EventAttendee.id)).filter(EventAttendee.event_id == event_id).group_by(EventAttendee.rsvp_status).all()
    counts = {r.value: 0 for r in RSVPStatusEnum}
    total = 0
    for status, cnt in rows:
        key = status.value if hasattr(status, "value") else status
        counts[key] = cnt
        total += cnt
    checked_in = db.query(sa_func.count(EventAttendee.id)).filter(EventAttendee.event_id == event_id, EventAttendee.checked_in == True).scalar() or 0
    return {"guest_count": total, "confirmed_guest_count": counts.get("confirmed", 0), "pending_guest_count": counts.get("pending", 0), "declined_guest_count": counts.get("declined", 0), "checked_in_count": checked_in}


def _contribution_summary(db: Session, event_id) -> dict:
    result = db.query(sa_func.coalesce(sa_func.sum(EventContribution.amount), 0), sa_func.count(EventContribution.id)).filter(EventContribution.event_id == event_id).first()
    return {"contribution_total": float(result[0]), "contribution_count": result[1]}


def _event_summary(db: Session, event: Event) -> dict:
    event_type = db.query(EventType).filter(EventType.id == event.event_type_id).first()
    gc = _guest_counts(db, event.id)
    cs = _contribution_summary(db, event.id)
    settings = db.query(EventSetting).filter(EventSetting.event_id == event.id).first()
    vc = db.query(EventVenueCoordinate).filter(EventVenueCoordinate.event_id == event.id).first()
    committee_count = db.query(sa_func.count(EventCommitteeMember.id)).filter(EventCommitteeMember.event_id == event.id).scalar() or 0
    service_count = db.query(sa_func.count(EventService.id)).filter(EventService.event_id == event.id).scalar() or 0
    images = _event_images(db, event.id)

    contribution_target = 0
    ct = db.query(EventContributionTarget).filter(EventContributionTarget.event_id == event.id).first()
    if settings and settings.contribution_target_amount:
        contribution_target = float(settings.contribution_target_amount)
    elif ct:
        contribution_target = float(ct.target_amount)

    return {
        "id": str(event.id), "user_id": str(event.organizer_id), "title": event.name,
        "description": event.description,
        "event_type_id": str(event.event_type_id) if event.event_type_id else None,
        "event_type": {"id": str(event_type.id), "name": event_type.name, "icon": event_type.icon} if event_type else None,
        "start_date": event.start_date.isoformat() if event.start_date else None,
        "start_time": event.start_time.strftime("%H:%M") if event.start_time else None,
        "end_date": event.end_date.isoformat() if event.end_date else None,
        "end_time": event.end_time.strftime("%H:%M") if event.end_time else None,
        "location": event.location,
        "venue": vc.venue_name if vc else None,
        "venue_address": vc.formatted_address if vc else None,
        "venue_coordinates": {"latitude": float(vc.latitude), "longitude": float(vc.longitude)} if vc and vc.latitude else None,
        "cover_image": _pick_cover_image(event, images), "images": images,
        "theme_color": event.theme_color, "is_public": event.is_public,
        "status": "published" if (event.status.value if hasattr(event.status, "value") else event.status) == "confirmed" else (event.status.value if hasattr(event.status, "value") else event.status),
        "budget": float(event.budget) if event.budget else None,
        "currency": _currency_code(db, event.currency_id),
        "dress_code": event.dress_code, "special_instructions": event.special_instructions,
        "rsvp_deadline": settings.rsvp_deadline.isoformat() if settings and settings.rsvp_deadline else None,
        "contribution_enabled": settings.contributions_enabled if settings else False,
        "contribution_target": contribution_target,
        "contribution_description": ct.description if ct else None,
        "expected_guests": event.expected_guests,
        **gc, **cs,
        "committee_count": committee_count, "service_booking_count": service_count,
        "created_at": event.created_at.isoformat() if event.created_at else None,
        "updated_at": event.updated_at.isoformat() if event.updated_at else None,
    }


async def _upload_image(file: UploadFile, target_folder: str) -> dict:
    _, ext = os.path.splitext(file.filename or "unknown.jpg")
    ext = ext.lower().replace(".", "")
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return {"success": False, "url": None, "error": f"File '{file.filename}' has invalid format."}
    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        return {"success": False, "url": None, "error": f"File '{file.filename}' exceeds maximum size."}
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(UPLOAD_SERVICE_URL, data={"target_path": target_folder}, files={"file": (unique_name, content, file.content_type)}, timeout=20)
        except Exception as e:
            return {"success": False, "url": None, "error": f"Upload failed: {str(e)}"}
    if resp.status_code != 200:
        return {"success": False, "url": None, "error": f"Upload service returned {resp.status_code}."}
    result = resp.json()
    if not result.get("success"):
        return {"success": False, "url": None, "error": result.get("message", "Upload failed.")}
    return {"success": True, "url": result["data"]["url"], "error": None}


def _verify_event_access(db: Session, event_id, current_user):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        return None, standard_response(False, "Event not found")
    if str(event.organizer_id) != str(current_user.id):
        cm = db.query(EventCommitteeMember).filter(EventCommitteeMember.event_id == event_id, EventCommitteeMember.user_id == current_user.id).first()
        if not cm:
            return None, standard_response(False, "You do not have permission to access this event")
    return event, None


PERMISSION_FIELDS = [
    "can_view_guests", "can_manage_guests", "can_send_invitations", "can_check_in_guests",
    "can_view_budget", "can_manage_budget", "can_view_contributions", "can_manage_contributions",
    "can_view_vendors", "can_manage_vendors", "can_approve_bookings", "can_edit_event", "can_manage_committee",
]

PERMISSION_MAP = {
    "view_guests": "can_view_guests", "manage_guests": "can_manage_guests",
    "send_invitations": "can_send_invitations", "checkin_guests": "can_check_in_guests",
    "view_budget": "can_view_budget", "manage_budget": "can_manage_budget",
    "view_contributions": "can_view_contributions", "manage_contributions": "can_manage_contributions",
    "view_vendors": "can_view_vendors", "manage_vendors": "can_manage_vendors",
    "approve_bookings": "can_approve_bookings", "edit_event": "can_edit_event",
    "manage_committee": "can_manage_committee",
}


# ──────────────────────────────────────────────
# Get All User Events
# ──────────────────────────────────────────────
@router.get("/")
def get_all_user_events(
    page: int = 1, limit: int = 20, status: str = "all",
    sort_by: str = "created_at", sort_order: str = "desc",
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    """Returns all events created by the authenticated user."""
    if status not in VALID_STATUS_FILTERS:
        return standard_response(False, f"Invalid status filter. Must be one of: {', '.join(VALID_STATUS_FILTERS)}")

    query = db.query(Event).filter(Event.organizer_id == current_user.id)

    if status != "all":
        mapped = "confirmed" if status == "published" else status
        if hasattr(EventStatusEnum, mapped):
            query = query.filter(Event.status == getattr(EventStatusEnum, mapped))

    sort_col = {"created_at": Event.created_at, "start_date": Event.start_date, "title": Event.name}.get(sort_by, Event.created_at)
    query = query.order_by(sort_col.desc() if sort_order == "desc" else sort_col.asc())

    total = query.count()
    total_pages = max(1, math.ceil(total / limit))
    events = query.offset((page - 1) * limit).limit(limit).all()

    return standard_response(True, "Events retrieved successfully", {
        "events": [_event_summary(db, ev) for ev in events],
        "pagination": {"page": page, "limit": limit, "total_items": total, "total_pages": total_pages, "has_next": page < total_pages, "has_previous": page > 1},
    })


# ──────────────────────────────────────────────
# Get Events Where User Is Invited
# ──────────────────────────────────────────────
@router.get("/invited")
def get_invited_events(
    page: int = 1, limit: int = 20,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    """Returns events the current user has been invited to, with RSVP status."""
    invitations = (
        db.query(EventInvitation)
        .filter(EventInvitation.invited_user_id == current_user.id)
        .order_by(EventInvitation.created_at.desc())
        .all()
    )

    event_ids = [inv.event_id for inv in invitations]
    if not event_ids:
        return standard_response(True, "No event invitations found", {"events": [], "pagination": {"page": 1, "limit": limit, "total_items": 0, "total_pages": 1, "has_next": False, "has_previous": False}})

    inv_map = {inv.event_id: inv for inv in invitations}

    total = len(event_ids)
    total_pages = max(1, math.ceil(total / limit))
    paged_ids = event_ids[(page - 1) * limit : page * limit]

    events = db.query(Event).filter(Event.id.in_(paged_ids)).all()
    event_order = {eid: i for i, eid in enumerate(paged_ids)}
    events.sort(key=lambda e: event_order.get(e.id, 0))

    results = []
    for ev in events:
        inv = inv_map.get(ev.id)
        event_type = db.query(EventType).filter(EventType.id == ev.event_type_id).first()
        vc = db.query(EventVenueCoordinate).filter(EventVenueCoordinate.event_id == ev.id).first()
        organizer = db.query(User).filter(User.id == ev.organizer_id).first()

        attendee = db.query(EventAttendee).filter(
            EventAttendee.event_id == ev.id, EventAttendee.attendee_id == current_user.id
        ).first()

        results.append({
            "id": str(ev.id),
            "title": ev.name,
            "description": ev.description,
            "event_type": {"id": str(event_type.id), "name": event_type.name, "icon": event_type.icon} if event_type else None,
            "start_date": ev.start_date.isoformat() if ev.start_date else None,
            "start_time": ev.start_time.strftime("%H:%M") if ev.start_time else None,
            "end_date": ev.end_date.isoformat() if ev.end_date else None,
            "location": ev.location,
            "venue": vc.venue_name if vc else None,
            "cover_image": ev.cover_image_url,
            "theme_color": ev.theme_color,
            "organizer": {"name": f"{organizer.first_name} {organizer.last_name}"} if organizer else None,
            "status": "published" if (ev.status.value if hasattr(ev.status, "value") else ev.status) == "confirmed" else (ev.status.value if hasattr(ev.status, "value") else ev.status),
            "invitation": {
                "id": str(inv.id) if inv else None,
                "rsvp_status": inv.rsvp_status.value if inv and hasattr(inv.rsvp_status, "value") else (inv.rsvp_status if inv else None),
                "invitation_code": inv.invitation_code if inv else None,
                "invited_at": inv.invited_at.isoformat() if inv and inv.invited_at else None,
                "rsvp_at": inv.rsvp_at.isoformat() if inv and inv.rsvp_at else None,
            },
            "attendee_id": str(attendee.id) if attendee else None,
        })

    return standard_response(True, "Invited events retrieved successfully", {
        "events": results,
        "pagination": {"page": page, "limit": limit, "total_items": total, "total_pages": total_pages, "has_next": page < total_pages, "has_previous": page > 1},
    })


# ──────────────────────────────────────────────
# Get Events Where User Is Committee Member
# ──────────────────────────────────────────────
@router.get("/committee")
def get_committee_events(
    page: int = 1, limit: int = 20,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    """Returns events where the current user is a committee member, with role and permissions."""
    memberships = (
        db.query(EventCommitteeMember)
        .filter(EventCommitteeMember.user_id == current_user.id)
        .order_by(EventCommitteeMember.created_at.desc())
        .all()
    )

    if not memberships:
        return standard_response(True, "You are not a committee member of any events", {"events": [], "pagination": {"page": 1, "limit": limit, "total_items": 0, "total_pages": 1, "has_next": False, "has_previous": False}})

    total = len(memberships)
    total_pages = max(1, math.ceil(total / limit))
    paged = memberships[(page - 1) * limit : page * limit]

    results = []
    for cm in paged:
        ev = db.query(Event).filter(Event.id == cm.event_id).first()
        if not ev:
            continue

        event_type = db.query(EventType).filter(EventType.id == ev.event_type_id).first()
        vc = db.query(EventVenueCoordinate).filter(EventVenueCoordinate.event_id == ev.id).first()
        organizer = db.query(User).filter(User.id == ev.organizer_id).first()
        role = db.query(CommitteeRole).filter(CommitteeRole.id == cm.role_id).first() if cm.role_id else None
        perms = db.query(CommitteePermission).filter(CommitteePermission.committee_member_id == cm.id).first()

        perm_dict = {}
        if perms:
            for field in PERMISSION_FIELDS:
                perm_dict[field] = getattr(perms, field, False)

        gc = _guest_counts(db, ev.id)

        results.append({
            "id": str(ev.id),
            "title": ev.name,
            "description": ev.description,
            "event_type": {"id": str(event_type.id), "name": event_type.name, "icon": event_type.icon} if event_type else None,
            "start_date": ev.start_date.isoformat() if ev.start_date else None,
            "start_time": ev.start_time.strftime("%H:%M") if ev.start_time else None,
            "end_date": ev.end_date.isoformat() if ev.end_date else None,
            "location": ev.location,
            "venue": vc.venue_name if vc else None,
            "cover_image": ev.cover_image_url,
            "theme_color": ev.theme_color,
            "organizer": {"name": f"{organizer.first_name} {organizer.last_name}"} if organizer else None,
            "status": "published" if (ev.status.value if hasattr(ev.status, "value") else ev.status) == "confirmed" else (ev.status.value if hasattr(ev.status, "value") else ev.status),
            "committee_membership": {
                "id": str(cm.id),
                "role": role.role_name if role else None,
                "role_description": role.description if role else None,
                "assigned_at": cm.assigned_at.isoformat() if cm.assigned_at else None,
                "permissions": perm_dict,
            },
            **gc,
        })

    return standard_response(True, "Committee events retrieved successfully", {
        "events": results,
        "pagination": {"page": page, "limit": limit, "total_items": total, "total_pages": total_pages, "has_next": page < total_pages, "has_previous": page > 1},
    })


# ──────────────────────────────────────────────
# Get Digital Invitation Card (Printable)
# ──────────────────────────────────────────────
@router.get("/{event_id}/invitation-card")
def get_invitation_card(
    event_id: str,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    """Returns all data needed to render and print a digital invitation card with QR code."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    invitation = db.query(EventInvitation).filter(
        EventInvitation.event_id == eid, EventInvitation.invited_user_id == current_user.id
    ).first()
    if not invitation:
        return standard_response(False, "You do not have an invitation for this event")

    attendee = db.query(EventAttendee).filter(
        EventAttendee.event_id == eid, EventAttendee.attendee_id == current_user.id
    ).first()

    event_type = db.query(EventType).filter(EventType.id == event.event_type_id).first()
    vc = db.query(EventVenueCoordinate).filter(EventVenueCoordinate.event_id == eid).first()
    organizer = db.query(User).filter(User.id == event.organizer_id).first()
    settings = db.query(EventSetting).filter(EventSetting.event_id == eid).first()

    qr_data = f"nuru://event/{event_id}/checkin/{str(attendee.id)}" if attendee else f"nuru://event/{event_id}/rsvp/{invitation.invitation_code}"

    return standard_response(True, "Invitation card retrieved successfully", {
        "event": {
            "id": str(event.id),
            "title": event.name,
            "description": event.description,
            "event_type": event_type.name if event_type else None,
            "start_date": event.start_date.isoformat() if event.start_date else None,
            "start_time": event.start_time.strftime("%H:%M") if event.start_time else None,
            "end_date": event.end_date.isoformat() if event.end_date else None,
            "location": event.location,
            "venue": vc.venue_name if vc else None,
            "venue_address": vc.formatted_address if vc else None,
            "cover_image": event.cover_image_url,
            "theme_color": event.theme_color,
            "dress_code": event.dress_code,
            "special_instructions": event.special_instructions,
        },
        "guest": {
            "name": f"{current_user.first_name} {current_user.last_name}",
            "attendee_id": str(attendee.id) if attendee else None,
            "rsvp_status": (attendee.rsvp_status.value if hasattr(attendee.rsvp_status, "value") else attendee.rsvp_status) if attendee else (invitation.rsvp_status.value if hasattr(invitation.rsvp_status, "value") else invitation.rsvp_status),
            "meal_preference": attendee.meal_preference if attendee else None,
        },
        "organizer": {
            "name": f"{organizer.first_name} {organizer.last_name}" if organizer else None,
        },
        "invitation_code": invitation.invitation_code,
        "qr_code_data": qr_data,
        "rsvp_deadline": settings.rsvp_deadline.isoformat() if settings and settings.rsvp_deadline else None,
    })



# ──────────────────────────────────────────────
# Get Single Event (Detailed)
# ──────────────────────────────────────────────
@router.get("/{event_id}")
def get_event(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns detailed information about a specific event."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    is_owner = str(event.organizer_id) == str(current_user.id)
    is_committee = False
    if not is_owner:
        cm = db.query(EventCommitteeMember).filter(EventCommitteeMember.event_id == eid, EventCommitteeMember.user_id == current_user.id).first()
        is_committee = cm is not None

    if not is_owner and not is_committee and not event.is_public:
        return standard_response(False, "You do not have permission to view this event")

    data = _event_summary(db, event)

    # Guests
    attendees = db.query(EventAttendee).filter(EventAttendee.event_id == eid).all()
    data["guests"] = [_attendee_dict(db, att) for att in attendees]

    # Committee
    cms = db.query(EventCommitteeMember).filter(EventCommitteeMember.event_id == eid).all()
    data["committee_members"] = [_member_dict(db, cm) for cm in cms]

    # Contributions
    contributions = db.query(EventContribution).filter(EventContribution.event_id == eid).all()
    data["contributions"] = [_contribution_dict(db, c, event.currency_id) for c in contributions]

    # Service bookings
    event_services = db.query(EventService).filter(EventService.event_id == eid).all()
    data["service_bookings"] = [_service_booking_dict(db, es, event.currency_id) for es in event_services]

    # Schedule
    schedule_items = db.query(EventScheduleItem).filter(EventScheduleItem.event_id == eid).order_by(EventScheduleItem.display_order.asc()).all()
    data["schedule"] = [{"id": str(si.id), "title": si.title, "description": si.description, "start_time": si.start_time.isoformat() if si.start_time else None, "end_time": si.end_time.isoformat() if si.end_time else None, "location": si.location, "display_order": si.display_order} for si in schedule_items]

    # Budget
    budget_items = db.query(EventBudgetItem).filter(EventBudgetItem.event_id == eid).all()
    data["budget_items"] = [{"id": str(bi.id), "category": bi.category, "item_name": bi.item_name, "estimated_cost": float(bi.estimated_cost) if bi.estimated_cost else None, "actual_cost": float(bi.actual_cost) if bi.actual_cost else None, "vendor_name": bi.vendor_name, "status": bi.status, "notes": bi.notes} for bi in budget_items]

    return standard_response(True, "Event retrieved successfully", data)


# ──────────────────────────────────────────────
# Create Event
# ──────────────────────────────────────────────
@router.post("/")
async def create_event(
    title: Optional[str] = Form(None), description: Optional[str] = Form(None),
    event_type_id: Optional[str] = Form(None), start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None), location: Optional[str] = Form(None),
    venue: Optional[str] = Form(None), venue_address: Optional[str] = Form(None),
    venue_latitude: Optional[float] = Form(None), venue_longitude: Optional[float] = Form(None),
    time: Optional[str] = Form(None), cover_image: Optional[UploadFile] = File(None),
    theme_color: Optional[str] = Form(None), is_public: Optional[bool] = Form(False),
    budget: Optional[float] = Form(None), currency: Optional[str] = Form(None),
    expected_guests: Optional[int] = Form(None), dress_code: Optional[str] = Form(None),
    special_instructions: Optional[str] = Form(None), rsvp_deadline: Optional[str] = Form(None),
    contribution_enabled: Optional[bool] = Form(False), contribution_target: Optional[float] = Form(None),
    contribution_description: Optional[str] = Form(None), services: Optional[str] = Form(None),
    images: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    """Creates a new event with comprehensive validation."""
    errors = []
    if not title or not title.strip():
        errors.append({"field": "title", "message": "Title is required."})
    if not event_type_id:
        errors.append({"field": "event_type_id", "message": "Event type is required."})
    if not start_date or not start_date.strip():
        errors.append({"field": "start_date", "message": "Start date is required."})

    parsed_start = parsed_end = parsed_rsvp = None
    if start_date and start_date.strip():
        try:
            parsed_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        except ValueError:
            errors.append({"field": "start_date", "message": "Invalid start_date format."})

    if end_date and end_date.strip():
        try:
            parsed_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except ValueError:
            errors.append({"field": "end_date", "message": "Invalid end_date format."})

    if rsvp_deadline and rsvp_deadline.strip():
        try:
            parsed_rsvp = datetime.fromisoformat(rsvp_deadline.replace("Z", "+00:00"))
        except ValueError:
            errors.append({"field": "rsvp_deadline", "message": "Invalid rsvp_deadline format."})

    if theme_color and not HEX_COLOR_RE.match(theme_color):
        errors.append({"field": "theme_color", "message": "Must be a valid hex color (e.g. #FF6B6B)."})

    if errors:
        return standard_response(False, "Validation failed", errors)

    event_type = db.query(EventType).filter(EventType.id == event_type_id).first()
    if not event_type:
        return standard_response(False, "Selected event type does not exist.")

    currency_id = None
    if currency:
        cur = db.query(Currency).filter(Currency.code == currency.upper()).first()
        if cur:
            currency_id = cur.id

    parsed_time = None
    if time and time.strip():
        try:
            parts = time.strip().split(":")
            parsed_time = datetime.strptime(time.strip(), "%H:%M").time() if len(parts) == 2 else datetime.strptime(time.strip(), "%H:%M:%S").time()
        except ValueError:
            pass

    now = datetime.now(EAT)
    new_event = Event(
        id=uuid.uuid4(), organizer_id=current_user.id, name=title.strip(),
        event_type_id=uuid.UUID(event_type_id),
        description=description.strip() if description else None,
        start_date=parsed_start.date() if parsed_start else None,
        start_time=parsed_time if parsed_time else (parsed_start.time() if parsed_start else None),
        end_date=parsed_end.date() if parsed_end else None,
        end_time=parsed_end.time() if parsed_end else None,
        location=location.strip() if location else None,
        expected_guests=expected_guests, budget=budget,
        status=EventStatusEnum.draft, currency_id=currency_id,
        is_public=is_public or False,
        theme_color=theme_color.strip() if theme_color else None,
        dress_code=dress_code.strip() if dress_code else None,
        special_instructions=special_instructions.strip() if special_instructions else None,
        created_at=now, updated_at=now,
    )
    db.add(new_event)
    db.flush()

    # Venue coordinates
    if venue_latitude is not None and venue_longitude is not None:
        db.add(EventVenueCoordinate(id=uuid.uuid4(), event_id=new_event.id, latitude=venue_latitude, longitude=venue_longitude, formatted_address=venue_address.strip() if venue_address else None, venue_name=venue.strip() if venue else None, created_at=now, updated_at=now))
    elif venue or venue_address:
        db.add(EventVenueCoordinate(id=uuid.uuid4(), event_id=new_event.id, latitude=0, longitude=0, formatted_address=venue_address.strip() if venue_address else None, venue_name=venue.strip() if venue else None, created_at=now, updated_at=now))

    # Settings
    db.add(EventSetting(id=uuid.uuid4(), event_id=new_event.id, rsvp_deadline=parsed_rsvp, contributions_enabled=contribution_enabled or False, contribution_target_amount=contribution_target, created_at=now, updated_at=now))

    # Contribution target
    if contribution_target and contribution_target > 0:
        db.add(EventContributionTarget(id=uuid.uuid4(), event_id=new_event.id, target_amount=contribution_target, description=contribution_description.strip() if contribution_description else None, created_at=now, updated_at=now))

    # Cover image
    if cover_image and cover_image.filename:
        result = await _upload_image(cover_image, f"nuru/uploads/events/{new_event.id}/cover/")
        if not result["success"]:
            db.rollback()
            return standard_response(False, result["error"])
        new_event.cover_image_url = result["url"]

    # Gallery images
    if images:
        real_images = [f for f in images if f and f.filename]
        if len(real_images) > MAX_EVENT_IMAGES:
            db.rollback()
            return standard_response(False, f"Maximum of {MAX_EVENT_IMAGES} images allowed.")
        for file in real_images:
            result = await _upload_image(file, f"nuru/uploads/events/{new_event.id}/gallery/")
            if not result["success"]:
                db.rollback()
                return standard_response(False, result["error"])
            db.add(EventImage(id=uuid.uuid4(), event_id=new_event.id, image_url=result["url"], created_at=now, updated_at=now))

    # Services
    if services:
        try:
            service_list = json.loads(services)
            for s in service_list:
                if "service_id" in s:
                    db.add(EventService(id=uuid.uuid4(), event_id=new_event.id, service_id=uuid.UUID(s["service_id"]), service_status=EventServiceStatusEnum.pending, created_at=now, updated_at=now))
        except (json.JSONDecodeError, ValueError):
            pass

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to save event: {str(e)}")

    return standard_response(True, "Event created successfully", _event_summary(db, new_event))


# ──────────────────────────────────────────────
# Update Event
# ──────────────────────────────────────────────
@router.put("/{event_id}")
async def update_event(
    event_id: str,
    title: Optional[str] = Form(None), description: Optional[str] = Form(None),
    event_type_id: Optional[str] = Form(None), start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None), location: Optional[str] = Form(None),
    venue: Optional[str] = Form(None), venue_address: Optional[str] = Form(None),
    venue_latitude: Optional[float] = Form(None), venue_longitude: Optional[float] = Form(None),
    cover_image: Optional[UploadFile] = File(None), remove_cover_image: Optional[bool] = Form(False),
    theme_color: Optional[str] = Form(None), is_public: Optional[bool] = Form(None),
    status: Optional[str] = Form(None), budget: Optional[float] = Form(None),
    currency: Optional[str] = Form(None), expected_guests: Optional[int] = Form(None),
    dress_code: Optional[str] = Form(None), special_instructions: Optional[str] = Form(None),
    rsvp_deadline: Optional[str] = Form(None), contribution_enabled: Optional[bool] = Form(None),
    contribution_target: Optional[float] = Form(None), contribution_description: Optional[str] = Form(None),
    time: Optional[str] = Form(None), images: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    """Updates an existing event."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    # Permission check
    if str(event.organizer_id) != str(current_user.id):
        cm = db.query(EventCommitteeMember).filter(EventCommitteeMember.event_id == eid, EventCommitteeMember.user_id == current_user.id).first()
        if cm:
            perms = db.query(CommitteePermission).filter(CommitteePermission.committee_member_id == cm.id).first()
            if not perms or not perms.can_edit_event:
                return standard_response(False, "You do not have permission to edit this event")
        else:
            return standard_response(False, "You do not have permission to edit this event")

    now = datetime.now(EAT)
    errors = []

    if title is not None:
        if not title.strip():
            errors.append({"field": "title", "message": "Title cannot be empty."})
        else:
            event.name = title.strip()

    if description is not None:
        event.description = description.strip() if description.strip() else None

    if event_type_id is not None:
        try:
            et = db.query(EventType).filter(EventType.id == uuid.UUID(event_type_id)).first()
            if et:
                event.event_type_id = et.id
        except ValueError:
            errors.append({"field": "event_type_id", "message": "Invalid UUID."})

    if start_date is not None:
        try:
            ps = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            event.start_date = ps.date()
            if time is None:
                event.start_time = ps.time()
        except ValueError:
            errors.append({"field": "start_date", "message": "Invalid format."})

    if time is not None and time.strip():
        try:
            parts = time.strip().split(":")
            event.start_time = datetime.strptime(time.strip(), "%H:%M").time() if len(parts) == 2 else datetime.strptime(time.strip(), "%H:%M:%S").time()
        except ValueError:
            errors.append({"field": "time", "message": "Invalid time format."})

    if end_date is not None:
        if end_date.strip():
            try:
                pe = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                event.end_date = pe.date()
                event.end_time = pe.time()
            except ValueError:
                errors.append({"field": "end_date", "message": "Invalid format."})
        else:
            event.end_date = None
            event.end_time = None

    if location is not None:
        event.location = location.strip() if location.strip() else None
    if budget is not None:
        event.budget = budget
    if expected_guests is not None:
        event.expected_guests = expected_guests
    if is_public is not None:
        event.is_public = is_public
    if currency is not None:
        cur = db.query(Currency).filter(Currency.code == currency.upper()).first()
        if cur:
            event.currency_id = cur.id
    if status is not None:
        mapped = "confirmed" if status == "published" else status
        valid = {s.value for s in EventStatusEnum}
        if mapped in valid:
            event.status = mapped
    if theme_color is not None:
        if HEX_COLOR_RE.match(theme_color):
            event.theme_color = theme_color
    if dress_code is not None:
        event.dress_code = dress_code.strip() if dress_code.strip() else None
    if special_instructions is not None:
        event.special_instructions = special_instructions.strip() if special_instructions.strip() else None

    if errors:
        return standard_response(False, "Validation failed", errors)

    # Venue coordinates
    if any(v is not None for v in [venue, venue_address, venue_latitude, venue_longitude]):
        vc = db.query(EventVenueCoordinate).filter(EventVenueCoordinate.event_id == eid).first()
        if not vc:
            vc = EventVenueCoordinate(id=uuid.uuid4(), event_id=eid, latitude=venue_latitude or 0, longitude=venue_longitude or 0, created_at=now)
            db.add(vc)
        if venue_latitude is not None: vc.latitude = venue_latitude
        if venue_longitude is not None: vc.longitude = venue_longitude
        if venue is not None: vc.venue_name = venue.strip() if venue.strip() else None
        if venue_address is not None: vc.formatted_address = venue_address.strip() if venue_address.strip() else None
        vc.updated_at = now

    # Settings
    settings = db.query(EventSetting).filter(EventSetting.event_id == eid).first()
    if not settings:
        settings = EventSetting(id=uuid.uuid4(), event_id=eid, created_at=now)
        db.add(settings)
    if rsvp_deadline is not None:
        if rsvp_deadline.strip():
            try:
                settings.rsvp_deadline = datetime.fromisoformat(rsvp_deadline.replace("Z", "+00:00"))
            except ValueError:
                pass
        else:
            settings.rsvp_deadline = None
    if contribution_enabled is not None:
        settings.contributions_enabled = contribution_enabled
    if contribution_target is not None:
        settings.contribution_target_amount = contribution_target
    settings.updated_at = now

    # Cover image
    if remove_cover_image:
        event.cover_image_url = None
    elif cover_image and cover_image.filename:
        result = await _upload_image(cover_image, f"nuru/uploads/events/{eid}/cover/")
        if not result["success"]:
            db.rollback()
            return standard_response(False, result["error"])
        event.cover_image_url = result["url"]

    # Gallery images (append)
    if images:
        real_images = [f for f in images if f and f.filename]
        if real_images:
            existing_count = db.query(sa_func.count(EventImage.id)).filter(EventImage.event_id == eid).scalar() or 0
            if existing_count + len(real_images) > MAX_EVENT_IMAGES:
                db.rollback()
                return standard_response(False, f"Total images would exceed maximum of {MAX_EVENT_IMAGES}.")
            for file in real_images:
                result = await _upload_image(file, f"nuru/uploads/events/{eid}/gallery/")
                if not result["success"]:
                    db.rollback()
                    return standard_response(False, result["error"])
                db.add(EventImage(id=uuid.uuid4(), event_id=eid, image_url=result["url"], created_at=now, updated_at=now))

    event.updated_at = now

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to update event: {str(e)}")

    return standard_response(True, "Event updated successfully", _event_summary(db, event))


# ──────────────────────────────────────────────
# Delete Event
# ──────────────────────────────────────────────
@router.delete("/{event_id}")
def delete_event(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Deletes an event."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")
    if str(event.organizer_id) != str(current_user.id):
        return standard_response(False, "You do not have permission to delete this event")

    confirmed = db.query(EventService).filter(EventService.event_id == eid, EventService.service_status.in_([EventServiceStatusEnum.assigned, EventServiceStatusEnum.in_progress])).count()
    if confirmed > 0:
        return standard_response(False, "Cannot delete event with confirmed bookings. Cancel bookings first.")

    db.delete(event)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to delete event: {str(e)}")

    return standard_response(True, "Event deleted successfully")


# ──────────────────────────────────────────────
# Update Event Status
# ──────────────────────────────────────────────
@router.put("/{event_id}/status")
def update_event_status(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Updates event status (publish, cancel, complete)."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")
    if str(event.organizer_id) != str(current_user.id):
        return standard_response(False, "Only the event organizer can change the status")

    new_status = body.get("status", "").strip()
    mapped = "confirmed" if new_status == "published" else new_status
    valid = {s.value for s in EventStatusEnum}
    if mapped not in valid:
        return standard_response(False, f"Invalid status. Must be one of: {', '.join(valid)}")

    now = datetime.now(EAT)
    event.status = mapped
    event.updated_at = now

    if mapped == "confirmed":
        event.is_public = True

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to update status: {str(e)}")

    return standard_response(True, "Event status updated successfully", {
        "id": str(event.id),
        "status": "published" if mapped == "confirmed" else mapped,
        "updated_at": now.isoformat(),
    })


# ──────────────────────────────────────────────
# Upload Event Images
# ──────────────────────────────────────────────
@router.post("/{event_id}/images")
async def upload_event_images(event_id: str, images: List[UploadFile] = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    now = datetime.now(EAT)
    uploaded = []
    for file in images:
        if not file or not file.filename:
            continue
        result = await _upload_image(file, f"nuru/uploads/events/{eid}/gallery/")
        if result["success"]:
            img = EventImage(id=uuid.uuid4(), event_id=eid, image_url=result["url"], created_at=now, updated_at=now)
            db.add(img)
            uploaded.append({"id": str(img.id), "image_url": result["url"]})

    db.commit()
    return standard_response(True, f"{len(uploaded)} images uploaded successfully", uploaded)


# ──────────────────────────────────────────────
# Delete Event Image
# ──────────────────────────────────────────────
@router.delete("/{event_id}/images/{image_id}")
def delete_event_image(event_id: str, image_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        iid = uuid.UUID(image_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    img = db.query(EventImage).filter(EventImage.id == iid, EventImage.event_id == eid).first()
    if not img:
        return standard_response(False, "Image not found")

    db.delete(img)
    db.commit()
    return standard_response(True, "Image deleted successfully")


# ──────────────────────────────────────────────
# Update Event Settings
# ──────────────────────────────────────────────
@router.put("/{event_id}/settings")
def update_event_settings(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    settings = db.query(EventSetting).filter(EventSetting.event_id == eid).first()
    if not settings:
        settings = EventSetting(id=uuid.uuid4(), event_id=eid)
        db.add(settings)

    for field in ["rsvp_enabled", "allow_plus_ones", "require_meal_preference", "contributions_enabled", "show_contribution_progress", "allow_anonymous_contributions", "checkin_enabled", "allow_nfc_checkin", "allow_qr_checkin", "allow_manual_checkin", "is_public", "show_guest_list", "show_committee"]:
        if field in body:
            setattr(settings, field, body[field])

    if "max_plus_ones" in body:
        settings.max_plus_ones = body["max_plus_ones"]
    if "meal_options" in body:
        settings.meal_options = body["meal_options"]
    if "contribution_target_amount" in body:
        settings.contribution_target_amount = body["contribution_target_amount"]
    if "minimum_contribution" in body:
        settings.minimum_contribution = body["minimum_contribution"]
    if "rsvp_deadline" in body and body["rsvp_deadline"]:
        try:
            settings.rsvp_deadline = datetime.fromisoformat(body["rsvp_deadline"].replace("Z", "+00:00"))
        except ValueError:
            pass

    settings.updated_at = datetime.now(EAT)
    db.commit()

    return standard_response(True, "Event settings updated successfully")


# ──────────────────────────────────────────────
# GUEST MANAGEMENT HELPERS
# ──────────────────────────────────────────────

def _attendee_dict(db: Session, att: EventAttendee) -> dict:
    user = db.query(User).filter(User.id == att.attendee_id).first() if att.attendee_id else None
    invitation = db.query(EventInvitation).filter(EventInvitation.id == att.invitation_id).first() if att.invitation_id else None
    plus_ones = db.query(EventGuestPlusOne).filter(EventGuestPlusOne.attendee_id == att.id).all()
    return {
        "id": str(att.id), "event_id": str(att.event_id),
        "name": f"{user.first_name} {user.last_name}" if user else None,
        "email": user.email if user else None, "phone": user.phone if user else None,
        "rsvp_status": att.rsvp_status.value if hasattr(att.rsvp_status, "value") else att.rsvp_status,
        "dietary_requirements": att.dietary_restrictions, "meal_preference": att.meal_preference,
        "special_requests": att.special_requests,
        "plus_ones": len(plus_ones), "plus_one_names": [po.name for po in plus_ones],
        "notes": invitation.notes if invitation else None,
        "invitation_sent": invitation.sent_at is not None if invitation else False,
        "invitation_sent_at": invitation.sent_at.isoformat() if invitation and invitation.sent_at else None,
        "invitation_method": invitation.sent_via if invitation else None,
        "checked_in": att.checked_in,
        "checked_in_at": att.checked_in_at.isoformat() if att.checked_in_at else None,
        "created_at": att.created_at.isoformat() if att.created_at else None,
    }


@router.get("/{event_id}/guests")
def get_guests(event_id: str, page: int = 1, limit: int = 50, rsvp_status: str = "all", search: str = "", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    query = db.query(EventAttendee).filter(EventAttendee.event_id == eid)
    if rsvp_status != "all":
        query = query.filter(EventAttendee.rsvp_status == rsvp_status)

    total = query.count()
    total_pages = max(1, math.ceil(total / limit))
    attendees = query.order_by(EventAttendee.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    # Summary counts
    all_q = db.query(EventAttendee).filter(EventAttendee.event_id == eid)
    summary = {
        "total": all_q.count(),
        "confirmed": all_q.filter(EventAttendee.rsvp_status == RSVPStatusEnum.confirmed).count(),
        "pending": all_q.filter(EventAttendee.rsvp_status == RSVPStatusEnum.pending).count(),
        "declined": all_q.filter(EventAttendee.rsvp_status == RSVPStatusEnum.declined).count(),
        "checked_in": all_q.filter(EventAttendee.checked_in == True).count(),
        "invitations_sent": db.query(EventInvitation).filter(EventInvitation.event_id == eid, EventInvitation.sent_at.isnot(None)).count(),
    }

    return standard_response(True, "Guests retrieved successfully", {
        "guests": [_attendee_dict(db, att) for att in attendees],
        "summary": summary,
        "pagination": {"page": page, "limit": limit, "total_items": total, "total_pages": total_pages, "has_next": page < total_pages, "has_previous": page > 1},
    })


@router.post("/{event_id}/guests")
def add_guest(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    name = body.get("name", "").strip()
    if not name:
        return standard_response(False, "Guest name is required.")

    # Prefer user_id if provided (from user search), otherwise fallback to email/phone lookup
    user_id = body.get("user_id")
    attendee_user = None
    if user_id:
        try:
            attendee_user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
        except ValueError:
            pass
    if not attendee_user:
        email = body.get("email")
        phone = body.get("phone")
        if email:
            attendee_user = db.query(User).filter(User.email == email).first()
        if not attendee_user and phone:
            attendee_user = db.query(User).filter(User.phone == phone).first()

    now = datetime.now(EAT)

    invitation = EventInvitation(id=uuid.uuid4(), event_id=eid, invited_user_id=attendee_user.id if attendee_user else None, invited_by_user_id=current_user.id, invitation_code=uuid.uuid4().hex[:16], rsvp_status=RSVPStatusEnum.pending, notes=body.get("notes"), created_at=now, updated_at=now)
    db.add(invitation)
    db.flush()

    att = EventAttendee(id=uuid.uuid4(), event_id=eid, attendee_id=attendee_user.id if attendee_user else None, invitation_id=invitation.id, rsvp_status=RSVPStatusEnum.pending, dietary_restrictions=body.get("dietary_requirements"), meal_preference=body.get("meal_preference"), special_requests=body.get("special_requests"), created_at=now, updated_at=now)
    db.add(att)

    for po_name in body.get("plus_one_names", []):
        db.add(EventGuestPlusOne(id=uuid.uuid4(), attendee_id=att.id, name=po_name, created_at=now, updated_at=now))

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to add guest: {str(e)}")

    # Create notification + send SMS for the invited user
    if attendee_user and attendee_user.id != current_user.id:
        try:
            from utils.notify import notify_event_invitation
            notify_event_invitation(db, attendee_user.id, current_user.id, eid, event.name)
            db.commit()
        except Exception:
            pass
        # SMS to guest
        event_date = event.start_date.strftime("%d/%m/%Y") if event.start_date else ""
        organizer_name = f"{current_user.first_name} {current_user.last_name}"
        sms_guest_added(attendee_user.phone, f"{attendee_user.first_name}", event.name, event_date, organizer_name)

    return standard_response(True, "Guest added successfully", _attendee_dict(db, att))


@router.post("/{event_id}/guests/bulk")
def add_guests_bulk(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    guests_data = body.get("guests", [])
    now = datetime.now(EAT)
    imported = []
    skipped = 0
    errors_list = []

    for i, guest in enumerate(guests_data):
        name = guest.get("name", "").strip()
        if not name:
            errors_list.append({"row": i + 1, "error": "Name is required"})
            continue

        email = guest.get("email")
        if body.get("skip_duplicates", True) and email:
            existing = db.query(EventAttendee).join(User, EventAttendee.attendee_id == User.id).filter(EventAttendee.event_id == eid, User.email == email).first()
            if existing:
                skipped += 1
                continue

        attendee_user = db.query(User).filter(User.email == email).first() if email else None

        invitation = EventInvitation(id=uuid.uuid4(), event_id=eid, invited_user_id=attendee_user.id if attendee_user else None, invited_by_user_id=current_user.id, invitation_code=uuid.uuid4().hex[:16], rsvp_status=RSVPStatusEnum.pending, created_at=now, updated_at=now)
        db.add(invitation)

        att = EventAttendee(id=uuid.uuid4(), event_id=eid, attendee_id=attendee_user.id if attendee_user else None, invitation_id=invitation.id, rsvp_status=RSVPStatusEnum.pending, created_at=now, updated_at=now)
        db.add(att)
        imported.append({"id": str(att.id), "name": name})

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to import guests: {str(e)}")

    return standard_response(True, "Guests imported successfully", {"imported": len(imported), "skipped": skipped, "errors": errors_list})


@router.put("/{event_id}/guests/{guest_id}")
def update_guest(event_id: str, guest_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        gid = uuid.UUID(guest_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    att = db.query(EventAttendee).filter(EventAttendee.id == gid, EventAttendee.event_id == eid).first()
    if not att:
        return standard_response(False, "Guest not found")

    now = datetime.now(EAT)
    if "dietary_requirements" in body: att.dietary_restrictions = body["dietary_requirements"]
    if "meal_preference" in body: att.meal_preference = body["meal_preference"]
    if "special_requests" in body: att.special_requests = body["special_requests"]
    if "rsvp_status" in body: att.rsvp_status = body["rsvp_status"]
    att.updated_at = now

    if "plus_one_names" in body:
        db.query(EventGuestPlusOne).filter(EventGuestPlusOne.attendee_id == att.id).delete()
        for po_name in body.get("plus_one_names", []):
            db.add(EventGuestPlusOne(id=uuid.uuid4(), attendee_id=att.id, name=po_name, created_at=now, updated_at=now))

    db.commit()
    return standard_response(True, "Guest updated successfully", _attendee_dict(db, att))


@router.delete("/{event_id}/guests/{guest_id}")
def remove_guest(event_id: str, guest_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        gid = uuid.UUID(guest_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    att = db.query(EventAttendee).filter(EventAttendee.id == gid, EventAttendee.event_id == eid).first()
    if not att:
        return standard_response(False, "Guest not found")

    db.delete(att)
    db.commit()
    return standard_response(True, "Guest removed successfully")


@router.delete("/{event_id}/guests/bulk")
def remove_guests_bulk(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    deleted = 0
    for gid_str in body.get("guest_ids", []):
        try:
            att = db.query(EventAttendee).filter(EventAttendee.id == uuid.UUID(gid_str), EventAttendee.event_id == eid).first()
            if att:
                db.delete(att)
                deleted += 1
        except ValueError:
            continue

    db.commit()
    return standard_response(True, f"{deleted} guests removed successfully", {"deleted": deleted})


@router.post("/{event_id}/guests/{guest_id}/invite")
def send_invitation(event_id: str, guest_id: str, body: dict = Body(default={}), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        gid = uuid.UUID(guest_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    att = db.query(EventAttendee).filter(EventAttendee.id == gid, EventAttendee.event_id == eid).first()
    if not att:
        return standard_response(False, "Guest not found")

    method = body.get("method", "email")
    now = datetime.now(EAT)

    invitation = db.query(EventInvitation).filter(EventInvitation.id == att.invitation_id).first() if att.invitation_id else None
    if invitation:
        invitation.sent_via = method
        invitation.sent_at = now
        invitation.updated_at = now
    else:
        invitation = EventInvitation(id=uuid.uuid4(), event_id=eid, invited_by_user_id=current_user.id, invitation_code=uuid.uuid4().hex[:16], rsvp_status=RSVPStatusEnum.pending, sent_via=method, sent_at=now, created_at=now, updated_at=now)
        db.add(invitation)
        att.invitation_id = invitation.id

    db.commit()
    return standard_response(True, "Invitation sent successfully", {"guest_id": str(att.id), "method": method, "sent_at": now.isoformat(), "invitation_url": f"https://nuru.tz/rsvp/{invitation.invitation_code}"})


@router.post("/{event_id}/guests/invite-all")
def send_bulk_invitations(event_id: str, body: dict = Body(default={}), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    method = body.get("method", "email")
    now = datetime.now(EAT)
    attendees = db.query(EventAttendee).filter(EventAttendee.event_id == eid).all()
    sent = 0
    for att in attendees:
        inv = db.query(EventInvitation).filter(EventInvitation.id == att.invitation_id).first() if att.invitation_id else None
        if inv:
            inv.sent_via = method
            inv.sent_at = now
            inv.updated_at = now
            sent += 1

    db.commit()
    return standard_response(True, "Invitations sent", {"total_selected": len(attendees), "sent_count": sent})


@router.post("/{event_id}/guests/{guest_id}/resend-invite")
def resend_invitation(event_id: str, guest_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return send_invitation(event_id, guest_id, Body(default={}), db, current_user)


@router.post("/{event_id}/guests/{guest_id}/checkin")
def checkin_guest(event_id: str, guest_id: str, body: dict = Body(default={}), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        gid = uuid.UUID(guest_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    att = db.query(EventAttendee).filter(EventAttendee.id == gid, EventAttendee.event_id == eid).first()
    if not att:
        return standard_response(False, "Guest not found")

    if att.checked_in:
        return standard_response(False, "Guest already checked in", {"checked_in_at": att.checked_in_at.isoformat() if att.checked_in_at else None})

    now = datetime.now(EAT)
    att.checked_in = True
    att.checked_in_at = now
    att.rsvp_status = RSVPStatusEnum.confirmed
    att.updated_at = now
    db.commit()

    user = db.query(User).filter(User.id == att.attendee_id).first() if att.attendee_id else None
    return standard_response(True, "Guest checked in successfully", {"guest_id": str(att.id), "name": f"{user.first_name} {user.last_name}" if user else None, "checked_in": True, "checked_in_at": now.isoformat()})


@router.post("/{event_id}/guests/checkin-qr")
def checkin_guest_qr(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Check in a guest using QR/invitation code."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    code = body.get("code", "").strip()
    if not code:
        return standard_response(False, "QR code is required")

    inv = db.query(EventInvitation).filter(EventInvitation.event_id == eid, EventInvitation.invitation_code == code).first()
    if not inv:
        return standard_response(False, "Invalid QR code")

    att = db.query(EventAttendee).filter(EventAttendee.invitation_id == inv.id).first()
    if not att:
        return standard_response(False, "Guest not found for this code")

    if att.checked_in:
        return standard_response(False, "Guest already checked in")

    now = datetime.now(EAT)
    att.checked_in = True
    att.checked_in_at = now
    att.rsvp_status = RSVPStatusEnum.confirmed
    att.updated_at = now
    db.commit()

    user = db.query(User).filter(User.id == att.attendee_id).first() if att.attendee_id else None
    return standard_response(True, "Guest checked in successfully", {"guest_id": str(att.id), "name": f"{user.first_name} {user.last_name}" if user else None, "checked_in": True})


@router.post("/{event_id}/guests/{guest_id}/undo-checkin")
def undo_checkin(event_id: str, guest_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        gid = uuid.UUID(guest_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    att = db.query(EventAttendee).filter(EventAttendee.id == gid, EventAttendee.event_id == eid).first()
    if not att:
        return standard_response(False, "Guest not found")

    att.checked_in = False
    att.checked_in_at = None
    att.updated_at = datetime.now(EAT)
    db.commit()

    return standard_response(True, "Check-in reverted successfully", {"guest_id": str(att.id), "checked_in": False})


@router.get("/{event_id}/guests/export")
def export_guests(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    attendees = db.query(EventAttendee).filter(EventAttendee.event_id == eid).all()
    data = [_attendee_dict(db, att) for att in attendees]
    return standard_response(True, "Guest list exported successfully", data)


# ──────────────────────────────────────────────
# COMMITTEE MANAGEMENT
# ──────────────────────────────────────────────

def _member_dict(db: Session, cm) -> dict:
    member_user = db.query(User).filter(User.id == cm.user_id).first() if cm.user_id else None
    profile = db.query(UserProfile).filter(UserProfile.user_id == cm.user_id).first() if cm.user_id else None
    role = db.query(CommitteeRole).filter(CommitteeRole.id == cm.role_id).first() if cm.role_id else None
    perms = db.query(CommitteePermission).filter(CommitteePermission.committee_member_id == cm.id).first()
    assigned_user = db.query(User).filter(User.id == cm.assigned_by).first() if cm.assigned_by else None

    permissions_list = []
    if perms:
        for api_name, db_field in PERMISSION_MAP.items():
            if getattr(perms, db_field, False):
                permissions_list.append(api_name)

    return {
        "id": str(cm.id), "event_id": str(cm.event_id),
        "user_id": str(cm.user_id) if cm.user_id else None,
        "name": f"{member_user.first_name} {member_user.last_name}" if member_user else None,
        "email": member_user.email if member_user else None,
        "phone": member_user.phone if member_user else None,
        "avatar": profile.profile_picture_url if profile else None,
        "role": role.role_name if role else None,
        "role_description": role.description if role else None,
        "permissions": permissions_list,
        "status": "active" if cm.user_id else "invited",
        "assigned_by": {"id": str(assigned_user.id), "name": f"{assigned_user.first_name} {assigned_user.last_name}"} if assigned_user else None,
        "assigned_at": cm.assigned_at.isoformat() if cm.assigned_at else None,
        "created_at": cm.created_at.isoformat() if cm.created_at else None,
    }


@router.get("/{event_id}/committee")
def get_committee_members(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    members = db.query(EventCommitteeMember).filter(EventCommitteeMember.event_id == eid).all()
    return standard_response(True, "Committee members retrieved successfully", [_member_dict(db, cm) for cm in members])


@router.post("/{event_id}/committee")
def add_committee_member(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")
    if str(event.organizer_id) != str(current_user.id):
        return standard_response(False, "Only the event organizer can add committee members")

    role_name = body.get("role", "").strip()
    if not role_name:
        return standard_response(False, "Role is required")

    email = body.get("email")
    now = datetime.now(EAT)

    role = db.query(CommitteeRole).filter(CommitteeRole.role_name == role_name).first()
    if not role:
        role = CommitteeRole(id=uuid.uuid4(), role_name=role_name, description=body.get("role_description", role_name), created_at=now, updated_at=now)
        db.add(role)

    member_user = db.query(User).filter(User.email == email).first() if email else None

    cm = EventCommitteeMember(id=uuid.uuid4(), event_id=eid, user_id=member_user.id if member_user else None, role_id=role.id, assigned_by=current_user.id, assigned_at=now, created_at=now, updated_at=now)
    db.add(cm)
    db.flush()

    perms = CommitteePermission(id=uuid.uuid4(), committee_member_id=cm.id, created_at=now, updated_at=now)
    for perm_name in body.get("permissions", []):
        db_field = PERMISSION_MAP.get(perm_name)
        if db_field and hasattr(perms, db_field):
            setattr(perms, db_field, True)
    db.add(perms)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to add committee member: {str(e)}")

    # Create notification + send SMS for the committee member
    if member_user and member_user.id != current_user.id:
        try:
            from utils.notify import notify_committee_invite
            notify_committee_invite(db, member_user.id, current_user.id, eid, event.name, role_name)
            db.commit()
        except Exception:
            pass
        # SMS to committee member
        organizer_name = f"{current_user.first_name} {current_user.last_name}"
        sms_committee_invite(member_user.phone, f"{member_user.first_name}", event.name, role_name, organizer_name)

    return standard_response(True, "Committee member added successfully", _member_dict(db, cm))


@router.put("/{event_id}/committee/{member_id}")
def update_committee_member(event_id: str, member_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        mid = uuid.UUID(member_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")
    if str(event.organizer_id) != str(current_user.id):
        return standard_response(False, "Only the event organizer can update committee members")

    cm = db.query(EventCommitteeMember).filter(EventCommitteeMember.id == mid, EventCommitteeMember.event_id == eid).first()
    if not cm:
        return standard_response(False, "Committee member not found")

    now = datetime.now(EAT)

    if "role" in body:
        role_name = body["role"].strip()
        role = db.query(CommitteeRole).filter(CommitteeRole.role_name == role_name).first()
        if not role:
            role = CommitteeRole(id=uuid.uuid4(), role_name=role_name, description=body.get("role_description", role_name), created_at=now, updated_at=now)
            db.add(role)
        cm.role_id = role.id

    if "permissions" in body:
        perms = db.query(CommitteePermission).filter(CommitteePermission.committee_member_id == cm.id).first()
        if not perms:
            perms = CommitteePermission(id=uuid.uuid4(), committee_member_id=cm.id, created_at=now, updated_at=now)
            db.add(perms)
        for field in PERMISSION_FIELDS:
            setattr(perms, field, False)
        for perm_name in body["permissions"]:
            db_field = PERMISSION_MAP.get(perm_name)
            if db_field and hasattr(perms, db_field):
                setattr(perms, db_field, True)
        perms.updated_at = now

    cm.updated_at = now
    db.commit()
    return standard_response(True, "Committee member updated successfully", _member_dict(db, cm))


@router.delete("/{event_id}/committee/{member_id}")
def remove_committee_member(event_id: str, member_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        mid = uuid.UUID(member_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")
    if str(event.organizer_id) != str(current_user.id):
        return standard_response(False, "Only the event organizer can remove committee members")

    cm = db.query(EventCommitteeMember).filter(EventCommitteeMember.id == mid, EventCommitteeMember.event_id == eid).first()
    if not cm:
        return standard_response(False, "Committee member not found")

    db.delete(cm)
    db.commit()
    return standard_response(True, "Committee member removed successfully")


@router.put("/{event_id}/committee/{member_id}/permissions")
def update_committee_permissions(event_id: str, member_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        mid = uuid.UUID(member_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event or str(event.organizer_id) != str(current_user.id):
        return standard_response(False, "Not authorized")

    cm = db.query(EventCommitteeMember).filter(EventCommitteeMember.id == mid, EventCommitteeMember.event_id == eid).first()
    if not cm:
        return standard_response(False, "Committee member not found")

    now = datetime.now(EAT)
    perms = db.query(CommitteePermission).filter(CommitteePermission.committee_member_id == cm.id).first()
    if not perms:
        perms = CommitteePermission(id=uuid.uuid4(), committee_member_id=cm.id, created_at=now, updated_at=now)
        db.add(perms)

    for field in PERMISSION_FIELDS:
        setattr(perms, field, False)
    for perm_name in body.get("permissions", []):
        db_field = PERMISSION_MAP.get(perm_name)
        if db_field and hasattr(perms, db_field):
            setattr(perms, db_field, True)
    perms.updated_at = now

    db.commit()
    return standard_response(True, "Permissions updated successfully", _member_dict(db, cm))


# ──────────────────────────────────────────────
# CONTRIBUTIONS MANAGEMENT
# ──────────────────────────────────────────────

def _contribution_dict(db: Session, c: EventContribution, currency_id) -> dict:
    # Get the contributor user via relationships
    contributor_user = None
    if c.event_contributor and c.event_contributor.contributor:
        contributor_user = c.event_contributor.contributor.user

    contact = c.contributor_contact or {}
    thank_you = db.query(ContributionThankYouMessage).filter(
        ContributionThankYouMessage.contribution_id == c.id
    ).first()

    return {
        "id": str(c.id),
        "event_id": str(c.event_id),
        "contributor_name": f"{contributor_user.first_name} {contributor_user.last_name}" 
                            if contributor_user else (c.contributor_name or "Anonymous"),
        "contributor_email": contributor_user.email if contributor_user else contact.get("email"),
        "contributor_phone": contributor_user.phone if contributor_user else contact.get("phone"),
        "contributor_user_id": str(contributor_user.id) if contributor_user else None,
        "amount": float(c.amount),
        "currency": _currency_code(db, currency_id),
        "payment_method": c.payment_method.value if hasattr(c.payment_method, "value") else c.payment_method,
        "payment_reference": c.transaction_ref,
        "status": "confirmed",
        "is_anonymous": contributor_user is None and (not c.contributor_name or c.contributor_name.lower() == "anonymous"),
        "thank_you_sent": thank_you.is_sent if thank_you else False,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "confirmed_at": c.contributed_at.isoformat() if c.contributed_at else None,
    }


@router.get("/{event_id}/contributions")
def get_contributions(event_id: str, page: int = 1, limit: int = 20, sort_by: str = "created_at", sort_order: str = "desc", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    query = db.query(EventContribution).filter(EventContribution.event_id == eid)
    sort_col = EventContribution.amount if sort_by == "amount" else EventContribution.created_at
    query = query.order_by(sort_col.desc() if sort_order == "desc" else sort_col.asc())

    total = query.count()
    total_pages = max(1, math.ceil(total / limit))
    contributions = query.offset((page - 1) * limit).limit(limit).all()

    total_amount = db.query(sa_func.coalesce(sa_func.sum(EventContribution.amount), 0)).filter(EventContribution.event_id == eid).scalar()
    ct = db.query(EventContributionTarget).filter(EventContributionTarget.event_id == eid).first()
    settings = db.query(EventSetting).filter(EventSetting.event_id == eid).first()
    target = float(ct.target_amount) if ct else (float(settings.contribution_target_amount) if settings and settings.contribution_target_amount else 0)

    return standard_response(True, "Contributions retrieved successfully", {
        "contributions": [_contribution_dict(db, c, event.currency_id) for c in contributions],
        "summary": {
            "total_amount": float(total_amount), "target_amount": target,
            "progress_percentage": round((float(total_amount) / target * 100), 1) if target > 0 else 0,
            "total_contributors": total, "currency": _currency_code(db, event.currency_id),
        },
        "pagination": {"page": page, "limit": limit, "total_items": total, "total_pages": total_pages, "has_next": page < total_pages, "has_previous": page > 1},
    })


@router.post("/{event_id}/contributions")
def record_contribution(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    amount = body.get("amount")
    if not amount or float(amount) <= 0:
        return standard_response(False, "Amount must be greater than 0")

    now = datetime.now(EAT)
    contributor_user_id = None
    if body.get("contributor_user_id"):
        try:
            contributor_user_id = uuid.UUID(body["contributor_user_id"])
        except ValueError:
            pass

    c = EventContribution(
        id=uuid.uuid4(), event_id=eid, contributor_user_id=contributor_user_id,
        contributor_name=body.get("contributor_name"), contributor_contact={"email": body.get("contributor_email"), "phone": body.get("contributor_phone")},
        amount=float(amount), payment_method=body.get("payment_method", "mobile"),
        transaction_ref=body.get("transaction_reference"), contributed_at=now, created_at=now,
    )
    db.add(c)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to record contribution: {str(e)}")

    # Notify contributor + SMS
    currency = _currency_code(db, event.currency_id) or "TZS"
    if contributor_user_id:
        contributor_user = db.query(User).filter(User.id == contributor_user_id).first()
        if contributor_user:
            try:
                from utils.notify import notify_contribution
                notify_contribution(db, contributor_user.id, current_user.id, eid, event.name, float(amount), currency)
                db.commit()
            except Exception:
                pass
            # Calculate total paid for this contributor
            total_paid = float(db.query(sa_func.coalesce(sa_func.sum(EventContribution.amount), 0)).filter(
                EventContribution.event_id == eid, EventContribution.contributor_user_id == contributor_user_id
            ).scalar())
            ct = db.query(EventContributionTarget).filter(EventContributionTarget.event_id == eid).first()
            target = float(ct.target_amount) if ct else 0
            sms_contribution_recorded(contributor_user.phone, f"{contributor_user.first_name}", event.name, float(amount), target, total_paid, currency)

    return standard_response(True, "Contribution recorded successfully", _contribution_dict(db, c, event.currency_id))


@router.put("/{event_id}/contributions/{contribution_id}")
def update_contribution(event_id: str, contribution_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        cid = uuid.UUID(contribution_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    c = db.query(EventContribution).filter(EventContribution.id == cid, EventContribution.event_id == eid).first()
    if not c:
        return standard_response(False, "Contribution not found")

    if "amount" in body: c.amount = float(body["amount"])
    if "payment_method" in body: c.payment_method = body["payment_method"]
    if "transaction_reference" in body: c.transaction_ref = body["transaction_reference"]

    db.commit()

    event = db.query(Event).filter(Event.id == eid).first()
    return standard_response(True, "Contribution updated successfully", _contribution_dict(db, c, event.currency_id))


@router.delete("/{event_id}/contributions/{contribution_id}")
def delete_contribution(event_id: str, contribution_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        cid = uuid.UUID(contribution_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event or str(event.organizer_id) != str(current_user.id):
        return standard_response(False, "Not authorized")

    c = db.query(EventContribution).filter(EventContribution.id == cid, EventContribution.event_id == eid).first()
    if not c:
        return standard_response(False, "Contribution not found")

    db.delete(c)
    db.commit()
    return standard_response(True, "Contribution deleted successfully")


@router.get("/{event_id}/contributions/export")
def export_contributions(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    contributions = db.query(EventContribution).filter(EventContribution.event_id == eid).all()
    return standard_response(True, "Contributions exported", [_contribution_dict(db, c, event.currency_id) for c in contributions])


@router.post("/{event_id}/contributions/{contribution_id}/thank-you")
def send_thank_you(event_id: str, contribution_id: str, body: dict = Body(default={}), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        cid = uuid.UUID(contribution_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    c = db.query(EventContribution).filter(EventContribution.id == cid, EventContribution.event_id == eid).first()
    if not c:
        return standard_response(False, "Contribution not found")

    now = datetime.now(EAT)
    method = body.get("method", "email")
    msg = body.get("custom_message", "Thank you for your generous contribution!")

    thank_you = db.query(ContributionThankYouMessage).filter(ContributionThankYouMessage.contribution_id == cid).first()
    if not thank_you:
        thank_you = ContributionThankYouMessage(id=uuid.uuid4(), event_id=eid, contribution_id=cid, message=msg, sent_via=method, sent_at=now, is_sent=True, created_at=now)
        db.add(thank_you)
    else:
        thank_you.message = msg
        thank_you.sent_via = method
        thank_you.sent_at = now
        thank_you.is_sent = True

    db.commit()

    # Send thank-you SMS
    contributor_user = db.query(User).filter(User.id == c.contributor_user_id).first() if c.contributor_user_id else None
    if contributor_user and contributor_user.phone:
        event = db.query(Event).filter(Event.id == eid).first()
        sms_thank_you(contributor_user.phone, f"{contributor_user.first_name}", event.name if event else "your event", msg)

    return standard_response(True, "Thank you sent successfully", {"contribution_id": str(cid), "thank_you_sent": True, "sent_at": now.isoformat()})


@router.put("/{event_id}/contributions/target")
def update_contribution_target(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    now = datetime.now(EAT)
    ct = db.query(EventContributionTarget).filter(EventContributionTarget.event_id == eid).first()
    if not ct:
        ct = EventContributionTarget(id=uuid.uuid4(), event_id=eid, created_at=now)
        db.add(ct)

    if "target_amount" in body: ct.target_amount = body["target_amount"]
    if "description" in body: ct.description = body["description"]
    ct.updated_at = now

    settings = db.query(EventSetting).filter(EventSetting.event_id == eid).first()
    if settings and "target_amount" in body:
        settings.contribution_target_amount = body["target_amount"]

    db.commit()

    # SMS all contributors about the new target
    if "target_amount" in body:
        target_val = float(body["target_amount"])
        currency = _currency_code(db, event.currency_id) or "TZS"
        contributors = db.query(EventContribution).filter(EventContribution.event_id == eid).all()
        notified_users = set()
        for contrib in contributors:
            uid = contrib.contributor_user_id
            if uid and uid not in notified_users:
                notified_users.add(uid)
                cuser = db.query(User).filter(User.id == uid).first()
                if cuser and cuser.phone:
                    total_paid = float(db.query(sa_func.coalesce(sa_func.sum(EventContribution.amount), 0)).filter(
                        EventContribution.event_id == eid, EventContribution.contributor_user_id == uid
                    ).scalar())
                    sms_contribution_target_set(cuser.phone, f"{cuser.first_name}", event.name, target_val, total_paid, currency)

    return standard_response(True, "Contribution target updated successfully")


# ──────────────────────────────────────────────
# SCHEDULE MANAGEMENT
# ──────────────────────────────────────────────

@router.get("/{event_id}/schedule")
def get_schedule(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    items = db.query(EventScheduleItem).filter(EventScheduleItem.event_id == eid).order_by(EventScheduleItem.display_order.asc()).all()
    return standard_response(True, "Schedule retrieved successfully", [{"id": str(si.id), "title": si.title, "description": si.description, "start_time": si.start_time.isoformat() if si.start_time else None, "end_time": si.end_time.isoformat() if si.end_time else None, "location": si.location, "display_order": si.display_order} for si in items])


@router.post("/{event_id}/schedule")
def add_schedule_item(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    now = datetime.now(EAT)
    max_order = db.query(sa_func.max(EventScheduleItem.display_order)).filter(EventScheduleItem.event_id == eid).scalar() or 0

    start_time = end_time = None
    if body.get("start_time"):
        try:
            start_time = datetime.fromisoformat(body["start_time"].replace("Z", "+00:00"))
        except ValueError:
            pass
    if body.get("end_time"):
        try:
            end_time = datetime.fromisoformat(body["end_time"].replace("Z", "+00:00"))
        except ValueError:
            pass

    si = EventScheduleItem(id=uuid.uuid4(), event_id=eid, title=body.get("title", ""), description=body.get("description"), start_time=start_time, end_time=end_time, location=body.get("location"), display_order=max_order + 1, created_at=now, updated_at=now)
    db.add(si)
    db.commit()

    return standard_response(True, "Schedule item added successfully", {"id": str(si.id), "title": si.title, "display_order": si.display_order})


@router.put("/{event_id}/schedule/{item_id}")
def update_schedule_item(event_id: str, item_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        iid = uuid.UUID(item_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    si = db.query(EventScheduleItem).filter(EventScheduleItem.id == iid, EventScheduleItem.event_id == eid).first()
    if not si:
        return standard_response(False, "Schedule item not found")

    if "title" in body: si.title = body["title"]
    if "description" in body: si.description = body["description"]
    if "location" in body: si.location = body["location"]
    if "start_time" in body:
        try:
            si.start_time = datetime.fromisoformat(body["start_time"].replace("Z", "+00:00"))
        except ValueError:
            pass
    if "end_time" in body:
        try:
            si.end_time = datetime.fromisoformat(body["end_time"].replace("Z", "+00:00"))
        except ValueError:
            pass
    si.updated_at = datetime.now(EAT)
    db.commit()

    return standard_response(True, "Schedule item updated successfully")


@router.delete("/{event_id}/schedule/{item_id}")
def delete_schedule_item(event_id: str, item_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        iid = uuid.UUID(item_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    si = db.query(EventScheduleItem).filter(EventScheduleItem.id == iid, EventScheduleItem.event_id == eid).first()
    if not si:
        return standard_response(False, "Schedule item not found")

    db.delete(si)
    db.commit()
    return standard_response(True, "Schedule item deleted successfully")


@router.put("/{event_id}/schedule/reorder")
def reorder_schedule(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    order = body.get("order", [])
    for i, item_id in enumerate(order):
        try:
            si = db.query(EventScheduleItem).filter(EventScheduleItem.id == uuid.UUID(item_id), EventScheduleItem.event_id == eid).first()
            if si:
                si.display_order = i + 1
        except ValueError:
            continue

    db.commit()
    return standard_response(True, "Schedule reordered successfully")


# ──────────────────────────────────────────────
# BUDGET MANAGEMENT
# ──────────────────────────────────────────────

@router.get("/{event_id}/budget")
def get_budget(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    items = db.query(EventBudgetItem).filter(EventBudgetItem.event_id == eid).all()
    total_estimated = sum(float(bi.estimated_cost) for bi in items if bi.estimated_cost)
    total_actual = sum(float(bi.actual_cost) for bi in items if bi.actual_cost)

    return standard_response(True, "Budget retrieved successfully", {
        "items": [{"id": str(bi.id), "category": bi.category, "item_name": bi.item_name, "estimated_cost": float(bi.estimated_cost) if bi.estimated_cost else None, "actual_cost": float(bi.actual_cost) if bi.actual_cost else None, "vendor_name": bi.vendor_name, "status": bi.status, "notes": bi.notes} for bi in items],
        "summary": {"total_estimated": total_estimated, "total_actual": total_actual},
    })


@router.post("/{event_id}/budget")
def add_budget_item(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    now = datetime.now(EAT)
    bi = EventBudgetItem(id=uuid.uuid4(), event_id=eid, category=body.get("category"), item_name=body.get("item_name", ""), estimated_cost=body.get("estimated_cost"), actual_cost=body.get("actual_cost"), vendor_name=body.get("vendor_name"), status=body.get("status", "pending"), notes=body.get("notes"), created_at=now, updated_at=now)
    db.add(bi)
    db.commit()

    return standard_response(True, "Budget item added successfully", {"id": str(bi.id)})


@router.put("/{event_id}/budget/{item_id}")
def update_budget_item(event_id: str, item_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        iid = uuid.UUID(item_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    bi = db.query(EventBudgetItem).filter(EventBudgetItem.id == iid, EventBudgetItem.event_id == eid).first()
    if not bi:
        return standard_response(False, "Budget item not found")

    for field in ["category", "item_name", "vendor_name", "status", "notes"]:
        if field in body: setattr(bi, field, body[field])
    if "estimated_cost" in body: bi.estimated_cost = body["estimated_cost"]
    if "actual_cost" in body: bi.actual_cost = body["actual_cost"]
    bi.updated_at = datetime.now(EAT)
    db.commit()

    return standard_response(True, "Budget item updated successfully")


@router.delete("/{event_id}/budget/{item_id}")
def delete_budget_item(event_id: str, item_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        iid = uuid.UUID(item_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    bi = db.query(EventBudgetItem).filter(EventBudgetItem.id == iid, EventBudgetItem.event_id == eid).first()
    if not bi:
        return standard_response(False, "Budget item not found")

    db.delete(bi)
    db.commit()
    return standard_response(True, "Budget item deleted successfully")


# ──────────────────────────────────────────────
# EVENT SERVICES (Vendor Bookings)
# ──────────────────────────────────────────────

def _service_booking_dict(db: Session, es: EventService, currency_id) -> dict:
    svc_type = db.query(ServiceType).filter(ServiceType.id == es.service_id).first()
    provider_svc = db.query(UserService).filter(UserService.id == es.provider_user_service_id).first() if es.provider_user_service_id else None
    provider_user = db.query(User).filter(User.id == es.provider_user_id).first() if es.provider_user_id else None
    return {
        "id": str(es.id), "event_id": str(es.event_id), "service_id": str(es.service_id),
        "service": {
            "title": provider_svc.title if provider_svc else (svc_type.name if svc_type else None),
            "category": svc_type.category.name if svc_type and hasattr(svc_type, "category") and svc_type.category else None,
            "provider_name": f"{provider_user.first_name} {provider_user.last_name}" if provider_user else None,
        },
        "quoted_price": float(es.agreed_price) if es.agreed_price else None,
        "currency": _currency_code(db, currency_id),
        "status": es.service_status.value if hasattr(es.service_status, "value") else es.service_status,
        "notes": es.notes,
        "created_at": es.created_at.isoformat() if es.created_at else None,
    }


@router.get("/{event_id}/services")
def get_event_services(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    services = db.query(EventService).filter(EventService.event_id == eid).all()
    return standard_response(True, "Event services retrieved successfully", [_service_booking_dict(db, es, event.currency_id) for es in services])


@router.post("/{event_id}/services")
def add_event_service(event_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    now = datetime.now(EAT)

    # Resolve service_id from the provider's user service
    service_id_val = None
    if body.get("service_id"):
        service_id_val = uuid.UUID(body["service_id"])
    elif body.get("provider_service_id"):
        provider_svc = db.query(UserService).filter(UserService.id == uuid.UUID(body["provider_service_id"])).first()
        if provider_svc and provider_svc.service_type_id:
            service_id_val = provider_svc.service_type_id

    es = EventService(
        id=uuid.uuid4(), event_id=eid,
        service_id=service_id_val,
        provider_user_service_id=uuid.UUID(body["provider_service_id"]) if body.get("provider_service_id") else None,
        provider_user_id=uuid.UUID(body["provider_user_id"]) if body.get("provider_user_id") else None,
        agreed_price=body.get("quoted_price"),
        service_status=EventServiceStatusEnum.pending,
        notes=body.get("notes"),
        created_at=now, updated_at=now,
    )
    db.add(es)
    db.commit()

    # Notify & SMS the service provider
    if body.get("provider_user_id"):
        try:
            provider_user = db.query(User).filter(User.id == uuid.UUID(body["provider_user_id"])).first()
            if provider_user and provider_user.id != current_user.id:
                from utils.notify import notify_booking
                provider_svc = db.query(UserService).filter(UserService.id == es.provider_user_service_id).first() if es.provider_user_service_id else None
                service_name = provider_svc.title if provider_svc else "service"
                notify_booking(db, provider_user.id, current_user.id, eid, event.name, service_name)
                db.commit()
                organizer_name = f"{current_user.first_name} {current_user.last_name}"
                sms_booking_notification(provider_user.phone, f"{provider_user.first_name}", event.name, organizer_name)
        except Exception:
            pass

    return standard_response(True, "Service added to event successfully", _service_booking_dict(db, es, event.currency_id))


@router.put("/{event_id}/services/{service_id}")
def update_event_service(event_id: str, service_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    es = db.query(EventService).filter(EventService.id == sid, EventService.event_id == eid).first()
    if not es:
        return standard_response(False, "Event service not found")

    if "status" in body: es.service_status = body["status"]
    if "quoted_price" in body: es.agreed_price = body["quoted_price"]
    if "notes" in body: es.notes = body["notes"]
    es.updated_at = datetime.now(EAT)
    db.commit()

    return standard_response(True, "Event service updated successfully")


@router.delete("/{event_id}/services/{service_id}")
def remove_event_service(event_id: str, service_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    es = db.query(EventService).filter(EventService.id == sid, EventService.event_id == eid).first()
    if not es:
        return standard_response(False, "Event service not found")

    db.delete(es)
    db.commit()
    return standard_response(True, "Event service removed successfully")


@router.post("/{event_id}/services/{service_id}/payment")
def record_service_payment(event_id: str, service_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        eid = uuid.UUID(event_id)
        sid = uuid.UUID(service_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    event, err = _verify_event_access(db, eid, current_user)
    if err:
        return err

    es = db.query(EventService).filter(EventService.id == sid, EventService.event_id == eid).first()
    if not es:
        return standard_response(False, "Event service not found")

    now = datetime.now(EAT)
    payment = EventServicePayment(
        id=uuid.uuid4(), event_service_id=es.id,
        amount=body.get("amount"), payment_method=body.get("payment_method", "mobile"),
        transaction_ref=body.get("transaction_reference"),
        paid_at=now, created_at=now,
    )
    db.add(payment)
    db.commit()

    return standard_response(True, "Payment recorded successfully", {"id": str(payment.id), "amount": float(payment.amount) if payment.amount else None})


# ──────────────────────────────────────────────
# RSVP Respond (Authenticated – for invited users)
# ──────────────────────────────────────────────
@router.put("/invited/{event_id}/rsvp")
def respond_to_invitation(
    event_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allows an invited user to accept/decline an event invitation."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID format")

    rsvp_status = body.get("rsvp_status")
    valid_statuses = {"confirmed", "declined", "pending"}
    if rsvp_status not in valid_statuses:
        return standard_response(False, f"Invalid rsvp_status. Must be one of: {', '.join(valid_statuses)}")

    # Find the invitation
    invitation = db.query(EventInvitation).filter(
        EventInvitation.event_id == eid,
        EventInvitation.invited_user_id == current_user.id,
    ).first()

    if not invitation:
        # Also check if user is an attendee without an invitation record
        attendee = db.query(EventAttendee).filter(
            EventAttendee.event_id == eid,
            EventAttendee.attendee_id == current_user.id,
        ).first()
        if not attendee:
            return standard_response(False, "You do not have an invitation for this event")

        # Update attendee directly
        attendee.rsvp_status = RSVPStatusEnum(rsvp_status)
        attendee.updated_at = datetime.now(EAT)
        db.commit()

        return standard_response(True, "RSVP updated successfully", {
            "event_id": str(eid),
            "rsvp_status": rsvp_status,
            "rsvp_at": attendee.updated_at.isoformat(),
        })

    # Update invitation
    invitation.rsvp_status = RSVPStatusEnum(rsvp_status)
    invitation.rsvp_at = datetime.now(EAT)
    invitation.updated_at = datetime.now(EAT)

    # Update or create attendee record
    attendee = db.query(EventAttendee).filter(
        EventAttendee.event_id == eid,
        EventAttendee.attendee_id == current_user.id,
    ).first()

    now = datetime.now(EAT)
    if attendee:
        attendee.rsvp_status = RSVPStatusEnum(rsvp_status)
        attendee.updated_at = now
    else:
        attendee = EventAttendee(
            id=uuid.uuid4(),
            event_id=eid,
            attendee_id=current_user.id,
            invitation_id=invitation.id,
            rsvp_status=RSVPStatusEnum(rsvp_status),
            created_at=now,
            updated_at=now,
        )
        db.add(attendee)

    # Update meal/dietary if provided
    if body.get("meal_preference"):
        attendee.meal_preference = body["meal_preference"]
    if body.get("dietary_restrictions"):
        attendee.dietary_restrictions = body["dietary_restrictions"]
    if body.get("special_requests"):
        attendee.special_requests = body["special_requests"]

    db.commit()

    return standard_response(True, "RSVP updated successfully", {
        "event_id": str(eid),
        "rsvp_status": rsvp_status,
        "rsvp_at": invitation.rsvp_at.isoformat(),
        "attendee_id": str(attendee.id),
    })
