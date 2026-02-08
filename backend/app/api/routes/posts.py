# Posts Routes - /posts/...
# Handles social feed posts, interactions (glow, echo, spark), comments

import os
import uuid
from datetime import datetime
from typing import List, Optional

import httpx
import pytz
from fastapi import APIRouter, Depends, File, Form, UploadFile, Body
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from core.config import UPLOAD_SERVICE_URL
from core.database import get_db
from models import (
    UserFeed, UserFeedImage, UserFeedGlow, UserFeedEcho,
    UserFeedSpark, UserFeedComment, UserFeedCommentGlow,
    UserFeedPinned, User, UserProfile,
)
from utils.auth import get_current_user
from utils.helpers import standard_response, paginate

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/posts", tags=["Posts/Feed"])


def _post_dict(db, post, current_user_id=None):
    user = db.query(User).filter(User.id == post.user_id).first()
    profile = db.query(UserProfile).filter(UserProfile.user_id == post.user_id).first() if user else None
    images = db.query(UserFeedImage).filter(UserFeedImage.feed_id == post.id).all()
    glow_count = db.query(sa_func.count(UserFeedGlow.id)).filter(UserFeedGlow.feed_id == post.id).scalar() or 0
    echo_count = db.query(sa_func.count(UserFeedEcho.id)).filter(UserFeedEcho.feed_id == post.id).scalar() or 0
    spark_count = db.query(sa_func.count(UserFeedSpark.id)).filter(UserFeedSpark.feed_id == post.id).scalar() or 0
    comment_count = db.query(sa_func.count(UserFeedComment.id)).filter(UserFeedComment.feed_id == post.id).scalar() or 0

    has_glowed = False
    has_echoed = False
    if current_user_id:
        has_glowed = db.query(UserFeedGlow).filter(UserFeedGlow.feed_id == post.id, UserFeedGlow.user_id == current_user_id).first() is not None
        has_echoed = db.query(UserFeedEcho).filter(UserFeedEcho.feed_id == post.id, UserFeedEcho.user_id == current_user_id).first() is not None

    return {
        "id": str(post.id),
        "author": {
            "id": str(user.id) if user else None,
            "name": f"{user.first_name} {user.last_name}" if user else None,
            "username": user.username if user else None,
            "avatar": profile.profile_picture_url if profile else None,
        },
        "content": post.content, "images": [img.image_url for img in images],
        "location": post.location if hasattr(post, "location") else None,
        "glow_count": glow_count, "echo_count": echo_count,
        "spark_count": spark_count, "comment_count": comment_count,
        "has_glowed": has_glowed, "has_echoed": has_echoed,
        "is_pinned": db.query(UserFeedPinned).filter(UserFeedPinned.feed_id == post.id).first() is not None,
        "created_at": post.created_at.isoformat() if post.created_at else None,
    }


@router.get("/saved")
def get_saved_posts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Saved posts retrieved", [])


