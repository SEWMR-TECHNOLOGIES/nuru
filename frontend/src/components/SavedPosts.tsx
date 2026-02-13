import { useState, useEffect } from 'react';
import { Bookmark, Loader2 } from 'lucide-react';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { socialApi } from '@/lib/api/social';
import Moment from './Moment';
import { getTimeAgo } from '@/utils/getTimeAgo';
import { toast } from 'sonner';

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
          setPosts(data?.posts || data?.items || (Array.isArray(data) ? data : []));
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
      },
      likes: apiPost.glow_count || 0,
      comments: apiPost.comment_count || 0,
      has_glowed: apiPost.has_glowed || false,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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
