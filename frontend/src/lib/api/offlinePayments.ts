/**
 * Offline Vendor Payments API — manually-logged payments to event service vendors
 */
import { get, post } from "./helpers";

export interface OfflineVendorPayment {
  id: string;
  event_id: string;
  event_service_id: string;
  provider_user_service_id: string | null;
  vendor_user_id: string | null;
  vendor_name: string;
  service_title: string;
  recorded_by: string | null;
  recorded_by_name?: string | null;
  amount: number;
  currency: string;
  method: string | null;
  reference: string | null;
  note: string | null;
  status: "pending" | "confirmed" | "cancelled" | "expired" | "rejected";
  otp_expires_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  expense_id: string | null;
  agreed_price: number | null;
  created_at: string;
}

export interface LogPaymentInput {
  amount: number;
  method?: string;
  reference?: string;
  note?: string;
}

export const offlinePaymentsApi = {
  log: (eventId: string, eventServiceId: string, body: LogPaymentInput) =>
    post<OfflineVendorPayment>(
      `/user-events/${eventId}/services/${eventServiceId}/offline-payments`,
      body
    ),

  listForEvent: (eventId: string) =>
    get<{ items: OfflineVendorPayment[] }>(
      `/user-events/${eventId}/offline-payments`
    ),

  listMine: () =>
    get<{ items: OfflineVendorPayment[] }>(`/user-events/me/offline-payments`),

  confirm: (paymentId: string, otp: string) =>
    post<OfflineVendorPayment>(
      `/user-events/offline-payments/${paymentId}/confirm`,
      { otp }
    ),

  resend: (paymentId: string) =>
    post<OfflineVendorPayment>(
      `/user-events/offline-payments/${paymentId}/resend-otp`
    ),

  cancel: (paymentId: string) =>
    post<OfflineVendorPayment>(
      `/user-events/offline-payments/${paymentId}/cancel`
    ),
};
