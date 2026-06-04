"""Invitation card guest recipients

Extend ``sent_event_cards`` so invitation cards (sendoff, wedding) can be
sent to event guests (``event_attendees``) with per-recipient QR payloads.
Thank-you cards continue to use ``contributor_id``; invitation cards
populate ``guest_attendee_id`` and ``recipient_qr_payload`` instead.

Revision ID: cafe27052300
Revises: cafe27052200
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "cafe27052300"
down_revision = "cafe27052200"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sent_event_cards",
        sa.Column("guest_attendee_id", UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "sent_event_cards",
        sa.Column("recipient_qr_payload", sa.Text(), nullable=True),
    )
    op.create_foreign_key(
        "fk_sent_event_cards_guest_attendee",
        "sent_event_cards",
        "event_attendees",
        ["guest_attendee_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "idx_sent_event_cards_event_guest",
        "sent_event_cards",
        ["event_id", "guest_attendee_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_sent_event_cards_event_guest", table_name="sent_event_cards")
    op.drop_constraint(
        "fk_sent_event_cards_guest_attendee",
        "sent_event_cards",
        type_="foreignkey",
    )
    op.drop_column("sent_event_cards", "recipient_qr_payload")
    op.drop_column("sent_event_cards", "guest_attendee_id")
