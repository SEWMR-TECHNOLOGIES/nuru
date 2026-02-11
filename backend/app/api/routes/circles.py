# Circles Routes - /circles/...
# Manages user circles (close friends groups)

import uuid
from datetime import datetime

import pytz
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from core.database import get_db
from models import UserCircle, User, UserProfile
from utils.auth import get_current_user
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/circles", tags=["Circles"])


def _member_dict(db, circle_entry):
    member = db.query(User).filter(User.id == circle_entry.circle_member_id).first()
    profile = db.query(UserProfile).filter(UserProfile.user_id == circle_entry.circle_member_id).first() if member else None
    if not member:
        return None
    return {
        "id": str(member.id),
        "first_name": member.first_name,
        "last_name": member.last_name,
        "avatar": profile.profile_picture_url if profile else None,
        "mutual_count": circle_entry.mutual_friends_count or 0,
        "added_at": circle_entry.created_at.isoformat() if circle_entry.created_at else None,
    }


@router.get("/")
def get_circles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get the user's circle as a single virtual circle with all members."""
    entries = db.query(UserCircle).filter(UserCircle.user_id == current_user.id).order_by(UserCircle.created_at.desc()).all()
    members = [_member_dict(db, e) for e in entries]
    members = [m for m in members if m is not None]

    circle = {
        "id": str(current_user.id),
        "name": "My Circle",
        "description": "My close friends",
        "member_count": len(members),
        "members": members,
    }
    return standard_response(True, "Circles retrieved", [circle])


@router.post("/")
def create_circle(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Circle is implicit per user - just return the virtual circle."""
    return standard_response(True, "Circle created", {
        "id": str(current_user.id),
        "name": "My Circle",
        "description": "My close friends",
        "member_count": 0,
    })


@router.get("/{circle_id}/members")
def get_circle_members(circle_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    entries = db.query(UserCircle).filter(UserCircle.user_id == current_user.id).order_by(UserCircle.created_at.desc()).all()
    members = [_member_dict(db, e) for e in entries]
    members = [m for m in members if m is not None]
    return standard_response(True, "Circle members retrieved", {"members": members})


@router.post("/{circle_id}/members/{user_id}")
def add_circle_member(circle_id: str, user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")

    target = db.query(User).filter(User.id == uid).first()
    if not target:
        return standard_response(False, "User not found")

    existing = db.query(UserCircle).filter(
        UserCircle.user_id == current_user.id,
        UserCircle.circle_member_id == uid
    ).first()
    if existing:
        return standard_response(False, "User already in your circle")

    entry = UserCircle(
        id=uuid.uuid4(),
        user_id=current_user.id,
        circle_member_id=uid,
        created_at=datetime.now(EAT),
    )
    db.add(entry)

    # Notify the user they've been added to a circle
    try:
        from utils.notify import notify_circle_add
        sender_name = f"{current_user.first_name} {current_user.last_name}"
        notify_circle_add(db, uid, current_user.id, sender_name)
    except Exception:
        pass

    db.commit()

    count = db.query(sa_func.count(UserCircle.id)).filter(UserCircle.user_id == current_user.id).scalar() or 0
    return standard_response(True, "Added to circle", {"added": True, "member_count": count})


@router.delete("/{circle_id}/members/{user_id}")
def remove_circle_member(circle_id: str, user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")

    entry = db.query(UserCircle).filter(
        UserCircle.user_id == current_user.id,
        UserCircle.circle_member_id == uid
    ).first()
    if not entry:
        return standard_response(False, "User not in your circle")

    db.delete(entry)
    db.commit()

    count = db.query(sa_func.count(UserCircle.id)).filter(UserCircle.user_id == current_user.id).scalar() or 0
    return standard_response(True, "Removed from circle", {"removed": True, "member_count": count})


@router.delete("/{circle_id}")
def delete_circle(circle_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Clear all circle members."""
    db.query(UserCircle).filter(UserCircle.user_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    return standard_response(True, "Circle cleared")
