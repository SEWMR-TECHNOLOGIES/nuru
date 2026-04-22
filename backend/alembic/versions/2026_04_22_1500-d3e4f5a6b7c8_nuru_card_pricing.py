"""nuru card pricing per currency

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-04-22 15:00:00.000000

Stores Nuru Card pricing by card type and currency so the UI no longer
hardcodes "TZS 50,000". Supports TZS (Tanzania) and KES (Kenya).
"""
from alembic import op
import sqlalchemy as sa


revision = "d3e4f5a6b7c8"
down_revision = "c2d3e4f5a6b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "nuru_card_pricing",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True),
                  primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("card_type", sa.Text, nullable=False),       # 'standard' | 'premium'
        sa.Column("currency_code", sa.Text, nullable=False),   # 'TZS' | 'KES'
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("card_type", "currency_code", name="uq_nuru_card_pricing_type_ccy"),
    )

    # Seed: Premium = TZS 50,000 ≈ KES 1,950 (Standard is free).
    op.execute("""
        INSERT INTO nuru_card_pricing (card_type, currency_code, amount) VALUES
            ('standard', 'TZS', 0),
            ('standard', 'KES', 0),
            ('premium',  'TZS', 50000),
            ('premium',  'KES', 1950)
        ON CONFLICT (card_type, currency_code) DO NOTHING;
    """)


def downgrade() -> None:
    op.drop_table("nuru_card_pricing")
