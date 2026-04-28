"""Voice/Video call signaling and history routes (1:1).

Powers the WhatsApp-style calling flow:

    POST /calls/start        → caller starts a call → creates room + tokens
    POST /calls/{id}/answer  → callee accepts → returns LiveKit token
    POST /calls/{id}/decline → callee declines
    POST /calls/{id}/end     → either party ends/cancels
    GET  /calls/incoming     → polled by mobile app for ringing calls
    GET  /calls/conversation/{conv_id} → call history for chat bubbles
    POST /calls/devices      → register FCM/APNs token for VoIP push
    DELETE /calls/devices    → unregister token (logout)

Design notes
------------
* LiveKit credentials are reused from the meetings feature
  (``LIVEKIT_URL``/``LIVEKIT_API_KEY``/``LIVEKIT_API_SECRET``) so no new env
  vars are required.
* Signaling is pull-based via ``/calls/incoming`` (3s poll on the client).
  When VoIP push is configured later, the same payload will be delivered
  through FCM/APNs so the lock screen rings via CallKit; the client UX does
  not change.
* A call older than ``RING_TIMEOUT_SECONDS`` is auto-marked ``missed`` to
  prevent ghost ringing if the caller's network drops.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from core.database import get_db
from models import Conversation, User, UserProfile, CallLog, DeviceToken
from utils.auth import get_current_user
from utils.helpers import standard_response

router = APIRouter(prefix="/calls", tags=["Calls"])

# How long a call can ring before we treat it as missed. WhatsApp uses ~30s.
RING_TIMEOUT_SECONDS = 35


def _user_brief(db: Session, user_id) -> dict:
    """Lightweight {id, name, avatar} payload used in every call response."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        return {"id": str(user_id), "name": "Unknown", "avatar": None}
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    return {
        "id": str(u.id),
        "name": f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email or "User",
        "avatar": profile.profile_picture_url if profile else None,
    }


def _serialize_call(db: Session, call: CallLog, viewer_id) -> dict:
    """Build a chat-friendly call payload. Computes ``direction`` per viewer."""
    direction = "outgoing" if str(call.caller_id) == str(viewer_id) else "incoming"
    other_id = call.callee_id if direction == "outgoing" else call.caller_id
    return {
        "id": str(call.id),
        "conversation_id": str(call.conversation_id),
        "kind": call.kind,
        "status": call.status,
        "direction": direction,
        "room_name": call.room_name,
        "started_at": call.started_at.isoformat() if call.started_at else None,
        "answered_at": call.answered_at.isoformat() if call.answered_at else None,
        "ended_at": call.ended_at.isoformat() if call.ended_at else None,
        "duration_seconds": call.duration_seconds or 0,
        "end_reason": call.end_reason,
        "caller": _user_brief(db, call.caller_id),
        "callee": _user_brief(db, call.callee_id),
        "other_user": _user_brief(db, other_id),
    }


def _expire_stale_ringing(db: Session) -> None:
    """Mark calls that have been ringing too long as ``missed``.

    Cheap to run on every poll because the (callee_id, status) index makes
    the candidate set tiny in practice.
    """
    cutoff = datetime.utcnow() - timedelta(seconds=RING_TIMEOUT_SECONDS)
    stale = db.query(CallLog).filter(
        CallLog.status == "ringing",
        CallLog.started_at < cutoff,
    ).all()
    for c in stale:
        c.status = "missed"
        c.ended_at = datetime.utcnow()
        c.end_reason = "timeout"
    if stale:
        db.commit()


def _livekit_token_for(call: CallLog, user: User) -> dict:
    """Issue a LiveKit token for ``user`` to join ``call.room_name``.

    Reuses the helper already defined in ``meetings.py`` so we don't duplicate
    the JWT-signing logic.
    """
    from core.config import LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
    from api.routes.meetings import _create_livekit_token

    if not (LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET):
        raise HTTPException(status_code=500, detail="Calling is not configured.")

    name = f"{user.first_name or ''} {user.last_name or ''}".strip() or "User"
    token = _create_livekit_token(
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET,
        room_name=call.room_name,
        participant_identity=str(user.id),
        participant_name=name,
        is_host=False,
        ttl=3600,  # 1 hour is plenty for a call
    )
    return {"url": LIVEKIT_URL, "token": token, "room": call.room_name}


