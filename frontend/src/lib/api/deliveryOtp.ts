/**
 * Service-Delivery OTP API client (Phase 1.3)
 *
 * Mandatory in-person check-in code that gates escrow release.
 *
 *   1. Vendor taps "Arrived" → backend issues a 6-digit code.
 *   2. Organiser sees the code in their app and reads it out.
 *   3. Vendor types it in → backend marks the booking 'delivered'.
 *   4. Only then can the organiser release escrow.
 */

import { get, post } from "./helpers";

export interface DeliveryOtpActive {
  id: string;
  status: "active" | "expired" | "cancelled" | "locked";
  issued_at: string;
  expires_at: string;
  attempts: number;
  /** Only present for the organiser viewer. */
  code: string | null;
}

export interface DeliveryOtpConfirmed {
  id: string;
  confirmed_at: string;
}

export interface DeliveryOtpState {
  active: DeliveryOtpActive | null;
  confirmed: DeliveryOtpConfirmed | null;
  max_attempts: number;
  validity_minutes: number;
}

export const deliveryOtpApi = {
  getState: (bookingId: string) =>
    get<DeliveryOtpState>(`/delivery-otp/booking/${bookingId}`),

  arrive: (bookingId: string) =>
    post<DeliveryOtpState>(`/delivery-otp/booking/${bookingId}/arrive`, {}),

  verify: (bookingId: string, code: string) =>
    post<DeliveryOtpState>(`/delivery-otp/booking/${bookingId}/verify`, { code }),

  cancel: (bookingId: string) =>
    post<DeliveryOtpState>(`/delivery-otp/booking/${bookingId}/cancel`, {}),
};
