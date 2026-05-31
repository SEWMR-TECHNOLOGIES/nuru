"""Add share_token_plain to event_contributors

Persist the plain share token alongside the hash so we can reuse the same
public payment URL across "Share payment link" clicks instead of rotating
the token (and SMS link) every time. The plain value is intentionally
shareable — it lives in SMS/WhatsApp messages — so storing it is fine.

Revision ID: cafe27051800
Revises: cafe27051700
"""
from alembic import op
import sqlalchemy as sa


revision = "cafe27051800"
down_revision = "cafe27051700"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("event_contributors") as batch_op:
        batch_op.add_column(sa.Column("share_token_plain", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("event_contributors") as batch_op:
        batch_op.drop_column("share_token_plain")
