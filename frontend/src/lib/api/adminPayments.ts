/**
 * Admin Payments API — manage providers, commissions, manual settlements.
 * All routes require an admin JWT (enforced server-side).
 */

import { adminGet as get, adminPost as post, adminPatch as patch, adminDel as del } from "./adminHelpers";
import { buildQueryString } from "./helpers";
import type {
  PaymentProvider,
  CommissionSetting,
  Transaction,
  UpsertProviderRequest,
  UpsertCommissionRequest,
} from "./payments-types";
import type { PaginatedResponse } from "./types";

export interface AdminTxQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  country_code?: string;
  target_type?: string;
}

export const adminPaymentsApi = {
  // -------- Providers --------
  // Backend returns `{ success, message, data: PaymentProvider[] }` — a plain
  // array, NOT `{ providers: [...] }`. Callers should use `res.data` directly.
  listProviders: (params?: { country_code?: string }) =>
    get<PaymentProvider[]>(
      `/admin/payments/providers${buildQueryString(params)}`
    ),

  createProvider: (data: UpsertProviderRequest) =>
    post<PaymentProvider>("/admin/payments/providers", data),

  updateProvider: (id: string, data: Partial<UpsertProviderRequest>) =>
    patch<PaymentProvider>(`/admin/payments/providers/${id}`, data),

  deleteProvider: (id: string) => del(`/admin/payments/providers/${id}`),

  // -------- Commissions --------
  // Same flat-array shape as providers.
  listCommissions: (params?: { country_code?: string }) =>
    get<CommissionSetting[]>(
      `/admin/payments/commissions${buildQueryString(params)}`
    ),

  createCommission: (data: UpsertCommissionRequest) =>
    post<CommissionSetting>("/admin/payments/commissions", data),

  updateCommission: (id: string, data: Partial<UpsertCommissionRequest>) =>
    patch<CommissionSetting>(`/admin/payments/commissions/${id}`, data),

  deleteCommission: (id: string) => del(`/admin/payments/commissions/${id}`),

  // -------- Transactions --------
  listTransactions: (params?: AdminTxQueryParams) =>
    get<{
      transactions: Transaction[];
      pagination: PaginatedResponse<Transaction>["pagination"];
    }>(`/admin/payments/transactions${buildQueryString(params)}`),

  /** Force a transaction to a terminal state (rare, audit-logged server side). */
  manualSettle: (transactionId: string, data: { status: string; note: string }) =>
    post<Transaction>(
      `/admin/payments/transactions/${transactionId}/settle`,
      data
    ),
};
