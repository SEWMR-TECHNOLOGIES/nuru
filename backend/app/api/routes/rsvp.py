# Public RSVP endpoints – no authentication required
# Guests use their unique invitation_code to view event details and respond

import secrets
import string
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy import func as sql_func

from core.database import SessionLocal
from models.invitations import EventInvitation, EventAttendee
from models.events import Event, EventImage, EventSetting
from models.users import User
from models.enums import RSVPStatusEnum, GuestTypeEnum
from utils.helpers import standard_response, format_phone_display

router = APIRouter(prefix="/rsvp", tags=["RSVP"])


# ── Schemas ──────────────────────────────────────────

class RSVPResponseInput(BaseModel):
    rsvp_status: str = Field(..., pattern="^(confirmed|declined)$")
    meal_preference: Optional[str] = Field(None, max_length=200)
    dietary_restrictions: Optional[str] = Field(None, max_length=500)
    special_requests: Optional[str] = Field(None, max_length=500)


# ── Code Generation ─────────────────────────────────

RSVP_CODE_CHARS = string.ascii_uppercase + string.digits  # A-Z, 0-9
RSVP_CODE_LENGTH = 8  # e.g. "K7X3M9PQ" → nuru.tz/rsvp/K7X3M9PQ

def generate_rsvp_code() -> str:
    """Generate a short, URL-safe, cryptographically secure RSVP code."""
    return ''.join(secrets.choice(RSVP_CODE_CHARS) for _ in range(RSVP_CODE_LENGTH))


# ── Helpers ──────────────────────────────────────────

def _resolve_guest_name(inv: EventInvitation, db) -> str:
    """Return guest display name from invitation record."""
    if inv.guest_name:
        return inv.guest_name
    if inv.guest_type == GuestTypeEnum.user and inv.invited_user_id:
        user = db.query(User).filter(User.id == inv.invited_user_id).first()
        if user:
            parts = [user.first_name, user.last_name]
            return " ".join(p for p in parts if p) or "Guest"
    if inv.guest_type == GuestTypeEnum.contributor and inv.contributor_id:
        from models.contributions import UserContributor
        c = db.query(UserContributor).filter(UserContributor.id == inv.contributor_id).first()
        if c:
            return c.name or "Guest"
    return "Guest"


def _get_event_image(event: Event, db) -> Optional[str]:
    """Resolve event image using the standard fallback chain."""
    if event.cover_image_url:
        return event.cover_image_url
    img = db.query(EventImage).filter(
        EventImage.event_id == event.id,
        EventImage.is_featured == True
    ).first()
    if img:
        return img.image_url
    img = db.query(EventImage).filter(EventImage.event_id == event.id).first()
    if img:
        return img.image_url
    return None


# ── GET /rsvp/{code} ────────────────────────────────

@router.get("/{code}")
def get_rsvp_details(code: str):
    """Fetch event details and guest info for a given invitation code."""
    if not code or len(code) > 200:
        raise HTTPException(status_code=400, detail="Invalid invitation code")

    db = SessionLocal()
    try:
        inv = db.query(EventInvitation).filter(
            EventInvitation.invitation_code == code
        ).first()

        if not inv:
            return standard_response(False, "Invalid or expired invitation link", errors=["NOT_FOUND"])

        event = db.query(Event).filter(Event.id == inv.event_id).first()
        if not event:
            return standard_response(False, "Event not found", errors=["EVENT_NOT_FOUND"])

        # Get organizer name
        organizer = db.query(User).filter(User.id == event.organizer_id).first()
        organizer_name = ""
        if organizer:
            parts = [organizer.first_name, organizer.last_name]
            organizer_name = " ".join(p for p in parts if p)

        # Event settings for plus-ones config
        settings = db.query(EventSetting).filter(EventSetting.event_id == event.id).first()

        # Existing attendee record (if already responded)
        attendee = None
        if inv.guest_type == GuestTypeEnum.user and inv.invited_user_id:
            attendee = db.query(EventAttendee).filter(
                EventAttendee.event_id == event.id,
                EventAttendee.attendee_id == inv.invited_user_id
            ).first()
        elif inv.guest_type == GuestTypeEnum.contributor and inv.contributor_id:
            attendee = db.query(EventAttendee).filter(
                EventAttendee.event_id == event.id,
                EventAttendee.contributor_id == inv.contributor_id
            ).first()
        else:
            attendee = db.query(EventAttendee).filter(
                EventAttendee.invitation_id == inv.id
            ).first()

        # Existing plus-ones
        existing_plus_ones = []
        if attendee:
            plus_ones = db.query(EventGuestPlusOne).filter(
                EventGuestPlusOne.attendee_id == attendee.id
            ).all()
            existing_plus_ones = [
                {"name": po.name, "email": po.email, "phone": po.phone, "meal_preference": po.meal_preference}
                for po in plus_ones
            ]

        guest_name = _resolve_guest_name(inv, db)
        event_image = _get_event_image(event, db)

        data = {
            "invitation": {
                "id": str(inv.id),
                "code": inv.invitation_code,
                "rsvp_status": inv.rsvp_status.value if inv.rsvp_status else "pending",
                "guest_name": guest_name,
                "guest_type": inv.guest_type.value if inv.guest_type else "user",
            },
            "event": {
                "id": str(event.id),
                "name": event.name,
                "description": event.description,
                "start_date": event.start_date.isoformat() if event.start_date else None,
                "start_time": event.start_time.isoformat() if event.start_time else None,
                "end_date": event.end_date.isoformat() if event.end_date else None,
                "end_time": event.end_time.isoformat() if event.end_time else None,
                "location": event.location,
                "dress_code": event.dress_code,
                "special_instructions": event.special_instructions,
                "image_url": event_image,
                "organizer_name": organizer_name,
            },
            "settings": {
                "allow_plus_ones": settings.allow_plus_ones if settings else False,
                "max_plus_ones": settings.max_plus_ones if settings else 1,
                "require_meal_preference": settings.require_meal_preference if settings else False,
                "meal_options": settings.meal_options if settings else [],
            },
            "current_response": None,
        }

        if attendee:
            data["current_response"] = {
                "rsvp_status": attendee.rsvp_status.value if attendee.rsvp_status else "pending",
                "meal_preference": attendee.meal_preference,
                "dietary_restrictions": attendee.dietary_restrictions,
                "special_requests": attendee.special_requests,
                "plus_ones": existing_plus_ones,
            }

        return standard_response(True, "RSVP details retrieved", data=data)
    finally:
        db.close()


