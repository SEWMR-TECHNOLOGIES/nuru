# Circles Routes - /circles/...
# Manages user circles with request/accept/reject flow

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
        "username": member.username,
        "avatar": profile.profile_picture_url if profile else None,
        "mutual_count": circle_entry.mutual_friends_count or 0,
        "status": circle_entry.status or "accepted",
        "added_at": circle_entry.created_at.isoformat() if circle_entry.created_at else None,
    }


def _request_dict(db, circle_entry):
    """Build dict for an incoming circle request (circle_entry.user_id is the requester)."""
    requester = db.query(User).filter(User.id == circle_entry.user_id).first()
    profile = db.query(UserProfile).filter(UserProfile.user_id == circle_entry.user_id).first() if requester else None
    if not requester:
        return None
    return {
        "request_id": str(circle_entry.id),
        "id": str(requester.id),
        "first_name": requester.first_name,
        "last_name": requester.last_name,
        "username": requester.username,
        "avatar": profile.profile_picture_url if profile else None,
        "mutual_count": circle_entry.mutual_friends_count or 0,
        "requested_at": circle_entry.created_at.isoformat() if circle_entry.created_at else None,
    }


@router.get("/")
def get_circles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get the user's circle (only accepted members)."""
    entries = db.query(UserCircle).filter(
        UserCircle.user_id == current_user.id,
        UserCircle.status == "accepted"
    ).order_by(UserCircle.created_at.desc()).all()
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


@router.get("/requests")
def get_circle_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get incoming circle requests (where someone wants to add me)."""
    entries = db.query(UserCircle).filter(
        UserCircle.circle_member_id == current_user.id,
        UserCircle.status == "pending"
    ).order_by(UserCircle.created_at.desc()).all()
    requests = [_request_dict(db, e) for e in entries]
    requests = [r for r in requests if r is not None]
    return standard_response(True, "Circle requests retrieved", {"requests": requests, "count": len(requests)})


@router.put("/requests/{request_id}/accept")
def accept_circle_request(request_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Accept a circle request and create the reciprocal entry."""
    try:
        rid = uuid.UUID(request_id)
    except ValueError:
        return standard_response(False, "Invalid request ID")

    entry = db.query(UserCircle).filter(
        UserCircle.id == rid,
        UserCircle.circle_member_id == current_user.id,
        UserCircle.status == "pending"
    ).first()
    if not entry:
        return standard_response(False, "Request not found")

    entry.status = "accepted"
    entry.updated_at = datetime.now(EAT)

    # Create reciprocal entry: the acceptor also has the requester in their circle
    existing_reverse = db.query(UserCircle).filter(
        UserCircle.user_id == current_user.id,
        UserCircle.circle_member_id == entry.user_id
    ).first()
    if not existing_reverse:
        reverse_entry = UserCircle(
            id=uuid.uuid4(),
            user_id=current_user.id,
            circle_member_id=entry.user_id,
            status="accepted",
            created_at=datetime.now(EAT),
        )
        db.add(reverse_entry)
    elif existing_reverse.status != "accepted":
        existing_reverse.status = "accepted"
        existing_reverse.updated_at = datetime.now(EAT)

    # Notify the requester that their request was accepted
    try:
        from utils.notify import notify_circle_accepted
        recipient_name = f"{current_user.first_name} {current_user.last_name}"
        notify_circle_accepted(db, entry.user_id, current_user.id, recipient_name)
    except Exception:
        pass

    db.commit()
    return standard_response(True, "Circle request accepted")


@router.put("/requests/{request_id}/reject")
def reject_circle_request(request_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Reject and delete a circle request."""
    try:
        rid = uuid.UUID(request_id)
    except ValueError:
        return standard_response(False, "Invalid request ID")

    entry = db.query(UserCircle).filter(
        UserCircle.id == rid,
        UserCircle.circle_member_id == current_user.id,
        UserCircle.status == "pending"
    ).first()
    if not entry:
        return standard_response(False, "Request not found")

    db.delete(entry)
    db.commit()
    return standard_response(True, "Circle request declined")


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
    entries = db.query(UserCircle).filter(
        UserCircle.user_id == current_user.id,
        UserCircle.status == "accepted"
    ).order_by(UserCircle.created_at.desc()).all()
    members = [_member_dict(db, e) for e in entries]
    members = [m for m in members if m is not None]
    return standard_response(True, "Circle members retrieved", {"members": members})


@router.post("/{circle_id}/members/{user_id}")
def add_circle_member(circle_id: str, user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Send a circle request (pending until accepted by the target user)."""
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")

    target = db.query(User).filter(User.id == uid).first()
    if not target:
        return standard_response(False, "User not found")

    # Check both directions for existing relationship
    existing = db.query(UserCircle).filter(
        UserCircle.user_id == current_user.id,
        UserCircle.circle_member_id == uid
    ).first()
    if existing:
        if existing.status == "pending":
            return standard_response(False, "Request already sent")
        return standard_response(False, "User already in your circle")

    # Also check reverse: target already sent a request to current user
    reverse_existing = db.query(UserCircle).filter(
        UserCircle.user_id == uid,
        UserCircle.circle_member_id == current_user.id
    ).first()
    if reverse_existing:
        if reverse_existing.status == "pending":
            return standard_response(False, "This user already sent you a circle request. Check your pending requests.")
        if reverse_existing.status == "accepted":
            return standard_response(False, "User already in your circle")

    entry = UserCircle(
        id=uuid.uuid4(),
        user_id=current_user.id,
        circle_member_id=uid,
        status="pending",
        created_at=datetime.now(EAT),
    )
    db.add(entry)

    # Notify the target user about the circle request
    try:
        from utils.notify import notify_circle_request
        sender_name = f"{current_user.first_name} {current_user.last_name}"
        notify_circle_request(db, uid, current_user.id, sender_name)
    except Exception:
        pass

    db.commit()

    count = db.query(sa_func.count(UserCircle.id)).filter(
        UserCircle.user_id == current_user.id,
        UserCircle.status == "accepted"
    ).scalar() or 0
    return standard_response(True, "Circle request sent", {"requested": True, "member_count": count})


@router.delete("/{circle_id}/members/{user_id}")
def remove_circle_member(circle_id: str, user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")

    # Remove both directions
    entry = db.query(UserCircle).filter(
        UserCircle.user_id == current_user.id,
        UserCircle.circle_member_id == uid
    ).first()
    if not entry:
        return standard_response(False, "User not in your circle")

    db.delete(entry)

    # Also remove the reciprocal entry
    reverse = db.query(UserCircle).filter(
        UserCircle.user_id == uid,
        UserCircle.circle_member_id == current_user.id
    ).first()
    if reverse:
        db.delete(reverse)

    db.commit()

    count = db.query(sa_func.count(UserCircle.id)).filter(
        UserCircle.user_id == current_user.id,
        UserCircle.status == "accepted"
    ).scalar() or 0
    return standard_response(True, "Removed from circle", {"removed": True, "member_count": count})


@router.delete("/{circle_id}")
def delete_circle(circle_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Clear all circle members."""
    db.query(UserCircle).filter(UserCircle.user_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    return standard_response(True, "Circle cleared")
