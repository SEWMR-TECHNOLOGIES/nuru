import { useState } from 'react';
import { Heart, MessageCircle, UserPlus, Users, Loader2, Briefcase, CheckCircle, ShieldCheck, Lock, AlertTriangle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BellIcon from '@/assets/icons/bell-icon.svg';
import CalendarIcon from '@/assets/icons/calendar-icon.svg';
import IssueIcon from '@/assets/icons/issue-icon.svg';
import NuruLogo from '@/assets/nuru-logo.png';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useNotifications } from '@/data/useSocial';
import { Skeleton } from '@/components/ui/skeleton';
import { getTimeAgo } from '@/utils/getTimeAgo';

const getIcon = (type: string) => {
  switch (type) {
    case 'glow':
      return <span className="text-sm">❤️</span>;
    case 'comment':
    case 'echo':
      return <MessageCircle className="w-4 h-4 text-blue-500" />;
    case 'follow':
      return <UserPlus className="w-4 h-4 text-green-500" />;
    case 'circle_add':
    case 'circle_request':
    case 'circle_accepted':
      return <Users className="w-4 h-4 text-green-500" />;
    case 'event_invite':
    case 'committee_invite':
    case 'rsvp_received':
      return <img src={CalendarIcon} alt="Calendar" className="w-4 h-4" />;
    case 'booking_request':
    case 'booking_accepted':
    case 'booking_rejected':
      return <Briefcase className="w-4 h-4 text-orange-500" />;
    case 'contribution_received':
      return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    case 'moment_view':
    case 'moment_reaction':
      return <span className="text-sm">❤️</span>;
    case 'content_removed':
    case 'post_removed':
    case 'moment_removed':
      return <AlertTriangle className="w-4 h-4 text-destructive" />;
    case 'identity_verified':
    case 'kyc_approved':
      return <ShieldCheck className="w-4 h-4 text-green-500" />;
    case 'password_changed':
    case 'password_reset':
      return <Lock className="w-4 h-4 text-primary" />;
    case 'issue_response':
    case 'issue_resolved':
    case 'issue_closed':
    case 'issue_updated':
      return <img src={IssueIcon} alt="Issue" className="w-4 h-4 dark:invert" />;
    default:
      return <img src={BellIcon} alt="Notification" className="w-4 h-4" />;
  }
};

// Returns true for system/Nuru notifications (no actor or actor is the platform)
const isSystemNotification = (notification: any) => {
  return !notification.actor || notification.actor?.is_system === true;
};

const getInitials = (actor: any) => {
  if (!actor) return 'N';
  const f = actor.first_name?.[0] || '';
  const l = actor.last_name?.[0] || '';
  return (f + l) || 'N';
};

/** Returns a clickable path for the notification, or null if not navigable.
 *  Uses reference_id + reference_type from the backend API response. */
const getNavigationTarget = (notification: any): string | null => {
  const refId = notification.reference_id;
  const refType = notification.reference_type;
  const data = notification.data || {};
  const actorId = notification.actor?.id;

  switch (notification.type) {
    // ── Event-related ──
    case 'event_invite':
    case 'committee_invite':
    case 'rsvp_received':
    case 'contribution_received':
    case 'expense_recorded':
      if (refId && refType === 'event') return `/event/${refId}`;
      break;

    // ── Booking-related ──
    case 'booking_request':
    case 'booking_accepted':
    case 'booking_rejected':
      if (refId && refType === 'booking') return `/bookings/${refId}`;
      // Fallback: if reference is event, go to event
      if (refId && refType === 'event') return `/event/${refId}`;
      break;

    // ── Social / Post-related ──
    case 'glow':
    case 'comment':
    case 'echo':
    case 'mention':
      if (refId && refType === 'post') return `/post/${refId}`;
      break;

    // ── Follow / Circle ──
    case 'follow':
      if (actorId) return `/u/${notification.actor?.username || actorId}`;
      break;
    case 'circle_add':
      if (actorId) return `/u/${notification.actor?.username || actorId}`;
      break;
    case 'circle_request':
      return '/circle?tab=requests';
    case 'circle_accepted':
      if (actorId) return `/u/${notification.actor?.username || actorId}`;
      break;

    // ── Content removal ──
    case 'content_removed':
    case 'post_removed':
    case 'moment_removed':
      return '/removed-content';

    // ── Service / KYC ──
    case 'service_approved':
    case 'service_rejected':
    case 'kyc_approved':
      if (refId && refType === 'service') return `/service/${refId}`;
      return '/my-services';

    // ── Identity ──
    case 'identity_verified':
      return '/profile';

    // ── Security ──
    case 'password_changed':
    case 'password_reset':
      return '/settings';

    // ── Moment stories ──
    case 'moment_view':
    case 'moment_reaction':
      if (actorId) return `/u/${notification.actor?.username || actorId}`;
      break;

    // ── Issue responses ──
    case 'issue_response':
    case 'issue_resolved':
    case 'issue_closed':
    case 'issue_updated':
      if (refId && refType === 'issue') return `/my-issues?issue=${refId}`;
      return '/my-issues';

    default:
      // Generic fallback: use reference_type to determine route
      if (refId) {
        if (refType === 'event') return `/event/${refId}`;
        if (refType === 'post') return `/post/${refId}`;
        if (refType === 'booking') return `/bookings/${refId}`;
        if (refType === 'service') return `/service/${refId}`;
        if (refType === 'issue') return `/my-issues?issue=${refId}`;
        if (refType === 'user' && actorId) return `/u/${notification.actor?.username || actorId}`;
      }
      break;
  }
  return null;
};

