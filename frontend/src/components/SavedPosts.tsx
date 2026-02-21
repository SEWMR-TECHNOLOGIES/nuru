import { useState, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { socialApi } from '@/lib/api/social';
import Moment from './Moment';
import { getTimeAgo } from '@/utils/getTimeAgo';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

const SavedPostsSkeleton = () => (
  <div className="space-y-4 md:space-y-6">
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="p-3 md:p-4 flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="w-5 h-5 rounded" />
        </div>
        <Skeleton className="h-48 mx-3 md:mx-4 rounded-lg" />
        <div className="px-3 md:px-4 py-3 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="px-3 md:px-4 py-3 border-t border-border flex justify-between">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    ))}
  </div>
);

const SavedPosts = () => {
  useWorkspaceMeta({ title: 'Saved Posts', description: 'View your saved posts on Nuru.' });

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    socialApi.getSavedPosts()
      .then((res) => {
        if (res.success) {
          const data = res.data as any;
          setPosts(data?.saved_posts || data?.posts || data?.items || (Array.isArray(data) ? data : []));
        }
      })
      .catch(() => toast.error('Failed to load saved posts'))
      .finally(() => setLoading(false));
  }, []);

  const transformPost = (apiPost: any) => {
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
        images: (apiPost.images || apiPost.media || []).map((img: any) =>
          typeof img === 'string' ? img : (img?.image_url || img?.url)
        ).filter(Boolean),
        image: (() => {
          const imgs = apiPost.images || apiPost.media || [];
          if (imgs.length === 0) return undefined;
          const first = imgs[0];
          return typeof first === 'string' ? first : (first?.image_url || first?.url);
        })(),
        media_types: (apiPost.images || apiPost.media || []).map((img: any) =>
          typeof img === 'string' ? undefined : (img?.media_type || img?.type)
        ),
      },
      likes: apiPost.glow_count || 0,
      comments: apiPost.comment_count || apiPost.echo_count || 0,
      has_glowed: apiPost.has_glowed || false,
      has_saved: apiPost.has_saved ?? apiPost.is_saved ?? true,
      // Event share data
      shared_event: apiPost.shared_event || null,
      share_expires_at: apiPost.share_expires_at || null,
    };
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6 pb-4">
        <h1 className="text-2xl md:text-3xl font-bold">Saved Posts</h1>
        <SavedPostsSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-4">
      <h1 className="text-2xl md:text-3xl font-bold">Saved Posts</h1>

      {posts.length === 0 ? (
        <div className="text-center py-16">
          <Bookmark className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No saved posts yet</p>
          <p className="text-sm text-muted-foreground mt-1">Posts you save will appear here</p>
        </div>
      ) : (
        posts.map((post) => (
          <Moment key={post.id} post={transformPost(post)} />
        ))
      )}
    </div>
  );
};

export default SavedPosts;
