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
   * Request password reset
   */
  forgotPassword: (email: string) => post("/auth/forgot-password", { email }),

  /**
   * Reset password with token
   */
  resetPassword: (token: string, password: string, password_confirmation: string) => 
    post("/auth/reset-password", { token, password, password_confirmation }),
};
