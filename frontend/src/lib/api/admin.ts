/**
 * Admin API - Nuru Admin Panel
 * Uses a dedicated admin_token (separate from regular user tokens).
 * Regular Nuru tokens are REJECTED by the backend admin endpoints.
 */

import type { ApiResponse } from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ── Admin-specific request helper ─────────────────────────────────────────────
// Always attaches the admin_token, never the regular user token.
async function adminRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem("admin_token");
  const url = `${BASE_URL}${endpoint}`;

  const config: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    // If the admin token expired, clear and redirect to admin login
    if (response.status === 401) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_refresh_token");
      localStorage.removeItem("admin_user");
      window.location.href = "/admin/login";
    }

    const json = await response.json().catch(() => null);
    if (json && typeof json === "object" && "success" in json) {
      const raw = json as any;
      // Backend's standard_response with pagination wraps data as:
      //   { success, message, data: { items: [...], pagination: {...} } }
      // We need to unwrap so callers get res.data as the array and res.pagination
      // for page metadata.
      let data = raw.data;
      let pagination: any = undefined;

      if (data && typeof data === "object" && "items" in data && "pagination" in data) {
        pagination = data.pagination;
        data = data.items;
      }

      const normalized: any = { success: raw.success, message: raw.message, data, pagination };
      return normalized as ApiResponse<T> & { pagination?: any };
    }
    const message =
      (json as any)?.message || (response.ok ? "" : "Something went wrong.");
    return { success: response.ok, message, data: json as T };
  } catch {
    return {
      success: false,
      message: "Unable to connect. Please check your internet connection.",
      data: null as T,
    };
  }
}

const aGet  = <T>(ep: string) => adminRequest<T>(ep, { method: "GET" });
const aPost = <T>(ep: string, body?: unknown) =>
  adminRequest<T>(ep, { method: "POST", body: body ? JSON.stringify(body) : undefined });
const aPut  = <T>(ep: string, body?: unknown) =>
  adminRequest<T>(ep, { method: "PUT",  body: body ? JSON.stringify(body) : undefined });
const aDel  = <T>(ep: string) => adminRequest<T>(ep, { method: "DELETE" });

