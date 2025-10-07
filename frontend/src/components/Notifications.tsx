import { Bell, Heart, MessageCircle, UserPlus, Calendar, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const notifications = [
  {
    id: '1',
    type: 'glow',
    user: 'Sarah Johnson',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b5c5?w=150&h=150&fit=crop&crop=face',
    action: 'glowed your post',
    post: 'Sophia\'s Wedding Reception',
    time: '5 minutes ago',
    read: false
  },
  {
    id: '2',
    type: 'echo',
    user: 'Michael Chen',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    action: 'echoed on your post',
    post: 'Birthday Celebration',
    time: '2 hours ago',
    read: false
  },
  {
    id: '3',
    type: 'follow',
    user: 'Emily Davis',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    action: 'started following you',
    time: '5 hours ago',
    read: true
  },
  {
    id: '4',
    type: 'event',
    user: 'David Wilson',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    action: 'invited you to',
    post: 'Graduation Party 2025',
    time: '1 day ago',
    read: true
  },
  {
    id: '5',
    type: 'glow',
    user: 'Jessica Lee',
    avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face',
    action: 'and 3 others glowed your post',
    post: 'Memorial Service',
    time: '2 days ago',
    read: true
  }
];

const getIcon = (type: string) => {
  switch (type) {
    case 'glow':
      return <Heart className="w-4 h-4 text-red-500" />;
    case 'echo':
      return <MessageCircle className="w-4 h-4 text-blue-500" />;
    case 'follow':
      return <UserPlus className="w-4 h-4 text-green-500" />;
    case 'event':
      return <Calendar className="w-4 h-4 text-purple-500" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
};

const Notifications = () => (
  <div className="h-full overflow-y-auto p-4 md:p-6">
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl md:text-3xl font-bold">Notifications</h1>
      <Button variant="ghost" size="sm" className="text-sm">
        Mark all as read
      </Button>
    </div>
    
    <div className="space-y-3">
      {notifications.map((notification) => (
        <Card 
          key={notification.id}
          className={`hover:border-primary/50 transition-all cursor-pointer ${
            !notification.read ? 'border-l-4 border-l-[hsl(var(--nuru-yellow))]' : ''
          }`}
        >
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Avatar className="w-12 h-12 flex-shrink-0">
                <AvatarImage src={notification.avatar} />
                <AvatarFallback>{notification.user.charAt(0)}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    {getIcon(notification.type)}
                    <p className="text-sm leading-relaxed">
                      <span className="font-semibold">{notification.user}</span>{' '}
                      <span className="text-muted-foreground">{notification.action}</span>
                      {notification.post && (
                        <span className="font-medium"> {notification.post}</span>
                      )}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2.5 h-2.5 bg-[hsl(var(--nuru-yellow))] rounded-full flex-shrink-0 mt-1" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{notification.time}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
)

export default Notifications
