/**
 * Messages API - Conversations and messaging
 * Aligned with backend/nuru-routes/messages.py
 */

import { get, post, put, del, buildQueryString } from "./helpers";

export const messagesApi = {
  // ============================================================================
  // CONVERSATIONS
  // ============================================================================

  getConversations: () =>
    get<any[]>("/messages/"),

  startConversation: (data: { recipient_id: string; message?: string }) =>
    post<any>("/messages/start", data),

  archiveConversation: (conversationId: string) =>
    post<any>(`/messages/${conversationId}/archive`),

  unarchiveConversation: (conversationId: string) =>
    post<any>(`/messages/${conversationId}/unarchive`),

  // ============================================================================
  // MESSAGES
  // ============================================================================

  getMessages: (conversationId: string, params?: { page?: number; limit?: number }) =>
    get<any[]>(`/messages/${conversationId}${buildQueryString(params)}`),

  send: (conversationId: string, data: { content: string; reply_to_id?: string; attachments?: any[] }) =>
    post<any>(`/messages/${conversationId}`, data),

  markAsRead: (conversationId: string) =>
    put<any>(`/messages/${conversationId}/read`),

  deleteMessage: (conversationId: string, messageId: string) =>
    del(`/messages/${conversationId}/messages/${messageId}`),

  // ============================================================================
  // UNREAD COUNT
  // ============================================================================

  getUnreadCount: () => get<{ count: number }>("/messages/unread/count"),
};
