"""offline payment claims + secondary contributor phone

Revision ID: d7e8f9a0b1c2
Revises: c5d6e7f8a9b0
Create Date: 2026-04-21 15:00:00.000000

Adds:
  1. event_contributors.secondary_phone + notify_target
     Optional second phone for a contributor and a routing preference
     ('primary' | 'secondary' | 'both') used by SMS, WhatsApp and in-app.
     Secondary phone is intentionally NOT used for nuru-user mapping.
  2. event_contributions.* offline-claim audit fields
     Lets a payer declare 'I already paid via another method' with a
     transaction code, payer account, optional receipt image and full
     review trail. Reuses confirmation_status (pending|confirmed|rejected).
  3. ticket_offline_claims (new table)
     Same pattern for ticket purchases. On approval, tickets are minted.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "d7e8f9a0b1c2"
down_revision = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Secondary contributor phone + notify routing
    op.add_column(
        "event_contributors",
        sa.Column("secondary_phone", sa.Text(), nullable=True),
    )
    op.add_column(
        "event_contributors",
        sa.Column(
            "notify_target",
            sa.Text(),
            nullable=False,
            server_default="primary",
        ),
    )
    op.create_check_constraint(
        "ck_event_contributors_notify_target",
        "event_contributors",
        "notify_target IN ('primary', 'secondary', 'both')",
    )

    # 2. event_contributions — offline-claim audit fields
    with op.batch_alter_table("event_contributions") as batch:
        batch.add_column(sa.Column("payment_channel", sa.Text(), nullable=True))
        batch.add_column(sa.Column("provider_name", sa.Text(), nullable=True))
        batch.add_column(sa.Column("provider_id", postgresql.UUID(as_uuid=True), nullable=True))
        batch.add_column(sa.Column("payer_account", sa.Text(), nullable=True))
        batch.add_column(sa.Column("receipt_image_url", sa.Text(), nullable=True))
        batch.add_column(sa.Column("claim_submitted_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("claim_reviewed_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("claim_reviewed_by", postgresql.UUID(as_uuid=True), nullable=True))
        batch.add_column(sa.Column("claim_rejection_reason", sa.Text(), nullable=True))
    op.create_foreign_key(
        "fk_event_contributions_provider_id",
        "event_contributions", "payment_providers",
        ["provider_id"], ["id"], ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_event_contributions_claim_reviewed_by",
        "event_contributions", "users",
        ["claim_reviewed_by"], ["id"], ondelete="SET NULL",
    )
    op.create_index(
        "idx_event_contributions_payment_channel",
        "event_contributions", ["payment_channel"],
    )

    # 3. ticket_offline_claims — buyer-declared off-platform ticket payments
    op.create_table(
        "ticket_offline_claims",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("event_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ticket_class_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("event_ticket_classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("claimant_user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("claimant_name", sa.Text(), nullable=False),
        sa.Column("claimant_phone", sa.Text(), nullable=True),
        sa.Column("claimant_email", sa.Text(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("payment_channel", sa.Text(), nullable=False),  # mobile_money | bank
        sa.Column("provider_name", sa.Text(), nullable=True),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("payment_providers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("payer_account", sa.Text(), nullable=True),
        sa.Column("transaction_code", sa.Text(), nullable=False),
        sa.Column("receipt_image_url", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("issued_ticket_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("event_tickets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.CheckConstraint(
            "payment_channel IN ('mobile_money', 'bank')",
            name="ck_ticket_offline_claims_channel",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'confirmed', 'rejected')",
            name="ck_ticket_offline_claims_status",
        ),
        sa.UniqueConstraint(
            "ticket_class_id", "transaction_code",
            name="uq_ticket_offline_claims_class_txn",
        ),
    )
    op.create_index(
        "idx_ticket_offline_claims_event_status",
        "ticket_offline_claims", ["event_id", "status"],
    )
    op.create_index(
        "idx_ticket_offline_claims_claimant",
        "ticket_offline_claims", ["claimant_user_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_ticket_offline_claims_claimant", table_name="ticket_offline_claims")
    op.drop_index("idx_ticket_offline_claims_event_status", table_name="ticket_offline_claims")
    op.drop_table("ticket_offline_claims")

    op.drop_index("idx_event_contributions_payment_channel", table_name="event_contributions")
    op.drop_constraint("fk_event_contributions_claim_reviewed_by", "event_contributions", type_="foreignkey")
    op.drop_constraint("fk_event_contributions_provider_id", "event_contributions", type_="foreignkey")
    with op.batch_alter_table("event_contributions") as batch:
        for col in [
            "claim_rejection_reason", "claim_reviewed_by", "claim_reviewed_at",
            "claim_submitted_at", "receipt_image_url", "payer_account",
            "provider_id", "provider_name", "payment_channel",
        ]:
            batch.drop_column(col)

    op.drop_constraint("ck_event_contributors_notify_target", "event_contributors", type_="check")
    op.drop_column("event_contributors", "notify_target")
    op.drop_column("event_contributors", "secondary_phone")
