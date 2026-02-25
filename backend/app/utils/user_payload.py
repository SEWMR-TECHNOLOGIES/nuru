from sqlalchemy import func
from models.services import UserService
from models import (
    UserProfile, UserFollower, UserCircle,
    UserSetting, UserMoment
)
from models.events import Event

def build_user_payload(db, user):
    """
    Build a FLAT user payload matching the API doc format.
    Returns fields like avatar, bio, follower_count, event_count directly
    — NOT nested under profile/stats/roles/settings.
    """
    profile = db.query(UserProfile).filter(
        UserProfile.user_id == user.id
    ).first()

    followers = db.query(func.count(UserFollower.id)).filter(
        UserFollower.following_id == user.id
    ).scalar()

    following = db.query(func.count(UserFollower.id)).filter(
        UserFollower.follower_id == user.id
    ).scalar()

    services_count = db.query(func.count(UserService.id)).filter(
        UserService.user_id == user.id,
        UserService.is_active == True
    ).scalar()

    from models.enums import EventStatusEnum
    events_count = db.query(func.count(Event.id)).filter(
        Event.organizer_id == user.id,
        Event.is_public == True,
        Event.status == EventStatusEnum.published
    ).scalar()

    moments_count = db.query(func.count(UserMoment.id)).filter(
        UserMoment.user_id == user.id,
        UserMoment.is_active == True
    ).scalar()

    return {
        "id": str(user.id),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "avatar": profile.profile_picture_url if profile else None,
        "bio": profile.bio if profile else None,
        "location": profile.location if profile else None,
        "website": profile.website_url if profile else None,
        "social_links": profile.social_links if profile else {},
        "is_active": user.is_active,
        "is_suspended": getattr(user, "is_suspended", False),
        "suspension_reason": getattr(user, "suspension_reason", None),
        "is_identity_verified": user.is_identity_verified,
        "is_phone_verified": user.is_phone_verified,
        "is_email_verified": user.is_email_verified,
        "is_vendor": services_count > 0,
        "follower_count": followers,
        "following_count": following,
        "event_count": events_count,
        "service_count": services_count,
        "moments_count": moments_count,
        "created_at": user.created_at,
        "updated_at": getattr(user, "updated_at", None),
    }
