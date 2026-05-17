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
    """Get all meetings the current user is a participant of, across all events.

    Optimized: was O(N meetings * 4 + N * P participants) queries — now ~8 batched
    queries regardless of result size. Preserves response shape 1:1.
    """
    from collections import defaultdict
    from sqlalchemy import func as sa_func
    from models.enums import MeetingStatusEnum
    from models.users import UserProfile  # local import to avoid cycles

    user_id = current_user.id

    # 1) Meeting ids this user participates in (id-only, no row hydration).
    meeting_id_rows = db.query(EventMeetingParticipant.meeting_id).filter(
        EventMeetingParticipant.user_id == user_id
    ).all()
    meeting_ids = [r[0] for r in meeting_id_rows]
    if not meeting_ids:
        return {"success": True, "data": []}

    # 2) Load meetings with their participants pre-fetched in one round-trip.
    from sqlalchemy.orm import selectinload
    meetings = (
        db.query(EventMeeting)
        .options(selectinload(EventMeeting.participants))
        .filter(EventMeeting.id.in_(meeting_ids))
        .order_by(EventMeeting.scheduled_at.desc())
        .all()
    )

    # 3) Auto-close stale in_progress meetings — single bulk UPDATE instead of
    #    per-row queries + commits inside a read endpoint.
    now = datetime.utcnow()
    stale_ids = []
    for m in meetings:
        if m.status == MeetingStatusEnum.in_progress and m.scheduled_at:
            try:
                duration = int(m.duration_minutes or 60)
            except (TypeError, ValueError):
                duration = 60
            if now > m.scheduled_at + timedelta(minutes=duration + 30):
                stale_ids.append(m.id)
                m.status = MeetingStatusEnum.ended
                m.ended_at = m.scheduled_at + timedelta(minutes=duration + 30)
    if stale_ids:
        try:
            db.query(EventMeeting).filter(EventMeeting.id.in_(stale_ids)).update(
                {EventMeeting.status: MeetingStatusEnum.ended, EventMeeting.ended_at: now},
                synchronize_session=False,
            )
            db.commit()
        except Exception:
            db.rollback()

    # 4) Batch-load every related entity needed by the response.
    event_ids = list({m.event_id for m in meetings if m.event_id})
    creator_ids = {m.created_by for m in meetings if m.created_by}
    participant_user_ids = {p.user_id for m in meetings for p in m.participants if p.user_id}
    all_user_ids = list(creator_ids | participant_user_ids)

    events_map = (
        {e.id: e for e in db.query(Event).filter(Event.id.in_(event_ids)).all()}
        if event_ids else {}
    )
    users_map = (
        {u.id: u for u in db.query(User).filter(User.id.in_(all_user_ids)).all()}
        if all_user_ids else {}
    )
    profile_map = (
        {p.user_id: p for p in db.query(UserProfile).filter(
            UserProfile.user_id.in_(list(participant_user_ids))
        ).all()}
        if participant_user_ids else {}
    )

    # 5) Grouped existence checks for agenda / minutes — 2 queries total.
    agenda_meeting_ids = {
        r[0] for r in db.query(MeetingAgendaItem.meeting_id).filter(
            MeetingAgendaItem.meeting_id.in_(meeting_ids)
        ).distinct().all()
    }
    minutes_meeting_ids = {
        r[0] for r in db.query(MeetingMinutes.meeting_id).filter(
            MeetingMinutes.meeting_id.in_(meeting_ids)
        ).distinct().all()
    }

    def _user_name(u):
        if not u:
            return "Unknown"
        return f"{u.first_name or ''} {u.last_name or ''}".strip() or "Unknown"

    def _user_avatar(u):
        if not u:
            return None
        prof = profile_map.get(u.id)
        return (
            getattr(u, 'avatar_url', None)
            or (getattr(prof, 'profile_picture_url', None) if prof else None)
            or (getattr(prof, 'avatar_url', None) if prof else None)
        )

    result = []
    for meeting in meetings:
        event = events_map.get(meeting.event_id)
        creator = users_map.get(meeting.created_by)

        participants = []
        for p in meeting.participants:
            u = users_map.get(p.user_id)
            participants.append({
                "id": str(p.id),
                "user_id": str(p.user_id),
                "name": _user_name(u),
                "avatar_url": _user_avatar(u),
                "is_notified": p.is_notified,
                "joined_at": p.joined_at.isoformat() if p.joined_at else None,
            })

        result.append({
            "id": str(meeting.id),
            "event_id": str(meeting.event_id),
            "event_name": event.name if event else None,
            # NOTE: Event model field is cover_image_url (not cover_image). The
            # original code read a non-existent attribute and always returned None.
            "event_cover_image": getattr(event, 'cover_image_url', None) if event else None,
            "title": meeting.title,
            "description": meeting.description,
            "scheduled_at": meeting.scheduled_at.isoformat() if meeting.scheduled_at else None,
            "duration_minutes": meeting.duration_minutes,
            "room_id": meeting.room_id,
            "meeting_url": f"https://nuru.tz/meet/{meeting.room_id}",
            "status": meeting.status.value if meeting.status else "scheduled",
            "created_by": {
                "id": str(meeting.created_by),
                "name": _user_name(creator),
            },
            "participants": participants,
            "participant_count": len(participants),
            "has_agenda": meeting.id in agenda_meeting_ids,
            "has_minutes": meeting.id in minutes_meeting_ids,
            "ended_at": meeting.ended_at.isoformat() if meeting.ended_at else None,
            "created_at": meeting.created_at.isoformat() if meeting.created_at else None,
        })

    return {"success": True, "data": result}
