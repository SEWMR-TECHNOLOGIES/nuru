/**
 * Withdrawals API — admin-mediated payouts (NOT routed through SasaPay).
 *
 * Flow:
 *   1. User: POST /withdrawals       → places hold on wallet, status=pending
 *   2. Admin reviews → approve / reject / settle (via adminWithdrawalsApi)
 *   3. Settle writes a `withdrawal` ledger entry on the wallet.
 */

import { get, post, buildQueryString } from "./helpers";
import type { PaginatedResponse } from "./types";

export type WithdrawalStatus =
  | "pending"
  | "approved"
  | "settled"
  | "rejected"
  | "cancelled";

export interface WithdrawalRequest {
  id: string;
  request_code: string;
  user_id: string;
  wallet_id: string;
  payment_profile_id: string | null;
  currency_code: string;
  amount: number;
  user_note: string | null;
  payout_method: string | null;
  payout_provider_name: string | null;
  payout_account_holder: string | null;
  payout_account_number: string | null;
  status: WithdrawalStatus;
  admin_note: string | null;
  external_reference: string | null;
  requested_at: string | null;
  reviewed_at: string | null;
  settled_at: string | null;
}

export interface CreateWithdrawalRequest {
  currency_code: string;
  amount: number;
  payment_profile_id?: string;
  user_note?: string;
}

export interface ListWithdrawalsParams {
  page?: number;
  limit?: number;
  status?: WithdrawalStatus;
}

export const withdrawalsApi = {
  create: (data: CreateWithdrawalRequest) =>
    post<WithdrawalRequest>("/withdrawals", data),

  list: (params?: ListWithdrawalsParams) =>
    get<{
      withdrawals: WithdrawalRequest[];
      pagination: PaginatedResponse<WithdrawalRequest>["pagination"];
    }>(`/withdrawals${buildQueryString(params)}`),

  getById: (id: string) => get<WithdrawalRequest>(`/withdrawals/${id}`),

  cancel: (id: string) => post<WithdrawalRequest>(`/withdrawals/${id}/cancel`, {}),
};
