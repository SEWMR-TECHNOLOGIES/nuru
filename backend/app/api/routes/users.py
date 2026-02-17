
import hashlib
import traceback
from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func as sa_func

from core.database import get_db
from models import User, UserVerificationOTP, UserProfile, UserSetting, UserFollower, UserCircle, OTPVerificationTypeEnum
from models.services import UserService
from models.events import Event
from models.enums import EventStatusEnum
from models.feeds import UserFeed
from utils.auth import get_current_user
from utils.helpers import standard_response, generate_otp, get_expiry, mask_email, mask_phone
from utils.notification_service import send_verification_email, send_verification_sms
from utils.sms import sms_welcome_registered
from utils.validation_functions import validate_email, validate_tanzanian_phone, validate_password_strength, validate_username
from utils.user_payload import build_user_payload

router = APIRouter(prefix="/users", tags=["Users"])


# ──────────────────────────────────────────────
# Sign Up
# ──────────────────────────────────────────────
@router.post("/signup")
async def signup(request: Request, db: Session = Depends(get_db)):
    """Creates a new user account."""
    if request.headers.get("content-type") != "application/json":
        return standard_response(False, "Content type must be 'application/json'. Please send your data in JSON format.")

    try:
        payload = await request.json()
    except Exception:
        return standard_response(False, "Unable to parse the request body. Ensure your JSON is correctly formatted.")

    first_name = payload.get("first_name", "").strip()
    last_name = payload.get("last_name", "").strip()
    username = payload.get("username", "").strip()
    email = payload.get("email", "").strip()
    phone = payload.get("phone", "").strip()
    password = payload.get("password", "")

    if not first_name:
        return standard_response(False, "We couldn't identify your first name. Please provide it so we can personalize your experience.")
    if not last_name:
        return standard_response(False, "We couldn't identify your last name. Please provide it so we can complete your registration.")

    if not username:
        return standard_response(False, "Please provide a username for your account.")
    if not validate_username(username):
        return standard_response(False, "Username can only contain letters, numbers, and underscores, and must be 3-30 characters long.")
    if db.query(User).filter(User.username == username).first():
        return standard_response(False, f"The username '{username}' is already taken. Please choose a different one.")

    if not email:
        return standard_response(False, "An email address helps us communicate important updates to you. Please provide one.")
    if not validate_email(email):
        return standard_response(False, f"The email '{email}' doesn't seem to be valid. Please double-check and enter a correct email address.")
    if db.query(User).filter(User.email == email).first():
        return standard_response(False, f"The email '{email}' is already associated with another account. Please use a different one.")

    if not phone:
        return standard_response(False, "Your phone number allows us to verify your account and send important notifications. Please provide a valid Tanzanian number.")
    try:
        formatted_phone = validate_tanzanian_phone(phone)
    except ValueError as e:
        return standard_response(False, str(e))
    if db.query(User).filter(User.phone == formatted_phone).first():
        return standard_response(False, f"The phone number '{formatted_phone}' is already associated with another account. Please use a different one.")

    if not password:
        return standard_response(False, "For security, your account needs a strong password. Please provide one.")
    if not validate_password_strength(password):
        return standard_response(False, "Your password must be strong: at least 8 characters long, include one uppercase letter, one lowercase letter, one number, and one special symbol. This ensures your account remains secure.")

    password_hash = hashlib.sha256(password.encode()).hexdigest()

    user = User(
        first_name=first_name,
        last_name=last_name,
        username=username,
        email=email,
        phone=formatted_phone,
        password_hash=password_hash
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create default profile and settings
        profile = UserProfile(user_id=user.id)
        settings = UserSetting(user_id=user.id)
        db.add(profile)
        db.add(settings)
        db.commit()
        
    except Exception:
        db.rollback()
        print(traceback.format_exc())
        return standard_response(False, "Something went wrong while creating your account. Please try again shortly.")

    user_data = {
        "id": str(user.id),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "email": user.email,
        "phone": user.phone
    }

    # If registered by another user (inline registration), send welcome SMS
    registered_by = payload.get("registered_by", "").strip()
    if registered_by:
        sms_welcome_registered(
            phone=formatted_phone,
            new_user_name=first_name,
            registered_by_name=registered_by,
            password=password
        )

    return standard_response(True, f"Hello, {first_name}! Your account has been successfully created. Please use the OTP sent to your email and phone to activate your account.", user_data)


# ──────────────────────────────────────────────
# Request OTP
# ──────────────────────────────────────────────
@router.post("/request-otp")
async def request_otp(request: Request, db: Session = Depends(get_db)):
    """Sends a new OTP code to user's email or phone."""
    if request.headers.get("content-type") != "application/json":
        return standard_response(False, "Content type must be 'application/json'. Please send your data in JSON format.")

    try:
        payload = await request.json()
    except Exception:
        return standard_response(False, "Unable to parse the request body. Ensure your JSON is correctly formatted.")

    user_id = payload.get("user_id")
    verification_type = payload.get("verification_type")  # "phone" or "email"

    if verification_type not in ["phone", "email"]:
        return standard_response(False, "Invalid verification type. Must be 'phone' or 'email'.")

    try:
        user_uuid = UUID(user_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid user ID format. It must be a UUID.")

    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        return standard_response(False, "User not found.")

    code = generate_otp()
    expires_at = get_expiry(minutes=10)

    otp_entry = UserVerificationOTP(
        user_id=user.id,
        otp_code=code,
        verification_type=OTPVerificationTypeEnum[verification_type],
        expires_at=expires_at
    )
    db.add(otp_entry)
    db.commit()

    try:
        if verification_type == "phone":
            await send_verification_sms(user.phone, code, user.first_name)
            masked = mask_phone(user.phone)
            message = f"We have sent a verification code to your phone number {masked}. Please check and enter the code to activate your account."
        else:
            send_verification_email(user.email, code, user.first_name)
            masked = mask_email(user.email)
            message = f"We have sent a verification code to your email address {masked}. Please check your inbox or spam folder to activate your account."

        return standard_response(True, message)

    except Exception as e:
        print(traceback.format_exc())
        return standard_response(False, f"Failed to send verification code: {str(e)}")


# ──────────────────────────────────────────────
# Verify OTP
# ──────────────────────────────────────────────
@router.post("/verify-otp")
async def verify_otp(request: Request, db: Session = Depends(get_db)):
    """Verifies email or phone using OTP code."""
    if request.headers.get("content-type") != "application/json":
        return standard_response(False, "Content type must be 'application/json'. Send JSON data.")

    try:
        payload = await request.json()
    except Exception:
        return standard_response(False, "Unable to parse request body. Ensure your JSON is valid JSON.")

    user_id = payload.get("user_id")
    verification_type = payload.get("verification_type")  # "phone" or "email"
    otp_code = payload.get("otp_code")

    if verification_type not in ["phone", "email"]:
        return standard_response(False, "Invalid verification type. Must be 'phone' or 'email'.")
    if not otp_code:
        return standard_response(False, "OTP code is required.")

    try:
        user_uuid = UUID(user_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid user ID format. Must be a UUID.")

    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        return standard_response(False, "User not found.")

    otp_entry = (
        db.query(UserVerificationOTP)
        .filter(
            UserVerificationOTP.user_id == user.id,
            UserVerificationOTP.verification_type == OTPVerificationTypeEnum[verification_type],
            UserVerificationOTP.is_used == False
        )
        .order_by(UserVerificationOTP.created_at.desc())
        .first()
    )

    if not otp_entry:
        return standard_response(False, f"No OTP found for {verification_type}. Please request a new code.")

    if otp_entry.expires_at < datetime.utcnow():
        return standard_response(False, "OTP has expired. Please request a new code.")

    if otp_entry.otp_code != otp_code:
        return standard_response(False, "Invalid OTP code. Please check and try again.")

    otp_entry.is_used = True

    # Delete ALL OTP records for this user and verification type to save space
    db.query(UserVerificationOTP).filter(
        UserVerificationOTP.user_id == user.id,
        UserVerificationOTP.id != otp_entry.id
    ).delete(synchronize_session=False)

    if verification_type == "email":
        user.is_email_verified = True
    else:
        user.is_phone_verified = True

    # Also delete the used OTP entry itself
    db.delete(otp_entry)

    db.commit()

    return standard_response(True, f"{verification_type.capitalize()} verified successfully.")


# ──────────────────────────────────────────────
# Search Users
# ──────────────────────────────────────────────
@router.get("/search")
async def search_users(
    q: str = "",
    page: int = 1,
    limit: int = 20,
    suggested: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search for users OR get 'People You May Know' suggestions with graph-based scoring."""

    # ── PEOPLE YOU MAY KNOW ─────────────────────────────────────────────────
    if suggested:
        import uuid as uuid_mod
        from collections import defaultdict

        me = current_user.id
        lim = max(1, min(limit or 10, 50))

        # 1. Collect IDs the current user already knows about
        my_following_ids = set(
            row[0] for row in db.query(UserFollower.following_id)
            .filter(UserFollower.follower_id == me).all()
        )
        my_follower_ids = set(
            row[0] for row in db.query(UserFollower.follower_id)
            .filter(UserFollower.following_id == me).all()
        )
        my_circle_ids = set(
            row[0] for row in db.query(UserCircle.circle_member_id)
            .filter(UserCircle.user_id == me).all()
        )
        known_ids = {me} | my_following_ids | my_follower_ids | my_circle_ids

        # Score map: candidate_id -> weighted score
        scores: defaultdict = defaultdict(float)

        # ── SIGNAL 1: Friends-of-friends (my follows' follows) ─────────────
        # BFS level-1: everyone my followings follow (weight 3.0)
        if my_following_ids:
            fof_rows = db.query(UserFollower.following_id).filter(
                UserFollower.follower_id.in_(my_following_ids),
                UserFollower.following_id.notin_(known_ids)
            ).all()
            for (uid,) in fof_rows:
                scores[uid] += 3.0

        # ── SIGNAL 2: Circle-of-circle (people my circle members know) ─────
        # People in my circle members' circles (weight 2.5)
        if my_circle_ids:
            coc_rows = db.query(UserCircle.circle_member_id).filter(
                UserCircle.user_id.in_(my_circle_ids),
                UserCircle.circle_member_id.notin_(known_ids)
            ).all()
            for (uid,) in coc_rows:
                scores[uid] += 2.5

        # ── SIGNAL 3: Mutual followers (people who follow back my follows) ──
        # i.e., both follow each other and aren't in my network yet (weight 2.0)
        if my_following_ids:
            mutual_rows = db.query(UserFollower.follower_id).filter(
                UserFollower.follower_id.notin_(known_ids),
                UserFollower.following_id.in_(my_following_ids)
            ).all()
            for (uid,) in mutual_rows:
                scores[uid] += 2.0

        # ── SIGNAL 4: Co-event attendees (shared events) ───────────────────
        # People who attended same events as me (weight 1.5)
        try:
            from models.invitations import EventInvitation
            my_event_ids = set(
                row[0] for row in db.query(EventInvitation.event_id)
                .filter(EventInvitation.invited_user_id == me).all()
            )
            if my_event_ids:
                event_peers = db.query(EventInvitation.invited_user_id).filter(
                    EventInvitation.event_id.in_(my_event_ids),
                    EventInvitation.invited_user_id.notin_(known_ids)
                ).all()
                for (uid,) in event_peers:
                    scores[uid] += 1.5
        except Exception:
            pass

        # ── SIGNAL 5: Community co-members ────────────────────────────────
        try:
            from models.communities import CommunityMember
            my_community_ids = set(
                row[0] for row in db.query(CommunityMember.community_id)
                .filter(CommunityMember.user_id == me).all()
            )
            if my_community_ids:
                community_peers = db.query(CommunityMember.user_id).filter(
                    CommunityMember.community_id.in_(my_community_ids),
                    CommunityMember.user_id.notin_(known_ids)
                ).all()
                for (uid,) in community_peers:
                    scores[uid] += 1.0
        except Exception:
            pass

        # ── Sort by score descending, take top lim ─────────────────────────
        if scores:
            top_ids = sorted(scores, key=lambda uid: scores[uid], reverse=True)[:lim * 3]
            # Fetch and filter active users only
            users_q = db.query(User).filter(
                User.id.in_(top_ids),
                User.is_active == True
            ).all()
            # Re-sort by score after DB fetch
            id_to_user = {u.id: u for u in users_q}
            sorted_users = [id_to_user[uid] for uid in top_ids if uid in id_to_user][:lim]
        else:
            # Cold start: return recent active users not yet followed
            sorted_users = db.query(User).filter(
                User.id.notin_(known_ids),
                User.is_active == True
            ).order_by(User.created_at.desc()).limit(lim).all()

        results = []
        for u in sorted_users:
            profile = db.query(UserProfile).filter(UserProfile.user_id == u.id).first()
            score = scores.get(u.id, 0)
            # Count mutual connections
            mutual_count = sum([
                1 for fid in my_following_ids
                if db.query(UserFollower).filter(
                    UserFollower.follower_id == u.id,
                    UserFollower.following_id == fid
                ).first() is not None
            ]) if my_following_ids else 0
            results.append({
                "id": str(u.id),
                "first_name": u.first_name,
                "last_name": u.last_name,
                "username": u.username,
                "avatar": profile.profile_picture_url if profile else None,
                "is_verified": u.is_identity_verified,
                "mutual_count": mutual_count,
                "score": round(score, 2),
            })

        return standard_response(True, "Suggestions retrieved", results)

    # ── REGULAR SEARCH ───────────────────────────────────────────────────────
    if not q:
        return standard_response(True, "Please provide a search term", [])

    page = max(1, page)
    limit = max(1, min(limit, 50))
    offset = (page - 1) * limit

    # Search by username, first_name, last_name, phone, email
    search_term = f"%{q}%"
    query = db.query(User).filter(
        and_(
            User.id != current_user.id,
            User.is_active == True,
            or_(
                User.username.ilike(search_term),
                User.first_name.ilike(search_term),
                User.last_name.ilike(search_term),
                User.email.ilike(search_term),
                User.phone.ilike(search_term),
            )
        )
    )

    total = query.count()
    users = query.limit(limit).offset(offset).all()

    results = []
    for u in users:
        profile = db.query(UserProfile).filter(UserProfile.user_id == u.id).first()
        results.append({
            "id": str(u.id),
            "username": u.username,
            "full_name": f"{u.first_name} {u.last_name}",
            "avatar": profile.profile_picture_url if profile else None,
            "is_verified": u.is_identity_verified
        })

    return standard_response(True, "Users found", {
        "items": results,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_items": total,
            "total_pages": (total + limit - 1) // limit,
            "has_next": (page * limit) < total,
            "has_previous": page > 1
        }
    })


# ──────────────────────────────────────────────
# Public User Profile
# ──────────────────────────────────────────────
@router.get("/{user_id}")
def get_public_user_profile(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a user's public profile by ID."""
    try:
        uid = UUID(user_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid user ID format")

    target = db.query(User).filter(User.id == uid, User.is_active == True).first()
    if not target:
        return standard_response(False, "User not found")

    payload = build_user_payload(db, target)

    # Add relationship info
    is_following = db.query(UserFollower).filter(
        UserFollower.follower_id == current_user.id,
        UserFollower.following_id == uid
    ).first() is not None

    is_followed_by = db.query(UserFollower).filter(
        UserFollower.follower_id == uid,
        UserFollower.following_id == current_user.id
    ).first() is not None

    # Mutual followers count
    my_following_ids = db.query(UserFollower.following_id).filter(UserFollower.follower_id == current_user.id).subquery()
    mutual_count = db.query(sa_func.count(UserFollower.id)).filter(
        UserFollower.follower_id == uid,
        UserFollower.following_id.in_(my_following_ids)
    ).scalar() or 0

    # Post count (feeds)
    post_count = db.query(sa_func.count(UserFeed.id)).filter(
        UserFeed.user_id == uid,
        UserFeed.is_public == True
    ).scalar() or 0

    payload["is_following"] = is_following
    payload["is_followed_by"] = is_followed_by
    payload["mutual_followers_count"] = mutual_count
    payload["post_count"] = post_count

    # Remove sensitive fields
    payload.pop("email", None)
    payload.pop("phone", None)

    return standard_response(True, "User profile retrieved", payload)


# ──────────────────────────────────────────────
# Follow / Unfollow
# ──────────────────────────────────────────────
@router.post("/{user_id}/follow")
def follow_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Follow a user."""
    try:
        uid = UUID(user_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid user ID format")

    if uid == current_user.id:
        return standard_response(False, "You cannot follow yourself")

    target = db.query(User).filter(User.id == uid, User.is_active == True).first()
    if not target:
        return standard_response(False, "User not found")

    existing = db.query(UserFollower).filter(
        UserFollower.follower_id == current_user.id,
        UserFollower.following_id == uid
    ).first()
    if existing:
        return standard_response(False, "You are already following this user")

    import uuid as uuid_mod
    follow = UserFollower(
        id=uuid_mod.uuid4(),
        follower_id=current_user.id,
        following_id=uid,
    )
    db.add(follow)

    # Send notification (notify_new_follower may not exist yet, so fallback to generic)
    try:
        from utils.notify import create_notification
        sender_name = f"{current_user.first_name} {current_user.last_name}"
        create_notification(db, uid, "follow", f"{sender_name} started following you", sender_id=current_user.id)
    except Exception:
        pass

    db.commit()

    return standard_response(True, "Successfully followed user", {
        "following_id": str(uid),
        "follower_id": str(current_user.id),
        "created_at": str(follow.created_at),
    })


@router.delete("/{user_id}/follow")
def unfollow_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Unfollow a user."""
    try:
        uid = UUID(user_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid user ID format")

    existing = db.query(UserFollower).filter(
        UserFollower.follower_id == current_user.id,
        UserFollower.following_id == uid
    ).first()
    if not existing:
        return standard_response(False, "You are not following this user")

    db.delete(existing)
    db.commit()

    return standard_response(True, "Successfully unfollowed user")


# ──────────────────────────────────────────────
# Public User Events
# ──────────────────────────────────────────────
@router.get("/{user_id}/events")
def get_user_public_events(
    user_id: str,
    page: int = 1,
    limit: int = 10,
    status: str = "published",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a user's public events."""
    try:
        uid = UUID(user_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid user ID format")

    page = max(1, page)
    limit = max(1, min(limit, 50))
    offset = (page - 1) * limit

    query = db.query(Event).filter(
        Event.organizer_id == uid,
        Event.is_public == True,
    )

    if status and status != "all":
        try:
            status_enum = EventStatusEnum(status)
            query = query.filter(Event.status == status_enum)
        except (ValueError, KeyError):
            pass

    query = query.order_by(Event.start_date.desc())
    total = query.count()
    events = query.offset(offset).limit(limit).all()

    event_list = []
    for e in events:
        cover = None
        if hasattr(e, 'images') and e.images:
            featured = next((img for img in e.images if img.is_featured), None)
            cover = featured.image_url if featured else (e.images[0].image_url if e.images else None)

        event_list.append({
            "id": str(e.id),
            "title": e.name,
            "start_date": str(e.start_date) if e.start_date else None,
            "end_date": str(e.end_date) if e.end_date else None,
            "location": e.location,
            "cover_image": cover or e.cover_image_url,
            "status": e.status.value if hasattr(e.status, 'value') else e.status,
            "event_type": {"name": e.event_type.name, "id": str(e.event_type.id)} if e.event_type else None,
        })

    return standard_response(True, "User events retrieved", {
        "events": event_list,
        "pagination": {
            "page": page, "limit": limit, "total_items": total,
            "total_pages": (total + limit - 1) // limit,
            "has_next": (page * limit) < total, "has_previous": page > 1
        }
    })


# ──────────────────────────────────────────────
# Public User Services
# ──────────────────────────────────────────────
@router.get("/{user_id}/services")
def get_user_public_services(
    user_id: str,
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a user's public services."""
    try:
        uid = UUID(user_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid user ID format")

    page = max(1, page)
    limit = max(1, min(limit, 50))
    offset = (page - 1) * limit

    query = db.query(UserService).filter(
        UserService.user_id == uid,
        UserService.is_active == True
    ).order_by(UserService.created_at.desc())

    total = query.count()
    services = query.offset(offset).limit(limit).all()

    service_list = []
    for s in services:
        primary_img = None
        images = []
        if hasattr(s, 'images') and s.images:
            for img in s.images:
                img_dict = {"id": str(img.id), "url": img.image_url, "is_primary": getattr(img, 'is_featured', False)}
                images.append(img_dict)
                if getattr(img, 'is_featured', False):
                    primary_img = img.image_url
            if not primary_img and images:
                primary_img = images[0]["url"]

        # Compute rating from ratings relationship
        ratings = [r.rating for r in s.ratings] if hasattr(s, 'ratings') and s.ratings else []
        avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else None

        service_list.append({
            "id": str(s.id),
            "title": s.title,
            "description": s.description,
            "location": s.location,
            "rating": avg_rating,
            "review_count": len(ratings),
            "primary_image": primary_img,
            "images": images,
            "verification_status": s.verification_status.value if s.verification_status else "unverified",
            "service_category": {"name": s.category.name, "id": str(s.category.id)} if s.category else None,
            "min_price": float(s.min_price) if s.min_price else None,
            "max_price": float(s.max_price) if s.max_price else None,
            "currency": "TZS",
        })

    return standard_response(True, "User services retrieved", {
        "services": service_list,
        "pagination": {
            "page": page, "limit": limit, "total_items": total,
            "total_pages": (total + limit - 1) // limit,
            "has_next": (page * limit) < total, "has_previous": page > 1
        }
    })


# ──────────────────────────────────────────────
# Public User Posts (Feed Items)
# ──────────────────────────────────────────────
@router.get("/{user_id}/posts")
def get_user_public_posts(
    user_id: str,
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a user's public posts/moments."""
    try:
        uid = UUID(user_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid user ID format")

    page = max(1, page)
    limit = max(1, min(limit, 50))
    offset = (page - 1) * limit

    query = db.query(UserFeed).filter(
        UserFeed.user_id == uid,
        UserFeed.is_public == True
    ).order_by(UserFeed.created_at.desc())

    total = query.count()
    posts = query.offset(offset).limit(limit).all()

    from models.feeds import UserFeedImage, UserFeedGlow, UserFeedComment

    post_list = []
    for p in posts:
        images = db.query(UserFeedImage).filter(UserFeedImage.feed_id == p.id).all()
        like_count = db.query(sa_func.count(UserFeedGlow.id)).filter(UserFeedGlow.feed_id == p.id).scalar() or 0
        comment_count = db.query(sa_func.count(UserFeedComment.id)).filter(UserFeedComment.feed_id == p.id).scalar() or 0

        post_list.append({
            "id": str(p.id),
            "content": p.content,
            "location": p.location,
            "images": [{"url": img.image_url, "id": str(img.id)} for img in images],
            "like_count": like_count,
            "comment_count": comment_count,
            "created_at": str(p.created_at) if p.created_at else None,
        })

    return standard_response(True, "User posts retrieved", {
        "posts": post_list,
        "pagination": {
            "page": page, "limit": limit, "total_items": total,
            "total_pages": (total + limit - 1) // limit,
            "has_next": (page * limit) < total, "has_previous": page > 1
        }
    })


# ──────────────────────────────────────────────
# Get User Followers / Following
# ──────────────────────────────────────────────
@router.get("/{user_id}/followers")
def get_user_followers(
    user_id: str,
    page: int = 1,
    limit: int = 20,
    search: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a user's followers."""
    try:
        uid = UUID(user_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid user ID format")

    page = max(1, page)
    limit = max(1, min(limit, 50))
    offset = (page - 1) * limit

    query = db.query(UserFollower).filter(UserFollower.following_id == uid)
    if search:
        s = f"%{search}%"
        query = query.join(User, User.id == UserFollower.follower_id).filter(
            or_(User.first_name.ilike(s), User.last_name.ilike(s), User.username.ilike(s))
        )

    total = query.count()
    entries = query.order_by(UserFollower.created_at.desc()).offset(offset).limit(limit).all()

    followers = []
    for entry in entries:
        u = db.query(User).filter(User.id == entry.follower_id).first()
        if not u:
            continue
        profile = db.query(UserProfile).filter(UserProfile.user_id == u.id).first()
        is_following_back = db.query(UserFollower).filter(
            UserFollower.follower_id == current_user.id,
            UserFollower.following_id == u.id
        ).first() is not None

        followers.append({
            "id": str(u.id),
            "first_name": u.first_name,
            "last_name": u.last_name,
            "username": u.username,
            "avatar": profile.profile_picture_url if profile else None,
            "is_verified": u.is_identity_verified,
            "is_following": is_following_back,
            "followed_at": str(entry.created_at) if entry.created_at else None,
        })

    return standard_response(True, "Followers retrieved", {
        "followers": followers,
        "pagination": {
            "page": page, "limit": limit, "total_items": total,
            "total_pages": (total + limit - 1) // limit,
            "has_next": (page * limit) < total, "has_previous": page > 1
        }
    })


@router.get("/{user_id}/following")
def get_user_following(
    user_id: str,
    page: int = 1,
    limit: int = 20,
    search: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get users that a user is following."""
    try:
        uid = UUID(user_id)
    except (ValueError, TypeError):
        return standard_response(False, "Invalid user ID format")

    page = max(1, page)
    limit = max(1, min(limit, 50))
    offset = (page - 1) * limit

    query = db.query(UserFollower).filter(UserFollower.follower_id == uid)
    if search:
        s = f"%{search}%"
        query = query.join(User, User.id == UserFollower.following_id).filter(
            or_(User.first_name.ilike(s), User.last_name.ilike(s), User.username.ilike(s))
        )

    total = query.count()
    entries = query.order_by(UserFollower.created_at.desc()).offset(offset).limit(limit).all()

    following = []
    for entry in entries:
        u = db.query(User).filter(User.id == entry.following_id).first()
        if not u:
            continue
        profile = db.query(UserProfile).filter(UserProfile.user_id == u.id).first()
        is_following_back = db.query(UserFollower).filter(
            UserFollower.follower_id == current_user.id,
            UserFollower.following_id == u.id
        ).first() is not None

        following.append({
            "id": str(u.id),
            "first_name": u.first_name,
            "last_name": u.last_name,
            "username": u.username,
            "avatar": profile.profile_picture_url if profile else None,
            "is_verified": u.is_identity_verified,
            "is_following": is_following_back,
            "followed_at": str(entry.created_at) if entry.created_at else None,
        })

    return standard_response(True, "Following retrieved", {
        "following": following,
        "pagination": {
            "page": page, "limit": limit, "total_items": total,
            "total_pages": (total + limit - 1) // limit,
            "has_next": (page * limit) < total, "has_previous": page > 1
        }
    })
