"""add secondary_phone and notify_target to event_contributors (idempotent)

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-04-23 10:00:00.000000

Mirrors the address-book secondary contact columns onto each per-event
EventContributor row. Idempotent: skips columns/constraints that already
exist (some environments had them added out-of-band).
"""
from alembic import op
import sqlalchemy as sa


revision = "e4f5a6b7c8d9"
down_revision = "d3e4f5a6b7c8"
branch_labels = None
depends_on = None


def _has_column(bind, table: str, column: str) -> bool:
    insp = sa.inspect(bind)
    return any(c["name"] == column for c in insp.get_columns(table))


def _has_check_constraint(bind, table: str, name: str) -> bool:
    insp = sa.inspect(bind)
    try:
        return any(c.get("name") == name for c in insp.get_check_constraints(table))
    except NotImplementedError:
        return False


def upgrade() -> None:
    bind = op.get_bind()

    if not _has_column(bind, "event_contributors", "secondary_phone"):
        op.add_column(
            "event_contributors",
            sa.Column("secondary_phone", sa.Text(), nullable=True),
        )

    if not _has_column(bind, "event_contributors", "notify_target"):
        op.add_column(
            "event_contributors",
            sa.Column(
                "notify_target",
                sa.Text(),
                nullable=False,
                server_default=sa.text("'primary'"),
            ),
        )

    if not _has_check_constraint(bind, "event_contributors", "ck_event_contributors_notify_target"):
        op.create_check_constraint(
            "ck_event_contributors_notify_target",
            "event_contributors",
            "notify_target IN ('primary', 'secondary', 'both')",
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _has_check_constraint(bind, "event_contributors", "ck_event_contributors_notify_target"):
        op.drop_constraint(
            "ck_event_contributors_notify_target",
            "event_contributors",
            type_="check",
        )
    if _has_column(bind, "event_contributors", "notify_target"):
        op.drop_column("event_contributors", "notify_target")
    if _has_column(bind, "event_contributors", "secondary_phone"):
        op.drop_column("event_contributors", "secondary_phone")
