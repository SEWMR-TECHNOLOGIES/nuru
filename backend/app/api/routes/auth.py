from fastapi import APIRouter, Cookie, Request, Depends, HTTPException, Response
from models.users import User
from sqlalchemy.orm import Session
from core.database import get_db
from utils.auth import get_current_user 
from utils.auth import verify_password, create_access_token, get_user_by_credential
from utils.validation_functions import validate_tanzanian_phone
from utils.helpers import api_response, mask_email, mask_phone
import re

router = APIRouter()

@router.post("/signin")
async def signin(request: Request, response: Response, db: Session = Depends(get_db)):
    # Validate content type
    if request.headers.get("content-type") != "application/json":
        return api_response(False, "Content type must be 'application/json'. Please send your login data in JSON format.")

    # Parse payload
    try:
        payload = await request.json()
    except Exception:
        return api_response(False, "Unable to read your login data. Ensure the JSON is properly formatted.")

    credential = payload.get("credential", "").strip()
    password = payload.get("password", "")

    if not credential:
        return api_response(False, "Please provide your username, email, or phone number to login.")
    if not password:
        return api_response(False, "Please enter your password to login.")

    # Normalize phone if it looks like one
    normalized_credential = credential
    try:
        if re.fullmatch(r'(\+?255|0)?[67]\d{8}', credential) or credential.replace("+", "").isdigit():
            normalized_credential = validate_tanzanian_phone(credential)
    except ValueError:
        # Not a valid phone number, treat as email or username
        pass

    # Fetch user
    user = get_user_by_credential(db, normalized_credential)

    # Handle login errors with clear messages
    if not user:
        return api_response(False, "We couldn't find an account matching the provided username, email, or phone number.")
    if not verify_password(password, user.password_hash):
        return api_response(False, "The credentials you have provided are incorrect. Please try again.")
    if not user.is_active:
        return api_response(False, "Your account is inactive. Please contact support to reactivate it.")


    # Generate token
    token = create_access_token({"uid": str(user.id)})

     # Create session cookie
    response.set_cookie(
        key="session_id",
        value=str(user.id),
        httponly=True,
        max_age=60*60*24,  # 1 day
        samesite="lax"
    )

    user_data = {
        "id": str(user.id),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "email": user.email if user.is_email_verified else mask_email(user.email),
        "phone": user.phone if user.is_phone_verified else mask_phone(user.phone),
        "is_email_verified": user.is_email_verified,
        "is_phone_verified": user.is_phone_verified
    }

    return api_response(True, f"Welcome back, {user.first_name}! You have successfully signed in.", 
                    {"user": user_data, "access_token": token, "token_type": "bearer"})

@router.get("/me")
async def read_current_user(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "username": current_user.username,
        "email": current_user.email,
        "phone": current_user.phone
    }

@router.post("/logout")
async def logout(response: Response, session_id: str = Cookie(None)):
    """
    Logout the user by clearing the session cookie.
    """
    response.delete_cookie(
        key="session_id",
        path="/",
        samesite="lax",
        httponly=True,
    )

    return {
        "success": True,
        "message": "You have been signed out successfully."
    }