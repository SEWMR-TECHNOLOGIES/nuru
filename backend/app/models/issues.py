from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Integer, Text, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import IssueStatusEnum, IssuePriorityEnum


class IssueCategory(Base):
    __tablename__ = 'issue_categories'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, nullable=False, unique=True)
    description = Column(Text)
    icon = Column(Text)
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    issues = relationship("Issue", back_populates="category")


class Issue(Base):
    __tablename__ = 'issues'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey('issue_categories.id', ondelete='RESTRICT'), nullable=False)
    subject = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(Enum(IssueStatusEnum, name="issue_status_enum"), default=IssueStatusEnum.open)
    priority = Column(Enum(IssuePriorityEnum, name="issue_priority_enum"), default=IssuePriorityEnum.medium)
    screenshot_urls = Column(JSONB, server_default="'[]'::jsonb")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="issues")
    category = relationship("IssueCategory", back_populates="issues")
    responses = relationship("IssueResponse", back_populates="issue", order_by="IssueResponse.created_at.asc()")


class IssueResponse(Base):
    __tablename__ = 'issue_responses'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    issue_id = Column(UUID(as_uuid=True), ForeignKey('issues.id', ondelete='CASCADE'), nullable=False)
    responder_id = Column(UUID(as_uuid=True))
    is_admin = Column(Boolean, default=False)
    admin_name = Column(Text)
    message = Column(Text, nullable=False)
    attachments = Column(JSONB, server_default="'[]'::jsonb")
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    issue = relationship("Issue", back_populates="responses")
