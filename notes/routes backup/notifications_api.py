# backend/app/api/routes/notifications_api.py
# MODULE 12: NOTIFICATIONS

import math
import uuid
from datetime import datetime

import pytz
from fastapi import APIRouter, Depends, Body
from sqlalchemy import func as sa_func, Column, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Session

from core.database import get_db
from core.base import Base
from models import User, UserProfile, Notification
from utils.auth import get_current_user
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter()

def _notification_dict(db: Session, n) -> dict:
    # Extract sender info
    actor = None
    sender_ids = n.sender_ids or []
    if sender_ids and len(sender_ids) > 0:
        first_sender_id = sender_ids[0] if isinstance(sender_ids[0], str) else str(sender_ids[0])
        try:
            sender_uuid = uuid.UUID(first_sender_id)
            sender = db.query(User).filter(User.id == sender_uuid).first()
            if sender:
                profile = db.query(UserProfile).filter(UserProfile.user_id == sender.id).first()
                actor = {
                    "user_id": str(sender.id),
                    "first_name": sender.first_name,
                    "last_name": sender.last_name,
                    "avatar": profile.profile_picture_url if profile else None,
                }
        except (ValueError, TypeError):
            pass

    data = n.message_data or {}
    notif_type = n.type.value if hasattr(n.type, "value") else str(n.type)

    return {
        "id": str(n.id),
        "user_id": str(n.recipient_id),
        "type": notif_type,
        "title": data.get("title", notif_type.replace("_", " ").title()),
        "message": n.message_template,
        "data": data,
        "action_url": data.get("action_url"),
        "action_text": data.get("action_text"),
        "image_url": data.get("image_url"),
        "actor": actor,
        "is_read": n.is_read,
        "read_at": None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


# =============================================================================
# 12.1 GET /notifications/ — List notifications
# =============================================================================

@router.get("/")
def list_notifications(
    page: int = 1,
    limit: int = 20,
    unread_only: bool = False,
    type: str = "all",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(Notification.recipient_id == current_user.id)

    if unread_only:
        query = query.filter(Notification.is_read == False)
    if type != "all":
        query = query.filter(Notification.type == type)

    query = query.order_by(Notification.created_at.desc())

    total_items = query.count()
    total_pages = max(1, math.ceil(total_items / limit))
    offset = (page - 1) * limit
    notifications = query.offset(offset).limit(limit).all()

    unread_count = (
        db.query(sa_func.count(Notification.id))
        .filter(Notification.recipient_id == current_user.id, Notification.is_read == False)
        .scalar()
    ) or 0

    return standard_response(True, "Notifications retrieved", {
        "notifications": [_notification_dict(db, n) for n in notifications],
        "summary": {"total": total_items, "unread": unread_count},
        "pagination": {
            "page": page, "limit": limit, "total_items": total_items,
            "total_pages": total_pages, "has_next": page < total_pages, "has_previous": page > 1,
        },
    })


# =============================================================================
# 12.1b GET /notifications/unread-count
# =============================================================================

@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (
        db.query(sa_func.count(Notification.id))
        .filter(Notification.recipient_id == current_user.id, Notification.is_read == False)
        .scalar()
    ) or 0

    return standard_response(True, "Unread count retrieved", {"unread_count": count})


# =============================================================================
# 12.2 PATCH /notifications/{notificationId}/read
# =============================================================================

@router.patch("/{notification_id}/read")
@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        nid = uuid.UUID(notification_id)
    except ValueError:
        return standard_response(False, "Invalid notification ID.")

    n = db.query(Notification).filter(Notification.id == nid, Notification.recipient_id == current_user.id).first()
    if not n:
        return standard_response(False, "Notification not found")

    now = datetime.now(EAT)
    n.is_read = True

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Notification marked as read", {
        "id": str(n.id),
        "is_read": True,
        "read_at": now.isoformat(),
    })


# =============================================================================
# 12.3 PATCH /notifications/read-all
# =============================================================================

