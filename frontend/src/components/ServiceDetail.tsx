import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Star, Calendar as CalendarIcon, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useUserService } from '@/hooks/useUserService'; // <-- new hook
import { formatPrice } from '@/utils/formatPrice';

const ServiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { service, loading, error, refetch } = useUserService(id!);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Update meta when service changes
  useWorkspaceMeta({
    title: service?.title || 'Service Details',
    description: `View details, availability, and book ${service?.title || 'this service'}.`
  });

  useEffect(() => {
    if (!service) return;

    // Mock booked dates can remain or you can fetch from API if available
    const today = new Date();
    const mockBookedDates = [
      new Date(today.getFullYear(), today.getMonth(), 15),
      new Date(today.getFullYear(), today.getMonth(), 22),
      new Date(today.getFullYear(), today.getMonth(), 28),
      new Date(today.getFullYear(), today.getMonth() + 1, 5),
      new Date(today.getFullYear(), today.getMonth() + 1, 12),
    ];
    setBookedDates(mockBookedDates);
  }, [service]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading service details...</p>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{error || 'Service not found'}</p>
      </div>
    );
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
      />
    ));
  };

  const hasImages = Array.isArray(service.images) && service.images.length > 0;
  const openLightbox = (index: number) => { setLightboxIndex(index); setLightboxOpen(true); };
  const closeLightbox = () => setLightboxOpen(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Service Details</h1>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* Service Images Carousel */}
      {hasImages && (
        <div className="space-y-2">
          {service.images.length === 1 ? (
            <div
              className="relative w-full h-80 rounded-lg overflow-hidden border cursor-pointer"
              onClick={() => openLightbox(0)}
            >
              <img src={service.images[0]} alt={`${service.title}`} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto py-2">
              {service.images.map((img, idx) => (
                <div
                  key={idx}
                  className="relative w-64 h-48 flex-shrink-0 rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => openLightbox(idx)}
                >
                  <img src={img} alt={`${service.title} ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && hasImages && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={closeLightbox}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={closeLightbox}
              className="absolute -top-3 -right-3 bg-white rounded-full p-2 shadow z-50 hover:bg-gray-100"
              aria-label="Close"
            >✕</button>
            <img src={service.images[lightboxIndex]} alt={`zoom ${lightboxIndex}`} className="max-w-full max-h-[85vh] object-contain rounded" />
            {service.images.length > 1 && (
              <>
                <button onClick={() => setLightboxIndex((i) => (i - 1 + service.images.length) % service.images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 p-3 rounded-full hover:bg-white text-xl" aria-label="Previous">‹</button>
                <button onClick={() => setLightboxIndex((i) => (i + 1) % service.images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 p-3 rounded-full hover:bg-white text-xl" aria-label="Next">›</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Service Hero */}
      <Card className="overflow-hidden">
        <div className="h-48 bg-gradient-to-r from-primary/10 to-primary/20 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-foreground mb-2">{service.title}</h1>
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
                  <p className="text-muted-foreground">From {formatPrice(service.basePrice)}</p>
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
                        <span className="font-bold text-primary">{formatPrice(pkg.price)}</span>
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