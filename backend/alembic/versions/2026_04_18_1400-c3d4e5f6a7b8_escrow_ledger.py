"""Phase 1.1 — escrow_holds + escrow_transactions

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-18 14:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:

    op.create_table(
        "escrow_holds",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),

        sa.Column(
            "booking_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_booking_requests.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),

        sa.Column(
            "event_service_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("event_services.id", ondelete="SET NULL"),
            nullable=True,
        ),

        sa.Column(
            "vendor_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),

        sa.Column(
            "organiser_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),

        sa.Column("currency", sa.Text, nullable=False, server_default="KES"),
        sa.Column("amount_total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("amount_deposit", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("amount_balance", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("amount_released", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("amount_refunded", sa.Numeric(14, 2), nullable=False, server_default="0"),

        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "held",
                "partially_released",
                "released",
                "refunded",
                "disputed",
                name="escrow_hold_status_enum",
            ),
            nullable=False,
            server_default="pending",
        ),

        sa.Column("auto_release_at", sa.DateTime, nullable=True),
        sa.Column("settled_to_vendor_at", sa.DateTime, nullable=True),

        sa.Column(
            "settled_by_admin_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),

        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    op.create_index(
        "idx_escrow_holds_status_release",
        "escrow_holds",
        ["status", "auto_release_at"],
    )

    op.create_index(
        "idx_escrow_holds_vendor_status",
        "escrow_holds",
        ["vendor_user_id", "status"],
    )

    op.create_index(
        "idx_escrow_holds_organiser_status",
        "escrow_holds",
        ["organiser_user_id", "status"],
    )

    # ----------------------------
    # ESCROW TRANSACTIONS
    # ----------------------------

    op.create_table(
        "escrow_transactions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),

        sa.Column(
            "hold_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("escrow_holds.id", ondelete="CASCADE"),
            nullable=False,
        ),

        sa.Column(
            "booking_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_booking_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),

        sa.Column(
            "type",
            sa.Enum(
                "HOLD_DEPOSIT",
                "HOLD_BALANCE",
                "RELEASE_TO_VENDOR",
                "REFUND_TO_ORGANISER",
                "COMMISSION_TO_NURU",
                "FEE",
                "ADJUSTMENT",
                "SETTLED_TO_VENDOR",
                name="escrow_transaction_type_enum",
            ),
            nullable=False,
        ),

        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.Text, nullable=False, server_default="KES"),

        sa.Column(
            "actor_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),

        sa.Column("reason_code", sa.Text),
        sa.Column("notes", sa.Text),
        sa.Column("external_ref", sa.Text),

        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    op.create_index(
        "idx_escrow_tx_hold_created",
        "escrow_transactions",
        ["hold_id", "created_at"],
    )

    op.create_index(
        "idx_escrow_tx_booking_type",
        "escrow_transactions",
        ["booking_id", "type"],
    )


def downgrade() -> None:

    op.drop_index("idx_escrow_tx_booking_type", table_name="escrow_transactions")
    op.drop_index("idx_escrow_tx_hold_created", table_name="escrow_transactions")
    op.drop_table("escrow_transactions")

    op.drop_index("idx_escrow_holds_organiser_status", table_name="escrow_holds")
    op.drop_index("idx_escrow_holds_vendor_status", table_name="escrow_holds")
    op.drop_index("idx_escrow_holds_status_release", table_name="escrow_holds")
    op.drop_table("escrow_holds")

    # Drop enums (safe cleanup)
    sa.Enum(name="escrow_transaction_type_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="escrow_hold_status_enum").drop(op.get_bind(), checkfirst=True)