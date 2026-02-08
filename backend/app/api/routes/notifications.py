# Notifications Routes - /notifications/...

import uuid
from datetime import datetime

import pytz
from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from core.database import get_db
from models import Notification, User
from utils.auth import get_current_user
from utils.helpers import standard_response, paginate

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/")
def get_notifications(page: int = 1, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Notification).filter(Notification.recipient_id == current_user.id).order_by(Notification.created_at.desc())
    items, pagination = paginate(query, page, limit)
    data = [{"id": str(n.id), "type": n.type.value if n.type else None, "message": n.message_template, "data": n.message_data, "is_read": n.is_read, "reference_id": str(n.reference_id) if n.reference_id else None, "reference_type": n.reference_type, "created_at": n.created_at.isoformat() if n.created_at else None} for n in items]
    return standard_response(True, "Notifications retrieved", data, pagination=pagination)


@router.get("/unread/count")
def get_unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from sqlalchemy import func as sa_func
    count = db.query(sa_func.count(Notification.id)).filter(Notification.recipient_id == current_user.id, Notification.is_read == False).scalar() or 0
    return standard_response(True, "Unread count retrieved", {"count": count})


@router.put("/{notification_id}/read")
def mark_as_read(notification_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        nid = uuid.UUID(notification_id)
    except ValueError:
        return standard_response(False, "Invalid notification ID")
    n = db.query(Notification).filter(Notification.id == nid, Notification.recipient_id == current_user.id).first()
    if not n:
        return standard_response(False, "Notification not found")
    n.is_read = True
    db.commit()
    return standard_response(True, "Notification marked as read")


@router.put("/read-all")
def mark_all_as_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.recipient_id == current_user.id, Notification.is_read == False).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return standard_response(True, "All notifications marked as read")


@router.delete("/{notification_id}")
def delete_notification(notification_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        nid = uuid.UUID(notification_id)
    except ValueError:
        return standard_response(False, "Invalid notification ID")
    n = db.query(Notification).filter(Notification.id == nid, Notification.recipient_id == current_user.id).first()
    if not n:
        return standard_response(False, "Notification not found")
    db.delete(n)
    db.commit()
    return standard_response(True, "Notification deleted")


@router.delete("/")
def clear_all_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.recipient_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    return standard_response(True, "All notifications cleared")


@router.post("/push-token")
def register_push_token(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    token = body.get("token", "").strip()
    platform = body.get("platform", "web")
    if not token:
        return standard_response(False, "Push token is required")
    # Store token (model-dependent; placeholder)
    return standard_response(True, "Push token registered successfully")


@router.delete("/push-token")
def unregister_push_token(body: dict = Body(default={}), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Push token unregistered")