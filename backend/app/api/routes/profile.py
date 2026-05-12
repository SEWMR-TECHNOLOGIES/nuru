# Profile Routes - /users/profile
# Handles profile retrieval, update, avatar upload, and identity verification

import os
import uuid
from datetime import datetime
from typing import Optional, List

import httpx
import pytz
from fastapi import APIRouter, Depends, File, UploadFile, Form
from sqlalchemy.orm import Session

from core.config import UPLOAD_SERVICE_URL
from core.database import get_db
from models import User, UserProfile, UserIdentityVerification, IdentityDocumentRequirement, VerificationStatusEnum
from utils.auth import get_current_user
from utils.helpers import standard_response
from utils.user_payload import build_user_payload
from utils.validation_functions import validate_username, validate_phone_number

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/users", tags=["Users - Profile"])


@router.get("/profile")
def get_my_profile(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get current authenticated user's full profile."""
    payload = build_user_payload(db, current_user)
    return standard_response(True, "Profile retrieved", payload)


@router.put("/profile")
async def update_profile(
    first_name: Optional[str] = Form(None),
    last_name: Optional[str] = Form(None),
    username: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    date_of_birth: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    city: Optional[str] = Form(None),
    country_code: Optional[str] = Form(None),
    instagram: Optional[str] = Form(None),
    twitter: Optional[str] = Form(None),
    facebook: Optional[str] = Form(None),
    linkedin: Optional[str] = Form(None),
    website: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    avatar: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update current user's profile. Supports multipart/form-data with optional avatar file."""
    errors = {}

    # Validate username if provided
    if username and username.strip():
        username = username.strip()
        if not validate_username(username):
            errors["username"] = "Username can only contain letters, numbers, and underscores (3-30 characters)"
        elif username != current_user.username:
            existing = db.query(User).filter(User.username == username, User.id != current_user.id).first()
            if existing:
                errors["username"] = "Username is already taken"

    # Validate phone if provided
    if phone and phone.strip():
        try:
            normalized_phone = validate_phone_number(phone.strip())
            if normalized_phone != (current_user.phone or ''):
                existing_phone = db.query(User).filter(User.phone == normalized_phone, User.id != current_user.id).first()
                if existing_phone:
                    errors["phone"] = "This phone number is already registered to another account"
        except ValueError as e:
            errors["phone"] = str(e)

    if errors:
        return standard_response(False, "Validation failed", {"errors": errors})

    # Update User table fields
    if first_name and first_name.strip():
        current_user.first_name = first_name.strip()[:50]
    if last_name and last_name.strip():
        current_user.last_name = last_name.strip()[:50]
    if username and username.strip():
        current_user.username = username.strip()
    if phone and phone.strip():
        try:
            current_user.phone = validate_phone_number(phone.strip())
        except ValueError:
            pass  # Already validated above

    # Get or create profile
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)

    # Update profile fields
    if bio is not None:
        profile.bio = bio.strip()[:500] if bio.strip() else None
    if location is not None:
        profile.location = location.strip() if location.strip() else None
    if website is not None:
        profile.website_url = website.strip() if website.strip() else None

    # Social links
    social_links = profile.social_links or {}
    if instagram is not None:
        social_links["instagram"] = instagram.strip() if instagram.strip() else None
    if twitter is not None:
        social_links["twitter"] = twitter.strip() if twitter.strip() else None
    if facebook is not None:
        social_links["facebook"] = facebook.strip() if facebook.strip() else None
    if linkedin is not None:
        social_links["linkedin"] = linkedin.strip() if linkedin.strip() else None
    profile.social_links = social_links

    # Handle avatar upload
    if avatar and avatar.filename:
        content = await avatar.read()
        # Validate file size (5MB max)
        if len(content) > 5 * 1024 * 1024:
            return standard_response(False, "Validation failed", {"errors": {"avatar": "File size exceeds maximum allowed (5MB)"}})

        # Validate file type
        allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
        if avatar.content_type not in allowed_types:
            return standard_response(False, "Validation failed", {"errors": {"avatar": "Only jpg, jpeg, png, and webp formats are allowed"}})

        _, ext = os.path.splitext(avatar.filename)
        unique_name = f"{uuid.uuid4().hex}{ext}"

        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(
                    UPLOAD_SERVICE_URL,
                    data={"target_path": f"nuru/uploads/avatars/{current_user.id}/"},
                    files={"file": (unique_name, content, avatar.content_type)},
                    timeout=20
                )
                result = resp.json()
                if result.get("success"):
                    profile.profile_picture_url = result["data"]["url"]
                else:
                    return standard_response(False, "Avatar upload failed", {"errors": {"avatar": result.get("message", "Upload failed")}})
            except Exception as e:
                return standard_response(False, "Avatar upload failed", {"errors": {"avatar": str(e)}})

    now = datetime.now(EAT)
    profile.updated_at = now
    current_user.updated_at = now

    db.commit()
    db.refresh(current_user)

    payload = build_user_payload(db, current_user)
    return standard_response(True, "Profile updated successfully", payload)


# ──────────────────────────────────────────────
# Country / Currency confirmation (Migration onboarding)
# ──────────────────────────────────────────────

# Country → currency mapping for the supported launch markets.
_COUNTRY_TO_CURRENCY = {"TZ": "TZS", "KE": "KES"}
_VALID_SOURCES = {"phone", "ip", "locale", "manual"}


@router.post("/profile/country")
def confirm_country(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Persist the user's confirmed country + derived currency on UserProfile,
    and provision a wallet in the matching currency.

    Body: { country_code: "TZ" | "KE", source?: "phone"|"ip"|"locale"|"manual" }
    """
    code = (payload.get("country_code") or "").upper()
    source = (payload.get("source") or "manual").lower()
    if code not in _COUNTRY_TO_CURRENCY:
        return standard_response(False, "Unsupported country", {"errors": {"country_code": "Must be TZ or KE."}})
    if source not in _VALID_SOURCES:
        source = "manual"
    currency = _COUNTRY_TO_CURRENCY[code]

    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)

    profile.country_code = code
    profile.currency_code = currency
    profile.country_source = source
    profile.updated_at = datetime.now(EAT)

    # Provision the wallet for this currency so the UI flips immediately.
    try:
        from services.wallet_service import get_or_create_wallet
        get_or_create_wallet(db, current_user.id, currency)
    except Exception:
        # Wallet creation is best-effort; failure must not break country save.
        pass

    db.commit()
    return standard_response(True, "Country confirmed.", {
        "country_code": code,
        "currency_code": currency,
        "country_source": source,
    })


# ──────────────────────────────────────────────
# Interests (Onboarding chip picker)
# ──────────────────────────────────────────────

# Curated catalogue of interests offered on the onboarding screen. Keeping
# this server-side keeps the chip list consistent across web + mobile and
# acts as a soft allow-list for slugs we accept on write.
# Nuru is an events platform — every interest is an event type or
# event-adjacent activity people attend, host, or follow. Each entry has an
# emoji to make the picker feel personal rather than form-like.
INTEREST_CATALOGUE = [
    {"slug": "weddings",       "label": "Weddings",            "emoji": "💍"},
    {"slug": "birthdays",      "label": "Birthdays",           "emoji": "🎂"},
    {"slug": "graduations",    "label": "Graduations",         "emoji": "🎓"},
    {"slug": "anniversaries",  "label": "Anniversaries",       "emoji": "🥂"},
    {"slug": "baby_showers",   "label": "Baby showers",        "emoji": "🍼"},
    {"slug": "private_parties","label": "Private parties",     "emoji": "🎉"},
    {"slug": "concerts",       "label": "Concerts",            "emoji": "🎤"},
    {"slug": "festivals",      "label": "Festivals",           "emoji": "🎪"},
    {"slug": "nightlife",      "label": "Nightlife",           "emoji": "🪩"},
    {"slug": "conferences",    "label": "Conferences",         "emoji": "🎙️"},
    {"slug": "workshops",      "label": "Workshops",           "emoji": "🛠️"},
    {"slug": "networking",     "label": "Networking",          "emoji": "🤝"},
    {"slug": "corporate",      "label": "Corporate events",    "emoji": "💼"},
    {"slug": "exhibitions",    "label": "Exhibitions & expos", "emoji": "🖼️"},
    {"slug": "fashion_shows",  "label": "Fashion shows",       "emoji": "👗"},
    {"slug": "sports_events",  "label": "Sports events",       "emoji": "🏟️"},
    {"slug": "faith",          "label": "Faith gatherings",    "emoji": "🙏"},
    {"slug": "cultural",       "label": "Cultural events",     "emoji": "🪘"},
    {"slug": "community",      "label": "Community meetups",   "emoji": "🫂"},
    {"slug": "charity",        "label": "Charity & fundraisers","emoji": "❤️"},
    {"slug": "food_events",    "label": "Food & dining",       "emoji": "🍽️"},
    {"slug": "memorials",      "label": "Memorials",           "emoji": "🕊️"},
    {"slug": "retreats",       "label": "Retreats & getaways", "emoji": "🌿"},
]
_VALID_INTERESTS = {it["slug"] for it in INTEREST_CATALOGUE}
# Soft allow-list for the second onboarding question — how the user
# typically engages with events on Nuru.
_VALID_ROLES = {"attendee", "host", "planner", "vendor"}

# Why people sign up to Nuru — first onboarding question. Multi-select.
# Friendly, event-centric and non-judgemental: people often arrive for more
# than one reason (e.g. "I want to throw a party AND buy tickets to others").
SIGNUP_INTENT_CATALOGUE = [
    {"slug": "plan_event",      "label": "Plan my own event",          "emoji": "🗓️", "hint": "Weddings, birthdays, meetups…"},
    {"slug": "buy_tickets",     "label": "Buy tickets to events",      "emoji": "🎟️", "hint": "Concerts, festivals, shows"},
    {"slug": "discover_events", "label": "Discover what's happening",  "emoji": "🔭", "hint": "See what's on near me"},
    {"slug": "offer_service",   "label": "Offer a service or vendor",  "emoji": "🛎️", "hint": "Photography, catering, DJ…"},
    {"slug": "host_community",  "label": "Build a community",          "emoji": "🫂", "hint": "Bring people together"},
    {"slug": "share_moments",   "label": "Share my event moments",     "emoji": "📸", "hint": "Photos, videos, memories"},
    {"slug": "network",         "label": "Meet people & network",      "emoji": "🤝", "hint": "New connections & friends"},
    {"slug": "just_exploring",  "label": "Just exploring for now",     "emoji": "✨", "hint": "Looking around"},
]
_VALID_INTENTS = {it["slug"] for it in SIGNUP_INTENT_CATALOGUE}


@router.get("/profile/interests")
def get_interests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    selected = list(profile.interests or []) if profile else []
    intents = list(getattr(profile, "signup_intents", None) or []) if profile else []
    return standard_response(True, "Interests retrieved", {
        "catalogue": INTEREST_CATALOGUE,
        "selected": selected,
        "role": getattr(profile, "event_role", None) if profile else None,
        "roles": [
            {"slug": "attendee", "label": "I love attending events",   "emoji": "🎟️"},
            {"slug": "host",     "label": "I host my own events",       "emoji": "🎈"},
            {"slug": "planner",  "label": "I plan events for others",   "emoji": "📋"},
            {"slug": "vendor",   "label": "I'm a vendor or service",    "emoji": "🛎️"},
        ],
        "intents_catalogue": SIGNUP_INTENT_CATALOGUE,
        "intents": intents,
    })


@router.put("/profile/interests")
def update_interests(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Persist the user's chosen interests.

    Body: {
        interests: ["weddings", "concerts", ...],
        role: "attendee" | "host" | "planner" | "vendor"   (optional),
        intents: ["plan_event", "buy_tickets", ...]        (optional)
    }
    Unknown slugs are silently dropped to keep the column safe.
    """
    raw = payload.get("interests") or []
    if not isinstance(raw, list):
        return standard_response(False, "Interests must be a list", {"errors": {"interests": "Expected a list of slugs."}})
    cleaned = []
    seen = set()
    for item in raw[:50]:
        slug = str(item).strip().lower()
        if slug in _VALID_INTERESTS and slug not in seen:
            cleaned.append(slug)
            seen.add(slug)

    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
    profile.interests = cleaned
    # Persist the signup intents (first onboarding question). Silently drop
    # unknown slugs and ignore on older DBs that don't yet have the column.
    intents_raw = payload.get("intents")
    if isinstance(intents_raw, list) and hasattr(profile, "signup_intents"):
        intents_clean: list[str] = []
        seen_i: set[str] = set()
        for item in intents_raw[:20]:
            slug = str(item).strip().lower()
            if slug in _VALID_INTENTS and slug not in seen_i:
                intents_clean.append(slug)
                seen_i.add(slug)
        try:
            profile.signup_intents = intents_clean
        except Exception:
            pass
    # Persist the optional role into the profile bio metadata column when
    # available; ignore silently otherwise so old DBs don't 500.
    role_raw = payload.get("role")
    if isinstance(role_raw, str):
        role = role_raw.strip().lower()
        if role in _VALID_ROLES and hasattr(profile, "event_role"):
            try:
                profile.event_role = role
            except Exception:
                pass
    profile.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Interests updated", {
        "selected": cleaned,
        "role": getattr(profile, "event_role", None),
        "intents": list(getattr(profile, "signup_intents", None) or []),
    })


