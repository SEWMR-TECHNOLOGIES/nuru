/**
 * Contributors API - User contributor address book & event contributors
 */

import { get, post, put, del, buildQueryString } from "./helpers";
import type { PaginatedResponse } from "./types";

// ============================================================================
// TYPES
// ============================================================================

export interface UserContributor {
  id: string;
  user_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EventContributorSummary {
  id: string;
  event_id: string;
  contributor_id: string;
  contributor: UserContributor | null;
  pledge_amount: number;
  total_paid: number;
  balance: number;
  notes?: string | null;
  currency?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ContributorPayment {
  id: string;
  amount: number;
  payment_method?: string;
  payment_reference?: string;
  created_at?: string;
}

export interface ContributorQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sort_by?: "name" | "created_at";
  sort_order?: "asc" | "desc";
}

export interface EventContributorQueryParams {
  page?: number;
  limit?: number;
  search?: string;
}

// ============================================================================
// USER CONTRIBUTORS (Address Book)
// ============================================================================

export const contributorsApi = {
  /** Get all contributors in user's address book */
  getAll: (params?: ContributorQueryParams) =>
    get<{
      contributors: UserContributor[];
      pagination: PaginatedResponse<UserContributor>["pagination"];
    }>(`/user-contributors/${buildQueryString(params)}`),

  /** Get a single contributor */
  getById: (contributorId: string) =>
    get<UserContributor>(`/user-contributors/${contributorId}`),

  /** Create a new contributor in address book */
  create: (data: { name: string; email?: string; phone?: string; notes?: string }) =>
    post<UserContributor>("/user-contributors/", data),

  /** Update a contributor */
  update: (contributorId: string, data: Partial<UserContributor>) =>
    put<UserContributor>(`/user-contributors/${contributorId}`, data),

  /** Delete a contributor from address book */
  delete: (contributorId: string) =>
    del(`/user-contributors/${contributorId}`),

  // ============================================================================
  // EVENT CONTRIBUTORS
  // ============================================================================

  /** Get contributors linked to an event */
  getEventContributors: (eventId: string, params?: EventContributorQueryParams) =>
    get<{
      event_contributors: EventContributorSummary[];
      summary: { total_pledged: number; total_paid: number; total_balance: number; count: number; currency?: string };
      pagination: PaginatedResponse<EventContributorSummary>["pagination"];
    }>(`/user-contributors/events/${eventId}/contributors${buildQueryString(params)}`),

  /** Add contributor to event (with optional inline creation) */
  addToEvent: (eventId: string, data: {
    contributor_id?: string;
    name?: string;
    email?: string;
    phone?: string;
    pledge_amount?: number;
    notes?: string;
  }) =>
    post<EventContributorSummary>(`/user-contributors/events/${eventId}/contributors`, data),

  /** Update event contributor (pledge amount, notes) */
  updateEventContributor: (eventId: string, eventContributorId: string, data: { pledge_amount?: number; notes?: string }) =>
    put<EventContributorSummary>(`/user-contributors/events/${eventId}/contributors/${eventContributorId}`, data),

  /** Remove contributor from event */
  removeFromEvent: (eventId: string, eventContributorId: string) =>
    del(`/user-contributors/events/${eventId}/contributors/${eventContributorId}`),

  /** Record payment for an event contributor */
  recordPayment: (eventId: string, eventContributorId: string, data: {
    amount: number;
    payment_method?: string;
    payment_reference?: string;
  }) =>
    post<ContributorPayment>(`/user-contributors/events/${eventId}/contributors/${eventContributorId}/payments`, data),

  /** Get payment history for an event contributor */
  getPaymentHistory: (eventId: string, eventContributorId: string) =>
    get<{
      contributor: UserContributor | null;
      pledge_amount: number;
      total_paid: number;
      payments: ContributorPayment[];
    }>(`/user-contributors/events/${eventId}/contributors/${eventContributorId}/payments`),

  /** Send thank you SMS to an event contributor */
  sendThankYou: (eventId: string, eventContributorId: string, data: { custom_message?: string }) =>
    post<{ sent: boolean }>(`/user-contributors/events/${eventId}/contributors/${eventContributorId}/thank-you`, data),

  /** Bulk add/update contributors to event */
  bulkAddToEvent: (eventId: string, data: {
    contributors: { name: string; phone: string; amount: number }[];
    send_sms?: boolean;
    mode?: "targets" | "contributions";
    payment_method?: string;
  }) =>
    post<{
      processed: number;
      errors_count: number;
      results: { row: number; name: string; action: string }[];
      errors: { row: number; message: string }[];
    }>(`/user-contributors/events/${eventId}/contributors/bulk`, data),

  /** Get pending contributions awaiting creator confirmation */
  getPendingContributions: (eventId: string) =>
    get<{
      contributions: {
        id: string;
        contributor_name: string;
        contributor_phone?: string;
        amount: number;
        payment_method?: string;
        transaction_ref?: string;
        recorded_by?: string;
        created_at?: string;
      }[];
      count: number;
    }>(`/user-contributors/events/${eventId}/pending-contributions`),

  /** Get contributions recorded by the current committee member */
  getMyRecordedContributions: (eventId: string) =>
    get<{
      contributions: {
        id: string;
        contributor_name: string;
        contributor_phone?: string;
        amount: number;
        payment_method?: string;
        transaction_ref?: string;
        confirmation_status: string;
        confirmed_at?: string;
        created_at?: string;
      }[];
      count: number;
    }>(`/user-contributors/events/${eventId}/my-recorded-contributions`),

  /** Confirm one or more pending contributions */
  confirmContributions: (eventId: string, contributionIds: string[]) =>
    post<{ confirmed: number }>(`/user-contributors/events/${eventId}/confirm-contributions`, { contribution_ids: contributionIds }),
};
