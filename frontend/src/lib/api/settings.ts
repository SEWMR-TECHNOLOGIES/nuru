/**
 * Settings API - aligned with nuru-api-doc MODULE 19
 * Endpoints: /settings, /settings/notifications, /settings/privacy, etc.
 */

import { get, put, post } from "./helpers";

export interface NotificationSettings {
  email: {
    enabled: boolean;
    event_invitations: boolean;
    event_updates: boolean;
    rsvp_updates: boolean;
    contributions: boolean;
    messages: boolean;
    marketing: boolean;
    weekly_digest: boolean;
  };
  push: {
    enabled: boolean;
    event_invitations: boolean;
    event_updates: boolean;
    rsvp_updates: boolean;
    contributions: boolean;
    messages: boolean;
    glows_and_echoes: boolean;
    new_followers: boolean;
    mentions: boolean;
  };
  sms: {
    enabled: boolean;
    event_reminders: boolean;
    payment_confirmations: boolean;
    security_alerts: boolean;
  };
  quiet_hours: {
    enabled: boolean;
    start_time: string;
    end_time: string;
    timezone: string;
  };
}

export interface PrivacySettings {
  profile_visibility: string;
  show_email: boolean;
  show_phone: boolean;
  show_location: boolean;
  allow_tagging: boolean;
  allow_mentions: boolean;
  show_activity_status: boolean;
  show_read_receipts: boolean;
  allow_message_requests: boolean;
  blocked_users_count: number;
}

export interface SecuritySettings {
  two_factor_enabled: boolean;
  two_factor_method: string | null;
  login_alerts: boolean;
  active_sessions_count: number;
  last_password_change: string;
}

export interface PreferencesSettings {
  language: string;
  currency: string;
  timezone: string;
  date_format: string;
  time_format: string;
  theme: string;
  compact_mode: boolean;
}

export interface AllSettings {
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  security: SecuritySettings;
  preferences: PreferencesSettings;
  connected_accounts: any;
  payment_methods: any;
}

export const settingsApi = {
  /** Get all settings */
  getSettings: () => get<AllSettings>("/settings"),

  /** Update notification settings */
  updateNotifications: (data: Partial<NotificationSettings>) =>
    put<{ notifications: NotificationSettings }>("/settings/notifications", data),

  /** Update privacy settings */
  updatePrivacy: (data: Partial<PrivacySettings>) =>
    put<{ privacy: PrivacySettings }>("/settings/privacy", data),

  /** Update preferences */
  updatePreferences: (data: Partial<PreferencesSettings>) =>
    put<{ preferences: PreferencesSettings }>("/settings/preferences", data),

  /** Enable two-factor authentication */
  enableTwoFactor: () =>
    post<{ qr_code_url: string; secret: string; backup_codes: string[] }>("/settings/security/2fa/enable"),

  /** Verify and complete 2FA setup */
  verifyTwoFactor: (data: { code: string }) =>
    post<{ verified: boolean; backup_codes: string[] }>("/settings/security/2fa/verify", data),

  /** Disable two-factor authentication */
  disableTwoFactor: (data: { code: string; password: string }) =>
    post<any>("/settings/security/2fa/disable", data),

  /** Get active sessions */
  getSessions: () =>
    get<{ sessions: any[]; current_session_id: string }>("/settings/security/sessions"),

  /** Revoke session */
  revokeSession: (sessionId: string) =>
    put<any>(`/settings/security/sessions/${sessionId}`),
};
