"""mobile_payment_attempts: capture full SasaPay C2B callback fields

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-05-02 10:00:00.000000

Adds dedicated columns to ``mobile_payment_attempts`` so we persist every
field SasaPay echoes on the C2B Callback (and IPN) — instead of only stuffing
them into the JSON snapshot. This makes ops queries / receipts / disputes
trivial: we no longer have to JSON-extract from ``response_payload``.

Fields added (per SasaPay spec):
  * payment_request_id       — PaymentRequestID
  * third_party_trans_id     — ThirdPartyTransID
  * source_channel           — SourceChannel ("M-PESA", "AIRTEL", …)
  * bill_ref_number          — BillRefNumber
  * requested_amount         — RequestedAmount (decimal)
  * paid_amount              — TransAmount (decimal, actual amount paid)
  * customer_mobile          — CustomerMobile (masked / international)
  * transaction_date         — TransactionDate (YYYYMMDDHHMMSS)
  * result_code              — ResultCode ("0" = success)
  * result_desc              — ResultDesc

All columns are nullable + idempotent (IF NOT EXISTS guards) so re-runs and
historic rows stay valid.
"""
from alembic import op
import sqlalchemy as sa


revision = "c8d9e0f1a2b3"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None


_NEW_COLUMNS = [
    ("payment_request_id", sa.Text()),
    ("third_party_trans_id", sa.Text()),
    ("source_channel", sa.Text()),
    ("bill_ref_number", sa.Text()),
    ("requested_amount", sa.Numeric(14, 2)),
    ("paid_amount", sa.Numeric(14, 2)),
    ("customer_mobile", sa.Text()),
    ("transaction_date", sa.Text()),
    ("result_code", sa.Text()),
    ("result_desc", sa.Text()),
]


def upgrade() -> None:
    for name, coltype in _NEW_COLUMNS:
        op.execute(sa.text(
            f"ALTER TABLE mobile_payment_attempts "
            f"ADD COLUMN IF NOT EXISTS {name} "
            f"{coltype.compile(dialect=op.get_bind().dialect)}"
        ))
    # Helpful lookups for ops/dispute tooling.
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_mobile_attempt_payment_request "
        "ON mobile_payment_attempts (payment_request_id)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_mobile_attempt_third_party "
        "ON mobile_payment_attempts (third_party_trans_id)"
    ))


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_mobile_attempt_third_party"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_mobile_attempt_payment_request"))
    for name, _ in _NEW_COLUMNS:
        op.execute(sa.text(
            f"ALTER TABLE mobile_payment_attempts DROP COLUMN IF EXISTS {name}"
        ))
