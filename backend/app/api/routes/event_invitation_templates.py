"""
Event Invitation Card Designer Templates

Layer-based Canva-style invitation card designs (shared between web & mobile).
Renders per-guest with dynamic placeholders ({{guest_name}}, {{qr_code}}, etc).
"""
from typing import Optional
from uuid import UUID as UUIDType

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy import and_
from sqlalchemy.orm import Session

from core.database import get_db
from models import (
    Event,
    EventAttendee,
    EventInvitation,
    User,
    UserContributor,
)
from models.event_invitation_card_template import EventInvitationCardTemplate
from utils.auth import get_current_user
from utils.helpers import standard_response

router = APIRouter(tags=["Invitation Card Designer"])


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _payload(t: EventInvitationCardTemplate) -> dict:
    return {
        "id": str(t.id),
        "event_id": str(t.event_id),
        "organizer_id": str(t.organizer_id),
        "name": t.name,
        "design_json": t.design_json or {},
        "preview_image_url": t.preview_image_url,
        "is_active": bool(t.is_active),
        "canvas_width": int(t.canvas_width),
        "canvas_height": int(t.canvas_height),
        "status": t.status,
        "platform": t.platform,
        "version": int(t.version),
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


def _assert_event_owner(db: Session, event_id: str, user: User) -> Event:
    try:
        eid = UUIDType(str(event_id))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event id")
    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if str(event.organizer_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Only organizer can manage invitation card designs")
    return event


def _guest_name_for_attendee(db: Session, attendee: EventAttendee) -> str:
    if getattr(attendee, "guest_name", None):
        return attendee.guest_name
    if getattr(attendee, "attendee_id", None):
        u = db.query(User).filter(User.id == attendee.attendee_id).first()
        if u:
            return f"{u.first_name or ''} {u.last_name or ''}".strip() or "Guest"
    if getattr(attendee, "contributor_id", None):
        c = db.query(UserContributor).filter(UserContributor.id == attendee.contributor_id).first()
        if c and c.name:
            return c.name
    return "Guest"


# ──────────────────────────────────────────────
# CRUD endpoints
# ──────────────────────────────────────────────

@router.get("/events/{event_id}/invitation-templates")
def list_templates(event_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _assert_event_owner(db, event_id, user)
    rows = (
        db.query(EventInvitationCardTemplate)
        .filter(EventInvitationCardTemplate.event_id == event_id)
        .order_by(EventInvitationCardTemplate.updated_at.desc())
        .all()
    )
    return standard_response(True, "Templates", [_payload(r) for r in rows])


@router.get("/events/{event_id}/invitation-templates/active")
def get_active(event_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _assert_event_owner(db, event_id, user)
    row = (
        db.query(EventInvitationCardTemplate)
        .filter(and_(
            EventInvitationCardTemplate.event_id == event_id,
            EventInvitationCardTemplate.is_active == True,
        ))
        .first()
    )
    return standard_response(True, "Active template", _payload(row) if row else None)


@router.post("/events/{event_id}/invitation-templates")
def create_template(
    event_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    event = _assert_event_owner(db, event_id, user)
    name = (body.get("name") or "Untitled design").strip()[:120]

    # pre-insert duplicate check on (event_id, name)
    existing = (
        db.query(EventInvitationCardTemplate)
        .filter(and_(
            EventInvitationCardTemplate.event_id == event.id,
            EventInvitationCardTemplate.name == name,
        ))
        .first()
    )
    if existing:
        # treat as upsert -> update design_json instead of erroring
        if "design_json" in body:
            existing.design_json = body.get("design_json") or {}
        if "canvas_width" in body:
            existing.canvas_width = int(body["canvas_width"])
        if "canvas_height" in body:
            existing.canvas_height = int(body["canvas_height"])
        if "preview_image_url" in body:
            existing.preview_image_url = body.get("preview_image_url")
        db.commit()
        db.refresh(existing)
        return standard_response(True, "Template updated", _payload(existing))

    row = EventInvitationCardTemplate(
        event_id=event.id,
        organizer_id=user.id,
        name=name,
        design_json=body.get("design_json") or {},
        preview_image_url=body.get("preview_image_url"),
        canvas_width=int(body.get("canvas_width") or 1080),
        canvas_height=int(body.get("canvas_height") or 1350),
        status=body.get("status") or "draft",
        platform=body.get("platform") or "web",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return standard_response(True, "Template created", _payload(row))


@router.put("/events/{event_id}/invitation-templates/{template_id}")
def update_template(
    event_id: str,
    template_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _assert_event_owner(db, event_id, user)
    row = db.query(EventInvitationCardTemplate).filter(and_(
        EventInvitationCardTemplate.id == template_id,
        EventInvitationCardTemplate.event_id == event_id,
    )).first()
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")

    for field in ("name", "preview_image_url", "status", "platform"):
        if field in body and body[field] is not None:
            setattr(row, field, body[field])
    if "design_json" in body and body["design_json"] is not None:
        row.design_json = body["design_json"]
    if "canvas_width" in body:
        row.canvas_width = int(body["canvas_width"])
    if "canvas_height" in body:
        row.canvas_height = int(body["canvas_height"])

    db.commit()
    db.refresh(row)
    return standard_response(True, "Template updated", _payload(row))


@router.post("/events/{event_id}/invitation-templates/{template_id}/activate")
def activate_template(
    event_id: str,
    template_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _assert_event_owner(db, event_id, user)
    row = db.query(EventInvitationCardTemplate).filter(and_(
        EventInvitationCardTemplate.id == template_id,
        EventInvitationCardTemplate.event_id == event_id,
    )).first()
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    # deactivate all others first
    (
        db.query(EventInvitationCardTemplate)
        .filter(and_(
            EventInvitationCardTemplate.event_id == event_id,
            EventInvitationCardTemplate.id != row.id,
        ))
        .update({EventInvitationCardTemplate.is_active: False}, synchronize_session=False)
    )
    row.is_active = True
    row.status = "published"
    db.commit()
    db.refresh(row)
    return standard_response(True, "Template activated", _payload(row))


@router.post("/events/{event_id}/invitation-templates/{template_id}/duplicate")
def duplicate_template(
    event_id: str,
    template_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _assert_event_owner(db, event_id, user)
    src = db.query(EventInvitationCardTemplate).filter(and_(
        EventInvitationCardTemplate.id == template_id,
        EventInvitationCardTemplate.event_id == event_id,
    )).first()
    if not src:
        raise HTTPException(status_code=404, detail="Template not found")
    # find a free name
    base_name = f"{src.name} (copy)"
    name = base_name
    n = 2
    while db.query(EventInvitationCardTemplate).filter(and_(
        EventInvitationCardTemplate.event_id == event_id,
        EventInvitationCardTemplate.name == name,
    )).first():
        name = f"{base_name} {n}"
        n += 1

    copy = EventInvitationCardTemplate(
        event_id=src.event_id,
        organizer_id=user.id,
        name=name,
        design_json=src.design_json,
        preview_image_url=src.preview_image_url,
        canvas_width=src.canvas_width,
        canvas_height=src.canvas_height,
        status="draft",
        platform=src.platform,
        is_active=False,
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return standard_response(True, "Template duplicated", _payload(copy))


@router.delete("/events/{event_id}/invitation-templates/{template_id}")
def delete_template(
    event_id: str,
    template_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _assert_event_owner(db, event_id, user)
    row = db.query(EventInvitationCardTemplate).filter(and_(
        EventInvitationCardTemplate.id == template_id,
        EventInvitationCardTemplate.event_id == event_id,
    )).first()
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(row)
    db.commit()
    return standard_response(True, "Template deleted", {"id": str(template_id)})


# ──────────────────────────────────────────────
# Guest card endpoint - returns active template + per-guest context for client render
# ──────────────────────────────────────────────

def _safe_dt(value, fmt: str) -> str:
    try:
        return value.strftime(fmt) if value else ""
    except Exception:
        return ""


@router.get("/invites/{invite_id}/card")
def guest_card_data(invite_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Return active design + dynamic context for a single invite (guest download)."""
    invite = db.query(EventInvitation).filter(EventInvitation.id == invite_id).first()
    attendee = None
    if invite is None:
        # also accept attendee id as fallback
        attendee = db.query(EventAttendee).filter(EventAttendee.id == invite_id).first()
        if not attendee:
            raise HTTPException(status_code=404, detail="Invite not found")
        event = db.query(Event).filter(Event.id == attendee.event_id).first()
    else:
        event = db.query(Event).filter(Event.id == invite.event_id).first()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Authorization: organizer OR the invited user themselves
    is_owner = str(event.organizer_id) == str(user.id)
    if not is_owner and attendee and getattr(attendee, "attendee_id", None) and str(attendee.attendee_id) != str(user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    template = (
        db.query(EventInvitationCardTemplate)
        .filter(and_(
            EventInvitationCardTemplate.event_id == event.id,
            EventInvitationCardTemplate.is_active == True,
        ))
        .first()
    )

    organizer = db.query(User).filter(User.id == event.organizer_id).first()
    organizer_name = (
        f"{organizer.first_name or ''} {organizer.last_name or ''}".strip() if organizer else ""
    )

    guest_name = _guest_name_for_attendee(db, attendee) if attendee else "Guest"
    invite_code = (
        getattr(invite, "invitation_code", None)
        or getattr(attendee, "rsvp_code", None)
        or str(invite_id)
    )

    context = {
        "guest_name": guest_name,
        "event_title": event.title or "",
        "event_date": _safe_dt(event.start_date, "%A, %d %B %Y"),
        "event_time": _safe_dt(event.start_date, "%I:%M %p"),
        "event_location": getattr(event, "venue_name", None) or getattr(event, "location", "") or "",
        "organizer_name": organizer_name,
        "invite_code": invite_code,
    }
    qr_payload = invite_code

    return standard_response(True, "Card data", {
        "template": _payload(template) if template else None,
        "context": context,
        "qr_payload": qr_payload,
    })
