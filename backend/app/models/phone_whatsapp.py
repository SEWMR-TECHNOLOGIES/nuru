"""
PhoneWhatsAppStatus
===================
Central cache of WhatsApp availability per normalized phone number.
Joined to users/contributors/guests/vendors by normalized_phone so we
don't duplicate WhatsApp state across every table.
"""
from sqlalchemy import Column, Boolean, DateTime, Text, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from core.base import Base


class PhoneWhatsAppStatus(Base):
    __tablename__ = "phone_whatsapp_statuses"

    id = Column(UUID(as_uuid=True), primary_key=True,
                server_default=func.gen_random_uuid())

    raw_phone = Column(Text, nullable=True)
    normalized_phone = Column(Text, nullable=False, unique=True, index=True)
    country_code = Column(String(8), nullable=True)
    national_number = Column(Text, nullable=True)

    # normalization metadata
    normalization_status = Column(String(32), nullable=False, default="ok")
    normalization_error = Column(Text, nullable=True)

    # availability
    is_whatsapp = Column(Boolean, nullable=True)
    # one of: unknown, checking, whatsapp, not_whatsapp, failed
    status = Column(String(32), nullable=False, default="unknown", index=True)

    # provider info
    provider = Column(String(64), nullable=False, default="whatsapp_cloud_api")
    provider_response_code = Column(String(64), nullable=True)
    provider_error_code = Column(String(64), nullable=True)
    provider_error_message = Column(Text, nullable=True)

    # scheduling
    last_checked_at = Column(DateTime(timezone=True), nullable=True)
    next_check_after = Column(DateTime(timezone=True), nullable=True)
    check_attempts = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True),
                        server_default=func.now(), onupdate=func.now())
