/**
 * Centralized API Service
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
import { contributorsApi } from "./api/contributors";
import { searchApi } from "./api/search";
import { photoLibrariesApi } from "./api/photoLibraries";
import { agreementsApi } from "./api/agreements";
import { cardTemplatesApi } from "./api/cardTemplates";
import { walletApi } from "./api/wallet";
import { paymentProfilesApi } from "./api/paymentProfiles";
import { paymentsApi } from "./api/payments";
import { withdrawalsApi } from "./api/withdrawals";
import { adminPaymentsApi } from "./api/adminPayments";
import { get, post, put, patch, del, postFormData, putFormData } from "./api/helpers";
export { showApiErrors, showApiErrorsShadcn, showCaughtError, showCaughtErrorShadcn, throwApiError, ApiError } from "./api/showApiErrors";

// Re-export types
export * from "./api/types";
export * from "./api/photoLibraries";
export * from "./api/agreements";
export * from "./api/cardTemplates";
export * from "./api/payments-types";

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
  supportApi,
  contributorsApi,
  searchApi,
  photoLibrariesApi,
  agreementsApi,
  cardTemplatesApi,
  walletApi,
  paymentProfilesApi,
  paymentsApi,
  withdrawalsApi,
  adminPaymentsApi,
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
  contributors: contributorsApi,
  search: searchApi,
  photoLibraries: photoLibrariesApi,
  cardTemplates: cardTemplatesApi,
  wallet: walletApi,
  paymentProfiles: paymentProfilesApi,
  payments: paymentsApi,
  withdrawals: withdrawalsApi,
  adminPayments: adminPaymentsApi,

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
