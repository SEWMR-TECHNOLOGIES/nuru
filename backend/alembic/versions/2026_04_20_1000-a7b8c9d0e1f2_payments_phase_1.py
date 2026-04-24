"""payments phase 1 — wallets, transactions, providers, commissions, ledger

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-04-20 10:00:00.000000

Creates the multi-country wallet & payment infrastructure:

  Enums
    payment_provider_type_enum, payment_target_type_enum,
    transaction_status_enum, wallet_entry_type_enum, payout_method_type_enum

  Tables
    payment_providers, commission_settings, wallets, payment_profiles,
    transactions, wallet_ledger_entries, mobile_payment_attempts,
    payment_callback_logs

  user_profiles additions
    country_code, currency_code, country_source

  Seed data
    * Tanzania mobile money: MPESA, MIXX BY YAS, AIRTEL MONEY, HALOPESA
    * Tanzania banks:        CRDB, NMB, NBC
    * Kenya mobile money:    MPESA
    * Kenya banks:           CO-OPERATIVE BANK
    * Commission defaults:   TZ = 50 TZS, KE = 2 KES
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "a7b8c9d0e1f2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


# ─────────────────────────────────────────────────────────────────
# Enum definitions (reused for create + drop)
# ─────────────────────────────────────────────────────────────────
PROVIDER_TYPE = postgresql.ENUM(
    "mobile_money", "bank",
    name="payment_provider_type_enum",
)
TARGET_TYPE = postgresql.ENUM(
    "contribution", "ticket", "booking", "wallet_topup", "withdrawal", "settlement",
    name="payment_target_type_enum",
)
TX_STATUS = postgresql.ENUM(
    "pending", "processing", "paid", "credited", "failed", "reversed",
    name="transaction_status_enum",
)
LEDGER_TYPE = postgresql.ENUM(
    "credit", "debit", "hold", "release", "commission", "refund",
    "withdrawal", "adjustment",
    name="wallet_entry_type_enum",
)
PAYOUT_METHOD = postgresql.ENUM(
    "mobile_money", "bank",
    name="payout_method_type_enum",
)


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Create enums
    PROVIDER_TYPE.create(bind, checkfirst=True)
    TARGET_TYPE.create(bind, checkfirst=True)
    TX_STATUS.create(bind, checkfirst=True)
    LEDGER_TYPE.create(bind, checkfirst=True)
    PAYOUT_METHOD.create(bind, checkfirst=True)

    # 2. user_profiles additions
    op.add_column("user_profiles", sa.Column("country_code", sa.String(2), nullable=True))
    op.add_column("user_profiles", sa.Column("currency_code", sa.String(3), nullable=True))
    op.add_column("user_profiles", sa.Column("country_source", sa.Text(), nullable=True))
    # Backfill country_code / currency_code from existing country_id where set.
    op.execute(
        """
        UPDATE user_profiles up
           SET country_code  = c.code,
               currency_code = cur.code
          FROM countries c
          LEFT JOIN currencies cur ON cur.id = c.currency_id
         WHERE up.country_id = c.id
           AND up.country_code IS NULL
        """
    )

    # 3. payment_providers
    op.create_table(
        "payment_providers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("currency_code", sa.String(3), nullable=False),
        sa.Column("provider_type",
                  postgresql.ENUM(name="payment_provider_type_enum", create_type=False),
                  nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("gateway_code", sa.Text(), nullable=True),
        sa.Column("logo_url", sa.Text(), nullable=True),
        sa.Column("is_collection_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_payout_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("country_code", "code", name="uq_payment_provider_country_code"),
    )
    op.create_index("ix_payment_provider_active_country", "payment_providers",
                    ["country_code", "is_active"])

    # 4. commission_settings
    op.create_table(
        "commission_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("currency_code", sa.String(3), nullable=False),
        sa.Column("commission_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    # One ACTIVE commission per country at any time.
    op.execute(
        "CREATE UNIQUE INDEX ux_commission_active_per_country "
        "ON commission_settings (country_code) WHERE is_active = TRUE"
    )

    # 5. wallets
    op.create_table(
        "wallets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("currency_code", sa.String(3), nullable=False),
        sa.Column("available_balance", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("pending_balance", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_received", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_sent", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_withdrawn", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "currency_code", name="uq_wallet_user_currency"),
    )
    op.create_index("ix_wallet_user", "wallets", ["user_id"])

    # 6. payment_profiles
    op.create_table(
        "payment_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("currency_code", sa.String(3), nullable=False),
        sa.Column("method_type",
                  postgresql.ENUM(name="payout_method_type_enum", create_type=False),
                  nullable=False),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("payment_providers.id"), nullable=True),
        sa.Column("network_name", sa.Text(), nullable=True),
        sa.Column("phone_number", sa.Text(), nullable=True),
        sa.Column("bank_name", sa.Text(), nullable=True),
        sa.Column("account_number", sa.Text(), nullable=True),
        sa.Column("account_holder_name", sa.Text(), nullable=False),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_payment_profile_user", "payment_profiles", ["user_id"])
    op.execute(
        "CREATE UNIQUE INDEX ux_payment_profile_one_default "
        "ON payment_profiles (user_id) WHERE is_default = TRUE"
    )

    # 7. transactions
    op.create_table(
        "transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("transaction_code", sa.Text(), nullable=False, unique=True),
        sa.Column("payer_user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=True),
        sa.Column("beneficiary_user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=True),
        sa.Column("target_type",
                  postgresql.ENUM(name="payment_target_type_enum", create_type=False),
                  nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("currency_code", sa.String(3), nullable=False),
        sa.Column("gross_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("commission_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("net_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("commission_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("method_type", sa.Text(), nullable=False),
        sa.Column("provider_name", sa.Text(), nullable=True),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("payment_providers.id"), nullable=True),
        sa.Column("payment_channel", sa.Text(), nullable=True),
        sa.Column("external_reference", sa.Text(), nullable=True),
        sa.Column("internal_reference", sa.Text(), nullable=True),
        sa.Column("payment_description", sa.Text(), nullable=False),
        sa.Column("status",
                  postgresql.ENUM(name="transaction_status_enum", create_type=False),
                  nullable=False, server_default="pending"),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("api_request_payload_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("api_response_payload_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("callback_payload_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("initiated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_transaction_payer", "transactions", ["payer_user_id"])
    op.create_index("ix_transaction_beneficiary", "transactions", ["beneficiary_user_id"])
    op.create_index("ix_transaction_target", "transactions", ["target_type", "target_id"])
    op.create_index("ix_transaction_status_created", "transactions", ["status", "created_at"])
    op.create_index("ix_transaction_external_ref", "transactions", ["external_reference"])

    # 8. wallet_ledger_entries
    op.create_table(
        "wallet_ledger_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("wallet_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("transaction_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("transactions.id"), nullable=True),
        sa.Column("entry_type",
                  postgresql.ENUM(name="wallet_entry_type_enum", create_type=False),
                  nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("balance_before", sa.Numeric(14, 2), nullable=False),
        sa.Column("balance_after", sa.Numeric(14, 2), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_ledger_wallet_created", "wallet_ledger_entries", ["wallet_id", "created_at"])
    op.create_index("ix_ledger_transaction", "wallet_ledger_entries", ["transaction_id"])

    # 9. mobile_payment_attempts
    op.create_table(
        "mobile_payment_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("transaction_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("gateway", sa.Text(), nullable=True),
        sa.Column("provider_name", sa.Text(), nullable=True),
        sa.Column("network_code", sa.Text(), nullable=True),
        sa.Column("phone_number", sa.Text(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("merchant_request_id", sa.Text(), nullable=True),
        sa.Column("checkout_request_id", sa.Text(), nullable=True),
        sa.Column("transaction_reference", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("response_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_mobile_attempt_checkout", "mobile_payment_attempts", ["checkout_request_id"])
    op.create_index("ix_mobile_attempt_transaction", "mobile_payment_attempts", ["transaction_id"])

    # 10. payment_callback_logs
    op.create_table(
        "payment_callback_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("gateway", sa.Text(), nullable=True),
        sa.Column("checkout_request_id", sa.Text(), nullable=True),
        sa.Column("transaction_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("transactions.id"), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("headers", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("processed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("processing_error", sa.Text(), nullable=True),
        sa.Column("received_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_callback_checkout", "payment_callback_logs", ["checkout_request_id"])
    op.create_index("ix_callback_transaction", "payment_callback_logs", ["transaction_id"])

    # ─────────────────────────────────────────────────────────────
    # 11. SEED DATA — providers + commissions
    # ─────────────────────────────────────────────────────────────
    providers = [
        # Tanzania mobile money
        ("TZ", "TZS", "mobile_money", "MPESA",        "MPESA_TZ",    "VODACOM",       1),
        ("TZ", "TZS", "mobile_money", "MIXX BY YAS",  "MIXX_TZ",     "TIGO",          2),
        ("TZ", "TZS", "mobile_money", "AIRTEL MONEY", "AIRTEL_TZ",   "AIRTELMONEYTZ", 3),
        ("TZ", "TZS", "mobile_money", "HALOPESA",     "HALOPESA_TZ", "HALOPESA",      4),
        # Tanzania banks
        ("TZ", "TZS", "bank", "CRDB BANK",            "CRDB_TZ",     None, 10),
        ("TZ", "TZS", "bank", "NMB BANK",             "NMB_TZ",      None, 11),
        ("TZ", "TZS", "bank", "NBC BANK",             "NBC_TZ",      None, 12),
        # Kenya mobile money
        ("KE", "KES", "mobile_money", "MPESA",        "MPESA_KE",    "MPESA", 1),
        # Kenya banks
        ("KE", "KES", "bank", "CO-OPERATIVE BANK",    "COOP_KE",     None, 10),
    ]
    rows_sql = []
    for (cc, cur, ptype, name, code, gw, order) in providers:
        gw_sql = "NULL" if gw is None else "'" + gw + "'"
        rows_sql.append(
            f"('{cc}', '{cur}', '{ptype}', '{name}', '{code}', "
            f"{gw_sql}, {order}, TRUE, TRUE, TRUE)"
        )
    op.execute(
        "INSERT INTO payment_providers "
        "(country_code, currency_code, provider_type, name, code, "
        "gateway_code, display_order, is_collection_enabled, "
        "is_payout_enabled, is_active) VALUES "
        + ",\n".join(rows_sql)
    )

    # Commission defaults
    op.execute(
        """
        INSERT INTO commission_settings
            (country_code, currency_code, commission_amount, is_active, notes)
        VALUES
            ('TZ', 'TZS', 50, TRUE, 'Phase 1 default commission for Tanzania'),
            ('KE', 'KES',  2, TRUE, 'Phase 1 default commission for Kenya')
        """
    )


def downgrade() -> None:
    # Drop tables in reverse FK order
    op.drop_index("ix_callback_transaction", table_name="payment_callback_logs")
    op.drop_index("ix_callback_checkout", table_name="payment_callback_logs")
    op.drop_table("payment_callback_logs")

    op.drop_index("ix_mobile_attempt_transaction", table_name="mobile_payment_attempts")
    op.drop_index("ix_mobile_attempt_checkout", table_name="mobile_payment_attempts")
    op.drop_table("mobile_payment_attempts")

    op.drop_index("ix_ledger_transaction", table_name="wallet_ledger_entries")
    op.drop_index("ix_ledger_wallet_created", table_name="wallet_ledger_entries")
    op.drop_table("wallet_ledger_entries")

    op.drop_index("ix_transaction_external_ref", table_name="transactions")
    op.drop_index("ix_transaction_status_created", table_name="transactions")
    op.drop_index("ix_transaction_target", table_name="transactions")
    op.drop_index("ix_transaction_beneficiary", table_name="transactions")
    op.drop_index("ix_transaction_payer", table_name="transactions")
    op.drop_table("transactions")

    op.execute("DROP INDEX IF EXISTS ux_payment_profile_one_default")
    op.drop_index("ix_payment_profile_user", table_name="payment_profiles")
    op.drop_table("payment_profiles")

    op.drop_index("ix_wallet_user", table_name="wallets")
    op.drop_table("wallets")

    op.execute("DROP INDEX IF EXISTS ux_commission_active_per_country")
    op.drop_table("commission_settings")

    op.drop_index("ix_payment_provider_active_country", table_name="payment_providers")
    op.drop_table("payment_providers")

    op.drop_column("user_profiles", "country_source")
    op.drop_column("user_profiles", "currency_code")
    op.drop_column("user_profiles", "country_code")

    bind = op.get_bind()
    PAYOUT_METHOD.drop(bind, checkfirst=True)
    LEDGER_TYPE.drop(bind, checkfirst=True)
    TX_STATUS.drop(bind, checkfirst=True)
    TARGET_TYPE.drop(bind, checkfirst=True)
    PROVIDER_TYPE.drop(bind, checkfirst=True)