@router.patch("/read-all")
@router.put("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (
        db.query(Notification)
        .filter(Notification.recipient_id == current_user.id, Notification.is_read == False)
        .update({"is_read": True})
    )

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "All notifications marked as read", {"marked_count": count})


# =============================================================================
# 12.4 DELETE /notifications/{notificationId}
# =============================================================================

@router.delete("/{notification_id}")
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        nid = uuid.UUID(notification_id)
    except ValueError:
        return standard_response(False, "Invalid notification ID.")

    n = db.query(Notification).filter(Notification.id == nid, Notification.recipient_id == current_user.id).first()
    if not n:
        return standard_response(False, "Notification not found")

    db.delete(n)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Notification deleted")


# =============================================================================
# 12.5 GET /notifications/preferences
# =============================================================================

@router.get("/preferences")
def get_notification_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Return default preferences (stored in user_settings table)
    from sqlalchemy import text
    row = db.execute(
        text("SELECT * FROM user_settings WHERE user_id = :uid"),
        {"uid": str(current_user.id)},
    ).first()

    if row:
        return standard_response(True, "Preferences retrieved", {
            "email": {
                "enabled": getattr(row, "email_notifications", True),
                "booking_requests": True,
                "messages": getattr(row, "message_notifications", True),
                "contributions": True,
                "rsvp": True,
                "reviews": True,
                "marketing": False,
                "digest": "daily",
            },
            "push": {
                "enabled": getattr(row, "push_notifications", True),
                "booking_requests": True,
                "messages": getattr(row, "message_notifications", True),
                "contributions": True,
                "rsvp": True,
                "reviews": True,
            },
            "sms": {
                "enabled": False,
                "booking_requests": False,
                "contributions": False,
            },
            "quiet_hours": {
                "enabled": False,
                "start": "22:00",
                "end": "07:00",
                "timezone": getattr(row, "timezone", "Africa/Nairobi"),
            },
        })

    # Default preferences
    return standard_response(True, "Preferences retrieved", {
        "email": {"enabled": True, "booking_requests": True, "messages": True, "contributions": True, "rsvp": True, "reviews": True, "marketing": False, "digest": "daily"},
        "push": {"enabled": True, "booking_requests": True, "messages": True, "contributions": True, "rsvp": True, "reviews": True},
        "sms": {"enabled": False, "booking_requests": False, "contributions": False},
        "quiet_hours": {"enabled": False, "start": "22:00", "end": "07:00", "timezone": "Africa/Nairobi"},
    })


# =============================================================================
# 12.6 PUT /notifications/preferences
# =============================================================================

@router.put("/preferences")
def update_notification_preferences(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import text

    # Check if user_settings row exists
    row = db.execute(
        text("SELECT id FROM user_settings WHERE user_id = :uid"),
        {"uid": str(current_user.id)},
    ).first()

    now = datetime.now(EAT)

    email_prefs = body.get("email", {})
    push_prefs = body.get("push", {})

    if row:
        updates = {}
        if "enabled" in email_prefs:
            updates["email_notifications"] = email_prefs["enabled"]
        if "enabled" in push_prefs:
            updates["push_notifications"] = push_prefs["enabled"]
        if "messages" in email_prefs:
            updates["message_notifications"] = email_prefs["messages"]

        if updates:
            set_clause = ", ".join(f"{k} = :{k}" for k in updates)
            updates["uid"] = str(current_user.id)
            updates["now"] = now
            db.execute(
                text(f"UPDATE user_settings SET {set_clause}, updated_at = :now WHERE user_id = :uid"),
                updates,
            )
    else:
        db.execute(
            text("""INSERT INTO user_settings (id, user_id, email_notifications, push_notifications, message_notifications, created_at, updated_at) 
                     VALUES (:id, :uid, :email, :push, :msg, :now, :now)"""),
            {
                "id": str(uuid.uuid4()), "uid": str(current_user.id),
                "email": email_prefs.get("enabled", True),
                "push": push_prefs.get("enabled", True),
                "msg": email_prefs.get("messages", True),
                "now": now,
            },
        )

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Preferences updated")
