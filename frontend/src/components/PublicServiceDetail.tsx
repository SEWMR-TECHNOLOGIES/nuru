import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Star, CheckCircle, ChevronRight, Loader2, Send } from 'lucide-react';
import CalendarIcon from '@/assets/icons/calendar-icon.svg';
import LocationIcon from '@/assets/icons/location-icon.svg';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useUserService } from '@/hooks/useUserService';
import { servicesApi } from '@/lib/api/services';
import { formatPrice } from '@/utils/formatPrice';
import { ServiceDetailLoadingSkeleton } from '@/components/ui/ServiceLoadingSkeleton';
import { UserService, ServicePackage, ServiceReview } from '@/lib/api/types';
import { showApiErrors } from '@/lib/api';
import { toast } from 'sonner';

interface BookedDate {
  date: string;
  status: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const PublicServiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { service, loading, error } = useUserService(id!);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [reviews, setReviews] = useState<ServiceReview[]>([]);
  const [bookedDates, setBookedDates] = useState<BookedDate[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Review form
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewHover, setReviewHover] = useState(0);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsPagination, setReviewsPagination] = useState<any>(null);

  useWorkspaceMeta({
    title: service?.title || 'Service Details',
    description: `View details and reviews for ${service?.title || 'this service'}.`
  });

  useEffect(() => {
    if (!service) return;
    if ((service as any).packages && Array.isArray((service as any).packages)) {
      setPackages((service as any).packages);
    }
    if ((service as any).reviews_preview && Array.isArray((service as any).reviews_preview)) {
      setReviews((service as any).reviews_preview);
    }
  }, [service]);

  // Load calendar data (public - no tooltips)
  useEffect(() => {
    if (!id) return;
    const loadCalendar = async () => {
      setCalendarLoading(true);
      try {
        const res = await servicesApi.getCalendar(id);
        if (res.success && res.data?.booked_dates) {
          // Strip sensitive info for public view
          setBookedDates(res.data.booked_dates.map((b: any) => ({
            date: b.date,
            status: b.status,
          })));
        }
      } catch { /* silent */ }
      finally { setCalendarLoading(false); }
    };
    loadCalendar();
  }, [id]);

  // Load full reviews
  const loadReviews = useCallback(async (page = 1) => {
    if (!id) return;
    setReviewsLoading(true);
    try {
      const res = await servicesApi.getReviews(id, { page, limit: 10 });
      if (res.success && res.data) {
        setReviews(res.data.reviews || []);
        setReviewsPagination(res.data.pagination || null);
      }
    } catch { /* silent */ }
    finally { setReviewsLoading(false); }
  }, [id]);

  useEffect(() => {
    if (id) loadReviews();
  }, [id, loadReviews]);

  const handleSubmitReview = async () => {
    if (!id) return;
    if (reviewRating === 0) {
      toast.error('Please select a rating');
      return;
    }
    if (reviewComment.trim().length < 10) {
      toast.error('Review must be at least 10 characters long');
      return;
    }
    if (reviewComment.trim().length > 2000) {
      toast.error('Review must be at most 2000 characters');
      return;
    }

    setSubmittingReview(true);
    try {
      const res = await servicesApi.submitReview(id, {
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      if (res.success) {
        toast.success('Review submitted successfully!');
        setReviewRating(0);
        setReviewComment('');
        loadReviews();
      } else {
        showApiErrors(res);
      }
    } catch (err) {
      toast.error('Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

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

    const days: Array<{ day: number | null; date: string; isToday: boolean; isPast: boolean; isBooked: boolean; status: string | null }> = [];

    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, date: '', isToday: false, isPast: false, isBooked: false, status: null });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const booking = bookedDates.find(b => b.date === dateStr);
      days.push({
        day: d,
        date: dateStr,
        isToday: date.toDateString() === today.toDateString(),
        isPast: date < today,
        isBooked: !!booking,
        status: booking?.status || null,
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

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
    ));
  };

  if (loading) return <ServiceDetailLoadingSkeleton />;

  if (error || !service) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{error || 'Service not found'}</p>
      </div>
    );
  }

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

      {/* Public Availability Calendar - No tooltips, no event names */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img src={CalendarIcon} alt="Calendar" className="w-5 h-5" />
            Availability
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            View provider availability. Colored dates indicate existing bookings.
          </p>
        </CardHeader>
        <CardContent>
          {calendarLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading calendar...</span>
            </div>
          ) : (
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

              {/* Calendar Grid - NO tooltips for public view */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell, idx) => {
                  if (cell.day === null) {
                    return <div key={`empty-${idx}`} className="h-12 md:h-16" />;
                  }

                  return (
                    <div
                      key={cell.date}
                      className={`
                        relative h-12 md:h-16 rounded-lg flex flex-col items-center justify-center text-sm md:text-base transition-all
                        ${cell.isToday ? 'ring-2 ring-primary bg-primary/10 font-bold' : ''}
                        ${cell.isPast && !cell.isBooked ? 'text-muted-foreground/30' : ''}
                        ${cell.isBooked ? `${getStatusColor(cell.status!)} text-white font-semibold shadow-sm` : ''}
                        ${!cell.isBooked && !cell.isPast && !cell.isToday ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30' : ''}
                      `}
                    >
                      <span>{cell.day}</span>
                      {cell.isBooked && (
                        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2">
                          <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="border-t pt-4 mt-4">
                <div className="flex flex-wrap items-center gap-3 md:gap-6 justify-center text-xs md:text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 md:w-6 md:h-6 rounded bg-amber-500 flex-shrink-0" />
                    <span>Booked</span>
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit Review */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Star className="w-5 h-5" />Write a Review</CardTitle>
          <p className="text-sm text-muted-foreground">You can review this service if it was assigned to one of your events.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Star Rating Input */}
          <div>
            <p className="text-sm font-medium mb-2">Your Rating</p>
            <div className="flex gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setReviewRating(i + 1)}
                  onMouseEnter={() => setReviewHover(i + 1)}
                  onMouseLeave={() => setReviewHover(0)}
                  className="focus:outline-none"
                >
                  <Star
                    className={`w-7 h-7 transition-colors ${
                      i < (reviewHover || reviewRating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Your Review</p>
            <Textarea
              placeholder="Share your experience with this service provider (min 10 characters)..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={4}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground mt-1">{reviewComment.length}/2000</p>
          </div>

          <Button
            onClick={handleSubmitReview}
            disabled={submittingReview || reviewRating === 0 || reviewComment.trim().length < 10}
          >
            {submittingReview ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" />Submit Review</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Reviews List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Star className="w-5 h-5" />Client Reviews ({service.review_count || reviews.length})</CardTitle>
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
                  {(() => {
                    const avatar = (review as any).user_avatar || (review as any).reviewer_avatar || (review as any).user?.avatar || (review as any).reviewer?.avatar;
                    return avatar ? <AvatarImage src={avatar} alt={review.user_name || 'Reviewer'} /> : null;
                  })()}
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {(review.user_name || 'A').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium">{review.user_name || 'Anonymous'}</h4>
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

          {/* Pagination */}
          {reviewsPagination && reviewsPagination.total_pages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={!reviewsPagination.has_previous}
                onClick={() => loadReviews(reviewsPagination.page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground flex items-center">
                Page {reviewsPagination.page} of {reviewsPagination.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!reviewsPagination.has_next}
                onClick={() => loadReviews(reviewsPagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicServiceDetail;
