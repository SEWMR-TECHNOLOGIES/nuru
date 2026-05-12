import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Play, BadgeCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MomentAuthor {
  id?: string;
  name: string;
  avatar: string | null;
  is_verified?: boolean;
}

interface TrendingMoment {
  id: string;
  author: MomentAuthor | null;
  caption: string | null;
  content_type: 'image' | 'video' | 'text' | string;
  media_url: string | null;
  thumbnail_url?: string | null;
  background_color?: string | null;
  viewer_count?: number;
  created_at: string;
}

const isVideo = (m: TrendingMoment) =>
  m.content_type === 'video' ||
  (m.media_url ? /\.(mp4|webm|mov|avi)(\?|$)/i.test(m.media_url) : false);

const getInitials = (name: string) => {
  const parts = name?.trim().split(/\s+/) || [];
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (name || '?').charAt(0).toUpperCase();
};

/** Lazily generates a poster (first frame) for a remote video URL via canvas. */
const VideoPoster = ({ src, poster, minHeight }: { src: string; poster?: string | null; minHeight: string }) => {
  const [generated, setGenerated] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (poster) return;
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.playsInline = true;
    v.preload = 'metadata';
    v.src = src;
    const onLoaded = () => {
      try { v.currentTime = Math.min(0.1, (v.duration || 1) / 2); } catch {/*noop*/}
    };
    const onSeeked = () => {
      try {
        const c = document.createElement('canvas');
        c.width = v.videoWidth || 480;
        c.height = v.videoHeight || 270;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        setGenerated(c.toDataURL('image/jpeg', 0.7));
      } catch {
        setErrored(true);
      }
    };
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('seeked', onSeeked);
    v.addEventListener('error', () => setErrored(true));
    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('seeked', onSeeked);
      v.src = '';
    };
  }, [src, poster]);

  const displayPoster = poster || generated;

  if (errored && !displayPoster) {
    return (
      <div className="w-full bg-muted flex items-center justify-center" style={{ minHeight }}>
        <Play className="w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ minHeight }}>
      {displayPoster ? (
        <img
          src={displayPoster}
          alt="Reel preview"
          className="w-full object-cover"
          loading="lazy"
          style={{ minHeight, maxHeight: '420px' }}
        />
      ) : (
        <video
          ref={ref}
          src={src}
          className="w-full object-cover"
          muted
          playsInline
          preload="metadata"
          style={{ minHeight, maxHeight: '420px' }}
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="bg-black/50 backdrop-blur-sm rounded-full p-3">
          <Play className="w-5 h-5 text-white fill-white" />
        </div>
      </div>
    </div>
  );
};

const TrendingMoments = () => {
  const [moments, setMoments] = useState<TrendingMoment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        const items = res?.data || [];
        if (Array.isArray(items) && items.length > 0) {
          setMoments(items);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && moments.length === 0) return null;
  if (loading) return null;

  return (
    <section className="py-24 lg:py-32 px-6 lg:px-16 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-6">
            <span className="text-sm font-medium text-accent-foreground">Trending Reels</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
            Shared by our community
          </h2>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Real reels from real people, shared with the world.
          </p>
        </motion.div>

        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-3 sm:gap-4 space-y-3 sm:space-y-4">
          {moments.map((m, index) => {
            const tileHeight = index % 3 === 0 ? '320px' : index % 3 === 1 ? '240px' : '280px';
            const author = m.author || { name: 'Anonymous', avatar: null };
            const isText = m.content_type === 'text' || (!m.media_url && !!m.caption);
            const bg = m.background_color || '#0F172A';

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.06 }}
                viewport={{ once: true, margin: '-50px' }}
                className="break-inside-avoid"
              >
                <Link
                  to={`/feed`}
                  className="group block relative rounded-2xl overflow-hidden bg-card border border-border hover:border-foreground/15 transition-all duration-500 hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="relative overflow-hidden" style={{ minHeight: tileHeight }}>
                    {isText ? (
                      <div
                        className="w-full h-full flex items-center justify-center px-5 py-8 text-center"
                        style={{
                          minHeight: tileHeight,
                          background: `linear-gradient(135deg, ${bg}, ${bg}dd)`,
                        }}
                      >
                        <p className="text-white font-bold leading-snug text-lg sm:text-xl line-clamp-6 drop-shadow-sm">
                          {m.caption || 'Untitled'}
                        </p>
                      </div>
                    ) : isVideo(m) && m.media_url ? (
                      <VideoPoster src={m.media_url} poster={m.thumbnail_url} minHeight={tileHeight} />
                    ) : m.media_url ? (
                      <img
                        src={m.media_url}
                        alt={m.caption || 'Reel'}
                        className="w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                        style={{ minHeight: tileHeight, maxHeight: '420px' }}
                      />
                    ) : null}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    {(m.viewer_count ?? 0) > 0 && (
                      <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
                        <span className="flex items-center gap-1 text-white/90 text-xs font-medium">
                          <MessageCircle className="w-3.5 h-3.5" />
                          {m.viewer_count} views
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-3.5">
                    {!isText && m.caption && (
                      <p className="text-sm text-foreground line-clamp-2 mb-3 leading-relaxed">
                        {m.caption}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      {author.avatar ? (
                        <img
                          src={author.avatar}
                          alt={author.name}
                          className="w-6 h-6 rounded-full object-cover ring-1 ring-border"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary ring-1 ring-border">
                          {getInitials(author.name)}
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground font-medium truncate">
                        {author.name}
                      </span>
                      {author.is_verified && (
                        <BadgeCheck
                          className="w-3.5 h-3.5 flex-shrink-0"
                          style={{ color: '#F5B400' }}
                          aria-label="Verified"
                        />
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TrendingMoments;
