# backend/app/api/routes/auth.py

from fastapi import APIRouter, Cookie, Request, Depends, Response
from sqlalchemy.orm import Session
from utils.user_payload import build_user_payload
from models.users import User
from core.database import get_db
from utils.auth import (
    get_current_user,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_user_by_credential,
    verify_refresh_token
)
from utils.validation_functions import validate_tanzanian_phone
from utils.helpers import standard_response
import re

router = APIRouter()


@router.post("/signin")
async def signin(request: Request, response: Response, db: Session = Depends(get_db)):
    """Sign in with email, phone, or username"""
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
        return standard_response(False, "Your account has been suspended. Contact support.")

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


@router.post("/refresh")
async def refresh_token(request: Request):
    """Refresh expired access token"""
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


@router.get("/me")
async def read_current_user(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return the authenticated user's full profile"""
    user_payload = build_user_payload(db, current_user)
    return standard_response(True, "User retrieved successfully", user_payload)


@router.post("/logout")
async def logout(response: Response, session_id: str = Cookie(None)):
    """Logout the user by clearing the session cookie"""
    response.delete_cookie(
        key="session_id",
        path="/",
        samesite="lax",
        httponly=True,
    )
    return standard_response(True, "Logged out successfully")
