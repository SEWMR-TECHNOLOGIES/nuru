import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { rsvpApi, RSVPData, RSVPResponseBody } from "@/lib/api/rsvp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, MapPin, Clock, User, Shirt, Info, Check, XCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import nuruLogo from "@/assets/nuru-logo.png";

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch { return dateStr; }
};

const formatTime = (timeStr?: string | null) => {
  if (!timeStr) return null;
  try {
    const d = new Date(timeStr);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return timeStr; }
};

export default function RSVPConfirmation() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<RSVPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(null);

  // Form state
  const [mealPref, setMealPref] = useState("");
  const [dietary, setDietary] = useState("");
  const [specialReq, setSpecialReq] = useState("");
  

  useEffect(() => {
    if (!code) return;
    (async () => {
      setLoading(true);
      const res = await rsvpApi.getDetails(code);
      if (res.success && res.data) {
        setData(res.data);
        // Pre-fill if already responded
        if (res.data.current_response) {
          setMealPref(res.data.current_response.meal_preference || "");
          setDietary(res.data.current_response.dietary_restrictions || "");
          setSpecialReq(res.data.current_response.special_requests || "");
        }
      } else {
        setError(res.message || "Invalid or expired invitation link");
      }
      setLoading(false);
    })();
  }, [code]);

  const handleRespond = async (status: "confirmed" | "declined") => {
    if (!code) return;
    setSubmitting(true);
    const body: RSVPResponseBody = {
      rsvp_status: status,
      meal_preference: mealPref || undefined,
      dietary_restrictions: dietary || undefined,
      special_requests: specialReq || undefined,
    };
    const res = await rsvpApi.respond(code, body);
    setSubmitting(false);
    if (res.success) {
      setSubmitted(true);
      setSubmittedStatus(status);
    }
  };



  // ── Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Loading invitation...</p>
        </motion.div>
      </div>
    );
  }

  // ── Error state
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

  const { event, invitation, settings } = data;
  const hasResponded = data.current_response && data.current_response.rsvp_status !== "pending";

  // ── Success state after submission
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
            submittedStatus === "confirmed" ? "bg-[hsl(var(--success))]/10" : "bg-destructive/10"
          }`}>
            {submittedStatus === "confirmed"
              ? <Check className="h-10 w-10 text-[hsl(var(--success))]" />
              : <XCircle className="h-10 w-10 text-destructive" />
            }
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {submittedStatus === "confirmed" ? "You're all set!" : "Response recorded"}
          </h1>
          <p className="text-muted-foreground mb-1">
            {submittedStatus === "confirmed"
              ? `We look forward to seeing you at ${event.name}`
              : `Your decline has been recorded for ${event.name}`
            }
          </p>
          <p className="text-xs text-muted-foreground mt-4">You can revisit this link anytime to update your response.</p>
          <a href="https://nuru.tz" className="inline-block mt-8">
            <img src={nuruLogo} alt="Nuru" className="h-5 opacity-30 mx-auto" />
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero / Event Image */}
      <div className="relative w-full h-56 sm:h-72 md:h-80 bg-muted overflow-hidden">
        {event.image_url ? (
          <img src={event.image_url} alt={event.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/10 via-accent/20 to-primary/5 flex items-center justify-center">
            <CalendarDays className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative -mt-20 max-w-lg mx-auto px-4 pb-12"
      >
        {/* Event Details Card */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 sm:p-8">
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <img src={nuruLogo} alt="Nuru" className="h-6 opacity-60" />
            </div>

            {/* Greeting */}
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

            {/* Event Info Grid */}
            <div className="space-y-4">
              {event.start_date && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                    <CalendarDays className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{formatDate(event.start_date)}</p>
                    {event.end_date && event.end_date !== event.start_date && (
                      <p className="text-xs text-muted-foreground">to {formatDate(event.end_date)}</p>
                    )}
                  </div>
                </div>
              )}

              {event.start_time && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{formatTime(event.start_time)}</p>
                    {event.end_time && (
                      <p className="text-xs text-muted-foreground">until {formatTime(event.end_time)}</p>
                    )}
                  </div>
                </div>
              )}

              {event.location && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <p className="text-sm font-medium">{event.location}</p>
                </div>
              )}

              {event.organizer_name && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Hosted by</p>
                    <p className="text-sm font-medium">{event.organizer_name}</p>
                  </div>
                </div>
              )}

              {event.dress_code && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                    <Shirt className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Dress code</p>
                    <p className="text-sm font-medium">{event.dress_code}</p>
                  </div>
                </div>
              )}

              {event.special_instructions && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                    <Info className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Special instructions</p>
                    <p className="text-sm font-medium">{event.special_instructions}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Already responded banner */}
            {hasResponded && (
              <>
                <Separator className="my-6" />
                <div className={`rounded-lg p-3 text-center text-sm ${
                  data.current_response?.rsvp_status === "confirmed"
                    ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                    : "bg-destructive/10 text-destructive"
                }`}>
                  You previously {data.current_response?.rsvp_status === "confirmed" ? "confirmed" : "declined"} — you can update below
                </div>
              </>
            )}

            <Separator className="my-6" />

            {/* Preferences */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Your Details</h3>

              <div>
                <Label className="text-xs text-muted-foreground">Meal Preference</Label>
                {settings.meal_options && settings.meal_options.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {settings.meal_options.map((opt: string) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setMealPref(opt)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          mealPref === opt
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-border hover:bg-muted"
                        }`}
                      >{opt}</button>
                    ))}
                  </div>
                ) : (
                  <Input
                    value={mealPref}
                    onChange={e => setMealPref(e.target.value)}
                    placeholder="e.g. Vegetarian, Halal, No preference"
                    className="mt-1"
                    autoComplete="off"
                    maxLength={200}
                  />
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Dietary Restrictions</Label>
                <Input
                  value={dietary}
                  onChange={e => setDietary(e.target.value)}
                  placeholder="e.g. Nut allergy, Gluten-free"
                  className="mt-1"
                  autoComplete="off"
                  maxLength={500}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Special Requests</Label>
                <Textarea
                  value={specialReq}
                  onChange={e => setSpecialReq(e.target.value)}
                  placeholder="Any special requirements..."
                  className="mt-1 resize-none min-h-[60px]"
                  autoComplete="off"
                  maxLength={500}
                />
              </div>
            </div>



            <Separator className="my-6" />

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-12 text-sm font-semibold border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                onClick={() => handleRespond("declined")}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1.5" />}
                Decline
              </Button>
              <Button
                className="h-12 text-sm font-semibold bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-[hsl(var(--success-foreground))]"
                onClick={() => handleRespond("confirmed")}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                I'll Be There
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
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
