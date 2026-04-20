/**
 * Received-payments API — money landing on a beneficiary's events / services.
 *
 * The backend keeps wallets reserved for top-ups only; everything else is
 * surfaced through these endpoints with full breakdowns (gross, commission,
 * net, gateway reference, payer).
 */

import { get, buildQueryString } from "./helpers";
import type { PaginatedResponse } from "./types";

export interface ReceivedPayment {
  id: string;
  transaction_code: string;
  target_type: string | null;
  target_id: string | null;
  currency_code: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  method_type: string | null;
  provider_name: string | null;
  external_reference: string | null;
  internal_reference: string | null;
  status: string | null;
  payer_user_id: string | null;
  payer_name: string | null;
  payer_phone: string | null;
  description: string | null;
  initiated_at: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
}

export interface ReceivedPaymentsPage {
  payments: ReceivedPayment[];
  pagination: PaginatedResponse<ReceivedPayment>["pagination"];
}

export interface ListReceivedParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export const receivedPaymentsApi = {
  eventContributions: (eventId: string, params?: ListReceivedParams) =>
    get<ReceivedPaymentsPage>(
      `/received-payments/events/${encodeURIComponent(eventId)}/contributions${buildQueryString(params)}`,
    ),

  eventTickets: (eventId: string, params?: ListReceivedParams) =>
    get<ReceivedPaymentsPage>(
      `/received-payments/events/${encodeURIComponent(eventId)}/tickets${buildQueryString(params)}`,
    ),

  service: (serviceId: string, params?: ListReceivedParams) =>
    get<ReceivedPaymentsPage>(
      `/received-payments/services/${encodeURIComponent(serviceId)}${buildQueryString(params)}`,
    ),

  // Current user's own ticket payment history
  myTickets: (params?: ListReceivedParams) =>
    get<ReceivedPaymentsPage>(
      `/received-payments/my/tickets${buildQueryString(params)}`,
    ),

  // Current user's own contribution payment history
  myContributions: (params?: ListReceivedParams) =>
    get<ReceivedPaymentsPage>(
      `/received-payments/my/contributions${buildQueryString(params)}`,
    ),
};
