import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { VerifiedUserBadge } from '@/components/ui/verified-badge';

interface TrendingPostImage {
  url: string;
  media_type?: string;
}

interface TrendingPost {
  id: string;
  author: {
    name: string;
    avatar: string | null;
    is_verified?: boolean;
  };
  content: string;
  images: (string | TrendingPostImage)[];
  glow_count: number;
  comment_count: number;
  created_at: string;
}

const getImageUrl = (img: string | TrendingPostImage): string | null => {
  if (typeof img === 'string') return img;
  if (img && typeof img === 'object' && img.url) return img.url;
  return null;
};

const isVideoMedia = (img: string | TrendingPostImage): boolean => {
  if (typeof img === 'object' && img.media_type === 'video') return true;
  if (typeof img === 'string') {
    return /\.(mp4|webm|mov|avi)(\?|$)/i.test(img);
  }
  const url = typeof img === 'object' ? img.url : '';
  return /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);
};

const getInitials = (name: string) => {
  const parts = name?.trim().split(/\s+/) || [];
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (name || '?').charAt(0).toUpperCase();
};

const TrendingMoments = () => {
  const [posts, setPosts] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('TrendingMoments: Fetching data...');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'lmfprculxhspqxppscbn'}.supabase.co`;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZnByY3VseGhzcHF4cHBzY2JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NTUyMjAsImV4cCI6MjA3NTUzMTIyMH0.1ecxgLKtqHGLQpZpbNsWil6gxkuKH7RtecR6D0aCLJs';

    fetch(`${supabaseUrl}/functions/v1/public-trending`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ limit: 12 }),
    })
      .then(res => res.json())
      .then(res => {
        console.log('TrendingMoments: Response', res);
        const posts = res?.data || [];
        if (Array.isArray(posts) && posts.length > 0) {
          setPosts(posts);
        }
      })
      .catch(err => {
        console.error('TrendingMoments: Fetch error', err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Don't render if no public posts
  if (!loading && posts.length === 0) return null;
  if (loading) return null; // Don't show skeleton on landing, just hide until ready

  return (
    <section className="py-24 lg:py-32 px-6 lg:px-16 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-6">
            <span className="text-sm font-medium text-accent-foreground">Live on Nuru</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
            Shared by our community
          </h2>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Real stories from real people, shared with the world.
          </p>
        </motion.div>

        {/* Masonry-style Grid */}
        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-3 sm:gap-4 space-y-3 sm:space-y-4">
          {posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
              viewport={{ once: true, margin: "-50px" }}
              className="break-inside-avoid"
            >
              <Link
                to={`/shared/post/${post.id}`}
                className="group block relative rounded-2xl overflow-hidden bg-card border border-border hover:border-foreground/15 transition-all duration-500 hover:shadow-xl hover:-translate-y-1"
              >
                {/* Image */}
                {post.images[0] && getImageUrl(post.images[0]) && (
                  <div className="relative overflow-hidden">
                    {isVideoMedia(post.images[0]) ? (
                      <video
                        src={getImageUrl(post.images[0])!}
                        className="w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                        style={{
                          minHeight: index % 3 === 0 ? '280px' : index % 3 === 1 ? '200px' : '240px',
                          maxHeight: '400px',
                        }}
                      />
                    ) : (
                      <img
                        src={getImageUrl(post.images[0])!}
                        alt="Moment"
                        className="w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                        style={{
                          minHeight: index % 3 === 0 ? '280px' : index % 3 === 1 ? '200px' : '240px',
                          maxHeight: '400px',
                        }}
                      />
                    )}
                    {/* Gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    {/* Engagement stats on hover */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
                      <span className="flex items-center gap-1 text-white/90 text-xs font-medium">
                        <span className="text-xs">❤️</span>
                        {post.glow_count}
                      </span>
                      <span className="flex items-center gap-1 text-white/90 text-xs font-medium">
                        <MessageCircle className="w-3.5 h-3.5" />
                        {post.comment_count}
                      </span>
                    </div>
                  </div>
                )}

                {/* Author & Content */}
                <div className="p-3.5">
                  {post.content && (
                    <p className="text-sm text-foreground line-clamp-2 mb-3 leading-relaxed">
                      {post.content}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    {post.author.avatar ? (
                      <img
                        src={post.author.avatar}
                        alt={post.author.name}
                        className="w-6 h-6 rounded-full object-cover ring-1 ring-border"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary ring-1 ring-border">
                        {getInitials(post.author.name)}
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground font-medium truncate flex items-center gap-1">
                      {post.author.name}
                      {post.author.is_verified && <VerifiedUserBadge size="xs" />}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          viewport={{ once: true }}
          className="text-center mt-14"
        >
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors group"
          >
            Share your moments
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default TrendingMoments;
