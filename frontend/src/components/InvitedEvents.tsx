import { useState, useEffect, useCallback } from 'react';
import { Calendar, MapPin, Clock, CheckCircle, XCircle, HelpCircle, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { eventsApi } from '@/lib/api/events';
import { toast } from 'sonner';
import InvitationCard from './InvitationCard';

const rsvpStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  declined: 'bg-destructive/10 text-destructive',
  maybe: 'bg-blue-100 text-blue-800',
};

const rsvpIcons: Record<string, any> = {
  pending: HelpCircle,
  confirmed: CheckCircle,
  declined: XCircle,
  maybe: HelpCircle,
};

const InvitedEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const fetchInvited = useCallback(async () => {
    setLoading(true);
    try {
      const response = await eventsApi.getInvitedEvents();
      if (response.success) {
        setEvents(response.data?.events || []);
      } else {
        setError(response.message);
      }
    } catch {
      setError('Failed to load invited events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvited(); }, [fetchInvited]);

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
        <Button onClick={fetchInvited}>Retry</Button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">You haven't been invited to any events yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {events.map((event) => {
          const rsvpStatus = event.invitation?.rsvp_status || 'pending';
          const RsvpIcon = rsvpIcons[rsvpStatus] || HelpCircle;

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
                      <Badge className={rsvpStyles[rsvpStatus]}>
                        <RsvpIcon className="w-3 h-3 mr-1" />
                        {rsvpStatus.charAt(0).toUpperCase() + rsvpStatus.slice(1)}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-3">
                      {event.start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
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
                          <MapPin className="w-4 h-4" />
                          {event.location}
                        </span>
                      )}
                    </div>

                    {event.organizer?.name && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Organized by <span className="font-medium text-foreground">{event.organizer.name}</span>
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEventId(event.id);
                        }}
                      >
                        <Printer className="w-4 h-4 mr-1" />
                        Invitation Card
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {selectedEventId && (
        <InvitationCard
          eventId={selectedEventId}
          open={!!selectedEventId}
          onClose={() => setSelectedEventId(null)}
        />
      )}
    </>
  );
};

export default InvitedEvents;
