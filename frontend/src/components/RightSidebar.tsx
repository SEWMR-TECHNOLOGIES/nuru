import { Calendar, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import graduationEventImage from '@/assets/upcoming-events/graduation.webp';
import venueImage from '@/assets/providers-categories/venue.webp';

const RightSidebar = () => {
  const upcomingEvents = [
    {
      id: 1,
      title: 'Wedding Ceremony',
      date: 'Sunday, August 10, 2024',
      image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=120&h=80&fit=crop'
    },
    {
      id: 2,
      title: 'Corporate Meeting',
      date: 'Thursday, August 10, 2024',
      image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=120&h=80&fit=crop'
    },
    {
      id: 3,
      title: 'Graduation Party',
      date: 'Saturday, August 24, 2024',
      image: graduationEventImage
    }
  ];

  const serviceProviders = [
    {
      id: 1,
      name: 'Catering',
      image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=120&h=120&fit=crop'
    },
    {
      id: 2,
      name: 'Photography',
      image: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=120&h=120&fit=crop'
    },
    {
      id: 3,
      name: 'Venue',
      image: venueImage
    },
    {
      id: 4,
      name: 'Decoration',
      image: 'https://images.unsplash.com/photo-1478146896981-b80fe463b330?w=120&h=120&fit=crop'
    }
  ];

  const friendSuggestions = [
    {
      id: 1,
      name: 'Sarah Johnson',
      mutualFriends: 5,
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 2,
      name: 'Mark Wilson',
      mutualFriends: 8,
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: 3,
      name: 'Lisa Chen',
      mutualFriends: 3,
      avatar: 'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?w=40&h=40&fit=crop&crop=face'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Upcoming Events */}
      <div className="bg-card rounded-lg p-4 border border-border">
        <h2 className="font-semibold text-foreground mb-4">Upcoming Events</h2>
        <div className="space-y-3">
          {upcomingEvents.map((event) => (
            <div key={event.id} className="flex gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors">
              <img
                src={event.image}
                alt={event.title}
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm text-foreground truncate">{event.title}</h3>
                <p className="text-xs text-muted-foreground">{event.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Service Providers */}
      <div className="bg-card rounded-lg p-4 border border-border">
        <h2 className="font-semibold text-foreground mb-4">Service Providers</h2>
        <div className="grid grid-cols-2 gap-3">
          {serviceProviders.map((provider) => (
            <div key={provider.id} className="text-center cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors">
              <img
                src={provider.image}
                alt={provider.name}
                className="w-16 h-16 rounded-lg object-cover mx-auto mb-2"
              />
              <p className="text-xs font-medium text-foreground">{provider.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Friend Suggestions */}
      <div className="bg-card rounded-lg p-4 border border-border">
        <h2 className="font-semibold text-foreground mb-4">People You May Know</h2>
        <div className="space-y-3">
          {friendSuggestions.map((friend) => (
            <div key={friend.id} className="flex items-center gap-3">
              <img
                src={friend.avatar}
                alt={friend.name}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm text-foreground">{friend.name}</h3>
                <p className="text-xs text-muted-foreground">{friend.mutualFriends} mutual friends</p>
              </div>
              <Button size="sm" variant="outline" className="text-xs">
                Add
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Promoted Events */}
      <div className="bg-card rounded-lg p-4 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Promoted Events</h2>
          <span className="text-xs text-muted-foreground">Sponsored</span>
        </div>
        <div className="space-y-4">
          <div className="cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors">
            <img
              src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=300&h=160&fit=crop"
              alt="Tech Conference"
              className="w-full h-24 rounded-lg object-cover mb-2"
            />
            <h3 className="font-medium text-sm text-foreground">Annual Tech Conference 2024</h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Calendar className="w-3 h-3" />
              <span>Oct 20, 2024</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span>Convention Center, Nairobi</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>324 attending</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RightSidebar;