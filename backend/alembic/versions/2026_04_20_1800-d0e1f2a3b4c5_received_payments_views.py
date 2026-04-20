"""received_payments_views

Behaviour-only release: introduces the `/received-payments/...` endpoints
and changes wallet-credit semantics so that ONLY `wallet_topup`
transactions credit `wallets.available_balance`. Contributions, ticket
purchases and service bookings are surfaced via the new endpoints rather
than via wallet ledger entries.

This migration intentionally adds NO schema changes — it exists so the
deployment pipeline records the release boundary and so future indexes
related to received-payment queries have a parent revision to chain off.

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-04-20 18:00:00
"""
from typing import Sequence, Union

from alembic import op  # noqa: F401  (kept for future ops)
import sqlalchemy as sa  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = "d0e1f2a3b4c5"
down_revision: Union[str, None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # No schema change — release marker only.
    # Existing `transactions(target_type, target_id)` index already covers
    # the new received-payments queries.
    pass


def downgrade() -> None:
    pass
