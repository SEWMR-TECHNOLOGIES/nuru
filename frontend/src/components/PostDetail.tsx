import { useState, useEffect, useCallback } from 'react';
import { getTimeAgo } from '@/utils/getTimeAgo';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, MessageCircle, Share2, Send, MoreHorizontal, Loader2, Bookmark, Flag, ChevronDown, CornerDownRight, MapPin, AlertTriangle } from 'lucide-react';
import { VerifiedUserBadge } from '@/components/ui/verified-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { socialApi } from '@/lib/api/social';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
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

// ──────────────────────────────────────────────
// Helper: get initials from a name string
// ──────────────────────────────────────────────
const getInitials = (name: string) => {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase() : name.charAt(0).toUpperCase();
};

// ──────────────────────────────────────────────
// Avatar component (reused for comments/replies)
// ──────────────────────────────────────────────
const UserAvatar = ({ src, name, size = 'md' }: { src?: string; name: string; size?: 'sm' | 'md' }) => {
  const sizeClasses = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 md:w-10 md:h-10 text-xs md:text-sm';
  if (src) {
    return <img src={src} alt={name} className={`${sizeClasses} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${sizeClasses} rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0`}>
      {getInitials(name)}
    </div>
  );
};

// ──────────────────────────────────────────────
// Inline Reply Input
// ──────────────────────────────────────────────
const InlineReplyInput = ({
  currentUser,
  onSubmit,
  placeholder = 'Write a reply...',
  autoFocus = true,
}: {
  currentUser: any;
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
}) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onSubmit(text.trim());
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex gap-2 items-start mt-2">
      <UserAvatar src={currentUser?.avatar} name={currentUser?.first_name || '?'} size="sm" />
      <div className="flex-1 flex items-start gap-1.5">
        <div className="flex-1 border border-border rounded-full px-3 py-1.5 bg-muted/30">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="w-full bg-transparent text-xs md:text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || sending}
          className="p-1.5 text-primary hover:text-primary/80 disabled:opacity-40 transition-colors"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────
