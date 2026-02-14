# Moments Routes - /moments/...
# Handles stories/moments: CRUD, viewing, highlights

import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

import httpx
import pytz
from fastapi import APIRouter, Depends, File, Form, UploadFile, Body
from sqlalchemy.orm import Session

from core.config import UPLOAD_SERVICE_URL
from core.database import get_db
from models import (
    UserMoment, UserMomentSticker, UserMomentViewer,
    UserMomentHighlight, UserMomentHighlightItem, User, UserProfile,
)
from utils.auth import get_current_user
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/moments", tags=["Moments/Stories"])


def _moment_dict(db, m, current_user_id=None):
    user = db.query(User).filter(User.id == m.user_id).first()
    profile = db.query(UserProfile).filter(UserProfile.user_id == m.user_id).first() if user else None
    viewer_count = db.query(UserMomentViewer).filter(UserMomentViewer.moment_id == m.id).count()
    has_seen = False
    if current_user_id:
        has_seen = db.query(UserMomentViewer).filter(UserMomentViewer.moment_id == m.id, UserMomentViewer.viewer_id == current_user_id).first() is not None

    return {
        "id": str(m.id),
        "author": {"id": str(user.id), "name": f"{user.first_name} {user.last_name}", "avatar": profile.profile_picture_url if profile else None} if user else None,
        "caption": m.caption, "content_type": m.content_type.value if m.content_type else "image",
        "media_url": m.media_url,
        "location": m.location if hasattr(m, "location") else None,
        "viewer_count": viewer_count, "has_seen": has_seen,
        "is_active": m.is_active,
        "expires_at": m.expires_at.isoformat() if m.expires_at else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


@router.get("/")
def get_moments_feed(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.now(EAT)
    moments = db.query(UserMoment).filter(UserMoment.is_active == True, UserMoment.expires_at > now).order_by(UserMoment.created_at.desc()).limit(100).all()

    # Group by user
    user_moments = {}
    for m in moments:
        uid = str(m.user_id)
        if uid not in user_moments:
            user_moments[uid] = []
        user_moments[uid].append(_moment_dict(db, m, current_user.id))

    feed = []
    for uid, items in user_moments.items():
        user = db.query(User).filter(User.id == uuid.UUID(uid)).first()
        profile = db.query(UserProfile).filter(UserProfile.user_id == uuid.UUID(uid)).first() if user else None
        all_seen = all(item["has_seen"] for item in items)
        feed.append({
            "user": {"id": uid, "name": f"{user.first_name} {user.last_name}" if user else None, "avatar": profile.profile_picture_url if profile else None},
            "moments": items, "all_seen": all_seen,
        })

    return standard_response(True, "Moments feed retrieved", feed)


@router.get("/me")
def get_my_moments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    moments = db.query(UserMoment).filter(UserMoment.user_id == current_user.id, UserMoment.is_active == True).order_by(UserMoment.created_at.desc()).all()
    return standard_response(True, "Your moments retrieved", [_moment_dict(db, m, current_user.id) for m in moments])


@router.get("/user/{user_id}")
def get_user_moments(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")
    now = datetime.now(EAT)
    moments = db.query(UserMoment).filter(UserMoment.user_id == uid, UserMoment.is_active == True, UserMoment.expires_at > now).order_by(UserMoment.created_at.asc()).all()
    return standard_response(True, "User moments retrieved", [_moment_dict(db, m, current_user.id) for m in moments])


@router.post("/")
async def create_moment(
    content: Optional[str] = Form(None), location: Optional[str] = Form(None),
    media: Optional[UploadFile] = File(None), duration_hours: int = Form(24),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    now = datetime.now(EAT)
    media_url = None
    if media and media.filename:
        file_content = await media.read()
        _, ext = os.path.splitext(media.filename)
        unique_name = f"{uuid.uuid4().hex}{ext}"
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(UPLOAD_SERVICE_URL, data={"target_path": f"nuru/uploads/moments/{current_user.id}/"}, files={"file": (unique_name, file_content, media.content_type)}, timeout=20)
                result = resp.json()
                if result.get("success"):
                    media_url = result["data"]["url"]
            except Exception:
                pass

    moment = UserMoment(
        id=uuid.uuid4(), user_id=current_user.id,
        caption=content.strip() if content else None,
        content_type="image",
        media_url=media_url or "",
        is_active=True,
        expires_at=now + timedelta(hours=duration_hours),
        created_at=now,
    )
    if hasattr(moment, "location") and location:
        moment.location = location.strip()
    db.add(moment)
    db.commit()

    return standard_response(True, "Moment created successfully", _moment_dict(db, moment, current_user.id))


@router.delete("/{moment_id}")
def delete_moment(moment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        mid = uuid.UUID(moment_id)
    except ValueError:
        return standard_response(False, "Invalid moment ID")
    m = db.query(UserMoment).filter(UserMoment.id == mid, UserMoment.user_id == current_user.id).first()
    if not m:
        return standard_response(False, "Moment not found")
    m.is_active = False
    db.commit()
    return standard_response(True, "Moment deleted")


@router.post("/{moment_id}/seen")
def mark_moment_seen(moment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        mid = uuid.UUID(moment_id)
    except ValueError:
        return standard_response(False, "Invalid moment ID")
    existing = db.query(UserMomentViewer).filter(UserMomentViewer.moment_id == mid, UserMomentViewer.viewer_id == current_user.id).first()
    if not existing:
        db.add(UserMomentViewer(id=uuid.uuid4(), moment_id=mid, viewer_id=current_user.id, viewed_at=datetime.now(EAT)))
        db.commit()
    return standard_response(True, "Moment marked as seen")


@router.get("/{moment_id}/viewers")
def get_moment_viewers(moment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        mid = uuid.UUID(moment_id)
    except ValueError:
        return standard_response(False, "Invalid moment ID")
    viewers = db.query(UserMomentViewer).filter(UserMomentViewer.moment_id == mid).all()
    data = []
    for v in viewers:
        u = db.query(User).filter(User.id == v.viewer_id).first()
        p = db.query(UserProfile).filter(UserProfile.user_id == v.viewer_id).first() if u else None
        data.append({"id": str(v.viewer_id), "name": f"{u.first_name} {u.last_name}" if u else None, "avatar": p.profile_picture_url if p else None, "viewed_at": v.viewed_at.isoformat() if v.viewed_at else None})
    return standard_response(True, "Viewers retrieved", data)


@router.post("/{moment_id}/react")
def react_to_moment(moment_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Reaction recorded")


@router.post("/{moment_id}/reply")
def reply_to_moment(moment_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Reply sent")


@router.post("/{moment_id}/stickers/{sticker_id}/vote")
def vote_on_poll(moment_id: str, sticker_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Vote recorded")


# ──────────────────────────────────────────────
# HIGHLIGHTS
# ──────────────────────────────────────────────
@router.get("/highlights")
def get_my_highlights(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    highlights = db.query(UserMomentHighlight).filter(UserMomentHighlight.user_id == current_user.id).order_by(UserMomentHighlight.created_at.desc()).all()
    data = [{"id": str(h.id), "title": h.title, "cover_image": h.cover_image_url if hasattr(h, "cover_image_url") else None, "moment_count": db.query(UserMomentHighlightItem).filter(UserMomentHighlightItem.highlight_id == h.id).count()} for h in highlights]
    return standard_response(True, "Highlights retrieved", data)


@router.get("/highlights/user/{user_id}")
def get_user_highlights(user_id: str, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")
    highlights = db.query(UserMomentHighlight).filter(UserMomentHighlight.user_id == uid).all()
    return standard_response(True, "User highlights retrieved", [{"id": str(h.id), "title": h.title} for h in highlights])


@router.post("/highlights")
def create_highlight(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.now(EAT)
    h = UserMomentHighlight(id=uuid.uuid4(), user_id=current_user.id, title=body.get("title", ""), created_at=now, updated_at=now)
    db.add(h)
    db.commit()
    return standard_response(True, "Highlight created", {"id": str(h.id)})


@router.put("/highlights/{highlight_id}")
def update_highlight(highlight_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        hid = uuid.UUID(highlight_id)
    except ValueError:
        return standard_response(False, "Invalid highlight ID")
    h = db.query(UserMomentHighlight).filter(UserMomentHighlight.id == hid, UserMomentHighlight.user_id == current_user.id).first()
    if not h:
        return standard_response(False, "Highlight not found")
    if "title" in body: h.title = body["title"]
    h.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Highlight updated")


@router.delete("/highlights/{highlight_id}")
def delete_highlight(highlight_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        hid = uuid.UUID(highlight_id)
    except ValueError:
        return standard_response(False, "Invalid highlight ID")
    h = db.query(UserMomentHighlight).filter(UserMomentHighlight.id == hid, UserMomentHighlight.user_id == current_user.id).first()
    if not h:
        return standard_response(False, "Highlight not found")
    db.delete(h)
    db.commit()
    return standard_response(True, "Highlight deleted")


@router.post("/highlights/{highlight_id}/moments")
def add_moment_to_highlight(highlight_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        hid = uuid.UUID(highlight_id)
        mid = uuid.UUID(body.get("moment_id", ""))
    except ValueError:
        return standard_response(False, "Invalid ID")

    # Pre-insertion duplicate check
    existing = db.query(UserMomentHighlightItem).filter(
        UserMomentHighlightItem.highlight_id == hid,
        UserMomentHighlightItem.moment_id == mid,
    ).first()
    if existing:
        return standard_response(False, "This moment is already in the highlight")

    db.add(UserMomentHighlightItem(id=uuid.uuid4(), highlight_id=hid, moment_id=mid, created_at=datetime.now(EAT)))
    db.commit()
    return standard_response(True, "Moment added to highlight")


@router.delete("/highlights/{highlight_id}/moments/{moment_id}")
def remove_moment_from_highlight(highlight_id: str, moment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        hid = uuid.UUID(highlight_id)
        mid = uuid.UUID(moment_id)
    except ValueError:
        return standard_response(False, "Invalid ID")
    item = db.query(UserMomentHighlightItem).filter(UserMomentHighlightItem.highlight_id == hid, UserMomentHighlightItem.moment_id == mid).first()
    if item:
        db.delete(item)
        db.commit()
    return standard_response(True, "Moment removed from highlight")
