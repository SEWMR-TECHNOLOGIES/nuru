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
from models import User, UserProfile, UserIdentityVerification, IdentityDocumentRequirement
from models.enums import VerificationStatusEnum
from utils.auth import get_current_user
from utils.helpers import standard_response
from utils.user_payload import build_user_payload
from utils.validation_functions import validate_username

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
        current_user.phone = phone.strip()

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