# ── POST /rsvp/{code}/respond ────────────────────────

@router.post("/{code}/respond")
def respond_to_rsvp(code: str, body: RSVPResponseInput):
    """Submit or update RSVP response for an invitation."""
    if not code or len(code) > 200:
        raise HTTPException(status_code=400, detail="Invalid invitation code")

    db = SessionLocal()
    try:
        inv = db.query(EventInvitation).filter(
            EventInvitation.invitation_code == code
        ).first()

        if not inv:
            return standard_response(False, "Invalid or expired invitation link", errors=["NOT_FOUND"])

        event = db.query(Event).filter(Event.id == inv.event_id).first()
        if not event:
            return standard_response(False, "Event not found", errors=["EVENT_NOT_FOUND"])

        rsvp_enum = RSVPStatusEnum.confirmed if body.rsvp_status == "confirmed" else RSVPStatusEnum.declined

        # Update invitation record
        inv.rsvp_status = rsvp_enum
        inv.rsvp_at = sql_func.now()

        # Find or create attendee record
        attendee = None
        if inv.guest_type == GuestTypeEnum.user and inv.invited_user_id:
            attendee = db.query(EventAttendee).filter(
                EventAttendee.event_id == event.id,
                EventAttendee.attendee_id == inv.invited_user_id
            ).first()
        elif inv.guest_type == GuestTypeEnum.contributor and inv.contributor_id:
            attendee = db.query(EventAttendee).filter(
                EventAttendee.event_id == event.id,
                EventAttendee.contributor_id == inv.contributor_id
            ).first()
        else:
            attendee = db.query(EventAttendee).filter(
                EventAttendee.invitation_id == inv.id
            ).first()

        if not attendee:
            attendee = EventAttendee(
                event_id=event.id,
                guest_type=inv.guest_type or GuestTypeEnum.user,
                attendee_id=inv.invited_user_id if inv.guest_type == GuestTypeEnum.user else None,
                contributor_id=inv.contributor_id if inv.guest_type == GuestTypeEnum.contributor else None,
                guest_name=inv.guest_name,
                invitation_id=inv.id,
                rsvp_status=rsvp_enum,
            )
            db.add(attendee)
        else:
            attendee.rsvp_status = rsvp_enum

        # Update preferences
        if body.meal_preference is not None:
            attendee.meal_preference = body.meal_preference
        if body.dietary_restrictions is not None:
            attendee.dietary_restrictions = body.dietary_restrictions
        if body.special_requests is not None:
            attendee.special_requests = body.special_requests


        db.commit()

        status_label = "confirmed" if rsvp_enum == RSVPStatusEnum.confirmed else "declined"
        return standard_response(True, f"Your RSVP has been {status_label} successfully", data={
            "rsvp_status": status_label,
            "event_name": event.name,
        })
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
