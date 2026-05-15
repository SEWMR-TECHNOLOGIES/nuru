/**
 * InvitationView — public preview landing for WhatsApp "View Invitation" CTA.
 *
 * Route: /i/:code
 *
 * Behavior:
 *  - On mobile, if the Nuru app (tz.nuru.app) is installed, the OS hands this
 *    URL to the app via Android App Links / iOS Universal Links automatically.
 *    OpenInAppBanner provides an explicit "Open in app" button as fallback.
 *  - If the visitor is signed in on web, we route them to the in-app event
 *    page so they can RSVP / chat / view contributors with full context.
 *  - Otherwise we render a clean public preview with a single "RSVP Now" CTA
 *    pointing at /rsvp/:code (the existing public RSVP form).
 *
 * The same RSVP API that powers /rsvp/:code is reused — one code, one fetch.
 */
import { useEffect, useState } from "react";
import { Navigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, Clock, MapPin, User, XCircle, Loader2, ArrowRight } from "lucide-react";
import { rsvpApi, RSVPData } from "@/lib/api/rsvp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import VenueMapPreview from "@/components/VenueMapPreview";
import { formatDateLong } from "@/utils/formatDate";
import nuruLogo from "@/assets/nuru-logo.png";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const formatDate = (s?: string | null) => (s ? formatDateLong(s) || s : null);
const formatTime = (s?: string | null) => {
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s;
  const h = parseInt(m[1], 10);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m[2]} ${period}`;
};

export default function InvitationView() {
  const { code } = useParams<{ code: string }>();
  const { userIsLoggedIn, isLoading: authLoading } = useCurrentUser();
  const [data, setData] = useState<RSVPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    (async () => {
      setLoading(true);
      const res = await rsvpApi.getDetails(code);
      if (res.success && res.data) setData(res.data);
      else setError(res.message || "Invalid or expired invitation link");
      setLoading(false);
    })();
  }, [code]);

  // Logged-in users go straight to the in-app event page so they can RSVP,
  // chat with the organiser and see contributors with their full identity.
  if (!authLoading && userIsLoggedIn && data?.event?.id) {
    return <Navigate to={`/event/${data.event.id}`} replace />;
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Invalid Invitation</h1>
          <p className="text-muted-foreground text-sm">{error || "This invitation link is invalid or has expired."}</p>
          <a href="https://nuru.tz" className="inline-block mt-6">
            <img src={nuruLogo} alt="Nuru" className="h-6 opacity-40 mx-auto" />
          </a>
        </motion.div>
      </div>
    );
  }

  const { event, invitation } = data;

  return (
    <div className="min-h-screen bg-background">
      <div className="relative w-full h-56 sm:h-72 md:h-80 bg-muted overflow-hidden">
        {event.image_url ? (
          <img src={event.image_url} alt={event.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/10 via-accent/20 to-primary/5 flex items-center justify-center">
            <CalendarDays className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative -mt-20 max-w-lg mx-auto px-4 pb-12"
      >
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 sm:p-8">
            <div className="flex justify-center mb-4">
              <img src={nuruLogo} alt="Nuru" className="h-6 opacity-60" />
            </div>

            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground mb-1">You're invited</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{event.name}</h1>
              {invitation.guest_name && invitation.guest_name !== "Guest" && (
                <p className="text-muted-foreground mt-2">
                  Dear <span className="font-medium text-foreground">{invitation.guest_name}</span>
                </p>
              )}
            </div>

            {event.description && (
              <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">{event.description}</p>
            )}

            <Separator className="my-6" />

            <div className="space-y-4">
              {event.start_date && (
                <Row icon={<CalendarDays className="h-4 w-4 text-accent-foreground" />}>
                  <p className="text-sm font-medium">{formatDate(event.start_date)}</p>
                  {event.end_date && event.end_date !== event.start_date && (
                    <p className="text-xs text-muted-foreground">to {formatDate(event.end_date)}</p>
                  )}
                </Row>
              )}
              {event.start_time && (
                <Row icon={<Clock className="h-4 w-4 text-accent-foreground" />}>
                  <p className="text-sm font-medium">{formatTime(event.start_time)}</p>
                  {event.end_time && (
                    <p className="text-xs text-muted-foreground">until {formatTime(event.end_time)}</p>
                  )}
                </Row>
              )}
              {(event.location || event.venue) && (
                <Row icon={<MapPin className="h-4 w-4 text-accent-foreground" />}>
                  <p className="text-sm font-medium">{event.venue || event.location}</p>
                  {event.venue_address && event.venue_address !== event.venue && (
                    <p className="text-xs text-muted-foreground mt-0.5">{event.venue_address}</p>
                  )}
                </Row>
              )}
              {event.venue_coordinates && (
                <VenueMapPreview
                  latitude={event.venue_coordinates.latitude}
                  longitude={event.venue_coordinates.longitude}
                  venueName={event.venue || event.location || undefined}
                  address={event.venue_address || undefined}
                  height="180px"
                />
              )}
              {event.organizer_name && (
                <Row icon={<User className="h-4 w-4 text-accent-foreground" />}>
                  <p className="text-xs text-muted-foreground">Hosted by</p>
                  <p className="text-sm font-medium">{event.organizer_name}</p>
                </Row>
              )}
            </div>

            <Separator className="my-6" />

            <Link to={`/rsvp/${code}`} className="block">
              <Button className="w-full h-12 text-sm font-semibold">
                RSVP Now
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>

            <p className="text-center text-xs text-muted-foreground mt-4">
              Have a Nuru account?{" "}
              <Link to={`/login?next=/event/${event.id}`} className="text-primary font-medium hover:underline">
                Sign in
              </Link>{" "}
              to manage this invitation.
            </p>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <a href="https://nuru.tz" target="_blank" rel="noopener noreferrer">
            <img src={nuruLogo} alt="Nuru" className="h-5 opacity-25 mx-auto" />
          </a>
          <p className="text-[10px] text-muted-foreground mt-1">Powered by Nuru</p>
        </div>
      </motion.div>
    </div>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>{children}</div>
    </div>
  );
}
