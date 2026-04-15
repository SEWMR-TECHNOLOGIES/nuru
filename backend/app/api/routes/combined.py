"""
Combined / Aggregated Endpoints
================================
Phase 6: Reduce frontend round-trips by providing composite endpoints
that return data from multiple resources in a single request.

These endpoints are optimized for how the client actually loads data:
- App launch: user profile + unread count + feed page 1 in one call
- Dashboard init: counts + recent activity in one call
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from core.database import get_db
from models import User, Notification, UserFeed, UserFeedImage, FeedVisibilityEnum
from utils.auth import get_current_user
from utils.helpers import standard_response

router = APIRouter(prefix="/combined", tags=["Combined"])


@router.get("/app-init")
def app_init(
    feed_limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Single call on app launch. Returns:
    - user profile payload
    - unread notification count
    - first page of feed (ranked)
    
    Replaces 3 separate API calls:
      GET /users/me
      GET /notifications/unread/count
      GET /posts/feed?page=1
    """
    from core.redis import cache_get, cache_set

    uid = str(current_user.id)
    cache_key = f"combined:init:{uid}:{feed_limit}"
    cached = cache_get(cache_key)
    if cached is not None:
        return standard_response(True, "App init data", cached)

    # 1. User payload
    from utils.user_payload import build_user_payload
    user_data = build_user_payload(db, current_user)

    # 2. Unread notification count
    unread = db.query(sa_func.count(Notification.id)).filter(
        Notification.recipient_id == current_user.id,
        Notification.is_read == False,
    ).scalar() or 0

    # 3. Feed page 1
    from api.routes.posts import _visible_feed_query
    from sqlalchemy import or_
    feed_limit = min(feed_limit, 50)

    try:
        from services.feed_ranking import generate_ranked_feed, get_cold_start_feed, UserInteractionLog

        interaction_count = db.query(sa_func.count(UserInteractionLog.id)).filter(
            UserInteractionLog.user_id == current_user.id
        ).scalar() or 0

        if interaction_count < 10:
            posts, pagination = get_cold_start_feed(db, current_user.id, 1, feed_limit)
        else:
            posts, pagination = generate_ranked_feed(db, current_user.id, 1, feed_limit, None)

        from utils.batch_loaders import build_post_dicts
        feed_data = {
            "posts": build_post_dicts(db, posts, current_user.id),
            "pagination": pagination,
            "feed_mode": "ranked" if interaction_count >= 10 else "cold_start",
        }
    except Exception:
        from utils.batch_loaders import build_post_dicts
        query = _visible_feed_query(db, current_user.id).order_by(UserFeed.created_at.desc())
        items = query.limit(feed_limit).all()
        feed_data = {
            "posts": build_post_dicts(db, items, current_user.id),
            "pagination": {"page": 1, "limit": feed_limit, "total": query.count()},
            "feed_mode": "chronological_fallback",
        }

    result = {
        "user": user_data,
        "unread_count": unread,
        "feed": feed_data,
    }

    cache_set(cache_key, result, ttl_seconds=60)  # 1 min cache
    return standard_response(True, "App init data", result)


@router.get("/profile-overview/{user_id}")
def profile_overview(
    user_id: str,
    post_limit: int = 6,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Combined profile view. Returns:
    - user profile info
    - recent posts (summary, not full)
    - follow status
    
    Replaces 3 calls:
      GET /users/{id}/profile
      GET /posts/user/{id}?limit=6
      GET /users/{id}/follow-status
    """
    import uuid as uuid_mod
    from models import UserProfile, UserFollower

    try:
        uid = uuid_mod.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")

    user = db.query(User).filter(User.id == uid).first()
    if not user:
        return standard_response(False, "User not found")

    profile = db.query(UserProfile).filter(UserProfile.user_id == uid).first()

    # Follow counts
    follower_count = db.query(sa_func.count(UserFollower.id)).filter(
        UserFollower.following_id == uid
    ).scalar() or 0
    following_count = db.query(sa_func.count(UserFollower.id)).filter(
        UserFollower.follower_id == uid
    ).scalar() or 0

    # Is current user following this user?
    is_following = db.query(UserFollower).filter(
        UserFollower.follower_id == current_user.id,
        UserFollower.following_id == uid,
    ).first() is not None

    # Recent posts (summary — no comments, no detailed interactions)
    from sqlalchemy import or_
    post_query = db.query(UserFeed).filter(
        UserFeed.user_id == uid,
        UserFeed.is_active == True,
        or_(
            UserFeed.visibility == FeedVisibilityEnum.public,
            UserFeed.visibility.is_(None),
            UserFeed.user_id == current_user.id,
        ),
    ).order_by(UserFeed.created_at.desc()).limit(min(post_limit, 20))

    posts_summary = []
    post_ids = []
    for p in post_query.all():
        post_ids.append(p.id)
        posts_summary.append({
            "id": str(p.id),
            "content": (p.content[:200] + "...") if p.content and len(p.content) > 200 else p.content,
            "glow_count": p.glow_count or 0,
            "echo_count": p.echo_count or 0,
            "comment_count": p.comment_count or 0,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    # Batch-load first image per post for thumbnails
    if post_ids:
        images = db.query(UserFeedImage).filter(UserFeedImage.feed_id.in_(post_ids)).all()
        img_map = {}
        for img in images:
            fid = str(img.feed_id)
            if fid not in img_map:
                img_map[fid] = img.image_url
        for ps in posts_summary:
            ps["thumbnail"] = img_map.get(ps["id"])

    result = {
        "user": {
            "id": str(user.id),
            "first_name": user.first_name,
            "last_name": user.last_name,
            "username": user.username,
            "avatar": profile.profile_picture_url if profile else None,
            "bio": profile.bio if profile else None,
            "location": profile.location if profile else None,
            "is_identity_verified": user.is_identity_verified or False,
            "follower_count": follower_count,
            "following_count": following_count,
        },
        "is_following": is_following,
        "recent_posts": posts_summary,
    }

    return standard_response(True, "Profile overview", result)
