/**
 * Social Data Hooks - Feed, Posts, Moments, Followers, Circles
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { socialApi, FeedQueryParams, MomentQueryParams } from "@/lib/api/social";
import type { FeedPost, Moment, Circle, UserProfile } from "@/lib/api/types";
import { throwApiError } from "@/lib/api/showApiErrors";

// ============================================================================
// FEED
// ============================================================================

export const useFeed = (initialParams?: FeedQueryParams) => {
  const [items, setItems] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchFeed = useCallback(async (params?: FeedQueryParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getFeed(params || initialParams);
      if (response.success) {
        setItems(response.data.items);
        setPagination(response.data.pagination);
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
        setItems(prev => [...prev, ...response.data.items]);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error("Failed to load more:", err);
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

  const likePost = async () => {
    if (!postId) return;
    try {
      const response = await socialApi.likePost(postId);
      if (response.success) {
        setPost(prev => prev ? { ...prev, is_liked: true, likes_count: response.data.likes_count } : null);
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const unlikePost = async () => {
    if (!postId) return;
    try {
      const response = await socialApi.unlikePost(postId);
      if (response.success) {
        setPost(prev => prev ? { ...prev, is_liked: false, likes_count: response.data.likes_count } : null);
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { post, loading, error, refetch: fetchPost, likePost, unlikePost };
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
        setComments(response.data.comments);
        setPagination(response.data.pagination);
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

// ============================================================================
// MOMENTS (Stories)
// ============================================================================

export const useMoments = (params?: MomentQueryParams) => {
  const [users, setUsers] = useState<any[]>([]);
  const [myMoments, setMyMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMoments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getMoments(params);
      if (response.success) {
        setUsers(response.data.users);
        setMyMoments(response.data.my_moments);
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
    } catch (err) {
      console.error("Failed to mark moment as viewed:", err);
      return null;
    }
  };

  return { users, myMoments, loading, error, refetch: fetchMoments, createMoment, deleteMoment, viewMoment };
};

// ============================================================================
// FOLLOWERS
// ============================================================================

export const useFollowers = (userId: string | null) => {
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchFollowers = useCallback(async (params?: { page?: number; limit?: number; search?: string }) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getFollowers(userId, params);
      if (response.success) {
        setFollowers(response.data.followers);
        setPagination(response.data.pagination);
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

export const useFollowing = (userId: string | null) => {
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchFollowing = useCallback(async (params?: { page?: number; limit?: number; search?: string }) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getFollowing(userId, params);
      if (response.success) {
        setFollowing(response.data.following);
        setPagination(response.data.pagination);
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

export const useFollowSuggestions = (limit?: number) => {
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getFollowSuggestions({ limit });
      if (response.success) {
        setSuggestions(response.data);
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

export const useCircles = () => {
  const [circles, setCircles] = useState<CircleWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCircles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getCircles();
      if (response.success) {
        // Fetch members for each circle
        const circlesWithMembers = await Promise.all(
          response.data.map(async (circle: any) => {
            try {
              const membersResponse = await socialApi.getCircleMembers(circle.id);
              return {
                ...circle,
                members: membersResponse.success ? membersResponse.data.members : []
              };
            } catch {
              return { ...circle, members: [] };
            }
          })
        );
        setCircles(circlesWithMembers);
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

interface Community {
  id: string;
  name: string;
  description?: string;
  image?: string;
  member_count?: number;
  is_creator?: boolean;
  is_member?: boolean;
}

export const useCommunities = () => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allResponse, myResponse] = await Promise.all([
        socialApi.getCommunities(),
        socialApi.getMyCommunities(),
      ]);
      if (allResponse.success) {
        const items = Array.isArray(allResponse.data) ? allResponse.data : [];
        setCommunities(items);
      }
      if (myResponse.success) {
        const myItems = Array.isArray(myResponse.data) ? myResponse.data : [];
        setMyCommunities(myItems);
      }
      if (!allResponse.success) {
        setError(allResponse.message || "Failed to fetch communities");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  const createCommunity = async (data: { name: string; description?: string }) => {
    try {
      const response = await socialApi.createCommunity(data);
      if (response.success) {
        await fetchCommunities();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const joinCommunity = async (communityId: string) => {
    try {
      const response = await socialApi.joinCommunity(communityId);
      if (response.success) {
        await fetchCommunities();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const leaveCommunity = async (communityId: string) => {
    try {
      const response = await socialApi.leaveCommunity(communityId);
      if (response.success) {
        await fetchCommunities();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { 
    communities, 
    myCommunities, 
    loading, 
    error, 
    refetch: fetchCommunities, 
    createCommunity, 
    joinCommunity, 
    leaveCommunity 
  };
};

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getNotifications();
      if (response.success) {
        // Backend returns data as a flat array via standard_response
        const items = Array.isArray(response.data) ? response.data : (response.data?.notifications || []);
        setNotifications(items);
        // Compute unread count from items if not provided separately
        const unread = response.data?.unread_count ?? items.filter((n: any) => !n.is_read).length;
        setUnreadCount(unread);
      } else {
        setError(response.message || "Failed to fetch notifications");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return { notifications, loading, error, unreadCount, refetch: fetchNotifications };
};

export const useMarkAllNotificationsRead = () => {
  const [loading, setLoading] = useState(false);

  const markAllAsRead = async () => {
    setLoading(true);
    try {
      const response = await socialApi.markAllNotificationsRead();
      if (!response.success) {
        throwApiError(response);
      }
      return true;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { markAllAsRead, loading };
};

// ============================================================================
// CONVERSATIONS (Messages)
// ============================================================================

export const useConversations = () => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const isFirstLoad = useRef(true);

  const fetchConversations = useCallback(async () => {
    if (isFirstLoad.current) setLoading(true);
    setError(null);
    try {
      const response = await socialApi.getConversations();
      if (response.success) {
        const convs = Array.isArray(response.data) ? response.data : (response.data as any)?.conversations || [];
        setConversations(convs);
        const totalUnread = convs.reduce(
          (acc: number, conv: any) => acc + (conv.unread_count || 0), 
          0
        );
        setUnreadCount(totalUnread);
      } else {
        setError(response.message || "Failed to fetch conversations");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      isFirstLoad.current = false;
    }
  }, []);

  /** Optimistically clear unread count for a conversation */
  const clearUnread = useCallback((conversationId: string) => {
    setConversations(prev => {
      const conv = prev.find(c => c.id === conversationId);
      if (conv && conv.unread_count > 0) {
        setUnreadCount(u => Math.max(0, u - (conv.unread_count || 0)));
        return prev.map(c => c.id === conversationId ? { ...c, unread_count: 0 } : c);
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return { conversations, loading, error, unreadCount, refetch: fetchConversations, clearUnread };
};

export const useConversationMessages = (conversationId: string) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoad = useRef(true);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    // Only show loading on initial fetch, not on silent refreshes
    if (isInitialLoad.current) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await socialApi.getMessages(conversationId);
      if (response.success) {
        const msgs = Array.isArray(response.data) ? response.data : (response.data as any)?.messages || [];
        setMessages(msgs);
      } else {
        setError(response.message || "Failed to fetch messages");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  }, [conversationId]);

  // Reset initial load flag when conversation changes
  useEffect(() => {
    isInitialLoad.current = true;
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  /** Optimistically append a message without refetching */
  const appendMessage = useCallback((msg: any) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  return { messages, loading, error, refetch: fetchMessages, appendMessage };
};

export const useSendMessage = () => {
  const [loading, setLoading] = useState(false);

  const sendMessage = async (conversationId: string, content: string, attachments?: string[]) => {
    setLoading(true);
    try {
      const response = await socialApi.sendMessage(conversationId, { content, attachments });
      if (!response.success) {
        throwApiError(response);
      }
      return response.data;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { sendMessage, loading };
};