// Single Echo (Comment) Component — Facebook-style
// ──────────────────────────────────────────────
const EchoItem = ({
  comment,
  postId,
  currentUser,
  depth = 0,
  onDelete,
  onReplyAdded,
}: {
  comment: any;
  postId: string;
  currentUser: any;
  depth?: number;
  onDelete: (commentId: string) => void;
  onReplyAdded: () => void;
}) => {
  const [glowed, setGlowed] = useState(comment.has_glowed || false);
  const [glowCount, setGlowCount] = useState(comment.glow_count || 0);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<any[]>(comment.replies_preview || []);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const replyCount = comment.reply_count || 0;

  const cUser = comment.user || comment.author || {};
  const cName = cUser.first_name
    ? `${cUser.first_name} ${cUser.last_name || ''}`.trim()
    : cUser.name || cUser.username || 'User';
  const cAvatar = cUser.avatar || '';
  const isOwn = currentUser?.id === cUser.id;

  const handleGlow = async () => {
    const wasGlowed = glowed;
    setGlowed(!wasGlowed);
    setGlowCount(prev => wasGlowed ? prev - 1 : prev + 1);
    try {
      if (wasGlowed) await socialApi.unglowComment(postId, comment.id);
      else await socialApi.glowComment(postId, comment.id);
    } catch {
      setGlowed(wasGlowed);
      setGlowCount(prev => wasGlowed ? prev + 1 : prev - 1);
      toast.error('Failed to glow echo');
    }
  };

  const handleLoadReplies = async () => {
    if (repliesLoaded) {
      setShowReplies(true);
      return;
    }
    setLoadingReplies(true);
    try {
      const res = await socialApi.getCommentReplies(postId, comment.id);
      if (res.success) {
        const data = res.data as any;
        setReplies(data?.comments || []);
        setRepliesLoaded(true);
        setShowReplies(true);
      }
    } catch {
      toast.error('Failed to load replies');
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleReplySubmit = async (content: string) => {
    try {
      const res = await socialApi.addComment(postId, { content, parent_id: comment.id });
      if (res.success) {
        const newReply = res.data;
        setReplies(prev => [...prev, newReply]);
        setShowReplies(true);
        setRepliesLoaded(true);
        setShowReplyInput(false);
        onReplyAdded();
        toast.success('Reply posted');
      } else {
        toast.error(res.message || 'Failed to post reply');
      }
    } catch {
      toast.error('Failed to post reply');
      throw new Error('failed');
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    try {
      const res = await socialApi.deleteComment(postId, replyId);
      if (res.success) {
        setReplies(prev => prev.filter(r => r.id !== replyId));
        onReplyAdded(); // triggers count update
        toast.success('Reply deleted');
      }
    } catch {
      toast.error('Failed to delete reply');
    }
  };

  // Allow deeper threading (replies to replies)
  const maxDepth = 5;

  return (
    <div className={`${depth > 0 ? 'ml-8 md:ml-10' : ''}`}>
      <div className="flex gap-2 md:gap-2.5">
        <UserAvatar src={cAvatar} name={cName} size={depth > 0 ? 'sm' : 'md'} />
        <div className="flex-1 min-w-0">
          {/* Comment bubble */}
          <div className="bg-muted/50 rounded-2xl px-3 py-2 inline-block max-w-full">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs md:text-sm">{cName}</span>
            </div>
            {comment.content && (
              <p className="text-xs md:text-sm break-words whitespace-pre-wrap mt-0.5">{comment.content}</p>
            )}
          </div>

          {/* Action row — Facebook style */}
          <div className="flex items-center gap-3 mt-0.5 ml-2 text-xs">
            <span className="text-muted-foreground">
              {comment.created_at ? getTimeAgo(comment.created_at) : ''}
            </span>
            <button
              onClick={handleGlow}
              className={`font-semibold transition-colors ${
                glowed ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {glowed ? 'Glowed' : 'Glow'}
            </button>
            {depth < maxDepth && (
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Reply
              </button>
            )}
            {isOwn && (
              <button
                onClick={() => onDelete(comment.id)}
                className="font-semibold text-destructive hover:text-destructive/80 transition-colors"
              >
                Delete
              </button>
            )}
            {glowCount > 0 && (
              <span className="flex items-center gap-0.5 text-muted-foreground">
                <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                {glowCount}
              </span>
            )}
            {comment.is_edited && (
              <span className="text-muted-foreground italic">Edited</span>
            )}
          </div>

          {/* View / collapse replies button */}
          {replyCount > 0 && (
            <button
              onClick={() => {
                if (showReplies) {
                  setShowReplies(false);
                } else {
                  handleLoadReplies();
                }
              }}
              disabled={loadingReplies}
              className="flex items-center gap-1 mt-1.5 ml-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              {loadingReplies ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : showReplies ? (
                <ChevronDown className="w-3 h-3 rotate-180 transition-transform" />
              ) : (
                <CornerDownRight className="w-3 h-3" />
              )}
              {showReplies
                ? 'Hide replies'
                : replies.length > 0 && replies.length < replyCount
                  ? `View ${replyCount - replies.length} more ${replyCount - replies.length === 1 ? 'reply' : 'replies'}`
                  : `View ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`
              }
            </button>
          )}

          {/* Render replies */}
          {showReplies && replies.length > 0 && (
            <div className="mt-2 space-y-2">
              {replies.map((reply) => (
                <EchoItem
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  currentUser={currentUser}
                  depth={depth + 1}
                  onDelete={handleDeleteReply}
                  onReplyAdded={onReplyAdded}
                />
              ))}
            </div>
          )}

          {/* Inline reply input */}
          {showReplyInput && depth < maxDepth && (
            <InlineReplyInput
              currentUser={currentUser}
              onSubmit={handleReplySubmit}
              placeholder={`Reply to ${cName}...`}
            />
          )}
        </div>
      </div>
    </div>
  );
};


// ──────────────────────────────────────────────
// Main PostDetail Component
// ──────────────────────────────────────────────
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
  const [saved, setSaved] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [appealSubmitted, setAppealSubmitted] = useState(false);

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
          setSaved(d.has_saved || false);
        }
      })
      .catch(() => toast.error('Failed to load post'))
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch comments (top-level only)
  const fetchComments = useCallback(() => {
    if (!id) return;
    setCommentsLoading(true);
    socialApi.getComments(id, { sort: 'newest' })
      .then((res) => {
        if (res.success) {
          const data = res.data as any;
          setComments(data?.comments || data?.items || (Array.isArray(data) ? data : []));
        }
      })
      .catch(() => {})
      .finally(() => setCommentsLoading(false));
  }, [id]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

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

  const handleSubmitAppeal = async () => {
    if (!id || !appealReason.trim()) return;
    setSubmittingAppeal(true);
    try {
      const res = await socialApi.submitPostAppeal(id, appealReason.trim());
      if (res.success) { setAppealSubmitted(true); toast.success("Appeal submitted"); setAppealOpen(false); }
      else toast.error(res.message || "Failed to submit appeal");
    } catch { toast.error("Failed to submit appeal"); }
    setSubmittingAppeal(false);
  };

  const handleShare = (platform: string) => {
    const shareUrl = `${window.location.origin}/shared/post/${id}`;
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
        // Prepend new comment to list
        const newComment = res.data;
        if (newComment) {
          setComments(prev => [newComment, ...prev]);
        } else {
          fetchComments();
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

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h1 className="text-2xl md:text-3xl font-bold">Moment</h1>
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ChevronLeft className="w-5 h-5" />
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

  const authorName = post.author?.name
    || (post.user?.first_name ? `${post.user.first_name} ${post.user.last_name || ''}`.trim() : null)
    || 'Anonymous';
  const authorAvatar = post.author?.avatar || post.user?.avatar || '';
  const authorVerified = post.user?.is_identity_verified || post.author?.is_verified || false;
  const postTitle = post.title || '';
  const postContent = post.content || '';
  const postImages = post.images || post.media?.map((m: any) => m.url) || [];
  const postTimeAgo = post.created_at ? getTimeAgo(post.created_at) : 'Recently';
  const postLocation = post.location || '';

  const isOwner = currentUser && (post.user?.id === currentUser.id || post.author?.id === currentUser.id);
  const isRemoved = post.is_active === false;

  return (
    <>
      {/* Appeal Dialog */}
      <Dialog open={appealOpen} onOpenChange={open => { if (!open) { setAppealOpen(false); setAppealReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appeal Content Removal</DialogTitle>
            <DialogDescription>Explain why you believe this content should be restored. Our team will review your appeal.</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} placeholder="Describe why this removal was unjustified..." value={appealReason} onChange={e => setAppealReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppealOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitAppeal} disabled={submittingAppeal || !appealReason.trim()}>
              {submittingAppeal ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Submit Appeal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h1 className="text-2xl md:text-3xl font-bold">Moment</h1>
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>

      {/* Removed content banner */}
      {isRemoved && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">This post has been removed by an administrator.</p>
            {post.removal_reason && (
              <p className="text-xs text-muted-foreground mt-0.5">Reason: {post.removal_reason}</p>
            )}
            {isOwner && !appealSubmitted && (
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => setAppealOpen(true)}>
                Appeal Removal
              </Button>
            )}
            {appealSubmitted && <p className="text-xs text-muted-foreground mt-1">✓ Appeal submitted — we'll review it shortly.</p>}
            <p className="text-xs text-muted-foreground mt-1 opacity-70">Note: Removed content is permanently deleted after 7 days if no appeal is submitted.</p>
          </div>
        </div>
      )}

      {/* Post Content */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden mb-4 md:mb-6">
        <div className="p-3 md:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <UserAvatar src={authorAvatar} name={authorName} />
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground text-sm md:text-base truncate flex items-center gap-1.5">
                {authorVerified && <VerifiedUserBadge size="xs" />}
                {authorName}
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground">
                {postTimeAgo}
                {postLocation && <span className="inline-flex items-center gap-0.5"> · <MapPin className="w-3 h-3 inline" /> {postLocation}</span>}
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
              <DropdownMenuItem onClick={() => handleShare('whatsapp')}>
                <Share2 className="w-4 h-4 mr-2" /> WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('facebook')}>
                <Share2 className="w-4 h-4 mr-2" /> Facebook
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('twitter')}>
                <Share2 className="w-4 h-4 mr-2" /> Twitter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('copy')}>
                <Share2 className="w-4 h-4 mr-2" /> Copy Link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSave}>
                <Bookmark className={`w-4 h-4 mr-2 ${saved ? 'fill-current' : ''}`} />
                {saved ? 'Unsave' : 'Save'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleReport} className="text-destructive focus:text-destructive">
                <Flag className="w-4 h-4 mr-2" /> Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Images */}
        {postImages.length > 0 && (
          <div className={`px-3 md:px-4 ${postImages.length > 1 ? 'flex gap-2 overflow-x-auto py-1' : ''}`}>
            {postImages.length === 1 ? (
              <img src={postImages[0]} alt="Post" className="w-full max-h-[500px] object-contain rounded-lg bg-muted/30" />
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
            <button
              onClick={handleGlow}
              className={`flex items-center gap-1.5 px-2 md:px-3 py-1 rounded-lg transition-colors text-xs md:text-sm ${
                glowed ? 'bg-red-100 text-red-600' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 md:w-4 md:h-4 ${glowed ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">{glowed ? 'Glowed' : 'Glow'}</span>
            </button>



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

      {/* Echoes (Comments) Section */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-3 md:p-4">
        <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">{commentCount} {commentCount === 1 ? 'Echo' : 'Echoes'}</h2>

        {/* Main Comment Input */}
        <div className="flex gap-2 md:gap-3 mb-4 md:mb-5">
          <UserAvatar src={currentUser?.avatar} name={currentUser?.first_name || '?'} />
          <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
            <div className="flex-1 border border-border rounded-2xl px-3 md:px-4 py-2 bg-muted/20">
              <textarea
                placeholder="Add an echo..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                rows={1}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground resize-none overflow-hidden whitespace-pre-wrap break-words"
                style={{ minHeight: '1.5rem', maxHeight: '6rem' }}
                onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 96) + 'px'; }}
              />
            </div>
            <Button
              size="sm"
              onClick={handleSendComment}
              disabled={!input.trim() || sending}
              className="rounded-full h-9 w-9 p-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Comments List — Threaded */}
        {commentsLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            {comments.map((comment) => (
              <EchoItem
                key={comment.id}
                comment={comment}
                postId={id!}
                currentUser={currentUser}
                depth={0}
                onDelete={handleDeleteComment}
                onReplyAdded={() => setCommentCount(prev => prev + 1)}
              />
            ))}

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
