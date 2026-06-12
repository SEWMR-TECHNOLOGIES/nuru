"""
WAMessageLog
============
Per-attempt log of every WhatsApp message Nuru tries to send. Captures
the request payload, provider response, current delivery status, errors,
retry count, timestamps and (since the v3 schema) the EVENT it relates
to, the recipient TYPE, the message PURPOSE and the SMS fallback result
so the WhatsApp Logs UI can answer questions like:

    "Which guests for Event X are not on WhatsApp and did SMS fire?"
    "Show delivered thank-you cards for this event in the last 7 days."

Updated by Meta webhook callbacks via ``provider_message_id`` so silent
delivery failures become visible.
"""
from sqlalchemy import (
    Column, Text, Integer, DateTime, String, ForeignKey, Index, Boolean
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
    recipient_name = Column(String(255), nullable=True, index=True)
    normalized_phone = Column(String(32), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True),
                     ForeignKey("users.id", ondelete="SET NULL"),
                     nullable=True, index=True)

    # Event linkage (snapshot keeps the log meaningful if the event later
    # changes its name or is removed).
    event_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    event_name_snapshot = Column(String(255), nullable=True)

    # Recipient typing — answers "show me guests not on WhatsApp" style
    # questions without a join.
    recipient_type = Column(String(32), nullable=True, index=True)   # guest | contributor | committee | vendor | user | external
    recipient_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    # Why this message was sent.
    message_purpose = Column(String(128), nullable=True, index=True) # e.g. invitation_card, rsvp_reminder, thank_you_card, otp
    source_module = Column(String(64), nullable=True, index=True)    # which module triggered the send
    related_entity_type = Column(String(64), nullable=True)
    related_entity_id = Column(UUID(as_uuid=True), nullable=True)

    # WhatsApp availability tri-state.
    whatsapp_available = Column(Boolean, nullable=True, index=True)

    # What was sent
    category = Column(String(64), nullable=False, default="template", index=True)
    action = Column(String(128), nullable=True, index=True)
    template_name = Column(String(128), nullable=True, index=True)
    message_type = Column(String(32), nullable=False, default="template")
    language = Column(String(8), nullable=True)
    direction = Column(String(16), nullable=False, default="outbound")

    # Payloads
    request_payload = Column(JSONB, nullable=True)
    response_payload = Column(JSONB, nullable=True)
    webhook_payload = Column(JSONB, nullable=True)
    summary = Column(Text, nullable=True)
    media_url = Column(Text, nullable=True)
    media_type = Column(String(32), nullable=True)

    # Provider
    provider = Column(String(32), nullable=False, default="whatsapp_cloud_api")
    provider_message_id = Column(String(255), nullable=True, index=True)

    # Status: queued / sent / delivered / read / failed / rejected / pending / unknown
    status = Column(String(32), nullable=False, default="queued", index=True)
    error_code = Column(String(64), nullable=True, index=True)
    error_message = Column(Text, nullable=True)
    error_title = Column(String(255), nullable=True)
    error_details = Column(JSONB, nullable=True)
    fbtrace_id = Column(String(128), nullable=True)
    failure_reason = Column(Text, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    parent_log_id = Column(UUID(as_uuid=True),
                           ForeignKey("wa_message_logs.id", ondelete="SET NULL"),
                           nullable=True, index=True)

    # Fallback channel (SMS / email / push) visibility
    fallback_channel = Column(String(32), nullable=True)
    fallback_attempted = Column(Boolean, nullable=True, default=False)
    fallback_status = Column(String(32), nullable=True, index=True)
    fallback_provider = Column(String(64), nullable=True)
    fallback_message_id = Column(String(255), nullable=True)
    fallback_error = Column(Text, nullable=True)
    fallback_sent_at = Column(DateTime(timezone=True), nullable=True)

    # Timeline
    queued_at = Column(DateTime(timezone=True), server_default=func.now())
    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    failed_at = Column(DateTime(timezone=True), nullable=True)
    last_status_at = Column(DateTime(timezone=True), nullable=True)

    # Soft delete — kept so admin audit history can be preserved.
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    deleted_by_user_id = Column(UUID(as_uuid=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True),
                        server_default=func.now(), onupdate=func.now())


Index("ix_wa_message_logs_status_created", WAMessageLog.status, WAMessageLog.created_at.desc())
Index("ix_wa_message_logs_category_created", WAMessageLog.category, WAMessageLog.created_at.desc())
Index("ix_wa_message_logs_event_created", WAMessageLog.event_id, WAMessageLog.created_at.desc())
