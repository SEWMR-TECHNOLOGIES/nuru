"""admin payments ops — finance_admin role + admin_payment_logs

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-04-20 16:00:00.000000

Adds:
  * 'finance_admin' value to the admin_role enum
  * admin_payment_logs table (audit trail for the Admin Payments Dashboard)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "c9d0e1f2a3b4"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Extend admin_role enum with 'finance_admin' ──────────────────────
    # Postgres requires ALTER TYPE ... ADD VALUE outside a transaction block.
    # Using IF NOT EXISTS keeps the migration idempotent on re-runs.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE admin_role ADD VALUE IF NOT EXISTS 'finance_admin'")

    # ── 2. admin_payment_logs ──────────────────────────────────────────────
    op.create_table(
        "admin_payment_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("admin_user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("target_type", sa.Text(), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("old_status", sa.Text(), nullable=True),
        sa.Column("new_status", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_admin_payment_log_target", "admin_payment_logs", ["target_type", "target_id"])
    op.create_index("ix_admin_payment_log_admin_created", "admin_payment_logs", ["admin_user_id", "created_at"])
    op.create_index("ix_admin_payment_log_created", "admin_payment_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_admin_payment_log_created", table_name="admin_payment_logs")
    op.drop_index("ix_admin_payment_log_admin_created", table_name="admin_payment_logs")
    op.drop_index("ix_admin_payment_log_target", table_name="admin_payment_logs")
    op.drop_table("admin_payment_logs")
    # Note: cannot remove enum values in Postgres without recreating the type;
    # finance_admin will simply be unused after downgrade.
