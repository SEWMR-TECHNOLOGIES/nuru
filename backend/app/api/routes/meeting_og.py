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
            "title": meeting.title,
            "description": meeting.description,
            "scheduled_at": meeting.scheduled_at.isoformat() if meeting.scheduled_at else None,
            "duration_minutes": meeting.duration_minutes,
            "status": meeting.status.value if meeting.status else "scheduled",
            "room_id": meeting.room_id,
            "participant_count": len(meeting.participants),
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

    participations = db.query(EventMeetingParticipant).filter(
        EventMeetingParticipant.user_id == user_id
    ).all()

    meeting_ids = [str(p.meeting_id) for p in participations]
    if not meeting_ids:
        return {"success": True, "data": []}

    meetings = db.query(EventMeeting).filter(
        EventMeeting.id.in_(meeting_ids)
    ).order_by(EventMeeting.scheduled_at.desc()).all()

    result = []
    for meeting in meetings:
        # Auto-fix stale in_progress meetings
        from models.enums import MeetingStatusEnum
        if meeting.status == MeetingStatusEnum.in_progress:
            try:
                duration = int(meeting.duration_minutes or 60)
                end_time = meeting.scheduled_at + timedelta(minutes=duration + 30)
                if datetime.utcnow() > end_time:
                    meeting.status = MeetingStatusEnum.ended
                    meeting.ended_at = end_time
                    db.commit()
            except Exception:
                pass

        event = db.query(Event).filter(Event.id == meeting.event_id).first()
        creator = db.query(User).filter(User.id == meeting.created_by).first()

        has_agenda = db.query(MeetingAgendaItem).filter(MeetingAgendaItem.meeting_id == meeting.id).count() > 0
        has_minutes = db.query(MeetingMinutes).filter(MeetingMinutes.meeting_id == meeting.id).first() is not None

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

        result.append({
            "id": str(meeting.id),
            "event_id": str(meeting.event_id),
            "event_name": event.name if event else None,
            "event_cover_image": getattr(event, 'cover_image', None) if event else None,
            "title": meeting.title,
            "description": meeting.description,
            "scheduled_at": meeting.scheduled_at.isoformat() if meeting.scheduled_at else None,
            "duration_minutes": meeting.duration_minutes,
            "room_id": meeting.room_id,
            "meeting_url": f"https://nuru.tz/meet/{meeting.room_id}",
            "status": meeting.status.value if meeting.status else "scheduled",
            "created_by": {
                "id": str(meeting.created_by),
                "name": f"{creator.first_name or ''} {creator.last_name or ''}".strip() if creator else "Unknown",
            },
            "participants": participants,
            "participant_count": len(participants),
            "has_agenda": has_agenda,
            "has_minutes": has_minutes,
            "ended_at": meeting.ended_at.isoformat() if meeting.ended_at else None,
            "created_at": meeting.created_at.isoformat() if meeting.created_at else None,
        })

    return {"success": True, "data": result}
