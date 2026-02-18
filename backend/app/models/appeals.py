from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Text, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import AppealStatusEnum, AppealContentTypeEnum


# ──────────────────────────────────────────────
# Content Appeals
# ──────────────────────────────────────────────

class ContentAppeal(Base):
    """
    Allows users to appeal the removal of their posts or moments by an admin.
    One appeal per content item — duplicate appeals are blocked by the unique constraint.
    """
    __tablename__ = 'content_appeals'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    content_id = Column(UUID(as_uuid=True), nullable=False)
    content_type = Column(Enum(AppealContentTypeEnum, name="appeal_content_type_enum"), nullable=False)
    appeal_reason = Column(Text, nullable=False)
    status = Column(Enum(AppealStatusEnum, name="appeal_status_enum"), default=AppealStatusEnum.pending, nullable=False)
    admin_notes = Column(Text)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey('admin_users.id', ondelete='SET NULL'))
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'content_id', 'content_type', name='uq_content_appeal'),
    )

    # Relationships
    user = relationship("User", back_populates="content_appeals")
