import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, MapPin, Users, Calendar, CheckCircle, XCircle, Loader2, Printer, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { eventsApi } from '@/lib/api/events';
import { toast } from 'sonner';
import { showCaughtError } from '@/lib/api';
import InvitationCard from './InvitationCard';

const EventView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [respondingStatus, setRespondingStatus] = useState<string | null>(null);
  const [rsvpStatus, setRsvpStatus] = useState<string>('pending');
  const [showInvitationCard, setShowInvitationCard] = useState(false);

  const fetchEvent = useCallback(async () => {
    if (!id) return;
    try {
      const res = await eventsApi.getById(id);
      if (res.success && res.data) {
        setEvent(res.data);
      }
    } catch {
      toast.error('Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Also fetch invitation status
  useEffect(() => {
    if (!id) return;
    eventsApi.getInvitedEvents({ limit: 100 }).then(res => {
      if (res.success) {
        const inv = res.data?.events?.find((e: any) => e.id === id);
        if (inv?.invitation?.rsvp_status) {
          setRsvpStatus(inv.invitation.rsvp_status);
        }
      }
    }).catch(() => {});
  }, [id]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  const handleRSVP = async (status: 'confirmed' | 'declined') => {
    if (!id) return;
    setRespondingStatus(status);
    try {
      const res = await eventsApi.respondToInvitation(id, { rsvp_status: status });
      if (res.success) {
        setRsvpStatus(status);
        toast.success(status === 'confirmed' ? 'You have accepted the invitation!' : 'You have declined the invitation.');
      } else {
        toast.error(res.message || 'Failed to update RSVP');
      }
    } catch (err: any) {
      showCaughtError(err, 'Failed to respond');
    } finally {
      setRespondingStatus(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-6 w-1/2" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-4">Event not found or you don't have access.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const coverImage = event.cover_image || event.images?.[0]?.url;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center flex-row-reverse justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Event</h1>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* Cover Image */}
      {coverImage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full h-56 sm:h-72 rounded-xl overflow-hidden"
        >
          <img
            src={coverImage}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <Badge className="bg-primary/90 text-primary-foreground mb-2">
              {event.event_type?.name || 'Event'}
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{event.title}</h1>
          </div>
        </motion.div>
      )}

      {!coverImage && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{event.title}</h1>
          {event.event_type?.name && (
            <Badge variant="outline" className="mt-2">{event.event_type.name}</Badge>
          )}
        </motion.div>
      )}

      {/* RSVP Status & Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Your RSVP Status</p>
                <Badge className={
                  rsvpStatus === 'confirmed' ? 'bg-green-100 text-green-800' :
                  rsvpStatus === 'declined' ? 'bg-destructive/10 text-destructive' :
                  'bg-amber-100 text-amber-800'
                }>
                  {rsvpStatus === 'confirmed' && <CheckCircle className="w-3 h-3 mr-1" />}
                  {rsvpStatus === 'declined' && <XCircle className="w-3 h-3 mr-1" />}
                  {rsvpStatus.charAt(0).toUpperCase() + rsvpStatus.slice(1)}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {rsvpStatus === 'pending' && (
                  <>
                    <Button size="sm" onClick={() => handleRSVP('confirmed')} disabled={!!respondingStatus} className="gap-1.5">
                      {respondingStatus === 'confirmed' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Accept
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRSVP('declined')} disabled={!!respondingStatus} className="gap-1.5 text-destructive hover:text-destructive">
                      {respondingStatus === 'declined' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Decline
                    </Button>
                  </>
                )}
                {rsvpStatus === 'confirmed' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleRSVP('declined')} disabled={!!respondingStatus} className="gap-1.5 text-destructive hover:text-destructive">
                      {respondingStatus === 'declined' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Cancel RSVP
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowInvitationCard(true)} className="gap-1.5">
                      <Printer className="w-4 h-4" />
                      Invitation Card
                    </Button>
                  </>
                )}
                {rsvpStatus === 'declined' && (
                  <Button size="sm" variant="outline" onClick={() => handleRSVP('confirmed')} disabled={!!respondingStatus} className="gap-1.5">
                    {respondingStatus === 'confirmed' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Accept Instead
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Event Details */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {event.start_date && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium text-foreground">
                  {new Date(event.start_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {event.start_time && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Time</p>
                <p className="font-medium text-foreground">{event.start_time}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {(event.location || event.venue) && (
          <Card className="sm:col-span-2">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium text-foreground">{event.venue || event.location}</p>
                {event.venue && event.location && event.venue !== event.location && (
                  <p className="text-sm text-muted-foreground">{event.location}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {event.total_guests > 0 && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Guests</p>
                <p className="font-medium text-foreground">{event.confirmed_guests || 0} confirmed of {event.total_guests}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Description */}
      {event.description && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold text-foreground mb-2">About This Event</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Dress Code & Instructions */}
      {(event.dress_code || event.special_instructions) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card>
            <CardContent className="p-5 space-y-3">
              {event.dress_code && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Dress Code</h3>
                  <p className="text-foreground">{event.dress_code}</p>
                </div>
              )}
              {event.special_instructions && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Special Instructions</h3>
                  <p className="text-foreground">{event.special_instructions}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Schedule */}
      {event.schedule?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold text-foreground mb-4">Event Schedule</h2>
              <div className="space-y-3">
                {event.schedule.map((item: any) => (
                  <div key={item.id} className="flex gap-3 items-start">
                    <div className="w-16 text-sm font-medium text-primary flex-shrink-0">
                      {item.start_time ? new Date(item.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                    <div className="flex-1 border-l-2 border-primary/20 pl-3">
                      <p className="font-medium text-foreground">{item.title}</p>
                      {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Invitation Card Dialog */}
      {showInvitationCard && id && (
        <InvitationCard
          eventId={id}
          open={showInvitationCard}
          onClose={() => setShowInvitationCard(false)}
        />
      )}
    </div>
  );
};

export default EventView;
