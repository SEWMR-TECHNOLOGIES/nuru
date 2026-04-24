"""Admin contact-message routes.

Mounted under /admin/contact-messages/*.
Requires the standard admin JWT (re-uses _get_admin_from_token from admin.py).
"""
import uuid
from datetime import datetime
from typing import Optional

import pytz
from fastapi import APIRouter, Depends, Body, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from core.database import get_db
from models.contact import ContactMessage
from models import AdminUser
from api.routes.admin import _get_admin_from_token
from utils.helpers import standard_response, paginate

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/admin/contact-messages", tags=["Admin · Contact"])


def _require_admin(request: Request, db: Session) -> AdminUser:
    auth = request.headers.get("authorization") or ""
    token = auth.split(" ", 1)[1].strip() if auth.lower().startswith("bearer ") else ""
    return _get_admin_from_token(token, db)


def _serialise(m: ContactMessage) -> dict:
    return {
        "id": str(m.id),
        "first_name": m.first_name,
        "last_name": m.last_name,
        "email": m.email,
        "phone": m.phone,
        "subject": m.subject,
        "message": m.message,
        "source_page": m.source_page,
        "source_host": m.source_host,
        "status": m.status,
        "is_archived": bool(m.is_archived),
        "admin_notes": m.admin_notes,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


@router.get("")
def list_contact_messages(
    request: Request,
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    _require_admin(request, db)

    query = db.query(ContactMessage)
    if status and status in ("new", "read", "replied", "archived"):
        query = query.filter(ContactMessage.status == status)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(
            ContactMessage.first_name.ilike(like),
            ContactMessage.last_name.ilike(like),
            ContactMessage.email.ilike(like),
            ContactMessage.subject.ilike(like),
            ContactMessage.message.ilike(like),
        ))
    query = query.order_by(desc(ContactMessage.created_at))
    items, pagination = paginate(query, page, limit)
    return standard_response(
        True,
        "Contact messages retrieved",
        [_serialise(m) for m in items],
        pagination=pagination,
    )


@router.get("/stats")
def contact_message_stats(request: Request, db: Session = Depends(get_db)):
    _require_admin(request, db)
    base = db.query(ContactMessage)
    return standard_response(True, "Stats", {
        "total": base.count(),
        "new": base.filter(ContactMessage.status == "new").count(),
        "read": base.filter(ContactMessage.status == "read").count(),
        "replied": base.filter(ContactMessage.status == "replied").count(),
        "archived": base.filter(ContactMessage.status == "archived").count(),
    })


@router.get("/{message_id}")
def get_contact_message(message_id: str, request: Request, db: Session = Depends(get_db)):
    admin = _require_admin(request, db)
    try:
        mid = uuid.UUID(message_id)
    except ValueError:
        return standard_response(False, "Invalid message ID")
    m = db.query(ContactMessage).filter(ContactMessage.id == mid).first()
    if not m:
        return standard_response(False, "Message not found")
    # Auto-mark as read on first open
    if m.status == "new":
        m.status = "read"
        m.handled_by_admin_id = admin.id
        m.updated_at = datetime.now(EAT)
        db.commit()
    return standard_response(True, "Message retrieved", _serialise(m))


@router.put("/{message_id}/status")
def update_contact_status(
    message_id: str,
    request: Request,
    body: dict = Body(...),
    db: Session = Depends(get_db),
):
    admin = _require_admin(request, db)
    try:
        mid = uuid.UUID(message_id)
    except ValueError:
        return standard_response(False, "Invalid message ID")
    new_status = (body.get("status") or "").strip().lower()
    if new_status not in ("new", "read", "replied", "archived"):
        return standard_response(False, "Invalid status")
    m = db.query(ContactMessage).filter(ContactMessage.id == mid).first()
    if not m:
        return standard_response(False, "Message not found")
    m.status = new_status
    m.is_archived = (new_status == "archived")
    m.handled_by_admin_id = admin.id
    m.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Status updated", _serialise(m))


@router.put("/{message_id}/notes")
def update_admin_notes(
    message_id: str,
    request: Request,
    body: dict = Body(...),
    db: Session = Depends(get_db),
):
    admin = _require_admin(request, db)
    try:
        mid = uuid.UUID(message_id)
    except ValueError:
        return standard_response(False, "Invalid message ID")
    notes = (body.get("notes") or "").strip()[:4000]
    m = db.query(ContactMessage).filter(ContactMessage.id == mid).first()
    if not m:
        return standard_response(False, "Message not found")
    m.admin_notes = notes
    m.handled_by_admin_id = admin.id
    m.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Notes saved")


@router.delete("/{message_id}")
def delete_contact_message(message_id: str, request: Request, db: Session = Depends(get_db)):
    _require_admin(request, db)
    try:
        mid = uuid.UUID(message_id)
    except ValueError:
        return standard_response(False, "Invalid message ID")
    m = db.query(ContactMessage).filter(ContactMessage.id == mid).first()
    if not m:
        return standard_response(False, "Message not found")
    db.delete(m)
    db.commit()
    return standard_response(True, "Message deleted")
