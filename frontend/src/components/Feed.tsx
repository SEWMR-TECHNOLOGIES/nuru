import { useEffect, useRef } from 'react';
import CreatePostBox from './CreatePostBox';
import Moment from './Moment';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useFeed } from '@/data/useSocial';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getTimeAgo } from '@/utils/getTimeAgo';

const SCROLL_KEY = 'feedScrollPosition';

const getScrollContainer = () =>
  document.querySelector('.flex-1.overflow-y-auto') as HTMLElement | null;

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.charAt(0).toUpperCase();
};

const Feed = () => {
  const { items: apiPosts, loading, error, refetch } = useFeed();
  const hasLoadedOnce = useRef(false);
  const scrollRestoredRef = useRef(false);

  useEffect(() => {
    if (!loading && apiPosts.length >= 0) {
      hasLoadedOnce.current = true;
    }
  }, [loading, apiPosts]);

  // Save scroll position before navigating away
  useEffect(() => {
    const container = getScrollContainer();
    if (!container) return;

    const handleScroll = () => {
      sessionStorage.setItem(SCROLL_KEY, String(container.scrollTop));
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Restore scroll position after data is ready (only once per mount)
  useEffect(() => {
    if (scrollRestoredRef.current || loading) return;
    const savedPosition = sessionStorage.getItem(SCROLL_KEY);
    if (savedPosition) {
      scrollRestoredRef.current = true;
      // Use rAF to ensure DOM has rendered with cached data
      requestAnimationFrame(() => {
        const container = getScrollContainer();
        if (container) {
          container.scrollTop = parseInt(savedPosition, 10);
        }
      });
    }
  }, [loading, apiPosts]);

  const transformApiPost = (apiPost: any) => {
    const authorName = apiPost.author?.name || apiPost.user?.first_name
      ? `${apiPost.user?.first_name || ''} ${apiPost.user?.last_name || ''}`.trim() || apiPost.author?.name || 'Anonymous'
      : 'Anonymous';
    const authorAvatar = apiPost.author?.avatar || apiPost.user?.avatar || '';

    return {
      id: apiPost.id,
      type: apiPost.post_type || 'moment',
      author: {
        name: authorName,
        avatar: authorAvatar, // Pass raw avatar - Moment component handles fallback
        timeAgo: apiPost.created_at ? getTimeAgo(apiPost.created_at) : 'Recently'
      },
      content: {
        title: apiPost.title || '',
        text: apiPost.content,
        image: (() => {
          const imgs = apiPost.images || apiPost.media || [];
          if (imgs.length === 0) return undefined;
          const first = imgs[0];
          return typeof first === 'string' ? first : (first?.image_url || first?.url);
        })(),
        images: (apiPost.images || apiPost.media || []).map((img: any) =>
          typeof img === 'string' ? img : (img?.image_url || img?.url)
        ).filter(Boolean),
      },
      likes: apiPost.glow_count || 0,
      comments: apiPost.comment_count || 0,
      has_glowed: apiPost.has_glowed || false,
    };
  };

  const posts = (apiPosts || []).map(transformApiPost);

  useWorkspaceMeta({
    title: "Workspace",
    description: "See the latest events, weddings, birthdays, and community posts on Nuru."
  });

  const showSkeleton = loading && !hasLoadedOnce.current && posts.length === 0;

  if (showSkeleton) {
    return (
      <div className="space-y-4 md:space-y-6 pb-4">
        <CreatePostBox />
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card rounded-lg shadow-sm border border-border p-4">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-48 w-full rounded-lg mb-4" />
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="space-y-4 md:space-y-6 pb-4">
        <CreatePostBox />
        <div className="text-center py-12">
          <p className="text-destructive mb-4">Failed to load feed. Please try again.</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-4">
      <CreatePostBox />

      {posts.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">No posts yet. Be the first to share something with the community!</p>
        </div>
      )}

      {posts.map((post) => (
        <div key={post.id}>
          <Moment post={post} />
        </div>
      ))}
    </div>
  );
};

export default Feed;
