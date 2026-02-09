import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Share2, Send, MoreHorizontal, Loader2, Repeat2, Bookmark, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { socialApi } from '@/lib/api/social';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';

const PostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUserQuery = useCurrentUser();
  const currentUser = currentUserQuery.data as any;

  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [glowed, setGlowed] = useState(false);
  const [glowCount, setGlowCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [echoed, setEchoed] = useState(false);
  const [echoLoading, setEchoLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  // Fetch post
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    socialApi.getPost(id)
      .then((res) => {
        if (res.success && res.data) {
          const d = res.data as any;
          setPost(d);
          setGlowed(d.has_glowed || false);
          setGlowCount(d.glow_count || 0);
          setCommentCount(d.comment_count || 0);
          setEchoed(d.has_echoed || false);
          setSaved(d.has_saved || false);
        }
      })
      .catch(() => toast.error('Failed to load post'))
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch comments
  useEffect(() => {
    if (!id) return;
    setCommentsLoading(true);
    socialApi.getComments(id)
      .then((res) => {
        if (res.success) {
          const data = res.data as any;
          setComments(data?.comments || data?.items || (Array.isArray(data) ? data : []));
        }
      })
      .catch(() => {})
      .finally(() => setCommentsLoading(false));
  }, [id]);

  const handleGlow = async () => {
    if (!id) return;
    const wasGlowed = glowed;
    setGlowed(!wasGlowed);
    setGlowCount(prev => wasGlowed ? prev - 1 : prev + 1);
    try {
      if (wasGlowed) await socialApi.unglowPost(id);
      else await socialApi.glowPost(id);
    } catch {
      setGlowed(wasGlowed);
      setGlowCount(prev => wasGlowed ? prev + 1 : prev - 1);
      toast.error('Failed to update glow');
    }
  };

  const handleEcho = async () => {
    if (!id || echoLoading) return;
    setEchoLoading(true);
    try {
      if (echoed) {
        await socialApi.unechoPost(id);
        setEchoed(false);
        toast.success('Echo removed');
      } else {
        await socialApi.echoPost(id);
        setEchoed(true);
        toast.success('Echoed!');
      }
    } catch {
      toast.error('Failed to echo');
    } finally {
      setEchoLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      if (saved) {
        await socialApi.unsavePost(id);
        setSaved(false);
        toast.success('Unsaved');
      } else {
        await socialApi.savePost(id);
        setSaved(true);
        toast.success('Saved!');
      }
    } catch {
      toast.error('Failed to save');
    }
  };

  const handleReport = async () => {
    if (!id) return;
    try {
      await socialApi.reportPost(id, { reason: 'inappropriate' });
      toast.success('Post reported');
    } catch {
      toast.error('Failed to report');
    }
  };

  const handleShare = (platform: string) => {
    const shareUrl = `${window.location.origin}/post/${id}`;
    const shareTitle = post?.title || post?.content?.slice(0, 50) || 'Check this out';
    let url = '';
    switch (platform) {
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(shareTitle + ' ' + shareUrl)}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied!');
        setShareOpen(false);
        return;
    }
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      setShareOpen(false);
    }
  };

  const handleSendComment = async () => {
    if (!input.trim() || !id || sending) return;
    setSending(true);
    try {
      const res = await socialApi.addComment(id, { content: input.trim() });
      if (res.success) {
        const commentsRes = await socialApi.getComments(id);
        if (commentsRes.success) {
          const data = commentsRes.data as any;
          setComments(data?.comments || data?.items || (Array.isArray(data) ? data : []));
        }
        setCommentCount(prev => prev + 1);
        setInput('');
      } else {
        toast.error(res.message || 'Failed to add echo');
      }
    } catch {
      toast.error('Failed to add echo');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!id) return;
    try {
      const res = await socialApi.deleteComment(id, commentId);
      if (res.success) {
        setComments(prev => prev.filter(c => c.id !== commentId));
        setCommentCount(prev => prev - 1);
        toast.success('Echo deleted');
      }
    } catch {
      toast.error('Failed to delete echo');
    }
  };

  const handleGlowComment = async (commentId: string, hasGlowed: boolean) => {
    if (!id) return;
    try {
      if (hasGlowed) {
        await socialApi.unglowComment(id, commentId);
      } else {
        await socialApi.glowComment(id, commentId);
      }
      // Update local comment state
      setComments(prev => prev.map(c =>
        c.id === commentId
          ? { ...c, has_glowed: !hasGlowed, glow_count: (c.glow_count || 0) + (hasGlowed ? -1 : 1) }
          : c
      ));
    } catch {
      toast.error('Failed to glow echo');
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center mb-4">
          <Button variant="ghost" onClick={handleBack} className="flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden mb-4">
          <div className="p-4 flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-64 mx-4 rounded-lg mb-4" />
          <div className="px-4 py-3 space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Post not found</p>
        <Button variant="outline" onClick={handleBack} className="mt-4">Go Back</Button>
      </div>
    );
  }

  // Extract post fields flexibly from API
  const authorName = post.author?.name
    || (post.user?.first_name ? `${post.user.first_name} ${post.user.last_name || ''}`.trim() : null)
    || 'Anonymous';
  const authorAvatar = post.author?.avatar || post.user?.avatar || '';
  const postTitle = post.title || '';
  const postContent = post.content || '';
  const postImages = post.images || post.media?.map((m: any) => m.url) || [];
  const postTimeAgo = post.created_at ? getTimeAgo(post.created_at) : 'Recently';
  const postLocation = post.location || '';

  return (
    <>
      <div className="flex items-center mb-3 md:mb-4">
        <Button variant="ghost" onClick={handleBack} className="flex items-center gap-2 text-sm md:text-base">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      {/* Post Content */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden mb-4 md:mb-6">
        <div className="p-3 md:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {authorAvatar ? (
              <img src={authorAvatar} alt={authorName} className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                {authorName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground text-sm md:text-base truncate">{authorName}</h3>
              <p className="text-xs md:text-sm text-muted-foreground">
                {postTimeAgo}
                {postLocation && <span> · 📍 {postLocation}</span>}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleSave}>
                <Bookmark className={`w-4 h-4 mr-2 ${saved ? 'fill-current' : ''}`} />
                {saved ? 'Unsave' : 'Save'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleReport} className="text-destructive focus:text-destructive">
                <Flag className="w-4 h-4 mr-2" />
                Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Images */}
        {postImages.length > 0 && (
          <div className={`px-3 md:px-4 ${postImages.length > 1 ? 'flex gap-2 overflow-x-auto py-1' : ''}`}>
            {postImages.length === 1 ? (
              <img src={postImages[0]} alt="Post" className="w-full h-48 md:h-64 object-cover rounded-lg" />
            ) : (
              postImages.map((img: string, idx: number) => (
                <img key={idx} src={img} alt={`Post ${idx + 1}`} className="w-40 h-32 md:w-48 md:h-40 flex-shrink-0 object-cover rounded-lg" />
              ))
            )}
          </div>
        )}

        <div className="px-3 md:px-4 py-2 md:py-3">
          {postTitle && <h2 className="text-lg md:text-xl font-bold text-foreground mb-1">{postTitle}</h2>}
          {postContent && <p className="text-sm md:text-base text-foreground whitespace-pre-wrap">{postContent}</p>}
        </div>

        {/* Action Buttons */}
        <div className="px-3 md:px-4 py-2 md:py-3 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex gap-1.5 md:gap-2 flex-wrap">
            {/* Glow */}
            <button
              onClick={handleGlow}
              className={`flex items-center gap-1.5 px-2 md:px-3 py-1 rounded-lg transition-colors text-xs md:text-sm ${
                glowed ? 'bg-red-100 text-red-600' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 md:w-4 md:h-4 ${glowed ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">{glowed ? 'Glowed' : 'Glow'}</span>
            </button>

            {/* Echo (repost) */}
            <button
              onClick={handleEcho}
              disabled={echoLoading}
              className={`flex items-center gap-1.5 px-2 md:px-3 py-1 rounded-lg transition-colors text-xs md:text-sm ${
                echoed ? 'bg-green-100 text-green-600' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Repeat2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{echoed ? 'Echoed' : 'Echo'}</span>
            </button>

            {/* Spark (share) */}
            <Popover open={shareOpen} onOpenChange={setShareOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 px-2 md:px-3 py-1 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-xs md:text-sm">
                  <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Spark</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="flex flex-col gap-1">
                  {['whatsapp', 'facebook', 'twitter', 'copy'].map((p) => (
                    <Button key={p} variant="ghost" className="justify-start gap-2 text-sm capitalize" onClick={() => handleShare(p)}>
                      {p === 'copy' ? 'Copy Link' : p}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
            <span>{glowCount} {glowCount === 1 ? 'Glow' : 'Glows'}</span>
            <span>{commentCount} {commentCount === 1 ? 'Echo' : 'Echoes'}</span>
          </div>
        </div>
      </div>

      {/* Echoes (Comments) */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-3 md:p-4">
        <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Echoes ({commentCount})</h2>

        {/* Comment Input — no location field */}
        <div className="flex gap-2 md:gap-3 mb-3 md:mb-4">
          {currentUser?.avatar ? (
            <img src={currentUser.avatar} alt="You" className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
              {currentUser?.first_name?.[0] || '?'}
            </div>
          )}
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-1 border border-border rounded-lg px-3 py-2 min-w-0">
              <input
                type="text"
                placeholder="Add an echo..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
              />
            </div>
            <Button
              size="sm"
              onClick={handleSendComment}
              disabled={!input.trim() || sending}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Comments List */}
        {commentsLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 md:space-y-3">
            {comments.map((comment) => {
              const cUser = comment.user || comment.author || {};
              const cName = cUser.first_name
                ? `${cUser.first_name} ${cUser.last_name || ''}`.trim()
                : cUser.name || cUser.username || 'User';
              const cAvatar = cUser.avatar || '';
              const isOwn = currentUser?.id === cUser.id;
              const commentGlowed = comment.has_glowed || false;
              const commentGlowCount = comment.glow_count || 0;

              return (
                <div key={comment.id} className="flex gap-2 md:gap-3">
                  {cAvatar ? (
                    <img src={cAvatar} alt={cName} className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs flex-shrink-0">
                      {cName.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="bg-muted/50 rounded-lg p-2 md:p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-xs md:text-sm truncate">{cName}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {comment.created_at ? getTimeAgo(comment.created_at) : ''}
                          </span>
                        </div>
                        {isOwn && (
                          <button onClick={() => handleDeleteComment(comment.id)} className="text-xs text-destructive hover:underline flex-shrink-0">
                            Delete
                          </button>
                        )}
                      </div>
                      {comment.content && <p className="text-sm break-words">{comment.content}</p>}
                      {comment.media && (
                        <img src={comment.media.url || comment.media} alt="media" className="mt-2 w-full h-32 object-cover rounded-lg" />
                      )}
                    </div>
                    {/* Comment actions */}
                    <div className="flex items-center gap-3 mt-1 ml-2">
                      <button
                        onClick={() => handleGlowComment(comment.id, commentGlowed)}
                        className={`flex items-center gap-1 text-xs transition-colors ${
                          commentGlowed ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Heart className={`w-3 h-3 ${commentGlowed ? 'fill-current' : ''}`} />
                        {commentGlowCount > 0 && <span>{commentGlowCount}</span>}
                      </button>
                      {comment.reply_count > 0 && (
                        <button className="text-xs text-primary">
                          {comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {comments.length === 0 && !commentsLoading && (
              <p className="text-center text-muted-foreground py-3 md:py-4 text-sm">No echoes yet. Be the first to add one!</p>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default PostDetail;
