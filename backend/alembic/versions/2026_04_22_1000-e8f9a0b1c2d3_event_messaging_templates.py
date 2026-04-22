"""event messaging templates

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-04-22 10:00:00.000000

Per-event saved customisations for the contributor messaging composer
(message_template, payment_info, contact_phone) keyed by case_type so the
organiser doesn't have to retype them on every send.
"""
from alembic import op
import sqlalchemy as sa


revision = "e8f9a0b1c2d3"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "event_messaging_templates",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True),
                  primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("event_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_type", sa.Text(), nullable=False),
        sa.Column("message_template", sa.Text(), nullable=True),
        sa.Column("payment_info", sa.Text(), nullable=True),
        sa.Column("contact_phone", sa.Text(), nullable=True),
        sa.Column("updated_by", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.CheckConstraint(
            "case_type IN ('no_contribution', 'partial', 'completed')",
            name="ck_event_messaging_templates_case",
        ),
        sa.UniqueConstraint("event_id", "case_type",
                            name="uq_event_messaging_templates_event_case"),
    )
    op.create_index(
        "idx_event_messaging_templates_event",
        "event_messaging_templates",
        ["event_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_event_messaging_templates_event",
                  table_name="event_messaging_templates")
    op.drop_table("event_messaging_templates")
