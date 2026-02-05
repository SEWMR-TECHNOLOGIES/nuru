/**
 * Messages API - Conversations and messaging
 */

import { get, post, put, del, postFormData, buildQueryString } from "./helpers";
import type { Conversation, Message, PaginatedResponse } from "./types";

export interface ConversationQueryParams {
  page?: number;
  limit?: number;
  filter?: "all" | "unread" | "service" | "event";
}

export interface MessageQueryParams {
  page?: number;
  limit?: number;
  before?: string;
  after?: string;
}

export const messagesApi = {
  // ============================================================================
  // CONVERSATIONS
  // ============================================================================

  /**
   * Get all conversations
   */
  getConversations: (params?: ConversationQueryParams) => 
    get<{ 
      conversations: Conversation[]; 
      summary: { total_conversations: number; total_unread: number };
      pagination: PaginatedResponse<Conversation>["pagination"];
    }>(`/messages/conversations${buildQueryString(params)}`),

  /**
   * Get conversation by ID
   */
  getConversation: (conversationId: string) => get<Conversation>(`/messages/conversations/${conversationId}`),

  /**
   * Start a new conversation
   */
  startConversation: (data: { recipient_id: string; content: string; context_type?: "service" | "event" | "general"; context_id?: string }) => 
    post<{ conversation: Conversation; message: Message }>("/messages/start", data),

  /**
   * Mute conversation
   */
  muteConversation: (conversationId: string) => 
    put<{ conversation_id: string; muted: boolean }>(`/messages/conversations/${conversationId}/mute`),

  /**
   * Unmute conversation
   */
  unmuteConversation: (conversationId: string) => 
    put<{ conversation_id: string; muted: boolean }>(`/messages/conversations/${conversationId}/unmute`),

  /**
   * Archive conversation
   */
  archiveConversation: (conversationId: string) => 
    put<{ conversation_id: string; archived: boolean }>(`/messages/conversations/${conversationId}/archive`),

  /**
   * Unarchive conversation
   */
  unarchiveConversation: (conversationId: string) => 
    put<{ conversation_id: string; archived: boolean }>(`/messages/conversations/${conversationId}/unarchive`),

  /**
   * Delete conversation
   */
  deleteConversation: (conversationId: string) => del(`/messages/conversations/${conversationId}`),

  // ============================================================================
  // MESSAGES
  // ============================================================================

  /**
   * Get messages in a conversation
   */
  getMessages: (conversationId: string, params?: MessageQueryParams) => 
    get<{ 
      conversation: Conversation; 
      messages: Message[];
      pagination: PaginatedResponse<Message>["pagination"];
    }>(`/messages/${conversationId}${buildQueryString(params)}`),

  /**
   * Send a message
   */
  send: (conversationId: string, data: { content: string; reply_to_id?: string }) => 
    post<Message>(`/messages/${conversationId}`, data),

  /**
   * Send message with attachment
   */
  sendWithAttachment: (conversationId: string, formData: FormData) => 
    postFormData<Message>(`/messages/${conversationId}/upload`, formData),

  /**
   * Mark message as read
   */
  markAsRead: (conversationId: string, messageId: string) => 
    put<{ message_id: string; is_read: boolean; read_at: string }>(`/messages/${conversationId}/${messageId}/read`),

  /**
   * Mark all messages as read
   */
  markAllAsRead: (conversationId: string) => 
    put<{ conversation_id: string; read_count: number }>(`/messages/${conversationId}/read-all`),

  /**
   * Delete message
   */
  deleteMessage: (conversationId: string, messageId: string) => 
    del(`/messages/${conversationId}/${messageId}`),

  /**
   * Report message
   */
  reportMessage: (conversationId: string, messageId: string, data: { reason: string; description?: string }) => 
    post<{ report_id: string; status: string }>(`/messages/${conversationId}/${messageId}/report`, data),

  // ============================================================================
  // UNREAD COUNT
  // ============================================================================

  /**
   * Get total unread message count
   */
  getUnreadCount: () => get<{ unread_count: number }>("/messages/unread-count"),
};
