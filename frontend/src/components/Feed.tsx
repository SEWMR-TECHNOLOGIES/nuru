import { useEffect } from 'react';
import CreatePostBox from './CreatePostBox';
import Moment from './Moment';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useFeed } from '@/data/useSocial';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const Feed = () => {
  const { items: apiPosts, loading, error, refetch } = useFeed();

  useEffect(() => {
    const savedPosition = sessionStorage.getItem('feedScrollPosition');
    if (savedPosition) {
      setTimeout(() => {
        const scrollContainer = document.querySelector('.flex-1.overflow-y-auto');
        if (scrollContainer) {
          scrollContainer.scrollTop = parseInt(savedPosition, 10);
        }
        sessionStorage.removeItem('feedScrollPosition');
      }, 0);
    }
  }, []);

  // Transform API posts to match the component format
  const transformApiPost = (apiPost: any) => ({
    id: apiPost.id,
    type: apiPost.post_type || 'event',
    author: {
      name: apiPost.user?.first_name && apiPost.user?.last_name 
        ? `${apiPost.user.first_name} ${apiPost.user.last_name}` 
        : apiPost.user?.username || 'Anonymous',
      avatar: apiPost.user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face',
      timeAgo: apiPost.created_at ? getTimeAgo(apiPost.created_at) : 'Recently'
    },
    content: {
      title: apiPost.title,
      text: apiPost.content,
      image: apiPost.images?.[0]
    },
    event: apiPost.event ? {
      title: apiPost.event.title,
      text: apiPost.content,
      image: apiPost.images?.[0] || apiPost.event.cover_image,
      hostedBy: apiPost.user?.first_name || 'Host',
      date: apiPost.event.start_date
    } : undefined,
    likes: apiPost.like_count || 0,
    comments: apiPost.comment_count || 0
  });

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  const posts = apiPosts.map(transformApiPost);

  useWorkspaceMeta({
    title: "Workspace",
    description: "See the latest events, weddings, birthdays, and community posts on Nuru."
  });

  if (loading) {
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

  if (error) {
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
      
      {posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-2">No posts yet</p>
          <p className="text-sm text-muted-foreground">Be the first to share something with the community!</p>
        </div>
      ) : (
        posts.map((post) => (
          <div key={post.id}>
            <Moment post={post} />
          </div>
        ))
      )}
    </div>
  );
};

export default Feed;
