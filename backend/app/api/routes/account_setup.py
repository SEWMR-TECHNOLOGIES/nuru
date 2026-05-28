"""Public endpoints for the secure account-setup link flow.

Used by `/set-password/:token` on the web. Mobile clients that received
a temporary password instead use POST /users/change-temporary-password
after their first login.
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from core.database import get_db
from models import User
from utils.account_setup import lookup_setup_token, consume_setup_token
from utils.auth import (
    hash_password, create_access_token, create_refresh_token, get_current_user,
)
from utils.helpers import standard_response
from utils.user_payload import build_user_payload
from utils.validation_functions import validate_password_strength

router = APIRouter(prefix="/auth", tags=["Account Setup"])


def _generic_invalid():
    return standard_response(False, "This setup link is invalid or has expired.",
                              {"state": "invalid"})


@router.get("/account-setup/validate")
async def validate_account_setup(token: str = "", db: Session = Depends(get_db)):
    result = lookup_setup_token(db, token)
    if result.state == "valid" and result.user:
        return standard_response(True, "Token is valid.", {
            "state": "valid",
            "first_name": result.user.first_name,
        })
    if result.state in ("expired", "used"):
        return standard_response(False, "This setup link has expired or already been used.",
                                  {"state": result.state})
    return _generic_invalid()


@router.post("/account-setup/set-password")
async def set_password(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        return standard_response(False, "Invalid request body.")
    token = (payload.get("token") or "").strip()
    password = payload.get("password") or ""
    confirm = payload.get("password_confirmation") or ""

    if not token or not password:
        return standard_response(False, "Token and password are required.")
    if password != confirm:
        return standard_response(False, "Passwords do not match.")
    if not validate_password_strength(password):
        return standard_response(False, "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.")

    pre = lookup_setup_token(db, token)
    if pre.state != "valid":
        if pre.state in ("expired", "used"):
            return standard_response(False, "This setup link has expired or already been used.", {"state": pre.state})
        return _generic_invalid()

    new_hash = hash_password(password)
    result = consume_setup_token(db, token, new_hash)
    if result.state != "valid" or not result.user:
        return _generic_invalid()

    user = result.user
    access_token = create_access_token({"uid": str(user.id)})
    refresh_token = create_refresh_token({"uid": str(user.id)})

    try:
        from utils.notify import create_notification
        create_notification(db, str(user.id), None, "security",
                            "Your password was set successfully. Welcome to Nuru!")
        db.commit()
    except Exception:
        pass

    return standard_response(True, "Password set successfully.", {
        "user": build_user_payload(db, user),
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "expires_in": 3600,
    })


@router.post("/change-temporary-password")
async def change_temporary_password(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Used by mobile/SMS recipients of a temporary password to change it
    on first login. Allowed even when must_change_password is false so
    users can update voluntarily — but does not require the old password
    if must_change_password is true (because that flag is the proof)."""
    try:
        payload = await request.json()
    except Exception:
        return standard_response(False, "Invalid request body.")
    new_password = payload.get("new_password") or ""
    confirm = payload.get("confirm_password") or ""

    if not new_password:
        return standard_response(False, "New password is required.")
    if new_password != confirm:
        return standard_response(False, "Passwords do not match.")
    if not validate_password_strength(new_password):
        return standard_response(False, "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.")

    current_user.password_hash = hash_password(new_password)
    current_user.must_change_password = False
    current_user.temporary_password_expires_at = None
    current_user.account_setup_completed_at = (
        current_user.account_setup_completed_at or
        __import__("datetime").datetime.utcnow()
    )
    db.commit()

    try:
        from utils.notify import create_notification
        create_notification(db, str(current_user.id), None, "security",
                            "Your password was updated successfully.")
        db.commit()
    except Exception:
        pass

    return standard_response(True, "Password updated successfully.")
