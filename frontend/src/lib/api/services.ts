/**
 * Services API - User services and public service discovery
 */

import { get, post, put, del, postFormData, putFormData, buildQueryString } from "./helpers";
import type { UserService, ServicePackage, ServiceReview, ServiceKycStatus, KycRequirement, PaginatedResponse } from "./types";

export interface ServiceQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: string;
  type_id?: string;
  location?: string;
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  verified?: boolean;
  available?: boolean;
  event_type_id?: string;
  sort_by?: "relevance" | "price_low" | "price_high" | "rating" | "reviews" | "newest";
  lat?: number;
  lng?: number;
  radius_km?: number;
}

export const userServicesApi = {
  // ============================================================================
  // USER SERVICES CRUD
  // ============================================================================

  /**
   * Get all services for current user
   */
  getAll: () => get<UserService[]>("/user-services/"),

  /**
   * Get a single service by ID
   */
  getById: (serviceId: string) => get<UserService>(`/user-services/${serviceId}`),

  /**
   * Create a new service
   */
  create: (formData: FormData) => postFormData<UserService>("/user-services/", formData),

  /**
   * Update a service
   */
  update: (serviceId: string, formData: FormData) => putFormData<UserService>(`/user-services/${serviceId}`, formData),

  /**
   * Delete a service
   */
  delete: (serviceId: string) => del(`/user-services/${serviceId}`),

  // ============================================================================
  // SERVICE PACKAGES
  // ============================================================================

  /**
   * Get service packages
   */
  getPackages: (serviceId: string) => get<ServicePackage[]>(`/user-services/${serviceId}/packages`),

  /**
   * Add a package
   */
  addPackage: (serviceId: string, data: Partial<ServicePackage>) => 
    post<ServicePackage>(`/user-services/${serviceId}/packages`, data),

  /**
   * Update a package
   */
  updatePackage: (serviceId: string, packageId: string, data: Partial<ServicePackage>) => 
    put<ServicePackage>(`/user-services/${serviceId}/packages/${packageId}`, data),

  /**
   * Delete a package
   */
  deletePackage: (serviceId: string, packageId: string) => 
    del(`/user-services/${serviceId}/packages/${packageId}`),

  /**
   * Reorder packages
   */
  reorderPackages: (serviceId: string, data: { packages: Array<{ id: string; display_order: number }> }) => 
    put<ServicePackage[]>(`/user-services/${serviceId}/packages/reorder`, data),

  // ============================================================================
  // KYC VERIFICATION
  // ============================================================================

  /**
   * Get KYC status for a service
   */
  getKycStatus: (serviceId: string) => get<ServiceKycStatus>(`/user-services/${serviceId}/kyc`),

  /**
   * Get KYC requirements for a service
   */
  getKyc: (serviceId: string) => get<KycRequirement[]>(`/user-services/${serviceId}/kyc`),

  /**
   * Upload KYC document
   */
  uploadKyc: (serviceId: string, formData: FormData) => 
    postFormData<{ id: string; kyc_requirement_id: string; file_url: string; status: string }>(`/user-services/${serviceId}/kyc`, formData),

  /**
   * Delete KYC document
   */
  deleteKyc: (serviceId: string, kycId: string) => del(`/user-services/${serviceId}/kyc/${kycId}`),

  /**
   * Submit for verification
   */
  submitForVerification: (serviceId: string) => 
    post<{ service_id: string; verification_status: string; submitted_at: string }>(`/user-services/${serviceId}/verify`),

  // ============================================================================
  // SERVICE REVIEWS (Vendor Perspective)
  // ============================================================================

  /**
   * Get reviews for my service
   */
  getReviews: (serviceId: string, params?: { page?: number; limit?: number; rating?: number }) => 
    get<{ reviews: ServiceReview[]; summary: { average_rating: number; total_reviews: number; rating_breakdown: Record<string, number> }; pagination: PaginatedResponse<ServiceReview>["pagination"] }>(`/user-services/${serviceId}/reviews${buildQueryString(params)}`),

  /**
   * Respond to a review
   */
  respondToReview: (serviceId: string, reviewId: string, data: { response: string }) => 
    post<{ review_id: string; vendor_response: string; vendor_response_at: string }>(`/user-services/${serviceId}/reviews/${reviewId}/respond`, data),

  // ============================================================================
  // SERVICE ANALYTICS
  // ============================================================================

  /**
   * Get service analytics
   */
  getAnalytics: (serviceId: string, params?: { period?: "7d" | "30d" | "90d" | "1y" }) => 
    get<{ views: { total: number; trend: number }; inquiries: { total: number; trend: number }; bookings: { total: number; trend: number }; conversion_rate: number; revenue: { total: number; currency: string } }>(`/user-services/${serviceId}/analytics${buildQueryString(params)}`),
};

// ============================================================================
// PUBLIC SERVICES (Discovery)
// ============================================================================

export const servicesApi = {
  /**
   * Search/list public services
   */
  search: (params?: ServiceQueryParams) => 
    get<{ 
      services: UserService[]; 
      filters: { 
        categories: Array<{ id: string; name: string; count: number }>; 
        locations: Array<{ name: string; count: number }>;
        price_range: { min: number; max: number; currency: string };
      };
      pagination: PaginatedResponse<UserService>["pagination"];
    }>(`/services${buildQueryString(params)}`),

  /**
   * Get a single public service by ID
   */
  getById: (serviceId: string) => get<UserService>(`/services/${serviceId}`),

  /**
   * Get service reviews (public)
   */
  getReviews: (serviceId: string, params?: { page?: number; limit?: number; rating?: number; sort?: "newest" | "oldest" | "highest" | "lowest" | "helpful" }) => 
    get<{ reviews: ServiceReview[]; summary: { average_rating: number; total_reviews: number; rating_breakdown: Record<string, number> }; pagination: PaginatedResponse<ServiceReview>["pagination"] }>(`/services/${serviceId}/reviews${buildQueryString(params)}`),

  /**
   * Submit a review
   */
  submitReview: (serviceId: string, data: { rating: number; title?: string; comment: string; event_type?: string; event_date?: string; photos?: string[] }) => 
    post<ServiceReview>(`/services/${serviceId}/reviews`, data),

  /**
   * Mark review as helpful
   */
  markReviewHelpful: (serviceId: string, reviewId: string) => 
    post<{ review_id: string; helpful_count: number }>(`/services/${serviceId}/reviews/${reviewId}/helpful`),

  /**
   * Save/bookmark service
   */
  saveService: (serviceId: string) => post<{ service_id: string; saved_at: string }>(`/services/${serviceId}/save`),

  /**
   * Unsave service
   */
  unsaveService: (serviceId: string) => del(`/services/${serviceId}/save`),

  /**
   * Get saved services
   */
  getSavedServices: (params?: { page?: number; limit?: number }) => 
    get<{ services: UserService[]; pagination: PaginatedResponse<UserService>["pagination"] }>(`/services/saved${buildQueryString(params)}`),

  /**
   * Check service availability
   */
  checkAvailability: (serviceId: string, data: { date: string }) => 
    get<{ available: boolean; next_available_date?: string; blocked_dates?: string[] }>(`/services/${serviceId}/availability?date=${data.date}`),

  /**
   * Report service
   */
  reportService: (serviceId: string, data: { reason: string; description?: string }) => 
    post<{ report_id: string; status: string }>(`/services/${serviceId}/report`, data),
};
