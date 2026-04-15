/**
 * Notifications API
 */

import { get, put, del, buildQueryString } from "./helpers";
import type { Notification, PaginatedResponse } from "./types";

export interface NotificationQueryParams {
  page?: number;
  limit?: number;
  filter?: "all" | "unread";
  type?: string;
}

export interface NotificationPreferences {
  email: {
    enabled: boolean;
    booking_requests: boolean;
    messages: boolean;
    contributions: boolean;
    rsvp: boolean;
    reviews: boolean;
    marketing: boolean;
    digest: "daily" | "weekly" | "never";
  };
  push: {
    enabled: boolean;
    booking_requests: boolean;
    messages: boolean;
    contributions: boolean;
    rsvp: boolean;
    reviews: boolean;
  };
  sms: {
    enabled: boolean;
    booking_requests: boolean;
    contributions: boolean;
  };
  quiet_hours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
}

export const notificationsApi = {
  /**
   * Get all notifications
   */
  getAll: (params?: NotificationQueryParams) => 
    get<{ 
      notifications: Notification[]; 
      unread_count: number;
      pagination: PaginatedResponse<Notification>["pagination"];
    }>(`/notifications/${buildQueryString(params)}`),

  /**
   * Get unread count
   */
  getUnreadCount: () => get<{ unread_count: number }>("/notifications/unread-count"),

  /**
   * Mark notification as read
   */
  markAsRead: (notificationId: string) => 
    put<{ notification_id: string; is_read: boolean }>(`/notifications/${notificationId}/read`),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: () => put<{ read_count: number }>("/notifications/read-all"),

  /**
   * Delete notification
   */
  delete: (notificationId: string) => del(`/notifications/${notificationId}`),

  /**
   * Delete all notifications
   */
  deleteAll: () => del("/notifications/all"),

  /**
   * Get notification preferences
   */
  getPreferences: () => get<NotificationPreferences>("/notifications/preferences"),

  /**
   * Update notification preferences
   */
  updatePreferences: (data: Partial<NotificationPreferences>) => 
    put<NotificationPreferences>("/notifications/preferences", data),
};
