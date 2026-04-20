/**
 * Admin Payments Ops API — finance dashboard endpoints under /admin/payments.
 *
 * IMPORTANT: All admin endpoints require the dedicated `admin_token` (set on
 * /admin/login), NOT the regular user `access_token`. We therefore use a local
 * helper that always attaches `admin_token` — using the generic helpers from
 * `./helpers` would attach the wrong token and produce a 403 "Not an admin
 * token" from the backend gate.
 */
// (no shared type imports needed)
import { buildQueryString } from "./helpers";
import { adminGet as aGet, adminPost as aPost } from "./adminHelpers";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export interface AdminPaymentsSummary {
  today: { gross: number; commission: number; net: number; count: number };
  week: { gross: number; commission: number; net: number; count: number };
  month: { gross: number; commission: number; net: number; count: number };
  failed_count_30d: number;
  refunded_count_30d: number;
  pending_payouts: { count: number; amount: number };
  completed_payouts_30d: { count: number; amount: number };
  wallet_liability: number;
  reviews_needed: number;
  series_30d: { date: string; gross: number; commission: number; net: number }[];
  country_mix_month: { country_code: string; gross: number; count: number }[];
  status_mix_month: { status: string; count: number }[];
}

export interface LedgerRow {
  id: string;
  transaction_code: string;
  created_at: string | null;
  completed_at: string | null;
  country_code: string;
  currency_code: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  status: string | null;
  method_type: string;
  provider_name: string | null;
  external_reference: string | null;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  payment_description: string;
  payer: { id: string; name: string; phone: string | null; email: string | null } | null;
  beneficiary: { id: string; name: string; phone: string | null; email: string | null } | null;
}

export interface SettlementRow {
  id: string;
  request_code: string;
  status: string;
  currency_code: string;
  amount: number;
  user_note: string | null;
  admin_note: string | null;
  external_reference: string | null;
  payout_method: string | null;
  payout_provider_name: string | null;
  payout_account_holder: string | null;
  payout_account_number: string | null;
  created_at: string | null;
  settled_at: string | null;
  age_days: number | null;
  priority: "low" | "medium" | "high";
  beneficiary: { id: string; name: string; phone: string | null; email: string | null } | null;
}

export interface ReportType { key: string; label: string }

export const adminPaymentsOpsApi = {
  summary: () => aGet<AdminPaymentsSummary>("/admin/payments/summary"),

  ledger: (params?: Record<string, string | number | undefined>) =>
    aGet<{ transactions: LedgerRow[]; pagination: any }>(
      `/admin/payments/ledger${buildQueryString(params)}`,
    ),

  ledgerDetail: (txId: string) =>
    aGet<LedgerRow & { commission_snapshot: any; ledger_entries: any[]; admin_history: any[] }>(
      `/admin/payments/ledger/${txId}`,
    ),

  settlements: (params?: Record<string, string | number | undefined>) =>
    aGet<{ settlements: SettlementRow[]; pagination: any }>(
      `/admin/payments/settlements${buildQueryString(params)}`,
    ),

  settlementAction: (
    sid: string,
    action: "start-review" | "mark-paid" | "hold" | "reject" | "escalate" | "note",
    body: Record<string, unknown>,
  ) => aPost<SettlementRow>(`/admin/payments/settlements/${sid}/${action}`, body),

  settlementHistory: (sid: string) =>
    aGet<{ history: any[] }>(`/admin/payments/settlements/${sid}/history`),

  beneficiary: (userId: string) =>
    aGet<any>(`/admin/payments/beneficiaries/${userId}`),

  reconciliation: () => aGet<any>("/admin/payments/reconciliation"),

  reportTypes: () => aGet<{ types: ReportType[] }>("/admin/payments/reports/types"),

  /** Build a download URL — caller must attach admin_token via fetch. */
  reportUrl: (type: string, format: "csv" | "pdf", from?: string, to?: string) => {
    const qs = buildQueryString({ type, format, date_from: from, date_to: to });
    return `${API_BASE_URL}/admin/payments/reports${qs}`;
  },
};
