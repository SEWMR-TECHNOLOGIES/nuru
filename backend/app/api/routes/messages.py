# Messages Routes - /messages/...
# Handles messaging/conversations between users

import uuid
from datetime import datetime

import pytz
from fastapi import APIRouter, Depends, Body
from sqlalchemy import func as sa_func, or_
from sqlalchemy.orm import Session

from core.database import get_db
from models import Conversation, Message, User, UserProfile
from models.enums import ConversationTypeEnum
from utils.auth import get_current_user
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/messages", tags=["Messages"])


def _conversation_dict(db, conv, current_user_id):
    """Build conversation summary with other participant info."""
    other_id = conv.user_two_id if str(conv.user_one_id) == str(current_user_id) else conv.user_one_id
    other = db.query(User).filter(User.id == other_id).first()
    profile = db.query(UserProfile).filter(UserProfile.user_id == other_id).first() if other else None

    last_msg = db.query(Message).filter(Message.conversation_id == conv.id).order_by(Message.created_at.desc()).first()
    unread = db.query(sa_func.count(Message.id)).filter(
        Message.conversation_id == conv.id,
        Message.sender_id != current_user_id,
        Message.is_read == False
    ).scalar() or 0

    return {
        "id": str(conv.id),
        "participant": {
            "id": str(other.id) if other else None,
            "name": f"{other.first_name} {other.last_name}" if other else None,
            "avatar": profile.profile_picture_url if profile else None,
        },
        "last_message": {
            "content": last_msg.message_text if last_msg else None,
            "sent_at": last_msg.created_at.isoformat() if last_msg else None,
            "is_mine": str(last_msg.sender_id) == str(current_user_id) if last_msg else False,
        } if last_msg else None,
        "unread_count": unread,
        "is_active": conv.is_active,
        "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
    }


@router.get("/unread/count")
def get_unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns total unread message count across all conversations."""
    conv_ids = [
        r[0] for r in db.query(Conversation.id).filter(
            or_(Conversation.user_one_id == current_user.id, Conversation.user_two_id == current_user.id)
        ).all()
    ]
    if not conv_ids:
        return standard_response(True, "Unread count retrieved", {"count": 0})

    count = db.query(sa_func.count(Message.id)).filter(
        Message.conversation_id.in_(conv_ids),
        Message.sender_id != current_user.id,
        Message.is_read == False
    ).scalar() or 0
    return standard_response(True, "Unread count retrieved", {"count": count})


@router.get("/")
def get_conversations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns all conversations for the current user."""
    convs = db.query(Conversation).filter(
        or_(Conversation.user_one_id == current_user.id, Conversation.user_two_id == current_user.id),
        Conversation.is_active == True
    ).order_by(Conversation.updated_at.desc()).all()
    return standard_response(True, "Conversations retrieved successfully", [_conversation_dict(db, c, current_user.id) for c in convs])


