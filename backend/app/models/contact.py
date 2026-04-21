"""ContactMessage — public landing-page contact form submissions.

Anyone (anonymous, no JWT) can POST a message via /contact/submit.
Admins read & manage them via /admin/contact-messages/*.
"""
from sqlalchemy import Column, Text, DateTime, Index, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from core.base import Base


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id = Column(UUID(as_uuid=True), primary_key=True,
                server_default=func.gen_random_uuid())
    first_name = Column(Text, nullable=False)
    last_name = Column(Text, nullable=False)
    email = Column(Text, nullable=False)
    phone = Column(Text)
    subject = Column(Text)
    message = Column(Text, nullable=False)
    # Where the form was submitted from
    source_page = Column(Text)            # e.g. "/contact"
    source_host = Column(Text)            # nuru.tz | nuru.ke | other
    user_agent = Column(Text)
    ip_address = Column(String(64))
    # Workflow state
    status = Column(String(20), nullable=False, default="new")  # new | read | replied | archived
    is_archived = Column(Boolean, nullable=False, default=False)
    handled_by_admin_id = Column(
        UUID(as_uuid=True),
        ForeignKey("admin_users.id", ondelete="SET NULL"),
        nullable=True,
    )
    admin_notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_contact_messages_created", "created_at"),
        Index("ix_contact_messages_status", "status"),
    )
