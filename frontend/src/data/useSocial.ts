/**
 * Social Data Hooks - Feed, Posts, Moments, Followers, Circles
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { socialApi, FeedQueryParams, MomentQueryParams } from "@/lib/api/social";
import type { FeedPost, Moment, Circle, UserProfile } from "@/lib/api/types";
import { throwApiError } from "@/lib/api/showApiErrors";

// ============================================================================
// FEED (with module-level cache for scroll preservation)
// ============================================================================

// Module-level cache so feed data survives unmount/remount cycles
let _feedCache: FeedPost[] = [];
let _feedPaginationCache: any = null;
let _feedHasLoaded = false;

export const useFeed = (initialParams?: FeedQueryParams) => {
  const [items, setItems] = useState<FeedPost[]>(_feedCache);
  const [loading, setLoading] = useState(!_feedHasLoaded);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(_feedPaginationCache);

  const fetchFeed = useCallback(async (params?: FeedQueryParams) => {
    // Only show loading on very first load (no cached data)
    if (!_feedHasLoaded) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await socialApi.getFeed(params || initialParams);
      if (response.success) {
        const feedData = response.data as any;
        const feedItems = feedData?.posts || feedData?.items || (Array.isArray(feedData) ? feedData : []);
        _feedCache = feedItems;
        _feedPaginationCache = feedData?.pagination;
        _feedHasLoaded = true;
        setItems(feedItems);
        setPagination(feedData?.pagination);
      } else {
        setError(response.message || "Failed to fetch feed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    } 
  }, [initialParams]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const loadMore = async (page: number) => {
    try {
      const response = await socialApi.getFeed({ ...(initialParams || {}), page });
      if (response.success) {
        const feedData = response.data as any;
        const moreItems = feedData?.posts || feedData?.items || (Array.isArray(feedData) ? feedData : []);
        const combined = [..._feedCache, ...moreItems];
        _feedCache = combined;
        _feedPaginationCache = feedData?.pagination;
        setItems(combined);
        setPagination(feedData?.pagination);
      }
    } catch (err) {
      // silent
    }
  };

  return { items, loading, error, pagination, refetch: fetchFeed, loadMore };
};

// ============================================================================
// POSTS
// ============================================================================

export const usePost = (postId: string | null) => {
  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getPost(postId);
      if (response.success) {
        setPost(response.data);
      } else {
        setError(response.message || "Failed to fetch post");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (postId) fetchPost();
  }, [fetchPost, postId]);

  const glowPost = async () => {
    if (!postId) return;
    try {
      const response = await socialApi.glowPost(postId);
      if (response.success) {
        setPost(prev => prev ? { ...prev, has_glowed: true, glow_count: (prev as any).glow_count + 1 } : null);
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const unglowPost = async () => {
    if (!postId) return;
    try {
      const response = await socialApi.unglowPost(postId);
      if (response.success) {
        setPost(prev => prev ? { ...prev, has_glowed: false, glow_count: Math.max(0, (prev as any).glow_count - 1) } : null);
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { post, loading, error, refetch: fetchPost, glowPost, unglowPost };
};

export const usePostComments = (postId: string | null) => {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchComments = useCallback(async (params?: { page?: number; limit?: number }) => {
    if (!postId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getComments(postId, params);
      if (response.success) {
        const data = response.data as any;
        setComments(data?.comments || data?.items || (Array.isArray(data) ? data : []));
        setPagination(data?.pagination);
      } else {
        setError(response.message || "Failed to fetch comments");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (postId) fetchComments();
  }, [fetchComments, postId]);

  const addComment = async (content: string, parentId?: string) => {
    if (!postId) return null;
    try {
      const response = await socialApi.addComment(postId, { content, parent_id: parentId });
      if (response.success) {
        await fetchComments();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!postId) return;
    try {
      const response = await socialApi.deleteComment(postId, commentId);
      if (response.success) {
        await fetchComments();
      } else {
        throwApiError(response);
      }
    } catch (err) {
      throw err;
    }
  };

  return { comments, loading, error, pagination, refetch: fetchComments, addComment, deleteComment };
};

// Module-level cache for moments
let _momentsUsersCache: any[] = [];
let _momentsMyCache: Moment[] = [];
let _momentsHasLoaded = false;

export const useMoments = (params?: MomentQueryParams) => {
  const [users, setUsers] = useState<any[]>(_momentsUsersCache);
  const [myMoments, setMyMoments] = useState<Moment[]>(_momentsMyCache);
  const [loading, setLoading] = useState(!_momentsHasLoaded);
  const [error, setError] = useState<string | null>(null);

  const fetchMoments = useCallback(async () => {
    if (!_momentsHasLoaded) setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getMoments(params);
      if (response.success) {
        const data = response.data as any;
        const u = data?.users || [];
        const m = data?.my_moments || [];
        _momentsUsersCache = u;
        _momentsMyCache = m;
        _momentsHasLoaded = true;
        setUsers(u);
        setMyMoments(m);
      } else {
        setError(response.message || "Failed to fetch moments");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchMoments();
  }, [fetchMoments]);

  const createMoment = async (formData: FormData) => {
    try {
      const response = await socialApi.createMoment(formData);
      if (response.success) {
        await fetchMoments();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const deleteMoment = async (momentId: string) => {
    try {
      const response = await socialApi.deleteMoment(momentId);
      if (response.success) {
        await fetchMoments();
      } else {
        throwApiError(response);
      }
    } catch (err) {
      throw err;
    }
  };

  const viewMoment = async (momentId: string) => {
    try {
      const response = await socialApi.viewMoment(momentId);
      return response.success ? response.data : null;
    } catch {
      return null;
    }
  };

  return { users, myMoments, loading, error, refetch: fetchMoments, createMoment, deleteMoment, viewMoment };
};

// ============================================================================
// FOLLOWERS
// ============================================================================

// Module-level cache for followers
let _followersCache: Map<string, UserProfile[]> = new Map();

export const useFollowers = (userId: string | null) => {
  const cached = userId ? _followersCache.get(userId) : undefined;
  const [followers, setFollowers] = useState<UserProfile[]>(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchFollowers = useCallback(async (params?: { page?: number; limit?: number; search?: string }) => {
    if (!userId) return;
    if (!_followersCache.has(userId)) setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getFollowers(userId, params);
      if (response.success) {
        const data = response.data as any;
        const items = data?.followers || data?.items || (Array.isArray(data) ? data : []);
        _followersCache.set(userId, items);
        setFollowers(items);
        setPagination(data?.pagination);
      } else {
        setError(response.message || "Failed to fetch followers");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchFollowers();
  }, [fetchFollowers, userId]);

  return { followers, loading, error, pagination, refetch: fetchFollowers };
};

// Module-level cache for following
let _followingCache: Map<string, UserProfile[]> = new Map();

export const useFollowing = (userId: string | null) => {
  const cached = userId ? _followingCache.get(userId) : undefined;
  const [following, setFollowing] = useState<UserProfile[]>(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchFollowing = useCallback(async (params?: { page?: number; limit?: number; search?: string }) => {
    if (!userId) return;
    if (!_followingCache.has(userId)) setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getFollowing(userId, params);
      if (response.success) {
        const data = response.data as any;
        const items = data?.following || data?.items || (Array.isArray(data) ? data : []);
        _followingCache.set(userId, items);
        setFollowing(items);
        setPagination(data?.pagination);
      } else {
        setError(response.message || "Failed to fetch following");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchFollowing();
  }, [fetchFollowing, userId]);

  const followUser = async (targetUserId: string) => {
    try {
      const response = await socialApi.followUser(targetUserId);
      if (response.success) {
        await fetchFollowing();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const unfollowUser = async (targetUserId: string) => {
    try {
      const response = await socialApi.unfollowUser(targetUserId);
      if (response.success) {
        await fetchFollowing();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { following, loading, error, pagination, refetch: fetchFollowing, followUser, unfollowUser };
};

// Module-level cache for follow suggestions
let _suggestionsCache: UserProfile[] = [];
let _suggestionsHasLoaded = false;

export const useFollowSuggestions = (limit?: number) => {
  const [suggestions, setSuggestions] = useState<UserProfile[]>(_suggestionsCache);
  const [loading, setLoading] = useState(!_suggestionsHasLoaded);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    if (!_suggestionsHasLoaded) setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getFollowSuggestions({ limit });
      if (response.success) {
        const data = response.data as any;
        const items = Array.isArray(data) ? data : data?.items || [];
        _suggestionsCache = items;
        _suggestionsHasLoaded = true;
        setSuggestions(items);
      } else {
        setError(response.message || "Failed to fetch suggestions");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  return { suggestions, loading, error, refetch: fetchSuggestions };
};

// ============================================================================
// CIRCLES
// ============================================================================

interface CircleWithMembers {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  member_count?: number;
  members?: any[];
}

// Module-level cache for circles
let _circlesCache: CircleWithMembers[] = [];
let _circlesHasLoaded = false;

export const useCircles = () => {
  const [circles, setCircles] = useState<CircleWithMembers[]>(_circlesCache);
  const [loading, setLoading] = useState(!_circlesHasLoaded);
  const [error, setError] = useState<string | null>(null);

  const fetchCircles = useCallback(async () => {
    if (!_circlesHasLoaded) setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getCircles();
      if (response.success) {
        const data = response.data as any;
        const circlesList = Array.isArray(data) ? data : data?.items || [];
        _circlesCache = circlesList;
        _circlesHasLoaded = true;
        setCircles(circlesList);
      } else {
        setError(response.message || "Failed to fetch circles");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCircles();
  }, [fetchCircles]);

  const createCircle = async (data: { name: string; description?: string; color?: string; icon?: string }) => {
    try {
      const response = await socialApi.createCircle(data);
      if (response.success) {
        await fetchCircles();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const updateCircle = async (circleId: string, data: { name?: string; description?: string; color?: string; icon?: string }) => {
    try {
      const response = await socialApi.updateCircle(circleId, data);
      if (response.success) {
        await fetchCircles();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const deleteCircle = async (circleId: string) => {
    try {
      const response = await socialApi.deleteCircle(circleId);
      if (response.success) {
        await fetchCircles();
      } else {
        throwApiError(response);
      }
    } catch (err) {
      throw err;
    }
  };

  const addMember = async (circleId: string, userId: string) => {
    try {
      const response = await socialApi.addCircleMember(circleId, userId);
      if (response.success) {
        await fetchCircles();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const removeMember = async (circleId: string, userId: string) => {
    try {
      const response = await socialApi.removeCircleMember(circleId, userId);
      if (response.success) {
        await fetchCircles();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { circles, loading, error, refetch: fetchCircles, createCircle, updateCircle, deleteCircle, addMember, removeMember };
};

// ============================================================================
// COMMUNITIES
// ============================================================================

// Module-level cache for communities
let _communitiesCache: any[] = [];
let _myCommunitiesCache: any[] = [];
let _communitiesHasLoaded = false;

export const useCommunities = () => {
  const [communities, setCommunities] = useState<any[]>(_communitiesCache);
  const [myCommunities, setMyCommunities] = useState<any[]>(_myCommunitiesCache);
  const [loading, setLoading] = useState(!_communitiesHasLoaded);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunities = useCallback(async () => {
    if (!_communitiesHasLoaded) setLoading(true);
    setError(null);
    try {
      const [allRes, myRes] = await Promise.all([
        socialApi.getCommunities(),
        socialApi.getMyCommunities()
      ]);
      if (allRes.success) {
        const data = allRes.data as any;
        const items = Array.isArray(data) ? data : data?.items || [];
        _communitiesCache = items;
        setCommunities(items);
      }
      if (myRes.success) {
        const data = myRes.data as any;
        const items = Array.isArray(data) ? data : data?.items || [];
        _myCommunitiesCache = items;
        setMyCommunities(items);
      }
      _communitiesHasLoaded = true;
      if (!allRes.success) setError(allRes.message || "Failed to fetch communities");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  const createCommunity = async (data: { name: string; description?: string; is_public?: boolean }) => {
    const response = await socialApi.createCommunity(data);
    if (response.success) { await fetchCommunities(); return response.data; }
    throwApiError(response);
  };

  const joinCommunity = async (communityId: string) => {
    const response = await socialApi.joinCommunity(communityId);
    if (response.success) { await fetchCommunities(); return response.data; }
    throwApiError(response);
  };

  const leaveCommunity = async (communityId: string) => {
    const response = await socialApi.leaveCommunity(communityId);
    if (response.success) { await fetchCommunities(); return response.data; }
    throwApiError(response);
  };

  return { communities, myCommunities, loading, error, refetch: fetchCommunities, createCommunity, joinCommunity, leaveCommunity };
};

// ============================================================================
// NOTIFICATIONS (with cross-instance sync)
// ============================================================================

// Module-level cache for notifications
let _notificationsCache: any[] = [];
let _notificationsUnreadCache = 0;
let _notificationsHasLoaded = false;
const _notifListeners = new Set<(count: number) => void>();

const _broadcastNotifCount = (count: number) => {
  _notificationsUnreadCache = count;
  _notifListeners.forEach(fn => fn(count));
};

export const useNotifications = (filter?: "all" | "unread") => {
  const [notifications, setNotifications] = useState<any[]>(_notificationsCache);
  const [unreadCount, setUnreadCount] = useState(_notificationsUnreadCache);
  const [loading, setLoading] = useState(!_notificationsHasLoaded);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  // Subscribe to cross-instance count updates
  useEffect(() => {
    const handler = (count: number) => setUnreadCount(count);
    _notifListeners.add(handler);
    // Sync on mount in case cache changed while unmounted
    setUnreadCount(_notificationsUnreadCache);
    return () => { _notifListeners.delete(handler); };
  }, []);

  const fetchNotifications = useCallback(async (params?: { page?: number; limit?: number }) => {
    if (!_notificationsHasLoaded) setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getNotifications({ ...params, filter });
      if (response.success) {
        const data = response.data as any;
        const items = data?.notifications || data?.items || (Array.isArray(data) ? data : []);
        const uc = data?.unread_count || 0;
        _notificationsCache = items;
        _notificationsHasLoaded = true;
        setNotifications(items);
        setPagination(data?.pagination);
        _broadcastNotifCount(uc);
      } else {
        setError(response.message || "Failed to fetch notifications");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllRead = async () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    _notificationsCache = _notificationsCache.map(n => ({ ...n, is_read: true }));
    _broadcastNotifCount(0);
    try {
      await socialApi.markAllNotificationsRead();
    } catch {
      // silent
    }
  };

  const markRead = async (notificationId: string) => {
    // Check if already read
    const notif = notifications.find(n => n.id === notificationId);
    if (notif?.is_read) return;
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    _notificationsCache = _notificationsCache.map(n => n.id === notificationId ? { ...n, is_read: true } : n);
    _broadcastNotifCount(Math.max(0, _notificationsUnreadCache - 1));
    try {
      await socialApi.markNotificationRead(notificationId);
    } catch {
      // silent
    }
  };

  return { notifications, unreadCount, loading, error, pagination, refetch: fetchNotifications, markAllRead, markRead };
};

export const useMarkAllNotificationsRead = () => {
  const [loading, setLoading] = useState(false);
  const markAllAsRead = async () => {
    setLoading(true);
    try {
      await socialApi.markAllNotificationsRead();
    } finally {
      setLoading(false);
    }
  };
  return { markAllAsRead, loading };
};

// ============================================================================
// CONVERSATIONS (Messages)
// ============================================================================

// Module-level cache for conversations (with cross-instance sync)
let _conversationsCache: any[] = [];
let _conversationsUnreadCache = 0;
let _conversationsHasLoaded = false;
const _convListeners = new Set<(count: number) => void>();

const _broadcastConvCount = (count: number) => {
  _conversationsUnreadCache = count;
  _convListeners.forEach(fn => fn(count));
};

export const useConversations = () => {
  const [conversations, setConversations] = useState<any[]>(_conversationsCache);
  const [unreadCount, setUnreadCount] = useState(_conversationsUnreadCache);
  const [loading, setLoading] = useState(!_conversationsHasLoaded);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to cross-instance count updates
  useEffect(() => {
    const handler = (count: number) => setUnreadCount(count);
    _convListeners.add(handler);
    setUnreadCount(_conversationsUnreadCache);
    return () => { _convListeners.delete(handler); };
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!_conversationsHasLoaded) setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getConversations();
      if (response.success) {
        const data = response.data as any;
        const list = Array.isArray(data) ? data : data?.items || data?.conversations || [];
        _conversationsCache = list;
        _conversationsHasLoaded = true;
        setConversations(list);
        const newCount = list.filter((c: any) => c.unread_count > 0).length;
        _broadcastConvCount(newCount);
      } else {
        setError(response.message || "Failed to fetch conversations");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Optimistic clear — updates cache + broadcasts to Header
  const clearUnread = useCallback((conversationId: string) => {
    setConversations(prev => {
      const updated = prev.map(c => c.id === conversationId ? { ...c, unread_count: 0 } : c);
      _conversationsCache = updated;
      const newCount = updated.filter((c: any) => c.unread_count > 0).length;
      _broadcastConvCount(newCount);
      return updated;
    });
  }, []);

  return { conversations, unreadCount, loading, error, refetch: fetchConversations, clearUnread };
};

export const useConversationMessages = (conversationId: string | null) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getMessages(conversationId);
      if (response.success) {
        const data = response.data as any;
        setMessages(Array.isArray(data) ? data : data?.items || data?.messages || []);
      } else {
        setError(response.message || "Failed to fetch messages");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (conversationId) fetchMessages();
  }, [fetchMessages, conversationId]);

  // FIX: Wrapped in useCallback for stability
  const appendMessage = useCallback((msg: any) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  return { messages, loading, error, refetch: fetchMessages, setMessages, appendMessage };
};

export const useSendMessage = () => {
  const [sending, setSending] = useState(false);
  const loading = sending; // alias for backwards compat

  const sendMessage = async (conversationId: string, content: string, attachments?: string[]) => {
    setSending(true);
    try {
      const response = await socialApi.sendMessage(conversationId, { content, attachments });
      if (response.success) return response.data;
      throwApiError(response);
    } finally {
      setSending(false);
    }
  };

  const createConversation = async (data: { recipient_id: string; message?: string }) => {
    setSending(true);
    try {
      const response = await socialApi.createConversation(data);
      if (response.success) return response.data;
      throwApiError(response);
    } finally {
      setSending(false);
    }
  };

  return { sendMessage, createConversation, sending, loading };
};