/**
 * Bookings API - Service booking requests
 */

import { get, post, put, buildQueryString } from "./helpers";
import type { BookingRequest, PaginatedResponse } from "./types";

export interface BookingQueryParams {
  page?: number;
  limit?: number;
  status?: "pending" | "accepted" | "rejected" | "cancelled" | "completed" | "all";
  service_id?: string;
  sort_by?: "created_at" | "event_date" | "status";
  sort_order?: "asc" | "desc";
}

export const bookingsApi = {
  // ============================================================================
  // CLIENT PERSPECTIVE
  // ============================================================================

  /**
   * Create a booking request
   */
  create: (data: {
    service_id: string;
    event_id?: string;
    package_id?: string;
    event_name?: string;
    event_date: string;
    event_type?: string;
    location?: string;
    venue?: string;
    guest_count?: number;
    message: string;
    special_requirements?: string;
    budget?: number;
  }) => post<BookingRequest>("/bookings", data),

  /**
   * Get my booking requests (as client)
   */
  getMyBookings: (params?: BookingQueryParams) => 
    get<{ 
      bookings: BookingRequest[]; 
      summary: { total: number; pending: number; accepted: number; rejected: number; completed: number; cancelled: number };
      pagination: PaginatedResponse<BookingRequest>["pagination"];
    }>(`/bookings/${buildQueryString(params)}`),

  /**
   * Get booking detail
   */
  getById: (bookingId: string) => get<BookingRequest>(`/bookings/${bookingId}`),

  /**
   * Cancel booking (client)
   */
  cancel: (bookingId: string, data: { reason: string; notify_other_party?: boolean }) => 
    post<{ id: string; status: string; cancelled_at: string; refund_amount?: number; refund_status?: string }>(`/bookings/${bookingId}/cancel`, data),

  /**
   * Pay deposit
   */
  payDeposit: (bookingId: string, data: { payment_method: string; phone?: string }) => 
    post<{ booking_id: string; payment_status: string; checkout_request_id?: string }>(`/bookings/${bookingId}/pay-deposit`, data),

  // ============================================================================
  // VENDOR PERSPECTIVE
  // ============================================================================

  /**
   * Get booking requests for my services (as vendor)
   */
  getIncomingBookings: (params?: BookingQueryParams) => 
    get<{ 
      bookings: BookingRequest[]; 
      summary: { total: number; pending: number; accepted: number; rejected: number; completed: number; cancelled: number };
      pagination: PaginatedResponse<BookingRequest>["pagination"];
    }>(`/bookings/received${buildQueryString(params)}`),

  /**
   * Respond to booking (accept/reject)
   */
  respond: (bookingId: string, data: {
    status: "accepted" | "rejected";
    quoted_price?: number;
    message: string;
    deposit_required?: number;
    deposit_deadline?: string;
    notes?: string;
    reason?: string; // For rejection
  }) => post<{ id: string; status: string; quoted_price?: number; deposit_required?: number }>(`/bookings/${bookingId}/respond`, data),

  /**
   * Mark booking as complete
   */
  complete: (bookingId: string, data: { completion_notes?: string; final_amount?: number }) => 
    post<{ id: string; status: string; completed_at: string; can_review: boolean }>(`/bookings/${bookingId}/complete`, data),

  /**
   * Get booking calendar
   */
  getCalendar: (params: { start_date: string; end_date: string; service_id?: string }) => 
    get<{ bookings: Array<{ id: string; service_id: string; event_name: string; event_date: string; status: string; client_name: string }> }>(`/bookings/calendar${buildQueryString(params)}`),

  /**
   * Block dates
   */
  blockDates: (data: { service_id: string; dates: string[]; reason?: string }) => 
    post<{ blocked_dates: string[] }>("/bookings/block-dates", data),

  /**
   * Unblock dates
   */
  unblockDates: (data: { service_id: string; dates: string[] }) => 
    post<{ unblocked_dates: string[] }>("/bookings/unblock-dates", data),
};
