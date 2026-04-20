# Event Groups Routes - /event-groups/...
# Per-event chat workspace + premium scoreboard.

import uuid
import secrets as pysecrets
from datetime import datetime, timedelta
from typing import Optional, List

import pytz
from fastapi import APIRouter, Depends, Body, Query, HTTPException, Header
from sqlalchemy import func as sa_func, or_, and_, exists, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from core.config import SECRET_KEY, ALGORITHM
import jwt
from models import (
    Event, EventImage, User, UserProfile, EventCommitteeMember,
    EventContributor, UserContributor, EventContribution,
    ContributionStatusEnum, Currency, FileUpload,
)
from models.event_groups import (
    EventGroup, EventGroupMember, EventGroupMessage,
    EventGroupMessageReaction, EventGroupInviteToken,
    GroupMemberRoleEnum, GroupMessageTypeEnum,
)
from utils.auth import get_current_user, get_optional_user
from utils.helpers import standard_response

EAT = pytz.timezone("Africa/Nairobi")

router = APIRouter(prefix="/event-groups", tags=["Event Groups"])


# ──────────────────────────────────────────────
# Guest token helpers — group-scoped JWT
# ──────────────────────────────────────────────

GUEST_TOKEN_DAYS = 90


def _create_guest_token(member_id: str, group_id: str) -> str:
    payload = {
        "scope": "event_group_guest",
        "member_id": member_id,
        "group_id": group_id,
        "exp": datetime.utcnow() + timedelta(days=GUEST_TOKEN_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_guest_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("scope") != "event_group_guest":
            return None
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def _resolve_member(
    db: Session, group_id: uuid.UUID,
    current_user: Optional[User],
    x_guest_token: Optional[str],
) -> Optional[EventGroupMember]:
    """Find the EventGroupMember representing the caller.

    Priority: authenticated Nuru user → guest JWT.
    """
    if current_user:
        m = db.query(EventGroupMember).filter(
            EventGroupMember.group_id == group_id,
            EventGroupMember.user_id == current_user.id,
        ).first()
        if m:
            return m
    if x_guest_token:
        payload = _decode_guest_token(x_guest_token)
        if payload and payload.get("group_id") == str(group_id):
            try:
                mid = uuid.UUID(payload["member_id"])
            except (ValueError, KeyError, TypeError):
                return None
            return db.query(EventGroupMember).filter(
                EventGroupMember.id == mid,
                EventGroupMember.group_id == group_id,
            ).first()
    return None


def _ensure_entitled_viewer(
    db: Session, group: EventGroup, event: Optional[Event],
    current_user: Optional[User], x_guest_token: Optional[str],
) -> Optional[EventGroupMember]:
    """Resolve membership; auto-add organizer / committee / linked contributor
    if missing, so an entitled viewer never sees 'You are not a member'."""
    member = _resolve_member(db, group.id, current_user, x_guest_token)
    if member or not current_user or not event:
        return member
    role = None
    is_admin = False
    if event.organizer_id == current_user.id:
        role, is_admin = GroupMemberRoleEnum.organizer, True
    if not role:
        cm = db.query(EventCommitteeMember).filter(
            EventCommitteeMember.event_id == event.id,
            EventCommitteeMember.user_id == current_user.id,
        ).first()
        if cm:
            role = GroupMemberRoleEnum.committee
    contributor_id = None
    if not role:
        ec_rows = db.query(EventContributor).options(
            joinedload(EventContributor.contributor),
        ).filter(EventContributor.event_id == event.id).all()
        for entry in ec_rows:
            c = entry.contributor
            if c and c.contributor_user_id == current_user.id:
                role = GroupMemberRoleEnum.contributor
                contributor_id = c.id
                break
    if not role:
        return None
    member = EventGroupMember(
        id=uuid.uuid4(), group_id=group.id, user_id=current_user.id,
        contributor_id=contributor_id, role=role, is_admin=is_admin,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


# ──────────────────────────────────────────────
# Auto-close hook
# ──────────────────────────────────────────────

def _maybe_auto_close(db: Session, group: EventGroup, event: Event) -> EventGroup:
    """Close the group automatically after the event end_date."""
    if group.is_closed:
        return group
    end = event.end_date or event.start_date
    if end:
        if hasattr(end, "year") and not hasattr(end, "hour"):
            end_dt = datetime.combine(end, datetime.max.time())
        else:
            end_dt = end.replace(tzinfo=None) if getattr(end, "tzinfo", None) else end
        if datetime.utcnow() > end_dt:
            group.is_closed = True
            group.closed_at = datetime.utcnow()
            db.commit()
    return group


# ──────────────────────────────────────────────
# Serialisers
# ──────────────────────────────────────────────

def _user_avatar(db: Session, user_id) -> Optional[str]:
    if not user_id:
        return None
    p = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    return p.profile_picture_url if p else None


def _resolve_event_cover(db: Session, event: Event) -> Optional[str]:
    if event.cover_image_url:
        return event.cover_image_url
    img = db.query(EventImage).filter(EventImage.event_id == event.id) \
        .order_by(EventImage.is_featured.desc(), EventImage.created_at.asc()).first()
    return img.image_url if img else None


def _group_dict(db: Session, group: EventGroup, viewer_member: Optional[EventGroupMember]) -> dict:
    event = db.query(Event).filter(Event.id == group.event_id).first()
    cover = group.image_url or (_resolve_event_cover(db, event) if event else None)
    member_count = db.query(sa_func.count(EventGroupMember.id)).filter(
        EventGroupMember.group_id == group.id,
    ).scalar() or 0
    # Up to 5 member previews (avatar + name) for stacked thumbnails on the inbox card.
    preview_members = (
        db.query(EventGroupMember)
        .filter(EventGroupMember.group_id == group.id)
        .order_by(EventGroupMember.is_admin.desc(), EventGroupMember.joined_at.asc())
        .limit(5)
        .all()
    )
    members_preview = []
    for pm in preview_members:
        pm_name = None
        pm_avatar = None
        if pm.user_id and pm.user:
            pm_name = f"{pm.user.first_name or ''} {pm.user.last_name or ''}".strip() or pm.user.phone
            pm_avatar = _user_avatar(db, pm.user_id)
        else:
            pm_name = pm.guest_name
        members_preview.append({
            "id": str(pm.id),
            "name": pm_name,
            "avatar_url": pm_avatar,
        })
    last_msg = db.query(EventGroupMessage).filter(
        EventGroupMessage.group_id == group.id,
        EventGroupMessage.is_deleted == False,
    ).order_by(EventGroupMessage.created_at.desc()).first()
    unread = 0
    if viewer_member and viewer_member.last_read_at:
        unread = db.query(sa_func.count(EventGroupMessage.id)).filter(
            EventGroupMessage.group_id == group.id,
            EventGroupMessage.created_at > viewer_member.last_read_at,
            EventGroupMessage.is_deleted == False,
        ).scalar() or 0
    elif viewer_member:
        unread = db.query(sa_func.count(EventGroupMessage.id)).filter(
            EventGroupMessage.group_id == group.id,
            EventGroupMessage.is_deleted == False,
        ).scalar() or 0

    return {
        "id": str(group.id),
        "event_id": str(group.event_id),
        "event": {
            "id": str(event.id),
            "name": event.name,
            "start_date": event.start_date.isoformat() if event.start_date else None,
            "end_date": event.end_date.isoformat() if event.end_date else None,
        } if event else None,
        "event_name": event.name if event else None,
        "event_start_date": event.start_date.isoformat() if event and event.start_date else None,
        "event_end_date": event.end_date.isoformat() if event and event.end_date else None,
        "name": group.name,
        "description": group.description,
        "image_url": cover,
        "is_closed": group.is_closed,
        "member_count": member_count,
        "members_preview": members_preview,
        "unread_count": unread,
        "last_message": {
            "id": str(last_msg.id),
            "content": last_msg.content,
            "message_type": last_msg.message_type.value if last_msg.message_type else "text",
            "created_at": last_msg.created_at.isoformat(),
        } if last_msg else None,
        "viewer": {
            "member_id": str(viewer_member.id) if viewer_member else None,
            "role": viewer_member.role.value if viewer_member and viewer_member.role else None,
            "is_admin": viewer_member.is_admin if viewer_member else False,
        },
        "created_at": group.created_at.isoformat() if group.created_at else None,
    }


def _member_dict(db: Session, m: EventGroupMember) -> dict:
    name = None
    avatar = None
    phone = None
    if m.user_id and m.user:
        name = f"{m.user.first_name or ''} {m.user.last_name or ''}".strip() or m.user.phone
        avatar = _user_avatar(db, m.user_id)
        phone = m.user.phone
    else:
        name = m.guest_name
        phone = m.guest_phone
    return {
        "id": str(m.id),
        "user_id": str(m.user_id) if m.user_id else None,
        "contributor_id": str(m.contributor_id) if m.contributor_id else None,
        "name": name,
        "display_name": name,
        "avatar": avatar,
        "avatar_url": avatar,
        "phone": phone,
        "role": m.role.value if m.role else "contributor",
        "is_admin": m.is_admin,
        "is_guest": m.user_id is None,
        "joined_at": m.joined_at.isoformat() if m.joined_at else None,
    }


def _message_dict(db: Session, msg: EventGroupMessage, members_by_id: dict) -> dict:
    sender = members_by_id.get(msg.sender_member_id) if msg.sender_member_id else None
    sender_name = None
    sender_avatar = None
    if sender:
        sender_name = sender.get("name")
        sender_avatar = sender.get("avatar")

    reaction_members: dict[str, list[str]] = {}
    for r in msg.reactions:
        reaction_members.setdefault(r.emoji, []).append(str(r.member_id))
    reactions = [
        {
            "emoji": emoji,
            "count": len(member_ids),
            "members": member_ids,
        }
        for emoji, member_ids in reaction_members.items()
    ]

    reply_to = None
    if msg.reply_to_id:
        reply_msg = db.query(EventGroupMessage).filter(EventGroupMessage.id == msg.reply_to_id).first()
        if reply_msg:
            reply_sender = members_by_id.get(reply_msg.sender_member_id) if reply_msg.sender_member_id else None
            reply_to = {
                "id": str(reply_msg.id),
                "content": reply_msg.content,
                "sender_name": reply_sender.get("name") if reply_sender else None,
            }

    return {
        "id": str(msg.id),
        "group_id": str(msg.group_id),
        "sender_member_id": str(msg.sender_member_id) if msg.sender_member_id else None,
        "sender_name": sender_name,
        "sender_avatar": sender_avatar,
        "sender_avatar_url": sender_avatar,
        "message_type": msg.message_type.value if msg.message_type else "text",
        "content": msg.content,
        "image_url": msg.image_url,
        "metadata": msg.metadata_json,
        "reply_to_id": str(msg.reply_to_id) if msg.reply_to_id else None,
        "reply_to": reply_to,
        "reactions": reactions,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


# ──────────────────────────────────────────────
# Membership seeding
# ──────────────────────────────────────────────

def _seed_members(db: Session, group: EventGroup, event: Event):
    """Auto-add organizer + committee + all event contributors (linked Nuru users
    only — non-Nuru contributors join via invite link)."""
    seen_users = set()

    # Organizer
    if event.organizer_id:
        existing = db.query(EventGroupMember).filter(
            EventGroupMember.group_id == group.id,
            EventGroupMember.user_id == event.organizer_id,
        ).first()
        if not existing:
            db.add(EventGroupMember(
                id=uuid.uuid4(), group_id=group.id, user_id=event.organizer_id,
                role=GroupMemberRoleEnum.organizer, is_admin=True,
            ))
        seen_users.add(event.organizer_id)

    # Committee
    committee = db.query(EventCommitteeMember).filter(
        EventCommitteeMember.event_id == event.id,
    ).all()
    for cm in committee:
        if cm.user_id in seen_users:
            continue
        db.add(EventGroupMember(
            id=uuid.uuid4(), group_id=group.id, user_id=cm.user_id,
            role=GroupMemberRoleEnum.committee,
        ))
        seen_users.add(cm.user_id)

    # Contributors (linked Nuru users)
    ecs = db.query(EventContributor).options(
        joinedload(EventContributor.contributor),
    ).filter(EventContributor.event_id == event.id).all()
    for ec in ecs:
        contributor = ec.contributor
        if not contributor:
            continue
        if contributor.contributor_user_id and contributor.contributor_user_id not in seen_users:
            db.add(EventGroupMember(
                id=uuid.uuid4(), group_id=group.id,
                user_id=contributor.contributor_user_id,
                contributor_id=contributor.id,
                role=GroupMemberRoleEnum.contributor,
            ))
            seen_users.add(contributor.contributor_user_id)
    db.commit()


def ensure_member_for_contributor(db: Session, event_id, contributor) -> Optional[EventGroupMember]:
    """Ensure a freshly-added contributor is in the event's group (if a group exists).
    Called from the contributor-add route so members appear automatically.
    Safe no-op if no group, or if member already exists.
    """
    if not contributor:
        return None
    group = db.query(EventGroup).filter(EventGroup.event_id == event_id).first()
    if not group:
        return None
    user_id = getattr(contributor, "contributor_user_id", None)
    if user_id:
        existing = db.query(EventGroupMember).filter(
            EventGroupMember.group_id == group.id,
            EventGroupMember.user_id == user_id,
        ).first()
        if existing:
            return existing
        m = EventGroupMember(
            id=uuid.uuid4(), group_id=group.id, user_id=user_id,
            contributor_id=contributor.id, role=GroupMemberRoleEnum.contributor,
        )
        db.add(m)
        db.flush()
        return m
    # Non-Nuru contributor: pre-create a guest member slot so admins can
    # generate an invite link from the Members drawer right away.
    existing = db.query(EventGroupMember).filter(
        EventGroupMember.group_id == group.id,
        EventGroupMember.contributor_id == contributor.id,
    ).first()
    if existing:
        return existing
    m = EventGroupMember(
        id=uuid.uuid4(), group_id=group.id,
        contributor_id=contributor.id,
        guest_name=getattr(contributor, "name", None),
        guest_phone=getattr(contributor, "phone", None),
        role=GroupMemberRoleEnum.guest,
    )
    db.add(m)
    db.flush()
    return m

# ══════════════════════════════════════════════

@router.get("/")
def list_my_groups(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Groups the current user belongs to (any role)."""
    q = db.query(EventGroupMember).options(
        joinedload(EventGroupMember.group),
    ).filter(EventGroupMember.user_id == current_user.id)
    memberships = q.all()
    items = []
    for m in memberships:
        if not m.group:
            continue
        if search:
            term = search.strip().lower()
            if term and term not in (m.group.name or "").lower():
                continue
        ev = db.query(Event).filter(Event.id == m.group.event_id).first()
        if ev:
            _maybe_auto_close(db, m.group, ev)
        items.append(_group_dict(db, m.group, m))

    items.sort(
        key=lambda g: ((g.get("last_message") or {}).get("created_at") or g["created_at"]),
        reverse=True,
    )
    return standard_response(True, "Groups fetched", {"groups": items})


@router.post("/events/{event_id}")
def create_event_group(
    event_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create the event group (organizer only). One per event."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")
    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        return standard_response(False, "Event not found")
    if event.organizer_id != current_user.id:
        return standard_response(False, "Only the event organizer can create the group")

    existing = db.query(EventGroup).filter(EventGroup.event_id == eid).first()
    if existing:
        return standard_response(True, "Group already exists",
                                 _group_dict(db, existing, _resolve_member(db, existing.id, current_user, None)))

    group = EventGroup(
        id=uuid.uuid4(),
        event_id=eid,
        created_by=current_user.id,
        name=(body.get("name") or "").strip() or event.name,
        description=(body.get("description") or "").strip() or None,
        image_url=(body.get("image_url") or "").strip() or None,
    )
    db.add(group)
    db.commit()
    _seed_members(db, group, event)
    viewer = _resolve_member(db, group.id, current_user, None)
    return standard_response(True, "Group created", _group_dict(db, group, viewer))


@router.get("/events/{event_id}")
def get_group_for_event(
    event_id: str,
    x_guest_token: Optional[str] = Header(None, alias="X-Guest-Token"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        return standard_response(False, "Invalid event ID")
    group = db.query(EventGroup).filter(EventGroup.event_id == eid).first()
    event = db.query(Event).filter(Event.id == eid).first()
    if not group:
        return standard_response(False, "Group not found")
    if event:
        _maybe_auto_close(db, group, event)
    viewer = _ensure_entitled_viewer(db, group, event, current_user, x_guest_token)
    if not viewer:
        return standard_response(False, "You are not a member of this group")
    return standard_response(True, "Group fetched", _group_dict(db, group, viewer))


@router.get("/{group_id}")
def get_group(
    group_id: str,
    x_guest_token: Optional[str] = Header(None, alias="X-Guest-Token"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    try:
        gid = uuid.UUID(group_id)
    except ValueError:
        return standard_response(False, "Invalid group ID")
    group = db.query(EventGroup).filter(EventGroup.id == gid).first()
    if not group:
        return standard_response(False, "Group not found")
    event = db.query(Event).filter(Event.id == group.event_id).first()
    if event:
        _maybe_auto_close(db, group, event)
    viewer = _ensure_entitled_viewer(db, group, event, current_user, x_guest_token)
    if not viewer:
        return standard_response(False, "You are not a member of this group")
    return standard_response(True, "Group fetched", _group_dict(db, group, viewer))


@router.put("/{group_id}")
def update_group(
    group_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        gid = uuid.UUID(group_id)
    except ValueError:
        return standard_response(False, "Invalid group ID")
    group = db.query(EventGroup).filter(EventGroup.id == gid).first()
    if not group:
        return standard_response(False, "Group not found")
    member = db.query(EventGroupMember).filter(
        EventGroupMember.group_id == gid,
        EventGroupMember.user_id == current_user.id,
    ).first()
    if not member or not member.is_admin:
        return standard_response(False, "Only group admins can edit the group")
    if "name" in body and body["name"]:
        group.name = body["name"].strip()
    if "description" in body:
        group.description = (body["description"] or "").strip() or None
    if "image_url" in body:
        group.image_url = (body["image_url"] or "").strip() or None
    if "is_closed" in body:
        # Admin can re-open even after the auto-close
        group.is_closed = bool(body["is_closed"])
        group.closed_at = datetime.utcnow() if group.is_closed else None
    db.commit()
    return standard_response(True, "Group updated",
                             _group_dict(db, group, member))


# ══════════════════════════════════════════════
# MEMBERS  &  RESYNC
# ══════════════════════════════════════════════

@router.get("/{group_id}/members")
def list_members(
    group_id: str,
    x_guest_token: Optional[str] = Header(None, alias="X-Guest-Token"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    try:
        gid = uuid.UUID(group_id)
    except ValueError:
        return standard_response(False, "Invalid group ID")
    viewer = _resolve_member(db, gid, current_user, x_guest_token)
    if not viewer:
        return standard_response(False, "Not a member")
    members = db.query(EventGroupMember).options(
        joinedload(EventGroupMember.user),
    ).filter(EventGroupMember.group_id == gid).all()
    return standard_response(True, "Members fetched", {
        "members": [
            {
                **_member_dict(db, m),
                "is_me": bool(viewer and m.id == viewer.id),
            }
            for m in members
        ]
    })


@router.post("/{group_id}/sync-members")
def sync_members(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-run auto-add for organizer/committee/contributors. Idempotent."""
    try:
        gid = uuid.UUID(group_id)
    except ValueError:
        return standard_response(False, "Invalid group ID")
    group = db.query(EventGroup).filter(EventGroup.id == gid).first()
    if not group:
        return standard_response(False, "Group not found")
    member = db.query(EventGroupMember).filter(
        EventGroupMember.group_id == gid,
        EventGroupMember.user_id == current_user.id,
    ).first()
    if not member or not member.is_admin:
        return standard_response(False, "Only group admins can resync")
    event = db.query(Event).filter(Event.id == group.event_id).first()
    if event:
        _seed_members(db, group, event)
    return standard_response(True, "Members synced")


# ══════════════════════════════════════════════
# INVITE LINK (for non-Nuru contributors)
# ══════════════════════════════════════════════

@router.post("/{group_id}/invite-link")
def create_invite_link(
    group_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        gid = uuid.UUID(group_id)
    except ValueError:
        return standard_response(False, "Invalid group ID")
    member = db.query(EventGroupMember).filter(
        EventGroupMember.group_id == gid,
        EventGroupMember.user_id == current_user.id,
    ).first()
    if not member or not member.is_admin:
        return standard_response(False, "Only admins can create invite links")
    contributor_id = body.get("contributor_id")
    cid = None
    phone = (body.get("phone") or "").strip() or None
    name = (body.get("name") or "").strip() or None
    if contributor_id:
        try:
            cid = uuid.UUID(contributor_id)
        except ValueError:
            cid = None
        if cid:
            contributor = db.query(UserContributor).filter(UserContributor.id == cid).first()
            if contributor:
                phone = phone or contributor.phone
                name = name or contributor.name
    token = pysecrets.token_urlsafe(32)[:48]
    invite = EventGroupInviteToken(
        id=uuid.uuid4(),
        group_id=gid,
        contributor_id=cid,
        token=token,
        phone=phone,
        name=name,
        expires_at=datetime.utcnow() + timedelta(days=180),
    )
    db.add(invite)
    db.commit()
    return standard_response(True, "Invite link created", {
        "token": token,
        "phone": phone,
        "name": name,
        "expires_at": invite.expires_at.isoformat(),
    })


@router.get("/invites/{token}")
def preview_invite(token: str, db: Session = Depends(get_db)):
    """Public preview of an invite token (no auth)."""
    inv = db.query(EventGroupInviteToken).filter(EventGroupInviteToken.token == token).first()
    if not inv:
        return standard_response(False, "Invite link is invalid")
    if inv.expires_at and inv.expires_at < datetime.utcnow():
        return standard_response(False, "Invite link has expired")
    group = db.query(EventGroup).filter(EventGroup.id == inv.group_id).first()
    if not group:
        return standard_response(False, "Group no longer exists")
    event = db.query(Event).filter(Event.id == group.event_id).first()
    cover = group.image_url or (_resolve_event_cover(db, event) if event else None)
    return standard_response(True, "Invite preview", {
        "group": {
            "id": str(group.id),
            "name": group.name,
            "image_url": cover,
            "event_name": event.name if event else None,
            "event_start_date": event.start_date.isoformat() if event and event.start_date else None,
            "is_closed": group.is_closed,
        },
        "prefill": {"name": inv.name, "phone": inv.phone},
    })


@router.post("/invites/{token}/claim")
def claim_invite(
    token: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Claim an invite. If the caller is logged in, attach to their account.
    Otherwise, create a guest member and return a group-scoped JWT."""
    inv = db.query(EventGroupInviteToken).filter(EventGroupInviteToken.token == token).first()
    if not inv:
        return standard_response(False, "Invite link is invalid")
    if inv.expires_at and inv.expires_at < datetime.utcnow():
        return standard_response(False, "Invite link has expired")
    group = db.query(EventGroup).filter(EventGroup.id == inv.group_id).first()
    if not group:
        return standard_response(False, "Group no longer exists")

    name = (body.get("name") or inv.name or "").strip()
    phone = (body.get("phone") or inv.phone or "").strip()

    # Logged-in case: attach as a real user
    if current_user:
        existing = db.query(EventGroupMember).filter(
            EventGroupMember.group_id == group.id,
            EventGroupMember.user_id == current_user.id,
        ).first()
        if existing:
            inv.used_at = datetime.utcnow()
            db.commit()
            return standard_response(True, "Joined", {
                "group_id": str(group.id), "member_id": str(existing.id),
                "guest_token": None,
            })
        m = EventGroupMember(
            id=uuid.uuid4(), group_id=group.id, user_id=current_user.id,
            contributor_id=inv.contributor_id,
            role=GroupMemberRoleEnum.contributor,
        )
        db.add(m)
        inv.used_at = datetime.utcnow()
        db.commit()
        return standard_response(True, "Joined", {
            "group_id": str(group.id), "member_id": str(m.id), "guest_token": None,
        })

    # Guest path: requires name
    if not name:
        return standard_response(False, "Please enter your name to join")

    # Reuse existing guest member with the same phone (if any) so chat history persists
    member = None
    if phone:
        member = db.query(EventGroupMember).filter(
            EventGroupMember.group_id == group.id,
            EventGroupMember.guest_phone == phone,
            EventGroupMember.user_id.is_(None),
        ).first()
    if not member:
        member = EventGroupMember(
            id=uuid.uuid4(), group_id=group.id,
            guest_name=name, guest_phone=phone or None,
            contributor_id=inv.contributor_id,
            role=GroupMemberRoleEnum.guest,
        )
        db.add(member)
    else:
        member.guest_name = name
    inv.used_at = datetime.utcnow()
    db.commit()
    token_jwt = _create_guest_token(str(member.id), str(group.id))
    return standard_response(True, "Joined as guest", {
        "group_id": str(group.id),
        "member_id": str(member.id),
        "guest_token": token_jwt,
        "name": name,
    })


# ══════════════════════════════════════════════
# MESSAGES
# ══════════════════════════════════════════════

@router.get("/{group_id}/messages")
def list_messages(
    group_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    after: Optional[str] = Query(None, description="ISO datetime — return messages strictly after this"),
    x_guest_token: Optional[str] = Header(None, alias="X-Guest-Token"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    try:
        gid = uuid.UUID(group_id)
    except ValueError:
        return standard_response(False, "Invalid group ID")
    viewer = _resolve_member(db, gid, current_user, x_guest_token)
    if not viewer:
        return standard_response(False, "Not a member")

    q = db.query(EventGroupMessage).options(
        joinedload(EventGroupMessage.reactions),
    ).filter(
        EventGroupMessage.group_id == gid,
        EventGroupMessage.is_deleted == False,
    )

    if after:
        try:
            dt = datetime.fromisoformat(after.replace("Z", "+00:00")).replace(tzinfo=None)
            q = q.filter(EventGroupMessage.created_at > dt)
            messages = q.order_by(EventGroupMessage.created_at.asc()).limit(limit).all()
        except ValueError:
            return standard_response(False, "Invalid 'after' timestamp")
    else:
        messages = q.order_by(EventGroupMessage.created_at.desc()) \
                     .offset((page - 1) * limit).limit(limit).all()
        messages = list(reversed(messages))

    # Resolve all senders in one go
    sender_ids = {m.sender_member_id for m in messages if m.sender_member_id}
    members = db.query(EventGroupMember).options(
        joinedload(EventGroupMember.user),
    ).filter(EventGroupMember.id.in_(sender_ids)).all() if sender_ids else []
    members_by_id = {m.id: _member_dict(db, m) for m in members}
    return standard_response(True, "Messages fetched", {
        "messages": [_message_dict(db, m, members_by_id) for m in messages],
    })


@router.post("/{group_id}/messages")
def send_message(
    group_id: str,
    body: dict = Body(...),
    x_guest_token: Optional[str] = Header(None, alias="X-Guest-Token"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    try:
        gid = uuid.UUID(group_id)
    except ValueError:
        return standard_response(False, "Invalid group ID")
    group = db.query(EventGroup).filter(EventGroup.id == gid).first()
    if not group:
        return standard_response(False, "Group not found")
    if group.is_closed:
        return standard_response(False, "This group is closed")
    viewer = _resolve_member(db, gid, current_user, x_guest_token)
    if not viewer:
        return standard_response(False, "Not a member")

    content = (body.get("content") or "").strip() or None
    image_url = (body.get("image_url") or "").strip() or None
    reply_to_id = body.get("reply_to_id")
    rid = None
    if reply_to_id:
        try:
            rid = uuid.UUID(reply_to_id)
        except ValueError:
            rid = None
    msg_type = GroupMessageTypeEnum.image if image_url else GroupMessageTypeEnum.text
    if not content and not image_url:
        return standard_response(False, "Message content is required")

    msg = EventGroupMessage(
        id=uuid.uuid4(),
        group_id=gid,
        sender_member_id=viewer.id,
        message_type=msg_type,
        content=content,
        image_url=image_url,
        reply_to_id=rid,
    )
    db.add(msg)
    viewer.last_read_at = datetime.utcnow()
    db.commit()
    sender = _member_dict(db, viewer)
    return standard_response(True, "Sent",
                             _message_dict(db, msg, {viewer.id: sender}))


@router.delete("/{group_id}/messages/{message_id}")
def delete_message(
    group_id: str,
    message_id: str,
    x_guest_token: Optional[str] = Header(None, alias="X-Guest-Token"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    try:
        gid = uuid.UUID(group_id)
        mid = uuid.UUID(message_id)
    except ValueError:
        return standard_response(False, "Invalid ID")
    viewer = _resolve_member(db, gid, current_user, x_guest_token)
    if not viewer:
        return standard_response(False, "Not a member")
    msg = db.query(EventGroupMessage).filter(
        EventGroupMessage.id == mid, EventGroupMessage.group_id == gid,
    ).first()
    if not msg:
        return standard_response(False, "Message not found")
    if msg.sender_member_id != viewer.id and not viewer.is_admin:
        return standard_response(False, "You can only delete your own messages")
    msg.is_deleted = True
    db.commit()
    return standard_response(True, "Deleted")


@router.post("/{group_id}/read")
def mark_read(
    group_id: str,
    x_guest_token: Optional[str] = Header(None, alias="X-Guest-Token"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    try:
        gid = uuid.UUID(group_id)
    except ValueError:
        return standard_response(False, "Invalid group ID")
    viewer = _resolve_member(db, gid, current_user, x_guest_token)
    if not viewer:
        return standard_response(False, "Not a member")
    viewer.last_read_at = datetime.utcnow()
    db.commit()
    return standard_response(True, "Read")


# ══════════════════════════════════════════════
# REACTIONS
# ══════════════════════════════════════════════

@router.post("/{group_id}/messages/{message_id}/reactions")
def add_reaction(
    group_id: str,
    message_id: str,
    body: dict = Body(...),
    x_guest_token: Optional[str] = Header(None, alias="X-Guest-Token"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Toggle a reaction with minimal DB round-trips.

    Optimizations vs the previous implementation:
      1. We do NOT re-fetch the User — `current_user` from the dependency is
         already hydrated; we only need its `id`.
      2. Membership is resolved with a single SELECT that returns ONLY the
         member id (no full ORM hydration of EventGroupMember columns).
      3. The "check then insert" pattern is replaced with a single
         INSERT ... ON CONFLICT DO NOTHING. If the row already existed the
         insert returns 0 rows, and we then issue a single DELETE to toggle off.
      4. All operations run inside one transaction (one commit), so the route
         performs at most 2 statements when adding (membership + upsert) and
         3 when removing (membership + upsert returning 0 + delete).

    Indexes required (covered by uq_message_member_emoji + uq_group_user):
      - event_group_members(group_id, user_id)              [unique]
      - event_group_message_reactions(message_id, member_id, emoji) [unique]
    """
    try:
        gid = uuid.UUID(group_id)
        mid = uuid.UUID(message_id)
    except ValueError:
        return standard_response(False, "Invalid ID")

    emoji = (body.get("emoji") or "").strip()
    if not emoji or len(emoji) > 16:
        return standard_response(False, "Invalid emoji")

    # ── 1. Resolve member id with a single lightweight SELECT.
    member_id: Optional[uuid.UUID] = None
    if current_user is not None:
        member_id = db.query(EventGroupMember.id).filter(
            EventGroupMember.group_id == gid,
            EventGroupMember.user_id == current_user.id,
        ).scalar()
    if member_id is None and x_guest_token:
        # Guest path — token already encodes member_id; verify it matches the group.
        payload = _decode_guest_token(x_guest_token)
        if payload and payload.get("group_id") == str(gid):
            try:
                candidate = uuid.UUID(payload["member_id"])
            except (ValueError, KeyError, TypeError):
                candidate = None
            if candidate is not None:
                # exists() avoids hydrating the row.
                ok = db.query(
                    exists().where(
                        and_(
                            EventGroupMember.id == candidate,
                            EventGroupMember.group_id == gid,
                        )
                    )
                ).scalar()
                if ok:
                    member_id = candidate
    if member_id is None:
        return standard_response(False, "Not a member")

    # ── 2. UPSERT — insert if absent, no-op if it already exists.
    stmt = (
        pg_insert(EventGroupMessageReaction)
        .values(message_id=mid, member_id=member_id, emoji=emoji)
        .on_conflict_do_nothing(
            index_elements=["message_id", "member_id", "emoji"]
        )
    )
    result = db.execute(stmt)
    if result.rowcount == 0:
        # Already existed → toggle off with a targeted DELETE.
        db.query(EventGroupMessageReaction).filter(
            EventGroupMessageReaction.message_id == mid,
            EventGroupMessageReaction.member_id == member_id,
            EventGroupMessageReaction.emoji == emoji,
        ).delete(synchronize_session=False)
        db.commit()
        return standard_response(True, "Removed", {"toggled": "off", "emoji": emoji})

    db.commit()
    return standard_response(True, "Added", {"toggled": "on", "emoji": emoji})


# ══════════════════════════════════════════════
# SCOREBOARD — premium contributor view
# ══════════════════════════════════════════════

@router.get("/{group_id}/scoreboard")
def scoreboard(
    group_id: str,
    x_guest_token: Optional[str] = Header(None, alias="X-Guest-Token"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    try:
        gid = uuid.UUID(group_id)
    except ValueError:
        return standard_response(False, "Invalid group ID")
    viewer = _resolve_member(db, gid, current_user, x_guest_token)
    if not viewer:
        return standard_response(False, "Not a member")
    group = db.query(EventGroup).filter(EventGroup.id == gid).first()
    if not group:
        return standard_response(False, "Group not found")
    event = db.query(Event).filter(Event.id == group.event_id).first()
    if not event:
        return standard_response(False, "Event not found")

    currency = "TZS"
    if event.currency_id:
        cur = db.query(Currency).filter(Currency.id == event.currency_id).first()
        if cur:
            currency = cur.code.strip()

    ecs = db.query(EventContributor).options(
        joinedload(EventContributor.contributor),
        joinedload(EventContributor.contributions),
    ).filter(EventContributor.event_id == event.id).all()

    rows = []
    total_pledged = 0.0
    total_paid = 0.0
    for ec in ecs:
        contributor = ec.contributor
        if not contributor:
            continue
        pledged = float(ec.pledge_amount or 0)
        paid = sum(
            float(c.amount or 0) for c in ec.contributions
            if c.confirmation_status is None or c.confirmation_status == ContributionStatusEnum.confirmed
        )
        balance = max(0, pledged - paid)
        if pledged > 0 and paid >= pledged:
            status = "completed"
        elif paid > 0 and paid < pledged:
            status = "in_progress"
        elif pledged > 0:
            status = "pending"
        else:
            status = "no_target"
        avatar = None
        if contributor.contributor_user_id:
            avatar = _user_avatar(db, contributor.contributor_user_id)
        rows.append({
            "member_id": str(contributor.id),
            "contributor_id": str(contributor.id),
            "display_name": contributor.name,
            "name": contributor.name,
            "phone": contributor.phone,
            "avatar_url": avatar,
            "avatar": avatar,
            "is_nuru_user": bool(contributor.contributor_user_id),
            "pledged": pledged,
            "pledge": pledged,
            "paid": paid,
            "balance": balance,
            "progress": (paid / pledged) if pledged > 0 else (1.0 if paid > 0 else 0.0),
            "status": status,
            "last_payment_at": max(
                (c.contributed_at or c.created_at for c in ec.contributions if c.contributed_at or c.created_at),
                default=None,
            ),
        })
        total_pledged += pledged
        total_paid += paid

    status_order = {"completed": 0, "in_progress": 1, "pending": 2, "no_target": 3}
    rows.sort(key=lambda r: (status_order.get(r["status"], 9), -r["paid"], r["display_name"] or ""))
    for idx, r in enumerate(rows, start=1):
        r["rank"] = idx
        if r["last_payment_at"]:
            r["last_payment_at"] = r["last_payment_at"].isoformat()

    outstanding = max(0, total_pledged - total_paid)
    collection_rate = ((total_paid / total_pledged) * 100) if total_pledged > 0 else 0.0
    summary = {
        "total_pledged": total_pledged,
        "total_paid": total_paid,
        "outstanding": outstanding,
        "collection_rate": collection_rate,
        "contributors": len(rows),
        "budget": float(event.budget or 0),
        "currency": currency,
    }

    return standard_response(True, "Scoreboard", {
        "currency": currency,
        "summary": summary,
        "totals": {
            "pledge": total_pledged,
            "paid": total_paid,
            "balance": outstanding,
            "progress": collection_rate / 100,
            "contributor_count": len(rows),
            "completed_count": sum(1 for r in rows if r["status"] == "completed"),
        },
        "rows": rows,
        "event": {
            "id": str(event.id),
            "name": event.name,
            "target": float(event.budget or 0),
        },
    })


# ──────────────────────────────────────────────
# SYSTEM MESSAGE HOOK — called from contributions route
# ──────────────────────────────────────────────

def post_payment_system_message(
    db: Session,
    event_id: uuid.UUID,
    contributor_name: str,
    amount: float,
    pledge: float,
    paid: float,
    currency: str,
):
    """Posts '🎉 X paid Y · Pledge · Paid · Balance' into the event group, if any."""
    group = db.query(EventGroup).filter(EventGroup.event_id == event_id).first()
    if not group:
        return
    balance = max(0, pledge - paid)
    text = (f"🎉 {contributor_name} paid {currency} {amount:,.0f}"
            f" · Pledge {currency} {pledge:,.0f}"
            f" · Paid {currency} {paid:,.0f}"
            f" · Balance {currency} {balance:,.0f}")
    msg = EventGroupMessage(
        id=uuid.uuid4(),
        group_id=group.id,
        sender_member_id=None,
        message_type=GroupMessageTypeEnum.system,
        content=text,
        metadata_json={
            "kind": "payment",
            "contributor_name": contributor_name,
            "amount": amount,
            "pledge": pledge,
            "paid": paid,
            "balance": balance,
            "currency": currency,
        },
    )
    db.add(msg)
    db.commit()
