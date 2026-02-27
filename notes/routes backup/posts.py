# backend/app/api/routes/posts.py
# MODULE 14: FEED / POSTS

import math
import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
import pytz
from fastapi import APIRouter, Depends, Body, File, Form, UploadFile
from sqlalchemy import func as sa_func, Column, Text, Boolean, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Session
from core.database import get_db
from core.base import Base
from models import User, UserProfile, UserFeed, UserFeedImage, UserFeedGlow, UserFeedEcho, UserFeedComment, UserFeedCommentGlow, UserFeedPinned
from utils.auth import get_current_user
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter()


def _user_preview(db: Session, user_id, current_user_id=None) -> dict | None:
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


def _post_dict(db: Session, post, current_user_id=None) -> dict:
    images = db.query(UserFeedImage).filter(UserFeedImage.feed_id == post.id).order_by(UserFeedImage.created_at.asc()).all()
    media = [
        {"id": str(img.id), "type": "image", "url": img.image_url, "thumbnail_url": img.image_url}
        for img in images
    ]

    has_glowed = False
    has_echoed = False
    if current_user_id:
        has_glowed = db.query(UserFeedGlow).filter(UserFeedGlow.feed_id == post.id, UserFeedGlow.user_id == current_user_id).first() is not None
        has_echoed = db.query(UserFeedEcho).filter(UserFeedEcho.feed_id == post.id, UserFeedEcho.user_id == current_user_id).first() is not None

    comment_count = db.query(sa_func.count(UserFeedComment.id)).filter(UserFeedComment.feed_id == post.id).scalar() or 0
    is_pinned = db.query(UserFeedPinned).filter(UserFeedPinned.feed_id == post.id).first() is not None

    return {
        "id": str(post.id),
        "user": _user_preview(db, post.user_id, current_user_id),
        "content": post.content,
        "media": media,
        "location": {"name": post.location} if post.location else None,
        "glow_count": post.glow_count or 0,
        "echo_count": post.echo_count or 0,
        "comment_count": comment_count,
        "share_count": post.spark_count or 0,
        "has_glowed": has_glowed,
        "has_echoed": has_echoed,
        "has_saved": False,
        "is_pinned": is_pinned,
        "privacy": "public" if post.is_public else "followers",
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "updated_at": post.updated_at.isoformat() if post.updated_at else None,
    }


# =============================================================================
# 14.2 GET /posts/{postId}
# =============================================================================

@router.get("/posts/{post_id}")
def get_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID.")

    post = db.query(UserFeed).filter(UserFeed.id == pid).first()
    if not post:
        return standard_response(False, "Post not found")

    return standard_response(True, "Post retrieved successfully", _post_dict(db, post, current_user.id))


# =============================================================================
# 14.3 POST /posts — Create post
# =============================================================================

@router.post("/posts")
async def create_post(
    content: Optional[str] = Form(None),
    location_name: Optional[str] = Form(None),
    privacy: Optional[str] = Form("public"),
    media: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not content and (not media or len(media) == 0):
        return standard_response(False, "Content or media is required")

    if content and len(content) > 2000:
        return standard_response(False, "Content must be at most 2000 characters")

    now = datetime.now(EAT)

    post = UserFeed(
        id=uuid.uuid4(),
        user_id=current_user.id,
        content=content.strip() if content else None,
        location=location_name,
        is_public=privacy != "private",
        created_at=now,
        updated_at=now,
    )
    db.add(post)

    # Handle media uploads
    uploaded_images = []
    if media:
        for i, file in enumerate(media[:10]):
            if file and file.filename:
                # In production, upload to storage service
                # For now, store the filename reference
                img = UserFeedImage(
                    id=uuid.uuid4(),
                    feed_id=post.id,
                    image_url=f"/uploads/posts/{post.id}/{file.filename}",
                    is_featured=i == 0,
                    created_at=now,
                    updated_at=now,
                )
                db.add(img)
                uploaded_images.append(img)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed to create post: {str(e)}")

    return standard_response(True, "Post created successfully", _post_dict(db, post, current_user.id))


# =============================================================================
# 14.4 PUT /posts/{postId}
# =============================================================================

@router.put("/posts/{post_id}")
def update_post(
    post_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID.")

    post = db.query(UserFeed).filter(UserFeed.id == pid).first()
    if not post:
        return standard_response(False, "Post not found")
    if str(post.user_id) != str(current_user.id):
        return standard_response(False, "You can only edit your own posts")

    # Check 24hr edit window
    if post.created_at and (datetime.now(EAT) - post.created_at.replace(tzinfo=EAT if post.created_at.tzinfo is None else None)) > timedelta(hours=24):
        return standard_response(False, "Posts can only be edited within 24 hours of creation")

    if "content" in body:
        post.content = body["content"].strip() if body["content"] else None
    if "privacy" in body:
        post.is_public = body["privacy"] != "private"

    post.updated_at = datetime.now(EAT)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Post updated successfully", {
        "id": str(post.id),
        "content": post.content,
        "privacy": "public" if post.is_public else "followers",
        "updated_at": post.updated_at.isoformat(),
    })


