import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Zap,
  CheckCircle2, Globe, Lock, MapPin
} from 'lucide-react';
import SvgIcon from '@/components/ui/svg-icon';
import LocationIcon from '@/assets/icons/location-icon.svg';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { photoLibrariesApi, ServiceConfirmedEvent } from '@/lib/api/photoLibraries';
import { showApiErrors, showCaughtError } from '@/lib/api';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { formatPrice } from '@/utils/formatPrice';
import PhotosIcon from '@/assets/icons/photos-icon.svg';
import CalendarIcon from '@/assets/icons/calendar-icon.svg';

// ─── Module-level cache ───
let _eventsCache: Record<string, ServiceConfirmedEvent[]> = {};
let _eventsTitleCache: Record<string, string> = {};
let _eventsLoaded: Record<string, boolean> = {};

const ServiceEventsPage = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const [events, setEvents] = useState<ServiceConfirmedEvent[]>(serviceId ? (_eventsCache[serviceId] || []) : []);
  const [loading, setLoading] = useState(serviceId ? !_eventsLoaded[serviceId] : true);
  const [serviceTitle, setServiceTitle] = useState(serviceId ? (_eventsTitleCache[serviceId] || '') : '');
  const [createLibraryEvent, setCreateLibraryEvent] = useState<ServiceConfirmedEvent | null>(null);
  const [newLibraryPrivacy, setNewLibraryPrivacy] = useState('event_creator_only');
  const [creating, setCreating] = useState(false);
  const initialLoad = useRef(!serviceId || !_eventsLoaded[serviceId]);

  useWorkspaceMeta({ title: 'Service Events', description: 'Events where your service is confirmed' });

  const fetchEvents = useCallback(async () => {
    if (!serviceId) return;
    if (initialLoad.current) setLoading(true);
    try {
      const res = await photoLibrariesApi.getServiceEvents(serviceId);
      if (res.success && res.data) {
        _eventsCache[serviceId] = res.data.events;
        _eventsTitleCache[serviceId] = res.data.service_title;
        _eventsLoaded[serviceId] = true;
        initialLoad.current = false;
        setEvents(res.data.events);
        setServiceTitle(res.data.service_title);
      }
    } catch (err) { showCaughtError(err); }
    finally { setLoading(false); }
  }, [serviceId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleCreateLibrary = async () => {
    if (!createLibraryEvent || !serviceId) return;
    setCreating(true);
    try {
      const res = await photoLibrariesApi.createLibrary(serviceId, {
        event_id: createLibraryEvent.event_id,
        privacy: newLibraryPrivacy,
      });
      if (!showApiErrors(res)) {
        toast.success('Photo library created!');
        setCreateLibraryEvent(null);
        navigate(`/photo-library/${res.data.id}`);
      }
    } catch (err) { showCaughtError(err); }
    finally { setCreating(false); }
  };

  const todayEvents = events.filter(e => e.timing === 'today');
  const upcomingEvents = events.filter(e => e.timing === 'upcoming');
  const completedEvents = events.filter(e => e.timing === 'completed');

  /* ─── TIMING BADGE ─── */
  const TimingBadge = ({ timing }: { timing: string }) => {
    if (timing === 'today') return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-orange-500 text-white px-2.5 py-1 rounded-full shadow">
        <Zap className="w-3 h-3" /> Today
      </span>
    );
    if (timing === 'upcoming') return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-primary text-primary-foreground px-2.5 py-1 rounded-full shadow">
        <img src={CalendarIcon} alt="" className="w-3 h-3 invert" /> Upcoming
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500 text-white px-2.5 py-1 rounded-full shadow">
        <CheckCircle2 className="w-3 h-3" /> Completed
      </span>
    );
  };

  /* ─── EVENT CARD ─── */
  const EventCard = ({ event }: { event: ServiceConfirmedEvent }) => {
    // Priority: library photos → event cover_image_url → placeholder
    const libPhotos = (event.photo_library?.photos || []) as any[];
    const hasCover = !!event.cover_image_url;
    // Use library photos for the masonry strip if available, else single cover
    const stripPhotos = libPhotos.length > 0 ? libPhotos.slice(0, 5) : [];

    return (
    <div className={`group rounded-2xl overflow-hidden border bg-card hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200
      ${event.timing === 'today' ? 'border-orange-300 dark:border-orange-700 shadow-md shadow-orange-100 dark:shadow-orange-950/20' : 'border-border'}`}>

      {/* ── Cover: masonry strip like photo library ── */}
      <div className="relative h-44 bg-gradient-to-br from-primary/15 to-primary/5 overflow-hidden">
        {stripPhotos.length >= 2 ? (
          /* Masonry-style horizontal strip: first photo is wider, rest share remaining width */
          <div className="absolute inset-0 flex gap-0.5">
            {/* Main photo - takes 55% width */}
            <div className="flex-none w-[55%] overflow-hidden">
              <img src={stripPhotos[0].url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
            {/* Secondary column - remaining 45%, split vertically */}
            <div className="flex-1 flex flex-col gap-0.5">
              {stripPhotos.slice(1, 3).map((p: any, i: number) => (
                <div key={i} className="flex-1 overflow-hidden">
                  <img src={p.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" style={{ transitionDelay: `${i * 50}ms` }} />
                </div>
              ))}
              {/* Third column slot: 4th photo or subtle overlay with count */}
              {stripPhotos.length > 3 && (
                <div className="flex-1 relative overflow-hidden">
                  <img src={stripPhotos[3].url} alt="" className="w-full h-full object-cover" />
                  {stripPhotos.length > 4 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">+{stripPhotos.length - 3}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : stripPhotos.length === 1 ? (
          <img src={stripPhotos[0].url} alt={event.event_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : hasCover ? (
          <img src={event.cover_image_url!} alt={event.event_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <img src={CalendarIcon} alt="" className="w-16 h-16 opacity-10 dark:invert" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />


        <div className="absolute top-3 left-3">
          <TimingBadge timing={event.timing} />
        </div>
        {event.agreed_price && (
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full font-semibold">
            {formatPrice(event.agreed_price)}
          </div>
        )}
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="text-white font-bold text-base truncate leading-tight">{event.event_name}</h3>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-4 space-y-3">
        <div className="space-y-1.5">
          {event.event_date_display && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <img src={CalendarIcon} alt="" className="w-3.5 h-3.5 flex-shrink-0 dark:invert opacity-60" />
              <span>{event.event_date_display}</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <img src={LocationIcon} alt="" className="w-3.5 h-3.5 flex-shrink-0 dark:invert opacity-60" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          {event.organizer_name && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Avatar className="w-4 h-4 flex-shrink-0">
                <AvatarImage src={event.organizer_avatar} />
                <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                  {event.organizer_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>{event.organizer_name}</span>
            </div>
          )}
        </div>

        {/* ── Photo Library CTA ── */}
        {event.has_library && event.photo_library ? (
          <button
            onClick={() => navigate(`/photo-library/${event.photo_library!.id}`)}
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 hover:bg-muted transition-colors px-3.5 py-2.5 text-sm overflow-hidden"
          >
            {/* Thumbnail strip from library photos */}
            {event.photo_library.photos && event.photo_library.photos.length > 0 ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex -space-x-1 shrink-0">
                  {event.photo_library.photos.slice(0, 3).map((p: any, i: number) => (
                    <img key={i} src={p.url} alt="" className="w-7 h-7 rounded-full object-cover border-2 border-card" />
                  ))}
                </div>
                <span className="font-medium text-foreground truncate">Photo Library</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <img src={PhotosIcon} alt="" className="w-4 h-4 dark:invert opacity-70" />
                <span className="font-medium text-foreground">Open Photo Library</span>
              </div>
            )}
            <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full border border-border shrink-0">
              {event.photo_library.photo_count} photos
            </span>
          </button>
        ) : (
          <button
            onClick={() => setCreateLibraryEvent(event)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-3.5 py-2.5 text-sm font-medium"
          >
            <img src={PhotosIcon} alt="" className="w-4 h-4 invert" />
            Create Photo Library
          </button>
        )}
      </div>
    </div>
    );
  };


  const SectionHeader = ({ icon, label, count, colorClass }: { icon: React.ReactNode; label: string; count: number; colorClass: string }) => (
    <div className="flex items-center gap-2.5 mb-5">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colorClass}`}>
        {icon}
      </div>
      <h2 className="text-base font-bold text-foreground">{label}</h2>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colorClass}`}>{count}</span>
    </div>
  );

  /* ─── SKELETON LOADING ─── */
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto pb-16">
        <div className="flex items-center gap-3 py-4 px-1 mb-4">
          <Skeleton className="w-20 h-4" />
        </div>
        <Skeleton className="w-full h-36 rounded-2xl mb-6" />
        <div className="grid gap-5 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-border bg-card">
              <Skeleton className="h-44 w-full rounded-none" />
              <div className="p-4 space-y-2.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="h-10 w-full rounded-xl mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Collect photo thumbnails: first from libraries, then from event cover images
  const heroThumbs = (() => {
    const thumbs: string[] = [];
    // From library photos
    for (const ev of events) {
      if (ev.photo_library?.photos?.length) {
        for (const p of ev.photo_library.photos) {
          if (p.url) thumbs.push(p.url);
          if (thumbs.length >= 6) break;
        }
      }
      if (thumbs.length >= 6) break;
    }
    // Fill remaining from event cover images
    if (thumbs.length < 6) {
      for (const ev of events) {
        if (ev.cover_image_url && !thumbs.includes(ev.cover_image_url)) {
          thumbs.push(ev.cover_image_url);
          if (thumbs.length >= 6) break;
        }
      }
    }
    return thumbs.slice(0, 6);
  })();
  const hasThumbs = heroThumbs.length > 0;

  return (
    <div className="max-w-5xl mx-auto pb-16">

      {/* ─── TOP BAR ─── */}
      <div className="flex items-center justify-between py-4 px-1 mb-2">
        <h2 className="text-base font-semibold text-foreground truncate">{serviceTitle || 'My Events'}</h2>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back">
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* ─── HERO HEADER — same style as PhotoLibraryDetail ─── */}
      <div className="relative rounded-2xl overflow-hidden mb-8 bg-gradient-to-br from-primary/20 via-primary/10 to-background border border-border h-44">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        {hasThumbs && (
          <div className="absolute inset-0">
            {heroThumbs.length >= 3 ? (
              <div className="grid grid-cols-3 h-full gap-0.5 opacity-30">
                {heroThumbs.slice(0, 3).map((src, i) => (
                  <img key={i} src={src} alt="" className="w-full h-full object-cover" />
                ))}
              </div>
            ) : (
              <img src={heroThumbs[0]} alt="" className="w-full h-full object-cover opacity-20" />
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/40 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6">
          <div className="flex items-end gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <img src={CalendarIcon} alt="" className="w-6 h-6 dark:invert opacity-80" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground">My Events</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {serviceTitle && <span className="text-sm text-muted-foreground font-medium">{serviceTitle}</span>}
                {serviceTitle && <span className="text-muted-foreground text-sm">·</span>}
                <span className="text-sm text-muted-foreground">{events.length} confirmed event{events.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                {upcomingEvents.length > 0 && (
                  <span className="text-xs font-semibold text-primary">{upcomingEvents.length} upcoming</span>
                )}
                {completedEvents.length > 0 && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{completedEvents.length} completed</span>
                )}
                {todayEvents.length > 0 && (
                  <span className="text-xs font-semibold text-orange-500">{todayEvents.length} today</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        /* ─── EMPTY STATE ─── */
        <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <img src={CalendarIcon} alt="" className="w-10 h-10 opacity-40 dark:invert" />
          </div>
          <h3 className="text-xl font-bold mb-2">No Confirmed Events Yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            When event organizers confirm your service for their events, they'll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-10">

          {/* Today */}
          {todayEvents.length > 0 && (
            <section>
              <SectionHeader
                icon={<Zap className="w-4 h-4 text-orange-600" />}
                label="Happening Today"
                count={todayEvents.length}
                colorClass="bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
              />
              <div className="grid gap-5 md:grid-cols-2">
                {todayEvents.map(e => <EventCard key={e.event_service_id} event={e} />)}
              </div>
            </section>
          )}

          {/* Upcoming */}
          {upcomingEvents.length > 0 && (
            <section>
              <SectionHeader
                icon={<img src={CalendarIcon} alt="" className="w-4 h-4 dark:invert text-primary" />}
                label="Upcoming"
                count={upcomingEvents.length}
                colorClass="bg-primary/10 text-primary"
              />
              <div className="grid gap-5 md:grid-cols-2">
                {upcomingEvents.map(e => <EventCard key={e.event_service_id} event={e} />)}
              </div>
            </section>
          )}

          {/* Completed */}
          {completedEvents.length > 0 && (
            <section>
              <SectionHeader
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                label="Completed"
                count={completedEvents.length}
                colorClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              />
              <div className="grid gap-5 md:grid-cols-2">
                {completedEvents.map(e => <EventCard key={e.event_service_id} event={e} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ─── CREATE LIBRARY DIALOG ─── */}
      <Dialog open={!!createLibraryEvent} onOpenChange={() => setCreateLibraryEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <img src={PhotosIcon} alt="" className="w-5 h-5 dark:invert" />
              Create Photo Library
            </DialogTitle>
          </DialogHeader>
          {createLibraryEvent && (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl p-4 border border-border">
                <p className="font-semibold text-sm text-foreground">{createLibraryEvent.event_name}</p>
                {createLibraryEvent.event_date_display && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <img src={CalendarIcon} alt="" className="w-3 h-3 dark:invert opacity-60" />
                    {createLibraryEvent.event_date_display}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Who can view?</label>
                <Select value={newLibraryPrivacy} onValueChange={setNewLibraryPrivacy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="event_creator_only">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4" /> Private – Event creator only
                      </div>
                    </SelectItem>
                    <SelectItem value="public">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" /> Public – Anyone with the link
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 border border-border">
                The library name is auto-generated from the event name. You can upload up to <strong>200MB</strong> of photos per service.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateLibraryEvent(null)}>Cancel</Button>
            <Button onClick={handleCreateLibrary} disabled={creating}>
              {creating && <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />}
              Create Library
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiceEventsPage;
