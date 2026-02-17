from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base


# ──────────────────────────────────────────────
# Committee Tables
# ──────────────────────────────────────────────

class CommitteeRole(Base):
    __tablename__ = 'committee_roles'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    role_name = Column(Text, nullable=False, unique=True)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    committee_members = relationship("EventCommitteeMember", back_populates="role")


class EventCommitteeMember(Base):
    __tablename__ = 'event_committee_members'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    event_id = Column(UUID(as_uuid=True), ForeignKey('events.id', ondelete='CASCADE'))
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    role_id = Column(UUID(as_uuid=True), ForeignKey('committee_roles.id', ondelete='SET NULL'))
    assigned_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'))
    assigned_at = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    event = relationship("Event", back_populates="committee_members")
    user = relationship("User", back_populates="event_committee_memberships", foreign_keys=[user_id])
    role = relationship("CommitteeRole", back_populates="committee_members")
    assigner = relationship("User", back_populates="event_committee_assignments", foreign_keys=[assigned_by])
    permission = relationship("CommitteePermission", back_populates="committee_member", uselist=False)


class CommitteePermission(Base):
    __tablename__ = 'committee_permissions'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    committee_member_id = Column(UUID(as_uuid=True), ForeignKey('event_committee_members.id', ondelete='CASCADE'), nullable=False, unique=True)
    can_view_guests = Column(Boolean, default=True)
    can_manage_guests = Column(Boolean, default=False)
    can_send_invitations = Column(Boolean, default=False)
    can_check_in_guests = Column(Boolean, default=False)
    can_view_budget = Column(Boolean, default=False)
    can_manage_budget = Column(Boolean, default=False)
    can_view_contributions = Column(Boolean, default=False)
    can_manage_contributions = Column(Boolean, default=False)
    can_view_vendors = Column(Boolean, default=True)
    can_manage_vendors = Column(Boolean, default=False)
    can_approve_bookings = Column(Boolean, default=False)
    can_edit_event = Column(Boolean, default=False)
    can_manage_committee = Column(Boolean, default=False)
    can_view_expenses = Column(Boolean, default=False)
    can_manage_expenses = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    committee_member = relationship("EventCommitteeMember", back_populates="permission")
