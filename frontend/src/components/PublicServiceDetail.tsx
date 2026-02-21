import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft, Star, CheckCircle, ChevronRight, Send,
  Award, Briefcase, X, MessageSquare,
  ArrowUpRight, Shield, Users, Loader2, Video, Music
} from 'lucide-react';
import { VerifiedServiceBadge, VerifiedServiceBadgeWithLabel } from '@/components/ui/verified-badge';
import calendarIcon from '@/assets/icons/calendar-icon.svg';
import locationIcon from '@/assets/icons/location-icon.svg';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useUserService } from '@/hooks/useUserService';
import { servicesApi, userServicesApi } from '@/lib/api/services';
import { formatPrice } from '@/utils/formatPrice';
import { ServiceDetailLoadingSkeleton } from '@/components/ui/ServiceLoadingSkeleton';
import { UserService, ServicePackage, ServiceReview } from '@/lib/api/types';
import { showApiErrors } from '@/lib/api';
import { messagesApi } from '@/lib/api/messages';
import { toast } from 'sonner';

interface BookedDate {
  date: string;
  status: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const PublicServiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { service, loading, error } = useUserService(id!);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [reviews, setReviews] = useState<ServiceReview[]>([]);
  const [bookedDates, setBookedDates] = useState<BookedDate[]>([]);
  const [introMedia, setIntroMedia] = useState<Array<{ id: string; media_type: string; media_url: string }>>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewHover, setReviewHover] = useState(0);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsPagination, setReviewsPagination] = useState<any>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

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
    if ((service as any).intro_media && Array.isArray((service as any).intro_media)) {
      setIntroMedia((service as any).intro_media);
    }
  }, [service]);

  // Fetch intro media
  useEffect(() => {
    if (!id) return;
    userServicesApi.getIntroMedia(id).then(res => {
      if (res.success && res.data) setIntroMedia(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const loadCalendar = async () => {
      setCalendarLoading(true);
      try {
        const res = await servicesApi.getCalendar(id);
        if (res.success && res.data?.booked_dates) {
          setBookedDates(res.data.booked_dates.map((b: any) => ({ date: b.date, status: b.status })));
        }
      } catch { /* silent */ }
      finally { setCalendarLoading(false); }
    };
    loadCalendar();
  }, [id]);

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

  useEffect(() => { if (id) loadReviews(); }, [id, loadReviews]);

  const handleSubmitReview = async () => {
    if (!id) return;
    if (reviewRating === 0) { toast.error('Please select a rating'); return; }
    if (reviewComment.trim().length < 10) { toast.error('Review must be at least 10 characters'); return; }
    setSubmittingReview(true);
    try {
      const res = await servicesApi.submitReview(id, { rating: reviewRating, comment: reviewComment.trim() });
      if (res.success) {
        toast.success('Review submitted!');
        setReviewRating(0);
        setReviewComment('');
        loadReviews();
      } else { showApiErrors(res); }
    } catch { toast.error('Failed to submit review'); }
    finally { setSubmittingReview(false); }
  };
  const handleBookService = async () => {
    if (!id || !service) return;
    const providerId = (service as any).provider?.id || (service as any).user_id;
    if (!providerId) { toast.error('Unable to contact provider'); return; }
    setBookingLoading(true);
    try {
      const res = await messagesApi.startConversation({
        recipient_id: providerId,
        service_id: id,
        message: `Hi, I'm interested in your service "${service.title}". I'd like to discuss booking details.`,
      });
      if (res.success && res.data) {
        const conversationId = res.data.id || res.data.conversation_id;
        navigate(`/messages?conversation=${conversationId}`);
      } else {
        showApiErrors(res);
      }
    } catch {
      toast.error('Failed to start conversation');
    } finally {
      setBookingLoading(false);
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

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days: Array<{ day: number | null; date: string; isToday: boolean; isPast: boolean; isBooked: boolean; status: string | null }> = [];
    for (let i = 0; i < firstDay; i++) days.push({ day: null, date: '', isToday: false, isPast: false, isBooked: false, status: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const booking = bookedDates.find(b => b.date === dateStr);
      days.push({ day: d, date: dateStr, isToday: date.toDateString() === today.toDateString(), isPast: date < today, isBooked: !!booking, status: booking?.status || null });
    }
    return days;
  }, [currentMonth, bookedDates]);

  const prevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const renderStars = (rating: number, size = 'w-4 h-4') =>
    Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`${size} ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
    ));

  if (loading) return <ServiceDetailLoadingSkeleton />;
  if (error || !service) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-muted-foreground">{error || 'Service not found'}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const hasImages = Array.isArray(service.images) && service.images.length > 0;
  const imageUrls = hasImages ? service.images.map(getImageUrl).filter(Boolean) : [];
  const isVerified = service.verification_status === 'verified';
  const rating = service.rating || 0;
  const reviewCount = service.review_count || reviews.length || 0;
  const ownerName = (service as any).owner_name || (service as any).user?.first_name
    ? `${(service as any).user?.first_name || ''} ${(service as any).user?.last_name || ''}`.trim()
    : null;
  const ownerAvatar = (service as any).owner_avatar || (service as any).user?.avatar;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">

      {/* ─── BACK NAV ─── */}
      <div className="flex items-center justify-end py-4 px-1">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back">
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* ─── HERO GALLERY ─── */}
      {hasImages ? (
        <div className="relative rounded-2xl overflow-hidden bg-muted mb-6">
          {imageUrls.length === 1 ? (
            <div className="w-full h-[420px] cursor-zoom-in" onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}>
              <img src={imageUrls[0]} alt={service.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            </div>
          ) : (
            <div className={`grid gap-1 h-[420px] ${imageUrls.length === 2 ? 'grid-cols-2' : imageUrls.length === 3 ? 'grid-cols-3' : 'grid-cols-4 grid-rows-2'}`}>
              {imageUrls.slice(0, imageUrls.length >= 4 ? 4 : imageUrls.length).map((img, idx) => {
                const isFirst = idx === 0 && imageUrls.length >= 4;
                return (
                  <div
                    key={idx}
                    className={`relative overflow-hidden cursor-zoom-in group ${isFirst ? 'row-span-2 col-span-2' : ''}`}
                    onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
                  >
                    <img src={img} alt={`${service.title} ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    {idx === 3 && imageUrls.length > 4 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white text-2xl font-bold">+{imageUrls.length - 4}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* Overlay gradient for title */}
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
          {/* Title overlay */}
          <div className="absolute bottom-6 left-6 right-6">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 text-xs">
                {(service as any).service_category?.name || (service as any).category?.name || 'Service'}
              </Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight flex items-center gap-2">{service.title} {isVerified && <VerifiedServiceBadge size="md" className="brightness-200" />}</h1>
            {service.location && (
              <p className="text-white/80 text-sm mt-1.5 flex items-center gap-1">
                <img src={locationIcon} alt="location" className="w-3.5 h-3.5 dark:invert" />{service.location}
              </p>
            )}
          </div>
          {/* View all photos button */}
          {imageUrls.length > 1 && (
            <button
              onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}
              className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full border border-white/20 hover:bg-black/70 transition-colors flex items-center gap-1.5"
            >
              <ArrowUpRight className="w-3 h-3" /> View all {imageUrls.length} photos
            </button>
          )}
        </div>
      ) : (
        /* No-image hero */
        <div className="relative rounded-2xl overflow-hidden mb-6 h-64 bg-gradient-to-br from-primary/20 via-primary/10 to-background border border-border">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/15 flex items-center justify-center mb-3">
              <Briefcase className="w-9 h-9 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">{service.title}</h1>
            <p className="text-muted-foreground mt-1">{(service as any).service_category?.name || 'Service'}</p>
          </div>
        </div>
      )}

      {/* ─── IDENTITY + STATS STRIP ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 mb-6">
        {/* Provider Card */}
        {ownerName && (
          <div className="md:col-span-1 bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
            <Avatar className="w-14 h-14 ring-2 ring-primary/20">
              {ownerAvatar && <AvatarImage src={ownerAvatar} />}
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                {ownerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">Service Provider</p>
              <p className="font-semibold text-foreground truncate flex items-center gap-1.5">{ownerName} {isVerified && <VerifiedServiceBadge size="sm" />}</p>
            </div>
          </div>
        )}

        {/* Rating */}
        <div className={`bg-card border border-border rounded-2xl p-5 flex flex-col justify-center gap-2 ${ownerName ? '' : 'md:col-span-1'}`}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Overall Rating</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold text-foreground">{rating.toFixed(1)}</span>
            <div className="flex mb-1.5">{renderStars(Math.round(rating))}</div>
          </div>
          <p className="text-xs text-muted-foreground">{reviewCount} review{reviewCount !== 1 ? 's' : ''}</p>
        </div>

        {/* Quick stats */}
        <div className="bg-card border border-border rounded-2xl p-5 grid grid-cols-2 gap-y-5 gap-x-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Experience</p>
            <p className="text-2xl font-bold text-foreground">{service.years_experience || 0}<span className="text-sm font-normal text-muted-foreground ml-1">yrs</span></p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Events Done</p>
            <p className="text-2xl font-bold text-foreground">{(service as any).completed_events || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Starting From</p>
            <p className="text-sm font-bold text-primary">{formatPriceDisplay(service)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Availability</p>
            <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
              service.availability === 'available' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' :
              service.availability === 'limited' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' :
              'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                service.availability === 'available' ? 'bg-emerald-500' :
                service.availability === 'limited' ? 'bg-amber-500' : 'bg-red-500'
              }`} />
              {service.availability || 'available'}
            </div>
          </div>
        </div>
      </div>

      {/* ─── ABOUT THIS SERVICE ─── */}
      {service.description && (
        <div className="bg-card border border-border rounded-2xl p-6 mt-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-3">About This Service</h2>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{service.description}</p>
        </div>
      )}

      {/* ─── INTRO MEDIA ─── */}
      {introMedia.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />Introduction
          </h2>
          <div className="space-y-3">
            {introMedia.map((media) => (
              <div key={media.id} className="rounded-xl overflow-hidden border border-border">
                {media.media_type === 'video' ? (
                  <div className="aspect-video bg-black">
                    <video src={media.media_url} controls playsInline className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="p-4 flex items-center gap-3 bg-gradient-to-r from-primary/5 to-transparent">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Music className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground mb-1">Audio Introduction</p>
                      <audio src={media.media_url} controls className="w-full h-8" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Description + Reviews */}
        <div className="lg:col-span-2 space-y-6">


          {/* Availability Calendar */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <img src={calendarIcon} alt="calendar" className="w-4 h-4 dark:invert" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Availability</h2>
                <p className="text-xs text-muted-foreground">Green dates are open for booking</p>
              </div>
            </div>

            {calendarLoading ? (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="w-8 h-8 rounded-lg" />
                  <Skeleton className="w-32 h-5" />
                  <Skeleton className="w-8 h-8 rounded-lg" />
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {[...Array(35)].map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button onClick={prevMonth} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-foreground">{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
                  <button onClick={nextMonth} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map(d => <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((cell, idx) => {
                    if (!cell.day) return <div key={`e-${idx}`} className="h-9" />;
                    return (
                      <div key={cell.date} className={`h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-all
                        ${cell.isToday ? 'ring-2 ring-primary bg-primary/10 text-primary' : ''}
                        ${cell.isBooked ? 'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400' : ''}
                        ${!cell.isBooked && !cell.isPast && !cell.isToday ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : ''}
                        ${cell.isPast && !cell.isBooked ? 'text-muted-foreground/30' : ''}
                      `}>
                        {cell.day}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 pt-2 border-t border-border text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-950/40" />Available</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 dark:bg-red-950/40" />Booked</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded ring-2 ring-primary bg-primary/10" />Today</span>
                </div>
              </div>
            )}
          </div>

          {/* Write Review */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Write a Review</h2>
                <p className="text-xs text-muted-foreground">Only available if this service was on your event</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Your Rating</p>
                <div className="flex gap-1.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <button key={i} onClick={() => setReviewRating(i + 1)} onMouseEnter={() => setReviewHover(i + 1)} onMouseLeave={() => setReviewHover(0)}>
                      <Star className={`w-7 h-7 transition-all ${i < (reviewHover || reviewRating) ? 'fill-yellow-400 text-yellow-400 scale-110' : 'text-muted-foreground/40'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Textarea
                  placeholder="Share your experience (min 10 characters)…"
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">{reviewComment.length}/2000</p>
              </div>
              <Button onClick={handleSubmitReview} disabled={submittingReview || reviewRating === 0 || reviewComment.trim().length < 10} className="w-full sm:w-auto">
                {submittingReview ? <>Submitting…</> : <><Send className="w-4 h-4 mr-2" />Submit Review</>}
              </Button>
            </div>
          </div>

          {/* Reviews List */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Client Reviews</h2>
              </div>
              <Badge variant="outline" className="font-mono">{reviewCount}</Badge>
            </div>

            {reviewsLoading ? (
              <div className="space-y-4 py-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : reviews.length > 0 ? (
              <div className="space-y-5">
                {reviews.map((review, i) => {
                  const avatar = (review as any).user_avatar || (review as any).reviewer_avatar || (review as any).user?.avatar;
                  return (
                    <motion.div key={review.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className="flex gap-4 pb-5 border-b border-border last:border-0 last:pb-0">
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        {avatar && <AvatarImage src={avatar} />}
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {(review.user_name || 'A').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div>
                            <p className="font-semibold text-foreground text-sm">{review.user_name || 'Anonymous'}</p>
                            <p className="text-xs text-muted-foreground">
                              {review.created_at ? new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}
                            </p>
                          </div>
                          <div className="flex shrink-0">{renderStars(review.rating)}</div>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">{review.comment}</p>
                      </div>
                    </motion.div>
                  );
                })}

                {reviewsPagination && reviewsPagination.total_pages > 1 && (
                  <div className="flex justify-center gap-2 pt-3">
                    <Button variant="outline" size="sm" disabled={!reviewsPagination.has_previous} onClick={() => loadReviews(reviewsPagination.page - 1)}>Previous</Button>
                    <span className="text-sm text-muted-foreground flex items-center px-2">Page {reviewsPagination.page} of {reviewsPagination.total_pages}</span>
                    <Button variant="outline" size="sm" disabled={!reviewsPagination.has_next} onClick={() => loadReviews(reviewsPagination.page + 1)}>Next</Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10">
                <Star className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No reviews yet. Be the first!</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Sticky Packages + Contact */}
        <div className="space-y-4">
          <div className="sticky top-4 space-y-4">

            {/* Book CTA */}
            <div className="bg-primary text-primary-foreground rounded-2xl p-5">
              <p className="text-primary-foreground/70 text-sm mb-1">Starting from</p>
              <p className="text-2xl font-bold mb-4">{formatPriceDisplay(service)}</p>
              <Button variant="secondary" className="w-full font-semibold" onClick={handleBookService} disabled={bookingLoading}>
                {bookingLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting Chat…</> : <>Book This Service <ArrowUpRight className="w-4 h-4 ml-1" /></>}
              </Button>
              <p className="text-primary-foreground/60 text-xs text-center mt-2">No payment until confirmed</p>
            </div>

            {/* Packages */}
            {packages.length > 0 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="font-semibold text-foreground">Service Packages</h2>
                </div>
                <div className="divide-y divide-border">
                  {packages.map((pkg, idx) => (
                    <div key={pkg.id || idx} className={`p-5 ${idx === 0 ? 'bg-primary/3' : ''}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-semibold text-foreground text-sm">{pkg.name}</p>
                          {idx === 0 && <Badge className="text-[10px] mt-0.5 bg-primary/10 text-primary border-0">Most Popular</Badge>}
                        </div>
                        <span className="text-primary font-bold text-sm whitespace-nowrap">{formatPrice(pkg.price)}</span>
                      </div>
                      {pkg.description && <p className="text-xs text-muted-foreground mb-3">{pkg.description}</p>}
                      {pkg.features?.length > 0 && (
                        <ul className="space-y-1.5">
                          {pkg.features.map((f, fi) => (
                            <li key={fi} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trust Badges */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Shield className="w-5 h-5 text-emerald-500 shrink-0" />
                <span className="text-muted-foreground">Verified & trusted on Nuru</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Award className="w-5 h-5 text-primary shrink-0" />
                <span className="text-muted-foreground">{service.years_experience || 0} years of professional experience</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <img src={calendarIcon} alt="time" className="w-5 h-5 dark:invert opacity-70" />
                <span className="text-muted-foreground">Responds quickly to booking requests</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── FULLSCREEN LIGHTBOX ─── */}
      <AnimatePresence>
        {lightboxOpen && hasImages && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="relative max-w-5xl w-full max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setLightboxOpen(false)} className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors flex items-center gap-1 text-sm">
                <X className="w-5 h-5" /> Close
              </button>
              <img src={imageUrls[lightboxIndex]} alt={`Photo ${lightboxIndex + 1}`} className="max-w-full max-h-[80vh] object-contain rounded-lg mx-auto block" />
              {imageUrls.length > 1 && (
                <>
                  <button onClick={() => setLightboxIndex(i => (i - 1 + imageUrls.length) % imageUrls.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={() => setLightboxIndex(i => (i + 1) % imageUrls.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="flex justify-center gap-1.5 mt-4">
                    {imageUrls.map((_, i) => (
                      <button key={i} onClick={() => setLightboxIndex(i)}
                        className={`w-2 h-2 rounded-full transition-all ${i === lightboxIndex ? 'bg-white scale-125' : 'bg-white/40'}`} />
                    ))}
                  </div>
                </>
              )}
              <p className="text-center text-white/50 text-xs mt-3">{lightboxIndex + 1} / {imageUrls.length}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PublicServiceDetail;
