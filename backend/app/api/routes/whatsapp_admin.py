# WhatsApp Admin Routes - /admin/whatsapp/...
# Admin endpoints for WhatsApp conversation management
# Also internal endpoints for webhook to store messages

import os
import uuid
from datetime import datetime

import pytz
import requests
from fastapi import APIRouter, Depends, Body, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from core.database import get_db
from models import WAConversation, WAMessage, WAMessageDirectionEnum, WAMessageStatusEnum, AdminUser
from utils.helpers import standard_response, paginate

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(tags=["WhatsApp"])

# Import admin auth dependency from admin routes
from api.routes.admin import require_admin

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
WHATSAPP_SEND_URL = f"{SUPABASE_URL}/functions/v1/whatsapp-send" if SUPABASE_URL else ""


# ──────────────────────────────────────────────
# INTERNAL: Webhook stores incoming messages
# ──────────────────────────────────────────────

@router.post("/whatsapp/incoming")
def store_incoming_message(body: dict = Body(...), db: Session = Depends(get_db)):
    """Called by the whatsapp-webhook edge function to store an incoming message."""
    phone = (body.get("phone") or "").strip()
    content = (body.get("content") or "").strip()
    wa_message_id = body.get("wa_message_id")
    contact_name = body.get("contact_name", "")

    if not phone or not content:
        return standard_response(False, "Phone and content required")

    # Find or create conversation
    conv = db.query(WAConversation).filter(WAConversation.phone == phone).first()
    now = datetime.now(EAT)

    if not conv:
        conv = WAConversation(
            phone=phone,
            contact_name=contact_name or phone,
            last_message=content[:200],
            last_activity_at=now,
            unread_count=1,
        )
        db.add(conv)
        db.flush()
    else:
        if contact_name and (not conv.contact_name or conv.contact_name == conv.phone):
            conv.contact_name = contact_name
        conv.last_message = content[:200]
        conv.last_activity_at = now
        conv.unread_count = (conv.unread_count or 0) + 1

    # Check duplicate wa_message_id
    if wa_message_id:
        existing = db.query(WAMessage).filter(WAMessage.wa_message_id == wa_message_id).first()
        if existing:
            db.commit()
            return standard_response(True, "Duplicate message, skipped")

    msg = WAMessage(
        conversation_id=conv.id,
        wa_message_id=wa_message_id,
        direction=WAMessageDirectionEnum.inbound,
        content=content,
        status=WAMessageStatusEnum.delivered,
    )
    db.add(msg)
    db.commit()
    return standard_response(True, "Message stored", {"conversation_id": str(conv.id)})


@router.post("/whatsapp/status-update")
def store_status_update(body: dict = Body(...), db: Session = Depends(get_db)):
    """Called by the whatsapp-webhook edge function to update message status."""
    wa_message_id = body.get("wa_message_id")
    status = body.get("status")  # sent, delivered, read

    if not wa_message_id or not status:
        return standard_response(False, "wa_message_id and status required")

    msg = db.query(WAMessage).filter(WAMessage.wa_message_id == wa_message_id).first()
    if not msg:
        return standard_response(True, "Message not found, skipped")

    # Only update to a "higher" status
    status_order = {"sent": 0, "delivered": 1, "read": 2, "failed": -1}
    try:
        new_status = WAMessageStatusEnum(status)
    except ValueError:
        return standard_response(False, f"Unknown status: {status}")

    current_order = status_order.get(msg.status.value if msg.status else "sent", 0)
    new_order = status_order.get(status, 0)

    if new_order > current_order:
        msg.status = new_status
        db.commit()

    return standard_response(True, "Status updated")


# ──────────────────────────────────────────────
# ADMIN: Conversation management
# ──────────────────────────────────────────────

