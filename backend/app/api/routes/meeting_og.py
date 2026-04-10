"""
Public Meeting OG Meta endpoint - no auth required.
GET /meetings/room/{room_id}
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from models.meetings import EventMeeting
from models.events import Event
from models.users import User

router = APIRouter(prefix="/meetings", tags=["meeting-og"])


@router.get("/room/{room_id}")
def get_meeting_by_room(room_id: str, db: Session = Depends(get_db)):
    """Public endpoint: fetch meeting details by room_id for OpenGraph previews."""
    meeting = db.query(EventMeeting).filter(EventMeeting.room_id == room_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")

    event = db.query(Event).filter(Event.id == meeting.event_id).first()
    creator = db.query(User).filter(User.id == meeting.created_by).first()

    return {
        "success": True,
        "data": {
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
