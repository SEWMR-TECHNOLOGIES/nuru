/**
 * Payment & wallet API types — Phase 3.
 *
 * Mirrors the SQLAlchemy models added in `backend/app/models/payments.py`.
 * Keep this file additive: existing screens import from `@/lib/api` so adding
 * fields here is safe, but renaming/removing requires a sweep.
 */

export type CountryCode = "TZ" | "KE";
export type CurrencyCode = "TZS" | "KES";

export type PaymentProviderType =
  | "mobile_money"
  | "bank"
  | "card"
  | "wallet";

export type PaymentTargetType =
  | "event_ticket"
  | "event_contribution"
  | "service_booking"
  | "wallet_topup"
  | "payout"
  | "other";

export type TransactionStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "paid"
  | "credited"
  | "failed"
  | "cancelled"
  | "refunded";

export type WalletEntryType =
  | "credit"
  | "debit"
  | "hold"
  | "release"
  | "settlement"
  | "reversal";

export type CountrySource = "ip" | "phone" | "locale" | "manual";

export type PayoutMethodType =
  | "mobile_money"
  | "bank_account";

// ============================================================================
// WALLET
// ============================================================================

export interface Wallet {
  id: string;
  user_id: string;
  currency_code: CurrencyCode;
  available_balance: number;
  pending_balance: number;
  reserved_balance: number;
  total_inflow: number;
  total_outflow: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WalletLedgerEntry {
  id: string;
  wallet_id: string;
  entry_type: WalletEntryType;
  amount: number;
  balance_before: number;
  balance_after: number;
  currency_code: CurrencyCode;
  description: string | null;
  transaction_id: string | null;
  reference_code: string | null;
  created_at: string;
}

// ============================================================================
// PROVIDERS & COMMISSIONS
// ============================================================================

export interface PaymentProvider {
  id: string;
  code: string;
  /**
   * Human-readable name from the backend (`name` column on payment_providers,
   * e.g. "MPESA", "MIXX BY YAS"). Backend response field is `name`; we keep
   * `display_name` as an alias for legacy callers.
   */
  name: string;
  display_name?: string;
  provider_type: PaymentProviderType;
  country_code: CountryCode;
  currency_code: CurrencyCode;
  logo_url: string | null;
  is_active?: boolean;
  is_default?: boolean;
  supports_collection?: boolean;
  supports_payout?: boolean;
  is_collection_enabled?: boolean;
  is_payout_enabled?: boolean;
  min_amount?: number | null;
  max_amount?: number | null;
  display_order: number;
}

export interface CommissionSetting {
  id: string;
  country_code: CountryCode;
  currency_code: CurrencyCode;
  commission_amount: number;
  is_active: boolean;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ============================================================================
// PAYMENT PROFILES (payout destinations)
// ============================================================================

/**
 * Payout profile as returned by `GET /payment-profiles`.
 *
 * Field names mirror the backend `_serialize` exactly — do not invent aliases.
 */
export interface PaymentProfile {
  id: string;
  country_code: CountryCode | string;
  currency_code: CurrencyCode | string;
  /** "mobile_money" | "bank" — backend uses 'bank', not 'bank_account'. */
  method_type: "mobile_money" | "bank";
  provider_id: string | null;
  network_name: string | null;
  phone_number: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder_name: string;
  is_completed: boolean;
  is_verified: boolean;
  is_default: boolean;
  created_at: string | null;
}

/**
 * Payload accepted by `POST /payment-profiles` (and PATCH).
 *
 * Field names mirror the backend (`payment_profiles.py`) which expects
 * `account_holder_name`, `phone_number`, `network_name`, `bank_name`,
 * `currency_code`, `is_default` — NOT the camel-ish names we used previously.
 *
 * `method_type` accepts:
 *   - "mobile_money" — phone_number + network_name required
 *   - "bank"         — bank_name + account_number required
 */
export interface CreatePaymentProfileRequest {
  method_type: "mobile_money" | "bank";
  provider_id: string;
  country_code: CountryCode | string;
  currency_code: CurrencyCode | string;
  account_holder_name: string;
  account_number?: string;
  phone_number?: string;
  network_name?: string;
  bank_name?: string;
  bank_branch?: string;
  bank_swift?: string;
  is_default?: boolean;
}

// ============================================================================
// TRANSACTIONS & PAYMENTS
// ============================================================================

export interface CommissionSnapshot {
  flat_fee: number;
  percent_fee: number;
  computed_fee: number;
  currency_code: CurrencyCode;
}

export interface Transaction {
  id: string;
  transaction_code: string;
  user_id?: string;
  payer_user_id?: string | null;
  beneficiary_user_id?: string | null;
  target_type: PaymentTargetType;
  target_id: string | null;
  country_code?: string;
  provider_id?: string | null;
  /** Legacy nested provider snapshot (kept for older endpoints). */
  provider?: PaymentProvider;
  /** Backend field — string, not a nested object. */
  provider_name?: string | null;
  method_type?: string | null;
  payment_channel?: string | null;
  external_reference?: string | null;
  internal_reference?: string | null;
  status: TransactionStatus;
  gross_amount: number;
  commission_amount?: number;
  net_amount: number;
  currency_code: CurrencyCode;
  commission_snapshot?: CommissionSnapshot | null;
  /** Backend uses `payment_description`; older payload exposed `description`. */
  description?: string | null;
  payment_description?: string | null;
  failure_reason: string | null;
  initiated_at?: string | null;
  confirmed_at?: string | null;
  completed_at?: string | null;
  /** Not always returned — fall back to `initiated_at` when missing. */
  created_at?: string | null;
}

export interface InitiatePaymentRequest {
  target_type: PaymentTargetType;
  target_id?: string;
  /** Backend field name — major units (e.g. 2000 = 2,000 TZS). */
  gross_amount: number;
  country_code: CountryCode | string;
  currency_code: CurrencyCode | string;
  /** "mobile_money" | "bank" | "wallet". */
  method_type: "mobile_money" | "bank" | "wallet";
  /** "stk_push" for M-Pesa-style push, "bank" or "wallet" otherwise. */
  payment_channel?: string;
  /** Required by backend, min 8 chars. */
  payment_description: string;
  /** Required for mobile_money/bank, omitted for wallet payments. */
  provider_id?: string;
  /** Phone for mobile_money STK push (E.164 preferred). */
  phone_number?: string;
  /** Bank account number for bank transfers. */
  account_number?: string;
  beneficiary_user_id?: string;
}

export interface InitiatePaymentResponse {
  transaction: Transaction;
  /** STK-push reference returned by SasaPay so we can poll status. */
  gateway_reference: string | null;
  /** Human-friendly next step shown in the checkout modal. */
  user_message: string;
}

// ============================================================================
// ADMIN
// ============================================================================

/**
 * Payload accepted by `POST/PATCH /admin/payments/providers`.
 *
 * Field names mirror the backend (`admin_payments.py`): `name` (not
 * display_name), `is_collection_enabled` / `is_payout_enabled` (not the
 * `supports_*` aliases), and `gateway_code` for the integration adapter.
 */
export interface UpsertProviderRequest {
  code: string;
  name: string;
  provider_type: PaymentProviderType;
  country_code: CountryCode | string;
  currency_code: CurrencyCode | string;
  gateway_code?: string | null;
  logo_url?: string | null;
  is_active?: boolean;
  is_collection_enabled?: boolean;
  is_payout_enabled?: boolean;
  min_amount?: number | null;
  max_amount?: number | null;
  display_order?: number;
}

export interface UpsertCommissionRequest {
  country_code: CountryCode;
  currency_code: CurrencyCode;
  commission_amount: number;
  notes?: string;
  is_active?: boolean;
}

// ============================================================================
// COUNTRY / CURRENCY ON USER
// ============================================================================

export interface UserCountryProfile {
  country_code: CountryCode | null;
  currency_code: CurrencyCode | null;
  country_source: CountrySource | null;
}

export interface ConfirmCountryRequest {
  country_code: CountryCode;
  source?: CountrySource;
}
