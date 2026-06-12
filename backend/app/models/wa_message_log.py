"""
WAMessageLog
============
Per-attempt log of every WhatsApp message Nuru tries to send (templates,
text, media, button, document). Captures the request payload, provider
response, current delivery status, errors, retry count and the timestamps
for sent / delivered / read / failed. Updated by Meta webhook callbacks
via ``provider_message_id`` so silent delivery failures become visible.
"""
from sqlalchemy import (
    Column, Text, Integer, DateTime, String, ForeignKey, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from core.base import Base


class WAMessageLog(Base):
    __tablename__ = "wa_message_logs"

    id = Column(UUID(as_uuid=True), primary_key=True,
                server_default=func.gen_random_uuid())

    # Recipient / context
    recipient_phone = Column(String(32), nullable=False, index=True)
    normalized_phone = Column(String(32), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True),
                     ForeignKey("users.id", ondelete="SET NULL"),
                     nullable=True, index=True)
    event_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    # What was sent
    # category: invitation_card / otp / rsvp / ticket / contribution /
    #           vendor_booking / password_reset / committee / meeting /
    #           reminder / template / text / media / button / system
    category = Column(String(64), nullable=False, default="template", index=True)
    action = Column(String(128), nullable=True, index=True)          # internal action key
    template_name = Column(String(128), nullable=True, index=True)   # Meta template name
    message_type = Column(String(32), nullable=False, default="template")  # text/template/media/button/image/document
    language = Column(String(8), nullable=True)
    direction = Column(String(16), nullable=False, default="outbound")

    # Payloads
    request_payload = Column(JSONB, nullable=True)
    response_payload = Column(JSONB, nullable=True)
    webhook_payload = Column(JSONB, nullable=True)
    summary = Column(Text, nullable=True)        # human-friendly summary
    media_url = Column(Text, nullable=True)
    media_type = Column(String(32), nullable=True)

    # Provider
    provider = Column(String(32), nullable=False, default="whatsapp_cloud_api")
    provider_message_id = Column(String(255), nullable=True, unique=False, index=True)

    # Status: queued / sent / delivered / read / failed / rejected / pending / unknown
    status = Column(String(32), nullable=False, default="queued", index=True)
    error_code = Column(String(64), nullable=True, index=True)
    error_message = Column(Text, nullable=True)
    failure_reason = Column(Text, nullable=True)   # human-readable explanation
    retry_count = Column(Integer, nullable=False, default=0)
    parent_log_id = Column(UUID(as_uuid=True),
                           ForeignKey("wa_message_logs.id", ondelete="SET NULL"),
                           nullable=True, index=True)

    # Timeline
    queued_at = Column(DateTime(timezone=True), server_default=func.now())
    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    failed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True),
                        server_default=func.now(), onupdate=func.now())


Index("ix_wa_message_logs_status_created", WAMessageLog.status, WAMessageLog.created_at.desc())
Index("ix_wa_message_logs_category_created", WAMessageLog.category, WAMessageLog.created_at.desc())
