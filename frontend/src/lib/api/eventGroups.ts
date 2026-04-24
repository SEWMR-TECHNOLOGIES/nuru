/**
 * Event Groups API — premium chat workspace + scoreboard
 */
import { request, get, post, put, del, buildQueryString } from "./helpers";
import type { ApiResponse } from "./types";

const guestHeaders = (): HeadersInit | undefined => {
  const t = localStorage.getItem("eg_guest_token");
  return t ? { "X-Guest-Token": t } : undefined;
};

async function gget<T>(endpoint: string): Promise<ApiResponse<T>> {
  const h = guestHeaders();
  return h ? request<T>(endpoint, { method: "GET", headers: h }) : get<T>(endpoint);
}
async function gpost<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  const h = guestHeaders();
  return h
    ? request<T>(endpoint, { method: "POST", body: body ? JSON.stringify(body) : undefined, headers: h })
    : post<T>(endpoint, body);
}
async function gdel<T>(endpoint: string): Promise<ApiResponse<T>> {
  const h = guestHeaders();
  return h ? request<T>(endpoint, { method: "DELETE", headers: h }) : del<T>(endpoint);
}

export const eventGroupsApi = {
  listMyGroups: (search?: string) =>
    get<{ groups: any[] }>(`/event-groups/${search ? `?search=${encodeURIComponent(search)}` : ""}`),

  createForEvent: (eventId: string, data?: { name?: string; description?: string; image_url?: string }) =>
    post<any>(`/event-groups/events/${eventId}`, data || {}),

  getForEvent: (eventId: string) => gget<any>(`/event-groups/events/${eventId}`),

  get: (groupId: string) => gget<any>(`/event-groups/${groupId}`),

  update: (groupId: string, data: any) => put<any>(`/event-groups/${groupId}`, data),

  members: (groupId: string) => gget<{ members: any[] }>(`/event-groups/${groupId}/members`),

  syncMembers: (groupId: string) => post<any>(`/event-groups/${groupId}/sync-members`),

  removeMember: (groupId: string, memberId: string) =>
    del<any>(`/event-groups/${groupId}/members/${memberId}`),

  addContributorMember: (groupId: string, contributorId: string) =>
    post<any>(`/event-groups/${groupId}/members/add-contributor`, { contributor_id: contributorId }),

  addableContributors: (groupId: string) =>
    get<{ contributors: { contributor_id: string; name: string; phone?: string; is_nuru_user: boolean }[] }>(
      `/event-groups/${groupId}/addable-contributors`,
    ),

  createInvite: (groupId: string, data: { contributor_id?: string; phone?: string; name?: string }) =>
    post<{ token: string; phone?: string; name?: string }>(`/event-groups/${groupId}/invite-link`, data),

  previewInvite: (token: string) =>
    get<{ group: any; prefill: { name?: string; phone?: string } }>(`/event-groups/invites/${token}`),

  claimInvite: (token: string, data: { name?: string; phone?: string }) =>
    post<{ group_id: string; member_id: string; guest_token: string | null; name?: string }>(
      `/event-groups/invites/${token}/claim`, data,
    ),

  messages: (groupId: string, params?: { page?: number; limit?: number; after?: string }) =>
    gget<{ messages: any[] }>(`/event-groups/${groupId}/messages${buildQueryString(params)}`),

  sendMessage: (groupId: string, data: { content?: string; image_url?: string; reply_to_id?: string }) =>
    gpost<any>(`/event-groups/${groupId}/messages`, data),

  deleteMessage: (groupId: string, messageId: string) =>
    gdel<any>(`/event-groups/${groupId}/messages/${messageId}`),

  markRead: (groupId: string) => gpost<any>(`/event-groups/${groupId}/read`),

  reactToMessage: (groupId: string, messageId: string, emoji: string) =>
    gpost<any>(`/event-groups/${groupId}/messages/${messageId}/reactions`, { emoji }),

  scoreboard: (groupId: string) => gget<any>(`/event-groups/${groupId}/scoreboard`),
};
