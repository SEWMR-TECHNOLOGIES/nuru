/**
 * Nuru Cards API - NFC card management and check-in
 */

import { get, post, put, del, buildQueryString } from "./helpers";
import type { NuruCard, NuruCardType, PaginatedResponse } from "./types";

export interface CardQueryParams {
  page?: number;
  limit?: number;
  status?: "active" | "inactive" | "suspended" | "all";
  card_type?: "regular" | "premium" | "all";
}

export const nuruCardsApi = {
  // ============================================================================
  // CARD TYPES
  // ============================================================================

  /**
   * Get available card types
   */
  getCardTypes: () => get<NuruCardType[]>("/nuru-cards/types"),

  // ============================================================================
  // USER CARDS
  // ============================================================================

  /**
   * Get my cards
   */
  getMyCards: () => get<NuruCard[]>("/nuru-cards/my"),

  /**
   * Get card details
   */
  getCard: (cardId: string) => get<NuruCard>(`/nuru-cards/${cardId}`),

  /**
   * Request a new card
   */
  requestCard: (data: { card_type_id: string; delivery_address?: any }) => 
    post<NuruCard>("/nuru-cards/request", data),

  /**
   * Register a new card
   */
  registerCard: (data: {
    card_number: string;
    activation_code: string;
    pin?: string;
  }) => post<NuruCard>("/nuru-cards/register", data),

  /**
   * Link card to profile
   */
  linkCard: (cardId: string, data: { profile_type: "personal" | "business"; profile_data?: any }) => 
    put<NuruCard>(`/nuru-cards/${cardId}/link`, data),

  /**
   * Update card settings
   */
  updateCard: (cardId: string, data: {
    display_name?: string;
    is_active?: boolean;
    pin?: string;
    sharing_settings?: {
      share_phone?: boolean;
      share_email?: boolean;
      share_social?: boolean;
    };
  }) => put<NuruCard>(`/nuru-cards/${cardId}`, data),

  /**
   * Deactivate card
   */
  deactivateCard: (cardId: string, data: { reason: string }) => 
    post<{ card_id: string; status: string; deactivated_at: string }>(`/nuru-cards/${cardId}/deactivate`, data),

  /**
   * Report lost/stolen card
   */
  reportLost: (cardId: string, data: { reason: "lost" | "stolen"; details?: string }) => 
    post<{ card_id: string; status: string; reported_at: string; replacement_info?: any }>(`/nuru-cards/${cardId}/report-lost`, data),

  /**
   * Request replacement card
   */
  requestReplacement: (cardId: string, data: { 
    reason: string; 
    delivery_address?: { street: string; city: string; postal_code?: string; country: string };
    shipping_method?: "standard" | "express";
  }) => post<{ request_id: string; status: string; estimated_delivery?: string }>(`/nuru-cards/${cardId}/replace`, data),

  // ============================================================================
  // CHECK-IN
  // ============================================================================

  /**
   * Check in to event using card
   */
  checkIn: (data: { card_number: string; event_id: string; pin?: string }) => 
    post<{
      success: boolean;
      guest_name: string;
      event_name: string;
      checked_in_at: string;
      table_number?: string;
      seat_number?: number;
      special_instructions?: string;
      is_premium: boolean;
      benefits?: string[];
    }>("/nuru-cards/check-in", data),

  /**
   * Quick check-in (NFC tap)
   */
  quickCheckIn: (data: { nfc_id: string; event_id: string }) => 
    post<{
      success: boolean;
      guest_name: string;
      checked_in_at: string;
      requires_pin: boolean;
    }>("/nuru-cards/quick-check-in", data),

  /**
   * Get check-in history
   */
  getCheckInHistory: (cardId: string, params?: { page?: number; limit?: number }) => 
    get<{
      checkins: Array<{
        id: string;
        event_id: string;
        event_name: string;
        event_date: string;
        checked_in_at: string;
        venue?: string;
      }>;
      pagination: any;
    }>(`/nuru-cards/${cardId}/checkins${buildQueryString(params)}`),

  // ============================================================================
  // CARD SHARING
  // ============================================================================

  /**
   * Get card sharing profile
   */
  getSharingProfile: (cardNumber: string) => 
    get<{
      display_name: string;
      avatar?: string;
      bio?: string;
      phone?: string;
      email?: string;
      social_links?: any;
      card_type: string;
    }>(`/nuru-cards/profile/${cardNumber}`),

  /**
   * Record card tap/share
   */
  recordTap: (cardNumber: string, data: { 
    location?: { latitude: number; longitude: number }; 
    device_info?: string;
  }) => post<{ tap_id: string; tapped_at: string }>(`/nuru-cards/${cardNumber}/tap`, data),

  /**
   * Get tap analytics
   */
  getTapAnalytics: (cardId: string, params?: { start_date?: string; end_date?: string }) => 
    get<{
      total_taps: number;
      unique_taps: number;
      taps_by_date: Array<{ date: string; count: number }>;
      taps_by_location: Array<{ location: string; count: number }>;
    }>(`/nuru-cards/${cardId}/analytics${buildQueryString(params)}`),

  // ============================================================================
  // PREMIUM FEATURES
  // ============================================================================

  /**
   * Upgrade to premium
   */
  upgradeToPremium: (cardId: string, data: { payment_method: string; phone?: string }) => 
    post<{ 
      card_id: string; 
      card_type: string; 
      upgraded_at: string; 
      new_benefits: string[];
      payment_status: string;
    }>(`/nuru-cards/${cardId}/upgrade`, data),

  /**
   * Get premium benefits
   */
  getPremiumBenefits: () => 
    get<{
      benefits: Array<{
        id: string;
        name: string;
        description: string;
        icon: string;
      }>;
      pricing: {
        monthly: number;
        yearly: number;
        currency: string;
      };
    }>("/nuru-cards/premium-benefits"),

  // ============================================================================
  // EVENT ORGANIZER
  // ============================================================================

  /**
   * Get event check-in stats
   */
  getEventCheckInStats: (eventId: string) => 
    get<{
      total_guests: number;
      checked_in: number;
      pending: number;
      premium_guests: number;
      checkin_rate: number;
      recent_checkins: Array<{
        guest_name: string;
        checked_in_at: string;
        card_type: string;
      }>;
    }>(`/events/${eventId}/checkin-stats`),

  /**
   * Manual check-in search
   */
  searchForCheckIn: (eventId: string, query: string) => 
    get<{
      guests: Array<{
        id: string;
        name: string;
        phone?: string;
        email?: string;
        card_number?: string;
        checked_in: boolean;
        table_number?: string;
      }>;
    }>(`/events/${eventId}/checkin-search?q=${encodeURIComponent(query)}`),
};
