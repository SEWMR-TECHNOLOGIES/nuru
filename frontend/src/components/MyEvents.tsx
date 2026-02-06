import { Calendar, Users, Edit2, Trash2 } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useEvents, useDeleteEvent } from '@/data/useEvents';
import { formatPrice } from '@/utils/formatPrice';
import { Skeleton } from '@/components/ui/skeleton';

const MyEvents = () => {
  useWorkspaceMeta({
    title: 'My Events',
    description: 'Manage all your events including weddings, birthdays, memorials, and celebrations.'
  });

  const navigate = useNavigate();
  const { events, loading, error, refetch } = useEvents();
  const { deleteEvent, loading: deleting } = useDeleteEvent();

  const statusStyles: Record<string, string> = {
    Upcoming: "bg-primary/10 text-primary",
    Completed: "bg-green-100 text-green-800",
    Draft: "bg-gray-100 text-gray-800",
    draft: "bg-gray-100 text-gray-800",
    published: "bg-primary/10 text-primary",
    cancelled: "bg-red-100 text-red-800",
    completed: "bg-green-100 text-green-800"
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEvent(id);
      refetch();
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  const formatBudget = (budget: string | number | undefined) => {
    if (!budget) return '';
    if (typeof budget === 'number') return formatPrice(budget);
    const amount = budget.replace(/[^0-9]/g, '');
    if (!amount) return '';
    return formatPrice(parseInt(amount));
  };

  const getEventStatus = (event: any) => {
    return event.status?.charAt(0).toUpperCase() + event.status?.slice(1) || 'Upcoming';
  };

  const getEventImage = (event: any) => {
    if (event.cover_image) return event.cover_image;
    if (event.images && event.images.length > 0) {
      const featured = event.images.find((img: any) => img.is_featured);
      return featured ? featured.image_url : event.images[0].image_url;
    }
    if (event.gallery_images && event.gallery_images.length > 0) return event.gallery_images[0];
    return null;
  };

  const getEventDate = (event: any) => {
    return event.date || event.start_date;
  };

  const getEventGuests = (event: any) => {
    return event.expectedGuests || event.guest_count || event.attendees || 0;
  };

  const getEventType = (event: any) => {
    return event.eventType || event.event_type?.name || event.type;
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">My Events</h1>
          <Button 
            size="sm" 
            className="rounded-lg px-3 py-1"
            onClick={() => navigate('/create-event')}
          >
            + New Event
          </Button>
        </div>
        <div className="mt-8 text-center">
          <p className="text-destructive mb-4">Failed to load events. Please try again.</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">My Events</h1>
        <Button 
          size="sm" 
          className="rounded-lg px-3 py-1"
          onClick={() => navigate('/create-event')}
        >
          + New Event
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-muted-foreground mb-4">You don't have any events yet.</p>
          <Button onClick={() => navigate('/create-event')}>
            Create Your First Event
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event: any) => {
            const eventImage = getEventImage(event);
            const eventDate = getEventDate(event);
            const eventStatus = getEventStatus(event);
            
            return (
              <article
                key={event.id}
                onClick={() => navigate(`/event-management/${event.id}`)}
                className="bg-card rounded-lg border border-border overflow-hidden transition-colors hover:bg-muted/10 cursor-pointer"
                role="article"
                aria-labelledby={`event-title-${event.id}`}
              >
                <div className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Image */}
                    <div className="w-full sm:w-32 h-32 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted/10">
                      {eventImage && (
                        <img
                          src={eventImage}
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3
                              id={`event-title-${event.id}`}
                              className="font-semibold text-lg text-foreground"
                            >
                              {event.title}
                            </h3>
                            
                            {/* Status badge - mobile top right */}
                            <span
                              className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg ${statusStyles[eventStatus] || statusStyles[event.status] || 'bg-gray-100 text-gray-800'} sm:hidden shrink-0`}
                            >
                              {eventStatus}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {getEventType(event) && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                                {getEventType(event)}
                              </span>
                            )}
                            {event.eventCategory && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">
                                {event.eventCategory}
                              </span>
                            )}
                          </div>
                          {eventDate && (
                            <p className="text-sm text-muted-foreground mt-1.5">
                              {new Date(eventDate).toLocaleDateString()}
                            </p>
                          )}

                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {event.description || event.text}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-3">
                            <span className="flex items-center gap-1.5">
                              <Users className="w-4 h-4" />
                              <span>{getEventGuests(event)} guests</span>
                            </span>

                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4" />
                              <span>{eventDate ? new Date(eventDate).toLocaleDateString() : ''}</span>
                            </span>
                          </div>

                          {/* Budget */}
                          {event.budget && (
                            <p className="text-sm font-medium text-foreground mt-2">
                              {formatBudget(event.budget)}
                            </p>
                          )}
                        </div>

                        {/* Status badge - desktop */}
                        <span
                          className={`hidden sm:inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg ${statusStyles[eventStatus] || statusStyles[event.status] || 'bg-gray-100 text-gray-800'} shrink-0`}
                        >
                          {eventStatus}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 mt-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/create-event?edit=${event.id}`); }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-foreground hover:bg-muted transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span className="text-sm font-medium">Edit</span>
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }}
                          disabled={deleting}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="text-sm font-medium">Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyEvents;
