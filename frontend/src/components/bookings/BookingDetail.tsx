import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft,
  Calendar, 
  Clock,
  MapPin,
  User,
  MessageSquare,
  CheckCircle,
  XCircle,
  DollarSign,
  FileText,
  Phone,
  Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useBooking } from '@/data/useBookings';
import { formatPrice } from '@/utils/formatPrice';

const BookingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { booking, loading, error, refetch } = useBooking(id || null);

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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Booking Details</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>
        <div className="text-center py-12 text-red-500">{error || 'Booking not found'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Booking Details</h1>
          <p className="text-muted-foreground mt-1">Booking #{booking.id.slice(0, 8)}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

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
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted">
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
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{booking.service.title}</h3>
                  <p className="text-muted-foreground">{booking.service.category}</p>
                  <Button 
                    variant="link" 
                    className="p-0 h-auto" 
                    onClick={() => navigate(`/service/${booking.service.id}`)}
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
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{booking.event_name}</p>
                    <p className="text-sm text-muted-foreground">{booking.event_type}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
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
                  <MapPin className="w-5 h-5 text-muted-foreground" />
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
                        <Badge className="ml-2 bg-green-100 text-green-800">Paid</Badge>
                      ) : (
                        <Badge className="ml-2 bg-yellow-100 text-yellow-800">Pending</Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {booking.status === 'accepted' && !booking.deposit_paid && booking.deposit_required && (
                <>
                  <Separator />
                  <Button className="w-full">
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

          {/* Provider Info */}
          {booking.provider && (
            <Card>
              <CardHeader>
                <CardTitle>Service Provider</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={booking.provider.avatar || (booking.provider as any).avatar_url || (booking.provider as any).profile_picture_url} />
                    <AvatarFallback>{booking.provider.name.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{booking.provider.name}</p>
                    {booking.provider.rating && (
                      <p className="text-sm text-muted-foreground">⭐ {booking.provider.rating} rating</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {booking.provider.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a href={`tel:${booking.provider.phone}`} className="text-primary hover:underline">
                        {booking.provider.phone}
                      </a>
                    </div>
                  )}
                  {booking.provider.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href={`mailto:${booking.provider.email}`} className="text-primary hover:underline">
                        {booking.provider.email}
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle>Client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={booking.client.avatar || (booking.client as any).avatar_url || (booking.client as any).profile_picture_url} />
                  <AvatarFallback>{booking.client.name.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{booking.client.name}</p>
                </div>
              </div>
              <div className="space-y-2">
                {booking.client.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a href={`tel:${booking.client.phone}`} className="text-primary hover:underline">
                      {booking.client.phone}
                    </a>
                  </div>
                )}
                {booking.client.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${booking.client.email}`} className="text-primary hover:underline">
                      {booking.client.email}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

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
    </div>
  );
};

export default BookingDetail;
