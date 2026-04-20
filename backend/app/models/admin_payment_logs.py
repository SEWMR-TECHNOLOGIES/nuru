"""AdminPaymentLog — append-only audit trail of every admin action taken in
the Payments operations dashboard.

Every settlement state transition, manual mark-paid, hold, reject, escalate,
or note-add MUST insert a row here. The row is immutable; corrections are
new rows. Used for finance audits and dispute investigations.
"""

from sqlalchemy import Column, DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from core.base import Base


class AdminPaymentLog(Base):
    __tablename__ = "admin_payment_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())

    admin_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("admin_users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action = Column(Text, nullable=False)             # mark_paid / hold / reject / escalate / note / split / start_review
    target_type = Column(Text, nullable=False)        # withdrawal_request | transaction | settlement
    target_id = Column(UUID(as_uuid=True), nullable=False)

    old_status = Column(Text, nullable=True)
    new_status = Column(Text, nullable=True)

    note = Column(Text, nullable=True)
    payload = Column(JSONB, nullable=True)            # external_reference / channel / split details / etc.

    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("ix_admin_payment_log_target", "target_type", "target_id"),
        Index("ix_admin_payment_log_admin_created", "admin_user_id", "created_at"),
        Index("ix_admin_payment_log_created", "created_at"),
    )
