# backend/app/api/routes/users.py

from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
import hashlib
import traceback
from utils.notification_service import send_verification_email, send_verification_sms
from core.database import get_db
from models import User, UserVerificationOTP
from utils.validation_functions import validate_email, validate_tanzanian_phone, validate_password_strength, validate_username
from utils.helpers import standard_response, generate_otp, get_expiry, mask_email, mask_phone

router = APIRouter()


@router.post("/signup")
async def signup(request: Request, db: Session = Depends(get_db)):
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

    return standard_response(True, f"Hello, {first_name}! Your account has been successfully created. Please use the OTP sent to your email and phone to activate your account.", user_data)


@router.post("/request-otp")
async def request_otp(request: Request, db: Session = Depends(get_db)):
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
        verification_type=verification_type,
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


@router.post("/verify-otp")
async def verify_otp(request: Request, db: Session = Depends(get_db)):
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
            UserVerificationOTP.verification_type == verification_type,
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

    db.query(UserVerificationOTP).filter(
        UserVerificationOTP.user_id == user.id,
        UserVerificationOTP.verification_type == verification_type,
        UserVerificationOTP.is_used == False,
        UserVerificationOTP.id != otp_entry.id
    ).delete(synchronize_session=False)

    if verification_type == "email":
        user.is_email_verified = True
    else:
        user.is_phone_verified = True

    db.commit()

    return standard_response(True, f"{verification_type.capitalize()} verified successfully.")
