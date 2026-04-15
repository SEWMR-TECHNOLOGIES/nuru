import { useState, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { Send, Loader2, ChevronDown, CornerDownRight, Heart } from 'lucide-react';
import { socialApi } from '@/lib/api/social';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getTimeAgo } from '@/utils/getTimeAgo';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.charAt(0).toUpperCase();
};

const MiniAvatar = ({ src, name, size = 'md' }: { src?: string; name: string; size?: 'sm' | 'md' }) => {
  const dim = size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-7 h-7 text-[10px]';
  if (src) {
    return <img src={src} alt={name} className={`${dim} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${dim} rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0`}>
      {getInitials(name)}
    </div>
  );
};

// ── Inline Reply Input ──
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
    <div className="flex gap-2 items-center mt-1.5">
      <MiniAvatar src={currentUser?.avatar} name={currentUser?.first_name || '?'} size="sm" />
      <div className="flex-1 flex items-center gap-1.5">
        <div className="flex-1 border border-border rounded-full px-3 py-1.5 bg-muted/20 focus-within:border-primary/40 transition-colors">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
            placeholder={placeholder}
            autoFocus={autoFocus}
            autoComplete="off"
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
          disabled={!text.trim() || sending}
          className="p-1.5 text-primary hover:text-primary/80 disabled:opacity-30 transition-colors active:scale-95"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};

