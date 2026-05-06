/**
 * EventSponsors — organiser invites vendor services as sponsors and tracks
 * accept/decline responses. All values come from the backend.
 */
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { eventsApi } from "@/lib/api";
import { servicesApi } from "@/lib/api/services";
import { useCurrency } from "@/hooks/useCurrency";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

interface Props {
  eventId: string;
  isCreator: boolean;
}

export default function EventSponsors({ eventId, isCreator }: Props) {
  const { format } = useCurrency();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [amount, setAmount] = useState("");

  const load = () => {
    setLoading(true);
    eventsApi
      .listSponsors(eventId)
      .then((r) => setItems((r.data as any)?.items || []))
      .finally(() => setLoading(false));
  };
  useEffect(load, [eventId]);

  useEffect(() => {
    if (!pickerOpen || !search.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await servicesApi.search({ search } as any);
        setResults(((r.data as any)?.services || (r.data as any) || []).slice(0, 12));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, pickerOpen]);

  const invite = async (svc: any) => {
    const amt = amount ? parseFloat(amount) : undefined;
    const res = await eventsApi.inviteSponsor(eventId, {
      user_service_id: svc.id,
      contribution_amount: amt,
    });
    if (res.success) {
      toast.success("Sponsor invitation sent");
      setPickerOpen(false);
      setSearch("");
      setAmount("");
      load();
    } else {
      toast.error(res.message || "Could not invite");
    }
  };

  const cancel = async (id: string) => {
    const res = await eventsApi.cancelSponsor(eventId, id);
    if (res.success) {
      toast.success("Removed");
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Event Sponsors</h2>
          <p className="text-xs text-muted-foreground">
            Invite vendors to support your event. They receive the request in their bookings inbox.
          </p>
        </div>
        {isCreator && (
          <Button size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Invite Sponsor
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-10 text-center">
            <p className="text-sm text-muted-foreground">No sponsors yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((s) => (
            <Card key={s.id} className="rounded-2xl">
              <CardContent className="p-4 flex items-center gap-3">
                {s.service?.image ? (
                  <img src={s.service.image} alt="" className="w-14 h-14 rounded-xl object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{s.service?.title || "Service"}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.vendor?.name || ""}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={s.status === "accepted" ? "default" : s.status === "declined" ? "destructive" : "secondary"}>
                      {s.status}
                    </Badge>
                    {s.contribution_amount != null && (
                      <span className="text-xs font-semibold tabular-nums">{format(s.contribution_amount)}</span>
                    )}
                  </div>
                </div>
                {isCreator && (
                  <Button size="icon" variant="ghost" onClick={() => cancel(s.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a Sponsor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search vendor services..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Optional sponsorship amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoComplete="off"
            />
            <div className="max-h-72 overflow-y-auto space-y-2">
              {searching && <p className="text-xs text-muted-foreground">Searching...</p>}
              {!searching && results.length === 0 && search && (
                <p className="text-xs text-muted-foreground">No services found.</p>
              )}
              {results.map((svc: any) => (
                <button
                  key={svc.id}
                  onClick={() => invite(svc)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/40 text-left"
                >
                  {svc.primary_image || svc.image_url ? (
                    <img src={svc.primary_image || svc.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{svc.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{svc.category || svc.service_type_name || ""}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
