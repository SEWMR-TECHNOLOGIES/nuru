# Messages Routes - /messages/...
# Handles messaging/conversations between users

from fastapi import APIRouter

from models import (
    Conversation,
    Message,
    User,
    UserService,
)

router = APIRouter(prefix="/messages", tags=["Messages"])


# ──────────────────────────────────────────────
# Get Conversations
# ──────────────────────────────────────────────
@router.get("/")
async def get_conversations():
    """Returns all conversations for the authenticated user."""
    pass


# ──────────────────────────────────────────────
# Get Messages in Conversation
# ──────────────────────────────────────────────
@router.get("/{conversation_id}")
async def get_messages(conversation_id: str):
    """Returns messages in a conversation."""
    pass


# ──────────────────────────────────────────────
# Send Message
# ──────────────────────────────────────────────
@router.post("/{conversation_id}")
async def send_message(conversation_id: str):
    """Sends a message in a conversation."""
    pass


# ──────────────────────────────────────────────
# Start Conversation
# ──────────────────────────────────────────────
@router.post("/start")
async def start_conversation():
    """Starts a new conversation with a user."""
    pass


# ──────────────────────────────────────────────
# Mark Messages as Read
# ──────────────────────────────────────────────
@router.put("/{conversation_id}/read")
async def mark_as_read(conversation_id: str):
    """Marks messages in a conversation as read."""
    pass


# ──────────────────────────────────────────────
# Delete Message
# ──────────────────────────────────────────────
@router.delete("/{conversation_id}/messages/{message_id}")
async def delete_message(conversation_id: str, message_id: str):
    """Deletes a message (soft delete)."""
    pass


# ──────────────────────────────────────────────
# Archive Conversation
# ──────────────────────────────────────────────
@router.post("/{conversation_id}/archive")
async def archive_conversation(conversation_id: str):
    """Archives a conversation."""
    pass


# ──────────────────────────────────────────────
# Mute/Unmute Conversation
# ──────────────────────────────────────────────
@router.post("/{conversation_id}/mute")
async def mute_conversation(conversation_id: str):
    """Mutes or unmutes notifications for a conversation."""
    pass


# ──────────────────────────────────────────────
# Unarchive Conversation
# ──────────────────────────────────────────────
@router.post("/{conversation_id}/unarchive")
async def unarchive_conversation(conversation_id: str):
    """Unarchives a conversation."""
    pass


# ──────────────────────────────────────────────
# Get Unread Count
# ──────────────────────────────────────────────
@router.get("/unread/count")
async def get_unread_count():
    """Returns total unread message count."""
    pass
