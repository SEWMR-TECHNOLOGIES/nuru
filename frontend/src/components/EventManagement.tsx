import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Users, CheckCircle2, Plus, Settings, UserPlus, DollarSign, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import PledgeDialog from './PledgeDialog';

interface EventData {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  expectedGuests: string;
  budget: string;
  eventType: string;
  services: any[];
  status: string;
  images?: string[]; // <-- images may be stored as base64 or URLs
}

interface CommitteeMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  contact: string;
}

interface Contribution {
  id: string;
  name: string;
  amount: string;
  type: 'money' | 'service' | 'item';
  status: 'pledged' | 'received';
  date: string;
}

// Add a helper to format TZS
const formatTZS = (amount: string | number) => {
  if (!amount && amount !== 0) return '';
  const num = typeof amount === 'string' ? parseInt(amount.replace(/[^0-9]/g, '')) : amount;
  if (!num) return `TZS 0`;
  return `TZS ${num.toLocaleString()}`;
};

const EventManagement = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddServiceDialog, setShowAddServiceDialog] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');

  const allAvailableServices = [
    { id: 's1', name: 'Event Coordinator', category: 'Planning', estimatedCost: 'TZS 500,000-2,000,000' },
    { id: 's2', name: 'Photographer', category: 'Media', estimatedCost: 'TZS 500,000-2,000,000' },
    { id: 's3', name: 'Videographer', category: 'Media', estimatedCost: 'TZS 800,000-3,000,000' },
    { id: 's4', name: 'Catering Service', category: 'Food & Drink', estimatedCost: 'TZS 1,000,000-5,000,000' },
    { id: 's5', name: 'DJ/Music', category: 'Entertainment', estimatedCost: 'TZS 300,000-1,500,000' },
    { id: 's6', name: 'Decorations', category: 'Decor', estimatedCost: 'TZS 400,000-2,000,000' },
    { id: 's7', name: 'Transportation', category: 'Logistics', estimatedCost: 'TZS 200,000-1,000,000' },
    { id: 's8', name: 'Wedding Cake', category: 'Food & Drink', estimatedCost: 'TZS 300,000-1,500,000' },
    { id: 's9', name: 'Florist', category: 'Decor', estimatedCost: 'TZS 400,000-2,000,000' },
    { id: 's10', name: 'Bridal Makeup', category: 'Beauty', estimatedCost: 'TZS 200,000-800,000' },
    { id: 's11', name: 'Wedding Officiant', category: 'Ceremony', estimatedCost: 'TZS 100,000-500,000' },
    { id: 's12', name: 'Birthday Cake', category: 'Food & Drink', estimatedCost: 'TZS 150,000-800,000' },
    { id: 's13', name: 'Party Entertainment', category: 'Entertainment', estimatedCost: 'TZS 300,000-1,500,000' },
    { id: 's14', name: 'Party Favors', category: 'Extras', estimatedCost: 'TZS 100,000-500,000' },
    { id: 's15', name: 'Memorial Program', category: 'Ceremony', estimatedCost: 'TZS 100,000-400,000' },
    { id: 's16', name: 'Funeral Director', category: 'Planning', estimatedCost: 'TZS 500,000-2,000,000' },
    { id: 's17', name: 'Memorial Flowers', category: 'Decor', estimatedCost: 'TZS 300,000-1,500,000' },
  ];

  const filteredServices = allAvailableServices.filter(service =>
    service.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
    service.category.toLowerCase().includes(serviceSearch.toLowerCase())
  );
  
  const [committee, setCommittee] = useState<CommitteeMember[]>([
    {
      id: '1',
      name: 'Michael Chen',
      role: 'Best Man',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      contact: 'michael@email.com'
    },
    {
      id: '2',
      name: 'Emily Davis',
      role: 'Maid of Honor',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b5c5?w=150&h=150&fit=crop&crop=face',
      contact: 'emily@email.com'
    }
  ]);

  const [contributions, setContributions] = useState<Contribution[]>([
    {
      id: '1',
      name: 'Robert Johnson',
      amount: '500',
      type: 'money',
      status: 'received',
      date: '2024-12-10'
    },
    {
      id: '2',
      name: 'Lisa Wong',
      amount: 'Photography Services',
      type: 'service',
      status: 'pledged',
      date: '2024-12-15'
    },
    {
      id: '3',
      name: 'David Smith',
      amount: 'Sound System',
      type: 'item',
      status: 'received',
      date: '2024-12-08'
    }
  ]);

  const [newMember, setNewMember] = useState({ name: '', role: '', contact: '' });

  // Lightbox state for zooming images
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    const events = JSON.parse(localStorage.getItem('events') || '[]');
    const foundEvent = events.find((e: EventData) => e.id === id);
    
    if (foundEvent) {
      setEvent(foundEvent);
    }
  }, [id]);

  const addCommitteeMember = () => {
    if (newMember.name && newMember.role) {
      const member: CommitteeMember = {
        id: Date.now().toString(),
        ...newMember,
        avatar: `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face`
      };
      setCommittee([...committee, member]);
      setNewMember({ name: '', role: '', contact: '' });
    }
  };

  const toggleServiceComplete = (serviceId: string) => {
    if (!event) return;
    
    const updatedServices = event.services.map(service =>
      service.id === serviceId ? { ...service, completed: !service.completed } : service
    );
    
    const updatedEvent = { ...event, services: updatedServices };
    setEvent(updatedEvent);
    
    // Update localStorage
    const events = JSON.parse(localStorage.getItem('events') || '[]');
    const updatedEvents = events.map((e: EventData) => 
      e.id === id ? updatedEvent : e
    );
    localStorage.setItem('events', JSON.stringify(updatedEvents));
  };

  const handleRemoveProvider = (serviceId: string) => {
    if (!event) return;
    
    const updatedServices = event.services.map(service =>
      service.id === serviceId ? { ...service, providerName: undefined } : service
    );
    
    const updatedEvent = { ...event, services: updatedServices };
    setEvent(updatedEvent);
    
    const events = JSON.parse(localStorage.getItem('events') || '[]');
    const updatedEvents = events.map((e: EventData) =>
      e.id === id ? updatedEvent : e
    );
    localStorage.setItem('events', JSON.stringify(updatedEvents));
  };

  const handleAddService = (selectedService: any) => {
    if (!event) return;

    const newService = {
      id: `service_${Date.now()}`,
      name: selectedService.name,
      category: selectedService.category,
      estimated_cost: selectedService.estimatedCost,
      priority: 'medium',
      completed: false,
    };

    const updatedEvent = {
      ...event,
      services: [...event.services, newService]
    };
    
    setEvent(updatedEvent);
    
    const events = JSON.parse(localStorage.getItem('events') || '[]');
    const updatedEvents = events.map((e: EventData) =>
      e.id === id ? updatedEvent : e
    );
    localStorage.setItem('events', JSON.stringify(updatedEvents));
    setShowAddServiceDialog(false);
    setServiceSearch('');
  };

  if (!event) {
    return <div>Event not found</div>;
  }

  const completedServices = event.services.filter(s => s.completed).length;
  const totalServices = event.services.length;
  const progress = totalServices > 0 ? (completedServices / totalServices) * 100 : 0;

  const totalContributions = contributions
    .filter(c => c.status === 'received' && c.type === 'money')
    .reduce((sum, c) => sum + (parseInt(c.amount.replace(/[^0-9]/g, '')) || 0), 0);

  // image helpers
  const hasImages = Array.isArray(event.images) && event.images.length > 0;
  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };
  const closeLightbox = () => setLightboxOpen(false);

  return (
    <div>
      {/* Header with improved mobile layout */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-2xl md:text-3xl font-bold">{event.title}</h1>
          <Button
            variant="outline"
            size="icon"
            className="flex-shrink-0"
            onClick={() => navigate('/my-events')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{event.date}</span>
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{event.location}</span>
          </span>
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{event.expectedGuests} guests</span>
          </span>
        </div>
      </div>


      {/* Event images: show either one full or a scrolling row of thumbnails */}
      {hasImages && (
        <div>
          {event.images!.length === 1 ? (
            <div className="relative w-full h-72 rounded-lg overflow-hidden border border-border">
              <img
                src={event.images![0]}
                alt={`${event.title} image`}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => openLightbox(0)}
              />
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto py-2">
              {event.images!.map((src, idx) => (
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

      {/* Lightbox / zoom modal */}
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
              src={event.images![lightboxIndex]}
              alt={`zoom ${lightboxIndex}`}
              className="w-full h-full object-contain rounded"
              style={{ maxHeight: '80vh' }}
            />
            {/* optional: next/prev arrows */}
            {event.images!.length > 1 && (
              <>
                <button
                  onClick={() => setLightboxIndex((i) => (i - 1 + event.images!.length) % event.images!.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded-full"
                  aria-label="Previous"
                >
                  ‹
                </button>
                <button
                  onClick={() => setLightboxIndex((i) => (i + 1) % event.images!.length)}
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto gap-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm py-2">Overview</TabsTrigger>
          <TabsTrigger value="services" className="text-xs sm:text-sm py-2">Services</TabsTrigger>
          <TabsTrigger value="committee" className="text-xs sm:text-sm py-2">Committee</TabsTrigger>
          <TabsTrigger value="contributions" className="text-xs sm:text-sm py-2">Contributions</TabsTrigger>
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
                  <div className="text-2xl font-bold">{event.budget}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatTZS(totalContributions)} received in contributions
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
              <p className="text-muted-foreground">{event.description}</p>
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
                {event.services.map((service) => (
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
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                          <h4 className={`font-medium ${service.completed ? "line-through text-muted-foreground" : ""}`}>
                            {service.name}
                          </h4>
                          <Badge className={
                            service.priority === 'high' ? 'bg-red-100 text-red-800' :
                            service.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }>
                            {service.priority}
                          </Badge>
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
                            className="bg-[hsl(var(--nuru-yellow))] hover:bg-[hsl(var(--nuru-yellow))]/90 text-foreground font-medium"
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
                {committee.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Avatar>
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h4 className="font-medium">{member.name}</h4>
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                      <p className="text-sm text-muted-foreground">{member.contact}</p>
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
                    placeholder="Contact"
                    value={newMember.contact}
                    onChange={(e) => setNewMember({ ...newMember, contact: e.target.value })}
                  />
                </div>
                <Button onClick={addCommitteeMember} className="mt-3" size="sm">
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
                onPledgeAdded={(pledge) => setContributions([...contributions, pledge])} 
              />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {contributions.map((contribution) => (
                  <div key={contribution.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      contribution.type === 'money' ? 'bg-green-100' :
                      contribution.type === 'service' ? 'bg-blue-100' : 'bg-purple-100'
                    }`}>
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{contribution.name}</h4>
                      <div className="text-sm text-muted-foreground">
                        {contribution.type === 'money' ? formatTZS(contribution.amount) : contribution.amount}
                      </div>
                      <p className="text-sm text-muted-foreground">{contribution.date}</p>
                    </div>
                    <Badge className={contribution.status === 'received' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      {contribution.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
