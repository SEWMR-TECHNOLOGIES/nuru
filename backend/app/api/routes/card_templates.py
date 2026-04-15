import os
import uuid
from datetime import datetime
from typing import Optional

import httpx
import pytz
from fastapi import APIRouter, Depends, File, Form, UploadFile, Body
from sqlalchemy.orm import Session

from core.config import UPLOAD_SERVICE_URL
from core.database import get_db
from models import (
    InvitationCardTemplate,
    Event,
    EventAttendee,
    EventInvitation,
    User,
    UserContributor,
    RSVPStatusEnum,
)
from utils.auth import get_current_user
from utils.helpers import standard_response, delete_storage_file_sync

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(tags=["Card Templates"])


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _template_payload(t: InvitationCardTemplate) -> dict:
    return {
        "id": str(t.id),
        "user_id": str(t.user_id),
        "name": t.name,
        "description": t.description,
        "pdf_url": t.pdf_url,
        "thumbnail_url": t.thumbnail_url,
        "name_placeholder_x": float(t.name_placeholder_x) if t.name_placeholder_x is not None else 50,
        "name_placeholder_y": float(t.name_placeholder_y) if t.name_placeholder_y is not None else 35,
        "name_font_size": float(t.name_font_size) if t.name_font_size is not None else 16,
        "name_font_color": t.name_font_color or "#000000",
        "qr_placeholder_x": float(t.qr_placeholder_x) if t.qr_placeholder_x is not None else 50,
        "qr_placeholder_y": float(t.qr_placeholder_y) if t.qr_placeholder_y is not None else 75,
        "qr_size": float(t.qr_size) if t.qr_size is not None else 80,
        "is_active": bool(t.is_active),
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


def _safe_num(raw: Optional[str], fallback: float) -> float:
    if raw is None or str(raw).strip() == "":
        return fallback
    try:
        return float(raw)
    except Exception:
        return fallback


def _guest_name_for_attendee(db: Session, attendee: EventAttendee) -> str:
    if attendee.guest_name:
        return attendee.guest_name

    if attendee.attendee_id:
        user = db.query(User).filter(User.id == attendee.attendee_id).first()
        if user:
            return f"{user.first_name} {user.last_name}".strip()

    if attendee.contributor_id:
        contributor = db.query(UserContributor).filter(UserContributor.id == attendee.contributor_id).first()
        if contributor and contributor.name:
            return contributor.name

    return "Guest"


# ──────────────────────────────────────────────
# Template CRUD
# ──────────────────────────────────────────────

@router.get("/card-templates")
def list_card_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(InvitationCardTemplate)
        .filter(InvitationCardTemplate.user_id == current_user.id)
        .order_by(InvitationCardTemplate.created_at.desc())
        .all()
    )
    return standard_response(True, "Card templates retrieved", [_template_payload(t) for t in rows])


@router.get("/card-templates/{template_id}")
def get_card_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        tid = uuid.UUID(template_id)
    except ValueError:
        return standard_response(False, "Invalid template ID")

    t = db.query(InvitationCardTemplate).filter(
        InvitationCardTemplate.id == tid,
        InvitationCardTemplate.user_id == current_user.id,
    ).first()
    if not t:
        return standard_response(False, "Template not found")

    return standard_response(True, "Template retrieved", _template_payload(t))


