"""ORM models for 1:1 voice/video calls and push-notification device tokens.

Mirrors the columns introduced by Alembic revision ``a6b7c8d9e0f1``. Kept in
its own module so it stays decoupled from the heavier messaging.py file and
can be imported lazily by routes that need it.
"""
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Text, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.base import Base


class CallLog(Base):
    """One row per 1:1 call between two users in a conversation.

    ``status`` lifecycle:
        ringing  → initial state right after caller hits "Call".
        ongoing  → callee accepted; both sides should be in the LiveKit room.
        answered → terminal alias of ongoing once the call ends with audio
                   actually exchanged (used as a hint for chat bubble copy).
        missed   → callee never accepted before timeout/cancel.
        declined → callee explicitly declined.
        ended    → caller or callee hung up cleanly.
        failed   → setup error (LiveKit unreachable, etc.).
    """
    __tablename__ = "call_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    caller_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    callee_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # LiveKit room name. Unique so the same room can't be reused for a new call.
    room_name = Column(Text, nullable=False, unique=True)
    kind = Column(Text, nullable=False, server_default="voice")  # 'voice' | 'video'
    status = Column(Text, nullable=False, server_default="ringing")

    started_at = Column(DateTime, nullable=False, server_default=func.now())
    answered_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=False, server_default="0")
    end_reason = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (
        Index("idx_call_logs_callee_status", "callee_id", "status"),
        Index("idx_call_logs_conv_started", "conversation_id", "started_at"),
        Index("idx_call_logs_caller", "caller_id"),
    )

    conversation = relationship("Conversation", foreign_keys=[conversation_id])
    caller = relationship("User", foreign_keys=[caller_id])
    callee = relationship("User", foreign_keys=[callee_id])


class DeviceToken(Base):
    """Push-notification token registered by a mobile device.

    Used by the backend to fan-out VoIP push (iOS PushKit) and FCM data
    messages so that ``flutter_callkit_incoming`` can ring the lock screen
    even when the app is killed.
    """
    __tablename__ = "device_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    platform = Column(Text, nullable=False)  # 'ios' | 'android'
    token = Column(Text, nullable=False)
    kind = Column(Text, nullable=False, server_default="fcm")  # 'fcm' | 'voip'
    app_version = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("platform", "token", name="uq_device_tokens_platform_token"),
        Index("idx_device_tokens_user", "user_id"),
    )

    user = relationship("User")
