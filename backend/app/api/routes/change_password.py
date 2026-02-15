import hashlib
import re
from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
from models import User
from core.database import get_db
from utils.auth import get_current_user, verify_password
from utils.helpers import standard_response

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/change-password")
async def change_password(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change password for the authenticated user."""
    payload = await request.json()

    current_password = payload.get("current_password", "")
    new_password = payload.get("new_password", "")
    confirm_password = payload.get("confirm_password", "")

    if not current_password:
        return standard_response(False, "Current password is required")
    if not new_password:
        return standard_response(False, "New password is required")
    if new_password != confirm_password:
        return standard_response(False, "Passwords do not match")

    # Validate password strength
    errors = []
    if len(new_password) < 8:
        errors.append("Password must be at least 8 characters")
    if not re.search(r"[A-Z]", new_password):
        errors.append("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", new_password):
        errors.append("Password must contain at least one lowercase letter")
    if not re.search(r"\d", new_password):
        errors.append("Password must contain at least one number")
    if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/~`]', new_password):
        errors.append("Password must contain at least one special character")

    if errors:
        return standard_response(False, "Validation failed", {"errors": errors})

    # Verify current password
    if not verify_password(current_password, current_user.password_hash):
        return standard_response(False, "Current password is incorrect")

    # Update password
    current_user.password_hash = hashlib.sha256(new_password.encode()).hexdigest()
    db.commit()

    # Send in-app notification
    try:
        from utils.notify import create_notification
        create_notification(db, str(current_user.id), None, "security", "Your password was changed successfully. If this wasn't you, contact support immediately.")
        db.commit()
    except Exception:
        pass

    return standard_response(True, "Password changed successfully")
