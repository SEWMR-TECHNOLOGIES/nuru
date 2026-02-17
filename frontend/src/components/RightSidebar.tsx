import { useState, useEffect, useMemo } from 'react';
import { Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CalendarIcon from '@/assets/icons/calendar-icon.svg';
import LocationIcon from '@/assets/icons/location-icon.svg';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useEvents } from '@/data/useEvents';
import { useServices } from '@/data/useUserServices';
import { useFollowSuggestions } from '@/data/useSocial';
import { eventsApi } from '@/lib/api/events';

// Empty card placeholder for upcoming features
const EmptyCard = ({ title, count = 3 }: { title: string; count?: number }) => (
  <div className="bg-card rounded-lg p-4 border border-border">
    <h2 className="font-semibold text-foreground mb-4">{title}</h2>
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 p-2 rounded-lg border border-dashed border-border/50">
          <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center">
            <div className="w-6 h-6 rounded bg-muted" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-3 w-3/4 bg-muted/50 rounded" />
            <div className="h-2 w-1/2 bg-muted/30 rounded" />
          </div>
        </div>
      ))}
    </div>
    <p className="text-xs text-muted-foreground text-center mt-3">Coming soon</p>
  </div>
);

// Loading skeleton for sidebar cards
const SidebarCardSkeleton = ({ title, count = 3 }: { title: string; count?: number }) => (
  <div className="bg-card rounded-lg p-4 border border-border">
    <h2 className="font-semibold text-foreground mb-4">{title}</h2>
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 p-2 rounded-lg">
          <Skeleton className="w-12 h-12 rounded-lg" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

interface UpcomingEvent {
  id: string;
  title: string;
  start_date?: string;
  cover_image?: string;
  status?: string;
  role: 'creator' | 'committee' | 'guest';
}

const ROLE_LABELS: Record<string, string> = {
  creator: 'My Event',
  committee: 'Committee',
  guest: 'Invited',
};

const RightSidebar = () => {
  const navigate = useNavigate();
  const { events, loading: eventsLoading } = useEvents();
  const { services, loading: servicesLoading } = useServices();
  const { suggestions, loading: suggestionsLoading } = useFollowSuggestions(3);

  const [committeeEvents, setCommitteeEvents] = useState<any[]>([]);
  const [invitedEvents, setInvitedEvents] = useState<any[]>([]);
  const [extraLoading, setExtraLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchExtra = async () => {
      try {
        const [commRes, invRes] = await Promise.all([
          eventsApi.getCommitteeEvents({ limit: 5 }),
          eventsApi.getInvitedEvents({ limit: 5 }),
        ]);
        if (cancelled) return;
        if (commRes.success) setCommitteeEvents(commRes.data.events || []);
        if (invRes.success) setInvitedEvents(invRes.data.events || []);
      } catch { /* silent */ }
      finally { if (!cancelled) setExtraLoading(false); }
    };
    fetchExtra();
    return () => { cancelled = true; };
  }, []);

  // Merge & deduplicate events by ID, prioritizing creator > committee > guest
  // Filter out: past events, declined/cancelled invitations
  const now = new Date();
  const upcomingEvents = useMemo<UpcomingEvent[]>(() => {
    const map = new Map<string, UpcomingEvent>();

    for (const ev of (events || [])) {
      map.set(ev.id, { id: ev.id, title: ev.title, start_date: ev.start_date, cover_image: ev.cover_image, status: ev.status, role: 'creator' });
    }
    for (const ev of committeeEvents) {
      if (!map.has(ev.id)) {
        const img = ev.cover_image || (ev.images?.length > 0 ? (ev.images.find((i: any) => i.is_featured)?.image_url || ev.images[0]?.image_url || ev.images[0]?.url) : null) || ev.cover_image_url;
        map.set(ev.id, { id: ev.id, title: ev.title || ev.name, start_date: ev.start_date, cover_image: img, status: ev.status, role: 'committee' });
      }
    }
    for (const ev of invitedEvents) {
      if (!map.has(ev.id)) {
        const rsvpStatus = (ev.rsvp_status || ev.invitation_status || '').toLowerCase();
        // Skip declined/rejected invitations
        if (['declined', 'rejected', 'not_attending'].includes(rsvpStatus)) continue;
        map.set(ev.id, { id: ev.id, title: ev.title || ev.name, start_date: ev.start_date, cover_image: ev.cover_image || ev.cover_image_url, status: ev.status, role: 'guest' });
      }
    }

    return Array.from(map.values())
      .filter((ev) => {
        // Exclude past events
        if (ev.start_date && new Date(ev.start_date) < now) return false;
        // Exclude cancelled events
        if (ev.status?.toLowerCase() === 'cancelled') return false;
        return true;
      })
      .sort((a, b) => {
        if (!a.start_date) return 1;
        if (!b.start_date) return -1;
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      });
  }, [events, committeeEvents, invitedEvents]);

  const displayedEvents = upcomingEvents.slice(0, 6);
  const hasMoreEvents = upcomingEvents.length > 6;

  const allLoading = (eventsLoading || extraLoading) && displayedEvents.length === 0;

  // Track if we've ever loaded data to avoid skeleton flicker on re-mount
  const hasLoadedServices = services.length > 0 || !servicesLoading;
  const hasLoadedSuggestions = suggestions.length > 0 || !suggestionsLoading;

  return (
    <div className="space-y-6">
      {/* Upcoming Events */}
      {allLoading ? (
        <SidebarCardSkeleton title="Upcoming Events" count={3} />
      ) : displayedEvents.length > 0 ? (
        <div className="bg-card rounded-lg p-4 border border-border">
          <h2 className="font-semibold text-foreground mb-4">Upcoming Events</h2>
          <div className="space-y-3">
            {displayedEvents.map((event) => {
              const roleLabel = ROLE_LABELS[event.role];
              const roleBg = event.role === 'creator' ? 'bg-primary' : event.role === 'committee' ? 'bg-amber-500' : 'bg-blue-500';
              return (
              <div key={event.id} className="flex gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                onClick={() => navigate(event.role === 'guest' ? `/event/${event.id}` : `/event-management/${event.id}`)}
              >
                <div className="relative w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {event.cover_image ? (
                    <img src={event.cover_image} alt={event.title} className="w-full h-full object-cover" />
                  ) : (
                    <img src={CalendarIcon} alt="Calendar" className="w-5 h-5" />
                  )}
                  <span className={`absolute bottom-0 left-0 right-0 text-[7px] font-semibold text-white text-center py-0.5 ${roleBg}`}>
                    {roleLabel}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-foreground truncate">{event.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {event.start_date ? new Date(event.start_date).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    }) : 'Date TBD'}
                  </p>
                </div>
              </div>
              );
            })}
          </div>
          {hasMoreEvents && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-xs text-primary hover:text-primary/80"
              onClick={() => navigate('/my-events')}
            >
              View all events →
            </Button>
          )}
        </div>
      ) : (
        <EmptyCard title="Upcoming Events" count={3} />
      )}

      {/* Service Providers */}
      {servicesLoading && !hasLoadedServices ? (
        <SidebarCardSkeleton title="Service Providers" count={4} />
      ) : services.length > 0 ? (
        <div className="bg-card rounded-lg p-4 border border-border">
          <h2 className="font-semibold text-foreground mb-4">Service Providers</h2>
          <div className="grid grid-cols-2 gap-3">
            {services.slice(0, 4).map((service: any) => {
              // Try all possible image field variations from the API
              const imgUrl = service.primary_image?.thumbnail_url 
                || service.primary_image?.url 
                || service.primary_image 
                || service.images?.[0]?.thumbnail_url 
                || service.images?.[0]?.url 
                || service.images?.[0]
                || service.cover_image
                || service.image_url
                || service.media?.[0]?.url
                || service.media?.[0]?.thumbnail_url;
              const title = service.title || service.name || service.service_category?.name || 'Service';
              const initials = title.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={service.id} className="text-center cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors">
                  <div className="w-16 h-16 rounded-lg bg-muted mx-auto mb-2 overflow-hidden flex items-center justify-center">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-muted-foreground">{initials}</span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-foreground capitalize line-clamp-2">{title}</p>
                  {service.provider?.name && (
                    <p className="text-[10px] text-muted-foreground truncate">{service.provider.name}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-lg p-4 border border-border">
          <h2 className="font-semibold text-foreground mb-4">Service Providers</h2>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="text-center p-2 rounded-lg border border-dashed border-border/50">
                <div className="w-16 h-16 rounded-lg bg-muted/50 mx-auto mb-2 flex items-center justify-center">
                  <div className="w-8 h-8 rounded bg-muted" />
                </div>
                <div className="h-3 w-12 bg-muted/50 rounded mx-auto" />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">No providers yet</p>
        </div>
      )}

      {/* Friend Suggestions / People You May Know — only shown when there are results */}
      {suggestionsLoading && !hasLoadedSuggestions ? (
        <SidebarCardSkeleton title="People You May Know" count={3} />
      ) : suggestions.length > 0 ? (
        <div className="bg-card rounded-lg p-4 border border-border">
          <h2 className="font-semibold text-foreground mb-4">People You May Know</h2>
          <div className="space-y-3">
            {suggestions.map((user) => (
              <div key={user.id} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.first_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">
                      {user.first_name?.[0]}{user.last_name?.[0]}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-foreground">
                    {user.first_name} {user.last_name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {(user as any).mutual_count || 0} mutual friends
                  </p>
                </div>
                <Button size="sm" variant="outline" className="text-xs">
                  Add
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Promoted Events - Empty placeholder */}
      <div className="bg-card rounded-lg p-4 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Promoted Events</h2>
          <span className="text-xs text-muted-foreground">Sponsored</span>
        </div>
        <div className="space-y-4">
          <div className="p-3 rounded-lg border border-dashed border-border/50">
            <div className="w-full h-24 rounded-lg bg-muted/50 mb-3 flex items-center justify-center">
              <img src={CalendarIcon} alt="Calendar" className="w-8 h-8 opacity-50" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-3/4 bg-muted/50 rounded" />
              <div className="flex items-center gap-1">
                <img src={CalendarIcon} alt="Calendar" className="w-3 h-3 opacity-50" />
                <div className="h-3 w-20 bg-muted/30 rounded" />
              </div>
              <div className="flex items-center gap-1">
                <img src={LocationIcon} alt="Location" className="w-3 h-3 opacity-50" />
                <div className="h-3 w-24 bg-muted/30 rounded" />
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 text-muted" />
                <div className="h-3 w-16 bg-muted/30 rounded" />
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">No promoted events</p>
      </div>
    </div>
  );
};

export default RightSidebar;