# =============================================================================
# 14.5 DELETE /posts/{postId}
# =============================================================================

@router.delete("/posts/{post_id}")
def delete_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID.")

    post = db.query(UserFeed).filter(UserFeed.id == pid).first()
    if not post:
        return standard_response(False, "Post not found")
    if str(post.user_id) != str(current_user.id):
        return standard_response(False, "You can only delete your own posts")

    db.delete(post)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Post deleted successfully")


# =============================================================================
# 14.6 POST /posts/{postId}/glow — Like
# =============================================================================

@router.post("/posts/{post_id}/glow")
def glow_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID.")

    post = db.query(UserFeed).filter(UserFeed.id == pid).first()
    if not post:
        return standard_response(False, "Post not found")

    existing = db.query(UserFeedGlow).filter(UserFeedGlow.feed_id == pid, UserFeedGlow.user_id == current_user.id).first()
    if existing:
        return standard_response(False, "You have already glowed this post")

    now = datetime.now(EAT)
    glow = UserFeedGlow(id=uuid.uuid4(), feed_id=pid, user_id=current_user.id, created_at=now)
    db.add(glow)
    post.glow_count = (post.glow_count or 0) + 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Post glowed successfully", {
        "glow_id": str(glow.id), "post_id": str(pid), "user_id": str(current_user.id), "created_at": now.isoformat(),
    })


# =============================================================================
# 14.7 DELETE /posts/{postId}/glow — Unlike
# =============================================================================

@router.delete("/posts/{post_id}/glow")
def unglow_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID.")

    glow = db.query(UserFeedGlow).filter(UserFeedGlow.feed_id == pid, UserFeedGlow.user_id == current_user.id).first()
    if not glow:
        return standard_response(False, "You have not glowed this post")

    post = db.query(UserFeed).filter(UserFeed.id == pid).first()
    if post:
        post.glow_count = max(0, (post.glow_count or 0) - 1)

    db.delete(glow)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Glow removed successfully")


# =============================================================================
# 14.9 POST /posts/{postId}/echo — Repost
# =============================================================================

@router.post("/posts/{post_id}/echo")
def echo_post(
    post_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID.")

    post = db.query(UserFeed).filter(UserFeed.id == pid).first()
    if not post:
        return standard_response(False, "Post not found")

    existing = db.query(UserFeedEcho).filter(UserFeedEcho.feed_id == pid, UserFeedEcho.user_id == current_user.id).first()
    if existing:
        return standard_response(False, "You have already echoed this post")

    now = datetime.now(EAT)
    echo = UserFeedEcho(
        id=uuid.uuid4(), feed_id=pid, user_id=current_user.id,
        content=body.get("comment", ""), created_at=now, updated_at=now,
    )
    db.add(echo)
    post.echo_count = (post.echo_count or 0) + 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Post echoed successfully", {
        "echo_id": str(echo.id), "original_post_id": str(pid),
        "echoed_by": {"id": str(current_user.id), "username": current_user.username},
        "comment": echo.content, "created_at": now.isoformat(),
    })


# =============================================================================
# 14.10 DELETE /posts/{postId}/echo
# =============================================================================

