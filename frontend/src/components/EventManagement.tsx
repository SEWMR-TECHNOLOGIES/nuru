import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar, MapPin, Users, UserCheck, CheckCircle2, Plus, Search, Trash2, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useEvent } from '@/data/useEvents';
import { usePolling } from '@/hooks/usePolling';
import { formatPrice } from '@/utils/formatPrice';
import { EventManagementSkeleton } from '@/components/ui/EventManagementSkeleton';
import { eventsApi, showCaughtError } from '@/lib/api';
import { servicesApi } from '@/lib/api/services';
import { toast } from 'sonner';

const EventManagement = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { event: apiEvent, loading: eventLoading, refetch: refetchEvent } = useEvent(id || null);
  usePolling(refetchEvent, 15000);

  const event = apiEvent;

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

  useEffect(() => {
    if (id) loadEventServices();
  }, [id]);

  const completedServices = eventServices.filter((s: any) => s.status === 'completed').length;
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
        quoted_price: service.min_price,
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

  if (eventLoading) return <EventManagementSkeleton />;
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
          <h1 className="text-2xl md:text-3xl font-bold">{eventTitle}</h1>
          <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => navigate('/my-events')}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2"><Calendar className="w-4 h-4 flex-shrink-0" /><span className="truncate">{eventDate}</span></span>
          <span className="flex items-center gap-2"><MapPin className="w-4 h-4 flex-shrink-0" /><span className="truncate">{eventLocation}</span></span>
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto gap-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm py-2">Overview</TabsTrigger>
          <TabsTrigger value="services" className="text-xs sm:text-sm py-2">Services</TabsTrigger>
          <TabsTrigger value="committee" className="text-xs sm:text-sm py-2">Committee</TabsTrigger>
          <TabsTrigger value="contributions" className="text-xs sm:text-sm py-2">Contributions</TabsTrigger>
          <TabsTrigger value="guests" className="text-xs sm:text-sm py-2">Guests</TabsTrigger>
          <TabsTrigger value="rsvp" className="text-xs sm:text-sm py-2">RSVP</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card><CardHeader className="pb-3"><CardTitle className="text-lg">Event Progress</CardTitle></CardHeader><CardContent><div className="space-y-2"><div className="flex justify-between text-sm"><span>Services Completed</span><span>{completedServices}/{totalServices}</span></div><div className="w-full bg-muted rounded-full h-2"><div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} /></div></div></CardContent></Card>
            <Card><CardHeader className="pb-3"><CardTitle className="text-lg">Budget Status</CardTitle></CardHeader><CardContent><div className="space-y-2"><div className="text-2xl font-bold">{eventBudget}</div><div className="text-sm text-muted-foreground">Budget allocated</div></div></CardContent></Card>
            <Card><CardHeader className="pb-3"><CardTitle className="text-lg">Guest Overview</CardTitle></CardHeader><CardContent><div className="space-y-2"><div className="text-2xl font-bold">{eventGuestCount}</div><div className="text-sm text-muted-foreground">of {expectedGuests} expected guests</div></div></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle>Event Description</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">{eventDescription}</p></CardContent></Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Service Checklist</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowAddServiceDialog(true)}><Plus className="w-4 h-4 mr-2" />Add Service</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {servicesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading services...</div>
                ) : eventServices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No services added yet. Click "Add Service" to get started.</div>
                ) : (
                  eventServices.map((service: any) => (
                    <div key={service.id} className={`p-4 rounded-lg border transition-colors ${service.status === 'completed' ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-card border-border"}`}>
                      <div className="flex items-start gap-3">
                        <button onClick={() => toggleServiceComplete(service.id)} className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${service.status === 'completed' ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground hover:border-primary"}`}>
                          {service.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="font-medium">{service.service?.title || 'Unnamed Service'}</h3>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteServiceId(service.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            {service.service?.category && <span>{service.service.category} • </span>}
                            {service.service?.provider_name && <span>by {service.service.provider_name} • </span>}
                            <Badge variant="outline" className="text-xs">{service.status}</Badge>
                          </p>
                          {service.quoted_price && <p className="text-sm font-medium">{formatPrice(service.quoted_price)}</p>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="committee" className="space-y-6">
          <EventCommittee eventId={id!} />
        </TabsContent>

        <TabsContent value="contributions" className="space-y-6">
          <EventContributions eventId={id!} eventTitle={eventTitle} eventBudget={apiEvent?.budget ? parseFloat(String(apiEvent.budget).replace(/[^0-9]/g, '')) : undefined} />
        </TabsContent>

        <TabsContent value="guests" className="space-y-6">
          <EventGuestList eventId={id!} />
        </TabsContent>

        <TabsContent value="rsvp" className="space-y-6">
          <EventRSVP eventId={id || ''} />
        </TabsContent>
      </Tabs>

      {/* Add Service Dialog */}
      <Dialog open={showAddServiceDialog} onOpenChange={setShowAddServiceDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Add Service Provider</DialogTitle><DialogDescription>Search for a service provider to assign to your event</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, category..." value={serviceSearch} onChange={(e) => handleServiceSearch(e.target.value)} className="pl-9" />
            </div>
            <ScrollArea className="h-[350px] pr-4">
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
                      <div className="font-medium truncate">{service.title}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {service.category_name || service.category || service.service_type_name} 
                        {service.provider?.name && <> • {service.provider.name}</>}
                      </div>
                      {service.min_price && (
                        <div className="text-xs text-muted-foreground">From TZS {formatPrice(service.min_price)}</div>
                      )}
                    </div>
                    {service.verified && <Badge className="bg-green-100 text-green-800 text-xs flex-shrink-0"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>}
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
