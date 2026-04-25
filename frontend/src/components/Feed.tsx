import { useEffect, useRef, useState, useCallback } from 'react';
import CreatePostBox from './CreatePostBox';
import Moment from './Moment';
import { AdCardSkeleton, PromotedEventSkeleton } from './FeedAdSkeleton';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useFeed } from '@/data/useSocial';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getTimeAgo } from '@/utils/getTimeAgo';
import { Loader2, TrendingUp } from 'lucide-react';
import { feedSessionId } from '@/hooks/useFeedTracking';
import { socialApi } from '@/lib/api/social';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import {
  getFeedMaxScroll,
  getFeedScrollContainer,
  readSavedFeedScrollPosition,
  saveFeedScrollPosition,
  setFeedScrollTop,
} from '@/lib/feedSession';

const Feed = () => {
  const { t } = useLanguage();
  const { items: apiPosts, loading, refreshing, error, refetch, loadMore, pagination } = useFeed({
    limit: 15,
    mode: 'ranked',
    session_id: feedSessionId,
  });
  const hasLoadedOnce = useRef(false);
  const scrollRestoredRef = useRef(false);
  const restoreAttemptsRef = useRef(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [trendingPosts, setTrendingPosts] = useState<any[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const triedTrending = useRef(false);

  const currentPage = pagination?.page || 1;
  const totalPages = pagination?.total_pages ?? pagination?.pages ?? 1;
  const hasMore = pagination?.has_next ?? (currentPage < totalPages);

  useEffect(() => {
    if (!loading && apiPosts.length >= 0) {
      hasLoadedOnce.current = true;
    }
  }, [loading, apiPosts]);

  // Note: revalidation on mount is handled inside useFeed() (stale-while-revalidate).

  // Save scroll position before navigating away. We DO NOT call the handler
  // immediately on mount — doing so would overwrite the saved position with
  // the freshly-mounted scrollTop of 0, defeating restoration.
  useEffect(() => {
    let container: HTMLElement | null = null;
    let windowListener = false;
    let raf = 0;
    const handleScroll = () => {
      saveFeedScrollPosition(rootRef.current);
    };

    // Defer container lookup until layout settles, so getComputedStyle sees
    // the right responsive overflow values.
    const attach = () => {
      const scrollTarget = getFeedScrollContainer(rootRef.current);
      if (scrollTarget === window) {
        windowListener = true;
        window.addEventListener('scroll', handleScroll, { passive: true });
      } else {
        container = scrollTarget as HTMLElement;
        container.addEventListener('scroll', handleScroll, { passive: true });
      }
    };
    raf = requestAnimationFrame(attach);

    return () => {
      cancelAnimationFrame(raf);
      // Persist final position so it survives unmount on navigation.
      saveFeedScrollPosition(rootRef.current);
      if (container) container.removeEventListener('scroll', handleScroll);
      if (windowListener) window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Restore scroll position after content is in the DOM (only once per mount).
  // We retry across frames because the scrollHeight grows as posts paint and
  // images report their dimensions.
  useEffect(() => {
    if (scrollRestoredRef.current) return;
    if (apiPosts.length === 0 && trendingPosts.length === 0) return;
    const targetPosition = readSavedFeedScrollPosition();
    if (!targetPosition) {
      scrollRestoredRef.current = true;
      return;
    }

    const restoreScroll = () => {
      const container = getFeedScrollContainer(rootRef.current);

      // Wait for the document to be tall enough to seek to the saved offset.
      const maxScroll = getFeedMaxScroll(container);
      if (maxScroll < targetPosition && restoreAttemptsRef.current < 30) {
        restoreAttemptsRef.current += 1;
        requestAnimationFrame(restoreScroll);
        return;
      }

      setFeedScrollTop(container, targetPosition);
      const currentTop = container === window ? window.scrollY : (container as HTMLElement).scrollTop;
      if (Math.abs(currentTop - targetPosition) <= 4 || restoreAttemptsRef.current >= 30) {
        scrollRestoredRef.current = true;
        return;
      }

      restoreAttemptsRef.current += 1;
      requestAnimationFrame(restoreScroll);
    };

    requestAnimationFrame(restoreScroll);
  }, [apiPosts.length, trendingPosts.length]);

  // Infinite scroll via IntersectionObserver
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await loadMore(currentPage + 1);
    } finally {
      setLoadingMore(false);
    }
  }, [loadMore, currentPage, hasMore, loadingMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          handleLoadMore();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMore, hasMore, loadingMore, loading]);

  // Fallback to trending when feed is empty for new users
  // Use the authenticated explore endpoint so has_glowed/has_saved are correctly set
  useEffect(() => {
    if (!loading && apiPosts.length === 0 && !triedTrending.current) {
      triedTrending.current = true;
      setTrendingLoading(true);
      // Use explore endpoint (authenticated) instead of public trending
      // so that has_glowed/has_saved state is included
      import('@/lib/api/helpers').then(({ get }) => {
        get<any>('/posts/explore?limit=15')
          .then((res) => {
            if (res.success) {
              const data = res.data as any;
              setTrendingPosts(Array.isArray(data) ? data : data?.posts || data?.items || []);
            }
          })
          .catch(() => {
            // Fallback to public trending if explore fails
            socialApi.getTrending({ limit: 15, period: 'week' })
              .then((res) => {
                if (res.success) {
                  const data = res.data as any;
                  setTrendingPosts(Array.isArray(data) ? data : data?.posts || data?.items || []);
                }
              })
              .catch(() => {});
          })
          .finally(() => setTrendingLoading(false));
      });
    }
  }, [loading, apiPosts.length]);

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
        avatar: authorAvatar,
        timeAgo: apiPost.created_at ? getTimeAgo(apiPost.created_at) : 'Recently',
        is_verified: apiPost.user?.is_identity_verified || apiPost.author?.is_verified || false,
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
        media_types: (apiPost.images || apiPost.media || []).map((img: any) =>
          typeof img === 'string' ? undefined : (img?.media_type || img?.type)
        ),
      },
      likes: apiPost.glow_count || 0,
      comments: apiPost.comment_count || apiPost.echo_count || 0,
      has_glowed: apiPost.has_glowed || false,
      has_saved: apiPost.has_saved || false,
      // Event share data
      shared_event: apiPost.shared_event || null,
      share_expires_at: apiPost.share_expires_at || null,
    };
  };

  const posts = (apiPosts || []).map(transformApiPost);
  const trendingTransformed = trendingPosts.map(transformApiPost);
  const displayPosts = posts.length > 0 ? posts : trendingTransformed;
  const isTrendingFallback = posts.length === 0 && trendingTransformed.length > 0;

  useWorkspaceMeta({
    title: "Workspace",
    description: "See the latest events, weddings, birthdays, and community posts on Nuru."
  });

  // Empty state must only appear once BOTH the primary feed and the trending
  // fallback have settled. Otherwise mobile briefly flashes "no posts yet"
  // before content arrives. `triedTrending.current` is set as soon as the
  // fallback fetch is kicked off, so we wait for it to also complete.
  // Only flash skeletons on the very first load (no posts available from any
  // source). On subsequent re-mounts (back-navigation) the module-level cache
  // hydrates `apiPosts` instantly, so we should NEVER show skeletons —
  // background revalidation updates posts in place.
  const showSkeleton =
    loading && !hasLoadedOnce.current && apiPosts.length === 0 && posts.length === 0;
  const fallbackPending =
    posts.length === 0 && (!triedTrending.current || trendingLoading);
  const canShowEmpty = !loading && !trendingLoading && triedTrending.current;

  if (showSkeleton) {
    return (
      <div ref={rootRef} className="space-y-4 md:space-y-6 pb-4">
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
      <div ref={rootRef} className="space-y-4 md:space-y-6 pb-4">
        <CreatePostBox />
        <div className="text-center py-12">
          <p className="text-destructive mb-4">Failed to load feed. Please try again.</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="space-y-4 md:space-y-6 pb-4">
      <CreatePostBox />

      {refreshing && displayPosts.length > 0 && (
        <div className="flex items-center justify-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Updating moments</span>
        </div>
      )}

      {displayPosts.length === 0 && canShowEmpty && !fallbackPending && (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">No posts yet. Be the first to share something with the community!</p>
        </div>
      )}

      {trendingLoading && posts.length === 0 && (
        <div className="space-y-4">
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
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      )}

      {isTrendingFallback && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-muted-foreground text-sm mb-2">
          <TrendingUp className="w-4 h-4 flex-shrink-0" />
          <span>Trending in the community</span>
        </div>
      )}

      {displayPosts.map((post, index) => (
        <div key={post.id}>
          <Moment post={post} />

          {/* Ad / promoted slot after every 3rd post */}
          {(index + 1) % 3 === 0 && index < displayPosts.length - 1 && (
            index % 6 === 2 ? (
              <div className="mt-4 md:mt-6">
                <AdCardSkeleton />
              </div>
            ) : (
              <div className="mt-4 md:mt-6">
                <PromotedEventSkeleton />
              </div>
            )
          )}
        </div>
      ))}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {loadingMore && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <p className="text-center text-muted-foreground text-xs py-4">No more moments</p>
      )}
    </div>
  );
};

export default Feed;