@router.get("/{conversation_id}")
def get_messages(conversation_id: str, page: int = 1, limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns paginated messages for a conversation."""
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        return standard_response(False, "Invalid conversation ID")

    conv = db.query(Conversation).filter(Conversation.id == cid).first()
    if not conv:
        return standard_response(False, "Conversation not found")

    if str(conv.user_one_id) != str(current_user.id) and str(conv.user_two_id) != str(current_user.id):
        return standard_response(False, "You are not a participant in this conversation")

    messages = db.query(Message).filter(Message.conversation_id == cid).order_by(Message.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    data = [{
        "id": str(m.id),
        "content": m.message_text,
        "sender_id": str(m.sender_id),
        "is_mine": str(m.sender_id) == str(current_user.id),
        "is_read": m.is_read,
        "reply_to_id": str(m.reply_to_id) if m.reply_to_id else None,
        "attachments": m.attachments or [],
        "created_at": m.created_at.isoformat() if m.created_at else None,
    } for m in reversed(messages)]

    return standard_response(True, "Messages retrieved successfully", data)


@router.post("/{conversation_id}")
def send_message(conversation_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Sends a message in an existing conversation."""
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        return standard_response(False, "Invalid conversation ID")

    conv = db.query(Conversation).filter(Conversation.id == cid).first()
    if not conv:
        return standard_response(False, "Conversation not found")

    if str(conv.user_one_id) != str(current_user.id) and str(conv.user_two_id) != str(current_user.id):
        return standard_response(False, "You are not a participant in this conversation")

    content = body.get("content", "").strip()
    if not content:
        return standard_response(False, "Message content is required")

    now = datetime.now(EAT)
    msg = Message(
        conversation_id=cid,
        sender_id=current_user.id,
        message_text=content,
        is_read=False,
        reply_to_id=uuid.UUID(body["reply_to_id"]) if body.get("reply_to_id") else None,
        attachments=body.get("attachments"),
    )
    db.add(msg)
    conv.updated_at = now
    db.commit()
    db.refresh(msg)

    return standard_response(True, "Message sent successfully", {
        "id": str(msg.id), "content": msg.message_text, "sent_at": msg.created_at.isoformat() if msg.created_at else now.isoformat()
    })


@router.post("/start")
def start_conversation(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Starts a new conversation with another user, or returns existing one."""
    recipient_id = body.get("recipient_id")
    if not recipient_id:
        return standard_response(False, "Recipient ID is required")

    try:
        rid = uuid.UUID(recipient_id)
    except ValueError:
        return standard_response(False, "Invalid recipient ID")

    if str(rid) == str(current_user.id):
        return standard_response(False, "You cannot start a conversation with yourself")

    recipient = db.query(User).filter(User.id == rid).first()
    if not recipient:
        return standard_response(False, "Recipient not found")

    existing = db.query(Conversation).filter(
        or_(
            (Conversation.user_one_id == current_user.id) & (Conversation.user_two_id == rid),
            (Conversation.user_one_id == rid) & (Conversation.user_two_id == current_user.id),
        )
    ).first()

    if existing:
        return standard_response(True, "Conversation already exists", _conversation_dict(db, existing, current_user.id))

    now = datetime.now(EAT)
    conv = Conversation(
        user_one_id=current_user.id,
        user_two_id=rid,
        type=ConversationTypeEnum.user_to_user,
    )
    db.add(conv)
    db.flush()

    initial_message = body.get("message", "").strip()
    if initial_message:
        msg = Message(conversation_id=conv.id, sender_id=current_user.id, message_text=initial_message, is_read=False)
        db.add(msg)

    db.commit()
    db.refresh(conv)
    return standard_response(True, "Conversation started successfully", _conversation_dict(db, conv, current_user.id))


@router.put("/{conversation_id}/read")
def mark_as_read(conversation_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Marks all messages from the other participant as read."""
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        return standard_response(False, "Invalid conversation ID")

    db.query(Message).filter(
        Message.conversation_id == cid,
        Message.sender_id != current_user.id,
        Message.is_read == False
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return standard_response(True, "Messages marked as read")


@router.delete("/{conversation_id}/messages/{message_id}")
def delete_message(conversation_id: str, message_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Soft-deletes a message sent by the current user."""
    try:
        mid = uuid.UUID(message_id)
    except ValueError:
        return standard_response(False, "Invalid message ID")

    msg = db.query(Message).filter(Message.id == mid, Message.sender_id == current_user.id).first()
    if not msg:
        return standard_response(False, "Message not found or not yours")

    msg.message_text = "[Message deleted]"
    db.commit()
    return standard_response(True, "Message deleted successfully")


@router.post("/{conversation_id}/archive")
def archive_conversation(conversation_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Deactivates a conversation."""
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        return standard_response(False, "Invalid conversation ID")

    conv = db.query(Conversation).filter(Conversation.id == cid).first()
    if conv:
        conv.is_active = False
        db.commit()
    return standard_response(True, "Conversation archived")


@router.post("/{conversation_id}/unarchive")
def unarchive_conversation(conversation_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Re-activates an archived conversation."""
    try:
        cid = uuid.UUID(conversation_id)
    except ValueError:
        return standard_response(False, "Invalid conversation ID")

    conv = db.query(Conversation).filter(Conversation.id == cid).first()
    if conv:
        conv.is_active = True
        db.commit()
    return standard_response(True, "Conversation unarchived")
