"""Phase 1.2 — cancellation_tier on service_types + auto-seed

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-18 14:30:00.000000

Adds the `cancellation_tier_enum` and the `cancellation_tier` column on
`service_types`, then seeds defaults from the policy doc:

  Strict   — catering, decor (large), hotel, transport, stage, tents
  Moderate — DJ, photographer, videographer, sound, lighting (default)
  Flexible — MC, planner, makeup, hair, usher, host

Mapping is keyword-based on `service_types.name` / `service_categories.name`
so it works for any locale of category labels. Categories that don't match
fall back to Moderate (the safe middle).
"""
from alembic import op
import sqlalchemy as sa


revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


TIER_ENUM = sa.Enum("flexible", "moderate", "strict", name="cancellation_tier_enum")


STRICT_KEYWORDS = [
    "catering", "food", "chef", "hotel", "venue", "stage",
    "tent", "marquee", "transport", "bus", "shuttle", "decor",
]
FLEXIBLE_KEYWORDS = [
    "mc", "host", "planner", "coordinator", "makeup",
    "hair", "usher", "ushering",
]


def upgrade() -> None:
    bind = op.get_bind()
    TIER_ENUM.create(bind, checkfirst=True)

    op.add_column(
        "service_types",
        sa.Column(
            "cancellation_tier",
            sa.Enum(name="cancellation_tier_enum", create_type=False),
            nullable=False,
            server_default="moderate",
        ),
    )

    # Auto-seed from policy doc keywords. Lowercase match on type name + category name.
    for kw in STRICT_KEYWORDS:
        op.execute(
            sa.text(
                """
                UPDATE service_types st
                SET cancellation_tier = 'strict'
                FROM service_categories sc
                WHERE (st.category_id = sc.id OR st.category_id IS NULL)
                  AND (lower(st.name) LIKE :pat OR lower(coalesce(sc.name, '')) LIKE :pat)
                """
            ).bindparams(pat=f"%{kw}%")
        )
    for kw in FLEXIBLE_KEYWORDS:
        op.execute(
            sa.text(
                """
                UPDATE service_types st
                SET cancellation_tier = 'flexible'
                FROM service_categories sc
                WHERE (st.category_id = sc.id OR st.category_id IS NULL)
                  AND (lower(st.name) LIKE :pat OR lower(coalesce(sc.name, '')) LIKE :pat)
                  AND st.cancellation_tier <> 'strict'
                """
            ).bindparams(pat=f"%{kw}%")
        )


def downgrade() -> None:
    op.drop_column("service_types", "cancellation_tier")
    bind = op.get_bind()
    sa.Enum(name="cancellation_tier_enum").drop(bind, checkfirst=True)
