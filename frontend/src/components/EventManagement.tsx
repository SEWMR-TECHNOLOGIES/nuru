import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar, MapPin, Users, UserCheck, CheckCircle2, Plus, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import EventRSVP from './EventRSVP';
import EventGuestList from './events/EventGuestList';
import EventCommittee from './events/EventCommittee';
import EventContributions from './events/EventContributions';
import { useEvent } from '@/data/useEvents';
import { usePolling } from '@/hooks/usePolling';
import { formatPrice } from '@/utils/formatPrice';
import { EventManagementSkeleton } from '@/components/ui/EventManagementSkeleton';

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

  const allAvailableServices: any[] = [];
  const filteredServices = allAvailableServices.filter((s: any) =>
    s.name?.toLowerCase().includes(serviceSearch.toLowerCase()) || s.category?.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const toggleServiceComplete = (_id: string) => {};
  const handleRemoveProvider = (_id: string) => {};
  const handleAddService = (_s: any) => { setShowAddServiceDialog(false); setServiceSearch(''); };
  const handleRemoveService = () => { setDeleteServiceId(null); };

  if (eventLoading) return <EventManagementSkeleton />;
  if (!event) return <div className="text-center py-8 text-muted-foreground">Event not found</div>;

  const eventServices: any[] = [];
  const completedServices = 0;
  const totalServices = 0;
  const progress = 0;

  const eventImages = (apiEvent?.gallery_images as string[]) || [];
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
          <span className="flex items-center gap-2"><UserCheck className="w-4 h-4 flex-shrink-0" /><span className="truncate">{eventGuestCount} confirmed</span></span>
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
                {eventServices.map((service: any) => (
                  <div key={service.id} className={`p-4 rounded-lg border transition-colors ${service.completed ? "bg-green-50 border-green-200" : "bg-card border-border"}`}>
                    <div className="flex items-start gap-3">
                      <button onClick={() => toggleServiceComplete(service.id)} className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${service.completed ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground hover:border-primary"}`}>
                        {service.completed && <CheckCircle2 className="w-3 h-3" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-medium">{service.name}</h3>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteServiceId(service.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{service.category} • {service.estimated_cost}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {eventServices.length === 0 && <div className="text-center py-8 text-muted-foreground">No services added yet. Click "Add Service" to get started.</div>}
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
          <DialogHeader><DialogTitle>Add Service</DialogTitle><DialogDescription>Search and select a service to add to your event checklist</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Search services..." value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} className="pl-9" /></div>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {filteredServices.map((service) => (
                  <button key={service.id} onClick={() => handleAddService(service)} className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted transition-colors">
                    <div className="font-medium">{service.name}</div>
                    <div className="text-sm text-muted-foreground">{service.category} • {service.estimatedCost}</div>
                  </button>
                ))}
                {filteredServices.length === 0 && <div className="text-center py-8 text-muted-foreground">No services found</div>}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventManagement;
