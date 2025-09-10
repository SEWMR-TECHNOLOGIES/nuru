from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from models.users import User
from utils.validation_functions import validate_email, validate_tanzanian_phone

router = APIRouter()

@router.post("/check-availability")
async def check_availability(request: Request, db: Session = Depends(get_db)):
    """
    Check if a username, email, or phone is available.
    Payload:
        {
            "type": "username" | "email" | "phone",
            "value": "<value_to_check>"
        }
    Returns:
        {"available": true} or {"available": false}
    """
    payload = await request.json()
    value_type = payload.get("type")
    value = payload.get("value", "").strip()

    if not value_type or not value:
        return {"available": False}

    if value_type == "username":
        exists = db.query(User).filter(User.username == value).first() is not None
        return {"available": not exists}

    elif value_type == "email":
        if not validate_email(value):
            return {"available": False}
        exists = db.query(User).filter(User.email == value).first() is not None
        return {"available": not exists}

    elif value_type == "phone":
        try:
            formatted_phone = validate_tanzanian_phone(value)
        except ValueError:
            return {"available": False}
        exists = db.query(User).filter(User.phone == formatted_phone).first() is not None
        return {"available": not exists}

    return {"available": False}