@router.delete("/posts/{post_id}/echo")
def remove_echo(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID.")

    echo = db.query(UserFeedEcho).filter(UserFeedEcho.feed_id == pid, UserFeedEcho.user_id == current_user.id).first()
    if not echo:
        return standard_response(False, "Echo not found")

    post = db.query(UserFeed).filter(UserFeed.id == pid).first()
    if post:
        post.echo_count = max(0, (post.echo_count or 0) - 1)

    db.delete(echo)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Echo removed successfully")


# =============================================================================
# 14.11 GET /posts/{postId}/comments
# =============================================================================

@router.get("/posts/{post_id}/comments")
def get_comments(
    post_id: str,
    page: int = 1,
    limit: int = 20,
    sort: str = "newest",
    parent_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID.")

    query = db.query(UserFeedComment).filter(UserFeedComment.feed_id == pid)

    if parent_id:
        try:
            query = query.filter(UserFeedComment.parent_comment_id == uuid.UUID(parent_id))
        except ValueError:
            pass
    else:
        query = query.filter(UserFeedComment.parent_comment_id.is_(None))

    if sort == "oldest":
        query = query.order_by(UserFeedComment.created_at.asc())
    elif sort == "popular":
        query = query.order_by(UserFeedComment.glow_count.desc())
    else:
        query = query.order_by(UserFeedComment.created_at.desc())

    total_items = query.count()
    total_pages = max(1, math.ceil(total_items / limit))
    offset = (page - 1) * limit
    comments = query.offset(offset).limit(limit).all()

    result = []
    for c in comments:
        has_glowed = db.query(UserFeedCommentGlow).filter(
            UserFeedCommentGlow.comment_id == c.id, UserFeedCommentGlow.user_id == current_user.id
        ).first() is not None

        # Preview replies
        replies = db.query(UserFeedComment).filter(UserFeedComment.parent_comment_id == c.id).order_by(UserFeedComment.created_at.asc()).limit(2).all()

        result.append({
            "id": str(c.id),
            "user": _user_preview(db, c.user_id, current_user.id),
            "content": c.content,
            "media": None,
            "glow_count": c.glow_count or 0,
            "reply_count": c.reply_count or 0,
            "has_glowed": has_glowed,
            "is_edited": c.is_edited,
            "parent_id": str(c.parent_comment_id) if c.parent_comment_id else None,
            "replies_preview": [
                {"id": str(r.id), "user": _user_preview(db, r.user_id), "content": r.content, "created_at": r.created_at.isoformat() if r.created_at else None}
                for r in replies
            ],
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        })

    return standard_response(True, "Comments retrieved successfully", {
        "comments": result,
        "pagination": {
            "current_page": page, "per_page": limit, "total_items": total_items,
            "total_pages": total_pages, "has_next": page < total_pages, "has_previous": page > 1,
        },
    })


# =============================================================================
# 14.12 POST /posts/{postId}/comments — Create comment
# =============================================================================

@router.post("/posts/{post_id}/comments")
def create_comment(
    post_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID.")

    post = db.query(UserFeed).filter(UserFeed.id == pid).first()
    if not post:
        return standard_response(False, "Post not found")

    content = body.get("content", "").strip()
    if not content:
        return standard_response(False, "Comment content is required")
    if len(content) > 1000:
        return standard_response(False, "Comment must be at most 1000 characters")

    now = datetime.now(EAT)
    parent_id = None
    if body.get("parent_id"):
        try:
            parent_id = uuid.UUID(body["parent_id"])
        except ValueError:
            pass

    comment = UserFeedComment(
        id=uuid.uuid4(), feed_id=pid, user_id=current_user.id,
        parent_comment_id=parent_id, content=content,
        created_at=now, updated_at=now,
    )
    db.add(comment)

    # Update parent reply count
    if parent_id:
        parent = db.query(UserFeedComment).filter(UserFeedComment.id == parent_id).first()
        if parent:
            parent.reply_count = (parent.reply_count or 0) + 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Comment added successfully", {
        "id": str(comment.id),
        "user": _user_preview(db, current_user.id),
        "content": comment.content,
        "glow_count": 0, "reply_count": 0, "has_glowed": False, "is_edited": False,
        "parent_id": str(parent_id) if parent_id else None,
        "created_at": now.isoformat(), "updated_at": now.isoformat(),
    })


# =============================================================================
# 14.14 DELETE /posts/{postId}/comments/{commentId}
# =============================================================================

@router.delete("/posts/{post_id}/comments/{comment_id}")
def delete_comment(
    post_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(comment_id)
    except ValueError:
        return standard_response(False, "Invalid comment ID.")

    comment = db.query(UserFeedComment).filter(UserFeedComment.id == cid).first()
    if not comment:
        return standard_response(False, "Comment not found")
    if str(comment.user_id) != str(current_user.id):
        return standard_response(False, "You can only delete your own comments")

    db.delete(comment)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Comment deleted successfully")


# =============================================================================
# 14.15 POST /posts/{postId}/comments/{commentId}/glow
# =============================================================================

@router.post("/posts/{post_id}/comments/{comment_id}/glow")
def glow_comment(
    post_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(comment_id)
    except ValueError:
        return standard_response(False, "Invalid comment ID.")

    comment = db.query(UserFeedComment).filter(UserFeedComment.id == cid).first()
    if not comment:
        return standard_response(False, "Comment not found")

    existing = db.query(UserFeedCommentGlow).filter(UserFeedCommentGlow.comment_id == cid, UserFeedCommentGlow.user_id == current_user.id).first()
    if existing:
        return standard_response(False, "Already glowed")

    now = datetime.now(EAT)
    glow = UserFeedCommentGlow(id=uuid.uuid4(), comment_id=cid, user_id=current_user.id, created_at=now)
    db.add(glow)
    comment.glow_count = (comment.glow_count or 0) + 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Comment glowed successfully", {"glow_id": str(glow.id), "created_at": now.isoformat()})


# =============================================================================
# 14.16 DELETE /posts/{postId}/comments/{commentId}/glow
# =============================================================================

@router.delete("/posts/{post_id}/comments/{comment_id}/glow")
def unglow_comment(
    post_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cid = uuid.UUID(comment_id)
    except ValueError:
        return standard_response(False, "Invalid comment ID.")

    glow = db.query(UserFeedCommentGlow).filter(UserFeedCommentGlow.comment_id == cid, UserFeedCommentGlow.user_id == current_user.id).first()
    if not glow:
        return standard_response(False, "Not glowed")

    comment = db.query(UserFeedComment).filter(UserFeedComment.id == cid).first()
    if comment:
        comment.glow_count = max(0, (comment.glow_count or 0) - 1)

    db.delete(glow)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Comment glow removed successfully")


# =============================================================================
# 14.21 POST /posts/{postId}/pin
# =============================================================================

@router.post("/posts/{post_id}/pin")
def pin_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID.")

    post = db.query(UserFeed).filter(UserFeed.id == pid).first()
    if not post:
        return standard_response(False, "Post not found")
    if str(post.user_id) != str(current_user.id):
        return standard_response(False, "You can only pin your own posts")

    # Max 3 pins
    pin_count = db.query(UserFeedPinned).filter(UserFeedPinned.user_id == current_user.id).count()
    if pin_count >= 3:
        return standard_response(False, "You can only pin up to 3 posts")

    existing = db.query(UserFeedPinned).filter(UserFeedPinned.user_id == current_user.id, UserFeedPinned.feed_id == pid).first()
    if existing:
        return standard_response(False, "Post is already pinned")

    now = datetime.now(EAT)
    pin = UserFeedPinned(id=uuid.uuid4(), user_id=current_user.id, feed_id=pid, display_order=pin_count, pinned_at=now)
    db.add(pin)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Post pinned to profile", {"post_id": str(pid), "pinned_at": now.isoformat()})


# =============================================================================
# 14.22 DELETE /posts/{postId}/pin
# =============================================================================

@router.delete("/posts/{post_id}/pin")
def unpin_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID.")

    pin = db.query(UserFeedPinned).filter(UserFeedPinned.user_id == current_user.id, UserFeedPinned.feed_id == pid).first()
    if not pin:
        return standard_response(False, "Post is not pinned")

    db.delete(pin)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return standard_response(False, f"Failed: {str(e)}")

    return standard_response(True, "Post unpinned successfully")
