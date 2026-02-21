/**
 * Authentication API
 */

import { get, post } from "./helpers";
import type { User, SignupData, SigninData, AuthResponse, VerifyOtpData, RequestOtpData } from "./types";

export const authApi = {
  /**
   * Sign up a new user
   */
  signup: (data: SignupData) => post<{ id: string }>("/users/signup", data),

  /**
   * Sign in user
   */
  signin: (data: SigninData) => post<AuthResponse>("/auth/signin", data),

  /**
   * Sign out current user
   */
  logout: () => post("/auth/logout"),

  /**
   * Get current authenticated user
   */
  me: () => get<User>("/auth/me"),

  /**
   * Refresh access token
   */
  refreshToken: (refresh_token: string) => 
    post<{ access_token: string; refresh_token: string; expires_in: number }>("/auth/refresh", { refresh_token }),

  /**
   * Verify OTP code
   */
  verifyOtp: (data: VerifyOtpData) => post("/users/verify-otp", data),

  /**
   * Request new OTP code
   */
  requestOtp: (data: RequestOtpData) => post("/users/request-otp", data),

  /**
   * Check username availability
   */
  checkUsername: async (username: string, firstName?: string, lastName?: string) => {
    const params = new URLSearchParams({ username });
    if (firstName) params.append("first_name", firstName);
    if (lastName) params.append("last_name", lastName);
    // Public endpoint — do NOT send auth headers (stale tokens cause 403)
    const BASE_URL = import.meta.env.VITE_API_BASE_URL;
    try {
      const res = await fetch(`${BASE_URL}/users/check-username?${params.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
      });
      const json = await res.json();
      return { success: json.success ?? res.ok, message: json.message ?? "", data: json.data ?? null };
    } catch {
      return { success: false, message: "Unable to check username", data: null };
    }
  },

  /**
   * Request password reset
   */
  forgotPassword: (email: string) => post("/auth/forgot-password", { email }),

  /**
   * Reset password with token
   */
  resetPassword: (token: string, password: string, password_confirmation: string) => 
    post("/auth/reset-password", { token, password, password_confirmation }),

  /**
   * Change password (authenticated)
   */
  changePassword: (current_password: string, new_password: string, confirm_password: string) =>
    post("/users/change-password", { current_password, new_password, confirm_password }),

  /**
   * Update email (authenticated, post-login)
   */
  updateEmail: (email: string) =>
    post("/users/update-email", { email }),
};
