# Support Routes - /support/...

import uuid
from datetime import datetime

import pytz
from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from sqlalchemy import or_

from core.database import get_db
from models import SupportTicket, SupportMessage, FAQ, LiveChatSession, LiveChatMessage, User
from utils.auth import get_current_user
from utils.helpers import standard_response, paginate

EAT = pytz.timezone("Africa/Nairobi")
router = APIRouter(prefix="/support", tags=["Support"])


# ──────────────────────────────────────────────
# SUPPORT TICKETS
# ──────────────────────────────────────────────
@router.get("/tickets")
def get_tickets(page: int = 1, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(SupportTicket).filter(SupportTicket.user_id == current_user.id).order_by(SupportTicket.created_at.desc())
    items, pagination = paginate(query, page, limit)
    data = [{"id": str(t.id), "subject": t.subject, "status": t.status, "priority": t.priority if hasattr(t, "priority") else "medium", "created_at": t.created_at.isoformat() if t.created_at else None, "updated_at": t.updated_at.isoformat() if t.updated_at else None} for t in items]
    return standard_response(True, "Tickets retrieved", data, pagination=pagination)


@router.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        tid = uuid.UUID(ticket_id)
    except ValueError:
        return standard_response(False, "Invalid ticket ID")

    ticket = db.query(SupportTicket).filter(SupportTicket.id == tid, SupportTicket.user_id == current_user.id).first()
    if not ticket:
        return standard_response(False, "Ticket not found")

    messages = db.query(SupportMessage).filter(SupportMessage.ticket_id == tid).order_by(SupportMessage.created_at.asc()).all()
    msgs = [{"id": str(m.id), "content": m.content, "sender": m.sender_type if hasattr(m, "sender_type") else "user", "created_at": m.created_at.isoformat() if m.created_at else None} for m in messages]

    return standard_response(True, "Ticket retrieved", {"id": str(ticket.id), "subject": ticket.subject, "status": ticket.status, "messages": msgs, "created_at": ticket.created_at.isoformat() if ticket.created_at else None})


@router.post("/tickets")
def create_ticket(body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    subject = body.get("subject", "").strip()
    message = body.get("message", "").strip()
    if not subject:
        return standard_response(False, "Subject is required")
    if not message:
        return standard_response(False, "Message is required")

    now = datetime.now(EAT)
    ticket = SupportTicket(id=uuid.uuid4(), user_id=current_user.id, subject=subject, status="open", created_at=now, updated_at=now)
    db.add(ticket)
    db.flush()

    msg = SupportMessage(id=uuid.uuid4(), ticket_id=ticket.id, content=message, created_at=now)
    if hasattr(msg, "sender_type"):
        msg.sender_type = "user"
    db.add(msg)
    db.commit()

    return standard_response(True, "Ticket created successfully", {"id": str(ticket.id), "subject": subject})


@router.post("/tickets/{ticket_id}/messages")
def reply_to_ticket(ticket_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        tid = uuid.UUID(ticket_id)
    except ValueError:
        return standard_response(False, "Invalid ticket ID")

    ticket = db.query(SupportTicket).filter(SupportTicket.id == tid, SupportTicket.user_id == current_user.id).first()
    if not ticket:
        return standard_response(False, "Ticket not found")

    content = body.get("message", "").strip()
    if not content:
        return standard_response(False, "Message is required")

    now = datetime.now(EAT)
    msg = SupportMessage(id=uuid.uuid4(), ticket_id=tid, content=content, created_at=now)
    if hasattr(msg, "sender_type"):
        msg.sender_type = "user"
    db.add(msg)
    ticket.updated_at = now
    db.commit()

    return standard_response(True, "Reply sent successfully")


@router.put("/tickets/{ticket_id}/close")
def close_ticket(ticket_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        tid = uuid.UUID(ticket_id)
    except ValueError:
        return standard_response(False, "Invalid ticket ID")
    ticket = db.query(SupportTicket).filter(SupportTicket.id == tid, SupportTicket.user_id == current_user.id).first()
    if not ticket:
        return standard_response(False, "Ticket not found")
    ticket.status = "closed"
    ticket.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Ticket closed")


@router.put("/tickets/{ticket_id}/reopen")
def reopen_ticket(ticket_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        tid = uuid.UUID(ticket_id)
    except ValueError:
        return standard_response(False, "Invalid ticket ID")
    ticket = db.query(SupportTicket).filter(SupportTicket.id == tid, SupportTicket.user_id == current_user.id).first()
    if not ticket:
        return standard_response(False, "Ticket not found")
    ticket.status = "open"
    ticket.updated_at = datetime.now(EAT)
    db.commit()
    return standard_response(True, "Ticket reopened")


# ──────────────────────────────────────────────
# FAQs
# ──────────────────────────────────────────────
@router.get("/faqs/categories")
def get_faq_categories(db: Session = Depends(get_db)):
    faqs = db.query(FAQ).filter(FAQ.is_active == True).all()
    categories = list(set(f.category for f in faqs if f.category))
    return standard_response(True, "FAQ categories retrieved", categories)


@router.get("/faqs")
def get_faqs(category: str = None, q: str = None, db: Session = Depends(get_db)):
    query = db.query(FAQ).filter(FAQ.is_active == True)
    if category:
        query = query.filter(FAQ.category == category)
    if q:
        search = f"%{q}%"
        query = query.filter(or_(FAQ.question.ilike(search), FAQ.answer.ilike(search)))
    faqs = query.order_by(FAQ.display_order.asc()).all()
    return standard_response(True, "FAQs retrieved", [{"id": str(f.id), "question": f.question, "answer": f.answer, "category": f.category, "helpful_count": f.helpful_count if hasattr(f, "helpful_count") else 0} for f in faqs])


@router.post("/faqs/{faq_id}/helpful")
def mark_faq_helpful(faq_id: str, body: dict = Body(...), db: Session = Depends(get_db)):
    try:
        fid = uuid.UUID(faq_id)
    except ValueError:
        return standard_response(False, "Invalid FAQ ID")
    faq = db.query(FAQ).filter(FAQ.id == fid).first()
    if faq and hasattr(faq, "helpful_count"):
        if body.get("helpful", True):
            faq.helpful_count = (faq.helpful_count or 0) + 1
        else:
            faq.not_helpful_count = (faq.not_helpful_count or 0) + 1
        db.commit()
    return standard_response(True, "Feedback recorded")


# ──────────────────────────────────────────────
# LIVE CHAT
# ──────────────────────────────────────────────
@router.get("/chat/status")
def get_chat_status(db: Session = Depends(get_db)):
    return standard_response(True, "Chat status", {"available": True, "estimated_wait": "2 minutes"})


@router.post("/chat/start")
def start_chat(body: dict = Body(default={}), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.now(EAT)
    session = LiveChatSession(id=uuid.uuid4(), user_id=current_user.id, status="active", started_at=now, created_at=now)
    db.add(session)
    db.commit()
    return standard_response(True, "Chat session started", {"chat_id": str(session.id)})


@router.post("/chat/{chat_id}/end")
def end_chat(chat_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(chat_id)
    except ValueError:
        return standard_response(False, "Invalid chat ID")
    session = db.query(LiveChatSession).filter(LiveChatSession.id == cid).first()
    if session:
        session.status = "ended"
        session.ended_at = datetime.now(EAT)
        db.commit()
    return standard_response(True, "Chat session ended")


@router.post("/chat/{chat_id}/message")
def send_chat_message(chat_id: str, body: dict = Body(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(chat_id)
    except ValueError:
        return standard_response(False, "Invalid chat ID")
    session = db.query(LiveChatSession).filter(LiveChatSession.id == cid, LiveChatSession.user_id == current_user.id).first()
    if not session:
        return standard_response(False, "Chat session not found")
    if session.status == "ended":
        return standard_response(False, "Chat session has ended")
    content = body.get("content", "").strip()
    if not content:
        return standard_response(False, "Message content is required")
    now = datetime.now(EAT)
    msg = LiveChatMessage(
        id=uuid.uuid4(),
        session_id=cid,
        sender_id=current_user.id,
        is_agent=False,
        is_system=False,
        message_text=content,
        created_at=now,
    )
    db.add(msg)
    db.commit()
    return standard_response(True, "Message sent", {
        "id": str(msg.id),
        "content": msg.message_text,
        "sender": "user",
        "sent_at": msg.created_at.isoformat() if msg.created_at else None,
    })


@router.get("/chat/{chat_id}/messages")
def get_chat_messages(chat_id: str, after: str = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(chat_id)
    except ValueError:
        return standard_response(False, "Invalid chat ID")
    session = db.query(LiveChatSession).filter(LiveChatSession.id == cid, LiveChatSession.user_id == current_user.id).first()
    if not session:
        return standard_response(False, "Chat session not found")
    query = db.query(LiveChatMessage).filter(LiveChatMessage.session_id == cid)
    if after:
        try:
            after_dt = datetime.fromisoformat(after)
            query = query.filter(LiveChatMessage.created_at > after_dt)
        except ValueError:
            pass
    messages = query.order_by(LiveChatMessage.created_at.asc()).all()
    data = []
    for m in messages:
        sender_name = "You"
        if m.is_agent:
            sender_name = "Support Team"
        elif m.is_system:
            sender_name = "System"
        data.append({
            "id": str(m.id),
            "content": m.message_text,
            "sender": "agent" if m.is_agent else ("system" if m.is_system else "user"),
            "sender_name": sender_name,
            "sent_at": m.created_at.isoformat() if m.created_at else None,
        })
    return standard_response(True, "Messages retrieved", {
        "messages": data,
        "session_status": session.status.value if hasattr(session.status, 'value') else str(session.status),
    })


@router.get("/chat/{chat_id}/transcript")
def get_chat_transcript(chat_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        cid = uuid.UUID(chat_id)
    except ValueError:
        return standard_response(False, "Invalid chat ID")
    messages = db.query(LiveChatMessage).filter(LiveChatMessage.session_id == cid).order_by(LiveChatMessage.created_at.asc()).all()
    data = [{"content": m.message_text, "sender": "agent" if m.is_agent else "user", "sent_at": m.created_at.isoformat() if m.created_at else None} for m in messages]
    return standard_response(True, "Transcript retrieved", data)
