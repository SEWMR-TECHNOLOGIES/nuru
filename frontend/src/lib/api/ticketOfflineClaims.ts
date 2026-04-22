/**
 * Ticket Offline Claims API — buyer-declared off-platform ticket payments.
 * The submission itself is a multipart POST handled by OfflinePaymentClaimModal
 * via postFormData; this module only covers the organiser-side review queue.
 */
import { get, post } from "./helpers";

export interface TicketOfflineClaim {
  id: string;
  event_id: string;
  ticket_class_id: string;
  claimant_name: string;
  claimant_phone?: string | null;
  claimant_email?: string | null;
  quantity: number;
  amount: number;
  transaction_code: string;
  status: "pending" | "confirmed" | "rejected";
  created_at?: string | null;
  reviewed_at?: string | null;
  // Audit (organiser view)
  payment_channel?: "mobile_money" | "bank" | null;
  provider_name?: string | null;
  provider_id?: string | null;
  payer_account?: string | null;
  receipt_image_url?: string | null;
  rejection_reason?: string | null;
  issued_ticket_id?: string | null;
}

export const ticketOfflineClaimsApi = {
  list: (eventId: string, status?: "pending" | "confirmed" | "rejected") =>
    get<{ claims: TicketOfflineClaim[]; count: number }>(
      `/ticketing/events/${eventId}/offline-claims${status ? `?status=${status}` : ""}`
    ),

  confirm: (claimId: string) =>
    post<{ claim: TicketOfflineClaim; ticket_code: string }>(
      `/ticketing/offline-claims/${claimId}/confirm`,
      {}
    ),

  reject: (claimId: string, rejection_reason?: string) =>
    post<TicketOfflineClaim>(
      `/ticketing/offline-claims/${claimId}/reject`,
      rejection_reason ? { rejection_reason } : {}
    ),

  myClaims: () =>
    get<{ claims: TicketOfflineClaim[]; count: number }>(`/ticketing/my-offline-claims`),
};