@router.get("/admin/whatsapp/conversations")
def list_wa_conversations(
    page: int = 1, limit: int = 30,
    q: str = None,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """List WhatsApp conversations sorted by most recent activity."""
    query = db.query(WAConversation).filter(WAConversation.is_active == True)
    if q:
        search = f"%{q}%"
        query = query.filter(
            WAConversation.contact_name.ilike(search) |
            WAConversation.phone.ilike(search)
        )
    query = query.order_by(desc(WAConversation.last_activity_at), desc(WAConversation.id))
    items, pagination = paginate(query, page, limit)

    data = [{
        "id": str(c.id),
        "phone": c.phone,
        "contact_name": c.contact_name or c.phone,
        "last_message": c.last_message or "",
        "last_activity_at": c.last_activity_at.isoformat() if c.last_activity_at else None,
        "unread_count": c.unread_count or 0,
    } for c in items]

    return standard_response(True, "Conversations retrieved", data, pagination=pagination)


@router.get("/admin/whatsapp/conversations/{conversation_id}/messages")
def get_wa_messages(
    conversation_id: str,
    page: int = 1, limit: int = 50,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Get paginated messages for a WhatsApp conversation."""
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        return standard_response(False, "Invalid conversation ID")

    conv = db.query(WAConversation).filter(WAConversation.id == cid).first()
    if not conv:
        return standard_response(False, "Conversation not found")

    query = db.query(WAMessage).filter(
        WAMessage.conversation_id == cid
    ).order_by(desc(WAMessage.created_at), desc(WAMessage.id))

    items, pagination = paginate(query, page, limit)

    data = [{
        "id": str(m.id),
        "direction": m.direction.value if m.direction else "inbound",
        "content": m.content,
        "status": m.status.value if m.status else "sent",
        "wa_message_id": m.wa_message_id,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    } for m in reversed(items)]  # reverse so oldest first

    return standard_response(True, "Messages retrieved", data, pagination=pagination)


@router.post("/admin/whatsapp/conversations/{conversation_id}/send")
def send_wa_message(
    conversation_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Admin sends a WhatsApp message to a conversation."""
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        return standard_response(False, "Invalid conversation ID")

    conv = db.query(WAConversation).filter(WAConversation.id == cid).first()
    if not conv:
        return standard_response(False, "Conversation not found")

    content = (body.get("content") or "").strip()
    if not content:
        return standard_response(False, "Message content is required")

    # Send via whatsapp-send edge function
    wa_message_id = None
    if WHATSAPP_SEND_URL and SUPABASE_ANON_KEY:
        try:
            resp = requests.post(
                WHATSAPP_SEND_URL,
                json={"action": "text", "phone": conv.phone, "params": {"message": content}},
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                    "apikey": SUPABASE_ANON_KEY,
                },
                timeout=15,
            )
            if resp.ok:
                result = resp.json()
                wa_message_id = result.get("message_id")
            else:
                return standard_response(False, f"WhatsApp API failed: {resp.text[:200]}")
        except Exception as e:
            return standard_response(False, f"Failed to send WhatsApp message: {str(e)}")
    else:
        return standard_response(False, "WhatsApp sending is not configured")

    now = datetime.now(EAT)
    msg = WAMessage(
        conversation_id=cid,
        wa_message_id=wa_message_id,
        direction=WAMessageDirectionEnum.outbound,
        content=content,
        status=WAMessageStatusEnum.sent,
    )
    db.add(msg)
    conv.last_message = content[:200]
    conv.last_activity_at = now
    db.commit()
    db.refresh(msg)

    return standard_response(True, "Message sent", {
        "id": str(msg.id),
        "content": msg.content,
        "direction": "outbound",
        "status": "sent",
        "wa_message_id": wa_message_id,
        "created_at": msg.created_at.isoformat() if msg.created_at else now.isoformat(),
    })


@router.put("/admin/whatsapp/conversations/{conversation_id}/read")
def mark_wa_conversation_read(
    conversation_id: str,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """Mark all messages in a conversation as read and reset unread count."""
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        return standard_response(False, "Invalid conversation ID")

    conv = db.query(WAConversation).filter(WAConversation.id == cid).first()
    if not conv:
        return standard_response(False, "Conversation not found")

    conv.unread_count = 0
    db.commit()
    return standard_response(True, "Conversation marked as read")
