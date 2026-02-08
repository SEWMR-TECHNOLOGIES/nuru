/**
 * Social API - Feed, posts, moments, followers, circles
 */

import { get, post, put, del, postFormData, buildQueryString } from "./helpers";
import type { 
  FeedPost, 
  Moment, 
  Circle, 
  UserProfile,
  PaginatedResponse 
} from "./types";

export interface FeedQueryParams {
  page?: number;
  limit?: number;
  type?: "all" | "following" | "events" | "services" | "moments";
}

export interface PostQueryParams {
  page?: number;
  limit?: number;
  sort_by?: "created_at" | "likes_count";
  sort_order?: "asc" | "desc";
}

export interface MomentQueryParams {
  page?: number;
  limit?: number;
  type?: "all" | "photo" | "video";
  visibility?: "public" | "followers" | "private";
}

export const socialApi = {
  // ============================================================================
  // FEED
  // ============================================================================

  /**
   * Get user feed
   */
  getFeed: (params?: FeedQueryParams) => 
    get<{ items: FeedPost[]; pagination: PaginatedResponse<FeedPost>["pagination"] }>(`/posts/feed${buildQueryString(params)}`),

  /**
   * Get trending posts
   */
  getTrending: (params?: { limit?: number; period?: "day" | "week" | "month" }) => 
    get<FeedPost[]>(`/posts/trending${buildQueryString(params)}`),

  /**
   * Get posts from a specific user
   */
  getUserPosts: (userId: string, params?: PostQueryParams) => 
    get<{ posts: FeedPost[]; pagination: PaginatedResponse<FeedPost>["pagination"] }>(`/posts/user/${userId}${buildQueryString(params)}`),

  // ============================================================================
  // POSTS
  // ============================================================================

  /**
   * Create a new post
   */
  createPost: (formData: FormData) => postFormData<FeedPost>("/posts", formData),

  /**
   * Get a single post
   */
  getPost: (postId: string) => get<FeedPost>(`/posts/${postId}`),

  /**
   * Update a post
   */
  updatePost: (postId: string, data: { content?: string; visibility?: string }) => 
    put<FeedPost>(`/posts/${postId}`, data),

  /**
   * Delete a post
   */
  deletePost: (postId: string) => del(`/posts/${postId}`),

  /**
   * Like a post
   */
  likePost: (postId: string) => post<{ liked: boolean; likes_count: number }>(`/posts/${postId}/like`),

  /**
   * Unlike a post
   */
  unlikePost: (postId: string) => del<{ liked: boolean; likes_count: number }>(`/posts/${postId}/like`),

  /**
   * Get post comments
   */
  getComments: (postId: string, params?: { page?: number; limit?: number }) => 
    get<{ comments: Array<{ id: string; user_id: string; user_name: string; user_avatar?: string; content: string; likes_count: number; created_at: string; replies?: any[] }>; pagination: any }>(`/posts/${postId}/comments${buildQueryString(params)}`),

  /**
   * Add comment to post
   */
  addComment: (postId: string, data: { content: string; parent_id?: string }) => 
    post<{ id: string; content: string; created_at: string }>(`/posts/${postId}/comments`, data),

  /**
   * Delete comment
   */
  deleteComment: (postId: string, commentId: string) => 
    del(`/posts/${postId}/comments/${commentId}`),

  /**
   * Share a post
   */
  sharePost: (postId: string, data: { content?: string; visibility?: string }) => 
    post<FeedPost>(`/posts/${postId}/share`, data),

  /**
   * Report a post
   */
  reportPost: (postId: string, data: { reason: string; details?: string }) => 
    post<{ report_id: string; status: string }>(`/posts/${postId}/report`, data),

  // ============================================================================
  // MOMENTS (Stories)
  // ============================================================================

  /**
   * Get moments feed
   */
  getMoments: (params?: MomentQueryParams) => 
    get<{ users: Array<{ user_id: string; user_name: string; user_avatar?: string; has_unseen: boolean; moments: Moment[] }>; my_moments: Moment[] }>(`/moments${buildQueryString(params)}`),

  /**
   * Create a moment
   */
  createMoment: (formData: FormData) => postFormData<Moment>("/moments", formData),

  /**
   * Get a single moment
   */
  getMoment: (momentId: string) => get<Moment>(`/moments/${momentId}`),

  /**
   * Delete a moment
   */
  deleteMoment: (momentId: string) => del(`/moments/${momentId}`),

  /**
   * View a moment (mark as seen)
   */
  viewMoment: (momentId: string) => post<{ viewed: boolean; view_count: number }>(`/moments/${momentId}/view`),

  /**
   * React to a moment
   */
  reactToMoment: (momentId: string, data: { reaction: string }) => 
    post<{ reaction: string; reaction_count: number }>(`/moments/${momentId}/react`, data),

  /**
   * Reply to a moment
   */
  replyToMoment: (momentId: string, data: { content: string }) => 
    post<{ id: string; content: string; sent_at: string }>(`/moments/${momentId}/reply`, data),

  /**
   * Get moment viewers
   */
  getMomentViewers: (momentId: string) => 
    get<{ viewers: Array<{ user_id: string; user_name: string; user_avatar?: string; viewed_at: string; reaction?: string }> }>(`/moments/${momentId}/viewers`),

  // ============================================================================
  // FOLLOWERS
  // ============================================================================

  /**
   * Get user followers
   */
  getFollowers: (userId: string, params?: { page?: number; limit?: number; search?: string }) => 
    get<{ followers: UserProfile[]; pagination: any }>(`/users/${userId}/followers${buildQueryString(params)}`),

  /**
   * Get user following
   */
  getFollowing: (userId: string, params?: { page?: number; limit?: number; search?: string }) => 
    get<{ following: UserProfile[]; pagination: any }>(`/users/${userId}/following${buildQueryString(params)}`),

  /**
   * Follow a user
   */
  followUser: (userId: string) => post<{ following: boolean; follower_count: number }>(`/users/${userId}/follow`),

  /**
   * Unfollow a user
   */
  unfollowUser: (userId: string) => del<{ following: boolean; follower_count: number }>(`/users/${userId}/follow`),

  /**
   * Remove a follower
   */
  removeFollower: (userId: string) => del<{ removed: boolean }>(`/users/${userId}/remove-follower`),

  /**
   * Get follow suggestions
   */
  getFollowSuggestions: (params?: { limit?: number }) => 
    get<UserProfile[]>(`/users/search${buildQueryString({ ...params, suggested: true })}`),

  // ============================================================================
  // CIRCLES (Close friends groups)
  // ============================================================================

  /**
   * Get my circles
   */
  getCircles: () => get<Circle[]>("/circles"),

  /**
   * Create a circle
   */
  createCircle: (data: { name: string; description?: string; color?: string; icon?: string }) => 
    post<Circle>("/circles", data),

  /**
   * Update a circle
   */
  updateCircle: (circleId: string, data: { name?: string; description?: string; color?: string; icon?: string }) => 
    put<Circle>(`/circles/${circleId}`, data),

  /**
   * Delete a circle
   */
  deleteCircle: (circleId: string) => del(`/circles/${circleId}`),

  /**
   * Add member to circle
   */
  addCircleMember: (circleId: string, userId: string) => 
    post<{ added: boolean; member_count: number }>(`/circles/${circleId}/members/${userId}`),

  /**
   * Remove member from circle
   */
  removeCircleMember: (circleId: string, userId: string) => 
    del<{ removed: boolean; member_count: number }>(`/circles/${circleId}/members/${userId}`),

  /**
   * Get circle members
   */
  getCircleMembers: (circleId: string) => 
    get<{ members: UserProfile[] }>(`/circles/${circleId}/members`),

  // ============================================================================
  // COMMUNITIES
  // ============================================================================

  /**
   * Get all communities
   */
  getCommunities: (params?: { page?: number; limit?: number }) =>
    get<any[]>(`/communities${buildQueryString(params)}`),

  /**
   * Get my communities
   */
  getMyCommunities: () => get<any[]>("/communities/my"),

  /**
   * Create a community
   */
  createCommunity: (data: { name: string; description?: string; is_public?: boolean }) =>
    post<any>("/communities", data),

  /**
   * Join a community
   */
  joinCommunity: (communityId: string) =>
    post<{ joined: boolean; member_count: number }>(`/communities/${communityId}/join`),

  /**
   * Leave a community
   */
  leaveCommunity: (communityId: string) =>
    post<{ left: boolean; member_count: number }>(`/communities/${communityId}/leave`),

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  /**
   * Get notifications
   */
  getNotifications: (params?: { page?: number; limit?: number; filter?: "all" | "unread" }) => 
    get<{ notifications: Array<{ id: string; type: string; message: string; is_read: boolean; created_at: string; actor?: { user_id: string; first_name: string; last_name: string; avatar?: string } }>; unread_count: number; pagination: any }>(`/notifications${buildQueryString(params)}`),

  /**
   * Mark all notifications as read
   */
  markAllNotificationsRead: () => put<{ read_count: number }>("/notifications/read-all"),

  /**
   * Mark single notification as read
   */
  markNotificationRead: (notificationId: string) => 
    put<{ notification_id: string; is_read: boolean }>(`/notifications/${notificationId}/read`),

  // ============================================================================
  // CONVERSATIONS (Messages) - aligned with /messages/ backend routes
  // ============================================================================

  getConversations: (params?: { page?: number; limit?: number }) => 
    get<any[]>(`/messages/${buildQueryString(params)}`),

  getMessages: (conversationId: string, params?: { page?: number; limit?: number }) => 
    get<any[]>(`/messages/${conversationId}${buildQueryString(params)}`),

  sendMessage: (conversationId: string, data: { content: string; attachments?: string[] }) => 
    post<{ id: string; content: string; sent_at: string }>(`/messages/${conversationId}`, data),

  createConversation: (data: { recipient_id: string; message?: string }) => 
    post<any>("/messages/start", data),
};
