import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, FileText, Video, ChevronRight, Clock, CheckCircle, XCircle, Send, Heart, MessageSquare, RefreshCw, Eye, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/api';

type RemovedItem = {
  id: string;
  type: 'post' | 'moment';
  // Post fields
  content?: string;
  images?: string[];
  glow_count?: number;
  echo_count?: number;
  comment_count?: number;
  visibility?: string;
  // Moment fields
  caption?: string;
  media_url?: string;
  content_type?: string;
  viewer_count?: number;
  // Common
  location?: string;
  author?: { id: string; name: string; username: string; avatar?: string };
  removal_reason?: string;
  removed_at?: string;
  created_at?: string;
  appeal?: {
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    admin_notes?: string;
    created_at?: string;
  } | null;
};

const appealStatusConfig = {
  pending:  { label: 'Under Review', icon: Clock,         className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  approved: { label: 'Approved',     icon: CheckCircle,   className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  rejected: { label: 'Rejected',     icon: XCircle,       className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

function AppealBadge({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const cfg = appealStatusConfig[status];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${cfg.className}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
}

function RemovedCard({ item, onAppealSubmitted }: { item: RemovedItem; onAppealSubmitted: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAppeal = async () => {
    if (reason.trim().length < 10) {
      toast.error('Please write at least 10 characters explaining your appeal.');
      return;
    }
    setSubmitting(true);
    try {
      const res = item.type === 'post'
        ? await api.social.submitPostAppeal(item.id, reason.trim())
        : await api.social.submitMomentAppeal(item.id, reason.trim());
      if (res.success) {
        toast.success('Appeal submitted! Our team will review it shortly.');
        setOpen(false);
        onAppealSubmitted();
      } else {
        toast.error(res.message || 'Failed to submit appeal.');
      }
    } catch {
      toast.error('Unable to submit appeal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canAppeal = !item.appeal;
  const daysLeft = item.removed_at
    ? Math.max(0, 7 - Math.floor((Date.now() - new Date(item.removed_at).getTime()) / 86_400_000))
    : null;

  // Determine media to display
  const images = item.type === 'post' ? (item.images || []) : (item.media_url ? [item.media_url] : []);
  const isVideo = item.content_type === 'video';
  const displayText = item.type === 'post' ? item.content : item.caption;

  return (
    <div className="border border-border rounded-xl p-4 bg-card space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {item.type === 'post'
            ? <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            : <Video className="w-4 h-4 text-muted-foreground shrink-0" />}
          <span className="text-sm font-medium text-foreground capitalize">{item.type}</span>
          {item.content_type && item.type === 'moment' && (
            <Badge variant="secondary" className="text-xs">{item.content_type}</Badge>
          )}
          {item.author && (
            <span className="text-xs text-muted-foreground truncate">by {item.author.name}</span>
          )}
        </div>
        {item.appeal
          ? <AppealBadge status={item.appeal.status} />
          : daysLeft !== null && (
            <Badge variant="outline" className="text-xs text-muted-foreground shrink-0">
              {daysLeft > 0 ? `${daysLeft}d to appeal` : 'Expires today'}
            </Badge>
          )}
      </div>

      {/* Text content */}
      {displayText && (
        <p className="text-sm text-foreground line-clamp-3 bg-muted/50 rounded-lg px-3 py-2">
          {displayText}
        </p>
      )}

      {/* Media */}
      {images.length > 0 && (
        <div className={`grid gap-1 rounded-lg overflow-hidden ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {images.slice(0, 6).map((url, i) => (
            <div key={i} className="relative bg-muted aspect-square overflow-hidden">
              {isVideo && i === 0
                ? <video src={url} className="w-full h-full object-cover" controls />
                : <img src={url} alt={`Media ${i + 1}`} className="w-full h-full object-cover" />
              }
              {images.length > 6 && i === 5 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-lg">
                  +{images.length - 6}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Location */}
      {item.location && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3" /> {item.location}
        </div>
      )}

      {/* Engagement stats */}
      {item.type === 'post' && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="text-xs">❤️</span> {item.glow_count ?? 0} glows</span>
          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {item.comment_count ?? 0} echoes</span>
          <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> {item.echo_count ?? 0} reposts</span>
        </div>
      )}
      {item.type === 'moment' && (item.viewer_count ?? 0) > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Eye className="w-3 h-3" /> {item.viewer_count} views
        </div>
      )}

      {/* Removal reason */}
      {item.removal_reason && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 space-y-1">
          <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Removal Reason</p>
          <p className="text-sm text-foreground">{item.removal_reason}</p>
        </div>
      )}

      {/* Appeal result */}
      {item.appeal?.admin_notes && (
        <div className={`rounded-lg border px-3 py-2 space-y-1 ${
          item.appeal.status === 'approved'
            ? 'border-green-500/20 bg-green-500/5'
            : 'border-destructive/20 bg-destructive/5'
        }`}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admin Response</p>
          <p className="text-sm text-foreground">{item.appeal.admin_notes}</p>
        </div>
      )}

      {/* Appeal CTA */}
      {canAppeal && daysLeft !== null && daysLeft > 0 && (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/5"
            onClick={() => setOpen(!open)}
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
            {open ? 'Cancel Appeal' : 'Submit Appeal'}
          </Button>

          {open && (
            <div className="space-y-2">
              <Textarea
                placeholder="Explain why this content should be restored (min. 10 characters)..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
              <Button
                size="sm"
                className="w-full gap-2"
                onClick={handleAppeal}
                disabled={submitting || reason.trim().length < 10}
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : 'Send Appeal'}
              </Button>
            </div>
          )}
        </div>
      )}

      {!canAppeal && item.appeal?.status === 'pending' && (
        <p className="text-xs text-muted-foreground text-center">Appeal is under review — we'll notify you of the decision.</p>
      )}
    </div>
  );
}

// Module-level cache to prevent re-fetching on navigation
let _cachedPosts: any[] | null = null;
let _cachedMoments: any[] | null = null;

export default function RemovedContent() {
  const [posts, setPosts] = useState<RemovedItem[]>(_cachedPosts as any || []);
  const [moments, setMoments] = useState<RemovedItem[]>(_cachedMoments as any || []);
  const [loading, setLoading] = useState(!_cachedPosts);
  const [activeTab, setActiveTab] = useState<'posts' | 'moments'>('posts');
  const initialLoad = useRef(!_cachedPosts);

  const fetchData = async () => {
    try {
      const [postsRes, momentsRes] = await Promise.all([
        api.social.getMyRemovedPosts(),
        api.social.getMyRemovedMoments(),
      ]);
      const p = (postsRes.data || []).map((x: any) => ({ ...x, type: 'post' as const }));
      const mo = (momentsRes.data || []).map((x: any) => ({ ...x, type: 'moment' as const }));
      _cachedPosts = p;
      _cachedMoments = mo;
      setPosts(p);
      setMoments(mo);
    } catch {
      toast.error('Failed to load removed content.');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      fetchData();
    }
  }, []);

  const handleRefresh = () => {
    _cachedPosts = null;
    _cachedMoments = null;
    initialLoad.current = true;
    setLoading(true);
    fetchData();
  };

  const items = activeTab === 'posts' ? posts : moments;
  const total = posts.length + moments.length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h1 className="text-xl font-bold text-foreground">Removed Content</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Content removed by our team. You have <strong>7 days</strong> from removal to submit an appeal before it's permanently deleted.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-muted rounded-lg p-1 gap-1">
        {(['posts', 'moments'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {(tab === 'posts' ? posts : moments).length > 0 && (
              <span className="ml-1.5 bg-destructive/15 text-destructive text-xs rounded-full px-1.5 py-0.5">
                {(tab === 'posts' ? posts : moments).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="border border-border rounded-xl p-4 animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-12 bg-muted rounded" />
              <div className="h-8 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <CheckCircle className="w-12 h-12 text-primary mx-auto" />
          <p className="font-semibold text-foreground">No removed {activeTab}</p>
          <p className="text-sm text-muted-foreground">All your {activeTab} are in good standing.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <RemovedCard key={item.id} item={item} onAppealSubmitted={handleRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}