// ── Single Echo Item — threaded like PostDetail ──
const InlineEchoItem = ({
  comment,
  postId,
  currentUser,
  depth = 0,
  onReplyAdded,
}: {
  comment: any;
  postId: string;
  currentUser: any;
  depth?: number;
  onReplyAdded: () => void;
}) => {
  const user = comment.user || comment.author || {};
  const name = user.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user.name || 'User';
  const avatar = user.avatar || '';
  const verified = user.is_identity_verified || user.is_verified || false;

  const [glowed, setGlowed] = useState(comment.has_glowed || comment.is_glowed || false);
  const [glowCount, setGlowCount] = useState(comment.glow_count || 0);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<any[]>(comment.replies_preview || []);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const replyCount = comment.reply_count || 0;
  const maxDepth = 5;

  const handleGlow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const wasGlowed = glowed;
    setGlowed(!wasGlowed);
    setGlowCount((c: number) => wasGlowed ? c - 1 : c + 1);
    try {
      if (wasGlowed) await socialApi.unglowComment(postId, comment.id);
      else await socialApi.glowComment(postId, comment.id);
    } catch {
      setGlowed(wasGlowed);
      setGlowCount((c: number) => wasGlowed ? c + 1 : c - 1);
    }
  };

  const handleLoadReplies = async () => {
    if (repliesLoaded) { setShowReplies(true); return; }
    setLoadingReplies(true);
    try {
      const res = await socialApi.getCommentReplies(postId, comment.id);
      if (res.success) {
        const data = res.data as any;
        setReplies(data?.comments || []);
        setRepliesLoaded(true);
        setShowReplies(true);
      }
    } catch { /* silent */ } finally {
      setLoadingReplies(false);
    }
  };

  const handleReplySubmit = async (content: string) => {
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
      throw new Error('failed');
    }
  };

  return (
    <div className={`${depth > 0 ? 'ml-6 md:ml-8' : ''}`}>
      <div className="flex gap-2 items-start">
        <MiniAvatar src={avatar} name={name} size={depth > 0 ? 'sm' : 'md'} />
        <div className="flex-1 min-w-0">
          {/* Bubble */}
          <div className="bg-muted/40 rounded-2xl px-3 py-1.5 inline-block max-w-full">
            <span className="font-semibold text-[11px] text-foreground flex items-center gap-1">
              {name}

            </span>
            {comment.content && (
              <p className="text-xs text-foreground break-words whitespace-pre-wrap leading-relaxed">{comment.content}</p>
            )}
          </div>

          {/* Action row */}
          <div className="flex items-center gap-2.5 mt-0.5 ml-2 text-[10px] text-muted-foreground">
            <span>{comment.created_at ? getTimeAgo(comment.created_at) : ''}</span>
            <button
              onClick={handleGlow}
              className={`font-semibold transition-colors active:scale-95 ${glowed ? 'text-destructive' : 'hover:text-foreground'}`}
            >
              {glowed ? 'Glowed' : 'Glow'}
            </button>
            {depth < maxDepth && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowReplyInput(!showReplyInput); }}
                className="font-semibold hover:text-foreground transition-colors active:scale-95"
              >
                Reply
              </button>
            )}
            {glowCount > 0 && (
              <span className="flex items-center gap-0.5">
                <span className="text-[10px]">❤️</span>
                {glowCount}
              </span>
            )}
          </div>

          {/* View / collapse replies */}
          {replyCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (showReplies) setShowReplies(false);
                else handleLoadReplies();
              }}
              disabled={loadingReplies}
              className="flex items-center gap-1 mt-1 ml-2 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              {loadingReplies ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : showReplies ? (
                <ChevronDown className="w-2.5 h-2.5 rotate-180 transition-transform" />
              ) : (
                <CornerDownRight className="w-2.5 h-2.5" />
              )}
              {showReplies
                ? 'Hide replies'
                : `View ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
            </button>
          )}

          {/* Threaded replies */}
          {showReplies && replies.length > 0 && (
            <div className="mt-1.5 space-y-2">
              {replies.map((reply) => (
                <InlineEchoItem
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  currentUser={currentUser}
                  depth={depth + 1}
                  onReplyAdded={onReplyAdded}
                />
              ))}
            </div>
          )}

          {/* Inline reply input under this comment */}
          {showReplyInput && depth < maxDepth && currentUser && (
            <InlineReplyInput
              currentUser={currentUser}
              onSubmit={handleReplySubmit}
              placeholder={`Reply to ${name}...`}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ──
interface InlineFeedEchoesProps {
  postId: string;
  commentCount: number;
  onCommentCountChange?: (delta: number) => void;
}

export interface InlineFeedEchoesRef {
  toggle: () => void;
}

const InlineFeedEchoes = forwardRef<InlineFeedEchoesRef, InlineFeedEchoesProps>(({ postId, commentCount, onCommentCountChange }, ref) => {
  const { data: currentUser } = useCurrentUser();
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    toggle: () => {
      if (expanded) {
        setExpanded(false);
      } else {
        setExpanded(true);
        if (!loaded) fetchComments();
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }));

  const fetchComments = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await socialApi.getComments(postId, { limit: 10, sort: 'newest' });
      if (res.success) {
        const data = res.data as any;
        setComments(data?.comments || data?.items || (Array.isArray(data) ? data : []));
        setLoaded(true);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [postId, loaded]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const res = await socialApi.addComment(postId, { content: input.trim() });
      if (res.success) {
        const newComment = res.data;
        if (newComment) setComments(prev => [newComment, ...prev]);
        onCommentCountChange?.(1);
        setInput('');
        toast.success('Echo posted');
      } else {
        toast.error(res.message || 'Failed to post echo');
      }
    } catch {
      toast.error('Failed to post echo');
    } finally {
      setSending(false);
    }
  };

  if (!expanded) return null;

  return (
    <div className="border-t border-border/50" onClick={(e) => e.stopPropagation()}>
      {/* Top-level input — always visible when expanded */}
      <div className="px-3 md:px-4 py-2">
        <div className="flex gap-2 items-center">
          {currentUser && (
            <MiniAvatar
              src={(currentUser as any).avatar}
              name={`${(currentUser as any).first_name || ''} ${(currentUser as any).last_name || ''}`.trim() || '?'}
            />
          )}
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center gap-1.5"
          >
            <div className="flex-1 border border-border rounded-full px-3 py-1.5 bg-muted/20 focus-within:border-primary/40 transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Write an echo..."
                autoComplete="off"
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="p-1.5 text-primary hover:text-primary/80 disabled:opacity-30 transition-colors active:scale-95"
              onClick={(e) => e.stopPropagation()}
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="px-3 md:px-4 pb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Loading echoes...</span>
        </div>
      )}

      {/* Threaded comments list */}
      {comments.length > 0 && (
        <div className="px-3 md:px-4 pb-3 space-y-2.5">
          {comments.map((comment) => (
            <InlineEchoItem
              key={comment.id}
              comment={comment}
              postId={postId}
              currentUser={currentUser}
              depth={0}
              onReplyAdded={() => onCommentCountChange?.(1)}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default InlineFeedEchoes;
