import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Star, CheckCircle, ChevronRight, Loader2 } from 'lucide-react';
import CalendarIcon from '@/assets/icons/calendar-icon.svg';
import LocationIcon from '@/assets/icons/location-icon.svg';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useUserService } from '@/hooks/useUserService';
import { servicesApi } from '@/lib/api/services';
import { formatPrice } from '@/utils/formatPrice';
import { ServiceDetailLoadingSkeleton } from '@/components/ui/ServiceLoadingSkeleton';
import { UserService, ServicePackage, ServiceReview } from '@/lib/api/types';

interface BookedDate {
  date: string;
  event_id: string;
  event_name: string;
  event_location?: string;
  status: string;
  agreed_price?: number;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ServiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { service, loading, error, refetch } = useUserService(id!);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [reviews, setReviews] = useState<ServiceReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [bookedDates, setBookedDates] = useState<BookedDate[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useWorkspaceMeta({
    title: service?.title || 'Service Details',
    description: `View details, availability, and book ${service?.title || 'this service'}.`
  });

  useEffect(() => {
    if (!service) return;
    if ((service as any).packages && Array.isArray((service as any).packages)) {
      setPackages((service as any).packages);
    }
  }, [service]);

  // Load reviews from API
  const loadReviews = useCallback(async () => {
    if (!id) return;
    setReviewsLoading(true);
    try {
      const res = await servicesApi.getReviews(id, { limit: 10 });
      if (res.success && res.data) {
        setReviews(res.data.reviews || []);
      }
    } catch { /* silent */ }
    finally { setReviewsLoading(false); }
  }, [id]);

  useEffect(() => {
    if (id) loadReviews();
  }, [id, loadReviews]);

  // Load dynamic calendar data
  useEffect(() => {
    if (!id) return;
    const loadCalendar = async () => {
      setCalendarLoading(true);
      try {
        const res = await servicesApi.getCalendar(id);
        if (res.success && res.data?.booked_dates) {
          setBookedDates(res.data.booked_dates);
        }
      } catch { /* silent */ }
      finally { setCalendarLoading(false); }
    };
    loadCalendar();
  }, [id]);

  const getImageUrl = (img: any): string => {
    if (typeof img === 'string') return img;
    if (img && typeof img === 'object' && img.url) return img.url;
    return '';
  };

  const formatPriceDisplay = (svc: UserService): string => {
    if (svc.min_price) return `From ${formatPrice(svc.min_price)}`;
    return 'Price on request';
  };

  const getCategoryName = (svc: UserService): string => {
    if (svc.service_category?.name) return svc.service_category.name;
    return 'Service';
  };

  // Calendar logic
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: Array<{ day: number | null; date: string; isToday: boolean; isPast: boolean; booking: BookedDate | null }> = [];

    // Empty slots before first day
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, date: '', isToday: false, isPast: false, booking: null });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const booking = bookedDates.find(b => b.date === dateStr) || null;
      days.push({
        day: d,
        date: dateStr,
        isToday: date.toDateString() === today.toDateString(),
        isPast: date < today,
        booking,
      });
    }

    return days;
  }, [currentMonth, bookedDates]);

  const prevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': case 'completed': case 'accepted': return 'bg-green-500';
      case 'pending': return 'bg-amber-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-green-500';
    }
  };

  if (loading) return <ServiceDetailLoadingSkeleton />;

  if (error || !service) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{error || 'Service not found'}</p>
      </div>
    );
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
    ));
  };

  const hasImages = Array.isArray(service.images) && service.images.length > 0;
  const imageUrls = hasImages ? service.images.map(getImageUrl) : [];
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
          {imageUrls.length === 1 ? (
            <div className="relative w-full h-80 rounded-lg overflow-hidden border cursor-pointer" onClick={() => openLightbox(0)}>
              <img src={imageUrls[0]} alt={service.title} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto py-2">
              {imageUrls.map((img, idx) => (
                <div key={idx} className="relative w-64 h-48 flex-shrink-0 rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => openLightbox(idx)}>
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
            <button onClick={closeLightbox} className="absolute -top-3 -right-3 bg-white rounded-full p-2 shadow z-50 hover:bg-gray-100" aria-label="Close">✕</button>
            <img src={imageUrls[lightboxIndex]} alt={`zoom ${lightboxIndex}`} className="max-w-full max-h-[85vh] object-contain rounded" />
            {imageUrls.length > 1 && (
              <>
                <button onClick={() => setLightboxIndex((i) => (i - 1 + imageUrls.length) % imageUrls.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 p-3 rounded-full hover:bg-white text-xl" aria-label="Previous">‹</button>
                <button onClick={() => setLightboxIndex((i) => (i + 1) % imageUrls.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 p-3 rounded-full hover:bg-white text-xl" aria-label="Next">›</button>
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
              <p className="text-muted-foreground">{getCategoryName(service)}</p>
            </div>
          </div>
        </div>
        
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1">
                  {renderStars(service.rating || 0)}
                  <span className="ml-2 font-semibold">{service.rating || 0}</span>
                  <span className="text-muted-foreground">({service.review_count || 0} reviews)</span>
                </div>
                {service.verification_status === 'verified' && (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />Verified
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mb-4">{service.description}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="font-medium">Base Price</p><p className="text-muted-foreground">{formatPriceDisplay(service)}</p></div>
                <div><p className="font-medium">Experience</p><p className="text-muted-foreground">{service.years_experience || 0} years</p></div>
                <div><p className="font-medium">Location</p><p className="text-muted-foreground">{service.location}</p></div>
                <div><p className="font-medium">Availability</p><p className="text-muted-foreground">{service.availability || 'available'}</p></div>
              </div>
            </div>
            <div className="w-full md:w-80">
              <Card>
                <CardHeader><CardTitle>Service Packages</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {packages.length > 0 ? packages.map((pkg, index) => (
                    <div key={pkg.id || index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">{pkg.name}</h4>
                        <span className="font-bold text-primary">{formatPrice(pkg.price)}</span>
                      </div>
                      {pkg.description && <p className="text-muted-foreground mb-2">{pkg.description}</p>}
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {pkg.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-500" />{feature}</li>
                        ))}
                      </ul>
                    </div>
                  )) : (
                    <p className="text-muted-foreground text-sm">No packages available yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modern Dynamic Availability Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img src={CalendarIcon} alt="Calendar" className="w-5 h-5" />
            Availability Calendar
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time availability based on actual event assignments. Hover on booked dates for details.
          </p>
        </CardHeader>
        <CardContent>
          {calendarLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading calendar...</span>
            </div>
          ) : (
            <div>
              <div className="space-y-4">
                {/* Month Navigation */}
                <div className="flex items-center justify-between px-2">
                  <Button variant="ghost" size="icon" onClick={prevMonth}>
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <h3 className="text-lg md:text-xl font-bold">
                    {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </h3>
                  <Button variant="ghost" size="icon" onClick={nextMonth}>
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map(day => (
                    <div key={day} className="text-center text-xs md:text-sm font-semibold text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((cell, idx) => {
                    if (cell.day === null) {
                      return <div key={`empty-${idx}`} className="h-12 md:h-16" />;
                    }

                    const isBooked = !!cell.booking;
                    const isPast = cell.isPast;

                    const dayEl = (
                      <div
                        key={cell.date}
                        className={`
                          relative h-12 md:h-16 rounded-lg flex flex-col items-center justify-center text-sm md:text-base transition-all
                          ${cell.isToday ? 'ring-2 ring-primary bg-primary/10 font-bold' : ''}
                          ${isPast && !isBooked ? 'text-muted-foreground/30' : ''}
                          ${isBooked ? `${getStatusColor(cell.booking!.status)} text-white font-semibold shadow-sm cursor-pointer` : ''}
                          ${!isBooked && !isPast && !cell.isToday ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30' : ''}
                        `}
                      >
                        <span>{cell.day}</span>
                        {isBooked && (
                          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
                          </div>
                        )}
                      </div>
                    );

                    if (isBooked) {
                      return (
                        <Popover key={cell.date}>
                          <PopoverTrigger asChild>{dayEl}</PopoverTrigger>
                          <PopoverContent side="top" className="max-w-[250px] p-3">
                            <div className="space-y-1.5">
                              <p className="font-semibold text-sm">{cell.booking!.event_name}</p>
                              {cell.booking!.event_location && (
                                <p className="text-xs flex items-center gap-1">
                                  <img src={LocationIcon} alt="Location" className="w-3 h-3" />{cell.booking!.event_location}
                                </p>
                              )}
                              <div className="flex items-center gap-2 text-xs">
                                <Badge variant="outline" className="text-[10px] h-5">
                                  {cell.booking!.status}
                                </Badge>
                                {cell.booking!.agreed_price && (
                                  <span className="font-medium">{formatPrice(cell.booking!.agreed_price)}</span>
                                )}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    }

                    return dayEl;
                  })}
                </div>

                {/* Legend */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex flex-wrap items-center gap-3 md:gap-6 justify-center text-xs md:text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded bg-amber-500 flex-shrink-0" />
                      <span>Pending</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded bg-green-500 flex-shrink-0" />
                      <span>Confirmed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 flex-shrink-0" />
                      <span>Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 md:w-6 md:h-6 rounded ring-2 ring-primary bg-primary/10 flex-shrink-0" />
                      <span>Today</span>
                    </div>
                  </div>
                </div>

                {/* Booked Events Summary */}
                {bookedDates.length > 0 && (
                  <div className="border-t pt-4 mt-2">
                    <h4 className="text-sm font-semibold mb-3">Upcoming Assignments ({bookedDates.length})</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {bookedDates
                        .filter(b => new Date(b.date) >= new Date(new Date().toDateString()))
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((b, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 text-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(b.status)} flex-shrink-0`} />
                              <div className="min-w-0">
                                <p className="font-medium truncate">{b.event_name}</p>
                                <p className="text-xs text-muted-foreground">{new Date(b.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                              </div>
                            </div>
                            {b.agreed_price && (
                              <span className="text-xs font-semibold text-primary flex-shrink-0 ml-2">{formatPrice(b.agreed_price)}</span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img src={CalendarIcon} alt="Calendar" className="w-5 h-5" />Completed Events ({service.completed_events || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(service.completed_events || 0) > 0 ? (
            <p className="text-muted-foreground">This provider has completed {service.completed_events} events.</p>
          ) : (
            <p className="text-muted-foreground">No past events to display yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Star className="w-5 h-5" />Client Reviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {reviewsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : reviews.length > 0 ? reviews.map((review) => (
            <div key={review.id} className="border-b pb-4 last:border-b-0">
              <div className="flex items-start gap-4">
                <Avatar>
                  {(review as any).user_avatar && !((review as any).user_avatar?.includes('unsplash.com') || (review as any).user_avatar?.includes('placeholder') || (review as any).user_avatar?.includes('randomuser.me')) ? (
                    <AvatarImage src={(review as any).user_avatar} alt={review.user_name} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {(review.user_name || 'A').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium">{review.user_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {review.created_at ? new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">{renderStars(review.rating)}</div>
                  </div>
                  <p className="text-muted-foreground">{review.comment}</p>
                </div>
              </div>
            </div>
          )) : (
            <p className="text-muted-foreground">No reviews yet. Be the first to review this service!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ServiceDetail;
