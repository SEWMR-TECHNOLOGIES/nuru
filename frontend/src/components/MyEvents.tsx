import { useState } from 'react';
import {
  Users, UserCheck, Edit2, Trash2, Loader2, FileText, Mail, Shield,
  Plus, MapPin, CalendarDays, Clock, Wallet, ChevronRight, CheckCircle2
} from 'lucide-react';
import CalendarIcon from '@/assets/icons/calendar-icon.svg';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useEvents, useDeleteEvent } from '@/data/useEvents';
import { usePolling } from '@/hooks/usePolling';
import { formatPrice } from '@/utils/formatPrice';
import { getEventCountdown } from '@/utils/getEventCountdown';
import { Skeleton } from '@/components/ui/skeleton';
import { eventsApi } from '@/lib/api/events';
import { toast } from 'sonner';
import { showCaughtError } from '@/lib/api';
import { generateEventReportHtml } from '@/utils/generateEventReport';
import ReportPreviewDialog from '@/components/ReportPreviewDialog';
import InvitedEvents from './InvitedEvents';
import CommitteeEvents from './CommitteeEvents';

const EVENT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'published', label: 'Published' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
];

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-muted text-muted-foreground' },
  confirmed: { label: 'Confirmed', cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  published: { label: 'Published', cls: 'bg-primary/10 text-primary' },
  cancelled: { label: 'Cancelled', cls: 'bg-destructive/10 text-destructive' },
  completed: { label: 'Completed', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
};

const cornerConfig: Record<string, string> = {
  draft:     'bg-amber-500',
  confirmed: 'bg-green-500',
  published: 'bg-primary',
  cancelled: 'bg-destructive',
  completed: 'bg-blue-500',
};

const MyEvents = () => {
  useWorkspaceMeta({
    title: 'My Events',
    description: 'Manage all your events including weddings, birthdays, memorials, and celebrations.'
  });

  const navigate = useNavigate();
  const { events: fetchedEvents, loading, error, refetch } = useEvents();
  const { deleteEvent, loading: deleting } = useDeleteEvent();
  usePolling(refetch, 15000);

  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [localStatusOverrides, setLocalStatusOverrides] = useState<Record<string, string>>({});
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportHtml, setReportHtml] = useState('');

  const events = fetchedEvents.map((e: any) =>
    localStatusOverrides[e.id] ? { ...e, status: localStatusOverrides[e.id] } : e
  );

  // ── Derived summary stats ──────────────────────────────────────────────────
  const totalEvents    = events.length;
  const upcoming       = events.filter((e: any) => ['confirmed', 'published'].includes(e.status || 'draft')).length;
  const completed      = events.filter((e: any) => e.status === 'completed').length;
  const totalGuests    = events.reduce((s: number, e: any) => s + (e.expected_guests || 0), 0);

  const handleDelete = async (id: string) => {
    try { await deleteEvent(id); refetch(); }
    catch (err) { console.error('Failed to delete event:', err); }
  };

  const handleStatusChange = async (eventId: string, newStatus: string) => {
    setLocalStatusOverrides(prev => ({ ...prev, [eventId]: newStatus }));
    setUpdatingStatus(eventId);
    try {
      const res = await eventsApi.updateStatus(eventId, newStatus as any);
      if (res.success) {
        toast.success(`Status updated to ${newStatus}`);
        setLocalStatusOverrides(prev => { const next = { ...prev }; delete next[eventId]; return next; });
        refetch();
      } else {
        setLocalStatusOverrides(prev => { const next = { ...prev }; delete next[eventId]; return next; });
        toast.error(res.message || 'Failed to update status');
      }
    } catch (err: any) {
      setLocalStatusOverrides(prev => { const next = { ...prev }; delete next[eventId]; return next; });
      showCaughtError(err, 'Failed to update status');
    } finally { setUpdatingStatus(null); }
  };

  const formatBudget = (budget: string | number | undefined) => {
    if (!budget) return null;
    if (typeof budget === 'number') return formatPrice(budget);
    const amount = budget.replace(/[^0-9]/g, '');
    return amount ? formatPrice(parseInt(amount)) : null;
  };

  const getEventStatus  = (e: any) => e.status || 'draft';
  const getEventDate    = (e: any) => e.date || e.start_date;
  const getEventType    = (e: any) => e.eventType || e.event_type?.name || e.type;
  const getEventImages  = (e: any): string[] => {
    if (e.gallery_images?.length > 0) return e.gallery_images.slice(0, 4);
    if (e.images?.length > 0) {
      const f = e.images.find((img: any) => img.is_featured);
      return [f ? f.image_url : e.images[0].image_url];
    }
    if (e.cover_image) return [e.cover_image];
    return [];
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  const renderSkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <Card key={i} className="overflow-hidden border-border/60">
          <Skeleton className="h-44 w-full" />
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // ── Event card ─────────────────────────────────────────────────────────────
  const renderEventCard = (event: any) => {
    const imgs        = getEventImages(event);
    const eventDate   = getEventDate(event);
    const status      = getEventStatus(event);
    const cfg         = statusConfig[status] || statusConfig.draft;
    const cornerCls   = cornerConfig[status] || cornerConfig.draft;
    const budget      = formatBudget(event.budget);
    const eventType   = getEventType(event);

    return (
      <Card
        key={event.id}
        className="overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        onClick={() => navigate(`/event-management/${event.id}`)}
      >
        {/* ── Image Mosaic ── */}
        {imgs.length > 0 ? (
          <div className="relative h-48 overflow-hidden bg-muted">
            {imgs.length === 1 && (
              <img src={imgs[0]} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            )}
            {imgs.length === 2 && (
              <div className="grid grid-cols-2 h-full gap-0.5">
                {imgs.map((img, idx) => <img key={idx} src={img} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />)}
              </div>
            )}
            {imgs.length === 3 && (
              <div className="grid grid-cols-3 h-full gap-0.5">
                {imgs.map((img, idx) => <img key={idx} src={img} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />)}
              </div>
            )}
            {imgs.length >= 4 && (
              <div className="grid grid-cols-4 h-full gap-0.5">
                <div className="col-span-2 row-span-2">
                  <img src={imgs[0]} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                {imgs.slice(1, 4).map((img, idx) => (
                  <img key={idx} src={img} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ))}
              </div>
            )}

            {/* Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

            {/* Status corner ribbon */}
            <div className="absolute top-0 right-0 overflow-hidden" style={{ width: 90, height: 90, pointerEvents: 'none' }}>
              <div className={`absolute ${cornerCls} text-white`}
                style={{ width: 140, textAlign: 'center', transform: 'rotate(45deg)', top: 16, right: -36, padding: '3px 0', fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </div>
            </div>

            {/* Type badge */}
            {eventType && (
              <div className="absolute top-3 left-3">
                <Badge className="bg-black/60 text-white border-0 backdrop-blur-sm text-xs">{eventType}</Badge>
              </div>
            )}

            {/* Bottom overlay: date + actions */}
            <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-4 pb-3">
              {eventDate && (
                <p className="text-white/90 text-sm font-medium drop-shadow">
                  {new Date(eventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
              <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                <Button size="sm" variant="secondary" className="bg-white/90 hover:bg-white text-foreground shadow h-7 px-2.5 text-xs"
                  onClick={() => navigate(`/create-event?edit=${event.id}`)}>
                  <Edit2 className="w-3 h-3 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="secondary" className="bg-white/90 hover:bg-white text-foreground shadow h-7 px-2.5 text-xs"
                  onClick={() => {
                    const html = generateEventReportHtml({
                      title: event.title, description: event.description, event_type: eventType,
                      start_date: event.start_date, end_date: event.end_date, start_time: event.start_time, end_time: event.end_time,
                      location: event.location, venue: event.venue, status,
                      budget: typeof event.budget === 'number' ? event.budget : parseFloat(event.budget || '0'),
                      currency: event.currency, expected_guests: event.expected_guests || 0,
                      guest_count: event.guest_count || 0,
                      confirmed_guest_count: event.confirmed_guest_count, pending_guest_count: event.pending_guest_count,
                      declined_guest_count: event.declined_guest_count, checked_in_count: event.checked_in_count,
                      committee_count: event.committee_count, contribution_total: event.contribution_total,
                      contribution_count: event.contribution_count, contribution_target: event.contribution_target,
                      dress_code: event.dress_code, special_instructions: event.special_instructions,
                    });
                    setReportHtml(html);
                    setReportPreviewOpen(true);
                  }}>
                  <FileText className="w-3 h-3 mr-1" /> Report
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* No image – colored header strip */
          <div className={`relative h-16 ${cornerCls} flex items-center justify-between px-4`}>
            <span className="text-white font-semibold text-sm">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
            {eventType && <Badge className="bg-white/20 text-white border-0 text-xs">{eventType}</Badge>}
          </div>
        )}

        {/* ── Card Body ── */}
        <CardContent className="p-5">
          <div className="space-y-3">
            {/* Title */}
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold text-lg leading-snug group-hover:text-primary transition-colors">{event.title}</h3>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {eventDate && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 flex-shrink-0" />
                  {new Date(eventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              )}
              {(() => {
                const countdown = getEventCountdown(eventDate);
                if (!countdown) return null;
                return (
                  <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${countdown.isPast ? 'bg-muted text-muted-foreground' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                    <Clock className="w-3 h-3" />
                    {countdown.text}
                  </span>
                );
              })()}
              {event.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate max-w-[200px]">{event.location}</span>
                </span>
              )}
              {event.start_time && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  {event.start_time}
                </span>
              )}
            </div>

            {/* Description */}
            {(event.description || event.text) && (
              <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">{event.description || event.text}</p>
            )}

            {/* Quick stats strip */}
            <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/50">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Expected</p>
                <div className="flex items-center justify-center gap-1">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-semibold text-sm">{event.expected_guests || 0}</span>
                </div>
              </div>
              <div className="text-center border-x border-border/50">
                <p className="text-xs text-muted-foreground mb-0.5">Confirmed</p>
                <div className="flex items-center justify-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-green-500" />
                  <span className="font-semibold text-sm">{event.confirmed_guest_count || 0}</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Budget</p>
                <span className="font-semibold text-sm text-primary">{budget || '—'}</span>
              </div>
            </div>

            {/* Actions row */}
            <div className="flex items-center gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
              {/* Status selector */}
              <Select value={getEventStatus(event)} onValueChange={val => handleStatusChange(event.id, val)} disabled={updatingStatus === event.id}>
                <SelectTrigger className={`h-7 w-[110px] text-[11px] font-medium rounded-md border-0 ${cfg.cls}`}>
                  {updatingStatus === event.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <SelectValue />}
                </SelectTrigger>
                <SelectContent>
                  {EVENT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <button
                onClick={() => navigate(`/event-management/${event.id}`)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium h-7">
                Manage
              </button>

              <button
                onClick={() => handleDelete(event.id)}
                disabled={deleting}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors text-xs font-medium disabled:opacity-50 h-7">
                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Delete
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ── My Events list ─────────────────────────────────────────────────────────
  const renderMyEventsList = () => {
    if (loading) return renderSkeleton();
    if (error) return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Failed to load events. Please try again.</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
    if (events.length === 0) return (
      <div className="text-center py-20 border-2 border-dashed border-muted-foreground/20 rounded-2xl">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CalendarDays className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-xl font-bold mb-2">No Events Yet</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Create your first event to start planning, managing guests, and tracking contributions.
        </p>
        <Button size="lg" onClick={() => navigate('/create-event')}>
          <Plus className="w-5 h-5 mr-2" /> Create Your First Event
        </Button>
      </div>
    );

    return <div className="grid gap-5 sm:grid-cols-1 md:grid-cols-2">{events.map(renderEventCard)}</div>;
  };

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Events</h1>
          <p className="text-muted-foreground mt-1">Plan, manage, and track all your events in one place</p>
        </div>
        <Button size="lg" className="shadow-md" onClick={() => navigate('/create-event')}>
          <Plus className="w-4 h-4 mr-2" /> New Event
        </Button>
      </div>

      {/* ── Stats Row ── */}
      {!loading && events.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Events',     value: totalEvents,  icon: <img src={CalendarIcon} alt="" className="w-5 h-5 dark:invert" />, color: 'text-primary',    bg: 'bg-primary/10' },
            { label: 'Upcoming',         value: upcoming,     icon: <Clock className="w-5 h-5" />,         color: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-900/30' },
            { label: 'Completed',        value: completed,    icon: <CheckCircle2 className="w-5 h-5" />,  color: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-900/30' },
            { label: 'Total Guests',     value: totalGuests,  icon: <Users className="w-5 h-5" />,         color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
          ].map((stat, i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-11 h-11 ${stat.bg} rounded-xl flex items-center justify-center ${stat.color}`}>
                    {stat.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs defaultValue="my-events" className="w-full">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="my-events" className="flex-1 gap-1.5">
            <img src={CalendarIcon} alt="Calendar" className="w-4 h-4 dark:invert" />
            My Events
          </TabsTrigger>
          <TabsTrigger value="invited" className="flex-1 gap-1.5">
            <Mail className="w-4 h-4" /> Invited
          </TabsTrigger>
          <TabsTrigger value="committee" className="flex-1 gap-1.5">
            <Shield className="w-4 h-4" /> Committee
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-events">{renderMyEventsList()}</TabsContent>
        <TabsContent value="invited"><InvitedEvents /></TabsContent>
        <TabsContent value="committee"><CommitteeEvents /></TabsContent>
      </Tabs>

      <ReportPreviewDialog
        open={reportPreviewOpen}
        onOpenChange={setReportPreviewOpen}
        title="Event Report"
        html={reportHtml}
      />
    </div>
  );
};

export default MyEvents;
