/**
 * Support API - Help tickets, FAQs, live chat
 */

import { get, post, put, buildQueryString, postFormData } from "./helpers";

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  category: "general" | "billing" | "technical" | "feature_request" | "complaint" | "other";
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  assigned_to?: string;
  assigned_agent_name?: string;
  attachments?: Array<{ id: string; filename: string; url: string; size: number }>;
  messages: SupportMessage[];
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  satisfaction_rating?: number;
  satisfaction_comment?: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: "user" | "agent" | "system";
  sender_name: string;
  sender_avatar?: string;
  content: string;
  attachments?: Array<{ id: string; filename: string; url: string }>;
  created_at: string;
  read_at?: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  helpful_count: number;
  not_helpful_count: number;
  display_order: number;
}

export interface FAQCategory {
  id: string;
  name: string;
  icon?: string;
  faq_count: number;
  display_order: number;
}

export const supportApi = {
  // ============================================================================
  // SUPPORT TICKETS
  // ============================================================================

  /**
   * Get my support tickets
   */
  getMyTickets: (params?: { page?: number; limit?: number; status?: string }) => 
    get<{ 
      tickets: SupportTicket[]; 
      summary: { total: number; open: number; in_progress: number; resolved: number };
      pagination: any;
    }>(`/support/tickets${buildQueryString(params)}`),

  /**
   * Get ticket details
   */
  getTicket: (ticketId: string) => get<SupportTicket>(`/support/tickets/${ticketId}`),

  /**
   * Create support ticket
   */
  createTicket: (formData: FormData) => postFormData<SupportTicket>("/support/tickets", formData),

  /**
   * Reply to ticket
   */
  replyToTicket: (ticketId: string, formData: FormData) => 
    postFormData<SupportMessage>(`/support/tickets/${ticketId}/reply`, formData),

  /**
   * Close ticket
   */
  closeTicket: (ticketId: string, data: { reason?: string }) => 
    post<{ id: string; status: string; closed_at: string }>(`/support/tickets/${ticketId}/close`, data),

  /**
   * Reopen ticket
   */
  reopenTicket: (ticketId: string, data: { reason: string }) => 
    post<{ id: string; status: string }>(`/support/tickets/${ticketId}/reopen`, data),

  /**
   * Rate support experience
   */
  rateTicket: (ticketId: string, data: { rating: 1 | 2 | 3 | 4 | 5; comment?: string }) => 
    post<{ rated: boolean }>(`/support/tickets/${ticketId}/rate`, data),

  // ============================================================================
  // FAQs
  // ============================================================================

  /**
   * Get FAQ categories
   */
  getFAQCategories: () => get<FAQCategory[]>("/support/faq/categories"),

  /**
   * Get FAQs
   */
  getFAQs: (params?: { category?: string; search?: string }) => 
    get<FAQ[]>(`/support/faq${buildQueryString(params)}`),

  /**
   * Get single FAQ
   */
  getFAQ: (faqId: string) => get<FAQ>(`/support/faq/${faqId}`),

  /**
   * Rate FAQ helpfulness
   */
  rateFAQ: (faqId: string, data: { helpful: boolean }) => 
    post<{ helpful_count: number; not_helpful_count: number }>(`/support/faq/${faqId}/rate`, data),

  /**
   * Search FAQs
   */
  searchFAQs: (query: string) => 
    get<FAQ[]>(`/support/faq/search?q=${encodeURIComponent(query)}`),

  // ============================================================================
  // LIVE CHAT
  // ============================================================================

  /**
   * Start live chat session
   */
  startChat: (data: { topic?: string; initial_message: string }) => 
    post<{ 
      session_id: string; 
      status: "queued" | "connected"; 
      position_in_queue?: number; 
      estimated_wait_minutes?: number;
    }>("/support/chat/start", data),

  /**
   * Get chat session
   */
  getChatSession: (sessionId: string) => 
    get<{
      session_id: string;
      status: "queued" | "connected" | "ended";
      agent?: { name: string; avatar?: string };
      messages: SupportMessage[];
      started_at: string;
      ended_at?: string;
    }>(`/support/chat/${sessionId}`),

  /**
   * Send chat message
   */
  sendChatMessage: (sessionId: string, data: { content: string }) => 
    post<SupportMessage>(`/support/chat/${sessionId}/message`, data),

  /**
   * End chat session
   */
  endChat: (sessionId: string, data: { rating?: number; feedback?: string }) => 
    post<{ ended: boolean }>(`/support/chat/${sessionId}/end`, data),

  /**
   * Check chat availability
   */
  checkChatAvailability: () => 
    get<{ available: boolean; operating_hours: string; current_wait_time?: number }>("/support/chat/availability"),

  // ============================================================================
  // CONTACT
  // ============================================================================

  /**
   * Submit contact form
   */
  submitContactForm: (data: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
    category?: string;
  }) => post<{ submitted: boolean; reference_number: string }>("/support/contact", data),

  /**
   * Get support contact info
   */
  getContactInfo: () => 
    get<{
      email: string;
      phone: string;
      whatsapp?: string;
      office_address?: string;
      operating_hours: string;
      social_links?: any;
    }>("/support/contact-info"),
};
