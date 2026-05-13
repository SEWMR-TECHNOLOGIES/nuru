import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft,
  Clock,
  User,
  MessageSquare,
  CheckCircle,
  XCircle,
  DollarSign,
  Phone,
  Mail,
  Eye,
  Info
} from 'lucide-react';
import CalendarIcon from '@/assets/icons/calendar-icon.svg';
import LocationIcon from '@/assets/icons/location-icon.svg';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useBooking } from '@/data/useBookings';
import { useCurrency } from '@/hooks/useCurrency';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import EscrowStatusCard from './EscrowStatusCard';
import DeliveryOtpCard from './DeliveryOtpCard';
import PayDepositDialog from './PayDepositDialog';
import { VendorOfflinePaymentsPanel } from './VendorOfflinePaymentsPanel';

const BookingDetail = () => {
  const { format: formatPrice } = useCurrency();
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const { booking, loading, error, refetch } = useBooking(id || null);
  const { data: currentUser } = useCurrentUser();
  const [payDepositOpen, setPayDepositOpen] = useState(false);

  const isSelfBooking =
    !!booking && !!currentUser &&
    booking.provider?.id === currentUser.id &&
    booking.client?.id === currentUser.id;

  const [perspectiveOverride, setPerspectiveOverride] = useState<'organiser' | 'vendor' | null>(null);

  const detectedRole: 'organiser' | 'vendor' =
    booking && currentUser && booking.provider?.id === currentUser.id ? 'vendor' : 'organiser';

  const viewerRole: 'organiser' | 'vendor' = perspectiveOverride ?? detectedRole;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'accepted':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Accepted</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-10 rounded" />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card><CardContent className="p-6"><div className="flex gap-4"><Skeleton className="w-20 h-20 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-4 w-32" /></div></div></CardContent></Card>
            <Card><CardContent className="p-6 space-y-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-64" /><Skeleton className="h-4 w-48" /></CardContent></Card>
          </div>
          <div className="space-y-6">
            <Card><CardContent className="p-6 space-y-3"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></CardContent></Card>
          </div>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <h1 className="flex-1 min-w-0 text-xl sm:text-2xl md:text-3xl font-bold break-words leading-tight">Booking Details</h1>
          <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => navigate(-1)} aria-label="Back">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>
        <div className="text-center py-12 text-destructive">{error || 'Booking not found'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold break-words leading-tight">Booking Details</h1>
          <p className="text-muted-foreground mt-1 text-sm truncate">Booking #{booking.id.slice(0, 8)}</p>
        </div>
        <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* Self-booking perspective toggle */}
      {isSelfBooking && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <Info className="w-4 h-4 text-primary" />
              <span>You booked your own service. Switch perspectives to test both flows.</span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={viewerRole === 'organiser' ? 'default' : 'outline'}
                onClick={() => setPerspectiveOverride('organiser')}
              >
                <Eye className="w-3.5 h-3.5 mr-1" /> View as Organiser
              </Button>
              <Button
                size="sm"
                variant={viewerRole === 'vendor' ? 'default' : 'outline'}
                onClick={() => setPerspectiveOverride('vendor')}
              >
                <Eye className="w-3.5 h-3.5 mr-1" /> View as Vendor
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Service Info */}
          <Card>
            <CardHeader>
              <CardTitle>Service</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {(() => {
                    const img = booking.service.primary_image 
                      || (booking.service as any).image 
                      || (booking.service as any).cover_image
                      || (booking.service as any).image_url
                      || (Array.isArray((booking.service as any).images) && (booking.service as any).images.length > 0
                        ? ((booking.service as any).images[0]?.url || (booking.service as any).images[0]?.image_url || (booking.service as any).images[0])
                        : null);
                    return img ? (
                      <img src={typeof img === 'string' ? img : ''} alt={booking.service.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-lg font-semibold">
                        {booking.service.title.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                    );
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">{booking.service.title}</h3>
                  <p className="text-muted-foreground">{booking.service.category}</p>
                  <Button 
                    variant="link" 
                    className="p-0 h-auto" 
                    onClick={() => navigate(`/services/view/${booking.service.id}`)}
                  >
                    View Service →
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Event Details */}
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {booking.event_name && (
                <div className="flex items-center gap-3">
                  <img src={CalendarIcon} alt="Calendar" className="w-5 h-5" />
                  <div>
                    <p className="font-medium">{booking.event_name}</p>
                    <p className="text-sm text-muted-foreground">{booking.event_type}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <img src={CalendarIcon} alt="Calendar" className="w-5 h-5" />
                <div>
                    <p className="font-medium">{booking.event_date ? new Date(booking.event_date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  }) : 'Date TBD'}</p>
                  {booking.event?.start_time && (
                    <p className="text-sm text-muted-foreground">
                      {booking.event.start_time} - {booking.event.end_time}
                    </p>
                  )}
                </div>
              </div>
              {(booking.location || booking.venue) && (
                <div className="flex items-center gap-3">
                  <img src={LocationIcon} alt="Location" className="w-5 h-5" />
                  <div>
                    <p className="font-medium">{booking.venue || booking.location}</p>
                    {booking.event?.venue_address && (
                      <p className="text-sm text-muted-foreground">{booking.event.venue_address}</p>
                    )}
                  </div>
                </div>
              )}
              {booking.guest_count && (
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <p className="font-medium">{booking.guest_count} guests expected</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Offline payments — vendor-only */}
          {detectedRole === 'vendor' && (
            <VendorOfflinePaymentsPanel eventId={(booking as any)?.event?.id || (booking as any)?.event_id || null} />
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            {booking.provider && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Service Provider</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={booking.provider.avatar || (booking.provider as any).avatar_url || (booking.provider as any).profile_picture_url} />
                      <AvatarFallback>{booking.provider.name.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{booking.provider.name}</p>
                      {booking.provider.rating && (
                        <p className="text-xs text-muted-foreground">⭐ {booking.provider.rating}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {booking.provider.phone && (
                      <a href={`tel:${booking.provider.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                        <Phone className="w-3.5 h-3.5" /> {booking.provider.phone}
                      </a>
                    )}
                    {booking.provider.email && (
                      <a href={`mailto:${booking.provider.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline truncate">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{booking.provider.email}</span>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Client</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={booking.client.avatar || (booking.client as any).avatar_url || (booking.client as any).profile_picture_url} />
                    <AvatarFallback>{booking.client.name.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{booking.client.name}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {booking.client.phone && (
                    <a href={`tel:${booking.client.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                      <Phone className="w-3.5 h-3.5" /> {booking.client.phone}
                    </a>
                  )}
                  {booking.client.email && (
                    <a href={`mailto:${booking.client.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline truncate">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{booking.client.email}</span>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Message & Requirements */}
          {(booking.message || booking.special_requirements) && (
            <Card>
              <CardHeader>
                <CardTitle>Request Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {booking.message && (
                  <div>
                    <p className="font-medium mb-2">Message</p>
                    <p className="text-muted-foreground">{booking.message}</p>
                  </div>
                )}
                {booking.special_requirements && (
                  <div>
                    <p className="font-medium mb-2">Special Requirements</p>
                    <p className="text-muted-foreground">{booking.special_requirements}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Provider Response */}
          {booking.provider_message && (
            <Card>
              <CardHeader>
                <CardTitle>Provider Response</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{booking.provider_message}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Actions */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                {getStatusBadge(booking.status)}
              </div>
              <Separator />
              <div className="space-y-3">
                {booking.quoted_price && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Quoted Price</span>
                    <span className="font-semibold">{formatPrice(booking.quoted_price)}</span>
                  </div>
                )}
                {booking.final_price && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Final Price</span>
                    <span className="font-bold text-primary">{formatPrice(booking.final_price)}</span>
                  </div>
                )}
                {booking.deposit_required && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Deposit</span>
                    <div className="text-right">
                      <span className="font-semibold">{formatPrice(booking.deposit_required)}</span>
                      {booking.deposit_paid ? (
                        <Badge className="ml-2 bg-emerald-500/10 text-emerald-700">Paid</Badge>
                      ) : (
                        <Badge className="ml-2 bg-amber-500/10 text-amber-700">Pending</Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {viewerRole === 'organiser' && booking.status === 'accepted' && !booking.deposit_paid && booking.deposit_required && (
                <>
                  <Separator />
                  <Button className="w-full" onClick={() => setPayDepositOpen(true)}>
                    <DollarSign className="w-4 h-4 mr-2" />
                    Pay Deposit
                  </Button>
                </>
              )}
              {booking.conversation_id && (
                <Button variant="outline" className="w-full">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Messages
                </Button>
              )}
            </CardContent>
          </Card>

          {/* On-site delivery check-in (Phase 1.3) */}
          {booking.id && <DeliveryOtpCard bookingId={booking.id} viewerRole={viewerRole} />}

          {/* Escrow status */}
          {booking.id && <EscrowStatusCard bookingId={booking.id} viewerRole={viewerRole} />}

          {/* Dates */}
          <Card>
            <CardContent className="p-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(booking.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span>{new Date(booking.updated_at).toLocaleDateString()}</span>
              </div>
              {booking.days_until_event !== undefined && booking.days_until_event > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days Until Event</span>
                  <span className="font-semibold text-primary">{booking.days_until_event}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pay Deposit dialog */}
      {booking.deposit_required && (
        <PayDepositDialog
          open={payDepositOpen}
          onOpenChange={setPayDepositOpen}
          bookingId={booking.id}
          amount={Number(booking.deposit_required)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
};

export default BookingDetail;
