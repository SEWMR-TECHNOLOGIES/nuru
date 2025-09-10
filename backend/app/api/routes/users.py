from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
import hashlib
import traceback
from core.database import get_db
from models.users import User
from utils.validation_functions import validate_email, validate_tanzanian_phone, validate_password_strength, validate_username
from utils.helpers import api_response

router = APIRouter()

@router.post("/signup")
async def signup(request: Request, db: Session = Depends(get_db)):
    # Validate content type
    if request.headers.get("content-type") != "application/json":
        return api_response(False, "Content type must be 'application/json'. Please send your data in JSON format.")

    # Parse JSON payload
    try:
        payload = await request.json()
    except Exception:
        return api_response(False, "Unable to parse the request body. Ensure your JSON is correctly formatted.")

    first_name = payload.get("first_name", "").strip()
    last_name = payload.get("last_name", "").strip()
    username = payload.get("username", "").strip()
    email = payload.get("email", "").strip()
    phone = payload.get("phone", "").strip()
    password = payload.get("password", "")

    # Validate first and last name
    if not first_name:
        return api_response(False, "We couldn't identify your first name. Please provide it so we can personalize your experience.")
    if not last_name:
        return api_response(False, "We couldn't identify your last name. Please provide it so we can complete your registration.")

    # Validate username
    if not username:
        return api_response(False, "Please provide a username for your account.")
    if not validate_username(username):
        return api_response(
            False, 
            "Username can only contain letters, numbers, and underscores, and must be 3-30 characters long."
        )
    if db.query(User).filter(User.username == username).first():
        return api_response(False, f"The username '{username}' is already taken. Please choose a different one.")

    # Validate email
    if not email:
        return api_response(False, "An email address helps us communicate important updates to you. Please provide one.")
    if not validate_email(email):
        return api_response(False, f"The email '{email}' doesn't seem to be valid. Please double-check and enter a correct email address.")
    if db.query(User).filter(User.email == email).first():
        return api_response(False, f"The email '{email}' is already associated with another account. Please use a different one.")

    # Validate and format phone
    if not phone:
        return api_response(False, "Your phone number allows us to verify your account and send important notifications. Please provide a valid Tanzanian number.")
    try:
        formatted_phone = validate_tanzanian_phone(phone)
    except ValueError as e:
        return api_response(False, str(e))
    if db.query(User).filter(User.phone == formatted_phone).first():
        return api_response(False, f"The phone number '{formatted_phone}' is already associated with another account. Please use a different one.")

    # Validate password strength
    if not password:
        return api_response(False, "For security, your account needs a strong password. Please provide one.")
    if not validate_password_strength(password):
        return api_response(
            False,
            "Your password must be robust: at least 8 characters long, include one uppercase letter, one lowercase letter, one number, and one special symbol. "
            "This ensures your account remains secure."
        )

    # Hash password
    password_hash = hashlib.sha256(password.encode()).hexdigest()

    # Create user
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
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        return api_response(False, "Something went wrong while creating your account. Please try again shortly.")

    user_data = {
        "id": str(user.id),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "email": user.email,
        "phone": user.phone
    }

    return api_response(True, f"Hello, {first_name}! Your account has been successfully created.", user_data)
