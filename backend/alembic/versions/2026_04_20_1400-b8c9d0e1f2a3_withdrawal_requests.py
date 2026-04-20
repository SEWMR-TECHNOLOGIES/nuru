"""withdrawal requests — admin-mediated payouts (no SasaPay)

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-04-20 14:00:00.000000

Adds:
  * withdrawal_request_status_enum
  * withdrawal_requests table

Withdrawals are processed by Nuru admins outside the gateway, so we don't need
provider integrations here — only a request lifecycle and audit fields. The
existing wallet_service.hold/release/withdrawal primitives handle the balance
movements.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "b8c9d0e1f2a3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


WD_STATUS = postgresql.ENUM(
    "pending", "approved", "settled", "rejected", "cancelled",
    name="withdrawal_request_status_enum",
)


def upgrade() -> None:
    bind = op.get_bind()
    WD_STATUS.create(bind, checkfirst=True)

    op.create_table(
        "withdrawal_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("request_code", sa.Text(), nullable=False, unique=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("wallet_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payment_profile_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("payment_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("currency_code", sa.String(3), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("user_note", sa.Text(), nullable=True),
        sa.Column("payout_method", sa.Text(), nullable=True),
        sa.Column("payout_provider_name", sa.Text(), nullable=True),
        sa.Column("payout_account_holder", sa.Text(), nullable=True),
        sa.Column("payout_account_number", sa.Text(), nullable=True),
        sa.Column("payout_snapshot", postgresql.JSONB(), nullable=True),
        sa.Column("status",
                  postgresql.ENUM("pending", "approved", "settled", "rejected", "cancelled",
                                  name="withdrawal_request_status_enum",
                                  create_type=False),
                  nullable=False, server_default="pending"),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("admin_user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=True),
        sa.Column("external_reference", sa.Text(), nullable=True),
        sa.Column("hold_ledger_entry_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("wallet_ledger_entries.id"), nullable=True),
        sa.Column("settle_ledger_entry_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("wallet_ledger_entries.id"), nullable=True),
        sa.Column("requested_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("settled_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_withdrawal_user", "withdrawal_requests", ["user_id"])
    op.create_index("ix_withdrawal_status_created", "withdrawal_requests", ["status", "created_at"])
    op.create_index("ix_withdrawal_wallet", "withdrawal_requests", ["wallet_id"])


def downgrade() -> None:
    op.drop_index("ix_withdrawal_wallet", table_name="withdrawal_requests")
    op.drop_index("ix_withdrawal_status_created", table_name="withdrawal_requests")
    op.drop_index("ix_withdrawal_user", table_name="withdrawal_requests")
    op.drop_table("withdrawal_requests")
    bind = op.get_bind()
    WD_STATUS.drop(bind, checkfirst=True)
