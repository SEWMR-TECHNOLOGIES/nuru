import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, CalendarDays, MapPin, Users, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api/admin";
import { useAdminMeta } from "@/hooks/useAdminMeta";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusBadge = (s: string) => {
  if (s === "published") return "bg-primary/10 text-primary";
  if (s === "confirmed") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  if (s === "completed") return "bg-muted text-muted-foreground";
  if (s === "cancelled") return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
};

export default function AdminEventDetail() {
  useAdminMeta("Event Detail");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await adminApi.getEventDetail(id);
    if (res.success) setEvent(res.data);
    else toast.error("Failed to load event details");
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Event not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/events")}>Back to Events</Button>
      </div>
    );
  }

  // Backend returns start_date; resolve hero image using standard fallback chain
  const heroImage = event.image || event.featured_image || event.primary_image || event.image_url || event.cover_image_url
    || (event.images?.length > 0 ? (event.images[0].url || event.images[0].image_url || event.images[0].file_url || event.images[0]) : null);

  // Parse date/time from start_date (ISO string)
  let displayDate = "—";
  let displayTime = "—";
  const dateRaw = event.start_date || event.date;
  if (dateRaw) {
    const d = new Date(dateRaw);
    displayDate = d.toLocaleDateString("en-TZ", { weekday: "short", year: "numeric", month: "long", day: "numeric" });
    displayTime = d.toLocaleTimeString("en-TZ", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/events")}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Events
        </Button>
        <div className="flex-1" />
        <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium capitalize", statusBadge(event.status))}>
          {event.status}
        </span>
      </div>

      {/* Hero */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {heroImage && (
          <div className="h-56 overflow-hidden bg-muted">
            <img src={heroImage} alt={event.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-5">
          <h1 className="text-2xl font-bold text-foreground">{event.name}</h1>
          {event.tagline && <p className="text-muted-foreground mt-1">{event.tagline}</p>}
          {event.description && <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{event.description}</p>}
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1"><CalendarDays className="w-3.5 h-3.5" /> Date</p>
          <p className="font-semibold text-foreground text-sm">{displayDate}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1"><Clock className="w-3.5 h-3.5" /> Time</p>
          <p className="font-semibold text-foreground text-sm">{event.time || displayTime}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1"><MapPin className="w-3.5 h-3.5" /> Location</p>
          <p className="font-semibold text-foreground text-sm">{event.location || event.venue || "—"}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5" /> Guests</p>
          <p className="font-semibold text-foreground text-sm">{event.guest_count ?? event.rsvp_count ?? "—"}</p>
        </div>
      </div>

      {/* Organizer */}
      {event.organizer && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Organizer</p>
          <div className="flex items-center gap-3">
            {event.organizer.avatar ? (
              <img src={event.organizer.avatar} alt={event.organizer.name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {event.organizer.name?.[0] || "?"}
              </div>
            )}
            <div>
              <p className="font-semibold text-foreground">{event.organizer.name}</p>
              <p className="text-xs text-muted-foreground">{event.organizer.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Event type & category */}
      {(event.event_type || event.category || event.budget || event.committee_count !== undefined) && (
        <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-6">
          {event.event_type && (
            <div>
              <p className="text-xs text-muted-foreground">Event Type</p>
              <p className="font-medium text-foreground text-sm">{event.event_type}</p>
            </div>
          )}
          {event.category && (
            <div>
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="font-medium text-foreground text-sm">{event.category}</p>
            </div>
          )}
          {event.budget && (
            <div>
              <p className="text-xs text-muted-foreground">Budget (TZS)</p>
              <p className="font-medium text-foreground text-sm">{Number(event.budget).toLocaleString()}</p>
            </div>
          )}
          {event.committee_count !== undefined && (
            <div>
              <p className="text-xs text-muted-foreground">Committee Members</p>
              <p className="font-medium text-foreground text-sm">{event.committee_count}</p>
            </div>
          )}
          {event.is_public !== undefined && (
            <div>
              <p className="text-xs text-muted-foreground">Visibility</p>
              <p className="font-medium text-foreground text-sm">{event.is_public ? "Public" : "Private"}</p>
            </div>
          )}
        </div>
      )}

      {/* Images */}
      {event.images?.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-foreground mb-3">Event Images ({event.images.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {event.images.map((img: any, i: number) => (
              <a key={i} href={img.url || img.image_url || img} target="_blank" rel="noopener noreferrer">
                <img src={img.url || img.image_url || img} alt="" className="w-full h-32 object-cover rounded-xl border border-border hover:opacity-80 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

