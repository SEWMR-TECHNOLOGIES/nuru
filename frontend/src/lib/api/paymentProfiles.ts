/**
 * Payment Profiles API — beneficiary payout destinations
 * (Mobile Money or Bank Account).
 *
 * Audited against `backend/app/api/routes/payment_profiles.py`:
 *   GET    /payment-profiles                 → list (returns flat array in `data`)
 *   POST   /payment-profiles                 → create
 *   PATCH  /payment-profiles/{id}            → update
 *   POST   /payment-profiles/{id}/default    → mark as default
 *   DELETE /payment-profiles/{id}
 *   GET    /payment-profiles/required-status → fast yes/no for "can receive money"
 *
 * NOTE: there is NO GET by id endpoint — fetch via the list and filter.
 */

import { get, post, patch, del } from "./helpers";
import type {
  PaymentProfile,
  CreatePaymentProfileRequest,
} from "./payments-types";

export const paymentProfilesApi = {
  /** Backend returns `data: PaymentProfile[]` — a flat array. */
  list: () => get<PaymentProfile[]>("/payment-profiles"),

  requiredStatus: () =>
    get<{ has_payout_profile: boolean; profile: PaymentProfile | null }>(
      "/payment-profiles/required-status",
    ),

  create: (data: CreatePaymentProfileRequest) =>
    post<PaymentProfile>("/payment-profiles", data),

  update: (id: string, data: Partial<CreatePaymentProfileRequest>) =>
    patch<PaymentProfile>(`/payment-profiles/${id}`, data),

  setDefault: (id: string) =>
    post<PaymentProfile>(`/payment-profiles/${id}/default`),

  remove: (id: string) => del(`/payment-profiles/${id}`),
};
