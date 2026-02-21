import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Users, UserCheck, CheckCircle2, Plus, Search, Trash2, X, Loader2, Images } from 'lucide-react';
import ShareIcon from '@/assets/icons/share-icon.svg';
import { VerifiedServiceBadge } from '@/components/ui/verified-badge';
import CalendarIcon from '@/assets/icons/calendar-icon.svg';
import LocationIcon from '@/assets/icons/location-icon.svg';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import EventRSVP from './EventRSVP';
import EventGuestList from './events/EventGuestList';
import EventCommittee from './events/EventCommittee';
import EventContributions from './events/EventContributions';
import EventExpenses from './events/EventExpenses';
import EventChecklist from './events/EventChecklist';
import { useEventContributors } from '@/data/useContributors';
import { useEvent } from '@/data/useEvents';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePolling } from '@/hooks/usePolling';
import { formatPrice } from '@/utils/formatPrice';
import { getEventCountdown } from '@/utils/getEventCountdown';
import { EventManagementSkeleton } from '@/components/ui/EventManagementSkeleton';
import { eventsApi, showCaughtError } from '@/lib/api';
import { servicesApi } from '@/lib/api/services';
import { photoLibrariesApi } from '@/lib/api/photoLibraries';
import { toast } from 'sonner';
import { useEventPermissions } from '@/hooks/useEventPermissions';
import ShareEventToFeed from '@/components/ShareEventToFeed';
import EventTicketManagement from '@/components/events/EventTicketManagement';

