# Communities Routes - /communities/...
# Manages community groups

import os
import uuid
from datetime import datetime
from typing import List, Optional

import httpx
import pytz
from fastapi import APIRouter, Depends, Body, File, Form, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from core.database import get_db
from models import Community, CommunityMember, CommunityPost, CommunityPostImage, CommunityPostGlow, User, UserProfile, UserFeed, UserFeedImage
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
async def create_community(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    is_public: Optional[bool] = Form(True),
    cover_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name = name.strip()
    if not name:
        return standard_response(False, "Community name is required")

    now = datetime.now(EAT)
    cover_image_url = None

    # Upload cover image if provided
    if cover_image and cover_image.filename and cover_image.size and cover_image.size > 0:
        from core.config import UPLOAD_SERVICE_URL
        file_content = await cover_image.read()
        _, ext = os.path.splitext(cover_image.filename)
        unique_name = f"{uuid.uuid4().hex}{ext}"
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(UPLOAD_SERVICE_URL, data={"target_path": "nuru/uploads/communities/covers/"}, files={"file": (unique_name, file_content, cover_image.content_type)}, timeout=20)
                result = resp.json()
                if result.get("success"):
                    cover_image_url = result["data"]["url"]
            except Exception:
                pass

    community = Community(
        id=uuid.uuid4(),
        name=name,
        description=description.strip() if description else None,
        cover_image_url=cover_image_url,
        is_public=is_public if is_public is not None else True,
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

    return standard_response(True, "Community retrieved", {**_community_dict(db, c, current_user.id), "created_by": str(c.created_by) if c.created_by else None})


@router.put("/{community_id}/cover")
async def update_community_cover(
    community_id: str,
    cover_image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update community cover image (admin only)."""
    try:
        cid = uuid.UUID(community_id)
    except ValueError:
        return standard_response(False, "Invalid community ID")

    c = db.query(Community).filter(Community.id == cid).first()
    if not c:
        return standard_response(False, "Community not found")

    # Check admin
    member = db.query(CommunityMember).filter(
        CommunityMember.community_id == cid,
        CommunityMember.user_id == current_user.id,
        CommunityMember.role == "admin"
    ).first()
    if not member and str(c.created_by) != str(current_user.id):
        return standard_response(False, "Only admins can update the cover image")

    from core.config import UPLOAD_SERVICE_URL
    file_content = await cover_image.read()
    _, ext = os.path.splitext(cover_image.filename)
    unique_name = f"{uuid.uuid4().hex}{ext}"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(UPLOAD_SERVICE_URL, data={"target_path": "nuru/uploads/communities/covers/"}, files={"file": (unique_name, file_content, cover_image.content_type)}, timeout=20)
            result = resp.json()
            if result.get("success"):
                c.cover_image_url = result["data"]["url"]
                c.updated_at = datetime.now(EAT)
                db.commit()
                return standard_response(True, "Cover image updated", {"image": c.cover_image_url})
        except Exception:
            pass

    return standard_response(False, "Failed to upload cover image")


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
                "avatar": profile.profile_picture_url if profile else None,
                "role": m.role,
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            })

    return standard_response(True, "Members retrieved", {"members": members}, pagination=pagination, wrap_items=False)


@router.post("/{community_id}/members")
def add_community_member(community_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Creator adds a member to the community."""
    try:
        cid = uuid.UUID(community_id)
    except ValueError:
        return standard_response(False, "Invalid community ID")

    c = db.query(Community).filter(Community.id == cid).first()
    if not c:
        return standard_response(False, "Community not found")

    if str(c.created_by) != str(current_user.id):
        return standard_response(False, "Only the community creator can add members")

    user_id = body.get("user_id")
    if not user_id:
        return standard_response(False, "user_id is required")

    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid user ID")

    existing = db.query(CommunityMember).filter(
        CommunityMember.community_id == cid,
        CommunityMember.user_id == uid
    ).first()
    if existing:
        return standard_response(False, "User is already a member")

    membership = CommunityMember(
        id=uuid.uuid4(),
        community_id=cid,
        user_id=uid,
        role="member",
        joined_at=datetime.now(EAT),
    )
    db.add(membership)
    c.member_count = (c.member_count or 0) + 1
    db.commit()

    return standard_response(True, "Member added", {"member_count": c.member_count})


@router.delete("/{community_id}/members/{user_id}")
def remove_community_member(community_id: str, user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Creator removes a member from the community."""
    try:
        cid = uuid.UUID(community_id)
        uid = uuid.UUID(user_id)
    except ValueError:
        return standard_response(False, "Invalid ID")

    c = db.query(Community).filter(Community.id == cid).first()
    if not c:
        return standard_response(False, "Community not found")

    if str(c.created_by) != str(current_user.id):
        return standard_response(False, "Only the community creator can remove members")

    if str(uid) == str(current_user.id):
        return standard_response(False, "Cannot remove yourself")

    membership = db.query(CommunityMember).filter(
        CommunityMember.community_id == cid,
        CommunityMember.user_id == uid
    ).first()
    if not membership:
        return standard_response(False, "User is not a member")

    db.delete(membership)
    c.member_count = max((c.member_count or 1) - 1, 0)
    db.commit()

    return standard_response(True, "Member removed", {"member_count": c.member_count})


@router.get("/{community_id}/posts")
def get_community_posts(community_id: str, page: int = 1, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get community posts created by the community creator."""
    try:
        cid = uuid.UUID(community_id)
    except ValueError:
        return standard_response(False, "Invalid community ID")

    c = db.query(Community).filter(Community.id == cid).first()
    if not c:
        return standard_response(False, "Community not found")

    query = db.query(CommunityPost).filter(
        CommunityPost.community_id == cid,
    ).order_by(CommunityPost.created_at.desc())

    items, pagination_data = paginate(query, page, limit)

    posts = []
    for cp in items:
        user = db.query(User).filter(User.id == cp.author_id).first()
        profile = db.query(UserProfile).filter(UserProfile.user_id == cp.author_id).first() if user else None
        images = db.query(CommunityPostImage).filter(CommunityPostImage.post_id == cp.id).all()
        glow_count = db.query(sa_func.count(CommunityPostGlow.id)).filter(CommunityPostGlow.post_id == cp.id).scalar() or 0
        has_glowed = False
        if current_user:
            has_glowed = db.query(CommunityPostGlow).filter(
                CommunityPostGlow.post_id == cp.id,
                CommunityPostGlow.user_id == current_user.id
            ).first() is not None

        posts.append({
            "id": str(cp.id),
            "author": {
                "id": str(user.id) if user else None,
                "name": f"{user.first_name} {user.last_name}" if user else None,
                "avatar": profile.profile_picture_url if profile else None,
            },
            "content": cp.content,
            "images": [img.image_url for img in images],
            "glow_count": glow_count,
            "has_glowed": has_glowed,
            "created_at": cp.created_at.isoformat() if cp.created_at else None,
        })

    return standard_response(True, "Community posts retrieved", {"posts": posts}, pagination=pagination_data, wrap_items=False)


@router.post("/{community_id}/posts")
async def create_community_post(
    community_id: str,
    content: Optional[str] = Form(None),
    images: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Only the community creator can post content."""
    try:
        cid = uuid.UUID(community_id)
    except ValueError:
        return standard_response(False, "Invalid community ID")

    c = db.query(Community).filter(Community.id == cid).first()
    if not c:
        return standard_response(False, "Community not found")

    if str(c.created_by) != str(current_user.id):
        return standard_response(False, "Only the community creator can post")

    # Filter out empty file entries
    valid_images = []
    if images:
        for f in images:
            if f and f.filename and f.size and f.size > 0:
                valid_images.append(f)

    if not content and not valid_images:
        return standard_response(False, "Content or images are required")

    now = datetime.now(EAT)
    cp = CommunityPost(
        id=uuid.uuid4(),
        community_id=cid,
        author_id=current_user.id,
        content=content.strip() if content else None,
        created_at=now,
        updated_at=now,
    )
    db.add(cp)
    db.flush()

    if valid_images:
        from core.config import UPLOAD_SERVICE_URL
        for file in valid_images:
            file_content = await file.read()
            _, ext = os.path.splitext(file.filename)
            unique_name = f"{uuid.uuid4().hex}{ext}"
            async with httpx.AsyncClient() as client:
                try:
                    resp = await client.post(UPLOAD_SERVICE_URL, data={"target_path": f"nuru/uploads/communities/{cid}/"}, files={"file": (unique_name, file_content, file.content_type)}, timeout=20)
                    result = resp.json()
                    if result.get("success"):
                        db.add(CommunityPostImage(id=uuid.uuid4(), post_id=cp.id, image_url=result["data"]["url"], created_at=now))
                except Exception:
                    pass

    db.commit()
    return standard_response(True, "Post created", {"id": str(cp.id)})


@router.post("/{community_id}/posts/{post_id}/glow")
def glow_community_post(community_id: str, post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")

    existing = db.query(CommunityPostGlow).filter(
        CommunityPostGlow.post_id == pid,
        CommunityPostGlow.user_id == current_user.id
    ).first()
    if existing:
        return standard_response(True, "Already glowed")

    db.add(CommunityPostGlow(id=uuid.uuid4(), post_id=pid, user_id=current_user.id, created_at=datetime.now(EAT)))
    db.commit()
    return standard_response(True, "Post glowed")


@router.delete("/{community_id}/posts/{post_id}/glow")
def unglow_community_post(community_id: str, post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = uuid.UUID(post_id)
    except ValueError:
        return standard_response(False, "Invalid post ID")

    g = db.query(CommunityPostGlow).filter(
        CommunityPostGlow.post_id == pid,
        CommunityPostGlow.user_id == current_user.id
    ).first()
    if g:
        db.delete(g)
        db.commit()
    return standard_response(True, "Glow removed")
