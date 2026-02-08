# Communities Routes - /communities/...
# Manages community groups

import uuid
from datetime import datetime

import pytz
from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from core.database import get_db
from models import Community, CommunityMember, User, UserProfile
from utils.auth import get_current_user
from utils.helpers import standard_response, paginate

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/communities", tags=["Communities"])


def _community_dict(db, c, current_user_id=None):
    is_member = False
    is_creator = str(c.created_by) == str(current_user_id) if c.created_by and current_user_id else False
    if current_user_id:
        is_member = db.query(CommunityMember).filter(
            CommunityMember.community_id == c.id,
            CommunityMember.user_id == current_user_id
        ).first() is not None

    return {
        "id": str(c.id),
        "name": c.name,
        "description": c.description,
        "image": c.cover_image_url,
        "is_public": c.is_public,
        "member_count": c.member_count or 0,
        "is_creator": is_creator or is_member,  # creators are always members
        "is_member": is_member or is_creator,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/")
def get_communities(page: int = 1, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Community).order_by(Community.created_at.desc())
    items, pagination = paginate(query, page, limit)
    data = [_community_dict(db, c, current_user.id) for c in items]
    return standard_response(True, "Communities retrieved", data, pagination=pagination)


@router.get("/my")
def get_my_communities(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    memberships = db.query(CommunityMember).filter(CommunityMember.user_id == current_user.id).all()
    community_ids = [m.community_id for m in memberships]
    # Also include communities created by user
    created = db.query(Community).filter(Community.created_by == current_user.id).all()
    created_ids = [c.id for c in created]
    all_ids = list(set(community_ids + created_ids))

    communities = db.query(Community).filter(Community.id.in_(all_ids)).order_by(Community.created_at.desc()).all() if all_ids else []
    data = [_community_dict(db, c, current_user.id) for c in communities]
    return standard_response(True, "My communities retrieved", data)


@router.post("/")
def create_community(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    name = body.get("name", "").strip()
    description = body.get("description", "").strip()
    if not name:
        return standard_response(False, "Community name is required")

    now = datetime.now(EAT)
    community = Community(
        id=uuid.uuid4(),
        name=name,
        description=description or None,
        is_public=body.get("is_public", True),
        member_count=1,
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(community)

    # Add creator as member with admin role
    membership = CommunityMember(
        id=uuid.uuid4(),
        community_id=community.id,
        user_id=current_user.id,
        role="admin",
        joined_at=now,
    )
    db.add(membership)
    db.commit()
    db.refresh(community)

    return standard_response(True, "Community created", _community_dict(db, community, current_user.id))


@router.get("/{community_id}")
def get_community(community_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(community_id)
    except ValueError:
        return standard_response(False, "Invalid community ID")

    c = db.query(Community).filter(Community.id == cid).first()
    if not c:
        return standard_response(False, "Community not found")

    return standard_response(True, "Community retrieved", _community_dict(db, c, current_user.id))


@router.post("/{community_id}/join")
def join_community(community_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(community_id)
    except ValueError:
        return standard_response(False, "Invalid community ID")

    c = db.query(Community).filter(Community.id == cid).first()
    if not c:
        return standard_response(False, "Community not found")

    existing = db.query(CommunityMember).filter(
        CommunityMember.community_id == cid,
        CommunityMember.user_id == current_user.id
    ).first()
    if existing:
        return standard_response(False, "Already a member")

    membership = CommunityMember(
        id=uuid.uuid4(),
        community_id=cid,
        user_id=current_user.id,
        role="member",
        joined_at=datetime.now(EAT),
    )
    db.add(membership)
    c.member_count = (c.member_count or 0) + 1
    db.commit()

    return standard_response(True, "Joined community", {"joined": True, "member_count": c.member_count})


@router.post("/{community_id}/leave")
def leave_community(community_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(community_id)
    except ValueError:
        return standard_response(False, "Invalid community ID")

    c = db.query(Community).filter(Community.id == cid).first()
    if not c:
        return standard_response(False, "Community not found")

    if str(c.created_by) == str(current_user.id):
        return standard_response(False, "Creator cannot leave the community")

    membership = db.query(CommunityMember).filter(
        CommunityMember.community_id == cid,
        CommunityMember.user_id == current_user.id
    ).first()
    if not membership:
        return standard_response(False, "Not a member")

    db.delete(membership)
    c.member_count = max((c.member_count or 1) - 1, 0)
    db.commit()

    return standard_response(True, "Left community", {"left": True, "member_count": c.member_count})


@router.get("/{community_id}/members")
def get_community_members(community_id: str, page: int = 1, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(community_id)
    except ValueError:
        return standard_response(False, "Invalid community ID")

    query = db.query(CommunityMember).filter(CommunityMember.community_id == cid).order_by(CommunityMember.joined_at.desc())
    items, pagination = paginate(query, page, limit)

    members = []
    for m in items:
        user = db.query(User).filter(User.id == m.user_id).first()
        profile = db.query(UserProfile).filter(UserProfile.user_id == m.user_id).first() if user else None
        if user:
            members.append({
                "id": str(user.id),
                "first_name": user.first_name,
                "last_name": user.last_name,
                "avatar": profile.profile_image_url if profile else None,
                "role": m.role,
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            })

    return standard_response(True, "Members retrieved", {"members": members}, pagination=pagination)
