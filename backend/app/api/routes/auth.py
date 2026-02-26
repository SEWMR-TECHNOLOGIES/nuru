
import hashlib
import re
import traceback
from datetime import datetime, timedelta
from fastapi import APIRouter, Cookie, Request, Depends, Response, HTTPException
from sqlalchemy.orm import Session
from models import PasswordResetToken, User, UserVerificationOTP
from models.enums import OTPVerificationTypeEnum
from core.database import get_db
from utils.auth import (
    generate_reset_token,
    get_current_user,
    is_token_expired,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_user_by_credential,
    verify_refresh_token
)
from utils.user_payload import build_user_payload
from utils.notification_service import send_password_reset_email, send_verification_sms
from utils.validation_functions import validate_tanzanian_phone
from utils.helpers import standard_response, generate_otp, get_expiry, mask_phone

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ──────────────────────────────────────────────
# Sign In
# ──────────────────────────────────────────────
@router.post("/signin")
async def signin(request: Request, response: Response, db: Session = Depends(get_db)):
    """Authenticates a user and returns access token."""
    if request.headers.get("content-type") != "application/json":
        return standard_response(
            False,
            "Content type must be 'application/json'. Please send your login data in JSON format."
        )

    try:
        payload = await request.json()
    except Exception:
        return standard_response(
            False,
            "Unable to read your login data. Ensure the JSON is properly formatted."
        )

    credential = payload.get("credential", "").strip()
    password = payload.get("password", "")

    if not credential:
        return standard_response(False, "Please provide your username, email, or phone number to login.")
    if not password:
        return standard_response(False, "Please enter your password to login.")

    # Normalize phone if it looks like one
    normalized_credential = credential
    try:
        if re.fullmatch(r'(\+?255|0)?[67]\d{8}', credential) or credential.replace("+", "").isdigit():
            normalized_credential = validate_tanzanian_phone(credential)
    except ValueError:
        pass

    # Fetch user
    user = get_user_by_credential(db, normalized_credential)

    if not user:
        return standard_response(False, "Invalid credentials. Please try again.")
    if not verify_password(password, user.password_hash):
        return standard_response(False, "Invalid credentials. Please try again.")
    if not user.is_active:
        return standard_response(False, "Your account has been deactivated. Contact support at support@nuru.tz")

    # Check suspension
    if getattr(user, 'is_suspended', False):
        return {
            "success": False,
            "message": "Account suspended",
            "errors": [],
            "data": {
                "suspended": True,
                "suspension_reason": getattr(user, 'suspension_reason', None),
            }
        }

    # Generate tokens
    access_token = create_access_token({"uid": str(user.id)})
    refresh_token = create_refresh_token({"uid": str(user.id)})

    # Set session cookie
    response.set_cookie(
        key="session_id",
        value=str(user.id),
        httponly=True,
        max_age=60 * 60 * 24,  # 1 day
        samesite="lax"
    )

    user_payload = build_user_payload(db, user)

    return standard_response(
        True,
        "Login successful",
        {
            "user": user_payload,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "Bearer",
            "expires_in": 3600
        }
    )


# ──────────────────────────────────────────────
# Logout
# ──────────────────────────────────────────────
@router.post("/logout")
async def logout(response: Response):
    """Invalidates the current access token."""
    response.delete_cookie(
        key="session_id",
        path="/",
        samesite="lax",
        httponly=True,
    )
    return standard_response(True, "Logged out successfully")


# ──────────────────────────────────────────────
# Refresh Token
# ──────────────────────────────────────────────
@router.post("/refresh")
async def refresh_token(request: Request):
    """Refreshes an expired access token."""
    try:
        payload = await request.json()
    except Exception:
        return standard_response(False, "Invalid request body.")

    token = payload.get("refresh_token")
    if not token:
        return standard_response(False, "Refresh token is required.")

    verified = verify_refresh_token(token)
    if not verified:
        return standard_response(False, "Invalid or expired refresh token.")

    user_id = verified.get("uid")
    access_token = create_access_token({"uid": str(user_id)})
    refresh_token_new = create_refresh_token({"uid": str(user_id)})

    return standard_response(
        True,
        "Token refreshed successfully",
        {
            "access_token": access_token,
            "refresh_token": refresh_token_new,
            "token_type": "Bearer",
            "expires_in": 3600
        }
    )


# ──────────────────────────────────────────────
# Get Current User
# ──────────────────────────────────────────────
@router.get("/me")
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the authenticated user's profile."""
    user_payload = build_user_payload(db, current_user)
    return standard_response(True, "User retrieved successfully", user_payload)


# ──────────────────────────────────────────────
# Forgot Password
# ──────────────────────────────────────────────
@router.post("/forgot-password")
async def forgot_password(request: Request, db: Session = Depends(get_db)):
    """Initiates password reset process."""
    payload = await request.json()
    email = payload.get("email")

    if not email:
        return standard_response(False, "Email is required")

    user = db.query(User).filter(User.email == email).first()

    # Always return success (avoid email enumeration)
    if not user:
        return standard_response(True, "If the email exists, reset instructions were sent")

    raw_token, token_hash = generate_reset_token()

    reset = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(minutes=10)
    )

    db.add(reset)
    db.commit()

    send_password_reset_email(
        to_email=user.email,
        token=raw_token,
        first_name=user.first_name
    )

    return standard_response(True, "If the email exists, reset instructions were sent")


