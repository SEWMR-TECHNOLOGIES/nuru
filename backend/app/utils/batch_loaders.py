"""
Batch Loading Utilities
=======================
Eliminates N+1 query patterns by pre-loading related data for collections
of posts, comments, events, and notifications in bulk.

Instead of: 1 query per post × 7 tables × 20 posts = 140 queries
Now:         7 batch queries total regardless of page size
"""

from collections import defaultdict
from typing import List, Optional, Set, Dict, Any
from uuid import UUID

from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from models import (
    User, UserProfile, UserFeed, UserFeedImage, UserFeedGlow, UserFeedEcho,
    UserFeedSpark, UserFeedComment, UserFeedCommentGlow, UserFeedPinned,
    UserFeedSaved, Event, EventImage, EventType, EventVenueCoordinate,
    EventSetting, EventAttendee, Notification,
    EventCommitteeMember, EventService, EventContribution,
    EventContributionTarget, Currency, RSVPStatusEnum,
)


# ─────────────────────────────────────────────────────────
# User + Profile batch loader
# ─────────────────────────────────────────────────────────

def batch_load_users(db: Session, user_ids: Set[UUID]) -> Dict[str, Dict]:
    """Load users + profiles for a set of user IDs. Returns {str(user_id): dict}."""
    if not user_ids:
        return {}

    uid_list = list(user_ids)
    users = db.query(User).filter(User.id.in_(uid_list)).all()
    profiles = db.query(UserProfile).filter(UserProfile.user_id.in_(uid_list)).all()

    profile_map = {str(p.user_id): p for p in profiles}
    result = {}
    for u in users:
        uid = str(u.id)
        p = profile_map.get(uid)
        result[uid] = {
            "id": uid,
            "name": f"{u.first_name} {u.last_name}",
            "first_name": u.first_name,
            "last_name": u.last_name,
            "username": u.username,
            "avatar": p.profile_picture_url if p else None,
            "is_verified": u.is_identity_verified or False,
            "is_identity_verified": u.is_identity_verified or False,
        }
    return result


# ─────────────────────────────────────────────────────────
# Post batch loaders
# ─────────────────────────────────────────────────────────

def batch_load_post_images(db: Session, post_ids: List[UUID]) -> Dict[str, list]:
    """Returns {str(post_id): [image_dicts]}."""
    if not post_ids:
        return {}
    images = db.query(UserFeedImage).filter(UserFeedImage.feed_id.in_(post_ids)).all()
    result = defaultdict(list)
    for img in images:
        result[str(img.feed_id)].append({
            "url": img.image_url,
            "media_type": getattr(img, 'media_type', None) or 'image',
        })
    return dict(result)


def batch_load_post_counts(db: Session, post_ids: List[UUID]) -> Dict[str, Dict[str, int]]:
    """
    Returns {str(post_id): {glow_count, echo_count, spark_count, comment_count}}.
    4 grouped COUNT queries instead of 4×N individual queries.
    """
    if not post_ids:
        return {}

    result = {str(pid): {"glow_count": 0, "echo_count": 0, "spark_count": 0, "comment_count": 0} for pid in post_ids}

    # Glows
    for pid, cnt in db.query(UserFeedGlow.feed_id, sa_func.count(UserFeedGlow.id)).filter(
        UserFeedGlow.feed_id.in_(post_ids)
    ).group_by(UserFeedGlow.feed_id).all():
        result[str(pid)]["glow_count"] = cnt

    # Echoes
    for pid, cnt in db.query(UserFeedEcho.feed_id, sa_func.count(UserFeedEcho.id)).filter(
        UserFeedEcho.feed_id.in_(post_ids)
    ).group_by(UserFeedEcho.feed_id).all():
        result[str(pid)]["echo_count"] = cnt

    # Sparks
    for pid, cnt in db.query(UserFeedSpark.feed_id, sa_func.count(UserFeedSpark.id)).filter(
        UserFeedSpark.feed_id.in_(post_ids)
    ).group_by(UserFeedSpark.feed_id).all():
        result[str(pid)]["spark_count"] = cnt

    # Comments (active only)
    for pid, cnt in db.query(UserFeedComment.feed_id, sa_func.count(UserFeedComment.id)).filter(
        UserFeedComment.feed_id.in_(post_ids),
        UserFeedComment.is_active == True,
    ).group_by(UserFeedComment.feed_id).all():
        result[str(pid)]["comment_count"] = cnt

    return result


