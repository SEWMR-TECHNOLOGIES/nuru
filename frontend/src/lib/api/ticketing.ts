/**
 * Ticketing API - Event ticket classes and purchases
 */

import { get, post, put, del } from "./helpers";

export interface TicketClass {
  id: string;
  event_id: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  quantity: number;
  sold: number;
  /** Organizer-only: number of tickets currently held by unpaid reservations. */
  reserved?: number;
  available: number;
  status: string;
  display_order: number;
}

export interface TicketReservation {
  id: string;
  ticket_code: string;
  ticket_class_id: string;
  ticket_class?: string;
  quantity: number;
  total_amount: number;
  reserved_until: string | null;
  seconds_remaining: number;
  event?: {
    id?: string;
    name?: string;
    start_date?: string | null;
    location?: string | null;
    cover_image?: string | null;
  } | null;
}

export interface TicketPurchase {
  id: string;
  ticket_class_id: string;
  ticket_class_name: string;
  buyer_name: string;
  buyer_email?: string;
  buyer_phone?: string;
  quantity: number;
  total_amount: number;
  currency: string;
  status: string;
  ticket_code: string;
  checked_in: boolean;
  created_at: string;
}

export interface TicketedEvent {
  id: string;
  name: string;
  start_date?: string;
  location?: string;
  cover_image?: string;
  min_price: number;
  total_available: number;
  ticket_class_count: number;
}

export const ticketingApi = {
  // Public: get ticketed events for discovery
  getTicketedEvents: (params?: { page?: number; limit?: number; search?: string }) => {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString()}` : '';
    return get<{ events: TicketedEvent[]; pagination: any }>(`/ticketing/events${qs}`);
  },

  // Public: get ticket classes for an event
  getTicketClasses: (eventId: string) =>
    get<{ event_id: string; event_name: string; ticket_classes: TicketClass[] }>(`/ticketing/events/${eventId}/ticket-classes`),

  // Organizer: get ticket classes for own event (no public/sells_tickets requirement)
  getMyTicketClasses: (eventId: string) =>
    get<{ event_id: string; event_name: string; ticket_classes: TicketClass[] }>(`/ticketing/my-events/${eventId}/ticket-classes`),

  // Organizer
  createTicketClass: (eventId: string, data: { name: string; description?: string; price: number; quantity: number }) =>
    post<{ id: string }>(`/ticketing/events/${eventId}/ticket-classes`, data),

  updateTicketClass: (classId: string, data: Partial<{ name: string; description: string; price: number; quantity: number; status: string }>) =>
    put(`/ticketing/ticket-classes/${classId}`, data),

  deleteTicketClass: (classId: string) =>
    del(`/ticketing/ticket-classes/${classId}`),

  // Purchase — backend path is /ticketing/purchase (no event prefix)
  purchaseTicket: (data: { ticket_class_id: string; quantity: number }) =>
    post<{ ticket_id: string; ticket_code: string; quantity: number; total_amount: number }>(`/ticketing/purchase`, data),

  // My tickets — supports server-side ?search= over event name/location/ticket class/code.
  getMyTickets: (params?: { page?: number; limit?: number; search?: string }) => {
    const qs = params
      ? `?${new URLSearchParams(
          Object.entries(params)
            .filter(([_, v]) => v !== undefined && v !== "")
            .map(([k, v]) => [k, String(v)]),
        ).toString()}`
      : "";
    return get<{ tickets: TicketPurchase[]; pagination: any }>(`/ticketing/my-tickets${qs}`);
  },

  // Organizer: get sold tickets for event
  getEventTickets: (eventId: string, params?: { page?: number; limit?: number }) => {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}` : '';
    return get<{ tickets: TicketPurchase[]; pagination: any }>(`/ticketing/events/${eventId}/tickets${qs}`);
  },

  // Organizer: approve/reject ticket
  updateTicketStatus: (ticketId: string, status: 'approved' | 'rejected' | 'confirmed' | 'cancelled') =>
    put<any>(`/ticketing/tickets/${ticketId}/status`, { status }),

  // My upcoming tickets (sidebar)
  getMyUpcomingTickets: () =>
    get<{ tickets: any[] }>(`/ticketing/my-upcoming-tickets`),

  // Check-in ticket (organizer scans QR)
  checkInTicket: (ticketCode: string) =>
    put<{ ticket_code: string; checked_in_at: string }>(`/ticketing/verify/${ticketCode}/check-in`, {}),

  // ── Reservations (airline-style holds) ────────────────────────────────
  reserveTicket: (data: { ticket_class_id: string; quantity: number }) =>
    post<{
      ticket_id: string;
      ticket_code: string;
      quantity: number;
      total_amount: number;
      reserved_until: string;
      seconds_remaining: number;
    }>(`/ticketing/reserve`, data),

  /** Promote a reservation to a normal pending order so payment can begin. */
  convertReservation: (ticketId: string) =>
    post<{
      ticket_id: string;
      ticket_code: string;
      total_amount: number;
      ticket_class_id: string;
      quantity: number;
    }>(`/ticketing/reservations/${ticketId}/convert`, {}),

  cancelReservation: (ticketId: string) =>
    del(`/ticketing/reservations/${ticketId}`),

  getMyReservations: () =>
    get<{ reservations: TicketReservation[] }>(`/ticketing/my-reservations`),

  /** Sweep this user's expired reservations. */
  sweepMyReservations: () =>
    post<{ deleted: number }>(`/ticketing/my-reservations/sweep`, {}),

  /** Public, idempotent system sweep — fires on app boot until cron is wired. */
  sweepAllExpiredReservations: () =>
    post<{ deleted: number }>(`/ticketing/reservations/sweep`, {}),
};
