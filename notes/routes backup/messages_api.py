# backend/app/api/routes/messages_api.py
# MODULE 11: MESSAGES

import math
import uuid
from datetime import datetime

import pytz
from fastapi import APIRouter, Depends, Body, File, Form, UploadFile
from sqlalchemy import func as sa_func, or_, and_
from sqlalchemy.orm import Session

from core.database import get_db
from models import User, UserProfile, Conversation, Message
from utils.auth import get_current_user
from utils.helpers import standard_response

# Import conversation/message models
from sqlalchemy import Column, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from core.base import Base

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter()

def _user_preview(db: Session, user_id) -> dict | None:
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    return {
        "id": str(user.id),
        "name": f"{user.first_name} {user.last_name}",
        "avatar": profile.profile_picture_url if profile else None,
        "is_online": False,
    }


def _conversation_dict(db: Session, conv, current_user_id) -> dict:
    # Determine the other participant
    other_user_id = conv.user_two_id if str(conv.user_one_id) == str(current_user_id) else conv.user_one_id
    participant = _user_preview(db, other_user_id)

    # Last message
    last_msg = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.desc())
        .first()
    )

    # Unread count
    unread_count = (
        db.query(sa_func.count(Message.id))
        .filter(Message.conversation_id == conv.id, Message.sender_id != current_user_id, Message.is_read == False)
        .scalar()
    ) or 0

    return {
        "id": str(conv.id),
        "type": conv.type,
        "participant": participant,
        "context": {"type": "service", "id": str(conv.service_id)} if conv.service_id else None,
        "last_message": {
            "id": str(last_msg.id),
            "content": last_msg.message_text,
            "sender_id": str(last_msg.sender_id),
            "is_mine": str(last_msg.sender_id) == str(current_user_id),
            "created_at": last_msg.created_at.isoformat() if last_msg.created_at else None,
        } if last_msg else None,
        "unread_count": unread_count,
        "muted": False,
        "archived": False,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
    }


