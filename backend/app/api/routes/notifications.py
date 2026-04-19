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
def get_notifications(
    page: int = 1,
    limit: int = 20,
    search: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from core.redis import cache_get, cache_set, CacheKeys

    use_cache = not (search and search.strip())
    cache_key = CacheKeys.for_notifications(str(current_user.id), page, limit) if use_cache else None
    if use_cache:
        cached = cache_get(cache_key)
        if cached is not None:
            return standard_response(True, "Notifications retrieved", cached)

    from utils.batch_loaders import build_notification_dicts
    from sqlalchemy import func as sa_func, or_

    query = db.query(Notification).filter(Notification.recipient_id == current_user.id)
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(or_(
            sa_func.lower(Notification.title).like(term),
            sa_func.lower(Notification.message).like(term),
            sa_func.lower(Notification.notification_type).like(term),
        ))
    query = query.order_by(Notification.created_at.desc())

    items, pagination = paginate(query, page, limit)
    data = build_notification_dicts(db, items)

    unread = db.query(sa_func.count(Notification.id)).filter(
        Notification.recipient_id == current_user.id, Notification.is_read == False
    ).scalar() or 0

    result = {"notifications": data, "unread_count": unread, "pagination": pagination}
    if use_cache:
        cache_set(cache_key, result, ttl_seconds=60)
    return standard_response(True, "Notifications retrieved", result)


@router.get("/unread/count")
def get_unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from core.redis import cache_get, cache_set, CacheKeys

    cache_key = CacheKeys.for_unread(str(current_user.id))
    cached = cache_get(cache_key)
    if cached is not None:
        return standard_response(True, "Unread count retrieved", cached)

    from sqlalchemy import func as sa_func
    count = db.query(sa_func.count(Notification.id)).filter(
        Notification.recipient_id == current_user.id, Notification.is_read == False
    ).scalar() or 0

    result = {"count": count}
    cache_set(cache_key, result, ttl_seconds=30)  # 30 sec TTL
    return standard_response(True, "Unread count retrieved", result)


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

    # Invalidate caches
    from core.redis import invalidate_user_notifications
    invalidate_user_notifications(str(current_user.id))

    return standard_response(True, "Notification marked as read")


@router.put("/read-all")
def mark_all_as_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.recipient_id == current_user.id, Notification.is_read == False).update({"is_read": True}, synchronize_session=False)
    db.commit()

    from core.redis import invalidate_user_notifications
    invalidate_user_notifications(str(current_user.id))

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

    from core.redis import invalidate_user_notifications
    invalidate_user_notifications(str(current_user.id))

    return standard_response(True, "Notification deleted")


@router.delete("/")
def clear_all_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.recipient_id == current_user.id).delete(synchronize_session=False)
    db.commit()

    from core.redis import invalidate_user_notifications
    invalidate_user_notifications(str(current_user.id))

    return standard_response(True, "All notifications cleared")