@router.post("/card-templates")
async def create_card_template(
    pdf: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    name_placeholder_x: Optional[str] = Form(None),
    name_placeholder_y: Optional[str] = Form(None),
    name_font_size: Optional[str] = Form(None),
    name_font_color: Optional[str] = Form(None),
    qr_placeholder_x: Optional[str] = Form(None),
    qr_placeholder_y: Optional[str] = Form(None),
    qr_size: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not pdf or not pdf.filename:
        return standard_response(False, "PDF file is required")

    if not pdf.filename.lower().endswith(".pdf") or pdf.content_type != "application/pdf":
        return standard_response(False, "Only PDF files are allowed")

    content = await pdf.read()
    if not content:
        return standard_response(False, "Empty file")

    _, ext = os.path.splitext(pdf.filename)
    unique_name = f"{uuid.uuid4().hex}{ext or '.pdf'}"

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                UPLOAD_SERVICE_URL,
                data={"target_path": f"nuru/uploads/card-templates/{current_user.id}/"},
                files={"file": (unique_name, content, "application/pdf")},
                timeout=20,
            )
            result = resp.json()
        except Exception as e:
            return standard_response(False, f"Upload failed: {str(e)}")

    if not result.get("success"):
        return standard_response(False, result.get("message", "Upload failed"))

    now = datetime.now(EAT)
    t = InvitationCardTemplate(
        id=uuid.uuid4(),
        user_id=current_user.id,
        name=name.strip(),
        description=description.strip() if description else None,
        pdf_url=result["data"]["url"],
        thumbnail_url=None,
        name_placeholder_x=_safe_num(name_placeholder_x, 50),
        name_placeholder_y=_safe_num(name_placeholder_y, 35),
        name_font_size=_safe_num(name_font_size, 16),
        name_font_color=(name_font_color or "#000000").strip(),
        qr_placeholder_x=_safe_num(qr_placeholder_x, 50),
        qr_placeholder_y=_safe_num(qr_placeholder_y, 75),
        qr_size=_safe_num(qr_size, 80),
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(t)
    db.commit()
    db.refresh(t)

    return standard_response(True, "Card template created", _template_payload(t))


@router.put("/card-templates/{template_id}")
def update_card_template(
    template_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        tid = uuid.UUID(template_id)
    except ValueError:
        return standard_response(False, "Invalid template ID")

    t = db.query(InvitationCardTemplate).filter(
        InvitationCardTemplate.id == tid,
        InvitationCardTemplate.user_id == current_user.id,
    ).first()
    if not t:
        return standard_response(False, "Template not found")

    if "name" in body and body.get("name"):
        t.name = str(body.get("name")).strip()
    if "description" in body:
        t.description = body.get("description")
    if "name_placeholder_x" in body:
        t.name_placeholder_x = _safe_num(str(body.get("name_placeholder_x")), 50)
    if "name_placeholder_y" in body:
        t.name_placeholder_y = _safe_num(str(body.get("name_placeholder_y")), 35)
    if "name_font_size" in body:
        t.name_font_size = _safe_num(str(body.get("name_font_size")), 16)
    if "name_font_color" in body and body.get("name_font_color"):
        t.name_font_color = str(body.get("name_font_color")).strip()
    if "qr_placeholder_x" in body:
        t.qr_placeholder_x = _safe_num(str(body.get("qr_placeholder_x")), 50)
    if "qr_placeholder_y" in body:
        t.qr_placeholder_y = _safe_num(str(body.get("qr_placeholder_y")), 75)
    if "qr_size" in body:
        t.qr_size = _safe_num(str(body.get("qr_size")), 80)
    if "is_active" in body:
        t.is_active = bool(body.get("is_active"))

    t.updated_at = datetime.now(EAT)
    db.commit()
    db.refresh(t)

    return standard_response(True, "Template updated", _template_payload(t))


@router.delete("/card-templates/{template_id}")
def delete_card_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        tid = uuid.UUID(template_id)
    except ValueError:
        return standard_response(False, "Invalid template ID")

    t = db.query(InvitationCardTemplate).filter(
        InvitationCardTemplate.id == tid,
        InvitationCardTemplate.user_id == current_user.id,
    ).first()
    if not t:
        return standard_response(False, "Template not found")

    # Unassign from events first
    rows = db.query(Event).filter(Event.card_template_id == tid).all()
    for ev in rows:
        ev.card_template_id = None

    file_url = t.pdf_url
    db.delete(t)
    db.commit()

    delete_storage_file_sync(file_url)
    return standard_response(True, "Template deleted")


# ──────────────────────────────────────────────
# Event assignment + filled card download payload
# ──────────────────────────────────────────────

@router.put("/events/{event_id}/card-template")
def assign_template_to_event(
    event_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    if str(event.organizer_id) != str(current_user.id):
        return standard_response(False, "You do not have permission to update this event")

    template_id = body.get("card_template_id")
    if template_id is None:
        event.card_template_id = None
    else:
        try:
            tid = uuid.UUID(str(template_id))
        except ValueError:
            return standard_response(False, "Invalid template ID")

        t = db.query(InvitationCardTemplate).filter(
            InvitationCardTemplate.id == tid,
            InvitationCardTemplate.user_id == current_user.id,
            InvitationCardTemplate.is_active == True,
        ).first()
        if not t:
            return standard_response(False, "Template not found or inactive")

        event.card_template_id = t.id

    event.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Event card template updated")


@router.get("/events/{event_id}/card-template")
def get_event_template(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    if str(event.organizer_id) != str(current_user.id):
        return standard_response(False, "You do not have permission to view this event template")

    if not event.card_template:
        return standard_response(True, "No template assigned", None)

    return standard_response(True, "Event template retrieved", _template_payload(event.card_template))


@router.get("/events/{event_id}/invitation-card/{attendee_id}/download")
def get_filled_card_download_payload(
    event_id: str,
    attendee_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns data to generate/download a guest invitation card.
    Enforces that only confirmed guests can be downloaded/printed.
    """
    try:
        eid = uuid.UUID(event_id)
        aid = uuid.UUID(attendee_id)
    except ValueError:
        return standard_response(False, "Invalid ID format")

    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")

    attendee = db.query(EventAttendee).filter(
        EventAttendee.id == aid,
        EventAttendee.event_id == eid,
    ).first()
    if not attendee:
        return standard_response(False, "Attendee not found")

    # Allow organizer or the attendee user themselves
    is_organizer = str(event.organizer_id) == str(current_user.id)
    is_self = attendee.attendee_id and str(attendee.attendee_id) == str(current_user.id)
    if not is_organizer and not is_self:
        return standard_response(False, "You do not have permission to download this invitation")

    rsvp_status = attendee.rsvp_status.value if hasattr(attendee.rsvp_status, "value") else str(attendee.rsvp_status)
    if rsvp_status != RSVPStatusEnum.confirmed.value:
        return standard_response(False, "Only confirmed guests can download/print invitation cards")

    invitation = db.query(EventInvitation).filter(EventInvitation.id == attendee.invitation_id).first() if attendee.invitation_id else None
    invitation_code = invitation.invitation_code if invitation else None
    qr_data = f"nuru://event/{event_id}/checkin/{attendee_id}" if attendee_id else f"nuru://event/{event_id}/rsvp/{invitation_code}" if invitation_code else f"nuru://event/{event_id}"

    template_payload = _template_payload(event.card_template) if event.card_template else None

    return standard_response(True, "Invitation card download payload ready", {
        "pdf_url": template_payload.get("pdf_url") if template_payload else None,
        "use_default_template": template_payload is None,
        "guest_name": _guest_name_for_attendee(db, attendee),
        "attendee_id": str(attendee.id),
        "rsvp_status": rsvp_status,
        "qr_code_data": qr_data,
        "invitation_code": invitation_code,
        "template": template_payload,
    })
