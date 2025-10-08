import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Star, Calendar as CalendarIcon, MapPin, CheckCircle, Award, Users, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';

interface ServiceData {
  id: string;
  name: string;
  category: string;
  description: string;
  basePrice: string;
  rating: number;
  totalReviews: number;
  location: string;
  yearsExperience: number;
  verified: boolean;
  availability: string;
  images: string[];
  pastEvents: Array<{
    name: string;
    date: string;
    type: string;
    rating: number;
  }>;
  reviews: Array<{
    id: string;
    clientName: string;
    rating: number;
    comment: string;
    date: string;
    eventType: string;
  }>;
  packages: Array<{
    name: string;
    price: string;
    features: string[];
  }>;
}

const ServiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState<ServiceData | null>(null);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);

  useEffect(() => {
    // Check localStorage services first
    const services = JSON.parse(localStorage.getItem('myServices') || '[]');
    let foundService = services.find((s: ServiceData) => s.id === id);
    
    // If not found, check predefined Find Services providers
    if (!foundService) {
      const findServicesProviders = [
        {
          id: '1',
          name: 'Elite Photography Studios',
          category: 'Photography',
          description: 'Professional wedding and event photography with 8+ years experience',
          basePrice: 'From 300,000 TZS',
          rating: 4.9,
          totalReviews: 127,
          location: 'Dar es Salaam',
          yearsExperience: 8,
          verified: true,
          availability: 'Available',
          images: ['https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&h=300&fit=crop'],
          pastEvents: [
            { name: 'Sarah & John Wedding', date: '2024-11-10', type: 'Wedding', rating: 5 },
            { name: 'Corporate Gala 2024', date: '2024-10-15', type: 'Corporate', rating: 5 },
            { name: 'Birthday Celebration', date: '2024-09-20', type: 'Birthday', rating: 4 }
          ],
          reviews: [
            { id: '1', clientName: 'Sarah Johnson', rating: 5, comment: 'Absolutely stunning photos! Captured every moment perfectly.', date: '2024-11-12', eventType: 'Wedding' },
            { id: '2', clientName: 'David Moshi', rating: 5, comment: 'Very professional and creative. Highly recommend!', date: '2024-10-17', eventType: 'Corporate' }
          ],
          packages: [
            { name: 'Basic', price: '300,000 TZS', features: ['4 hours coverage', '100 edited photos', 'Digital delivery'] },
            { name: 'Premium', price: '600,000 TZS', features: ['8 hours coverage', '300 edited photos', 'Digital + Print album', 'Drone shots'] }
          ]
        },
        {
          id: '2',
          name: 'Royal Events Decoration',
          category: 'Decoration',
          description: 'Luxury event decoration and styling for weddings, parties, and corporate events',
          basePrice: 'From 500,000 TZS',
          rating: 4.8,
          totalReviews: 89,
          location: 'Arusha',
          yearsExperience: 6,
          verified: true,
          availability: 'Available',
          images: ['https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=400&h=300&fit=crop'],
          pastEvents: [
            { name: 'Luxury Wedding', date: '2024-11-05', type: 'Wedding', rating: 5 },
            { name: 'Product Launch', date: '2024-10-22', type: 'Corporate', rating: 5 }
          ],
          reviews: [
            { id: '1', clientName: 'Grace Kimaro', rating: 5, comment: 'The decorations were breathtaking! Everyone loved the setup.', date: '2024-11-07', eventType: 'Wedding' }
          ],
          packages: [
            { name: 'Basic', price: '500,000 TZS', features: ['Basic venue setup', 'Table decorations', 'Centerpieces'] },
            { name: 'Premium', price: '1,200,000 TZS', features: ['Full venue transformation', 'Custom design', 'Lighting effects', 'Floral arrangements'] }
          ]
        },
        {
          id: '3',
          name: 'Master Chef Catering',
          category: 'Catering',
          description: 'Authentic Tanzanian and international cuisine for all event sizes',
          basePrice: 'From 15,000 TZS/person',
          rating: 4.7,
          totalReviews: 156,
          location: 'Mwanza',
          yearsExperience: 10,
          verified: false,
          availability: 'Available',
          images: ['https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&h=300&fit=crop'],
          pastEvents: [
            { name: 'Wedding Reception', date: '2024-11-01', type: 'Wedding', rating: 5 },
            { name: 'Corporate Dinner', date: '2024-10-18', type: 'Corporate', rating: 4 }
          ],
          reviews: [
            { id: '1', clientName: 'Hassan Ali', rating: 5, comment: 'Delicious food and excellent service!', date: '2024-11-03', eventType: 'Wedding' }
          ],
          packages: [
            { name: 'Basic', price: '15,000 TZS/person', features: ['3-course meal', 'Soft drinks', 'Basic service'] },
            { name: 'Premium', price: '30,000 TZS/person', features: ['5-course meal', 'Premium beverages', 'Full service staff', 'Custom menu'] }
          ]
        },
        {
          id: '4',
          name: 'Sound & Lights Pro',
          category: 'Audio/Visual',
          description: 'Professional sound systems, lighting, and DJ services',
          basePrice: 'From 200,000 TZS',
          rating: 4.9,
          totalReviews: 98,
          location: 'Dodoma',
          yearsExperience: 7,
          verified: true,
          availability: 'Available',
          images: ['https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'],
          pastEvents: [
            { name: 'Music Festival', date: '2024-10-30', type: 'Festival', rating: 5 },
            { name: 'Wedding Party', date: '2024-10-12', type: 'Wedding', rating: 5 }
          ],
          reviews: [
            { id: '1', clientName: 'Michael Juma', rating: 5, comment: 'Amazing sound quality and great DJ skills!', date: '2024-11-01', eventType: 'Festival' }
          ],
          packages: [
            { name: 'Basic', price: '200,000 TZS', features: ['Sound system', 'Basic lighting', '4 hours DJ'] },
            { name: 'Premium', price: '500,000 TZS', features: ['Premium sound system', 'Stage lighting', '8 hours DJ', 'Special effects'] }
          ]
        }
      ];
      
      foundService = findServicesProviders.find(s => s.id === id) as ServiceData | undefined;
    }
    
    setService(foundService || null);

    // Generate some mock booked dates for demonstration
    const today = new Date();
    const mockBookedDates = [
      new Date(today.getFullYear(), today.getMonth(), 15),
      new Date(today.getFullYear(), today.getMonth(), 22),
      new Date(today.getFullYear(), today.getMonth(), 28),
      new Date(today.getFullYear(), today.getMonth() + 1, 5),
      new Date(today.getFullYear(), today.getMonth() + 1, 12),
    ];
    setBookedDates(mockBookedDates);
  }, [id]);

  useWorkspaceMeta({
    title: service?.name || 'Service Details',
    description: `View details, availability, and book ${service?.name || 'this service'}.`
  });

  if (!service) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Service not found</p>
      </div>
    );
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
        }`}
      />
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Service Details</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* Service Hero */}
      <Card className="overflow-hidden">
        <div className="h-48 bg-gradient-to-r from-primary/10 to-primary/20 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-foreground mb-2">{service.name}</h1>
              <p className="text-muted-foreground">{service.category}</p>
            </div>
          </div>
        </div>
        
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1">
                  {renderStars(service.rating)}
                  <span className="ml-2 font-semibold">{service.rating}</span>
                  <span className="text-muted-foreground">({service.totalReviews} reviews)</span>
                </div>
                {service.verified && (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
              
              <p className="text-muted-foreground mb-4">{service.description}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="font-medium">Base Price</p>
                  <p className="text-muted-foreground">{service.basePrice}</p>
                </div>
                <div>
                  <p className="font-medium">Experience</p>
                  <p className="text-muted-foreground">{service.yearsExperience} years</p>
                </div>
                <div>
                  <p className="font-medium">Location</p>
                  <p className="text-muted-foreground">{service.location}</p>
                </div>
                <div>
                  <p className="font-medium">Availability</p>
                  <p className="text-muted-foreground">{service.availability}</p>
                </div>
              </div>
            </div>
            
            <div className="w-full md:w-80">
              <Card>
                <CardHeader>
                  <CardTitle>Service Packages</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {service.packages.map((pkg, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">{pkg.name}</h4>
                        <span className="font-bold text-primary">{pkg.price}</span>
                      </div>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {pkg.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Availability Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Availability Calendar
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Click on any available date to book this service provider. Booked dates and past dates cannot be selected.
          </p>
        </CardHeader>
        <CardContent>
          <div className="p-4 md:p-6">
            <Calendar
              mode="single"
              className="w-full border-0"
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-8 sm:space-y-0 w-full",
                month: "space-y-4 w-full",
                caption: "flex justify-center pt-1 relative items-center mb-4",
                caption_label: "text-xl md:text-2xl font-bold",
                nav: "space-x-1 flex items-center",
                nav_button: "h-10 w-10 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-accent rounded-md transition-colors flex items-center justify-center",
                table: "w-full border-collapse",
                head_row: "flex w-full mb-2",
                head_cell: "text-muted-foreground flex-1 font-semibold text-sm md:text-base",
                row: "flex w-full mt-1",
                cell: "flex-1 h-14 md:h-16 text-center text-sm md:text-base p-0.5 relative",
                day: "h-full w-full p-0 font-medium aria-selected:opacity-100 hover:bg-accent rounded transition-colors flex items-center justify-center",
                day_selected: "bg-green-500 text-white hover:bg-green-600 focus:bg-green-600 font-bold",
                day_today: "bg-accent text-accent-foreground font-bold ring-2 ring-offset-2 ring-primary",
                day_outside: "text-muted-foreground/40 opacity-50",
                day_disabled: "text-muted-foreground/30 opacity-30 cursor-not-allowed",
              }}
              modifiers={{
                booked: bookedDates,
              }}
              modifiersClassNames={{
                booked: "bg-red-500/20 text-red-700 dark:text-red-400 font-bold hover:bg-red-500/30 ring-2 ring-red-500/50 cursor-not-allowed",
              }}
              disabled={(date) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isPast = date < today;
                const isBooked = bookedDates.some(
                  bookedDate => bookedDate.toDateString() === date.toDateString()
                );
                return isPast || isBooked;
              }}
            />
          </div>
          
          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center gap-2 md:gap-6 justify-center text-[10px] md:text-sm">
              <div className="flex items-center gap-1 md:gap-2 whitespace-nowrap">
                <div className="w-5 h-5 md:w-7 md:h-7 rounded bg-red-500/20 border-2 border-red-500/50 flex-shrink-0"></div>
                <span className="font-medium">Booked</span>
              </div>
              <div className="flex items-center gap-1 md:gap-2 whitespace-nowrap">
                <div className="w-5 h-5 md:w-7 md:h-7 rounded bg-accent border-2 border-primary flex-shrink-0"></div>
                <span className="font-medium">Today</span>
              </div>
              <div className="flex items-center gap-1 md:gap-2 whitespace-nowrap">
                <div className="w-5 h-5 md:w-7 md:h-7 rounded bg-green-500 flex-shrink-0"></div>
                <span className="font-medium">Selected</span>
              </div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-center">
              <p className="text-muted-foreground">
                💡 <span className="font-medium">Pro tip:</span> This provider typically books up 2-3 weeks in advance. 
                Consider booking early to secure your preferred date!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Past Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Past Events ({service.pastEvents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {service.pastEvents.map((event, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">{event.name}</h4>
                  <p className="text-sm text-muted-foreground">{event.type} • {event.date}</p>
                </div>
                <div className="flex items-center gap-1">
                  {renderStars(event.rating)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Client Reviews
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {service.reviews.map((review) => (
            <div key={review.id} className="border-b pb-4 last:border-b-0">
              <div className="flex items-start gap-4">
                <Avatar>
                  <AvatarFallback>{review.clientName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium">{review.clientName}</h4>
                      <p className="text-sm text-muted-foreground">{review.eventType} • {review.date}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {renderStars(review.rating)}
                    </div>
                  </div>
                  <p className="text-muted-foreground">{review.comment}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ServiceDetail;