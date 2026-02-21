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
  available: number;
  status: string;
  display_order: number;
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
  getTicketedEvents: (params?: { page?: number; limit?: number }) => {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}` : '';
    return get<{ events: TicketedEvent[]; pagination: any }>(`/ticketing/events${qs}`);
  },

  // Public: get ticket classes for an event
  getTicketClasses: (eventId: string) =>
    get<{ event_id: string; event_name: string; ticket_classes: TicketClass[] }>(`/ticketing/events/${eventId}/ticket-classes`),

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

  // My tickets
  getMyTickets: (params?: { page?: number; limit?: number }) => {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}` : '';
    return get<{ tickets: TicketPurchase[]; pagination: any }>(`/ticketing/my-tickets${qs}`);
  },

  // Organizer: get sold tickets for event
  getEventTickets: (eventId: string, params?: { page?: number; limit?: number }) => {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}` : '';
    return get<{ tickets: TicketPurchase[]; pagination: any }>(`/ticketing/events/${eventId}/tickets${qs}`);
  },
};
