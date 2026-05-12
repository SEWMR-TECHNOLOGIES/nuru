"""AccountDeletionRequest — public account/data deletion submissions.

Anyone (logged-in or anonymous) can POST a request via /account-deletion/submit.
Admins manage them via /admin/account-deletion/*.
"""
from sqlalchemy import Column, Text, DateTime, Index, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from core.base import Base


class AccountDeletionRequest(Base):
    __tablename__ = "account_deletion_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    full_name = Column(Text, nullable=False)
    email = Column(Text, nullable=False)
    phone = Column(Text)
    reason = Column(Text)
    delete_scope = Column(String(40), nullable=False, default="account_and_data")  # account_and_data | data_only
    source = Column(Text)              # web | mobile | etc
    user_agent = Column(Text)
    ip_address = Column(String(64))
    status = Column(String(20), nullable=False, default="pending")  # pending | in_progress | completed | rejected
    admin_notes = Column(Text)
    handled_by_admin_id = Column(UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_account_deletion_requests_status_created", "status", "created_at"),
    )