# backend/app/api/routes/moments.py
# MODULE 15: MOMENTS (Stories)

import math
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
import pytz
from fastapi import APIRouter, Depends, Body, File, Form, UploadFile
from sqlalchemy import func as sa_func, Column, Text, Boolean, Integer, ForeignKey, DateTime, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Session
from core.config import MOMENT_EXPIRY_HOURS
from core.database import get_db
from core.base import Base
from models import User, UserProfile, UserMoment, UserMomentSticker, UserMomentViewer, UserMomentHighlight, UserMomentHighlightItem
from utils.auth import get_current_user
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter()

def _user_preview(db: Session, user_id) -> dict | None:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    return {
        "id": str(user.id),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "avatar": profile.profile_picture_url if profile else None,
        "is_verified": user.is_identity_verified if hasattr(user, "is_identity_verified") else False,
    }


def _moment_dict(db: Session, m, current_user_id=None) -> dict:
    is_seen = False
    if current_user_id:
        is_seen = db.query(UserMomentViewer).filter(
            UserMomentViewer.moment_id == m.id, UserMomentViewer.viewer_id == current_user_id
        ).first() is not None

    stickers = db.query(UserMomentSticker).filter(UserMomentSticker.moment_id == m.id).all()

    return {
        "id": str(m.id),
        "type": m.content_type,
        "media_url": m.media_url,
        "thumbnail_url": m.thumbnail_url,
        "caption": m.caption,
        "location": {"name": m.location} if m.location else None,
        "stickers": [
            {
                "id": str(s.id),
                "type": s.sticker_type,
                "position": {"x": float(s.position_x), "y": float(s.position_y)},
                "data": s.data or {},
            }
            for s in stickers
        ],
        "view_count": m.view_count or 0,
        "reply_count": m.reply_count or 0,
        "is_seen": is_seen,
        "can_reply": True,
        "privacy": m.privacy or "everyone",
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "expires_at": m.expires_at.isoformat() if m.expires_at else None,
    }


# =============================================================================
# 15.1 GET /moments — Moments feed
# =============================================================================

