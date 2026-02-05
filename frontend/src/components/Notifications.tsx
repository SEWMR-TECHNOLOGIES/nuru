import { Bell, Heart, MessageCircle, UserPlus, Calendar, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useNotifications, useMarkAllNotificationsRead } from '@/data/useSocial';
import { Skeleton } from '@/components/ui/skeleton';

const getIcon = (type: string) => {
  switch (type) {
    case 'glow':
    case 'like':
      return <Heart className="w-4 h-4 text-red-500" />;
    case 'echo':
    case 'comment':
      return <MessageCircle className="w-4 h-4 text-blue-500" />;
    case 'follow':
      return <UserPlus className="w-4 h-4 text-green-500" />;
    case 'event':
    case 'invitation':
      return <Calendar className="w-4 h-4 text-purple-500" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
};

const Notifications = () => {
  useWorkspaceMeta({
    title: 'Notifications',
    description: 'Stay updated with glows, echoes, event invitations, and more on Nuru.'
  });

  const { notifications, loading, error, refetch } = useNotifications();
  const { markAllAsRead, loading: markingRead } = useMarkAllNotificationsRead();

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      refetch();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Notifications</h1>
        </div>
        <div className="text-center py-12">
          <p className="text-destructive mb-4">Failed to load notifications. Please try again.</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Notifications</h1>
        {notifications.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-sm"
            onClick={handleMarkAllRead}
            disabled={markingRead}
          >
            {markingRead ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Mark all as read
          </Button>
        )}
      </div>
      
      {notifications.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No notifications yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            We'll notify you when something happens
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card 
              key={notification.id}
              className={`hover:border-primary/50 transition-all cursor-pointer ${
                !notification.is_read ? 'border-l-4 border-l-[hsl(var(--nuru-yellow))]' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Avatar className="w-12 h-12 flex-shrink-0">
                    <AvatarImage src={notification.actor?.avatar} />
                    <AvatarFallback>
                      {notification.actor?.first_name?.charAt(0) || 'N'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {getIcon(notification.type)}
                        <p className="text-sm leading-relaxed">
                          {notification.actor && (
                            <span className="font-semibold">
                              {notification.actor.first_name} {notification.actor.last_name}
                            </span>
                          )}{' '}
                          <span className="text-muted-foreground">{notification.message}</span>
                        </p>
                      </div>
                      {!notification.is_read && (
                        <div className="w-2.5 h-2.5 bg-[hsl(var(--nuru-yellow))] rounded-full flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {notification.created_at 
                        ? new Date(notification.created_at).toLocaleDateString()
                        : ''}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
