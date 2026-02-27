# backend/app/api/routes/feeds.py
# MODULE 14: FEED

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
# 14.1 GET /feed — Get feed
# =============================================================================

@router.get("/feed")
def get_feed(
    page: int = 1,
    limit: int = 10,
    type: str = "all",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(UserFeed).filter(UserFeed.is_public == True).order_by(UserFeed.created_at.desc())

    total_items = query.count()
    total_pages = max(1, math.ceil(total_items / limit))
    offset = (page - 1) * limit
    posts = query.offset(offset).limit(limit).all()

    return standard_response(True, "Feed retrieved successfully", {
        "items": [_post_dict(db, p, current_user.id) for p in posts],
        "pagination": {
            "page": page, "limit": limit, "total_items": total_items,
            "total_pages": total_pages, "has_next": page < total_pages, "has_previous": page > 1,
        },
    })

