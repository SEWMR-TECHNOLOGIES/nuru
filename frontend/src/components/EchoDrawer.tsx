import { useState, useCallback, useEffect, useRef } from 'react';
import { MessageCircle, Send, Loader2, Heart, CornerDownRight } from 'lucide-react';
import { socialApi } from '@/lib/api/social';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getTimeAgo } from '@/utils/getTimeAgo';
import { VerifiedUserBadge } from '@/components/ui/verified-badge';
import { toast } from 'sonner';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.charAt(0).toUpperCase();
};

const MiniAvatar = ({ src, name, size = 'sm' }: { src?: string; name: string; size?: 'sm' | 'md' }) => {
  const cls = size === 'md' ? 'w-9 h-9' : 'w-7 h-7';
  const textCls = size === 'md' ? 'text-xs' : 'text-[10px]';
  if (src) {
    return <img src={src} alt={name} className={`${cls} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${cls} rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold ${textCls} flex-shrink-0`}>
      {getInitials(name)}
    </div>
  );
};

interface EchoDrawerProps {
  postId: string;
  commentCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommentCountChange?: (delta: number) => void;
}

const EchoComment = ({ comment, postId, onReply }: { comment: any; postId: string; onReply: (name: string, commentId: string) => void }) => {
  const user = comment.user || comment.author || {};
  const name = user.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user.name || 'User';
  const avatar = user.avatar || '';
  const verified = user.is_identity_verified || user.is_verified || false;

  const [glowed, setGlowed] = useState(comment.is_glowed || false);
  const [glowCount, setGlowCount] = useState(comment.glow_count || 0);
  const [glowing, setGlowing] = useState(false);

  const handleGlow = async () => {
    if (glowing) return;
    setGlowing(true);
    try {
      if (glowed) {
        await socialApi.unglowComment(postId, comment.id);
        setGlowed(false);
        setGlowCount((c: number) => Math.max(0, c - 1));
      } else {
        await socialApi.glowComment(postId, comment.id);
        setGlowed(true);
        setGlowCount((c: number) => c + 1);
      }
    } catch {
      // silent
    } finally {
      setGlowing(false);
    }
  };

  return (
    <div className="flex gap-2.5 items-start">
      <MiniAvatar src={avatar} name={name} size="md" />
      <div className="flex-1 min-w-0">
        <div className="bg-muted/40 rounded-2xl px-3.5 py-2 inline-block max-w-full">
          <span className="font-semibold text-xs text-foreground flex items-center gap-1">
            {name}
            {verified && <VerifiedUserBadge size="xs" />}
          </span>
          {comment.content && (
            <p className="text-sm text-foreground break-words whitespace-pre-wrap leading-relaxed mt-0.5">{comment.content}</p>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 ml-2 text-[11px] text-muted-foreground">
          <span>{comment.created_at ? getTimeAgo(comment.created_at) : ''}</span>
          <button
            onClick={handleGlow}
            className={`flex items-center gap-0.5 transition-colors active:scale-95 ${glowed ? 'text-destructive font-semibold' : 'hover:text-destructive'}`}
          >
            <Heart className={`w-3 h-3 ${glowed ? 'fill-current' : ''}`} />
            {glowCount > 0 && <span>{glowCount}</span>}
          </button>
          <button
            onClick={() => onReply(name, comment.id)}
            className="flex items-center gap-0.5 hover:text-primary transition-colors active:scale-95"
          >
            <CornerDownRight className="w-3 h-3" />
            Reply
          </button>
          {(comment.reply_count || 0) > 0 && (
            <span className="text-primary/70">{comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}</span>
          )}
        </div>
      </div>
    </div>
  );
};

const EchoDrawer = ({ postId, commentCount, open, onOpenChange, onCommentCountChange }: EchoDrawerProps) => {
  const { data: currentUser } = useCurrentUser();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [localCount, setLocalCount] = useState(commentCount);
  const [replyTo, setReplyTo] = useState<{ name: string; commentId: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalCount(commentCount);
  }, [commentCount]);

  const fetchComments = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await socialApi.getComments(postId, { limit: 20, sort: 'newest' });
      if (res.success) {
        const data = res.data as any;
        setComments(data?.comments || data?.items || (Array.isArray(data) ? data : []));
        setLoaded(true);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [postId, loaded]);

  useEffect(() => {
    if (open && !loaded) fetchComments();
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open, loaded, fetchComments]);

  const handleReply = (name: string, commentId: string) => {
    setReplyTo({ name, commentId });
    setInput(`@${name} `);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const payload: { content: string; parent_id?: string } = { content: input.trim() };
      if (replyTo) payload.parent_id = replyTo.commentId;
      const res = await socialApi.addComment(postId, payload);
      if (res.success) {
        const newComment = res.data;
        if (newComment) setComments(prev => [newComment, ...prev]);
        setLocalCount(c => c + 1);
        onCommentCountChange?.(1);
        setInput('');
        setReplyTo(null);
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

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80dvh] flex flex-col">
        <DrawerHeader className="border-b border-border pb-3 flex-shrink-0">
          <DrawerTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Echoes
            {localCount > 0 && (
              <span className="text-xs text-muted-foreground font-normal">({localCount})</span>
            )}
          </DrawerTitle>
        </DrawerHeader>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && comments.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No echoes yet</p>
              <p className="text-xs mt-1">Be the first to echo</p>
            </div>
          )}

          {comments.map((comment) => (
            <EchoComment key={comment.id} comment={comment} postId={postId} onReply={handleReply} />
          ))}
        </div>

        {/* Input - fixed at bottom */}
        <div className="border-t border-border px-4 py-3 flex-shrink-0 pb-[env(safe-area-inset-bottom,12px)]">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
              <CornerDownRight className="w-3 h-3" />
              <span>Replying to <strong className="text-foreground">{replyTo.name}</strong></span>
              <button onClick={() => { setReplyTo(null); setInput(''); }} className="ml-auto text-destructive hover:text-destructive/80 text-[10px] font-medium">Cancel</button>
            </div>
          )}
          <div className="flex gap-2.5 items-center">
            {currentUser && (
              <MiniAvatar
                src={(currentUser as any).avatar}
                name={`${(currentUser as any).first_name || ''} ${(currentUser as any).last_name || ''}`.trim() || '?'}
                size="md"
              />
            )}
            <form
              onSubmit={handleSubmit}
              className="flex-1 flex items-center gap-2"
            >
              <div className="flex-1 border border-border rounded-full px-4 py-2 bg-muted/20 focus-within:border-primary/40 transition-colors">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={replyTo ? `Reply to ${replyTo.name}...` : "Write an echo..."}
                  autoComplete="off"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="p-2 text-primary hover:text-primary/80 disabled:opacity-30 transition-colors active:scale-95"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default EchoDrawer;
