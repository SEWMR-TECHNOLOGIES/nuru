import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle2, Plus, Image, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Service {
  id: string;
  name: string;
  category: string;
  estimated_cost: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  hasProvider?: boolean;
  providerDetails?: string;
}

const CreateEvent = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: undefined as Date | undefined,
    time: '',
    location: '',
    expectedGuests: '',
    budget: '',
    eventType: 'wedding'
  });

  const [recommendedServices, setRecommendedServices] = useState<Service[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);

  // Image upload state
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // Convert file to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImages(prev => [...prev, ...filesArray]);
      setPreviews(prev => [...prev, ...filesArray.map(file => URL.createObjectURL(file))]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const eventTypes = [
    { id: 'wedding', name: 'Wedding', icon: '💒' },
    { id: 'birthday', name: 'Birthday', icon: '🎂' },
    { id: 'memorial', name: 'Memorial', icon: '🕊️' },
    { id: 'graduation', name: 'Graduation', icon: '🎓' },
    { id: 'anniversary', name: 'Anniversary', icon: '💖' }
  ];

  const getRecommendedServices = (eventType: string, guests: number) => {
    const baseServices = [
      { name: 'Event Coordinator', category: 'Planning', priority: 'high' as const },
      { name: 'Photographer', category: 'Media', priority: 'high' as const },
      { name: 'Catering Service', category: 'Food & Drink', priority: 'high' as const },
      { name: 'DJ/Music', category: 'Entertainment', priority: 'medium' as const },
      { name: 'Decorations', category: 'Decor', priority: 'medium' as const },
      { name: 'Transportation', category: 'Logistics', priority: 'low' as const }
    ];

    let additionalServices: any[] = [];

    switch (eventType) {
      case 'wedding':
        additionalServices = [
          { name: 'Wedding Cake', category: 'Food & Drink', priority: 'high' as const },
          { name: 'Florist', category: 'Decor', priority: 'high' as const },
          { name: 'Bridal Makeup', category: 'Beauty', priority: 'medium' as const },
          { name: 'Wedding Officiant', category: 'Ceremony', priority: 'high' as const }
        ];
        break;
      case 'birthday':
        additionalServices = [
          { name: 'Birthday Cake', category: 'Food & Drink', priority: 'high' as const },
          { name: 'Party Entertainment', category: 'Entertainment', priority: 'medium' as const },
          { name: 'Party Favors', category: 'Extras', priority: 'low' as const }
        ];
        break;
      case 'memorial':
        additionalServices = [
          { name: 'Memorial Program', category: 'Ceremony', priority: 'high' as const },
          { name: 'Funeral Director', category: 'Planning', priority: 'high' as const },
          { name: 'Memorial Flowers', category: 'Decor', priority: 'medium' as const }
        ];
        break;
    }

    const allServices = [...baseServices, ...additionalServices].map((service, index) => ({
      ...service,
      id: `service_${index}`,
      estimated_cost: guests > 100 ? 'TZS 2,000,000-5,000,000' : 'TZS 500,000-2,000,000',
      completed: false
    }));

    return allServices;
  };

  const handleGenerateRecommendations = () => {
    const guests = parseInt(formData.expectedGuests) || 50;
    const services = getRecommendedServices(formData.eventType, guests);
    setRecommendedServices(services);
    setShowRecommendations(true);
  };

  const toggleServiceComplete = (serviceId: string) => {
    setRecommendedServices(prev => prev.map(service =>
      service.id === serviceId ? { ...service, completed: !service.completed } : service
    ));
  };

  const formatBudget = (budget: string) => {
    if (!budget) return '';
    const number = parseInt(budget.replace(/\D/g, '')) || 0;
    return `TZS ${number.toLocaleString('en-US')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Convert images to Base64
    const base64Images = await Promise.all(images.map(file => fileToBase64(file)));

    // Only include selected services (those marked as completed)
    const selectedServices = recommendedServices.filter(s => s.completed);

    const event = {
      id: Date.now().toString(),
      ...formData,
      budget: formatBudget(formData.budget),
      images: base64Images,
      services: selectedServices,
      createdAt: new Date().toISOString()
    };

    const existingEvents = JSON.parse(localStorage.getItem('events') || '[]');
    localStorage.setItem('events', JSON.stringify([...existingEvents, event]));

    navigate(`/event-management/${event.id}`);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Create New Event</h1>
        <p className="text-muted-foreground">Plan your perfect event with our comprehensive toolkit</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Event Type Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Event Type</label>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {eventTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, eventType: type.id })}
                    className={cn(
                      "p-3 rounded-lg border text-center transition-colors",
                      formData.eventType === type.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="text-2xl mb-1">{type.icon}</div>
                    <div className="text-sm font-medium">{type.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Title and Location */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Event Title</label>
                <Input
                  placeholder="e.g., Sarah & John's Wedding"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Location</label>
                <Input
                  placeholder="Event venue or address"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Textarea
                placeholder="Describe your event..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>

            {/* Date, Time, Guests */}
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Event Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.date && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {formData.date ? format(formData.date, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.date}
                      onSelect={(date) => setFormData({ ...formData, date })}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Time</label>
                <Input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Expected Guests</label>
                <Input
                  type="number"
                  placeholder="50"
                  value={formData.expectedGuests}
                  onChange={(e) => setFormData({ ...formData, expectedGuests: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm font-medium mb-2">Estimated Budget</label>
              <Input
                placeholder="e.g., $10,000"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">Event Images (optional)</label>
              <div className="flex items-center gap-2">
                <label className="p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors">
                  <Image className="w-5 h-5 text-muted-foreground" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
              </div>

              {previews.length > 0 && (
                <div className="mt-4">
                  {previews.length === 1 ? (
                    <div className="relative w-full h-64 rounded-lg overflow-hidden border border-border">
                      <img src={previews[0]} alt="preview" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(0)}
                        className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto py-1">
                      {previews.map((src, idx) => (
                        <div key={idx} className="relative w-40 h-32 flex-shrink-0 rounded-lg overflow-hidden border border-border">
                          <img src={src} alt={`preview ${idx}`} className="w-full h-full object-cover" />
                          <button
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Service Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Service Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            {!showRecommendations ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Get personalized service recommendations based on your event type and guest count
                </p>
                <Button
                  type="button"
                  onClick={handleGenerateRecommendations}
                  disabled={!formData.eventType || !formData.expectedGuests}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Generate Recommendations
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Recommended Services Checklist</h3>
                  <div className="text-sm text-muted-foreground">
                    {recommendedServices.filter(s => s.completed).length} / {recommendedServices.length} completed
                  </div>
                </div>
                
                <div className="grid gap-3">
                  {recommendedServices.map((service) => (
                    <div
                      key={service.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                        service.completed ? "bg-green-50 border-green-200" : "bg-card border-border"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleServiceComplete(service.id)}
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                          service.completed
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-muted-foreground hover:border-primary"
                        )}
                      >
                        {service.completed && <CheckCircle2 className="w-3 h-3" />}
                      </button>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={cn(
                            "font-medium",
                            service.completed && "line-through text-muted-foreground"
                          )}>
                            {service.name}
                          </h4>
                          <Badge className={getPriorityColor(service.priority)}>
                            {service.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {service.category} • {service.estimated_cost}
                        </p>
                        {!service.hasProvider && (
                          <Button
                            size="sm"
                            className="mt-2 bg-[hsl(var(--nuru-yellow))] hover:bg-[hsl(var(--nuru-yellow))]/90 text-foreground font-medium"
                            onClick={() => alert('Provider lookup feature coming soon!')}
                          >
                            Find Provider
                          </Button>
                        )}
                        {service.hasProvider && service.providerDetails && (
                          <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-green-800">Provider Assigned</span>
                            </div>
                            <p className="text-sm text-green-700">{service.providerDetails}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={!formData.title || !formData.date}>
            Create Event
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateEvent;
