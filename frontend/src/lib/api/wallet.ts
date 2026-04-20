/**
 * Wallet API — balances, ledger history.
 */

import { get, buildQueryString } from "./helpers";
import type { Wallet, WalletLedgerEntry } from "./payments-types";
import type { PaginatedResponse } from "./types";

export interface LedgerQueryParams {
  page?: number;
  limit?: number;
  entry_type?: string;
}

export const walletApi = {
  /** Returns ALL wallets for the current user (one per currency). */
  list: () => get<{ wallets: Wallet[] }>("/wallet"),

  /** Single wallet for a given currency, e.g. TZS or KES. */
  getByCurrency: (currency: string) =>
    get<Wallet>(`/wallet/${encodeURIComponent(currency)}`),

  /** Paginated ledger entries (newest first). */
  getLedger: (walletId: string, params?: LedgerQueryParams) =>
    get<{
      entries: WalletLedgerEntry[];
      pagination: PaginatedResponse<WalletLedgerEntry>["pagination"];
    }>(`/wallet/${walletId}/ledger${buildQueryString(params)}`),
};