// ── Admin API surface ──────────────────────────────────────────────────────────
export const adminApi = {
  // Dashboard
  getStats:         () => aGet<any>("/admin/stats"),
  getExtendedStats: () => aGet<any>("/admin/stats/extended"),

  // Users
  getUsers: (params?: any) => {
    const qs = new URLSearchParams();
    if (params?.page)                       qs.set("page",      params.page);
    if (params?.limit)                      qs.set("limit",     params.limit);
    if (params?.q)                          qs.set("q",         params.q);
    if (params?.is_active !== undefined)    qs.set("is_active", String(params.is_active));
    return aGet<any>(`/admin/users${qs.toString() ? `?${qs}` : ""}`);
  },
  getUserDetail:    (id: string) => aGet<any>(`/admin/users/${id}`),
  activateUser:     (id: string) => aPut<any>(`/admin/users/${id}/activate`),
  deactivateUser:   (id: string) => aPut<any>(`/admin/users/${id}/deactivate`),
  resetUserPassword:(id: string, new_password: string) => aPut<any>(`/admin/users/${id}/reset-password`, { new_password }),

  // Admin Accounts
  getAdmins:        ()                           => aGet<any>("/admin/admins"),
  createAdmin:      (data: any)                  => aPost<any>("/admin/admins", data),
  activateAdmin:    (id: string)                 => aPut<any>(`/admin/admins/${id}/activate`),
  deactivateAdmin:  (id: string)                 => aPut<any>(`/admin/admins/${id}/deactivate`),
  deleteAdmin:      (id: string)                 => aDel<any>(`/admin/admins/${id}`),


  // KYC
  getKycSubmissions: (params?: any) => {
    const qs = new URLSearchParams();
    if (params?.page)   qs.set("page",   params.page);
    if (params?.limit)  qs.set("limit",  params.limit);
    if (params?.status) qs.set("status", params.status);
    return aGet<any>(`/admin/kyc${qs.toString() ? `?${qs}` : ""}`);
  },
  getKycDetail:      (id: string)                      => aGet<any>(`/admin/kyc/${id}`),
  approveKycItem:    (itemId: string, notes?: string)  => aPut<any>(`/admin/kyc/item/${itemId}/approve`, { notes }),
  rejectKycItem:     (itemId: string, notes: string)   => aPut<any>(`/admin/kyc/item/${itemId}/reject`,  { notes }),

  // Event Types
  getEventTypes:    ()                           => aGet<any>("/admin/event-types"),
  createEventType:  (data: any)                  => aPost<any>("/admin/event-types", data),
  updateEventType:  (id: string, data: any)      => aPut<any>(`/admin/event-types/${id}`, data),
  deleteEventType:  (id: string)                 => aDel<any>(`/admin/event-types/${id}`),

  // Live Chats
  getChats: (params?: any) => {
    const qs = new URLSearchParams();
    if (params?.page)   qs.set("page",   params.page);
    if (params?.limit)  qs.set("limit",  params.limit);
    if (params?.status) qs.set("status", params.status);
    return aGet<any>(`/admin/chats${qs.toString() ? `?${qs}` : ""}`);
  },
  getChatMessages: (chatId: string, after?: string) =>
    aGet<any>(`/admin/chats/${chatId}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`),
  replyToChat: (chatId: string, content: string) => aPost<any>(`/admin/chats/${chatId}/reply`, { content }),
  closeChat:   (chatId: string)                  => aPut<any>(`/admin/chats/${chatId}/close`),

  // Support Tickets
  getTickets: (params?: any) => {
    const qs = new URLSearchParams();
    if (params?.page)   qs.set("page",   params.page);
    if (params?.limit)  qs.set("limit",  params.limit);
    if (params?.status) qs.set("status", params.status);
    return aGet<any>(`/admin/tickets${qs.toString() ? `?${qs}` : ""}`);
  },
  getTicketDetail: (id: string)                    => aGet<any>(`/admin/tickets/${id}`),
  replyToTicket:   (id: string, message: string)   => aPost<any>(`/admin/tickets/${id}/reply`, { message }),
  closeTicket:     (id: string)                    => aPut<any>(`/admin/tickets/${id}/close`),

  // FAQs
  getFaqs:      ()                           => aGet<any>("/admin/faqs"),
  createFaq:    (data: any)                  => aPost<any>("/admin/faqs", data),
  updateFaq:    (id: string, data: any)      => aPut<any>(`/admin/faqs/${id}`, data),
  deleteFaq:    (id: string)                 => aDel<any>(`/admin/faqs/${id}`),

  // Events
  getEvents: (params?: any) => {
    const qs = new URLSearchParams();
    if (params?.page)   qs.set("page",   params.page);
    if (params?.limit)  qs.set("limit",  params.limit);
    if (params?.q)      qs.set("q",      params.q);
    if (params?.status) qs.set("status", params.status);
    return aGet<any>(`/admin/events${qs.toString() ? `?${qs}` : ""}`);
  },
  updateEventStatus: (id: string, status: string) => aPut<any>(`/admin/events/${id}/status`, { status }),

  // Services
  getServices: (params?: any) => {
    const qs = new URLSearchParams();
    if (params?.page)   qs.set("page",   params.page);
    if (params?.limit)  qs.set("limit",  params.limit);
    if (params?.q)      qs.set("q",      params.q);
    if (params?.status) qs.set("status", params.status);
    return aGet<any>(`/admin/services${qs.toString() ? `?${qs}` : ""}`);
  },
  getServiceDetail: (id: string) => aGet<any>(`/admin/services/${id}`),
  toggleServiceActive: (id: string, is_active: boolean) => aPut<any>(`/admin/services/${id}/toggle-active`, { is_active }),
  updateServiceVerificationStatus: (id: string, status: string) => aPut<any>(`/admin/services/${id}/verification-status`, { status }),
  // Posts
  updatePostStatus: (id: string, is_active: boolean, reason?: string) => aPut<any>(`/admin/posts/${id}/status`, { is_active, reason }),
  getPostDetail: (id: string) => aGet<any>(`/admin/posts/${id}`),
  deletePostEcho: (postId: string, echoId: string) => aDel<any>(`/admin/posts/${postId}/echoes/${echoId}`),

  // Moments
  updateMomentStatus: (id: string, is_active: boolean, reason?: string) => aPut<any>(`/admin/moments/${id}/status`, { is_active, reason }),
  getMomentDetail: (id: string) => aGet<any>(`/admin/moments/${id}`),
  deleteMomentEcho: (momentId: string, echoId: string) => aDel<any>(`/admin/moments/${momentId}/echoes/${echoId}`),

  // Notifications broadcast
  broadcastNotification: (title: string, message: string) =>
    aPost<any>("/admin/notifications/broadcast", { title, message }),

  // Posts listing
  getPosts: (params?: any) => {
    const qs = new URLSearchParams();
    if (params?.page)  qs.set("page",  params.page);
    if (params?.limit) qs.set("limit", params.limit);
    if (params?.q)     qs.set("q",     params.q);
    return aGet<any>(`/admin/posts${qs.toString() ? `?${qs}` : ""}`);
  },
  deletePost: (id: string) => aDel<any>(`/admin/posts/${id}`),

  // Moments listing
  getMoments: (params?: any) => {
    const qs = new URLSearchParams();
    if (params?.page)  qs.set("page",  params.page);
    if (params?.limit) qs.set("limit", params.limit);
    if (params?.q)     qs.set("q",     params.q);
    return aGet<any>(`/admin/moments${qs.toString() ? `?${qs}` : ""}`);
  },
  deleteMoment: (id: string) => aDel<any>(`/admin/moments/${id}`),

  // User identity verification
  getUserVerifications: (params?: any) => {
    const qs = new URLSearchParams();
    if (params?.page)   qs.set("page",   params.page);
    if (params?.limit)  qs.set("limit",  params.limit);
    if (params?.status) qs.set("status", params.status);
    return aGet<any>(`/admin/user-verifications${qs.toString() ? `?${qs}` : ""}`);
  },
  approveUserVerification: (id: string, notes?: string) => aPut<any>(`/admin/user-verifications/${id}/approve`, { notes }),
  rejectUserVerification: (id: string, notes: string) => aPut<any>(`/admin/user-verifications/${id}/reject`, { notes }),

  // Event detail
  getEventDetail: (id: string) => aGet<any>(`/admin/events/${id}`),

  // Communities
  getCommunities: (params?: any) => {
    const qs = new URLSearchParams();
    if (params?.page)  qs.set("page",  params.page);
    if (params?.limit) qs.set("limit", params.limit);
    if (params?.q)     qs.set("q",     params.q);
    return aGet<any>(`/admin/communities${qs.toString() ? `?${qs}` : ""}`);
  },
  getCommunityDetail: (id: string) => aGet<any>(`/admin/communities/${id}`),
  deleteCommunity: (id: string) => aDel<any>(`/admin/communities/${id}`),

  // Bookings
  getBookings: (params?: any) => {
    const qs = new URLSearchParams();
    if (params?.page)   qs.set("page",   params.page);
    if (params?.limit)  qs.set("limit",  params.limit);
    if (params?.status) qs.set("status", params.status);
    return aGet<any>(`/admin/bookings${qs.toString() ? `?${qs}` : ""}`);
  },

  // NuruCard Orders
  getNuruCardOrders: (params?: any) => {
    const qs = new URLSearchParams();
    if (params?.page)   qs.set("page",   params.page);
    if (params?.limit)  qs.set("limit",  params.limit);
    if (params?.status) qs.set("status", params.status);
    return aGet<any>(`/admin/nuru-cards${qs.toString() ? `?${qs}` : ""}`);
  },
  updateNuruCardOrderStatus: (id: string, data: any) => aPut<any>(`/admin/nuru-cards/${id}/status`, data),

  // Service Categories
  getServiceCategories:    ()                      => aGet<any>("/admin/service-categories"),
  createServiceCategory:   (data: any)             => aPost<any>("/admin/service-categories", data),
  updateServiceCategory:   (id: string, data: any) => aPut<any>(`/admin/service-categories/${id}`, data),
  deleteServiceCategory:   (id: string)            => aDel<any>(`/admin/service-categories/${id}`),
};