def batch_load_user_interactions(
    db: Session, post_ids: List[UUID], current_user_id: UUID
) -> Dict[str, Dict[str, bool]]:
    """
    Returns {str(post_id): {has_glowed, has_echoed, has_saved, is_pinned}}.
    4 queries instead of 4×N.
    """
    if not post_ids or not current_user_id:
        return {}

    result = {str(pid): {"has_glowed": False, "has_echoed": False, "has_saved": False, "is_pinned": False} for pid in post_ids}

    glowed_ids = {str(r[0]) for r in db.query(UserFeedGlow.feed_id).filter(
        UserFeedGlow.feed_id.in_(post_ids), UserFeedGlow.user_id == current_user_id
    ).all()}

    echoed_ids = {str(r[0]) for r in db.query(UserFeedEcho.feed_id).filter(
        UserFeedEcho.feed_id.in_(post_ids), UserFeedEcho.user_id == current_user_id
    ).all()}

    saved_ids = {str(r[0]) for r in db.query(UserFeedSaved.feed_id).filter(
        UserFeedSaved.feed_id.in_(post_ids), UserFeedSaved.user_id == current_user_id
    ).all()}

    pinned_ids = {str(r[0]) for r in db.query(UserFeedPinned.feed_id).filter(
        UserFeedPinned.feed_id.in_(post_ids)
    ).all()}

    for pid_str in result:
        result[pid_str]["has_glowed"] = pid_str in glowed_ids
        result[pid_str]["has_echoed"] = pid_str in echoed_ids
        result[pid_str]["has_saved"] = pid_str in saved_ids
        result[pid_str]["is_pinned"] = pid_str in pinned_ids

    return result


def batch_load_shared_events(db: Session, event_ids: List[UUID]) -> Dict[str, Dict]:
    """Pre-load shared event data for event_share posts."""
    if not event_ids:
        return {}
    events = db.query(Event).filter(Event.id.in_(event_ids)).all()
    event_images = db.query(EventImage).filter(EventImage.event_id.in_(event_ids)).all()

    img_map = defaultdict(list)
    for img in event_images:
        img_map[str(img.event_id)].append(img.image_url)

    result = {}
    for event in events:
        eid = str(event.id)
        cover = event.cover_image_url
        gallery = img_map.get(eid, [])
        if cover and cover not in gallery:
            gallery.insert(0, cover)
        result[eid] = {
            "id": eid,
            "title": event.name,
            "description": event.description,
            "start_date": event.start_date.isoformat() if event.start_date else None,
            "end_date": event.end_date.isoformat() if event.end_date else None,
            "start_time": event.start_time.strftime("%H:%M") if event.start_time else None,
            "location": event.location,
            "cover_image": cover,
            "images": gallery,
            "event_type": event.event_type.name if event.event_type else None,
            "sells_tickets": getattr(event, 'sells_tickets', False) or False,
            "is_public": getattr(event, 'is_public', False) or False,
            "expected_guests": event.expected_guests,
            "dress_code": event.dress_code,
        }
    return result


# ─────────────────────────────────────────────────────────
# Build post dicts from pre-loaded batch data
# ─────────────────────────────────────────────────────────

