/**
 * Public (unauthenticated) Guest Contribution Links API.
 *
 * Backed by /api/v1/public/contributions/{token}/* on the server.
 * Used by the /c/:token page that contributors who do NOT have a Nuru
 * account open from an SMS to pay a pledge.
 *
 * NOTE: every call here intentionally bypasses auth. We still hit the same
 * /api/v1 base URL, the helpers just send no Authorization header that the
 * backend cares about for these routes (the backend doesn't require one).
 */
import { get, post } from "./helpers";
import type { Transaction } from "./payments-types";

export interface PublicContributionState {
  event: {
    id: string | null;
    name: string;
    cover_image_url: string | null;
    start_date: string | null;
    location: string | null;
    organiser_name: string;
  };
  contributor: { name: string; phone: string | null };
  country_code: "TZ" | "KE" | string;
  currency_code: string;
  pledge_amount: number;
  total_paid: number;
  balance: number;
  host: string; // e.g. "nuru.tz"
  recent_transactions: Array<{
    id: string;
    transaction_code: string;
    status: string | null;
    gross_amount: number;
    currency_code: string;
    method_type: string | null;
    failure_reason: string | null;
    created_at: string | null;
  }>;
}

export interface PublicInitiateBody {
  amount: number;
  phone_number: string;
  provider_id?: string;
  payment_description?: string;
}

export interface PublicInitiateResponse {
  transaction: {
    id: string;
    transaction_code: string;
    status: string;
    gross_amount: number;
    currency_code: string;
    failure_reason: string | null;
  };
  checkout_request_id: string;
}

export interface PublicTransactionStatus {
  id: string;
  transaction_code: string;
  status: string | null;
  gross_amount: number;
  currency_code: string;
  failure_reason: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
}

export const publicContributionsApi = {
  /** Load page state — event/contributor/balance/recent attempts. */
  getState: (token: string) =>
    get<PublicContributionState>(`/public/contributions/${encodeURIComponent(token)}`),

  /** Trigger an STK push toward this contributor's pledge (no login). */
  initiate: (token: string, body: PublicInitiateBody) =>
    post<PublicInitiateResponse>(
      `/public/contributions/${encodeURIComponent(token)}/initiate`,
      body,
    ),

  /** Poll a public transaction by id. Re-polls the gateway server-side. */
  status: (token: string, transactionId: string) =>
    get<PublicTransactionStatus>(
      `/public/contributions/${encodeURIComponent(token)}/transactions/${encodeURIComponent(transactionId)}`,
    ),
};

/** Treat these statuses as "the money has landed". */
export const isTerminalSuccess = (status: string | null | undefined) =>
  status === "succeeded" || status === "paid" || status === "credited";

/** Re-export type alias for convenience at call sites. */
export type PublicTx = PublicTransactionStatus | Transaction;
