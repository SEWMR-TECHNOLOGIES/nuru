"""
Event Meetings API
Committee members and invited guests can schedule and join video meetings.
"""

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List

from core.database import get_db
from utils.auth import get_current_user
from models.meetings import EventMeeting, EventMeetingParticipant
from models.events import Event
from models.committees import EventCommitteeMember
from models.users import User
from models.enums import MeetingStatusEnum
from utils.whatsapp import wa_meeting_invitation
from utils.sms import sms_meeting_invitation
from utils.notify import notify_meeting_invitation

router = APIRouter(prefix="/events/{event_id}/meetings", tags=["meetings"])


# ── Schemas ──────────────────────────────────

class CreateMeetingRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    scheduled_at: datetime
    duration_minutes: Optional[str] = "60"
    participant_user_ids: Optional[List[str]] = []

class UpdateMeetingRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[str] = None

class AddParticipantsRequest(BaseModel):
    user_ids: List[str]


# ── Helpers ──────────────────────────────────

def _check_event_access(event_id: str, user_id: str, db: Session) -> Event:
    """Verify event exists and user has access (creator or committee member)."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")

    if str(event.organizer_id) == user_id:
        return event

    member = db.query(EventCommitteeMember).filter(
        EventCommitteeMember.event_id == event_id,
        EventCommitteeMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="You don't have access to this event.")
    return event


def _generate_room_id(event_id: str) -> str:
    """Generate a unique Jitsi room ID."""
    short_id = uuid.uuid4().hex[:8]
    return f"nuru-{event_id[:8]}-{short_id}"


def _notify_participants(meeting: EventMeeting, participants, event: Event, db: Session):
    """Send WhatsApp-first notifications to meeting participants."""
    for p in participants:
        user = db.query(User).filter(User.id == p.user_id).first()
        if not user:
            continue

        phone = getattr(user, 'phone', None) or getattr(user, 'phone_number', None)
        meeting_link = f"https://meet.jit.si/{meeting.room_id}"
        event_name = event.name

        # WhatsApp first, then SMS fallback
        wa_sent = False
        if phone:
            try:
                wa_meeting_invitation(phone, event_name, meeting.title, meeting.scheduled_at.strftime("%b %d, %Y at %I:%M %p"), meeting_link)
                wa_sent = True
            except Exception:
                pass

            if not wa_sent:
                try:
                    sms_meeting_invitation(phone, event_name, meeting.title, meeting.scheduled_at.strftime("%b %d, %Y at %I:%M %p"), meeting_link)
                except Exception:
                    pass

        # In-app notification always
        try:
            notify_meeting_invitation(str(p.user_id), event_name, meeting.title, str(meeting.id), db)
        except Exception:
            pass

        p.is_notified = True

    db.commit()


# ── Routes ───────────────────────────────────

@router.post("", status_code=201)
def create_meeting(event_id: str, body: CreateMeetingRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Schedule a new meeting for this event."""
    user_id = str(current_user.id)
    event = _check_event_access(event_id, user_id, db)

    room_id = _generate_room_id(event_id)

    meeting = EventMeeting(
        event_id=event_id,
        created_by=user_id,
        title=body.title,
        description=body.description,
        scheduled_at=body.scheduled_at,
        duration_minutes=body.duration_minutes or "60",
        room_id=room_id,
        status=MeetingStatusEnum.scheduled,
    )
    db.add(meeting)
    db.flush()

    # Add creator as participant
    creator_participant = EventMeetingParticipant(
        meeting_id=meeting.id,
        user_id=user_id,
        invited_by=user_id,
    )
    db.add(creator_participant)

    # Add requested participants
    new_participants = []
    for uid in (body.participant_user_ids or []):
        if uid == user_id:
            continue
        p = EventMeetingParticipant(
            meeting_id=meeting.id,
            user_id=uid,
            invited_by=user_id,
        )
        db.add(p)
        new_participants.append(p)

    db.commit()
    db.refresh(meeting)

    # Notify participants (WhatsApp-first)
    _notify_participants(meeting, new_participants, event, db)

    return {
        "success": True,
        "message": "Meeting scheduled. Invitations sent to participants.",
        "data": _serialize_meeting(meeting, db)
    }