def _message_dict(msg, current_user_id) -> dict:
    return {
        "id": str(msg.id),
        "conversation_id": str(msg.conversation_id),
        "sender_id": str(msg.sender_id),
        "content": msg.message_text,
        "message_type": "text",
        "attachments": msg.attachments or [],
        "is_mine": str(msg.sender_id) == str(current_user_id),
        "is_read": msg.is_read,
        "read_at": None,
        "reply_to": str(msg.reply_to_id) if msg.reply_to_id else None,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


# =============================================================================
# 11.1 GET /messages/conversations — List conversations
# =============================================================================

@router.get("/conversations")
def list_conversations(
    page: int = 1,
    limit: int = 20,
    filter: str = "all",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Conversation).filter(
        or_(Conversation.user_one_id == current_user.id, Conversation.user_two_id == current_user.id),
        Conversation.is_active == True,
    ).order_by(Conversation.updated_at.desc())

    if filter == "service":
        query = query.filter(Conversation.service_id.isnot(None))

    total_items = query.count()
    total_pages = max(1, math.ceil(total_items / limit))
    offset = (page - 1) * limit
    conversations = query.offset(offset).limit(limit).all()

    # Total unread
    total_unread = 0
    convs_data = []
    for conv in conversations:
        d = _conversation_dict(db, conv, current_user.id)
        total_unread += d["unread_count"]
        convs_data.append(d)

    return standard_response(True, "Conversations retrieved", {
        "conversations": convs_data,
        "summary": {"total_conversations": total_items, "total_unread": total_unread},
        "pagination": {
            "page": page, "limit": limit, "total_items": total_items,
            "total_pages": total_pages, "has_next": page < total_pages, "has_previous": page > 1,
        },
    })


# =============================================================================
# 11.2 GET /messages/{conversationId} — Get messages
# =============================================================================

@router.get("/{conversation_id}")
def get_messages(
    conversation_id: str,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        return standard_response(False, "Invalid conversation ID.")

    conv = db.query(Conversation).filter(Conversation.id == cid).first()
    if not conv:
        return standard_response(False, "Conversation not found")

    if str(conv.user_one_id) != str(current_user.id) and str(conv.user_two_id) != str(current_user.id):
        return standard_response(False, "You are not part of this conversation")

    query = db.query(Message).filter(Message.conversation_id == cid).order_by(Message.created_at.asc())

    total_items = query.count()
    total_pages = max(1, math.ceil(total_items / limit))
    offset = (page - 1) * limit
    messages = query.offset(offset).limit(limit).all()

    other_user_id = conv.user_two_id if str(conv.user_one_id) == str(current_user.id) else conv.user_one_id

    return standard_response(True, "Messages retrieved", {
        "conversation": {
            "id": str(conv.id),
            "participant": _user_preview(db, other_user_id),
        },
        "messages": [_message_dict(m, current_user.id) for m in messages],
        "pagination": {
            "page": page, "limit": limit, "total_items": total_items,
            "total_pages": total_pages, "has_next": page < total_pages, "has_previous": page > 1,
        },
    })


# =============================================================================
# 11.3 POST /messages/{conversationId} — Send message
# =============================================================================

@router.post("/{conversation_id}")
def send_message(
    conversation_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        return standard_response(False, "Invalid conversation ID.")

    conv = db.query(Conversation).filter(Conversation.id == cid).first()
    if not conv:
        return standard_response(False, "Conversation not found")

    if str(conv.user_one_id) != str(current_user.id) and str(conv.user_two_id) != str(current_user.id):
        return standard_response(False, "You are not part of this conversation")

    content = body.get("content", "").strip()
    if not content:
        return standard_response(False, "Message content is required")
    if len(content) > 5000:
        return standard_response(False, "Message must be at most 5000 characters")

    now = datetime.now(EAT)

    reply_to_id = None
    if body.get("reply_to"):
        try:
            reply_to_id = uuid.UUID(body["reply_to"])
        except ValueError:
            pass

    msg = Message(
        id=uuid.uuid4(),
        conversation_id=cid,
        sender_id=current_user.id,
        message_text=content,
        attachments=body.get("attachments", []),
        is_read=False,
        reply_to_id=reply_to_id,
        created_at=now,
    )
    db.add(msg)
    conv.updated_at = now

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to send: {str(e)}")

    return standard_response(True, "Message sent", _message_dict(msg, current_user.id))


# =============================================================================
# 11.4 POST /messages/start — Start conversation
# =============================================================================

@router.post("/start")
def start_conversation(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipient_id = body.get("recipient_id")
    content = body.get("content", "").strip()

    if not recipient_id:
        return standard_response(False, "recipient_id is required")
    if not content:
        return standard_response(False, "content is required")

    try:
        rid = uuid.UUID(recipient_id)
    except ValueError:
        return standard_response(False, "Invalid recipient_id.")

    recipient = db.query(User).filter(User.id == rid).first()
    if not recipient:
        return standard_response(False, "Recipient not found")

    # Check existing conversation
    existing = db.query(Conversation).filter(
        or_(
            and_(Conversation.user_one_id == current_user.id, Conversation.user_two_id == rid),
            and_(Conversation.user_one_id == rid, Conversation.user_two_id == current_user.id),
        )
    ).first()

    now = datetime.now(EAT)

    if existing:
        conv = existing
        conv.is_active = True
        conv.updated_at = now
    else:
        conv_type = "user_to_service" if body.get("context_type") == "service" else "user_to_user"
        service_id = None
        if body.get("context_id") and body.get("context_type") == "service":
            try:
                service_id = uuid.UUID(body["context_id"])
            except ValueError:
                pass

        conv = Conversation(
            id=uuid.uuid4(),
            type=conv_type,
            user_one_id=current_user.id,
            user_two_id=rid,
            service_id=service_id,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        db.add(conv)

    msg = Message(
        id=uuid.uuid4(),
        conversation_id=conv.id,
        sender_id=current_user.id,
        message_text=content,
        is_read=False,
        created_at=now,
    )
    db.add(msg)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Conversation started", {
        "conversation_id": str(conv.id),
        "message": {
            "id": str(msg.id),
            "content": msg.message_text,
            "created_at": now.isoformat(),
        },
    })


# =============================================================================
# 11.5 PUT /messages/{conversationId}/read — Mark as read
# =============================================================================

@router.put("/{conversation_id}/read")
def mark_messages_read(
    conversation_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        return standard_response(False, "Invalid conversation ID.")

    # Mark all unread messages not sent by current user as read
    count = (
        db.query(Message)
        .filter(Message.conversation_id == cid, Message.sender_id != current_user.id, Message.is_read == False)
        .update({"is_read": True})
    )

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Messages marked as read", {"marked_count": count})


# =============================================================================
# 11.6 DELETE /messages/{conversationId}/messages/{messageId}
# =============================================================================

@router.delete("/{conversation_id}/messages/{message_id}")
def delete_message(
    conversation_id: str,
    message_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(conversation_id)
        mid = uuid.UUID(message_id)
    except ValueError:
        return standard_response(False, "Invalid ID format.")

    msg = db.query(Message).filter(Message.id == mid, Message.conversation_id == cid).first()
    if not msg:
        return standard_response(False, "Message not found")
    if str(msg.sender_id) != str(current_user.id):
        return standard_response(False, "You can only delete your own messages")

    db.delete(msg)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Message deleted")


# =============================================================================
# 11.7 POST /messages/{conversationId}/archive
# =============================================================================

@router.post("/{conversation_id}/archive")
def archive_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        return standard_response(False, "Invalid conversation ID.")

    conv = db.query(Conversation).filter(Conversation.id == cid).first()
    if not conv:
        return standard_response(False, "Conversation not found")

    conv.is_active = False
    conv.updated_at = datetime.now(EAT)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Conversation archived")


# =============================================================================
# 11.8 POST /messages/{conversationId}/mute
# =============================================================================

@router.post("/{conversation_id}/mute")
def mute_conversation(
    conversation_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Muting is a client-side preference in this implementation
    muted = body.get("muted", True)
    return standard_response(True, "Conversation muted" if muted else "Conversation unmuted", {
        "muted": muted,
        "muted_until": None,
    })


# =============================================================================
# Unread count
# =============================================================================

@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get all conversations the user is part of
    convs = db.query(Conversation).filter(
        or_(Conversation.user_one_id == current_user.id, Conversation.user_two_id == current_user.id),
    ).all()

    total_unread = 0
    for conv in convs:
        count = (
            db.query(sa_func.count(Message.id))
            .filter(Message.conversation_id == conv.id, Message.sender_id != current_user.id, Message.is_read == False)
            .scalar()
        ) or 0
        total_unread += count

    return standard_response(True, "Unread count retrieved", {"unread_count": total_unread})
