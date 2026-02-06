import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar, MapPin, Users, CheckCircle2, Plus, UserPlus, DollarSign, X, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import PledgeDialog from './PledgeDialog';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import EventRSVP from './EventRSVP';
import { useEvent, useEventCommittee, useEventContributions } from '@/data/useEvents';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/utils/formatPrice';
import { EventManagementSkeleton } from '@/components/ui/EventManagementSkeleton';


const EventManagement = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // API hooks
  const { event: apiEvent, loading: eventLoading, error: eventError } = useEvent(id || null);
  const { members: apiCommittee, addMember, removeMember, loading: committeeLoading } = useEventCommittee(id || null);
  const { contributions: apiContributions, summary: contributionSummary, addContribution, loading: contributionsLoading } = useEventContributions(id || null);

  // Use API data directly - no localStorage fallback
  const event = apiEvent;
  const committee = apiCommittee;
  const contributions = apiContributions;

  useWorkspaceMeta({
    title: event?.title || 'Event Management',
    description: `Manage services, committee, contributions, and invitations for ${event?.title || 'your event'}.`
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [showAddServiceDialog, setShowAddServiceDialog] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
  const [newMember, setNewMember] = useState({ name: '', role: '', contact: '' });

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const allAvailableServices: any[] = [];

  const filteredServices = allAvailableServices.filter((service: any) =>
    service.name?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
    service.category?.toLowerCase().includes(serviceSearch.toLowerCase())
  );


  const handleAddCommitteeMember = async () => {
    if (newMember.name && newMember.role) {
      try {
        await addMember({
          name: newMember.name,
          role: newMember.role,
          email: newMember.contact,
          permissions: ['view']
        });
        toast({ title: "Member added successfully" });
      } catch (err: any) {
        toast({ title: "Failed to add member", description: err?.message || "An error occurred", variant: "destructive" });
      }
      setNewMember({ name: '', role: '', contact: '' });
    }
  };

  const toggleServiceComplete = (serviceId: string) => {
    // TODO: implement via API when service management endpoints are available
  };

  const handleRemoveProvider = (serviceId: string) => {
    // TODO: implement via API
  };

  const handleAddService = (selectedService: any) => {
    // TODO: implement via API
    setShowAddServiceDialog(false);
    setServiceSearch('');
  };

  const handleRemoveService = () => {
    // TODO: implement via API
    setDeleteServiceId(null);
  };

  if (eventLoading) {
    return <EventManagementSkeleton />;
  }

  if (!event) {
    return <div className="text-center py-8 text-muted-foreground">Event not found</div>;
  }

  // Compute values from API event
  const eventServices: any[] = [];
  const completedServices = 0;
  const totalServices = 0;
  const progress = 0;

  const totalContributions = contributionSummary?.total_amount || 0;

  const eventImages = (apiEvent?.gallery_images as string[]) || [];
  const hasImages = eventImages.length > 0;

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };
  const closeLightbox = () => setLightboxOpen(false);

  const eventTitle = apiEvent?.title || '';
  const eventDate = apiEvent?.start_date || '';
  const eventLocation = apiEvent?.location || '';
  const eventGuests = apiEvent?.guest_count || 0;
  const eventBudget = apiEvent?.budget ? formatPrice(apiEvent.budget) : '';
  const eventDescription = apiEvent?.description || '';

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-2xl md:text-3xl font-bold">{eventTitle}</h1>
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            onClick={() => navigate('/my-events')}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{eventDate}</span>
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{eventLocation}</span>
          </span>
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{eventGuests} guests</span>
          </span>
        </div>
      </div>

      {/* Event images */}
      {hasImages && (
        <div className="mb-6">
          {eventImages.length === 1 ? (
            <div className="relative w-full h-72 rounded-lg overflow-hidden border border-border">
              <img
                src={eventImages[0]}
                alt={`${eventTitle} image`}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => openLightbox(0)}
              />
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto py-2">
              {eventImages.map((src, idx) => (
                <div
                  key={idx}
                  className="relative w-56 h-40 flex-shrink-0 rounded-lg overflow-hidden border border-border cursor-pointer"
                  onClick={() => openLightbox(idx)}
                >
                  <img src={src} alt={`event ${idx}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && hasImages && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeLightbox}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeLightbox}
              className="absolute -top-3 -right-3 bg-white rounded-full p-2 shadow z-50"
              aria-label="Close"
            >
              ✕
            </button>
            <img
              src={eventImages[lightboxIndex]}
              alt={`zoom ${lightboxIndex}`}
              className="w-full h-full object-contain rounded"
              style={{ maxHeight: '80vh' }}
            />
            {eventImages.length > 1 && (
              <>
                <button
                  onClick={() => setLightboxIndex((i) => (i - 1 + eventImages.length) % eventImages.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded-full"
                  aria-label="Previous"
                >
                  ‹
                </button>
                <button
                  onClick={() => setLightboxIndex((i) => (i + 1) % eventImages.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded-full"
                  aria-label="Next"
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Service Confirmation Dialog */}
      <AlertDialog open={!!deleteServiceId} onOpenChange={() => setDeleteServiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Service?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this service from your event? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveService} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove Service
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto gap-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm py-2">Overview</TabsTrigger>
          <TabsTrigger value="services" className="text-xs sm:text-sm py-2">Services</TabsTrigger>
          <TabsTrigger value="committee" className="text-xs sm:text-sm py-2">Committee</TabsTrigger>
          <TabsTrigger value="contributions" className="text-xs sm:text-sm py-2">Contributions</TabsTrigger>
          <TabsTrigger value="rsvp" className="text-xs sm:text-sm py-2">RSVP</TabsTrigger>
          <TabsTrigger value="invitations" className="text-xs sm:text-sm py-2">Invitations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Event Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Services Completed</span>
                    <span>{completedServices}/{totalServices}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Budget Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">{eventBudget}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatPrice(totalContributions)} received in contributions
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Team Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">{committee.length}</div>
                  <div className="text-sm text-muted-foreground">committee members</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Event Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{eventDescription}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Service Checklist</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddServiceDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Service
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {eventServices.map((service: any) => (
                  <div
                    key={service.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      service.completed ? "bg-green-50 border-green-200" : "bg-card border-border"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleServiceComplete(service.id)}
                        className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                          service.completed
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-muted-foreground hover:border-primary"
                        }`}
                      >
                        {service.completed && <CheckCircle2 className="w-3 h-3" />}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <h3 className="font-medium">{service.name}</h3>
                            <Badge className={
                              service.priority === 'high'
                                ? 'bg-red-100 text-red-800'
                                : service.priority === 'low'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-green-100 text-green-800'
                            }>
                              {service.priority}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteServiceId(service.id)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-2"
                            title="Remove service"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {service.category} • {service.estimated_cost}
                        </p>
                        
                        {service.providerName ? (
                          <div 
                            className="flex items-center justify-between gap-2 p-2.5 bg-green-50 rounded-lg border border-green-200 cursor-pointer hover:bg-green-100 transition-colors"
                            onClick={() => navigate(`/service/1`)}
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                              <span className="text-sm font-medium text-green-800">
                                {service.providerName}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveProvider(service.id);
                              }}
                              className="p-1 hover:bg-green-200 rounded transition-colors"
                              title="Remove provider"
                            >
                              <X className="w-4 h-4 text-green-700 hover:text-red-600" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-[hsl(var(--nuru-yellow))] hover:bg-[hsl(var(--nuru-yellow))]/90 text-foreground font-medium w-full sm:w-auto"
                            onClick={() => {
                              localStorage.setItem('assignServiceId', service.id);
                              localStorage.setItem('assignEventId', id!);
                              navigate('/find-services');
                            }}
                          >
                            Find Provider
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {eventServices.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No services added yet. Click "Add Service" to get started.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="committee" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Committee Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 mb-6">
                {committee.map((member: any) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Avatar>
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback>{member.name?.charAt(0) || 'M'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h4 className="font-medium">{member.name}</h4>
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                      <p className="text-sm text-muted-foreground">{member.email || member.contact}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Add New Member</h4>
                <div className="grid md:grid-cols-3 gap-3">
                  <Input
                    placeholder="Name"
                    value={newMember.name}
                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  />
                  <Input
                    placeholder="Role"
                    value={newMember.role}
                    onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                  />
                  <Input
                    placeholder="Contact (Email)"
                    value={newMember.contact}
                    onChange={(e) => setNewMember({ ...newMember, contact: e.target.value })}
                  />
                </div>
                <Button onClick={handleAddCommitteeMember} className="mt-3" size="sm">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Member
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contributions" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Contributions & Pledges</CardTitle>
              <PledgeDialog 
                eventId={id!} 
                onPledgeAdded={async (pledge) => {
                  // Use API to add contribution
                  try {
                    await addContribution(pledge);
                  } catch {}
                }} 
              />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {contributions.map((contribution: any) => (
                  <div key={contribution.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      contribution.type === 'money' || contribution.payment_method === 'mpesa' ? 'bg-green-100' :
                      contribution.type === 'service' ? 'bg-blue-100' : 'bg-purple-100'
                    }`}>
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{contribution.contributor_name || contribution.name}</h4>
                      <div className="text-sm text-muted-foreground">
                        {contribution.amount ? formatPrice(contribution.amount) : contribution.amount}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {contribution.created_at ? new Date(contribution.created_at).toLocaleDateString() : contribution.date}
                      </p>
                    </div>
                    <Badge className={
                      (contribution.status === 'received' || contribution.status === 'confirmed') 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }>
                      {contribution.status}
                    </Badge>
                  </div>
                ))}
                {contributions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No contributions yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rsvp" className="space-y-6">
          <EventRSVP eventId={id || ''} />
        </TabsContent>

        <TabsContent value="invitations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Guest Invitations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>Invitation management feature coming soon!</p>
                <p className="text-sm mt-2">Track RSVPs, send reminders, and manage your guest list.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Service Dialog */}
      <Dialog open={showAddServiceDialog} onOpenChange={setShowAddServiceDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Service</DialogTitle>
            <DialogDescription>
              Search and select a service to add to your event checklist
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search services..."
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {filteredServices.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => handleAddService(service)}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    <div className="font-medium">{service.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {service.category} • {service.estimatedCost}
                    </div>
                  </button>
                ))}
                {filteredServices.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No services found
                  </div>
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
