/**
 * Escrow API client (Phase 1.1)
 */

import { get, post } from "./helpers";

export type EscrowHoldStatus =
  | "pending" | "held" | "partially_released"
  | "released" | "refunded" | "disputed";

export type EscrowTransactionType =
  | "HOLD_DEPOSIT" | "HOLD_BALANCE"
  | "RELEASE_TO_VENDOR" | "REFUND_TO_ORGANISER"
  | "COMMISSION_TO_NURU" | "FEE" | "ADJUSTMENT" | "SETTLED_TO_VENDOR";

export interface EscrowTransaction {
  id: string;
  type: EscrowTransactionType;
  amount: number;
  currency: string;
  reason_code?: string | null;
  notes?: string | null;
  external_ref?: string | null;
  actor_user_id?: string | null;
  created_at: string;
}

export interface EscrowHold {
  id: string;
  booking_id: string;
  currency: string;
  amount_total: number;
  amount_deposit: number;
  amount_balance: number;
  amount_released: number;
  amount_refunded: number;
  amount_currently_held: number;
  status: EscrowHoldStatus;
  auto_release_at?: string | null;
  settled_to_vendor_at?: string | null;
  vendor_user_id?: string | null;
  organiser_user_id?: string | null;
  created_at: string;
  updated_at: string;
  transactions?: EscrowTransaction[];
}

export const escrowApi = {
  getForBooking: (bookingId: string) =>
    get<EscrowHold>(`/escrow/booking/${bookingId}`),

  release: (bookingId: string, reason?: string) =>
    post<EscrowHold>(`/escrow/booking/${bookingId}/release`, { reason }),

  refund: (bookingId: string, amount: number, reason?: string) =>
    post<EscrowHold>(`/escrow/booking/${bookingId}/refund`, { amount, reason }),

  markSettled: (holdId: string, externalRef?: string) =>
    post<EscrowHold>(`/escrow/holds/${holdId}/mark-settled`, { external_ref: externalRef }),
};