/** Removed content types that show an image preview */
const REMOVED_CONTENT_TYPES = new Set(['content_removed', 'post_removed', 'moment_removed', 'feed_removed']);

const NotificationItem = ({ notification, onMarkRead }: { notification: any; onMarkRead: (id: string) => void }) => {
  const navigate = useNavigate();
  const navTarget = getNavigationTarget(notification);
  const isRemoved = REMOVED_CONTENT_TYPES.has(notification.type);
  const meta = notification.meta || {};

  const handleClick = () => {
    if (!notification.is_read) onMarkRead(notification.id);
    if (navTarget) navigate(navTarget);
  };

  return (
    <div
      onClick={handleClick}
      className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
        navTarget ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default'
      } ${!notification.is_read ? 'bg-muted/30' : ''}`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {isSystemNotification(notification) ? (
          <div className="w-10 h-10 rounded-full bg-[hsl(var(--nuru-yellow)/0.15)] border border-[hsl(var(--nuru-yellow)/0.3)] flex items-center justify-center overflow-hidden">
            <img src={NuruLogo} alt="Nuru" className="w-7 h-7 object-contain" />
          </div>
        ) : (
          <Avatar className="w-10 h-10">
            <AvatarImage src={notification.actor?.avatar} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {getInitials(notification.actor)}
            </AvatarFallback>
          </Avatar>
        )}
        {/* Icon badge */}
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center">
          {getIcon(notification.type)}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed">
          {isSystemNotification(notification) ? (
            <span className="font-semibold text-foreground">Nuru</span>
          ) : notification.actor ? (
            <span className="font-semibold text-foreground">
              {notification.actor.first_name} {notification.actor.last_name}
            </span>
          ) : null}{' '}
          <span className="text-muted-foreground">{notification.message}</span>
        </p>

        {/* Removed content media preview (non-clickable) */}
        {isRemoved && meta.media_url && (
          <div className="mt-2 w-20 h-14 rounded-lg overflow-hidden border border-border/50 relative">
            <img
              src={meta.media_url}
              alt="Removed content"
              className="w-full h-full object-cover opacity-50 grayscale"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
          </div>
        )}

        {/* Removed content caption preview */}
        {isRemoved && meta.caption && (
          <p className="mt-1 text-xs text-muted-foreground/70 italic truncate max-w-xs">
            "{meta.caption}"
          </p>
        )}

        {/* Navigate indicator */}
        {navTarget && (
          <div className="flex items-center gap-1 mt-1">
            <ExternalLink className="w-3 h-3 text-primary" />
            <span className="text-xs text-primary">Tap to view</span>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-0.5">
          {notification.created_at ? getTimeAgo(notification.created_at) : ''}
        </p>
      </div>

      {/* Unread dot */}
      {!notification.is_read && (
        <div className="w-2 h-2 bg-[hsl(var(--nuru-yellow))] rounded-full flex-shrink-0 mt-2" />
      )}
    </div>
  );
};

const Notifications = () => {
  useWorkspaceMeta({
    title: 'Notifications',
    description: 'Stay updated with glows, echoes, event invitations, and more on Nuru.'
  });

  const { notifications, unreadCount, loading, error, refetch, markAllRead, markRead } = useNotifications();
  const [markingRead, setMarkingRead] = useState(false);

  const handleMarkAllRead = async () => {
    setMarkingRead(true);
    await markAllRead();
    setMarkingRead(false);
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3 p-4 rounded-lg border border-border">
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <h1 className="text-xl md:text-2xl font-bold mb-4">Notifications</h1>
        <div className="text-center py-12">
          <p className="text-destructive mb-4">Failed to load notifications.</p>
          <Button onClick={() => refetch()} size="sm">Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
          )}
        </div>
        {notifications.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-sm text-muted-foreground"
            onClick={handleMarkAllRead}
            disabled={markingRead}
          >
            {markingRead ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Mark all read
          </Button>
        )}
      </div>
      
      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <img src={BellIcon} alt="Notifications" className="w-7 h-7" />
          </div>
          <h3 className="font-medium text-foreground mb-1">No notifications yet</h3>
          <p className="text-sm text-muted-foreground">
            We'll notify you when something happens
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={markRead}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