# ──────────────────────────────────────────────
# Reset Password
# ──────────────────────────────────────────────
@router.post("/reset-password")
async def reset_password(request: Request, db: Session = Depends(get_db)):
    """Resets password using reset token."""
    payload = await request.json()

    token = payload.get("token")
    password = payload.get("password")
    password_confirmation = payload.get("password_confirmation")

    if not token or not password:
        return standard_response(False, "Token and password are required")

    if password != password_confirmation:
        return standard_response(False, "Passwords do not match")

    token_hash = hashlib.sha256(token.encode()).hexdigest()

    reset = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.is_used == False
        )
        .first()
    )

    if not reset:
        return standard_response(False, "Invalid or used token")

    if is_token_expired(reset.expires_at):
        return standard_response(False, "Token has expired")

    user = db.query(User).filter(User.id == reset.user_id).first()
    if not user:
        return standard_response(False, "User not found")

    # Update password
    user.password_hash = hashlib.sha256(password.encode()).hexdigest()

    # Mark token used
    reset.is_used = True

    db.commit()

    # Send in-app notification
    try:
        from utils.notify import create_notification
        create_notification(db, str(user.id), None, "security", "Your password was reset successfully. If this wasn't you, contact support immediately.")
        db.commit()
    except Exception:
        pass

    return standard_response(True, "Password reset successfully")


# ──────────────────────────────────────────────
# Forgot Password (Phone / SMS OTP)
# ──────────────────────────────────────────────
@router.post("/forgot-password-phone")
async def forgot_password_phone(request: Request, db: Session = Depends(get_db)):
    """Sends a password-reset OTP via SMS for phone-only accounts."""
    payload = await request.json()
    phone = payload.get("phone", "").strip()

    if not phone:
        return standard_response(False, "Phone number is required.")

    # Normalize to Tanzanian format
    try:
        phone = validate_tanzanian_phone(phone)
    except ValueError:
        return standard_response(False, "Please enter a valid Tanzanian phone number.")

    user = db.query(User).filter(User.phone == phone).first()

    # Always return success to prevent enumeration
    if not user:
        return standard_response(True, "If this phone number is registered, a reset code has been sent.")

    if not user.is_active:
        return standard_response(True, "If this phone number is registered, a reset code has been sent.")

    code = generate_otp()
    expires_at = get_expiry(minutes=10)

    otp_entry = UserVerificationOTP(
        user_id=user.id,
        otp_code=code,
        verification_type=OTPVerificationTypeEnum.phone,
        expires_at=expires_at,
    )
    db.add(otp_entry)
    db.commit()

    try:
        await send_verification_sms(user.phone, code, user.first_name)
    except Exception:
        print(traceback.format_exc())
        # Still return success to prevent enumeration
        pass

    masked = mask_phone(user.phone)
    return standard_response(True, f"If this phone number is registered, a reset code has been sent to {masked}.")


# ──────────────────────────────────────────────
# Verify Reset OTP (Phone)
# ──────────────────────────────────────────────
@router.post("/verify-reset-otp")
async def verify_reset_otp(request: Request, db: Session = Depends(get_db)):
    """Verifies an SMS OTP for password reset and returns a one-time reset token."""
    payload = await request.json()

    phone = payload.get("phone", "").strip()
    otp_code = payload.get("otp_code", "").strip()

    if not phone or not otp_code:
        return standard_response(False, "Phone number and OTP code are required.")

    try:
        phone = validate_tanzanian_phone(phone)
    except ValueError:
        return standard_response(False, "Invalid phone number format.")

    user = db.query(User).filter(User.phone == phone).first()
    if not user:
        return standard_response(False, "Invalid OTP or phone number.")

    otp_entry = (
        db.query(UserVerificationOTP)
        .filter(
            UserVerificationOTP.user_id == user.id,
            UserVerificationOTP.verification_type == OTPVerificationTypeEnum.phone,
            UserVerificationOTP.is_used == False,
        )
        .order_by(UserVerificationOTP.created_at.desc())
        .first()
    )

    if not otp_entry:
        return standard_response(False, "No active OTP found. Please request a new code.")

    if otp_entry.expires_at < datetime.utcnow():
        return standard_response(False, "OTP has expired. Please request a new code.")

    if otp_entry.otp_code != otp_code:
        return standard_response(False, "Incorrect OTP code. Please try again.")

    # Mark OTP as used
    otp_entry.is_used = True

    # Generate a password-reset token (same as email flow)
    raw_token, token_hash = generate_reset_token()

    reset = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db.add(reset)
    db.commit()

    return standard_response(True, "OTP verified successfully.", {"reset_token": raw_token})
