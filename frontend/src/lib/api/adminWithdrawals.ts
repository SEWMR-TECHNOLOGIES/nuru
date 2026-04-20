/**
 * Admin Withdrawals API — review user-submitted withdrawal requests.
 * All routes require an admin JWT (enforced server-side).
 */

import { get, post, buildQueryString } from "./helpers";
import type {
  WithdrawalRequest,
  WithdrawalStatus,
  ListWithdrawalsParams,
} from "./withdrawals";
import type { PaginatedResponse } from "./types";

export interface AdminSettlePayload {
  external_reference?: string;
  note?: string;
}

export interface AdminApprovePayload {
  note?: string;
}

export interface AdminRejectPayload {
  note: string;
}

export const adminWithdrawalsApi = {
  list: (params?: ListWithdrawalsParams) =>
    get<{
      withdrawals: WithdrawalRequest[];
      pagination: PaginatedResponse<WithdrawalRequest>["pagination"];
    }>(`/admin/withdrawals${buildQueryString(params)}`),

  getById: (id: string) => get<WithdrawalRequest>(`/admin/withdrawals/${id}`),

  approve: (id: string, data: AdminApprovePayload = {}) =>
    post<WithdrawalRequest>(`/admin/withdrawals/${id}/approve`, data),

  /** Records the wallet `withdrawal()` ledger entry — pending → 0. */
  settle: (id: string, data: AdminSettlePayload = {}) =>
    post<WithdrawalRequest>(`/admin/withdrawals/${id}/settle`, data),

  /** Releases held funds back to available. Note required. */
  reject: (id: string, data: AdminRejectPayload) =>
    post<WithdrawalRequest>(`/admin/withdrawals/${id}/reject`, data),
};

export type { WithdrawalRequest, WithdrawalStatus };
