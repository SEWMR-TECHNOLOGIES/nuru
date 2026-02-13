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
    UserFeedPinned, UserFeedSaved, User, UserProfile, UserCircle, FeedVisibilityEnum,
)
from utils.auth import get_current_user
from utils.helpers import standard_response, paginate


def _visible_feed_query(db, current_user_id):
    """Return a query for active posts visible to current_user.
    Public posts: everyone sees them.
    Circle posts: only the author OR users who are IN the author's circle can see them.
    i.e. if author X set post to 'circle', current_user sees it only if X added current_user to X's circle.
    """
    from sqlalchemy import or_, and_
    # Find all users who have added current_user to THEIR circle
    authors_who_include_me = db.query(UserCircle.user_id).filter(
        UserCircle.circle_member_id == current_user_id
    )
    author_ids = [r[0] for r in authors_who_include_me.all()]
    query = db.query(UserFeed).filter(UserFeed.is_active == True)
    if author_ids:
        query = query.filter(
            or_(
                UserFeed.visibility == FeedVisibilityEnum.public,
                UserFeed.visibility.is_(None),
                UserFeed.user_id == current_user_id,
                and_(
                    UserFeed.visibility == FeedVisibilityEnum.circle,
                    UserFeed.user_id.in_(author_ids),
                ),
            )
        )
    else:
        query = query.filter(
            or_(
                UserFeed.visibility == FeedVisibilityEnum.public,
                UserFeed.visibility.is_(None),
                UserFeed.user_id == current_user_id,
            )
        )
    return query

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/posts", tags=["Posts/Feed"])