@router.get("/")
def get_moments_feed(
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(EAT)

    # Get active moments from all users
    active_moments = (
        db.query(UserMoment)
        .filter(UserMoment.is_active == True, UserMoment.expires_at > now)
        .order_by(UserMoment.created_at.desc())
        .all()
    )

    # Group by user
    user_moments_map = {}
    for m in active_moments:
        uid = str(m.user_id)
        if uid not in user_moments_map:
            user_moments_map[uid] = []
        user_moments_map[uid].append(m)

    result = []
    for uid, moments in user_moments_map.items():
        user_uuid = uuid.UUID(uid)
        has_unseen = any(
            not db.query(UserMomentViewer).filter(
                UserMomentViewer.moment_id == m.id, UserMomentViewer.viewer_id == current_user.id
            ).first()
            for m in moments
        )
        latest = max(m.created_at for m in moments if m.created_at)
        first_moment = moments[0]

        result.append({
            "user": _user_preview(db, user_uuid),
            "has_unseen": has_unseen,
            "moment_count": len(moments),
            "latest_moment_at": latest.isoformat() if latest else None,
            "preview": {
                "type": first_moment.content_type,
                "thumbnail_url": first_moment.thumbnail_url or first_moment.media_url,
            },
        })

    # My moments
    my_moments = [m for m in active_moments if str(m.user_id) == str(current_user.id)]

    return standard_response(True, "Moments retrieved successfully", {
        "moments": result,
        "my_moments": {
            "has_active": len(my_moments) > 0,
            "moment_count": len(my_moments),
            "latest_moment_at": max((m.created_at for m in my_moments), default=None),
        } if my_moments else {"has_active": False, "moment_count": 0, "latest_moment_at": None},
        "pagination": {
            "current_page": page, "per_page": limit, "total_items": len(result),
            "total_pages": 1, "has_next": False, "has_previous": False,
        },
    })


# =============================================================================
# 15.2 GET /moments/user/{userId}
# =============================================================================

@router.get("/user/{user_id}")
def get_user_moments(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID.")

    now = datetime.now(EAT)
    moments = (
        db.query(UserMoment)
        .filter(UserMoment.user_id == uid, UserMoment.is_active == True, UserMoment.expires_at > now)
        .order_by(UserMoment.created_at.asc())
        .all()
    )

    return standard_response(True, "User moments retrieved successfully", {
        "user": _user_preview(db, uid),
        "moments": [_moment_dict(db, m, current_user.id) for m in moments],
    })


# =============================================================================
# 15.3 GET /moments/me
# =============================================================================

@router.get("/me")
def get_my_moments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(EAT)
    moments = (
        db.query(UserMoment)
        .filter(UserMoment.user_id == current_user.id, UserMoment.is_active == True, UserMoment.expires_at > now)
        .order_by(UserMoment.created_at.desc())
        .all()
    )

    total_views = sum(m.view_count or 0 for m in moments)
    total_replies = sum(m.reply_count or 0 for m in moments)

    return standard_response(True, "My moments retrieved successfully", {
        "moments": [_moment_dict(db, m, current_user.id) for m in moments],
        "total_views_today": total_views,
        "total_replies_today": total_replies,
    })


# =============================================================================
# 15.4 POST /moments — Create moment
# =============================================================================

@router.post("/")
async def create_moment(
    caption: Optional[str] = Form(None),
    location_name: Optional[str] = Form(None),
    privacy: Optional[str] = Form("everyone"),
    stickers: Optional[str] = Form(None),
    media: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not media or not media.filename:
        return standard_response(False, "Media file is required")

    now = datetime.now(EAT)
    expires_at = now + timedelta(hours=MOMENT_EXPIRY_HOURS)

    # Determine content type
    ext = (media.filename.rsplit(".", 1)[-1] if "." in media.filename else "").lower()
    content_type = "video" if ext in ("mp4", "mov", "avi") else "image"

    # In production, upload to storage
    media_url = f"/uploads/moments/{current_user.id}/{uuid.uuid4().hex}.{ext}"

    moment = UserMoment(
        id=uuid.uuid4(),
        user_id=current_user.id,
        content_type=content_type,
        media_url=media_url,
        thumbnail_url=media_url,
        caption=caption.strip() if caption else None,
        location=location_name,
        privacy=privacy or "everyone",
        view_count=0,
        reply_count=0,
        is_active=True,
        expires_at=expires_at,
        created_at=now,
    )
    db.add(moment)

    # Parse and add stickers
    if stickers:
        import json
        try:
            sticker_list = json.loads(stickers)
            for s in sticker_list:
                sticker = UserMomentSticker(
                    id=uuid.uuid4(),
                    moment_id=moment.id,
                    sticker_type=s.get("type", "mention"),
                    position_x=s.get("position", {}).get("x", 50),
                    position_y=s.get("position", {}).get("y", 50),
                    data=s.get("data", {}),
                    created_at=now,
                )
                db.add(sticker)
        except (json.JSONDecodeError, TypeError):
            pass

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to create moment: {str(e)}")

    return standard_response(True, "Moment created successfully", _moment_dict(db, moment, current_user.id))


# =============================================================================
# 15.5 DELETE /moments/{momentId}
# =============================================================================

@router.delete("/{moment_id}")
def delete_moment(
    moment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        mid = uuid.UUID(moment_id)
    except ValueError:
        return standard_response(False, "Invalid moment ID.")

    moment = db.query(UserMoment).filter(UserMoment.id == mid).first()
    if not moment:
        return standard_response(False, "Moment not found")
    if str(moment.user_id) != str(current_user.id):
        return standard_response(False, "You can only delete your own moments")

    db.delete(moment)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Moment deleted successfully")


# =============================================================================
# 15.6 POST /moments/{momentId}/seen
# =============================================================================

@router.post("/{moment_id}/seen")
def mark_moment_seen(
    moment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        mid = uuid.UUID(moment_id)
    except ValueError:
        return standard_response(False, "Invalid moment ID.")

    moment = db.query(UserMoment).filter(UserMoment.id == mid).first()
    if not moment:
        return standard_response(False, "Moment not found")

    now = datetime.now(EAT)

    existing = db.query(UserMomentViewer).filter(
        UserMomentViewer.moment_id == mid, UserMomentViewer.viewer_id == current_user.id
    ).first()

    if not existing:
        viewer = UserMomentViewer(
            id=uuid.uuid4(), moment_id=mid, viewer_id=current_user.id, viewed_at=now,
        )
        db.add(viewer)
        moment.view_count = (moment.view_count or 0) + 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Moment marked as seen", {
        "moment_id": str(mid),
        "seen_at": now.isoformat(),
    })


# =============================================================================
# 15.7 GET /moments/{momentId}/viewers
# =============================================================================

@router.get("/{moment_id}/viewers")
def get_moment_viewers(
    moment_id: str,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        mid = uuid.UUID(moment_id)
    except ValueError:
        return standard_response(False, "Invalid moment ID.")

    moment = db.query(UserMoment).filter(UserMoment.id == mid).first()
    if not moment:
        return standard_response(False, "Moment not found")
    if str(moment.user_id) != str(current_user.id):
        return standard_response(False, "You can only view viewers of your own moments")

    query = db.query(UserMomentViewer).filter(UserMomentViewer.moment_id == mid).order_by(UserMomentViewer.viewed_at.desc())

    total_items = query.count()
    total_pages = max(1, math.ceil(total_items / limit))
    offset = (page - 1) * limit
    viewers = query.offset(offset).limit(limit).all()

    result = []
    for v in viewers:
        user = db.query(User).filter(User.id == v.viewer_id).first()
        if user:
            profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
            result.append({
                "id": str(user.id),
                "first_name": user.first_name,
                "last_name": user.last_name,
                "username": user.username,
                "avatar": profile.profile_picture_url if profile else None,
                "viewed_at": v.viewed_at.isoformat() if v.viewed_at else None,
            })

    return standard_response(True, "Moment viewers retrieved successfully", {
        "viewers": result,
        "pagination": {
            "current_page": page, "per_page": limit, "total_items": total_items,
            "total_pages": total_pages, "has_next": page < total_pages, "has_previous": page > 1,
        },
    })


# =============================================================================
# 15.8 POST /moments/{momentId}/replies
# =============================================================================

@router.post("/{moment_id}/replies")
def reply_to_moment(
    moment_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        mid = uuid.UUID(moment_id)
    except ValueError:
        return standard_response(False, "Invalid moment ID.")

    moment = db.query(UserMoment).filter(UserMoment.id == mid).first()
    if not moment:
        return standard_response(False, "Moment not found")

    content = body.get("content", "").strip()
    if not content:
        return standard_response(False, "Reply content is required")

    now = datetime.now(EAT)
    moment.reply_count = (moment.reply_count or 0) + 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Reply sent successfully", {
        "reply_id": str(uuid.uuid4()),
        "moment_id": str(mid),
        "content": content,
        "created_at": now.isoformat(),
    })


# =============================================================================
# 15.12 GET /users/{userId}/highlights
# =============================================================================

@router.get("/highlights/{user_id}")
def get_highlights(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID.")

    highlights = (
        db.query(UserMomentHighlight)
        .filter(UserMomentHighlight.user_id == uid, UserMomentHighlight.is_active == True)
        .order_by(UserMomentHighlight.display_order.asc())
        .all()
    )

    result = []
    for h in highlights:
        moment_count = db.query(UserMomentHighlightItem).filter(UserMomentHighlightItem.highlight_id == h.id).count()
        result.append({
            "id": str(h.id),
            "title": h.title,
            "cover_image": h.cover_image_url,
            "moment_count": moment_count,
            "created_at": h.created_at.isoformat() if h.created_at else None,
            "updated_at": h.updated_at.isoformat() if h.updated_at else None,
        })

    return standard_response(True, "Highlights retrieved successfully", {"highlights": result})


# =============================================================================
# 15.13 POST /highlights — Create highlight
# =============================================================================

@router.post("/highlights")
def create_highlight(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    title = body.get("title", "").strip()
    if not title:
        return standard_response(False, "Title is required")

    now = datetime.now(EAT)
    max_order = db.query(UserMomentHighlight).filter(UserMomentHighlight.user_id == current_user.id).count()

    highlight = UserMomentHighlight(
        id=uuid.uuid4(),
        user_id=current_user.id,
        title=title,
        display_order=max_order,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(highlight)

    # Add moments
    moment_ids = body.get("moment_ids", [])
    for i, mid_str in enumerate(moment_ids):
        try:
            mid = uuid.UUID(mid_str)
            item = UserMomentHighlightItem(
                id=uuid.uuid4(), highlight_id=highlight.id, moment_id=mid, display_order=i, added_at=now,
            )
            db.add(item)
        except ValueError:
            continue

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Highlight created successfully", {
        "id": str(highlight.id), "title": highlight.title,
        "moment_count": len(moment_ids), "created_at": now.isoformat(),
    })


# =============================================================================
# 15.15 DELETE /highlights/{highlightId}
# =============================================================================

@router.delete("/highlights/{highlight_id}")
def delete_highlight(
    highlight_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        hid = uuid.UUID(highlight_id)
    except ValueError:
        return standard_response(False, "Invalid highlight ID.")

    highlight = db.query(UserMomentHighlight).filter(UserMomentHighlight.id == hid).first()
    if not highlight:
        return standard_response(False, "Highlight not found")
    if str(highlight.user_id) != str(current_user.id):
        return standard_response(False, "You can only delete your own highlights")

    db.delete(highlight)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Highlight deleted successfully")
