from sqlalchemy import func
from models.services import UserService
from models.users import (
    UserProfile, UserFollower, UserCircle,
    UserSetting, UserMoment
)
from models.events import Event

def build_user_payload(db, user):
    profile = db.query(UserProfile).filter(
        UserProfile.user_id == user.id
    ).first()

    settings = db.query(UserSetting).filter(
        UserSetting.user_id == user.id
    ).first()

    followers = db.query(func.count(UserFollower.id)).filter(
        UserFollower.following_id == user.id
    ).scalar()

    following = db.query(func.count(UserFollower.id)).filter(
        UserFollower.follower_id == user.id
    ).scalar()

    mutual_friends = db.query(func.count(UserCircle.id)).filter(
        UserCircle.user_id == user.id
    ).scalar()

    services_count = db.query(func.count(UserService.id)).filter(
        UserService.user_id == user.id,
        UserService.is_active == True
    ).scalar()

    events_count = db.query(func.count(Event.id)).filter(
        Event.organizer_id == user.id
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
        "is_active": user.is_active,
        "is_identity_verified": user.is_identity_verified,
        "is_phone_verified": user.is_phone_verified,
        "is_email_verified": user.is_email_verified,
        "created_at": user.created_at,

        "profile": {
            "bio": profile.bio if profile else None,
            "avatar": profile.profile_picture_url if profile else None,
            "location": profile.location if profile else None,
            "website": profile.website_url if profile else None,
            "social_links": profile.social_links if profile else {}
        },

        "stats": {
            "followers": followers,
            "following": following,
            "mutual_friends": mutual_friends,
            "events_created": events_count,
            "services_count": services_count,
            "moments_count": moments_count
        },

        "roles": {
            "is_vendor": services_count > 0,
            "is_event_organizer": events_count > 0
        },

        "settings": {
            "dark_mode": settings.dark_mode if settings else False,
            "language": settings.language if settings else "en",
            "private_profile": settings.private_profile if settings else False,
            "two_factor_enabled": settings.two_factor_enabled if settings else False
        }
    }
