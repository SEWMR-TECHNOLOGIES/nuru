/**
 * Cancellations API (Phase 1.2)
 */

import { get, post, buildQueryString } from "./helpers";

export type CancellationTier = "flexible" | "moderate" | "strict";
export type CancellingParty = "organiser" | "vendor";

export interface RefundBreakdown {
  tier: CancellationTier;
  cancelling_party: CancellingParty;
  deposit: number;
  balance: number;
  total: number;
  refund_to_organiser: number;
  vendor_retention: number;
  deposit_refunded: number;
  deposit_retained: number;
  balance_refunded: number;
  balance_retained: number;
  reason_code: string;
  human_summary: string;
  hours_until_event: number;
}

export const cancellationApi = {
  /** Preview the refund breakdown without cancelling. */
  preview: (bookingId: string, cancellingParty: CancellingParty = "organiser") =>
    get<RefundBreakdown>(
      `/bookings/${bookingId}/refund-preview${buildQueryString({ cancelling_party: cancellingParty })}`,
    ),

  /** Cancel the booking; backend re-runs the calculator and applies the refund. */
  cancel: (bookingId: string, reason: string) =>
    post<{
      booking_id: string;
      status: string;
      refund: RefundBreakdown;
    }>(`/bookings/${bookingId}/cancel`, { reason }),
};
