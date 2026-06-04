"""Stable per-recipient card URL mapping.

One row per unique (recipient, card_purpose, event, related_entity) tuple.
Holds the *stable* public token/URL that must never change across re-sends,
plus the current internal storage path/URL (which may be overwritten).
"""
from sqlalchemy import Column, DateTime, Text, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from core.base import Base


class CardUrlMapping(Base):
    __tablename__ = "card_url_mappings"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    card_context_key = Column(Text, nullable=False)
    token = Column(Text, nullable=False)

    recipient_type = Column(Text, nullable=False)
    recipient_id = Column(UUID(as_uuid=True), nullable=False)
    card_purpose = Column(Text, nullable=False)
    event_id = Column(UUID(as_uuid=True), nullable=True)
    related_entity_type = Column(Text, nullable=True)
    related_entity_id = Column(UUID(as_uuid=True), nullable=True)

    template_slug = Column(Text, nullable=True)
    storage_path = Column(Text, nullable=True)
    storage_url = Column(Text, nullable=True)
    public_url = Column(Text, nullable=False)
    metadata_json = Column(JSONB, nullable=False, default=dict)
    last_rendered_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("card_context_key", name="uq_card_url_mappings_context_key"),
        UniqueConstraint("token", name="uq_card_url_mappings_token"),
        Index("idx_card_url_mappings_recipient", "recipient_type", "recipient_id"),
        Index("idx_card_url_mappings_event_purpose", "event_id", "card_purpose"),
    )