def build_post_dicts(
    db: Session,
    posts: List[UserFeed],
    current_user_id: Optional[UUID] = None,
) -> List[Dict]:
    """
    Converts a list of UserFeed objects to API response dicts using
    batch loading. Total queries: ~11 regardless of list size.
    """
    if not posts:
        return []

    post_ids = [p.id for p in posts]
    author_ids = {p.user_id for p in posts}

    # Batch load all related data in parallel-style (sequential but batched)
    users_map = batch_load_users(db, author_ids)
    images_map = batch_load_post_images(db, post_ids)
    counts_map = batch_load_post_counts(db, post_ids)
    interactions_map = (
        batch_load_user_interactions(db, post_ids, current_user_id)
        if current_user_id else {}
    )

    # Load shared events for event_share posts
    shared_event_ids = [
        p.shared_event_id for p in posts
        if p.post_type == "event_share" and p.shared_event_id
    ]
    shared_events_map = batch_load_shared_events(db, shared_event_ids) if shared_event_ids else {}

    result = []
    for post in posts:
        pid_str = str(post.id)
        uid_str = str(post.user_id)
        user_info = users_map.get(uid_str, {})
        counts = counts_map.get(pid_str, {})
        interactions = interactions_map.get(pid_str, {})

        post_dict = {
            "id": pid_str,
            "author": {
                "id": user_info.get("id"),
                "name": user_info.get("name"),
                "username": user_info.get("username"),
                "avatar": user_info.get("avatar"),
                "is_verified": user_info.get("is_verified", False),
            },
            "content": post.content,
            "images": images_map.get(pid_str, []),
            "location": post.location,
            "visibility": post.visibility.value if post.visibility else "public",
            "post_type": post.post_type or "post",
            "glow_count": counts.get("glow_count", 0),
            "echo_count": counts.get("echo_count", 0),
            "spark_count": counts.get("spark_count", 0),
            "comment_count": counts.get("comment_count", 0),
            "has_glowed": interactions.get("has_glowed", False),
            "has_echoed": interactions.get("has_echoed", False),
            "has_saved": interactions.get("has_saved", False),
            "is_pinned": interactions.get("is_pinned", False),
            "created_at": post.created_at.isoformat() if post.created_at else None,
        }

        # Shared event data
        if post.post_type == "event_share" and post.shared_event_id:
            event_data = shared_events_map.get(str(post.shared_event_id))
            if event_data:
                post_dict["shared_event"] = event_data
                post_dict["share_expires_at"] = post.share_expires_at.isoformat() if post.share_expires_at else None

        result.append(post_dict)

    return result


# ─────────────────────────────────────────────────────────
# Comment batch loaders
# ─────────────────────────────────────────────────────────

def batch_load_comment_counts(db: Session, comment_ids: List[UUID]) -> Dict[str, Dict]:
    """Returns {str(comment_id): {glow_count, reply_count}}."""
    if not comment_ids:
        return {}

    result = {str(cid): {"glow_count": 0, "reply_count": 0} for cid in comment_ids}

    for cid, cnt in db.query(UserFeedCommentGlow.comment_id, sa_func.count(UserFeedCommentGlow.id)).filter(
        UserFeedCommentGlow.comment_id.in_(comment_ids)
    ).group_by(UserFeedCommentGlow.comment_id).all():
        result[str(cid)]["glow_count"] = cnt

    for cid, cnt in db.query(UserFeedComment.parent_comment_id, sa_func.count(UserFeedComment.id)).filter(
        UserFeedComment.parent_comment_id.in_(comment_ids),
        UserFeedComment.is_active == True,
    ).group_by(UserFeedComment.parent_comment_id).all():
        result[str(cid)]["reply_count"] = cnt

    return result


def batch_load_comment_glowed(db: Session, comment_ids: List[UUID], user_id: UUID) -> Set[str]:
    """Returns set of str(comment_id) that user has glowed."""
    if not comment_ids or not user_id:
        return set()
    return {str(r[0]) for r in db.query(UserFeedCommentGlow.comment_id).filter(
        UserFeedCommentGlow.comment_id.in_(comment_ids),
        UserFeedCommentGlow.user_id == user_id,
    ).all()}