def _user_dict(db, user_id):
    """Build a compact user dict for embedding in comments/replies."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        return None
    p = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    return {
        "id": str(u.id),
        "name": f"{u.first_name} {u.last_name}",
        "username": u.username,
        "avatar": p.profile_picture_url if p else None,
    }


def _comment_dict(db, comment, current_user_id=None, include_replies_preview=True):
    """Build a full comment dict with glow status and optional replies preview."""
    author = _user_dict(db, comment.user_id)
    glow_count = db.query(sa_func.count(UserFeedCommentGlow.id)).filter(
        UserFeedCommentGlow.comment_id == comment.id
    ).scalar() or 0
    reply_count = db.query(sa_func.count(UserFeedComment.id)).filter(
        UserFeedComment.parent_comment_id == comment.id,
        UserFeedComment.is_active == True,
    ).scalar() or 0

    has_glowed = False
    if current_user_id:
        has_glowed = db.query(UserFeedCommentGlow).filter(
            UserFeedCommentGlow.comment_id == comment.id,
            UserFeedCommentGlow.user_id == current_user_id,
        ).first() is not None

    result = {
        "id": str(comment.id),
        "content": comment.content,
        "author": author,
        "glow_count": glow_count,
        "reply_count": reply_count,
        "has_glowed": has_glowed,
        "is_edited": comment.is_edited or False,
        "is_pinned": comment.is_pinned or False,
        "parent_id": str(comment.parent_comment_id) if comment.parent_comment_id else None,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "updated_at": comment.updated_at.isoformat() if comment.updated_at else None,
    }

    # Include a preview of first 2 replies for top-level comments
    if include_replies_preview and not comment.parent_comment_id:
        replies = db.query(UserFeedComment).filter(
            UserFeedComment.parent_comment_id == comment.id,
            UserFeedComment.is_active == True,
        ).order_by(UserFeedComment.created_at.asc()).limit(2).all()
        result["replies_preview"] = [
            _comment_dict(db, r, current_user_id, include_replies_preview=False)
            for r in replies
        ]

    return result


def _post_dict(db, post, current_user_id=None):
    user = db.query(User).filter(User.id == post.user_id).first()
    profile = db.query(UserProfile).filter(UserProfile.user_id == post.user_id).first() if user else None
    images = db.query(UserFeedImage).filter(UserFeedImage.feed_id == post.id).all()
    glow_count = db.query(sa_func.count(UserFeedGlow.id)).filter(UserFeedGlow.feed_id == post.id).scalar() or 0
    echo_count = db.query(sa_func.count(UserFeedEcho.id)).filter(UserFeedEcho.feed_id == post.id).scalar() or 0
    spark_count = db.query(sa_func.count(UserFeedSpark.id)).filter(UserFeedSpark.feed_id == post.id).scalar() or 0
    comment_count = db.query(sa_func.count(UserFeedComment.id)).filter(UserFeedComment.feed_id == post.id, UserFeedComment.is_active == True).scalar() or 0

    has_glowed = False
    has_echoed = False
    has_saved = False
    if current_user_id:
        has_glowed = db.query(UserFeedGlow).filter(UserFeedGlow.feed_id == post.id, UserFeedGlow.user_id == current_user_id).first() is not None
        has_echoed = db.query(UserFeedEcho).filter(UserFeedEcho.feed_id == post.id, UserFeedEcho.user_id == current_user_id).first() is not None
        has_saved = db.query(UserFeedSaved).filter(UserFeedSaved.feed_id == post.id, UserFeedSaved.user_id == current_user_id).first() is not None

    return {
        "id": str(post.id),
        "author": {
            "id": str(user.id) if user else None,
            "name": f"{user.first_name} {user.last_name}" if user else None,
            "username": user.username if user else None,
            "avatar": profile.profile_picture_url if profile else None,
        },
        "content": post.content, "images": [img.image_url for img in images],
        "location": post.location,
        "visibility": post.visibility.value if post.visibility else "public",
        "glow_count": glow_count, "echo_count": echo_count,
        "spark_count": spark_count, "comment_count": comment_count,
        "has_glowed": has_glowed, "has_echoed": has_echoed, "has_saved": has_saved,
        "is_pinned": db.query(UserFeedPinned).filter(UserFeedPinned.feed_id == post.id).first() is not None,
        "created_at": post.created_at.isoformat() if post.created_at else None,
    }


@router.get("/saved")
def get_saved_posts(page: int = 1, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = (
        db.query(UserFeed)
        .join(UserFeedSaved, UserFeedSaved.feed_id == UserFeed.id)
        .filter(UserFeedSaved.user_id == current_user.id, UserFeed.is_active == True)
        .order_by(UserFeedSaved.created_at.desc())
    )
    items, pagination = paginate(query, page, limit)
    posts = [_post_dict(db, p, current_user.id) for p in items]
    # Mark all as saved
    for p in posts:
        p["is_saved"] = True
    return standard_response(True, "Saved posts retrieved", {"saved_posts": posts, "pagination": pagination})


@router.get("/feed")
def get_feed(page: int = 1, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = _visible_feed_query(db, current_user.id).order_by(UserFeed.created_at.desc())
    items, pagination = paginate(query, page, limit)
    return standard_response(True, "Feed retrieved", {"posts": [_post_dict(db, p, current_user.id) for p in items], "pagination": pagination})


@router.get("/explore")
def get_explore(page: int = 1, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = _visible_feed_query(db, current_user.id).order_by(UserFeed.created_at.desc())
    items, pagination = paginate(query, page, limit)
    return standard_response(True, "Explore posts retrieved", {"posts": [_post_dict(db, p, current_user.id) for p in items], "pagination": pagination})


@router.get("/user/{user_id}")
def get_user_posts(user_id: str, page: int = 1, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")
    from sqlalchemy import or_, and_
    query = db.query(UserFeed).filter(UserFeed.user_id == uid, UserFeed.is_active == True)
    # If viewing someone else's profile, filter out circle posts unless they added you to their circle
    if str(uid) != str(current_user.id):
        is_in_circle = db.query(UserCircle).filter(
            UserCircle.user_id == uid,
            UserCircle.circle_member_id == current_user.id,
        ).first()
        if is_in_circle:
            # Can see public + circle posts
            pass
        else:
            # Can only see public posts
            query = query.filter(
                or_(
                    UserFeed.visibility == FeedVisibilityEnum.public,
                    UserFeed.visibility.is_(None),
                )
            )
    query = query.order_by(UserFeed.created_at.desc())
    items, pagination = paginate(query, page, limit)
    return standard_response(True, "User posts retrieved", {"posts": [_post_dict(db, p, current_user.id) for p in items], "pagination": pagination})

@router.get("/public/trending")
def get_public_trending_posts(limit: int = 12, db: Session = Depends(get_db)):
    """Public endpoint - returns trending public posts with images, sorted by engagement."""
    from sqlalchemy import or_, desc

    # Only public, active posts that have at least one image
    posts_with_images = (
        db.query(UserFeed)
        .filter(
            UserFeed.is_active == True,
            or_(
                UserFeed.visibility == FeedVisibilityEnum.public,
                UserFeed.visibility.is_(None),
            ),
        )
        .join(UserFeedImage, UserFeedImage.feed_id == UserFeed.id)
        .distinct()
        .all()
    )

    if not posts_with_images:
        return standard_response(True, "No public moments", [])

    # Score by engagement (glows + echoes + comments)
    scored = []
    for post in posts_with_images:
        glows = db.query(sa_func.count(UserFeedGlow.id)).filter(UserFeedGlow.feed_id == post.id).scalar() or 0
        echoes = db.query(sa_func.count(UserFeedEcho.id)).filter(UserFeedEcho.feed_id == post.id).scalar() or 0
        comments = db.query(sa_func.count(UserFeedComment.id)).filter(
            UserFeedComment.feed_id == post.id, UserFeedComment.is_active == True
        ).scalar() or 0
        score = glows * 2 + echoes * 3 + comments
        scored.append((post, score))

    # Sort by score desc, then by newest
    scored.sort(key=lambda x: (-x[1], x[0].created_at), reverse=False)
    top = [p for p, _ in scored[:limit]]

    return standard_response(True, "Trending moments", [_post_dict(db, p) for p in top])


@router.get("/{post_id}/public")
def get_post_public(post_id: str, db: Session = Depends(get_db)):
    """Public endpoint - returns post data without auth for public posts only."""
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    post = db.query(UserFeed).filter(UserFeed.id == pid, UserFeed.is_active == True).first()
    if not post:
        return standard_response(False, "Post not found")
    # Only allow public posts
    if post.visibility and post.visibility != FeedVisibilityEnum.public:
        return standard_response(False, "This post is private")
    return standard_response(True, "Post retrieved", _post_dict(db, post))


@router.get("/{post_id}")
def get_post(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    post = db.query(UserFeed).filter(UserFeed.id == pid).first()
    if not post:
        return standard_response(False, "Post not found")
    # Enforce circle visibility: only author or circle members can see circle posts
    if post.visibility == FeedVisibilityEnum.circle and str(post.user_id) != str(current_user.id):
        is_in_circle = db.query(UserCircle).filter(
            UserCircle.user_id == post.user_id,
            UserCircle.circle_member_id == current_user.id,
        ).first()
        if not is_in_circle:
            return standard_response(False, "This post is private")
    return standard_response(True, "Post retrieved", _post_dict(db, post, current_user.id))


@router.post("/")
async def create_post(
    content: Optional[str] = Form(None), location: Optional[str] = Form(None),
    visibility: Optional[str] = Form("public"),
    images: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    if not content and not images:
        return standard_response(False, "Content or images are required")

    now = datetime.now(EAT)
    post = UserFeed(id=uuid.uuid4(), user_id=current_user.id, content=content.strip() if content else None, is_active=True, created_at=now, updated_at=now)
    if location:
        post.location = location.strip()
    if visibility and visibility.strip() in ("public", "circle"):
        post.visibility = FeedVisibilityEnum(visibility.strip())
    else:
        post.visibility = FeedVisibilityEnum.public
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
    if "content" in body:
        post.content = body["content"]
    if "visibility" in body and body["visibility"] in ("public", "circle"):
        post.visibility = FeedVisibilityEnum(body["visibility"])
    post.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Post updated successfully", _post_dict(db, post, current_user.id))


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


# ──────────────────────────────────────────────
# Comments (Echoes) - Threaded
# ──────────────────────────────────────────────

@router.get("/{post_id}/comments")
def get_comments(
    post_id: str, page: int = 1, limit: int = 20,
    sort: str = "newest", parent_id: Optional[str] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")

    query = db.query(UserFeedComment).filter(
        UserFeedComment.feed_id == pid,
        UserFeedComment.is_active == True,
    )

    # If parent_id is provided, get replies to that comment
    if parent_id:
        try:
            parent_uuid = uuid.UUID(parent_id)
        except ValueError:
            return standard_response(False, "Invalid parent comment ID")
        query = query.filter(UserFeedComment.parent_comment_id == parent_uuid)
    else:
        # Get only top-level comments (no parent)
        query = query.filter(UserFeedComment.parent_comment_id.is_(None))

    # Sorting
    if sort == "oldest":
        query = query.order_by(UserFeedComment.created_at.asc())
    elif sort == "popular":
        query = query.order_by(UserFeedComment.glow_count.desc(), UserFeedComment.created_at.desc())
    else:  # newest
        query = query.order_by(UserFeedComment.created_at.desc())

    items, pagination = paginate(query, page, limit)
    data = [_comment_dict(db, c, current_user.id) for c in items]
    return standard_response(True, "Comments retrieved", {"comments": data, "pagination": pagination})


@router.get("/{post_id}/comments/{comment_id}/replies")
def get_comment_replies(
    post_id: str, comment_id: str, page: int = 1, limit: int = 20,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    """Get all replies to a specific comment."""
    try:
        cid = uuid.UUID(comment_id)
    except ValueError:
        return standard_response(False, "Invalid comment ID")

    query = db.query(UserFeedComment).filter(
        UserFeedComment.parent_comment_id == cid,
        UserFeedComment.is_active == True,
    ).order_by(UserFeedComment.created_at.asc())

    items, pagination = paginate(query, page, limit)
    data = [_comment_dict(db, c, current_user.id, include_replies_preview=False) for c in items]
    return standard_response(True, "Replies retrieved", {"comments": data, "pagination": pagination})


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
    comment = UserFeedComment(
        id=uuid.uuid4(), feed_id=pid, user_id=current_user.id,
        content=content, is_active=True, created_at=now, updated_at=now,
    )

    # Handle reply to another comment
    parent_id = body.get("parent_id")
    if parent_id:
        try:
            parent_uuid = uuid.UUID(parent_id)
            # Verify parent comment exists
            parent = db.query(UserFeedComment).filter(
                UserFeedComment.id == parent_uuid,
                UserFeedComment.is_active == True,
            ).first()
            if parent:
                comment.parent_comment_id = parent_uuid
                # Update parent reply count
                parent.reply_count = (parent.reply_count or 0) + 1
        except ValueError:
            pass

    db.add(comment)
    db.commit()
    return standard_response(True, "Comment posted", _comment_dict(db, comment, current_user.id, include_replies_preview=False))


@router.put("/{post_id}/comments/{comment_id}")
def update_comment(post_id: str, comment_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(comment_id)
    except ValueError:
        return standard_response(False, "Invalid comment ID")
    c = db.query(UserFeedComment).filter(UserFeedComment.id == cid, UserFeedComment.user_id == current_user.id).first()
    if not c:
        return standard_response(False, "Comment not found")
    if "content" in body:
        c.content = body["content"]
        c.is_edited = True
    c.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Comment updated", _comment_dict(db, c, current_user.id, include_replies_preview=False))


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
    # Cascade soft-delete all child replies recursively
    def soft_delete_children(parent_id):
        children = db.query(UserFeedComment).filter(
            UserFeedComment.parent_comment_id == parent_id,
            UserFeedComment.is_active == True,
        ).all()
        for child in children:
            child.is_active = False
            soft_delete_children(child.id)
    soft_delete_children(c.id)
    # Decrement parent reply count if this is a reply
    if c.parent_comment_id:
        parent = db.query(UserFeedComment).filter(UserFeedComment.id == c.parent_comment_id).first()
        if parent and parent.reply_count and parent.reply_count > 0:
            parent.reply_count -= 1
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
        # Update cached glow count
        comment = db.query(UserFeedComment).filter(UserFeedComment.id == cid).first()
        if comment:
            comment.glow_count = (comment.glow_count or 0) + 1
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
        # Update cached glow count
        comment = db.query(UserFeedComment).filter(UserFeedComment.id == cid).first()
        if comment and comment.glow_count and comment.glow_count > 0:
            comment.glow_count -= 1
        db.commit()
    return standard_response(True, "Comment glow removed")


# Save/Pin/Report
@router.post("/{post_id}/save")
def save_post(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    existing = db.query(UserFeedSaved).filter(UserFeedSaved.feed_id == pid, UserFeedSaved.user_id == current_user.id).first()
    if not existing:
        db.add(UserFeedSaved(id=uuid.uuid4(), feed_id=pid, user_id=current_user.id, created_at=datetime.now(EAT)))
        db.commit()
    return standard_response(True, "Post saved")

@router.delete("/{post_id}/save")
def unsave_post(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")
    s = db.query(UserFeedSaved).filter(UserFeedSaved.feed_id == pid, UserFeedSaved.user_id == current_user.id).first()
    if s:
        db.delete(s)
        db.commit()
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
