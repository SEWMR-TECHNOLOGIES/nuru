/**
 * Profile API - User profiles and social features
 */

import { get, post, put, del, putFormData, postFormData, buildQueryString } from "./helpers";
import type { UserProfile, User, Event, FeedPost, UserService, PaginatedResponse } from "./types";

export interface FollowersQueryParams {
  page?: number;
  limit?: number;
  search?: string;
}

export const profileApi = {
  // ============================================================================
  // PROFILE CRUD
  // ============================================================================

  /**
   * Get current user profile
   */
  getMyProfile: () => get<UserProfile>("/users/profile"),

  /**
   * Get user profile by ID (public)
   */
  getById: (userId: string) => 
    get<UserProfile & { is_following?: boolean; is_followed_by?: boolean; mutual_followers_count?: number }>(`/users/${userId}`),

  /**
   * Update current user profile
   */
  update: (formData: FormData) => putFormData<UserProfile>("/users/profile", formData),

  /**
   * Update password
   */
  updatePassword: (data: { current_password: string; new_password: string; confirm_password: string }) => 
    post("/users/change-password", data),

  /**
   * Update email
   */
  updateEmail: (data: { new_email: string; password: string }) => 
    put<{ pending_email: string; verification_expires_at: string }>("/users/email", data),

  /**
   * Update phone
   */
  updatePhone: (data: { new_phone: string; password: string }) => 
    put<{ pending_phone: string; verification_expires_at: string }>("/users/phone", data),

  // ============================================================================
  // SOCIAL - FOLLOW
  // ============================================================================

  /**
   * Follow a user
   */
  follow: (userId: string) => 
    post<{ following_id: string; follower_id: string; followed_id: string; created_at: string }>(`/users/${userId}/follow`),

  /**
   * Unfollow a user
   */
  unfollow: (userId: string) => del(`/users/${userId}/follow`),

  /**
   * Get user's followers
   */
  getFollowers: (userId: string, params?: FollowersQueryParams) => 
    get<{ 
      followers: Array<User & { is_following?: boolean; is_followed_by?: boolean; followed_at: string }>; 
      pagination: PaginatedResponse<User>["pagination"];
    }>(`/users/${userId}/followers${buildQueryString(params)}`),

  /**
   * Get users that a user is following
   */
  getFollowing: (userId: string, params?: FollowersQueryParams) => 
    get<{ 
      following: Array<User & { is_following?: boolean; is_followed_by?: boolean; followed_at: string }>; 
      pagination: PaginatedResponse<User>["pagination"];
    }>(`/users/${userId}/following${buildQueryString(params)}`),

  // ============================================================================
  // USER CONTENT
  // ============================================================================

  /**
   * Get user's public events
   */
  getEvents: (userId: string, params?: { page?: number; limit?: number; status?: "upcoming" | "past" | "all" }) => 
    get<{ events: Event[]; pagination: PaginatedResponse<Event>["pagination"] }>(`/users/${userId}/events${buildQueryString(params)}`),

  /**
   * Get user's posts
   */
  getPosts: (userId: string, params?: { page?: number; limit?: number }) => 
    get<{ posts: FeedPost[]; pagination: PaginatedResponse<FeedPost>["pagination"] }>(`/users/${userId}/posts${buildQueryString(params)}`),

  /**
   * Get user's services (vendor only)
   */
  getServices: (userId: string, params?: { page?: number; limit?: number }) => 
    get<{ services: UserService[]; pagination: PaginatedResponse<UserService>["pagination"] }>(`/users/${userId}/services${buildQueryString(params)}`),

  // ============================================================================
  // BLOCKING
  // ============================================================================

  /**
   * Block a user
   */
  blockUser: (userId: string) => post<{ blocked_user_id: string; created_at: string }>(`/users/${userId}/block`),

  /**
   * Unblock a user
   */
  unblockUser: (userId: string) => del(`/users/${userId}/block`),

  /**
   * Get blocked users
   */
  getBlockedUsers: (params?: { page?: number; limit?: number }) => 
    get<{ blocked_users: Array<User & { blocked_at: string }>; pagination: PaginatedResponse<User>["pagination"] }>(`/users/blocked${buildQueryString(params)}`),

  // ============================================================================
  // ACCOUNT
  // ============================================================================

  /**
   * Request account deletion
   */
  requestAccountDeletion: (data: { password: string; reason?: string }) => 
    post<{ deletion_scheduled_at: string; can_cancel_until: string }>("/users/delete-account", data),

  /**
   * Cancel account deletion
   */
  cancelAccountDeletion: () => del("/users/delete-account"),

  /**
   * Download account data
   */
  downloadData: () => post<{ download_url: string; expires_at: string }>("/users/download-data"),

  // ============================================================================
  // IDENTITY VERIFICATION
  // ============================================================================

  /**
   * Submit identity verification documents
   */
  submitVerification: (formData: FormData) => postFormData<{ status: string; submitted_at: string }>("/users/verify-identity", formData),

  /**
   * Get verification status
   */
  getVerificationStatus: () => get<{ status: string; submitted_at?: string; verified_at?: string; rejection_reason?: string }>("/users/verify-identity/status"),
};