def build_comment_dicts(
    db: Session,
    comments: List,
    current_user_id: Optional[UUID] = None,
    include_replies_preview: bool = True,
) -> List[Dict]:
    """Batch-build comment dicts. ~5 queries total instead of 5×N."""
    if not comments:
        return []

    comment_ids = [c.id for c in comments]
    author_ids = {c.user_id for c in comments}

    users_map = batch_load_users(db, author_ids)
    counts_map = batch_load_comment_counts(db, comment_ids)
    glowed_set = batch_load_comment_glowed(db, comment_ids, current_user_id) if current_user_id else set()

    # Pre-load reply previews for top-level comments
    replies_map = {}
    if include_replies_preview:
        top_level_ids = [c.id for c in comments if not c.parent_comment_id]
        if top_level_ids:
            # Get first 2 replies per top-level comment using a window function approach
            # Simpler: just get all replies for these parents, limit in Python
            all_replies = (
                db.query(UserFeedComment)
                .filter(
                    UserFeedComment.parent_comment_id.in_(top_level_ids),
                    UserFeedComment.is_active == True,
                )
                .order_by(UserFeedComment.parent_comment_id, UserFeedComment.created_at.asc())
                .all()
            )
            # Group and take first 2
            grouped = defaultdict(list)
            for r in all_replies:
                pid = str(r.parent_comment_id)
                if len(grouped[pid]) < 2:
                    grouped[pid].append(r)

            # Build reply dicts (without further nesting)
            all_reply_objects = [r for replies in grouped.values() for r in replies]
            if all_reply_objects:
                reply_dicts = build_comment_dicts(db, all_reply_objects, current_user_id, include_replies_preview=False)
                reply_dict_map = {d["id"]: d for d in reply_dicts}
                for pid_str, replies in grouped.items():
                    replies_map[pid_str] = [reply_dict_map[str(r.id)] for r in replies if str(r.id) in reply_dict_map]

    result = []
    for comment in comments:
        cid = str(comment.id)
        uid = str(comment.user_id)
        author = users_map.get(uid)
        counts = counts_map.get(cid, {})

        d = {
            "id": cid,
            "content": comment.content,
            "author": author,
            "glow_count": counts.get("glow_count", 0),
            "reply_count": counts.get("reply_count", 0),
            "has_glowed": cid in glowed_set,
            "is_edited": comment.is_edited or False,
            "is_pinned": comment.is_pinned or False,
            "parent_id": str(comment.parent_comment_id) if comment.parent_comment_id else None,
            "created_at": comment.created_at.isoformat() if comment.created_at else None,
            "updated_at": comment.updated_at.isoformat() if comment.updated_at else None,
        }

        if include_replies_preview and not comment.parent_comment_id:
            d["replies_preview"] = replies_map.get(cid, [])

        result.append(d)

    return result


# ─────────────────────────────────────────────────────────
# Event batch loaders
# ─────────────────────────────────────────────────────────

