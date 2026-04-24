/**
 * Payments API — initiate, poll status, list providers, list transactions.
 */

import { get, post, buildQueryString } from "./helpers";
import type {
  PaymentProvider,
  Transaction,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
} from "./payments-types";
import type { PaginatedResponse } from "./types";

export interface ListTransactionsParams {
  page?: number;
  limit?: number;
  status?: string;
  target_type?: string;
}

export interface ListProvidersParams {
  country_code: string;
  purpose?: "collection" | "payout";
}

export interface FeePreviewParams {
  country_code: string;
  currency_code: string;
  target_type: string;
  gross_amount: number;
}

export interface FeePreviewResult {
  requested_amount: number;
  commission_amount: number;
  total_charged: number;
  currency_code: string;
  country_code: string;
  target_type: string;
}

export const paymentsApi = {
  providers: (params: ListProvidersParams) =>
    get<PaymentProvider[]>(`/payments/providers${buildQueryString(params)}`),

  feePreview: (params: FeePreviewParams) =>
    get<FeePreviewResult>(`/payments/fee-preview${buildQueryString(params)}`),

  initiate: (data: InitiatePaymentRequest) =>
    post<InitiatePaymentResponse>("/payments/initiate", data),

  getStatus: (transactionId: string) =>
    get<Transaction>(`/payments/${encodeURIComponent(transactionId)}/status`),

  /** Public, unauthenticated receipt fetch — used by /shared/receipt links. */
  getPublic: (transactionCode: string) =>
    get<Transaction>(`/payments/public/${encodeURIComponent(transactionCode)}`),

  getById: (transactionId: string) =>
    get<Transaction>(`/payments/${transactionId}`),

  history: (params?: ListTransactionsParams) =>
    get<{
      transactions: Transaction[];
      pagination: PaginatedResponse<Transaction>["pagination"];
    }>(`/payments/my-transactions${buildQueryString(params)}`),
};
