"""Background member import job.

Mirrors ``contributor_import_jobs`` for the bulk Committee / Guest member
uploads triggered from the event manager UI. Rows are dropped onto a Celery
task so the request returns immediately and the organiser can poll for
progress and the final summary.

The accepted CSV layouts are:

  • mode='committee' → columns: s/n, full name, phone
  • mode='guests'    → columns: s/n, full name, phone, common name

Each successful row resolves to (or creates) a Nuru user — phone is the
dedupe key — and then attaches that user to the committee or the event's
guest list. Phones are normalised through ``utils.validation_functions``
and only +255 / +254 prefixes are accepted; everything else is reported
back in the per-row error list.
"""
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from core.base import Base


class MemberImportJob(Base):
    __tablename__ = "member_import_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # mode: 'committee' | 'guests'
    mode = Column(String(32), nullable=False, default="guests")
    # status: queued | processing | completed | failed | partially_completed
    status = Column(String(32), nullable=False, default="queued")
    notify_sms = Column(Boolean, nullable=False, default=False)

    total_rows = Column(Integer, nullable=False, default=0)
    processed_rows = Column(Integer, nullable=False, default=0)
    successful_rows = Column(Integer, nullable=False, default=0)
    reused_rows = Column(Integer, nullable=False, default=0)
    duplicate_rows = Column(Integer, nullable=False, default=0)
    invalid_phone_rows = Column(Integer, nullable=False, default=0)
    failed_rows = Column(Integer, nullable=False, default=0)

    # Original parsed rows (small enough — CSVs are tens to a few thousand
    # rows). Stored as JSONB so the worker can pick them up without needing
    # a file handle that may not survive the request boundary.
    payload = Column(JSONB, nullable=False)
    errors = Column(JSONB, nullable=False, default=list)
    error_message = Column(Text, nullable=True)

    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
