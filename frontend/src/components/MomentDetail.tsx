import { useState, useEffect, useRef } from 'react';
import { getTimeAgo } from '@/utils/getTimeAgo';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, Share2, Send, X, Loader2 } from 'lucide-react';
import CustomImageIcon from '@/assets/icons/image-icon.svg';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from 'sonner';
import { socialApi } from '@/lib/api/social';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Skeleton } from '@/components/ui/skeleton';

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.charAt(0).toUpperCase();
};

const MomentDetail = () => {
  const { id } = useParams();
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
  const [shareOpen, setShareOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const inputFileRef = useRef<HTMLInputElement | null>(null);

  const shareUrl = `${window.location.origin}/shared/post/${id}`;
  const shareTitle = post?.title || post?.content?.slice(0, 50) || 'Check out this moment on Nuru';

  // getTimeAgo imported from shared utility

  const handleShare = (platform: string) => {
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

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  // Fetch post from API
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    socialApi.getPost(id)
      .then((res) => {
        if (res.success && res.data) {
          const d = res.data as any;
          setPost(d);
          setGlowed(d.has_glowed || false);
          setGlowCount(d.glow_count || d.likes || 0);
          setCommentCount(d.comment_count || d.comments || 0);
        }
      })
      .catch(() => toast.error('Failed to load post'))
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch comments from API
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (inputFileRef.current) inputFileRef.current.value = '';
  };

  const sendEcho = async () => {
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
        removeImage();
      } else {
        toast.error(res.message || 'Failed to add echo');
      }
    } catch {
      toast.error('Failed to add echo');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendEcho();
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

  // Extract post fields from API response
  const authorName = post.author?.name
    || (post.user?.first_name ? `${post.user.first_name} ${post.user.last_name || ''}`.trim() : null)
    || 'Anonymous';
  const authorAvatar = post.author?.avatar || post.user?.avatar || '';
  const postTitle = post.title || post.content?.title || '';
  const postContent = post.content?.text || post.content || (typeof post.content === 'string' ? post.content : '');
  const postImages = post.images || post.media?.map((m: any) => m.url) || [];
  const postImage = post.event?.image || post.content?.image || postImages[0] || '';
  const postTimeAgo = post.created_at ? getTimeAgo(post.created_at) : 'Recently';
  const postLocation = post.location || '';

  return (
    <>
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h1 className="text-2xl md:text-3xl font-bold">Moment</h1>
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* Moment Content */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden mb-4 md:mb-6">
        <div className="p-3 md:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {authorAvatar ? (
              <img src={authorAvatar} alt={authorName} className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                {getInitials(authorName)}
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

          <Popover open={shareOpen} onOpenChange={setShareOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground flex-shrink-0">
                <Share2 className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="end">
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

        {/* Images */}
        {postImages.length > 0 ? (
          <div className={`px-3 md:px-4 ${postImages.length > 1 ? 'flex gap-2 overflow-x-auto py-1' : ''}`}>
            {postImages.length === 1 ? (
              <img src={postImages[0]} alt="Post" className="w-full max-h-[500px] object-contain rounded-lg bg-muted/30" />
            ) : (
              postImages.map((img: string, idx: number) => (
                <img key={idx} src={img} alt={`Post ${idx + 1}`} className="w-40 h-32 md:w-48 md:h-40 flex-shrink-0 object-cover rounded-lg" />
              ))
            )}
          </div>
        ) : postImage ? (
          <div className="px-3 md:px-4">
            <img src={postImage} alt={postTitle || 'Moment image'} className="w-full max-h-[500px] object-contain rounded-lg bg-muted/30" />
          </div>
        ) : null}

        {/* Content */}
        <div className="px-3 md:px-4 py-2 md:py-3">
          {postTitle && <h2 className="text-lg md:text-xl font-bold text-foreground mb-1">{postTitle}</h2>}
          {typeof postContent === 'string' && postContent && (
            <p className="text-sm md:text-base text-foreground whitespace-pre-wrap">{postContent}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-3 md:px-4 py-2 md:py-3 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex gap-2 w-full sm:w-auto justify-start">
            <button
              onClick={handleGlow}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-colors text-xs md:text-sm min-w-[60px] md:min-w-[80px] ${
                glowed ? 'bg-red-100 text-red-600' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Heart className={`w-4 h-4 flex-shrink-0 ${glowed ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline whitespace-nowrap">{glowed ? 'Glowed' : 'Glow'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
            <span>{glowCount} {glowCount === 1 ? 'Glow' : 'Glows'}</span>
            <span className="font-medium">{commentCount} {commentCount === 1 ? 'Echo' : 'Echoes'}</span>
          </div>
        </div>
      </div>

      {/* Echoes (Comments) */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-3 md:p-4">
        {/* Comment Input */}
        <div className="flex gap-2 md:gap-3 mb-3 md:mb-4">
          {currentUser?.avatar ? (
            <img src={currentUser.avatar} alt="You" className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
              {getInitials(`${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || '?')}
            </div>
          )}
          <div className="flex-1 space-y-2">
            {imagePreview && (
              <div className="relative inline-block">
                <img src={imagePreview} alt="preview" className="w-20 h-20 object-cover rounded-lg" />
                <button onClick={removeImage} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="flex items-end gap-1.5 flex-1 border border-border rounded-lg px-3 py-2 min-w-0">
                <textarea
                  placeholder="Add an echo..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0 resize-none overflow-hidden whitespace-pre-wrap break-words"
                  style={{ maxHeight: '120px' }}
                  onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }}
                  autoComplete="off"
                />
                <input
                  ref={inputFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button onClick={() => inputFileRef.current?.click()} className="text-muted-foreground hover:text-foreground" type="button">
                  <img src={CustomImageIcon} alt="Image" className="w-4 h-4" />
                </button>
              </div>
              <Button
                size="sm"
                onClick={sendEcho}
                disabled={!input.trim() || sending}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
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
        ) : comments.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">No echoes yet. Be the first!</p>
        ) : (
          <div className="space-y-2 md:space-y-3">
            {comments.map((comment) => {
              const cUser = comment.user || comment.author || {};
              const cName = cUser.first_name
                ? `${cUser.first_name} ${cUser.last_name || ''}`.trim()
                : cUser.name || cUser.username || 'User';
              const cAvatar = cUser.avatar || '';
              const cTime = comment.created_at ? getTimeAgo(comment.created_at) : '';

              return (
                <div key={comment.id} className="flex gap-2 md:gap-3">
                  {cAvatar ? (
                    <img src={cAvatar} alt={cName} className="w-7 h-7 md:w-8 md:h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground flex-shrink-0">
                      {getInitials(cName)}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="bg-muted/50 rounded-lg p-2 md:p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs md:text-sm font-semibold">{cName}</span>
                        <span className="text-xs text-muted-foreground">{cTime}</span>
                      </div>
                      {comment.content && <p className="text-sm text-foreground">{comment.content}</p>}
                      {comment.image && <img src={comment.image} alt="" className="mt-2 max-w-xs rounded-lg" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default MomentDetail;
