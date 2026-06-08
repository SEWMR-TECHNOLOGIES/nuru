/**
 * Prepared Cards panel.
 *
 * Lists the per-recipient SentEventCard rows that were created via the
 * "Prepare" action (delivery_status='prepared'). The organiser can multi-
 * select rows and either send them via the existing dispatch path, discard
 * them, or download the rendered cards as images / PDF — the download path
 * mirrors the Sent Cards tab (client-side ZIP for >1 image, combined PDF
 * for multi-page) and never marks anything as sent.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { showApiErrors } from "@/lib/api/showApiErrors";
import { eventCardsApi, type PreparedCard } from "@/lib/api/eventCards";
import {
  Send,
  Trash2,
  RefreshCcw,
  Image as ImageIcon,
  Download,
  FileText,
  Loader2,
} from "lucide-react";

interface Props {
  eventId: string;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const safeSeg = (s: string) =>
  (s || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") || "card";

const timestamp = () =>
  new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

const fileBase = (r: PreparedCard) => {
  const name = safeSeg(r.recipient_name || "card");
  const cat = r.category ? safeSeg(r.category) : "";
  return cat ? `${name}_${cat}` : name;
};

async function fetchCardBlob(url: string): Promise<Blob> {
  try {
    const r = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (r.ok) return await r.blob();
  } catch {}
  const r2 = await fetch(url, { cache: "force-cache" });
  if (!r2.ok) throw new Error(`Failed to fetch card (${r2.status})`);
  return await r2.blob();
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });

const loadImageSize = (dataUrl: string): Promise<{ w: number; h: number }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = dataUrl;
  });

export default function PreparedCardsPanel({ eventId }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PreparedCard[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"send" | "discard" | "images" | "pdf" | null>(null);
  const [rowBusy, setRowBusy] = useState<{ id: string; kind: "image" | "pdf" } | null>(null);

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

  const downloadOne = async (r: PreparedCard, kind: "image" | "pdf") => {
    if (!r.rendered_card_url) {
      toast({ title: "No card image", description: "This prepared card has no rendered image yet.", variant: "destructive" });
      return;
    }
    setRowBusy({ id: r.sent_id, kind });
    try {
      const blob = await fetchCardBlob(r.rendered_card_url);
      const base = fileBase(r);
      if (kind === "image") {
        triggerBlobDownload(blob, `${base}.png`);
      } else {
        const { jsPDF } = await import("jspdf");
        const dataUrl = await blobToDataUrl(blob);
        const { w, h } = await loadImageSize(dataUrl);
        const pdf = new jsPDF({
          orientation: w >= h ? "landscape" : "portrait",
          unit: "px",
          format: [w, h],
          compress: true,
        });
        pdf.addImage(dataUrl, "PNG", 0, 0, w, h, undefined, "FAST");
        pdf.save(`${base}.pdf`);
      }
    } catch (err) {
      toast({
        title: "Download failed",
        description: (err as Error)?.message || "Could not download the card.",
        variant: "destructive",
      });
    } finally {
      setRowBusy(null);
    }
  };

  const downloadSelected = async (format: "images" | "pdf") => {
    const chosen = rows.filter((r) => selected.has(r.sent_id) && !!r.rendered_card_url);
    if (chosen.length === 0) {
      toast({
        title: "No card image",
        description: "Selected prepared cards have no rendered image yet.",
        variant: "destructive",
      });
      return;
    }
    setBusy(format);
    try {
      const fetched = await Promise.all(
        chosen.map(async (r) => ({ rec: r, blob: await fetchCardBlob(r.rendered_card_url as string) })),
      );
      if (format === "images") {
        if (fetched.length === 1) {
          triggerBlobDownload(fetched[0].blob, `${fileBase(fetched[0].rec)}.png`);
        } else {
          const { default: JSZip } = await import("jszip");
          const zip = new JSZip();
          const used = new Set<string>();
          for (const { rec, blob } of fetched) {
            const base = fileBase(rec);
            let name = `${base}.png`;
            let i = 2;
            while (used.has(name)) name = `${base}_${i++}.png`;
            used.add(name);
            zip.file(name, blob);
          }
          const out = await zip.generateAsync({ type: "blob" });
          triggerBlobDownload(out, `prepared_cards_${timestamp()}.zip`);
        }
      } else {
        const { jsPDF } = await import("jspdf");
        const pages = await Promise.all(
          fetched.map(async ({ rec, blob }) => {
            const dataUrl = await blobToDataUrl(blob);
            const { w, h } = await loadImageSize(dataUrl);
            return { rec, dataUrl, w, h };
          }),
        );
        const first = pages[0];
        const pdf = new jsPDF({
          orientation: first.w >= first.h ? "landscape" : "portrait",
          unit: "px",
          format: [first.w, first.h],
          compress: true,
        });
        pdf.addImage(first.dataUrl, "PNG", 0, 0, first.w, first.h, undefined, "FAST");
        for (let i = 1; i < pages.length; i++) {
          const p = pages[i];
          pdf.addPage([p.w, p.h], p.w >= p.h ? "landscape" : "portrait");
          pdf.addImage(p.dataUrl, "PNG", 0, 0, p.w, p.h, undefined, "FAST");
        }
        const filename =
          pages.length === 1
            ? `${fileBase(pages[0].rec)}.pdf`
            : `prepared_cards_${timestamp()}.pdf`;
        pdf.save(filename);
      }
      toast({
        title: format === "pdf" ? "PDF ready" : fetched.length === 1 ? "Card downloaded" : "Cards ready",
        description: `Downloaded ${fetched.length} prepared card${fetched.length === 1 ? "" : "s"}.`,
      });
    } catch (err) {
      toast({
        title: "Download failed",
        description: (err as Error)?.message || "Could not download the selected cards.",
        variant: "destructive",
      });
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

  const selectionCount = selected.size;
  const disableBulk = selectionCount === 0 || busy !== null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} id="prep-all" />
          <label htmlFor="prep-all" className="text-sm">
            {selectionCount > 0 ? `${selectionCount} selected` : `Select all (${rows.length})`}
          </label>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={load} disabled={busy !== null}>
            <RefreshCcw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadSelected("images")} disabled={disableBulk}>
            {busy === "images" ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Preparing…</>
            ) : (
              <><Download className="w-4 h-4 mr-1" />Download images</>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadSelected("pdf")} disabled={disableBulk}>
            {busy === "pdf" ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Preparing…</>
            ) : (
              <><FileText className="w-4 h-4 mr-1" />Download PDF</>
            )}
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
          const thisRowImageBusy = rowBusy?.id === r.sent_id && rowBusy.kind === "image";
          const thisRowPdfBusy = rowBusy?.id === r.sent_id && rowBusy.kind === "pdf";
          const hasImage = !!r.rendered_card_url;
          return (
            <div
              key={r.sent_id}
              className={`relative rounded-lg border p-3 space-y-2 transition ${checked ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <div className="absolute top-2 left-2 z-10">
                <Checkbox checked={checked} onCheckedChange={() => toggleOne(r.sent_id)} />
              </div>
              <div className="aspect-[3/4] bg-muted rounded overflow-hidden flex items-center justify-center">
                {hasImage ? (
                  <img
                    src={r.rendered_card_url as string}
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
              <div className="flex gap-1 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => downloadOne(r, "image")}
                  disabled={!hasImage || rowBusy !== null}
                  title="Download image"
                >
                  {thisRowImageBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <><Download className="w-3.5 h-3.5 mr-1" />Image</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => downloadOne(r, "pdf")}
                  disabled={!hasImage || rowBusy !== null}
                  title="Download PDF"
                >
                  {thisRowPdfBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <><FileText className="w-3.5 h-3.5 mr-1" />PDF</>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