# ── Endpoints ───────────────────────────────────────────────────────────

@router.post("/start")
def start_call(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a 1:1 voice or video call inside an existing conversation.

    Body: ``{"conversation_id": "...", "kind": "voice"|"video"}``.

    Returns the LiveKit join token for the caller plus the new ``call`` row
    so the client can transition straight to the outgoing-call screen.
    """
    conv_id = payload.get("conversation_id")
    kind = (payload.get("kind") or "voice").lower()
    if kind not in ("voice", "video"):
        return standard_response(False, "Invalid call kind.", errors=["kind must be 'voice' or 'video'"])

    if not conv_id:
        return standard_response(False, "conversation_id is required.")

    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        return standard_response(False, "Conversation not found.")

    # Caller must be a participant in this conversation.
    if str(current_user.id) not in (str(conv.user_one_id), str(conv.user_two_id)):
        raise HTTPException(status_code=403, detail="Not a participant in this conversation.")

    callee_id = conv.user_two_id if str(conv.user_one_id) == str(current_user.id) else conv.user_one_id
    if not callee_id:
        return standard_response(False, "This conversation has no recipient.")

    # Reject if there's already a live call in this conversation (ringing/ongoing).
    live = db.query(CallLog).filter(
        CallLog.conversation_id == conv.id,
        CallLog.status.in_(("ringing", "ongoing")),
    ).first()
    if live:
        # Idempotent: if the caller is the same person, just return the existing call.
        if str(live.caller_id) == str(current_user.id):
            token = _livekit_token_for(live, current_user)
            return standard_response(True, "Call already in progress.", data={
                "call": _serialize_call(db, live, current_user.id), **token,
            })
        return standard_response(False, "There is already an active call in this conversation.")

    room_name = f"call-{uuid.uuid4().hex[:16]}"
    call = CallLog(
        conversation_id=conv.id,
        caller_id=current_user.id,
        callee_id=callee_id,
        room_name=room_name,
        kind=kind,
        status="ringing",
        started_at=datetime.utcnow(),
    )
    db.add(call)
    db.commit()
    db.refresh(call)

    token = _livekit_token_for(call, current_user)

    # Best-effort VoIP push — implementation lives in utils.notify_channels.
    # Wrapped in try/except so a missing FCM/APNs config never blocks the call.
    try:
        from utils.notify_channels import send_voip_push  # type: ignore
        send_voip_push(
            db=db,
            user_id=callee_id,
            payload={
                "type": "incoming_call",
                "call_id": str(call.id),
                "room_name": call.room_name,
                "kind": call.kind,
                "caller": _user_brief(db, current_user.id),
                "conversation_id": str(conv.id),
            },
        )
    except Exception:
        pass

    return standard_response(True, "Call started.", data={
        "call": _serialize_call(db, call, current_user.id),
        **token,
    })


@router.post("/{call_id}/answer")
def answer_call(
    call_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Callee accepts the call and gets their LiveKit join token."""
    call = db.query(CallLog).filter(CallLog.id == call_id).first()
    if not call:
        return standard_response(False, "Call not found.")
    if str(call.callee_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not the callee.")
    if call.status not in ("ringing", "ongoing"):
        return standard_response(False, f"Call cannot be answered (status: {call.status}).")

    if call.status == "ringing":
        call.status = "ongoing"
        call.answered_at = datetime.utcnow()
        db.commit()
        db.refresh(call)

    token = _livekit_token_for(call, current_user)
    return standard_response(True, "Joined call.", data={
        "call": _serialize_call(db, call, current_user.id), **token,
    })


@router.post("/{call_id}/decline")
def decline_call(
    call_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Callee declines a ringing call."""
    call = db.query(CallLog).filter(CallLog.id == call_id).first()
    if not call:
        return standard_response(False, "Call not found.")
    if str(call.callee_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not the callee.")
    if call.status != "ringing":
        return standard_response(False, f"Call cannot be declined (status: {call.status}).")

    call.status = "declined"
    call.ended_at = datetime.utcnow()
    call.end_reason = "declined_by_callee"
    db.commit()
    db.refresh(call)
    return standard_response(True, "Call declined.", data=_serialize_call(db, call, current_user.id))


@router.post("/{call_id}/end")
def end_call(
    call_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Hang up. Either participant may call this.

    If the call was still ringing and the caller hangs up first → ``missed``.
    Otherwise → ``ended`` and we compute the final duration.
    """
    call = db.query(CallLog).filter(CallLog.id == call_id).first()
    if not call:
        return standard_response(False, "Call not found.")
    if str(current_user.id) not in (str(call.caller_id), str(call.callee_id)):
        raise HTTPException(status_code=403, detail="Not a participant in this call.")

    now = datetime.utcnow()
    if call.status == "ringing":
        # Caller cancelled before pickup → missed for the callee.
        if str(current_user.id) == str(call.caller_id):
            call.status = "missed"
            call.end_reason = "cancelled_by_caller"
        else:
            call.status = "declined"
            call.end_reason = "declined_by_callee"
        call.ended_at = now
    elif call.status == "ongoing":
        call.status = "ended"
        call.ended_at = now
        call.end_reason = "hangup"
        if call.answered_at:
            call.duration_seconds = max(0, int((now - call.answered_at).total_seconds()))
    # If already ended/declined/missed, this call is a no-op (idempotent).

    db.commit()
    db.refresh(call)
    return standard_response(True, "Call ended.", data=_serialize_call(db, call, current_user.id))


@router.get("/incoming")
def get_incoming(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Polled every few seconds by the mobile app to detect a ringing call.

    Returns the *single* most recent ringing call addressed to the user, or
    ``null`` if none. This endpoint also opportunistically expires stale
    ringing calls so the UI never shows a phantom incoming screen.
    """
    _expire_stale_ringing(db)

    call = (
        db.query(CallLog)
        .filter(CallLog.callee_id == current_user.id, CallLog.status == "ringing")
        .order_by(CallLog.started_at.desc())
        .first()
    )
    if not call:
        return standard_response(True, "No incoming call.", data=None)
    return standard_response(True, "Incoming call.", data=_serialize_call(db, call, current_user.id))


@router.get("/conversation/{conversation_id}")
def list_conversation_calls(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recent calls in a conversation — used to render in-thread call bubbles."""
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        return standard_response(False, "Conversation not found.")
    if str(current_user.id) not in (str(conv.user_one_id), str(conv.user_two_id)):
        raise HTTPException(status_code=403, detail="Not a participant.")

    calls = (
        db.query(CallLog)
        .filter(CallLog.conversation_id == conv.id)
        .order_by(CallLog.started_at.desc())
        .limit(50)
        .all()
    )
    return standard_response(True, "OK", data=[_serialize_call(db, c, current_user.id) for c in calls])


# ── Device token registration (for VoIP push / CallKit later) ──────────

@router.post("/devices")
def register_device(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register or refresh an FCM/APNs/PushKit token for the current user.

    Body: ``{"platform": "ios"|"android", "token": "...", "kind":
    "fcm"|"voip", "app_version": "1.0.0"}``. Idempotent on (platform, token).
    """
    platform = (payload.get("platform") or "").lower()
    token = (payload.get("token") or "").strip()
    kind = (payload.get("kind") or "fcm").lower()
    app_version = payload.get("app_version")

    if platform not in ("ios", "android"):
        return standard_response(False, "platform must be 'ios' or 'android'")
    if not token:
        return standard_response(False, "token is required")
    if kind not in ("fcm", "voip"):
        kind = "fcm"

    existing = db.query(DeviceToken).filter(
        DeviceToken.platform == platform, DeviceToken.token == token
    ).first()
    if existing:
        existing.user_id = current_user.id  # re-bind if device changed accounts
        existing.kind = kind
        existing.app_version = app_version
        existing.updated_at = datetime.utcnow()
    else:
        db.add(DeviceToken(
            user_id=current_user.id,
            platform=platform,
            token=token,
            kind=kind,
            app_version=app_version,
        ))
    db.commit()
    return standard_response(True, "Device registered.")


@router.delete("/devices")
def unregister_device(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a token (typically called on logout)."""
    platform = (payload.get("platform") or "").lower()
    token = (payload.get("token") or "").strip()
    if not (platform and token):
        return standard_response(False, "platform and token are required")
    db.query(DeviceToken).filter(
        DeviceToken.platform == platform,
        DeviceToken.token == token,
        DeviceToken.user_id == current_user.id,
    ).delete()
    db.commit()
    return standard_response(True, "Device unregistered.")