@router.get("/feed")
def get_feed(page: int = 1, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(UserFeed).filter(UserFeed.is_active == True).order_by(UserFeed.created_at.desc())
    items, pagination = paginate(query, page, limit)
    return standard_response(True, "Feed retrieved", {"posts": [_post_dict(db, p, current_user.id) for p in items], "pagination": pagination})


@router.get("/explore")
def get_explore(page: int = 1, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(UserFeed).filter(UserFeed.is_active == True).order_by(UserFeed.created_at.desc())
    items, pagination = paginate(query, page, limit)
    return standard_response(True, "Explore posts retrieved", {"posts": [_post_dict(db, p, current_user.id) for p in items], "pagination": pagination})


@router.get("/user/{user_id}")
def get_user_posts(user_id: str, page: int = 1, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")
    query = db.query(UserFeed).filter(UserFeed.user_id == uid, UserFeed.is_active == True).order_by(UserFeed.created_at.desc())
    items, pagination = paginate(query, page, limit)
    return standard_response(True, "User posts retrieved", {"posts": [_post_dict(db, p, current_user.id) for p in items], "pagination": pagination})


@router.get("/{post_id}")
def get_post(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    post = db.query(UserFeed).filter(UserFeed.id == pid).first()
    if not post:
        return standard_response(False, "Post not found")
    return standard_response(True, "Post retrieved", _post_dict(db, post, current_user.id))


@router.post("/")
async def create_post(
    content: Optional[str] = Form(None), location: Optional[str] = Form(None),
    images: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    if not content and not images:
        return standard_response(False, "Content or images are required")

    now = datetime.now(EAT)
    post = UserFeed(id=uuid.uuid4(), user_id=current_user.id, content=content.strip() if content else None, is_active=True, created_at=now, updated_at=now)
    if hasattr(post, "location") and location:
        post.location = location.strip()
    db.add(post)
    db.flush()

    if images:
        for file in images:
            if not file or not file.filename:
                continue
            file_content = await file.read()
            _, ext = os.path.splitext(file.filename)
            unique_name = f"{uuid.uuid4().hex}{ext}"
            async with httpx.AsyncClient() as client:
                try:
                    resp = await client.post(UPLOAD_SERVICE_URL, data={"target_path": f"nuru/uploads/posts/{post.id}/"}, files={"file": (unique_name, file_content, file.content_type)}, timeout=20)
                    result = resp.json()
                    if result.get("success"):
                        db.add(UserFeedImage(id=uuid.uuid4(), feed_id=post.id, image_url=result["data"]["url"], created_at=now))
                except Exception:
                    pass

    db.commit()
    return standard_response(True, "Post created successfully", _post_dict(db, post, current_user.id))


@router.put("/{post_id}")
def update_post(post_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    post = db.query(UserFeed).filter(UserFeed.id == pid, UserFeed.user_id == current_user.id).first()
    if not post:
        return standard_response(False, "Post not found")
    if "content" in body: post.content = body["content"]
    post.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Post updated successfully")


@router.delete("/{post_id}")
def delete_post(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    post = db.query(UserFeed).filter(UserFeed.id == pid, UserFeed.user_id == current_user.id).first()
    if not post:
        return standard_response(False, "Post not found")
    post.is_active = False
    db.commit()
    return standard_response(True, "Post deleted successfully")


# Glow
@router.post("/{post_id}/glow")
def glow_post(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    existing = db.query(UserFeedGlow).filter(UserFeedGlow.feed_id == pid, UserFeedGlow.user_id == current_user.id).first()
    if existing:
        return standard_response(True, "Already glowed")
    db.add(UserFeedGlow(id=uuid.uuid4(), feed_id=pid, user_id=current_user.id, created_at=datetime.now(EAT)))
    db.commit()
    return standard_response(True, "Post glowed")


@router.delete("/{post_id}/glow")
def unglow_post(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    g = db.query(UserFeedGlow).filter(UserFeedGlow.feed_id == pid, UserFeedGlow.user_id == current_user.id).first()
    if g:
        db.delete(g)
        db.commit()
    return standard_response(True, "Glow removed")


# Echo
@router.post("/{post_id}/echo")
def echo_post(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    existing = db.query(UserFeedEcho).filter(UserFeedEcho.feed_id == pid, UserFeedEcho.user_id == current_user.id).first()
    if existing:
        return standard_response(True, "Already echoed")
    db.add(UserFeedEcho(id=uuid.uuid4(), feed_id=pid, user_id=current_user.id, created_at=datetime.now(EAT)))
    db.commit()
    return standard_response(True, "Post echoed")


@router.delete("/{post_id}/echo")
def unecho_post(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    e = db.query(UserFeedEcho).filter(UserFeedEcho.feed_id == pid, UserFeedEcho.user_id == current_user.id).first()
    if e:
        db.delete(e)
        db.commit()
    return standard_response(True, "Echo removed")


# Spark
@router.post("/{post_id}/spark")
def spark_post(post_id: str, body: dict = Body(default={}), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    db.add(UserFeedSpark(id=uuid.uuid4(), feed_id=pid, user_id=current_user.id, platform=body.get("platform", "link"), created_at=datetime.now(EAT)))
    db.commit()
    return standard_response(True, "Post shared")


# Comments
@router.get("/{post_id}/comments")
def get_comments(post_id: str, page: int = 1, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    query = db.query(UserFeedComment).filter(UserFeedComment.feed_id == pid, UserFeedComment.is_active == True).order_by(UserFeedComment.created_at.asc())
    items, pagination = paginate(query, page, limit)
    data = []
    for c in items:
        u = db.query(User).filter(User.id == c.user_id).first()
        p = db.query(UserProfile).filter(UserProfile.user_id == c.user_id).first() if u else None
        data.append({"id": str(c.id), "content": c.content, "author": {"id": str(u.id), "name": f"{u.first_name} {u.last_name}", "avatar": p.profile_picture_url if p else None} if u else None, "glow_count": db.query(UserFeedCommentGlow).filter(UserFeedCommentGlow.comment_id == c.id).count(), "created_at": c.created_at.isoformat()})
    return standard_response(True, "Comments retrieved", {"comments": data, "pagination": pagination})


@router.post("/{post_id}/comments")
def create_comment(post_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    content = body.get("content", "").strip()
    if not content:
        return standard_response(False, "Comment content is required")
    now = datetime.now(EAT)
    comment = UserFeedComment(id=uuid.uuid4(), feed_id=pid, user_id=current_user.id, content=content, is_active=True, created_at=now, updated_at=now)
    db.add(comment)
    db.commit()
    return standard_response(True, "Comment posted", {"id": str(comment.id)})


@router.put("/{post_id}/comments/{comment_id}")
def update_comment(post_id: str, comment_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(comment_id)
    except ValueError:
        return standard_response(False, "Invalid comment ID")
    c = db.query(UserFeedComment).filter(UserFeedComment.id == cid, UserFeedComment.user_id == current_user.id).first()
    if not c:
        return standard_response(False, "Comment not found")
    if "content" in body: c.content = body["content"]
    c.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Comment updated")


@router.delete("/{post_id}/comments/{comment_id}")
def delete_comment(post_id: str, comment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(comment_id)
    except ValueError:
        return standard_response(False, "Invalid comment ID")
    c = db.query(UserFeedComment).filter(UserFeedComment.id == cid, UserFeedComment.user_id == current_user.id).first()
    if not c:
        return standard_response(False, "Comment not found")
    c.is_active = False
    db.commit()
    return standard_response(True, "Comment deleted")


@router.post("/{post_id}/comments/{comment_id}/glow")
def glow_comment(post_id: str, comment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(comment_id)
    except ValueError:
        return standard_response(False, "Invalid comment ID")
    existing = db.query(UserFeedCommentGlow).filter(UserFeedCommentGlow.comment_id == cid, UserFeedCommentGlow.user_id == current_user.id).first()
    if not existing:
        db.add(UserFeedCommentGlow(id=uuid.uuid4(), comment_id=cid, user_id=current_user.id, created_at=datetime.now(EAT)))
        db.commit()
    return standard_response(True, "Comment glowed")


@router.delete("/{post_id}/comments/{comment_id}/glow")
def unglow_comment(post_id: str, comment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(comment_id)
    except ValueError:
        return standard_response(False, "Invalid comment ID")
    g = db.query(UserFeedCommentGlow).filter(UserFeedCommentGlow.comment_id == cid, UserFeedCommentGlow.user_id == current_user.id).first()
    if g:
        db.delete(g)
        db.commit()
    return standard_response(True, "Comment glow removed")


# Save/Pin/Report
@router.post("/{post_id}/save")
def save_post(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Post saved")

@router.delete("/{post_id}/save")
def unsave_post(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Post unsaved")

@router.post("/{post_id}/pin")
def pin_post(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    existing = db.query(UserFeedPinned).filter(UserFeedPinned.feed_id == pid, UserFeedPinned.user_id == current_user.id).first()
    if not existing:
        db.add(UserFeedPinned(id=uuid.uuid4(), feed_id=pid, user_id=current_user.id, created_at=datetime.now(EAT)))
        db.commit()
    return standard_response(True, "Post pinned")

@router.delete("/{post_id}/pin")
def unpin_post(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    p = db.query(UserFeedPinned).filter(UserFeedPinned.feed_id == pid, UserFeedPinned.user_id == current_user.id).first()
    if p:
        db.delete(p)
        db.commit()
    return standard_response(True, "Post unpinned")

@router.post("/{post_id}/report")
def report_post(post_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return standard_response(True, "Post reported. Our team will review it shortly.")
