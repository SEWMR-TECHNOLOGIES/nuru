"""
Meeting Agenda & Minutes API
Manage agenda items and meeting minutes for event meetings.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List

from core.database import get_db
from utils.auth import get_current_user
from models.meetings import EventMeeting
from models.meeting_documents import MeetingAgendaItem, MeetingMinutes
from models.users import User
from api.routes.meetings import _check_event_access

router = APIRouter(prefix="/events/{event_id}/meetings/{meeting_id}", tags=["meeting-documents"])


# ── Schemas ──────────────────────────────────

class AgendaItemCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    presenter_user_id: Optional[str] = None
    sort_order: Optional[int] = 0

class AgendaItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    presenter_user_id: Optional[str] = None
    sort_order: Optional[int] = None
    is_completed: Optional[bool] = None

class AgendaReorder(BaseModel):
    item_ids: List[str]

class MinutesCreate(BaseModel):
    content: str = Field(..., min_length=1)
    summary: Optional[str] = None
    decisions: Optional[str] = None
    action_items: Optional[str] = None

class MinutesUpdate(BaseModel):
    content: Optional[str] = None
    summary: Optional[str] = None
    decisions: Optional[str] = None
    action_items: Optional[str] = None
    is_published: Optional[bool] = None


# ── Helpers ──────────────────────────────────

def _get_meeting(event_id: str, meeting_id: str, user_id: str, db: Session) -> EventMeeting:
    _check_event_access(event_id, user_id, db)
    meeting = db.query(EventMeeting).filter(
        EventMeeting.id == meeting_id,
        EventMeeting.event_id == event_id
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    return meeting


def _serialize_agenda_item(item: MeetingAgendaItem, db: Session) -> dict:
    presenter = None
    if item.presenter_user_id:
        user = db.query(User).filter(User.id == item.presenter_user_id).first()
        if user:
            presenter = {
                "id": str(user.id),
                "name": f"{user.first_name or ''} {user.last_name or ''}".strip(),
                "avatar_url": getattr(user, 'avatar_url', None) or getattr(getattr(user, 'profile', None), 'avatar_url', None),
            }

    creator = db.query(User).filter(User.id == item.created_by).first()

    return {
        "id": str(item.id),
        "meeting_id": str(item.meeting_id),
        "title": item.title,
        "description": item.description,
        "duration_minutes": item.duration_minutes,
        "presenter": presenter,
        "sort_order": item.sort_order,
        "is_completed": item.is_completed,
        "created_by": {
            "id": str(item.created_by),
            "name": f"{creator.first_name or ''} {creator.last_name or ''}".strip() if creator else "Unknown",
        },
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _serialize_minutes(minutes: MeetingMinutes, db: Session) -> dict:
    recorder = db.query(User).filter(User.id == minutes.recorded_by).first()
    return {
        "id": str(minutes.id),
        "meeting_id": str(minutes.meeting_id),
        "content": minutes.content,
        "summary": minutes.summary,
        "decisions": minutes.decisions,
        "action_items": minutes.action_items,
        "is_published": minutes.is_published,
        "recorded_by": {
            "id": str(minutes.recorded_by),
            "name": f"{recorder.first_name or ''} {recorder.last_name or ''}".strip() if recorder else "Unknown",
        },
        "created_at": minutes.created_at.isoformat() if minutes.created_at else None,
        "updated_at": minutes.updated_at.isoformat() if minutes.updated_at else None,
    }


# ── Agenda Routes ────────────────────────────

@router.get("/agenda")
def list_agenda(event_id: str, meeting_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _get_meeting(event_id, meeting_id, str(current_user.id), db)
    items = db.query(MeetingAgendaItem).filter(
        MeetingAgendaItem.meeting_id == meeting_id
    ).order_by(MeetingAgendaItem.sort_order).all()
    return {"success": True, "data": [_serialize_agenda_item(i, db) for i in items]}


@router.post("/agenda", status_code=201)
def create_agenda_item(event_id: str, meeting_id: str, body: AgendaItemCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    meeting = _get_meeting(event_id, meeting_id, str(current_user.id), db)

    # Get next sort_order
    max_order = db.query(MeetingAgendaItem).filter(
        MeetingAgendaItem.meeting_id == meeting_id
    ).count()

    item = MeetingAgendaItem(
        meeting_id=meeting_id,
        title=body.title,
        description=body.description,
        duration_minutes=body.duration_minutes,
        presenter_user_id=body.presenter_user_id,
        sort_order=body.sort_order if body.sort_order else max_order,
        created_by=str(current_user.id),
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return {"success": True, "message": "Agenda item added.", "data": _serialize_agenda_item(item, db)}


@router.put("/agenda/{item_id}")
def update_agenda_item(event_id: str, meeting_id: str, item_id: str, body: AgendaItemUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _get_meeting(event_id, meeting_id, str(current_user.id), db)
    item = db.query(MeetingAgendaItem).filter(
        MeetingAgendaItem.id == item_id,
        MeetingAgendaItem.meeting_id == meeting_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Agenda item not found.")

    if body.title is not None: item.title = body.title
    if body.description is not None: item.description = body.description
    if body.duration_minutes is not None: item.duration_minutes = body.duration_minutes
    if body.presenter_user_id is not None: item.presenter_user_id = body.presenter_user_id
    if body.sort_order is not None: item.sort_order = body.sort_order
    if body.is_completed is not None: item.is_completed = body.is_completed

    db.commit()
    db.refresh(item)
    return {"success": True, "message": "Agenda item updated.", "data": _serialize_agenda_item(item, db)}


@router.delete("/agenda/{item_id}")
def delete_agenda_item(event_id: str, meeting_id: str, item_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _get_meeting(event_id, meeting_id, str(current_user.id), db)
    item = db.query(MeetingAgendaItem).filter(
        MeetingAgendaItem.id == item_id,
        MeetingAgendaItem.meeting_id == meeting_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Agenda item not found.")

    db.delete(item)
    db.commit()
    return {"success": True, "message": "Agenda item removed."}


@router.post("/agenda/reorder")
def reorder_agenda(event_id: str, meeting_id: str, body: AgendaReorder, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _get_meeting(event_id, meeting_id, str(current_user.id), db)
    for idx, item_id in enumerate(body.item_ids):
        item = db.query(MeetingAgendaItem).filter(
            MeetingAgendaItem.id == item_id,
            MeetingAgendaItem.meeting_id == meeting_id
        ).first()
        if item:
            item.sort_order = idx
    db.commit()
    return {"success": True, "message": "Agenda reordered."}


# ── Minutes Routes ───────────────────────────

@router.get("/minutes")
def get_minutes(event_id: str, meeting_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _get_meeting(event_id, meeting_id, str(current_user.id), db)
    minutes = db.query(MeetingMinutes).filter(MeetingMinutes.meeting_id == meeting_id).first()
    if not minutes:
        return {"success": True, "data": None}
    return {"success": True, "data": _serialize_minutes(minutes, db)}


@router.post("/minutes", status_code=201)
def create_minutes(event_id: str, meeting_id: str, body: MinutesCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _get_meeting(event_id, meeting_id, str(current_user.id), db)

    existing = db.query(MeetingMinutes).filter(MeetingMinutes.meeting_id == meeting_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Minutes already exist for this meeting. Use PUT to update.")

    minutes = MeetingMinutes(
        meeting_id=meeting_id,
        content=body.content,
        summary=body.summary,
        decisions=body.decisions,
        action_items=body.action_items,
        recorded_by=str(current_user.id),
    )
    db.add(minutes)
    db.commit()
    db.refresh(minutes)

    return {"success": True, "message": "Meeting minutes saved.", "data": _serialize_minutes(minutes, db)}


@router.put("/minutes")
def update_minutes(event_id: str, meeting_id: str, body: MinutesUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _get_meeting(event_id, meeting_id, str(current_user.id), db)
    minutes = db.query(MeetingMinutes).filter(MeetingMinutes.meeting_id == meeting_id).first()
    if not minutes:
        raise HTTPException(status_code=404, detail="No minutes found. Create them first.")

    if body.content is not None: minutes.content = body.content
    if body.summary is not None: minutes.summary = body.summary
    if body.decisions is not None: minutes.decisions = body.decisions
    if body.action_items is not None: minutes.action_items = body.action_items
    if body.is_published is not None: minutes.is_published = body.is_published

    db.commit()
    db.refresh(minutes)
    return {"success": True, "message": "Minutes updated.", "data": _serialize_minutes(minutes, db)}


@router.delete("/minutes")
def delete_minutes(event_id: str, meeting_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _get_meeting(event_id, meeting_id, str(current_user.id), db)
    minutes = db.query(MeetingMinutes).filter(MeetingMinutes.meeting_id == meeting_id).first()
    if not minutes:
        raise HTTPException(status_code=404, detail="No minutes found.")
    db.delete(minutes)
    db.commit()
    return {"success": True, "message": "Minutes deleted."}


# ── Public OG endpoint ───────────────────────

@router.get("/og", dependencies=[])
def get_meeting_og(event_id: str, meeting_id: str, db: Session = Depends(get_db)):
    """Public endpoint for OpenGraph metadata. No auth required."""
    from models.events import Event

    meeting = db.query(EventMeeting).filter(
        EventMeeting.id == meeting_id,
        EventMeeting.event_id == event_id
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")

    event = db.query(Event).filter(Event.id == event_id).first()
    creator = db.query(User).filter(User.id == meeting.created_by).first()

    return {
        "title": meeting.title,
        "description": meeting.description or f"Meeting for {event.name}" if event else "",
        "scheduled_at": meeting.scheduled_at.isoformat() if meeting.scheduled_at else None,
        "event_name": event.name if event else None,
        "event_image": getattr(event, 'cover_image', None) if event else None,
        "creator_name": f"{creator.first_name or ''} {creator.last_name or ''}".strip() if creator else None,
        "status": meeting.status.value if meeting.status else "scheduled",
        "participant_count": len(meeting.participants),
    }
