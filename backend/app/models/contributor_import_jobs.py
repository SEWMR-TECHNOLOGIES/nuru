"""Contributor import job model - rows are processed by a Celery task."""
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


class ContributorImportJob(Base):
    __tablename__ = "contributor_import_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # queued | processing | completed | failed | partially_completed
    status = Column(String(32), nullable=False, default="queued")
    mode = Column(String(32), nullable=False, default="targets")  # targets | contributions
    payment_method = Column(String(64), nullable=True)
    send_sms = Column(Boolean, nullable=False, default=False)

    total_rows = Column(Integer, nullable=False, default=0)
    processed_rows = Column(Integer, nullable=False, default=0)
    successful_rows = Column(Integer, nullable=False, default=0)
    failed_rows = Column(Integer, nullable=False, default=0)

    payload = Column(JSONB, nullable=False)
    errors = Column(JSONB, nullable=False, default=list)
    error_message = Column(Text, nullable=True)

    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
