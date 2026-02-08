# Support Routes - /support/...
# Handles support tickets, FAQs, and live chat

from fastapi import APIRouter

from models import (
    SupportTicket,
    SupportMessage,
    FAQ,
    LiveChatSession,
    LiveChatMessage,
    User,
)

router = APIRouter(prefix="/support", tags=["Support"])


# ──────────────────────────────────────────────
# SUPPORT TICKETS
# ──────────────────────────────────────────────
@router.get("/tickets")
async def get_tickets():
    """Returns support tickets for the authenticated user."""
    pass


@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str):
    """Returns a single support ticket with messages."""
    pass


@router.post("/tickets")
async def create_ticket():
    """Creates a new support ticket."""
    pass


@router.post("/tickets/{ticket_id}/messages")
async def reply_to_ticket(ticket_id: str):
    """Replies to a support ticket."""
    pass


@router.put("/tickets/{ticket_id}/close")
async def close_ticket(ticket_id: str):
    """Closes a support ticket."""
    pass


@router.put("/tickets/{ticket_id}/reopen")
async def reopen_ticket(ticket_id: str):
    """Reopens a closed ticket."""
    pass


# ──────────────────────────────────────────────
# FAQs
# ──────────────────────────────────────────────
@router.get("/faqs/categories")
async def get_faq_categories():
    """Returns FAQ categories."""
    pass


@router.get("/faqs")
async def get_faqs():
    """Returns FAQs, optionally filtered by category."""
    pass


@router.post("/faqs/{faq_id}/helpful")
async def mark_faq_helpful(faq_id: str):
    """Marks an FAQ as helpful or not helpful."""
    pass


# ──────────────────────────────────────────────
# LIVE CHAT
# ──────────────────────────────────────────────
@router.get("/chat/status")
async def get_chat_status():
    """Returns live chat availability status."""
    pass


@router.post("/chat/start")
async def start_chat():
    """Starts a live chat session."""
    pass


@router.post("/chat/{chat_id}/end")
async def end_chat(chat_id: str):
    """Ends a live chat session."""
    pass


@router.get("/chat/{chat_id}/transcript")
async def get_chat_transcript(chat_id: str):
    """Returns the transcript of a chat session."""
    pass
