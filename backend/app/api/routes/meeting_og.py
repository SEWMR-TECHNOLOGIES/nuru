"""
Public Meeting endpoints and user's meetings.
GET /meetings/room/{room_id}  - public OG meta
GET /meetings/my              - user's meetings (authenticated)
"""

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from utils.auth import get_current_user
from models.meetings import EventMeeting, EventMeetingParticipant
from models.meeting_documents import MeetingAgendaItem, MeetingMinutes
from models.events import Event
from models.users import User
from utils.batch_loaders import build_meeting_dicts

router = APIRouter(prefix="/meetings", tags=["meeting-og"])


@router.get("/room/{room_id}")
def get_meeting_by_room(room_id: str, db: Session = Depends(get_db)):
    """Public endpoint: fetch meeting details by room_id for OpenGraph previews and link resolution."""
    meeting = db.query(EventMeeting).filter(EventMeeting.room_id == room_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")

    event = db.query(Event).filter(Event.id == meeting.event_id).first()
    creator = db.query(User).filter(User.id == meeting.created_by).first()

    return {
        "success": True,
        "data": {
            "id": str(meeting.id),
            "event_id": str(meeting.event_id),
            "title": meeting.title,
            "description": meeting.description,
            "scheduled_at": meeting.scheduled_at.isoformat() if meeting.scheduled_at else None,
            "duration_minutes": meeting.duration_minutes,
            "status": meeting.status.value if meeting.status else "scheduled",
            "room_id": meeting.room_id,
            "participant_count": len(meeting.participants),
            "requires_auth": True,
            "event": {
                "id": str(event.id) if event else None,
                "name": event.name if event else None,
                "cover_image": getattr(event, 'cover_image', None) if event else None,
            },
            "creator": {
                "id": str(creator.id) if creator else None,
                "name": f"{creator.first_name or ''} {creator.last_name or ''}".strip() if creator else None,
            },
        }
    }


@router.get("/my")
def get_my_meetings(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Get all meetings the current user is a participant of, across all events."""
    user_id = str(current_user.id)

    # Single grouped query for participant→meeting ids
    meeting_ids = [
        r[0] for r in db.query(EventMeetingParticipant.meeting_id)
        .filter(EventMeetingParticipant.user_id == user_id).all()
    ]
    if not meeting_ids:
        return {"success": True, "data": []}

    meetings = (
        db.query(EventMeeting)
        .filter(EventMeeting.id.in_(meeting_ids))
        .order_by(EventMeeting.scheduled_at.desc())
        .all()
    )

    # Bulk dict build (handles participants, creator, agenda, minutes, pending requests
    # and stale-status auto-end in a single grouped query each)
    dicts = build_meeting_dicts(db, meetings)

    # Enrich with event_name + event_cover_image (one grouped query)
    event_ids = list({m.event_id for m in meetings if m.event_id})
    event_map = {
        e.id: e
        for e in db.query(Event).filter(Event.id.in_(event_ids)).all()
    } if event_ids else {}

    by_id = {d["id"]: d for d in dicts}
    for m in meetings:
        d = by_id.get(str(m.id))
        if not d:
            continue
        ev = event_map.get(m.event_id)
        d["event_name"] = ev.name if ev else None
        d["event_cover_image"] = getattr(ev, "cover_image", None) if ev else None

    return {"success": True, "data": dicts}
