import { useState } from 'react';
import { Calendar, Users, UserCheck, Edit2, Trash2, Loader2, FileText, Mail, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useEvents, useDeleteEvent } from '@/data/useEvents';
import { usePolling } from '@/hooks/usePolling';
import { formatPrice } from '@/utils/formatPrice';
import { Skeleton } from '@/components/ui/skeleton';
import { eventsApi } from '@/lib/api/events';
import { toast } from 'sonner';
import { showCaughtError } from '@/lib/api';
import { generateEventReport } from '@/utils/generateEventReport';
import InvitedEvents from './InvitedEvents';
import CommitteeEvents from './CommitteeEvents';

const EVENT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'published', label: 'Published' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
];

const MyEvents = () => {
  useWorkspaceMeta({
    title: 'My Events',
    description: 'Manage all your events including weddings, birthdays, memorials, and celebrations.'
  });

  const navigate = useNavigate();
  const { events, loading, error, refetch } = useEvents();
  const { deleteEvent, loading: deleting } = useDeleteEvent();
  usePolling(refetch, 15000);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const statusStyles: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    confirmed: "bg-blue-100 text-blue-800",
    published: "bg-primary/10 text-primary",
    cancelled: "bg-destructive/10 text-destructive",
    completed: "bg-green-100 text-green-800",
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEvent(id);
      refetch();
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  const handleStatusChange = async (eventId: string, newStatus: string) => {
    setUpdatingStatus(eventId);
    try {
      if (newStatus === 'published') {
        await eventsApi.publish(eventId);
      } else if (newStatus === 'cancelled') {
        await eventsApi.cancel(eventId, { notify_guests: true, notify_vendors: true });
      } else {
        const fd = new FormData();
        fd.append('status', newStatus);
        await eventsApi.update(eventId, fd);
      }
      toast.success(`Event status updated to ${newStatus}`);
      refetch();
    } catch (err: any) {
      showCaughtError(err, 'Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const formatBudget = (budget: string | number | undefined) => {
    if (!budget) return '';
    if (typeof budget === 'number') return formatPrice(budget);
    const amount = budget.replace(/[^0-9]/g, '');
    if (!amount) return '';
    return formatPrice(parseInt(amount));
  };

  const getEventStatus = (event: any) => event.status || 'draft';
  const getEventImage = (event: any) => {
    if (event.cover_image) return event.cover_image;
    if (event.images?.length > 0) { const f = event.images.find((img: any) => img.is_featured); return f ? f.image_url : event.images[0].image_url; }
    if (event.gallery_images?.length > 0) return event.gallery_images[0];
    return null;
  };
  const getEventDate = (event: any) => event.date || event.start_date;
  const getEventType = (event: any) => event.eventType || event.event_type?.name || event.type;

  const renderMyEventsList = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-lg border border-border p-4">
              <div className="flex gap-4"><Skeleton className="w-32 h-24 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-full" /></div></div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="mt-8 text-center">
          <p className="text-destructive mb-4">Failed to load events. Please try again.</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      );
    }

    if (events.length === 0) {
      return (
        <div className="mt-8 text-center">
          <p className="text-muted-foreground mb-4">You don't have any events yet.</p>
          <Button onClick={() => navigate('/create-event')}>Create Your First Event</Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {events.map((event: any) => {
          const eventImage = getEventImage(event);
          const eventDate = getEventDate(event);
          const eventStatus = getEventStatus(event);
          const expectedGuests = event.expected_guests || 0;
          const guestCount = event.guest_count || 0;
          
          return (
            <article key={event.id} onClick={() => navigate(`/event-management/${event.id}`)} className="bg-card rounded-lg border border-border overflow-hidden transition-colors hover:bg-muted/10 cursor-pointer" role="article">
              <div className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  {(() => {
                    const allImages = event.gallery_images?.length > 0 ? event.gallery_images.slice(0, 4) : (eventImage ? [eventImage] : []);
                    if (allImages.length === 0) return <div className="w-full sm:w-32 h-32 sm:h-24 flex-shrink-0 rounded-lg bg-muted/10" />;
                    if (allImages.length === 1) return <div className="w-full sm:w-32 h-32 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted/10"><img src={allImages[0]} alt={event.title} className="w-full h-full object-cover" /></div>;
                    return (
                      <div className="w-full sm:w-40 h-32 sm:h-24 flex-shrink-0 grid grid-cols-2 gap-0.5 rounded-lg overflow-hidden">
                        {allImages.map((img: string, idx: number) => <img key={idx} src={img} alt={`${event.title} ${idx+1}`} className="w-full h-full object-cover" />)}
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-lg text-foreground">{event.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {getEventType(event) && <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">{getEventType(event)}</span>}
                        </div>
                        {eventDate && <p className="text-sm text-muted-foreground mt-1.5">{new Date(eventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{event.description || event.text}</p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-3">
                          <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /><span>{expectedGuests} expected</span></span>
                          <span className="flex items-center gap-1.5"><UserCheck className="w-4 h-4" /><span>{guestCount} confirmed</span></span>
                          <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /><span>{eventDate ? new Date(eventDate).toLocaleDateString() : ''}</span></span>
                        </div>
                        {event.budget && <p className="text-sm font-medium text-foreground mt-2">{formatBudget(event.budget)}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Select value={eventStatus} onValueChange={(val) => handleStatusChange(event.id, val)} disabled={updatingStatus === event.id}>
                          <SelectTrigger className={`h-8 w-32 text-xs font-medium rounded-lg border-0 ${statusStyles[eventStatus] || 'bg-muted text-muted-foreground'}`}>
                            {updatingStatus === event.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <SelectValue />}
                          </SelectTrigger>
                          <SelectContent>
                            {EVENT_STATUSES.map(s => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/create-event?edit=${event.id}`); }} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-foreground hover:bg-muted transition-colors">
                        <Edit2 className="w-4 h-4" /><span className="text-sm font-medium">Edit</span>
                      </button>
                      <button onClick={(e) => {
                        e.stopPropagation();
                        generateEventReport({
                          title: event.title, description: event.description, event_type: getEventType(event),
                          start_date: event.start_date, end_date: event.end_date, start_time: event.start_time, end_time: event.end_time,
                          location: event.location, venue: event.venue, status: eventStatus,
                          budget: typeof event.budget === 'number' ? event.budget : parseFloat(event.budget || '0'),
                          currency: event.currency, expected_guests: expectedGuests, guest_count: guestCount,
                          confirmed_guest_count: event.confirmed_guest_count, pending_guest_count: event.pending_guest_count,
                          declined_guest_count: event.declined_guest_count, checked_in_count: event.checked_in_count,
                          committee_count: event.committee_count, contribution_total: event.contribution_total,
                          contribution_count: event.contribution_count, contribution_target: event.contribution_target,
                          dress_code: event.dress_code, special_instructions: event.special_instructions,
                        });
                      }} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                        <FileText className="w-4 h-4" /><span className="text-sm font-medium">Report</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }} disabled={deleting} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50">
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
    );
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Button size="sm" className="rounded-lg px-3 py-1" onClick={() => navigate('/create-event')}>+ New Event</Button>
      </div>

      <Tabs defaultValue="my-events" className="w-full">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="my-events" className="flex-1 gap-1.5">
            <Calendar className="w-4 h-4" />
            My Events
          </TabsTrigger>
          <TabsTrigger value="invited" className="flex-1 gap-1.5">
            <Mail className="w-4 h-4" />
            Invited
          </TabsTrigger>
          <TabsTrigger value="committee" className="flex-1 gap-1.5">
            <Shield className="w-4 h-4" />
            Committee
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-events">
          {renderMyEventsList()}
        </TabsContent>

        <TabsContent value="invited">
          <InvitedEvents />
        </TabsContent>

        <TabsContent value="committee">
          <CommitteeEvents />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyEvents;
