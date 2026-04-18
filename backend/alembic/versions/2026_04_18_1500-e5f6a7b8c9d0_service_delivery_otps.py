"""Phase 1.3 — service_delivery_otps + delivery_confirmed_at

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-18 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "service_delivery_otps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("service_booking_requests.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("event_service_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("event_services.id", ondelete="SET NULL"), nullable=True),
        sa.Column("code", sa.Text, nullable=False),
        sa.Column("issued_by_vendor_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("confirmed_by_vendor_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("issued_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("confirmed_at", sa.DateTime, nullable=True),
        sa.Column("cancelled_at", sa.DateTime, nullable=True),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.Text, nullable=False, server_default="active"),
        sa.Column("notes", sa.Text),
    )
    op.create_index("idx_delivery_otps_booking_status", "service_delivery_otps",
                    ["booking_id", "status"])
    op.create_index("idx_delivery_otps_expires", "service_delivery_otps", ["expires_at"])

    # Add delivery_confirmed_at to event_services so vendor stats can pivot off it.
    with op.batch_alter_table("event_services") as batch:
        batch.add_column(sa.Column("delivery_confirmed_at", sa.DateTime, nullable=True))
        batch.add_column(sa.Column("delivery_confirmed_by_id",
                                   postgresql.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("event_services") as batch:
        batch.drop_column("delivery_confirmed_by_id")
        batch.drop_column("delivery_confirmed_at")

    op.drop_index("idx_delivery_otps_expires", table_name="service_delivery_otps")
    op.drop_index("idx_delivery_otps_booking_status", table_name="service_delivery_otps")
    op.drop_table("service_delivery_otps")
