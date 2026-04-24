/**
 * Legacy-User Migration API.
 *
 * `/users/me/migration-status` is a single endpoint the backend exposes that
 * returns everything the frontend needs to decide WHICH onboarding nudge
 * (if any) to show a user who registered before the new Payment Profile /
 * Wallet system existed.
 *
 * Shape (server-side computed, single source of truth):
 *   {
 *     needs_setup: boolean,                    // true → user must create a payment profile
 *     has_monetized_content: boolean,          // any events/services/tickets/contributions
 *     has_pending_balance: boolean,            // money waiting to be paid out
 *     monetized_summary: {
 *       events: number, services: number,
 *       ticketed_events: number, contributions: number,
 *       bookings: number,
 *     },
 *     country_guess: { code: "TZ" | "KE" | null, source: "phone" | "ip" | "locale" | null },
 *     pending_balance: { amount: number, currency: string } | null,
 *     legacy_since: string | null,             // ISO date the user became "legacy"
 *   }
 */
import { get } from "./helpers";

export interface MonetizedSummary {
  events: number;
  services: number;
  ticketed_events: number;
  contributions: number;
  bookings: number;
}

export interface CountryGuess {
  code: "TZ" | "KE" | null;
  source: "phone" | "ip" | "locale" | null;
}

export interface PendingBalance {
  amount: number;
  currency: string;
}

export interface MigrationStatus {
  needs_setup: boolean;
  has_monetized_content: boolean;
  has_pending_balance: boolean;
  monetized_summary: MonetizedSummary;
  country_guess: CountryGuess;
  pending_balance: PendingBalance | null;
  legacy_since: string | null;
}

export const migrationApi = {
  status: () => get<MigrationStatus>("/users/me/migration-status"),
};