@router.get("")
def list_meetings(event_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """List all meetings for this event."""
    user_id = str(current_user.id)
    _check_event_access(event_id, user_id, db)

    meetings = db.query(EventMeeting).filter(
        EventMeeting.event_id == event_id
    ).order_by(EventMeeting.scheduled_at.desc()).all()

    return {
        "success": True,
        "data": [_serialize_meeting(m, db) for m in meetings]
    }


@router.get("/{meeting_id}")
def get_meeting(event_id: str, meeting_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Get meeting details."""
    user_id = str(current_user.id)
    _check_event_access(event_id, user_id, db)

    meeting = db.query(EventMeeting).filter(
        EventMeeting.id == meeting_id,
        EventMeeting.event_id == event_id
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")

    return {"success": True, "data": _serialize_meeting(meeting, db)}


@router.put("/{meeting_id}")
def update_meeting(event_id: str, meeting_id: str, body: UpdateMeetingRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Update meeting details. Only the creator can update."""
    user_id = str(current_user.id)
    _check_event_access(event_id, user_id, db)

    meeting = db.query(EventMeeting).filter(
        EventMeeting.id == meeting_id,
        EventMeeting.event_id == event_id
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    if str(meeting.created_by) != user_id:
        raise HTTPException(status_code=403, detail="Only the meeting organizer can update this meeting.")

    if body.title is not None:
        meeting.title = body.title
    if body.description is not None:
        meeting.description = body.description
    if body.scheduled_at is not None:
        meeting.scheduled_at = body.scheduled_at
    if body.duration_minutes is not None:
        meeting.duration_minutes = body.duration_minutes

    db.commit()
    db.refresh(meeting)

    return {"success": True, "message": "Meeting updated.", "data": _serialize_meeting(meeting, db)}


@router.delete("/{meeting_id}")
def delete_meeting(event_id: str, meeting_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Cancel and delete a meeting."""
    user_id = str(current_user.id)
    event = _check_event_access(event_id, user_id, db)

    meeting = db.query(EventMeeting).filter(
        EventMeeting.id == meeting_id,
        EventMeeting.event_id == event_id
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")

    is_creator = str(event.organizer_id) == user_id
    is_meeting_creator = str(meeting.created_by) == user_id
    if not is_creator and not is_meeting_creator:
        raise HTTPException(status_code=403, detail="You don't have permission to cancel this meeting.")

    db.delete(meeting)
    db.commit()

    return {"success": True, "message": "Meeting cancelled."}


@router.post("/{meeting_id}/participants")
def add_participants(event_id: str, meeting_id: str, body: AddParticipantsRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Add participants to a meeting and notify them."""
    user_id = str(current_user.id)
    event = _check_event_access(event_id, user_id, db)

    meeting = db.query(EventMeeting).filter(
        EventMeeting.id == meeting_id,
        EventMeeting.event_id == event_id
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")

    existing_ids = {str(p.user_id) for p in meeting.participants}
    new_participants = []

    for uid in body.user_ids:
        if uid in existing_ids:
            continue
        p = EventMeetingParticipant(
            meeting_id=meeting.id,
            user_id=uid,
            invited_by=user_id,
        )
        db.add(p)
        new_participants.append(p)

    db.commit()

    _notify_participants(meeting, new_participants, event, db)

    return {
        "success": True,
        "message": f"{len(new_participants)} participant(s) added and notified.",
        "data": _serialize_meeting(meeting, db)
    }


@router.post("/{meeting_id}/join")
def join_meeting(event_id: str, meeting_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Record that a user has joined the meeting. Returns the room info."""
    user_id = str(current_user.id)
    _check_event_access(event_id, user_id, db)

    meeting = db.query(EventMeeting).filter(
        EventMeeting.id == meeting_id,
        EventMeeting.event_id == event_id
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")

    # Auto-add as participant if not already
    participant = db.query(EventMeetingParticipant).filter(
        EventMeetingParticipant.meeting_id == meeting_id,
        EventMeetingParticipant.user_id == user_id
    ).first()

    if not participant:
        participant = EventMeetingParticipant(
            meeting_id=meeting_id,
            user_id=user_id,
        )
        db.add(participant)

    participant.joined_at = datetime.utcnow()

    # Auto-start meeting if scheduled
    if meeting.status == MeetingStatusEnum.scheduled:
        meeting.status = MeetingStatusEnum.in_progress

    db.commit()

    return {
        "success": True,
        "data": {
            "room_id": meeting.room_id,
            "meeting_url": f"https://meet.jit.si/{meeting.room_id}",
            "title": meeting.title,
        }
    }


@router.post("/{meeting_id}/end")
def end_meeting(event_id: str, meeting_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """End a meeting. Only creator or event organizer can end it."""
    user_id = str(current_user.id)
    event = _check_event_access(event_id, user_id, db)

    meeting = db.query(EventMeeting).filter(
        EventMeeting.id == meeting_id,
        EventMeeting.event_id == event_id
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")

    is_creator = str(event.organizer_id) == user_id
    is_meeting_creator = str(meeting.created_by) == user_id
    if not is_creator and not is_meeting_creator:
        raise HTTPException(status_code=403, detail="Only the organizer can end this meeting.")

    meeting.status = MeetingStatusEnum.ended
    meeting.ended_at = datetime.utcnow()
    db.commit()

    return {"success": True, "message": "Meeting ended."}


# ── Serialization ────────────────────────────

def _serialize_meeting(meeting: EventMeeting, db: Session) -> dict:
    participants = []
    for p in meeting.participants:
        user = db.query(User).filter(User.id == p.user_id).first()
        participants.append({
            "id": str(p.id),
            "user_id": str(p.user_id),
            "name": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else "Unknown",
            "avatar_url": getattr(user, 'avatar_url', None) or getattr(getattr(user, 'profile', None), 'avatar_url', None) if user else None,
            "is_notified": p.is_notified,
            "joined_at": p.joined_at.isoformat() if p.joined_at else None,
        })

    creator = db.query(User).filter(User.id == meeting.created_by).first()

    return {
        "id": str(meeting.id),
        "event_id": str(meeting.event_id),
        "title": meeting.title,
        "description": meeting.description,
        "scheduled_at": meeting.scheduled_at.isoformat() if meeting.scheduled_at else None,
        "duration_minutes": meeting.duration_minutes,
        "room_id": meeting.room_id,
        "meeting_url": f"https://meet.jit.si/{meeting.room_id}",
        "status": meeting.status.value if meeting.status else "scheduled",
        "created_by": {
            "id": str(meeting.created_by),
            "name": f"{creator.first_name or ''} {creator.last_name or ''}".strip() if creator else "Unknown",
        },
        "participants": participants,
        "participant_count": len(participants),
        "ended_at": meeting.ended_at.isoformat() if meeting.ended_at else None,
        "created_at": meeting.created_at.isoformat() if meeting.created_at else None,
    }
