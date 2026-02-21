/**
 * Business Phone API - Service provider phone verification
 */

import { get, post } from "./helpers";

export interface BusinessPhone {
  id: string;
  phone_number: string;
  verification_status: string;
  created_at?: string;
}

export const businessPhoneApi = {
  /** List all business phones for current user */
  getAll: () =>
    get<BusinessPhone[]>("/user-services/business-phones/list"),

  /** Add a new business phone (triggers OTP) */
  add: (data: { phone_number: string }) =>
    post<BusinessPhone>("/user-services/business-phones", data),

  /** Verify a business phone with OTP */
  verify: (phoneId: string, data: { otp_code: string }) =>
    post<BusinessPhone>(`/user-services/business-phones/${phoneId}/verify`, data),
};
