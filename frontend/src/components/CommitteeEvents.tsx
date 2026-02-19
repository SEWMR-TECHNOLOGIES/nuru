import { useState, useEffect, useCallback } from 'react';
import { Clock, Users, Shield, Loader2, Timer } from 'lucide-react';
import CalendarIcon from '@/assets/icons/calendar-icon.svg';
import LocationIcon from '@/assets/icons/location-icon.svg';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { eventsApi } from '@/lib/api/events';
import { getEventCountdown } from '@/utils/getEventCountdown';

const PERMISSION_LABELS: Record<string, string> = {
  can_view_guests: 'View Guests',
  can_manage_guests: 'Manage Guests',
  can_send_invitations: 'Send Invitations',
  can_check_in_guests: 'Check-in Guests',
  can_view_budget: 'View Budget',
  can_manage_budget: 'Manage Budget',
  can_view_contributions: 'View Contributions',
  can_manage_contributions: 'Manage Contributions',
  can_view_vendors: 'View Vendors',
  can_manage_vendors: 'Manage Vendors',
  can_approve_bookings: 'Approve Bookings',
  can_edit_event: 'Edit Event',
  can_manage_committee: 'Manage Committee',
};

const CommitteeEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommittee = useCallback(async () => {
    setLoading(true);
    try {
      const response = await eventsApi.getCommitteeEvents();
      if (response.success) {
        setEvents(response.data?.events || []);
      } else {
        setError(response.message);
      }
    } catch {
      setError('Failed to load committee events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCommittee(); }, [fetchCommittee]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="bg-card rounded-lg border border-border p-4">
            <div className="flex gap-4">
              <Skeleton className="w-32 h-24 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={fetchCommittee}>Retry</Button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">You are not a committee member for any events.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const cm = event.committee_membership;
        const activePerms = cm?.permissions
          ? Object.entries(cm.permissions).filter(([_, v]) => v === true).map(([k]) => k)
          : [];
        const eventStatus = event.status || 'draft';

        return (
          <article
            key={event.id}
            className="bg-card rounded-lg border border-border hover:bg-muted/10 transition-colors cursor-pointer relative"
            onClick={() => navigate(`/event-management/${event.id}`)}
          >
            {/* Diagonal STATUS badge (not role) */}
            <div className="absolute top-0 right-0 z-10 overflow-hidden rounded-tr-lg" style={{ width: '90px', height: '90px', pointerEvents: 'none' }}>
              <div className={`absolute ${eventStatus === 'confirmed' || eventStatus === 'published' ? 'bg-green-500' : eventStatus === 'cancelled' ? 'bg-red-500' : eventStatus === 'completed' ? 'bg-blue-500' : 'bg-amber-500'}`}
                style={{
                  width: '140px', textAlign: 'center', transform: 'rotate(45deg)',
                  top: '16px', right: '-36px',
                  padding: '3px 0', fontSize: '10px', fontWeight: 600, color: 'white', letterSpacing: '0.5px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}
              >
                {eventStatus.charAt(0).toUpperCase() + eventStatus.slice(1)}
              </div>
            </div>
            <div className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {(() => {
                  const coverImage = event.cover_image
                    || (event.images?.length > 0 ? (event.images.find((img: any) => img.is_featured)?.image_url || event.images[0]?.image_url || event.images[0]?.url || (typeof event.images[0] === 'string' ? event.images[0] : null)) : null)
                    || (event.gallery_images?.length > 0 ? event.gallery_images[0] : null)
                    || event.cover_image_url
                    || event.image_url;
                  return coverImage ? (
                    <div className="w-full sm:w-32 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted/10">
                      <img src={coverImage} alt={event.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full sm:w-32 h-24 flex-shrink-0 rounded-lg bg-muted/10" />
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-base text-foreground">{event.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {event.event_type && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                            {event.event_type.name}
                          </span>
                        )}
                        {/* Role shown as inline badge on the card */}
                        {cm?.role && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium">
                            <Shield className="w-3 h-3" />
                            {cm.role}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-3">
                    {event.start_date && (
                      <span className="flex items-center gap-1">
                        <img src={CalendarIcon} alt="Calendar" className="w-4 h-4" />
                        {new Date(event.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    )}
                    {(() => {
                      const countdown = getEventCountdown(event.start_date);
                      if (!countdown) return null;
                      return (
                        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${countdown.isPast ? 'bg-muted text-muted-foreground' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                          <Timer className="w-3 h-3" />
                          {countdown.text}
                        </span>
                      );
                    })()}
                    {event.start_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {event.start_time}
                      </span>
                    )}
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <img src={LocationIcon} alt="Location" className="w-4 h-4" />
                        {event.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {event.guest_count || 0} guests
                    </span>
                  </div>

                  {event.organizer?.name && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Organized by <span className="font-medium text-foreground">{event.organizer.name}</span>
                    </p>
                  )}

                  {activePerms.length > 0 && (
                    <TooltipProvider>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {activePerms.slice(0, 4).map((perm) => (
                          <Tooltip key={perm}>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs">
                                {PERMISSION_LABELS[perm] || perm}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{PERMISSION_LABELS[perm] || perm}</TooltipContent>
                          </Tooltip>
                        ))}
                        {activePerms.length > 4 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs">
                                +{activePerms.length - 4} more
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {activePerms.slice(4).map(p => PERMISSION_LABELS[p] || p).join(', ')}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default CommitteeEvents;
