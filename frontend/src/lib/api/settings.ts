/**
 * Settings API - User preferences and settings
 */

import { get, put, post } from "./helpers";

export interface UserSettings {
  email_notifications: boolean;
  profile_visibility: boolean;
  glows_echoes_notifications: boolean;
  event_invitation_notifications: boolean;
  new_follower_notifications: boolean;
  message_notifications: boolean;
  private_profile: boolean;
  two_factor_enabled: boolean;
  dark_mode: boolean;
  language: string;
  timezone: string;
}

export const settingsApi = {
  /**
   * Get user settings
   */
  getSettings: () => get<UserSettings>("/users/settings"),

  /**
   * Update user settings
   */
  updateSettings: (data: Partial<UserSettings>) => 
    put<UserSettings>("/users/settings", data),

  /**
   * Enable two-factor authentication
   */
  enableTwoFactor: () => 
    post<{ qr_code: string; secret: string }>("/users/settings/2fa/enable"),

  /**
   * Disable two-factor authentication
   */
  disableTwoFactor: (data: { code: string }) => 
    post("/users/settings/2fa/disable", data),

  /**
   * Verify two-factor authentication
   */
  verifyTwoFactor: (data: { code: string }) => 
    post<{ verified: boolean }>("/users/settings/2fa/verify", data),
};