const EventManagement = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();

  const { event: apiEvent, loading: eventLoading, refetch: refetchEvent } = useEvent(id || null);
  usePolling(refetchEvent, 15000);

  const { permissions, loading: permsLoading } = useEventPermissions(id || null);
  const { summary: contributionSummary } = useEventContributors(id || null);

  const event = apiEvent;

  // Determine if current user is the event creator
  const isCreator = permissions.is_creator;

  useWorkspaceMeta({
    title: event?.title || 'Event Management',
    description: `Manage services, committee, contributions, and invitations for ${event?.title || 'your event'}.`
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [showAddServiceDialog, setShowAddServiceDialog] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Dynamic event services
  const [eventServices, setEventServices] = useState<any[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  // Photo libraries created by service providers for this event
  const [eventPhotoLibraries, setEventPhotoLibraries] = useState<any[]>([]);

  const loadEventServices = async () => {
    if (!id) return;
    setServicesLoading(true);
    try {
      const res = await eventsApi.getEventServices(id);
      if (res.success) {
        const data = res.data as any;
        setEventServices(Array.isArray(data) ? data : data?.items || []);
      }
    } catch { /* silent */ }
    finally { setServicesLoading(false); }
  };

  const loadEventPhotoLibraries = async () => {
    if (!id) return;
    try {
      const res = await photoLibrariesApi.getEventLibraries(id);
      if (res.success && res.data) {
        setEventPhotoLibraries(res.data.libraries || []);
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (id) {
      loadEventServices();
      loadEventPhotoLibraries();
    }
  }, [id]);

  const completedServices = eventServices.filter((s: any) => ['completed', 'confirmed', 'assigned', 'accepted'].includes(s.status)).length;
  const totalServices = eventServices.length;
  const progress = totalServices > 0 ? Math.round((completedServices / totalServices) * 100) : 0;

  const toggleServiceComplete = async (serviceId: string) => {
    try {
      const svc = eventServices.find(s => s.id === serviceId);
      const newStatus = svc?.status === 'completed' ? 'pending' : 'completed';
      await eventsApi.updateEventService(id!, serviceId, { service_status: newStatus });
      loadEventServices();
    } catch (err: any) { showCaughtError(err); }
  };

  const handleRemoveService = async () => {
    if (!deleteServiceId || !id) return;
    try {
      await eventsApi.removeEventService(id, deleteServiceId);
      toast.success('Service removed');
      loadEventServices();
    } catch (err: any) { showCaughtError(err); }
    setDeleteServiceId(null);
  };

  // Service provider search
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingServiceId, setAddingServiceId] = useState<string | null>(null);

  const handleServiceSearch = async (query: string) => {
    setServiceSearch(query);
    if (query.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await servicesApi.search({ search: query, limit: 20 });
      if (res.success) {
        const data = res.data as any;
        setSearchResults(data?.services || (Array.isArray(data) ? data : []));
      }
    } catch { /* silent */ }
    finally { setSearchLoading(false); }
  };

  const handleAddService = async (service: any) => {
    if (!id) return;
    setAddingServiceId(service.id);
    try {
      const res = await eventsApi.addEventService(id, {
        provider_service_id: service.id,
        provider_user_id: service.provider?.id,
        notes: service.title,
      });
      if (res.success) {
        toast.success(`${service.title} added to event`);
        loadEventServices();
        setShowAddServiceDialog(false);
        setServiceSearch('');
        setSearchResults([]);
      } else {
        showCaughtError(res);
      }
    } catch (err: any) { showCaughtError(err); }
    finally { setAddingServiceId(null); }
  };

  if (eventLoading || permsLoading) return <EventManagementSkeleton />;
  if (!event) return <div className="text-center py-8 text-muted-foreground">Event not found</div>;

  const eventImages: string[] = (() => {
    if (apiEvent?.gallery_images && (apiEvent.gallery_images as string[]).length > 0) return apiEvent.gallery_images as string[];
    if ((apiEvent as any)?.images?.length > 0) {
      return (apiEvent as any).images.map((img: any) => img.image_url || img.url || img);
    }
    const cover = (apiEvent as any)?.cover_image || (apiEvent as any)?.cover_image_url;
    return cover ? [cover] : [];
  })();
  const hasImages = eventImages.length > 0;

  const openLightbox = (index: number) => { setLightboxIndex(index); setLightboxOpen(true); };
  const closeLightbox = () => setLightboxOpen(false);

  const eventTitle = apiEvent?.title || '';
  const eventDate = apiEvent?.start_date || '';
  const eventLocation = apiEvent?.location || '';
  const eventGuestCount = apiEvent?.guest_count || 0;
  const expectedGuests = apiEvent?.expected_guests || 0;
  const eventBudget = apiEvent?.budget ? formatPrice(apiEvent.budget) : '';
  const eventDescription = apiEvent?.description || '';

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold">{eventTitle}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isCreator && event && (
              <ShareEventToFeed
                event={{
                  id: event.id,
                  title: event.title,
                  start_date: event.start_date,
                  location: event.location,
                  cover_image: (event as any).cover_image || eventImages[0],
                }}
                trigger={
                  <Button variant="outline" size="sm" className="gap-2">
                    <img src={ShareIcon} alt="" className="w-4 h-4 dark:invert opacity-70" />
                    Share to Feed
                  </Button>
                }
              />
            )}
            <Button variant="ghost" size="icon" onClick={() => navigate('/my-events')}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2"><img src={CalendarIcon} alt="Calendar" className="w-4 h-4 flex-shrink-0" /><span className="truncate">{eventDate}</span></span>
          {(() => {
            const countdown = getEventCountdown(apiEvent?.start_date);
            if (!countdown) return null;
            return (
              <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${countdown.isPast ? 'bg-muted text-muted-foreground' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                {countdown.text}
              </span>
            );
          })()}
          <span className="flex items-center gap-2"><img src={LocationIcon} alt="Location" className="w-4 h-4 flex-shrink-0" /><span className="truncate">{eventLocation}</span></span>
          <span className="flex items-center gap-2"><Users className="w-4 h-4 flex-shrink-0" /><span className="truncate">{expectedGuests} expected</span></span>
          <span className="flex items-center gap-2"><UserCheck className="w-4 h-4 flex-shrink-0" /><span className="truncate">{apiEvent?.confirmed_guest_count || 0} confirmed</span></span>
        </div>
      </div>

      {/* Event images */}
      {hasImages && (
        <div className="mb-6">
          {eventImages.length === 1 ? (
            <div className="relative w-full h-72 rounded-lg overflow-hidden border border-border">
              <img src={eventImages[0]} alt={`${eventTitle} image`} className="w-full h-full object-cover cursor-pointer" onClick={() => openLightbox(0)} />
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto py-2">
              {eventImages.map((src, idx) => (
                <div key={idx} className="relative w-56 h-40 flex-shrink-0 rounded-lg overflow-hidden border border-border cursor-pointer" onClick={() => openLightbox(idx)}>
                  <img src={src} alt={`event ${idx}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && hasImages && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={closeLightbox}>
          <div className="relative max-w-[90vw] max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={closeLightbox} className="absolute -top-3 -right-3 bg-white rounded-full p-2 shadow z-50" aria-label="Close">✕</button>
            <img src={eventImages[lightboxIndex]} alt={`zoom ${lightboxIndex}`} className="w-full h-full object-contain rounded" style={{ maxHeight: '80vh' }} />
            {eventImages.length > 1 && (
              <>
                <button onClick={() => setLightboxIndex((i) => (i - 1 + eventImages.length) % eventImages.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded-full" aria-label="Previous">‹</button>
                <button onClick={() => setLightboxIndex((i) => (i + 1) % eventImages.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded-full" aria-label="Next">›</button>
              </>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteServiceId} onOpenChange={() => setDeleteServiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Service?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to remove this service from your event?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveService} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove Service</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="mb-6 -mx-1 px-1">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { value: 'overview', label: 'Overview' },
              { value: 'checklist', label: 'Checklist' },
              { value: 'services', label: 'Services' },
              { value: 'committee', label: 'Committee' },
              { value: 'contributions', label: 'Contributions' },
              { value: 'expenses', label: 'Expenses' },
              { value: 'guests', label: 'Guests' },
              { value: 'rsvp', label: 'RSVP' },
              ...((apiEvent as any)?.sells_tickets ? [{ value: 'tickets', label: 'Tickets' }] : []),
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all flex-shrink-0
                  ${activeTab === tab.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <TabsContent value="overview" className="space-y-4">
          {/* Row 1: Financial overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Card className="w-full"><CardContent className="p-5"><div className="flex items-center justify-between"><div className="flex-1"><p className="text-xs text-muted-foreground">Budget Status</p><p className="text-base font-semibold mt-1">{eventBudget}</p><p className="text-xs text-muted-foreground mt-1">Budget allocated</p></div><div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-blue-600" /></div></div></CardContent></Card>
            <Card className="w-full"><CardContent className="p-5"><div className="flex items-center justify-between"><div className="flex-1"><p className="text-xs text-muted-foreground">Total Pledged</p><p className="text-base font-semibold text-primary mt-1">{formatPrice(contributionSummary?.total_pledged || 0)}</p><p className="text-xs text-muted-foreground mt-1">{contributionSummary?.pledged_count || 0} contributor{(contributionSummary?.pledged_count || 0) !== 1 ? 's' : ''} pledged</p></div><div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-purple-600" /></div></div></CardContent></Card>
            {apiEvent?.budget && contributionSummary && (
              <Card className="w-full"><CardContent className="p-5"><div className="flex items-center justify-between"><div className="flex-1"><p className="text-xs text-muted-foreground">Budget Shortfall</p><p className="text-base font-semibold text-destructive mt-1">{formatPrice(Math.max(0, (apiEvent.budget as number) - (contributionSummary.total_pledged || 0)))}</p><p className="text-xs text-muted-foreground mt-1">Budget − Total Pledged</p></div><div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-red-600" /></div></div></CardContent></Card>
            )}
          </div>
          {/* Row 2: Cash in Hand */}
          <Card className="w-full border-primary/20 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Cash in Hand</p>
                  <p className="text-xl font-bold text-primary mt-1">{formatPrice(contributionSummary?.total_paid || 0)}</p>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 rounded-md bg-background">
                  <p className="text-base font-semibold">{contributionSummary?.paid_count || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Paid contributors</p>
                </div>
                <div className="text-center p-2 rounded-md bg-background">
                  <p className="text-base font-semibold">{formatPrice(Math.max(0, (contributionSummary?.total_pledged || 0) - (contributionSummary?.total_paid || 0)))}</p>
                  <p className="text-[10px] text-muted-foreground">Outstanding</p>
                </div>
                <div className="text-center p-2 rounded-md bg-background">
                  <p className="text-base font-semibold">{contributionSummary?.total_pledged ? Math.round(((contributionSummary?.total_paid || 0) / contributionSummary.total_pledged) * 100) : 0}%</p>
                  <p className="text-[10px] text-muted-foreground">Collection rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Row 3: Event progress + Guest overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="w-full"><CardContent className="p-5"><div className="flex items-center justify-between"><div className="flex-1"><p className="text-xs text-muted-foreground">Event Progress</p><p className="text-base font-semibold mt-1">{completedServices}/{totalServices} Services</p><div className="w-full bg-muted rounded-full h-2 mt-2"><div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} /></div></div></div></CardContent></Card>
            <Card className="w-full"><CardContent className="p-5"><div className="flex items-center justify-between"><div className="flex-1"><p className="text-xs text-muted-foreground">Guest Overview</p><p className="text-base font-semibold mt-1">{eventGuestCount}</p><p className="text-xs text-muted-foreground mt-1">of {expectedGuests} expected guests</p></div><div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-green-600" /></div></div></CardContent></Card>
            <Card className="w-full"><CardContent className="p-5"><div className="flex items-center justify-between"><div className="flex-1"><p className="text-xs text-muted-foreground">Confirmed Guests</p><p className="text-base font-semibold text-green-600 mt-1">{apiEvent?.confirmed_guest_count || 0}</p></div><div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center"><UserCheck className="w-4 h-4 text-green-600" /></div></div></CardContent></Card>
          </div>
          <Card><CardContent className="p-4"><p className="text-[10px] text-muted-foreground mb-1">Event Description</p><p className="text-sm text-muted-foreground">{eventDescription}</p></CardContent></Card>
        </TabsContent>

        <TabsContent value="checklist" className="space-y-6">
          <EventChecklist eventId={id!} eventTypeId={apiEvent?.event_type_id} permissions={permissions} />
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Service Providers</h2>
              <p className="text-xs text-muted-foreground">{eventServices.length} service{eventServices.length !== 1 ? 's' : ''} · {completedServices} confirmed</p>
            </div>
            {(permissions.can_manage_vendors || permissions.is_creator) && (
              <Button size="sm" onClick={() => setShowAddServiceDialog(true)}>
                <Plus className="w-4 h-4 mr-1.5" />Add Service
              </Button>
            )}
          </div>

          {servicesLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="h-32 bg-muted animate-pulse" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : eventServices.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-primary opacity-60" />
              </div>
              <h3 className="font-bold text-lg mb-1">No Services Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Add service providers to make your event a success.</p>
              {(permissions.can_manage_vendors || permissions.is_creator) && (
                <Button onClick={() => setShowAddServiceDialog(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />Add First Service
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {eventServices.map((service: any) => {
                // Backend returns service.service.image (single string from _service_booking_dict)
                const extractFirstImage = (arr: any) => {
                  if (!Array.isArray(arr) || arr.length === 0) return '';
                  const first = arr[0];
                  if (typeof first === 'string') return first;
                  return first?.url || first?.image_url || first?.file_url || first?.thumbnail_url || '';
                };
                const serviceImage = service.service?.image
                  || service.service?.primary_image
                  || service.service?.cover_image
                  || service.service?.image_url
                  || extractFirstImage(service.service?.images)
                  || extractFirstImage(service.service?.gallery_images)
                  || '';

                const isConfirmed = ['completed', 'confirmed', 'assigned', 'accepted'].includes(service.status);
                // provider_service_id is the UserService id that was added to the event
                const providerServiceId = service.provider_service_id || service.service?.id;
                const serviceCategory = (service.service?.category || service.service?.service_type_name || service.service?.title || '').toLowerCase();
                const isPhotographyService = serviceCategory.includes('photo') || serviceCategory.includes('cinema') || serviceCategory.includes('video') || serviceCategory.includes('film');
                const matchedLibrary = isPhotographyService && isConfirmed
                  ? eventPhotoLibraries.find((lib: any) =>
                      lib.user_service_id === providerServiceId ||
                      lib.user_service_id === service.provider_service_id ||
                      lib.user_service_id === service.service?.id ||
                      (lib.service?.id && (lib.service.id === providerServiceId || lib.service.id === service.provider_service_id))
                    ) ?? (eventPhotoLibraries.length > 0 ? eventPhotoLibraries[0] : null)
                  : null;

                const statusStyle: Record<string, string> = {
                  completed: 'bg-emerald-500 text-white',
                  confirmed: 'bg-blue-500 text-white',
                  accepted: 'bg-blue-500 text-white',
                  assigned: 'bg-blue-500 text-white',
                  pending: 'bg-amber-500 text-white',
                  cancelled: 'bg-destructive text-white',
                };

                return (
                  <div
                    key={service.id}
                    className={`rounded-2xl border overflow-hidden bg-card transition-all hover:shadow-md
                      ${isConfirmed ? 'border-emerald-200 dark:border-emerald-800/60' : 'border-border'}`}
                  >
                    {/* Image Header */}
                    <div className="relative h-32 bg-gradient-to-br from-primary/10 to-muted overflow-hidden">
                      {serviceImage ? (
                        <img src={serviceImage} alt={service.service?.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Users className="w-10 h-10 text-muted-foreground/20" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                      {/* Status badge */}
                      <div className="absolute top-3 left-3">
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusStyle[service.status] || 'bg-muted text-muted-foreground'}`}>
                          {service.status}
                        </span>
                      </div>

                      {/* Price */}
                      {service.quoted_price && (
                        <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full font-semibold">
                          {formatPrice(service.quoted_price)}
                        </div>
                      )}

                      {/* Service title on image */}
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
                        <h3 className="text-white font-bold text-sm truncate">{service.service?.title || 'Unnamed Service'}</h3>
                        {(permissions.can_manage_vendors || permissions.is_creator) && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => toggleServiceComplete(service.id)}
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                                ${isConfirmed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/70 bg-white/10 hover:border-white'}`}
                            >
                              {isConfirmed && <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-3">
                      {/* Provider info */}
                      <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {(service.service?.provider_name || service.service?.title || 'S')[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate flex items-center gap-1">
                            {service.service?.title || 'Unnamed Service'}
                            {(service.service?.verification_status === 'verified' || service.service?.verified) && <VerifiedServiceBadge size="xs" />}
                          </p>
                          {service.service?.provider_name && (
                            <p className="text-[11px] text-muted-foreground truncate">{service.service.provider_name}</p>
                          )}
                        </div>
                        {(permissions.can_manage_vendors || permissions.is_creator) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteServiceId(service.id)}
                            className="ml-auto text-muted-foreground hover:text-destructive h-7 w-7 p-0 flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>

                      {/* Photo Library CTA for photography services */}
                      {isPhotographyService && isConfirmed && (
                        matchedLibrary ? (
                          <button
                            onClick={() => navigate(`/photo-library/${matchedLibrary.id}`)}
                            className="w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 hover:bg-muted transition-colors px-3 py-2 text-sm"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {matchedLibrary.photos && matchedLibrary.photos.length > 0 ? (
                                <div className="flex -space-x-1 shrink-0">
                                  {matchedLibrary.photos.slice(0, 3).map((p: any, i: number) => (
                                    <img key={i} src={p.url} alt="" className="w-6 h-6 rounded-full object-cover border-2 border-card" />
                                  ))}
                                </div>
                              ) : (
                                <Images className="w-4 h-4 text-primary flex-shrink-0" />
                              )}
                              <span className="font-medium text-foreground text-xs truncate">Photo Library</span>
                            </div>
                            <span className="text-[11px] text-muted-foreground bg-background px-2 py-0.5 rounded-full border border-border shrink-0">
                              {matchedLibrary.photo_count || 0} photos
                            </span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-3 py-2">
                            <Images className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs text-muted-foreground">No photo library shared yet</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="committee" className="space-y-6">
          <EventCommittee eventId={id!} permissions={permissions} eventTitle={event?.title || 'Event'} />
        </TabsContent>

        <TabsContent value="contributions" className="space-y-6">
          <EventContributions eventId={id!} eventTitle={eventTitle} eventBudget={apiEvent?.budget ? parseFloat(String(apiEvent.budget).replace(/[^0-9]/g, '')) : undefined} eventEndDate={apiEvent?.start_date} isCreator={isCreator} permissions={permissions} />
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6">
          <EventExpenses
            eventId={id!}
            eventTitle={eventTitle}
            eventBudget={apiEvent?.budget ? parseFloat(String(apiEvent.budget).replace(/[^0-9]/g, '')) : undefined}
            totalRaised={contributionSummary?.total_paid || 0}
            permissions={permissions}
          />
        </TabsContent>

        <TabsContent value="guests" className="space-y-6">
          <EventGuestList eventId={id!} permissions={permissions} />
        </TabsContent>

        <TabsContent value="rsvp" className="space-y-6">
          <EventRSVP eventId={id || ''} eventTitle={eventTitle} permissions={permissions} />
        </TabsContent>

        {(apiEvent as any)?.sells_tickets && (
          <TabsContent value="tickets" className="space-y-4">
            <EventTicketManagement eventId={id!} isCreator={isCreator} />
          </TabsContent>
        )}
      </Tabs>

      {/* Add Service Dialog */}
      <Dialog open={showAddServiceDialog} onOpenChange={setShowAddServiceDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>Add Service Provider</DialogTitle><DialogDescription>Search for a service provider to assign to your event</DialogDescription></DialogHeader>
          <div className="space-y-4 flex-1 min-h-0 flex flex-col">
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, category..." value={serviceSearch} onChange={(e) => handleServiceSearch(e.target.value)} className="pl-9" autoComplete="off" />
            </div>
            <ScrollArea className="flex-1 min-h-0 max-h-[50vh] pr-4">
              <div className="space-y-2">
                {searchLoading && (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                )}
                {!searchLoading && searchResults.map((service: any) => (
                  <button
                    key={service.id}
                    onClick={() => handleAddService(service)}
                    disabled={addingServiceId === service.id}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-3"
                  >
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarImage src={service.primary_image || service.images?.[0]?.url} />
                      <AvatarFallback>{service.title?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{service.title}</span>
                        {(service.verification_status === 'verified' || service.verified) && <VerifiedServiceBadge size="xs" />}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
                        <span className="truncate">{service.category_name || service.category || service.service_type_name}</span>
                        {service.provider?.name && <><span>•</span><span className="truncate">{service.provider.name}</span></>}
                        {service.min_price && <><span>•</span><span className="whitespace-nowrap">From TZS {formatPrice(service.min_price)}</span></>}
                      </div>
                    </div>
                    {addingServiceId === service.id && <Loader2 className="w-4 h-4 animate-spin" />}
                  </button>
                ))}
                {!searchLoading && serviceSearch.length >= 2 && searchResults.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">No service providers found</div>
                )}
                {!searchLoading && serviceSearch.length < 2 && (
                  <div className="text-center py-8 text-muted-foreground">Type at least 2 characters to search</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventManagement;
