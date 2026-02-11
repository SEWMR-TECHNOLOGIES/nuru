import { useState } from 'react';
import { Heart, MessageCircle, UserPlus, Loader2, Users, Briefcase, CheckCircle, Trash2 } from 'lucide-react';
import BellIcon from '@/assets/icons/bell-icon.svg';
import CalendarIcon from '@/assets/icons/calendar-icon.svg';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useNotifications } from '@/data/useSocial';
import { Skeleton } from '@/components/ui/skeleton';
import { getTimeAgo } from '@/utils/getTimeAgo';

const getIcon = (type: string) => {
  switch (type) {
    case 'glow':
      return <Heart className="w-4 h-4 text-red-500" />;
    case 'comment':
    case 'echo':
      return <MessageCircle className="w-4 h-4 text-blue-500" />;
    case 'follow':
    case 'circle_add':
      return <UserPlus className="w-4 h-4 text-green-500" />;
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
      return <Heart className="w-4 h-4 text-pink-500" />;
    default:
      return <img src={BellIcon} alt="Notification" className="w-4 h-4" />;
  }
};

const getInitials = (actor: any) => {
  if (!actor) return 'N';
  const f = actor.first_name?.[0] || '';
  const l = actor.last_name?.[0] || '';
  return (f + l) || 'N';
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
            <div 
              key={notification.id}
              onClick={() => !notification.is_read && markRead(notification.id)}
              className={`flex items-start gap-3 p-3 rounded-lg transition-colors hover:bg-muted/50 cursor-pointer ${
                !notification.is_read ? 'bg-muted/30' : ''
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={notification.actor?.avatar} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(notification.actor)}
                  </AvatarFallback>
                </Avatar>
                {/* Icon badge */}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center">
                  {getIcon(notification.type)}
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed">
                  {notification.actor && (
                    <span className="font-semibold text-foreground">
                      {notification.actor.first_name} {notification.actor.last_name}
                    </span>
                  )}{' '}
                  <span className="text-muted-foreground">{notification.message}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {notification.created_at ? getTimeAgo(notification.created_at) : ''}
                </p>
              </div>

              {/* Unread dot */}
              {!notification.is_read && (
                <div className="w-2 h-2 bg-[hsl(var(--nuru-yellow))] rounded-full flex-shrink-0 mt-2" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