# ──────────────────────────────────────────────
# Identity Verification
# ──────────────────────────────────────────────

@router.get("/verify-identity/status")
def get_verification_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the current user's identity verification status."""
    # If already verified at user level
    if current_user.is_identity_verified:
        return standard_response(True, "Verification status retrieved", {
            "status": "verified",
            "verified_at": str(current_user.updated_at) if current_user.updated_at else None,
        })

    # Check for any submitted verifications
    latest = (
        db.query(UserIdentityVerification)
        .filter(UserIdentityVerification.user_id == current_user.id)
        .order_by(UserIdentityVerification.created_at.desc())
        .first()
    )

    if not latest:
        return standard_response(True, "Verification status retrieved", {
            "status": "unverified",
        })

    status_str = latest.verification_status.value if latest.verification_status else "pending"

    data = {
        "status": status_str,
        "submitted_at": str(latest.created_at) if latest.created_at else None,
    }

    if status_str == "verified":
        data["verified_at"] = str(latest.verified_at) if latest.verified_at else None
    elif status_str == "rejected":
        data["rejection_reason"] = latest.remarks

    return standard_response(True, "Verification status retrieved", data)


@router.post("/verify-identity")
async def submit_identity_verification(
    id_front: UploadFile = File(...),
    id_back: Optional[UploadFile] = File(None),
    selfie: Optional[UploadFile] = File(None),
    document_number: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit identity verification documents."""
    if current_user.is_identity_verified:
        return standard_response(False, "Your identity is already verified")

    # Check for existing pending verification
    existing = (
        db.query(UserIdentityVerification)
        .filter(
            UserIdentityVerification.user_id == current_user.id,
            UserIdentityVerification.verification_status == VerificationStatusEnum.pending
        )
        .first()
    )
    if existing:
        return standard_response(False, "You already have a pending verification request")

    # Validate files
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"]
    max_size = 5 * 1024 * 1024  # 5MB

    uploaded_urls = {}

    for field_name, file in [("id_front", id_front), ("id_back", id_back), ("selfie", selfie)]:
        if not file or not file.filename:
            continue

        content = await file.read()

        if len(content) > max_size:
            return standard_response(False, "Validation failed", {
                "errors": {field_name: "File size exceeds maximum allowed (5MB)"}
            })

        if file.content_type not in allowed_types:
            return standard_response(False, "Validation failed", {
                "errors": {field_name: "Only jpg, png, webp, and pdf formats are allowed"}
            })

        _, ext = os.path.splitext(file.filename)
        unique_name = f"{uuid.uuid4().hex}{ext}"

        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(
                    UPLOAD_SERVICE_URL,
                    data={"target_path": f"nuru/uploads/verification/{current_user.id}/"},
                    files={"file": (unique_name, content, file.content_type)},
                    timeout=20
                )
                result = resp.json()
                if result.get("success"):
                    uploaded_urls[field_name] = result["data"]["url"]
                else:
                    return standard_response(False, f"Upload failed for {field_name}", {
                        "errors": {field_name: result.get("message", "Upload failed")}
                    })
            except Exception as e:
                return standard_response(False, f"Upload failed for {field_name}", {
                    "errors": {field_name: str(e)}
                })

    if "id_front" not in uploaded_urls:
        return standard_response(False, "Validation failed", {
            "errors": {"id_front": "Front ID document is required"}
        })

    # Get or create a default document type requirement
    doc_type = db.query(IdentityDocumentRequirement).filter(
        IdentityDocumentRequirement.is_active == True
    ).first()

    now = datetime.now(EAT)

    # Create verification record for front ID
    verification = UserIdentityVerification(
        user_id=current_user.id,
        document_type_id=doc_type.id if doc_type else None,
        document_number=document_number or "N/A",
        document_file_url=uploaded_urls.get("id_front"),
        verification_status=VerificationStatusEnum.pending,
        remarks=None,
        created_at=now,
        updated_at=now,
    )
    db.add(verification)

    # If back ID was provided, create separate record
    if "id_back" in uploaded_urls:
        back_verification = UserIdentityVerification(
            user_id=current_user.id,
            document_type_id=doc_type.id if doc_type else None,
            document_number=(document_number or "N/A") + " (back)",
            document_file_url=uploaded_urls.get("id_back"),
            verification_status=VerificationStatusEnum.pending,
            remarks="ID Back",
            created_at=now,
            updated_at=now,
        )
        db.add(back_verification)

    # If selfie was provided
    if "selfie" in uploaded_urls:
        selfie_verification = UserIdentityVerification(
            user_id=current_user.id,
            document_type_id=doc_type.id if doc_type else None,
            document_number=(document_number or "N/A") + " (selfie)",
            document_file_url=uploaded_urls.get("selfie"),
            verification_status=VerificationStatusEnum.pending,
            remarks="Selfie",
            created_at=now,
            updated_at=now,
        )
        db.add(selfie_verification)

    db.commit()

    return standard_response(True, "Verification documents submitted successfully", {
        "status": "pending",
        "submitted_at": str(now),
    })