def build_public_event_dicts(db: Session, events: List[Event]) -> List[Dict]:
    """Batch-build public event summary dicts. ~6 queries instead of 6×N."""
    if not events:
        return []

    event_ids = [e.id for e in events]
    organizer_ids = {e.organizer_id for e in events if e.organizer_id}
    event_type_ids = {e.event_type_id for e in events if e.event_type_id}

    # Batch load event types
    event_types = {}
    if event_type_ids:
        for et in db.query(EventType).filter(EventType.id.in_(list(event_type_ids))).all():
            event_types[str(et.id)] = {"id": str(et.id), "name": et.name, "icon": et.icon}

    # Batch load venue coordinates
    venues = {}
    for vc in db.query(EventVenueCoordinate).filter(EventVenueCoordinate.event_id.in_(event_ids)).all():
        venues[str(vc.event_id)] = vc

    # Batch load settings
    settings = {}
    for s in db.query(EventSetting).filter(EventSetting.event_id.in_(event_ids)).all():
        settings[str(s.event_id)] = s

    # Batch load images
    images_map = defaultdict(list)
    for img in db.query(EventImage).filter(EventImage.event_id.in_(event_ids)).order_by(
        EventImage.is_featured.desc(), EventImage.created_at.asc()
    ).all():
        images_map[str(img.event_id)].append({"id": str(img.id), "image_url": img.image_url, "is_featured": img.is_featured})

    # Batch load guest counts
    guest_counts = {}
    for eid, cnt in db.query(EventAttendee.event_id, sa_func.count(EventAttendee.id)).filter(
        EventAttendee.event_id.in_(event_ids)
    ).group_by(EventAttendee.event_id).all():
        guest_counts[str(eid)] = cnt

    # Batch load organizers
    organizers = batch_load_users(db, organizer_ids)

    result = []
    for event in events:
        eid = str(event.id)
        images_list = images_map.get(eid, [])
        cover = event.cover_image_url
        if not cover:
            for img in images_list:
                if img["is_featured"]:
                    cover = img["image_url"]
                    break
            if not cover and images_list:
                cover = images_list[0]["image_url"]

        vc = venues.get(eid)
        org = organizers.get(str(event.organizer_id), {})
        et_id = str(event.event_type_id) if event.event_type_id else None
        et = event_types.get(et_id) if et_id else None

        result.append({
            "id": eid,
            "title": event.name,
            "description": event.description,
            "event_type": et,
            "start_date": event.start_date.isoformat() if event.start_date else None,
            "start_time": event.start_time.strftime("%H:%M") if event.start_time else None,
            "end_date": event.end_date.isoformat() if event.end_date else None,
            "location": event.location,
            "venue": vc.venue_name if vc else None,
            "venue_address": vc.formatted_address if vc else None,
            "cover_image": cover,
            "images": images_list,
            "theme_color": event.theme_color,
            "dress_code": event.dress_code,
            "special_instructions": event.special_instructions,
            "guest_count": guest_counts.get(eid, 0),
            "organizer": {"name": org.get("name")},
            "sells_tickets": event.sells_tickets or False,
            "status": "published" if (event.status.value if hasattr(event.status, "value") else event.status) == "confirmed" else (event.status.value if hasattr(event.status, "value") else event.status),
            "created_at": event.created_at.isoformat() if event.created_at else None,
        })

    return result


# ─────────────────────────────────────────────────────────
# Notification batch loader
# ─────────────────────────────────────────────────────────

def build_notification_dicts(db: Session, notifications: list) -> List[Dict]:
    """Batch-build notification dicts. 2 queries instead of 2×N."""
    if not notifications:
        return []

    # Collect all sender IDs
    sender_ids = set()
    for n in notifications:
        if n.sender_ids and len(n.sender_ids) > 0:
            try:
                from uuid import UUID as _UUID
                sender_ids.add(_UUID(n.sender_ids[0]))
            except (ValueError, IndexError):
                pass

    users_map = batch_load_users(db, sender_ids) if sender_ids else {}

    result = []
    for n in notifications:
        sender_info = None
        if n.sender_ids and len(n.sender_ids) > 0:
            sid = n.sender_ids[0]
            u = users_map.get(sid)
            if u:
                sender_info = {
                    "id": u["id"],
                    "first_name": u["first_name"],
                    "last_name": u["last_name"],
                    "username": u.get("username"),
                    "avatar": u.get("avatar"),
                }

        result.append({
            "id": str(n.id),
            "type": n.type.value if n.type else None,
            "message": n.message_template,
            "data": n.message_data,
            "is_read": n.is_read,
            "reference_id": str(n.reference_id) if n.reference_id else None,
            "reference_type": n.reference_type,
            "actor": sender_info,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        })

    return result
