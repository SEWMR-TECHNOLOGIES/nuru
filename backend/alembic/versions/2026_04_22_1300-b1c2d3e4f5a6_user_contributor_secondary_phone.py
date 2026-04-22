"""add secondary_phone and notify_target to user_contributors

Revision ID: b1c2d3e4f5a6
Revises: a0b1c2d3e4f5
Create Date: 2026-04-22 13:00:00.000000

Adds default secondary contact + notification routing to the address-book
UserContributor record. These act as defaults whenever the contributor is
later added to an event (the per-event EventContributor row keeps its own
override).

Fields:
  - user_contributors.secondary_phone   (nullable text)
  - user_contributors.notify_target     ('primary' | 'secondary' | 'both',
                                         default 'primary', NOT NULL)

NOTE: secondary_phone is comms-only. It is NEVER used to map a Nuru user
account or for any other platform feature.
"""
from alembic import op
import sqlalchemy as sa


revision = "b1c2d3e4f5a6"
down_revision = "a0b1c2d3e4f5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_contributors",
        sa.Column("secondary_phone", sa.Text(), nullable=True),
    )
    op.add_column(
        "user_contributors",
        sa.Column(
            "notify_target",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'primary'"),
        ),
    )
    op.create_check_constraint(
        "ck_user_contributors_notify_target",
        "user_contributors",
        "notify_target IN ('primary', 'secondary', 'both')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_user_contributors_notify_target",
        "user_contributors",
        type_="check",
    )
    op.drop_column("user_contributors", "notify_target")
    op.drop_column("user_contributors", "secondary_phone")
