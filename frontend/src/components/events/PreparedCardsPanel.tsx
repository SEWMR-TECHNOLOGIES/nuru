/**
 * Prepared Cards panel.
 *
 * Lists the per-recipient SentEventCard rows that were created via the
 * "Prepare" action (delivery_status='prepared'). The organiser can multi-
 * select rows and either send them via the existing dispatch path or
 * discard them without touching the Sent Cards history.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { showApiErrors } from "@/lib/api/showApiErrors";
import { eventCardsApi, type PreparedCard } from "@/lib/api/eventCards";
import { Send, Trash2, RefreshCcw, Image as ImageIcon } from "lucide-react";

interface Props {
  eventId: string;
}

export default function PreparedCardsPanel({ eventId }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PreparedCard[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"send" | "discard" | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await eventCardsApi.listPreparedCards(eventId);
      if (showApiErrors(r, "Failed to load prepared cards")) return;
      setRows(r.data?.prepared_cards || []);
      setSelected(new Set());
    } catch (err) {
      sonnerToast.error((err as Error)?.message || "Failed to load prepared cards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [eventId]);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.sent_id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const ids = useMemo(() => Array.from(selected), [selected]);

  const send = async () => {
    if (!ids.length) return;
    setBusy("send");
    try {
      const r = await eventCardsApi.sendPreparedCards(eventId, ids);
      if (showApiErrors(r, "Failed to send prepared cards")) return;
      const queued = r.data?.queued ?? 0;
      toast({ title: "Sending", description: `Queued ${queued} card${queued === 1 ? "" : "s"} for delivery.` });
      await load();
    } catch (err) {
      sonnerToast.error((err as Error)?.message || "Failed to send prepared cards");
    } finally {
      setBusy(null);
    }
  };

  const discard = async () => {
    if (!ids.length) return;
    setBusy("discard");
    try {
      const r = await eventCardsApi.discardPreparedCards(eventId, ids);
      if (showApiErrors(r, "Failed to discard prepared cards")) return;
      const n = r.data?.discarded ?? 0;
      toast({ title: "Discarded", description: `Removed ${n} prepared card${n === 1 ? "" : "s"}.` });
      await load();
    } catch (err) {
      sonnerToast.error((err as Error)?.message || "Failed to discard prepared cards");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading prepared cards…</div>;
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
        <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">No prepared cards yet</p>
        <p className="text-xs text-muted-foreground">
          Use the Prepare action from the Templates tab to stage cards here before sending.
        </p>
        <Button variant="outline" size="sm" onClick={load} className="mt-2">
          <RefreshCcw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} id="prep-all" />
          <label htmlFor="prep-all" className="text-sm">
            {selected.size > 0 ? `${selected.size} selected` : `Select all (${rows.length})`}
          </label>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={busy !== null}>
            <RefreshCcw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={discard} disabled={!ids.length || busy !== null}>
            <Trash2 className="w-4 h-4 mr-1" />
            {busy === "discard" ? "Discarding…" : "Discard"}
          </Button>
          <Button size="sm" onClick={send} disabled={!ids.length || busy !== null}>
            <Send className="w-4 h-4 mr-1" />
            {busy === "send" ? "Sending…" : `Send selected${ids.length ? ` (${ids.length})` : ""}`}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((r) => {
          const checked = selected.has(r.sent_id);
          return (
            <div
              key={r.sent_id}
              className={`relative rounded-lg border p-3 space-y-2 transition ${checked ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <div className="absolute top-2 left-2 z-10">
                <Checkbox checked={checked} onCheckedChange={() => toggleOne(r.sent_id)} />
              </div>
              <div className="aspect-[3/4] bg-muted rounded overflow-hidden flex items-center justify-center">
                {r.rendered_card_url ? (
                  <img
                    src={r.rendered_card_url}
                    alt={r.recipient_name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium truncate" title={r.recipient_name}>{r.recipient_name}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">
                    {r.recipient_type === "guest" ? "Guest" : "Contributor"}
                  </Badge>
                  {r.template_name && (
                    <Badge variant="secondary" className="text-[10px]">{r.template_name}</Badge>
                  )}
                </div>
                {r.recipient_phone && (
                  <p className="text-xs text-muted-foreground truncate">{r.recipient_phone}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
