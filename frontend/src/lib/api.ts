/**
 * Centralized API Service
 * 
 * This file exports all API modules.
 * The implementation has been split into multiple files in src/lib/api/ for better maintainability.
 */

import { authApi } from "./api/auth";
import { referencesApi } from "./api/references";
import { eventsApi } from "./api/events";
import { userServicesApi, servicesApi } from "./api/services";
import { bookingsApi } from "./api/bookings";
import { messagesApi } from "./api/messages";
import { notificationsApi } from "./api/notifications";
import { profileApi } from "./api/profile";
import { socialApi } from "./api/social";
import { nuruCardsApi } from "./api/nuruCards";
import { supportApi } from "./api/support";
import { get, post, put, patch, del, postFormData, putFormData } from "./api/helpers";
export { showApiErrors, showApiErrorsShadcn, showCaughtError, showCaughtErrorShadcn, throwApiError, ApiError } from "./api/showApiErrors";

// Re-export types
export * from "./api/types";

// Export API modules
export {
  authApi,
  referencesApi,
  eventsApi,
  userServicesApi,
  servicesApi,
  bookingsApi,
  messagesApi,
  notificationsApi,
  profileApi,
  socialApi,
  nuruCardsApi,
  supportApi
};

// Default API object for backward compatibility
export const api = {
  auth: authApi,
  references: referencesApi,
  events: eventsApi,
  userServices: userServicesApi,
  services: servicesApi,
  bookings: bookingsApi,
  messages: messagesApi,
  notifications: notificationsApi,
  profile: profileApi,
  social: socialApi,
  nuruCards: nuruCardsApi,
  support: supportApi,
  
  // Helper methods
  get,
  post,
  put,
  patch,
  delete: del,
  postFormData,
  putFormData,
};

export default api;
