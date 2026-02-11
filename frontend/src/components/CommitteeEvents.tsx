import { useState, useEffect, useCallback } from 'react';
import { Clock, Users, Shield, Loader2 } from 'lucide-react';
import CalendarIcon from '@/assets/icons/calendar-icon.svg';
import LocationIcon from '@/assets/icons/location-icon.svg';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { eventsApi } from '@/lib/api/events';

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

        return (
          <article
            key={event.id}
            className="bg-card rounded-lg border border-border overflow-hidden hover:bg-muted/10 transition-colors cursor-pointer"
            onClick={() => navigate(`/event-management/${event.id}`)}
          >
            <div className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {event.cover_image && (
                  <div className="w-full sm:w-32 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted/10">
                    <img src={event.cover_image} alt={event.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-lg text-foreground">{event.title}</h3>
                      {event.event_type && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium mt-1">
                          {event.event_type.name}
                        </span>
                      )}
                    </div>
                    <Badge className="bg-primary/10 text-primary">
                      <Shield className="w-3 h-3 mr-1" />
                      {cm?.role || 'Committee Member'}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-3">
                    {event.start_date && (
                      <span className="flex items-center gap-1">
                        <img src={CalendarIcon} alt="Calendar" className="w-4 h-4" />
                        {new Date(event.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    )}
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
