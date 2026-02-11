import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getTimeAgo } from '@/utils/getTimeAgo';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import nuruLogo from '@/assets/nuru-logo.png';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const GuestPost = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userIsLoggedIn } = useCurrentUser();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // If user is logged in, redirect to the authenticated post detail
  useEffect(() => {
    if (userIsLoggedIn && id) {
      navigate(`/post/${id}`, { replace: true });
    }
  }, [userIsLoggedIn, id, navigate]);

  useEffect(() => {
    if (!id || userIsLoggedIn) return;
    setLoading(true);
    fetch(`${API_BASE}/posts/${id}/public`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setPost(data.data);
        } else {
          setError(data.message || 'Post not found or is private');
        }
      })
      .catch(() => setError('Failed to load post'))
      .finally(() => setLoading(false));
  }, [id, userIsLoggedIn]);

  if (userIsLoggedIn) return null;

  const handleAuthAction = () => {
    navigate(`/login?redirect=/post/${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-4 py-3 flex items-center justify-between">
          <Link to="/"><img src={nuruLogo} alt="Nuru" className="h-8" /></Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/login">Sign In</Link></Button>
            <Button size="sm" className="bg-[#D4A017] hover:bg-[#D4A017]/90 text-foreground" asChild><Link to="/register">Sign Up</Link></Button>
          </div>
        </header>
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-4 py-3 flex items-center justify-between">
          <Link to="/"><img src={nuruLogo} alt="Nuru" className="h-8" /></Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/login">Sign In</Link></Button>
            <Button size="sm" className="bg-[#D4A017] hover:bg-[#D4A017]/90 text-foreground" asChild><Link to="/register">Sign Up</Link></Button>
          </div>
        </header>
        <div className="max-w-2xl mx-auto p-4 text-center py-16">
          <p className="text-muted-foreground text-lg mb-4">{error || 'This post is not available'}</p>
          <p className="text-sm text-muted-foreground mb-6">Sign in to see more content on Nuru</p>
          <div className="flex gap-3 justify-center">
            <Button asChild><Link to="/login">Sign In</Link></Button>
            <Button variant="outline" asChild><Link to="/register">Create Account</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  const authorName = post.author?.name || 'Anonymous';
  const authorAvatar = post.author?.avatar || '';
  const postContent = post.content || '';
  const postImages = post.images || [];
  const postTimeAgo = post.created_at ? getTimeAgo(post.created_at) : 'Recently';
  const postLocation = post.location || '';

  return (
    <div className="min-h-screen bg-background">
      {/* Guest header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 bg-background z-50">
        <Link to="/"><img src={nuruLogo} alt="Nuru" className="h-8" /></Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild><Link to="/login">Sign In</Link></Button>
          <Button size="sm" className="bg-[#D4A017] hover:bg-[#D4A017]/90 text-foreground" asChild><Link to="/register">Sign Up</Link></Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4">
        {/* Post card */}
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          {/* Author */}
          <div className="p-4 flex items-center gap-3">
            {authorAvatar ? (
              <img src={authorAvatar} alt={authorName} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                {authorName.charAt(0)}
              </div>
            )}
            <div>
              <h3 className="font-semibold text-foreground">{authorName}</h3>
              <p className="text-xs text-muted-foreground">
                {postTimeAgo}
                {postLocation && <span> · 📍 {postLocation}</span>}
              </p>
            </div>
          </div>

          {/* Images */}
          {postImages.length > 0 && (
            <div className="px-4">
              {postImages.length === 1 ? (
                <img src={postImages[0]} alt="Post" className="w-full max-h-[500px] object-contain rounded-lg bg-muted/30" />
              ) : (
                <div className="flex gap-2 overflow-x-auto py-1">
                  {postImages.map((img: string, idx: number) => (
                    <img key={idx} src={img} alt={`Post ${idx + 1}`} className="w-48 h-40 flex-shrink-0 object-cover rounded-lg" />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="px-4 py-3">
            {postContent && <p className="text-foreground whitespace-pre-wrap">{postContent}</p>}
          </div>

          {/* Actions - disabled for guests */}
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <div className="flex gap-2">
              <button onClick={handleAuthAction} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted/50 text-muted-foreground text-sm">
                <Heart className="w-4 h-4" /> Glow
              </button>
              <button onClick={handleAuthAction} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted/50 text-muted-foreground text-sm">
                <MessageCircle className="w-4 h-4" /> Echo
              </button>
              <button onClick={handleAuthAction} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted/50 text-muted-foreground text-sm">
                <Share2 className="w-4 h-4" /> Spark
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{post.glow_count || 0} Glows</span>
              <span>{post.comment_count || 0} Echoes</span>
            </div>
          </div>
        </div>

        {/* Sign in prompt */}
        <div className="mt-6 p-6 bg-card rounded-lg border border-border text-center">
          <h2 className="text-lg font-semibold mb-2">Join Nuru to interact</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Sign in or create an account to glow, echo, and share this post.
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild><Link to={`/login?redirect=/post/${id}`}>Sign In</Link></Button>
            <Button variant="outline" asChild><Link to="/register">Create Account</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestPost;
