/**
 * EventCardsTab — organisers pick a thank-you card template, edit the text
 * fields stored per-event in event_cards.custom_text_values, preview the
 * rendered PNG, and dispatch the card to selected contributors.
 *
 * The original SVG template stays untouched on disk; only the per-event
 * overrides are persisted. The contributor name placeholder is substituted
 * server-side at delivery.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import {
  eventCardsApi,
  absolutizeApiUrl,
  type CardCategory,
  type CardTemplateSummary,
  type CardTemplateDetail,
  type SavedEventCard,
} from "@/lib/api/eventCards";
import { uploadsApi } from "@/lib/api/uploads";
import { renderSvgMarkupToPng } from "@/lib/cards/renderCardPng";
import { useEventContributors } from "@/data/useContributors";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface Props {
  eventId: string;
}

type BatchStatus = "not_sent" | "sending" | "sent" | "partial_failure" | "failed" | "cancelled";

interface BatchFailure {
  recipient_id: string;
  name: string;
  reason: string;
}

interface BatchState {
  batch_no: number;
  recipient_ids: string[];
  sent_ids: string[];
  failed: BatchFailure[];
  status: BatchStatus;
  started_at?: string;
  finished_at?: string;
}

interface BatchJob {
  job_id: string;
  event_id: string;
  template_slug: string;
  batch_size: number;
  batches: BatchState[];
}

const BATCH_STORAGE_PREFIX = "nuru.cardBatchJob.";
const loadBatchJob = (jobId: string): BatchJob | null => {
  try {
    const raw = localStorage.getItem(BATCH_STORAGE_PREFIX + jobId);
    return raw ? (JSON.parse(raw) as BatchJob) : null;
  } catch { return null; }
};
const saveBatchJob = (job: BatchJob) => {
  try { localStorage.setItem(BATCH_STORAGE_PREFIX + job.job_id, JSON.stringify(job)); } catch { /* quota */ }
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const centerTextElement = (svg: string, id: string, centerX = 561) => {
  const re = new RegExp(`(<(?:text|tspan)\\b[^>]*\\bid\\s*=\\s*"${escapeRegExp(id)}"[^>]*>)`, "i");
  return svg.replace(re, (open) => {
    let next = open.replace(/transform="matrix\(1\s+0\s+0\s+1\s+[-0-9.]+\s+([-0-9.]+)\)"/i, (_m, y) => `transform="matrix(1 0 0 1 ${centerX} ${y})"`);
    next = /text-anchor=/i.test(next)
      ? next.replace(/text-anchor="[^"]*"/i, 'text-anchor="middle"')
      : next.replace(/>$/, ' text-anchor="middle">');
    return next;
  });
};

/**
 * Replace the body of a multi-line `<text id="...">` element while
 * preserving the original `<tspan>`-based line geometry. The Illustrator
 * export hand-tunes each tspan's `x`/`y` (or `dy`) so the paragraph
 * looks centered between the card's decorative leaves. If we naively
 * dump the edited string in as a single line, the whole paragraph
 * collapses onto one row and overflows the card width.
 *
 * Strategy: read the original tspan count + line-height + the average
 * characters-per-line, word-wrap the new value across the same number
 * of lines (or more if the user typed a longer paragraph), and emit
 * fresh tspans that share `x="0"` so the parent `text-anchor="middle"`
 * keeps every line visually centered around the card axis.
 */
const replaceMultilineText = (svg: string, id: string, newValue: string): string => {
  const elRe = new RegExp(
    `(<text\\b[^>]*\\bid\\s*=\\s*"${escapeRegExp(id)}"[^>]*>)([\\s\\S]*?)(</text>)`,
    "i",
  );
  return svg.replace(elRe, (full, openTag: string, body: string, closeTag: string) => {
    const tspanRe = /<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/gi;
    const tspans: { attrs: string; text: string }[] = [];
    let mm: RegExpExecArray | null;
    while ((mm = tspanRe.exec(body))) tspans.push({ attrs: mm[1], text: mm[2] });

    // Single-line text (no tspans, or only one) — keep the old behaviour
    // so titles/subtitles can keep their original anchor offsets.
    if (tspans.length <= 1) {
      return `${openTag}${escapeHtml(newValue)}${closeTag}`;
    }

    // Detect line height from the first two tspans (their `y` delta or `dy`).
    let lineHeight = 33.84;
    const yOf = (attrs: string) => {
      const dy = parseFloat((attrs.match(/\bdy\s*=\s*"([-0-9.]+)"/i) || [])[1] || "");
      if (!Number.isNaN(dy) && dy) return dy;
      return parseFloat((attrs.match(/\by\s*=\s*"([-0-9.]+)"/i) || [])[1] || "0");
    };
    const y0 = yOf(tspans[0].attrs);
    const y1 = yOf(tspans[1].attrs);
    const delta = y1 - y0;
    if (Math.abs(delta) > 0.5) lineHeight = Math.abs(delta);

    // Reuse the first tspan's class so font sizing/colour stay identical.
    const klass = (tspans[0].attrs.match(/\bclass\s*=\s*"([^"]*)"/i) || [])[1] || "";
    const classAttr = klass ? ` class="${klass}"` : "";

    // Estimate the visual line width from the original wrapping so the
    // re-flow keeps the same paragraph silhouette.
    const decoded = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    const lens = tspans.map((t) => decoded(t.text).trim().length).filter((n) => n > 0);
    const avgLen = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 40;
    const maxLineLen = Math.max(24, Math.round(avgLen * 1.05));

    // Greedy word wrap.
    const words = newValue.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if (!cur) { cur = w; continue; }
      if ((cur + " " + w).length <= maxLineLen) cur += " " + w;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    if (!lines.length) lines.push("");

    const tspansOut = lines
      .map((ln, i) => {
        const pos = i === 0 ? 'y="0"' : `dy="${lineHeight}"`;
        return `<tspan x="0" ${pos}${classAttr}>${escapeHtml(ln)}</tspan>`;
      })
      .join("");

    return `${openTag}${tspansOut}${closeTag}`;
  });
};


/** Strip the XML declaration / DOCTYPE / Adobe Illustrator comments so the
 *  HTML parser doesn't render their trailing `]>` as visible text. */
const sanitizeSvg = (raw: string) =>
  raw
    .replace(/<\?xml[\s\S]*?\?>/i, "")
    .replace(/<!DOCTYPE[\s\S]*?\]>/i, "")
    .replace(/<!DOCTYPE[^>]*>/i, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

/** Apply edits + contributor name + absolute font URLs in the browser so the
 *  preview is instant and doesn't require an authenticated PNG round-trip.
 *  IMPORTANT: only fields the user actually changed (i.e. that differ from the
 *  template default) are touched — otherwise we'd collapse the original
 *  multi-tspan wrapping that the designer hand-tuned in Illustrator. */
function buildPreviewSvg(
  rawSvg: string,
  slug: string,
  edits: Record<string, string>,
  defaults: Record<string, string>,
  contributorPlaceholderId: string | undefined,
  contributorName: string,
  fonts: string[] = [],
): string {
  let svg = sanitizeSvg(rawSvg);

  Object.entries(edits).forEach(([id, val]) => {
    const def = defaults[id] ?? "";
    if ((val ?? "") === def) return;
    // Multi-tspan paragraphs need word-wrap into the same line geometry,
    // otherwise the whole paragraph collapses onto one line and overflows.
    // Single-line titles fall through replaceMultilineText's fast path.
    svg = replaceMultilineText(svg, id, val ?? "");
  });
  if (contributorPlaceholderId && contributorName) {
    svg = replaceMultilineText(svg, contributorPlaceholderId, contributorName);
  }
  if (fonts.length) {
    // Emit @font-face under several family-name aliases so SVGs authored in
    // Illustrator (which strips spaces — e.g. font-family="AnthonyHunter")
    // resolve the same file as ones that keep the spaced family name.
    const faceBlocks = fonts.map((f) => {
      const url = absolutizeApiUrl(`/api/v1/cards/templates/${slug}/asset/${encodeURIComponent(f)}`);
      svg = svg.replace(new RegExp(`url\\((['"]?)${escapeRegExp(f)}\\1\\)`, "g"), `url('${url}')`);
      const isItalic = /italic/i.test(f);
      const bare = f.replace(/\.(ttf|otf|woff2?|eot)$/i, "");
      const spaced = bare.replace(/\s*Italic\s*$/i, "").trim();
      const squashed = spaced.replace(/\s+/g, "");
      const format = /\.otf$/i.test(f) ? "opentype" : /\.woff2$/i.test(f) ? "woff2" : /\.woff$/i.test(f) ? "woff" : "truetype";
      const families = Array.from(new Set([spaced, squashed]));
      return families.map((fam) =>
        `@font-face{font-family:'${fam}';src:url('${url}') format('${format}');font-weight:400;font-style:${isItalic ? "italic" : "normal"};font-display:swap;}`
      ).join("");
    }).join("");
    svg = svg.replace(/<\/svg>\s*$/i, `<style>${faceBlocks}</style></svg>`);
  }
  // Center every editable text node + the contributor placeholder so wrapped
  // or long values stay visually balanced on the card.
  Object.keys(defaults).forEach((id) => { svg = centerTextElement(svg, id); });
  if (contributorPlaceholderId) {
    svg = centerTextElement(svg, contributorPlaceholderId);
  }
  return svg;
}

/** Inline-SVG thumbnail for the template gallery so the contributor name
 *  shows the current user and @font-face URLs resolve absolutely. */
function TemplateThumb({ slug, contributorName }: { slug: string; contributorName: string }) {
  const [markup, setMarkup] = useState<string>("");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await eventCardsApi.getTemplate(slug);
        if (!alive) return;
        const detail = res.data;
        if (!detail) return;
        const defaults: Record<string, string> = {};
        (detail.metadata.editable_fields || []).forEach((f) => { defaults[f.id] = f.default ?? ""; });
        const svg = buildPreviewSvg(
          detail.svg,
          detail.slug,
          {},
          defaults,
          detail.metadata.contributor_placeholder_id,
          contributorName,
          detail.metadata.fonts || [],
        );
        setMarkup(svg);
      } catch {
        /* ignore — fallback to blank */
      }
    })();
    return () => { alive = false; };
  }, [slug, contributorName]);
  if (!markup) return <div className="w-full h-full bg-muted animate-pulse" />;
  return (
    <div
      className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:object-cover"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

export default function EventCardsTab({ eventId }: Props) {
  const [categories, setCategories] = useState<CardCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [templates, setTemplates] = useState<CardTemplateSummary[]>([]);
  const [savedCard, setSavedCard] = useState<SavedEventCard | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<CardTemplateDetail | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewBust, setPreviewBust] = useState(0);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendStep, setSendStep] = useState<"pick" | "batches">("pick");
  const [batchSize, setBatchSize] = useState<number>(20);
  const [batches, setBatches] = useState<BatchState[]>([]);
  const [activeBatchNo, setActiveBatchNo] = useState<number | null>(null);
  const [activeBatchProgress, setActiveBatchProgress] = useState<{ done: number; total: number; currentName?: string } | null>(null);
  const cancelRef = useRef<boolean>(false);
  const [contributorSearch, setContributorSearch] = useState("");
  const [selectedContributorIds, setSelectedContributorIds] = useState<Set<string>>(new Set());

  const { eventContributors, refetch: fetchEventContributors } = useEventContributors(eventId);
  const initialFetched = useRef(false);
  const { data: currentUser } = useCurrentUser();
  const currentUserName = useMemo(() => {
    const fn = (currentUser?.first_name || "").trim();
    const ln = (currentUser?.last_name || "").trim();
    return [fn, ln].filter(Boolean).join(" ") || currentUser?.username || "";
  }, [currentUser]);

  // ── Load categories ────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await eventCardsApi.listCategories();
        if (!alive) return;
        const cats = res.data?.categories || [];
        setCategories(cats);
        if (cats.length && !activeCategory) setActiveCategory(cats[0].category);
      } catch (e: any) {
        toast({ title: "Could not load card categories", description: e?.message, variant: "destructive" });
      } finally {
        if (alive) setLoadingCats(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load templates + the event's saved card for the active category
  useEffect(() => {
    if (!activeCategory || !eventId) return;
    let alive = true;
    (async () => {
      setLoadingTpl(true);
      try {
        const [tplRes, savedRes] = await Promise.all([
          eventCardsApi.listTemplates(activeCategory),
          eventCardsApi.listEventCards(eventId),
        ]);
        if (!alive) return;
        const tpls = tplRes.data?.templates || [];
        setTemplates(tpls);
        const mine = (savedRes.data?.event_cards || []).find((c) => c.category === activeCategory) || null;
        setSavedCard(mine);
        // Decide which template to load into the editor
        const slug = mine?.card_template_slug || tpls[0]?.slug;
        if (slug) {
          const detail = await eventCardsApi.getTemplate(slug);
          if (!alive) return;
          setActiveTemplate(detail.data || null);
          const editable = detail.data?.metadata?.editable_fields || [];
          const seed: Record<string, string> = {};
          editable.forEach((f) => {
            const saved = (mine?.custom_text_values || {})[f.id];
            seed[f.id] = saved !== undefined && saved !== "" ? saved : (f.default ?? "");
          });
          setValues(seed);
        } else {
          setActiveTemplate(null);
          setValues({});
        }
      } catch (e: any) {
        toast({ title: "Could not load templates", description: e?.message, variant: "destructive" });
      } finally {
        if (alive) setLoadingTpl(false);
      }
    })();
    return () => { alive = false; };
  }, [activeCategory, eventId]);

  const pickTemplate = useCallback(async (slug: string) => {
    setLoadingTpl(true);
    try {
      const detail = await eventCardsApi.getTemplate(slug);
      const editable = detail.data?.metadata?.editable_fields || [];
      // Keep existing values when switching templates if the field id matches;
      // otherwise fall back to the template's default for that field.
      const seed: Record<string, string> = {};
      editable.forEach((f) => {
        const existing = values[f.id];
        seed[f.id] = existing !== undefined && existing !== "" ? existing : (f.default ?? "");
      });
      setActiveTemplate(detail.data || null);
      setValues(seed);
    } catch (e: any) {
      toast({ title: "Could not load template", description: e?.message, variant: "destructive" });
    } finally {
      setLoadingTpl(false);
    }
  }, [values]);

  const onSave = useCallback(async () => {
    if (!activeTemplate || !activeCategory) return;
    setSaving(true);
    try {
      const res = await eventCardsApi.saveEventCard(eventId, {
        category: activeCategory,
        card_template_id: activeTemplate.id,
        card_template_slug: activeTemplate.slug,
        custom_text_values: values,
      });
      setSavedCard(res.data || null);
      setPreviewBust(Date.now());
      toast({ title: "Card saved", description: "Your changes are now live for this event." });
    } catch (e: any) {
      toast({ title: "Could not save", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [activeTemplate, activeCategory, eventId, values]);

  const currentJobId = useMemo(
    () => (activeTemplate?.slug ? `${eventId}-${activeTemplate.slug}` : ""),
    [eventId, activeTemplate?.slug],
  );

  const openSend = useCallback(() => {
    if (!savedCard) {
      toast({ title: "Save the card first", description: "Configure and save the card before sending." });
      return;
    }
    if (!initialFetched.current) { fetchEventContributors(); initialFetched.current = true; }
    setSelectedContributorIds(new Set());
    setContributorSearch("");
    // Resume any saved job for this template (so refresh keeps the report)
    const existing = currentJobId ? loadBatchJob(currentJobId) : null;
    if (existing && existing.batches.length > 0) {
      setBatches(existing.batches);
      setBatchSize(existing.batch_size);
      setSendStep("batches");
    } else {
      setBatches([]);
      setSendStep("pick");
    }
    setSendOpen(true);
  }, [savedCard, fetchEventContributors, currentJobId]);

  const toggleContributor = (id: string) => {
    setSelectedContributorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Eligible = contributors with a pledge (the ones we can thank).
  const eligibleContributors = useMemo(
    () => eventContributors.filter((ec) => Number(ec.pledge_amount || 0) > 0),
    [eventContributors],
  );

  // Filtered list driven by the search box (name or phone, case-insensitive).
  const filteredContributors = useMemo(() => {
    const q = contributorSearch.trim().toLowerCase();
    if (!q) return eligibleContributors;
    return eligibleContributors.filter((ec) => {
      const name = (ec.contributor?.name || "").toLowerCase();
      const phone = (ec.contributor?.phone || "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [eligibleContributors, contributorSearch]);

  const allFilteredSelected =
    filteredContributors.length > 0 &&
    filteredContributors.every((ec) => selectedContributorIds.has(ec.id));

  const toggleSelectAllFiltered = () => {
    setSelectedContributorIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredContributors.forEach((ec) => next.delete(ec.id));
      } else {
        filteredContributors.forEach((ec) => next.add(ec.id));
      }
      return next;
    });
  };

  // Build batches from the currently selected contributors and move to step 2.
  const continueToBatches = useCallback(() => {
    if (selectedContributorIds.size === 0 || !activeTemplate?.slug) return;
    const ids = Array.from(selectedContributorIds);
    const size = Math.max(1, batchSize);
    const newBatches: BatchState[] = [];
    for (let i = 0; i < ids.length; i += size) {
      newBatches.push({
        batch_no: newBatches.length + 1,
        recipient_ids: ids.slice(i, i + size),
        sent_ids: [],
        failed: [],
        status: "not_sent",
      });
    }
    setBatches(newBatches);
    if (currentJobId) {
      saveBatchJob({
        job_id: currentJobId,
        event_id: eventId,
        template_slug: activeTemplate.slug,
        batch_size: size,
        batches: newBatches,
      });
    }
    setSendStep("batches");
  }, [selectedContributorIds, batchSize, activeTemplate?.slug, currentJobId, eventId]);

  const persistBatches = useCallback(
    (next: BatchState[]) => {
      setBatches(next);
      if (!currentJobId || !activeTemplate?.slug) return;
      saveBatchJob({
        job_id: currentJobId,
        event_id: eventId,
        template_slug: activeTemplate.slug,
        batch_size: batchSize,
        batches: next,
      });
    },
    [currentJobId, activeTemplate?.slug, eventId, batchSize],
  );

  // Render + upload + send a specific set of recipient ids. Used for both
  // initial batch sends and "retry failed" — keeps the proven single-flow
  // pipeline; only the input list changes.
  const prepareAndSendIds = useCallback(
    async (ids: string[]): Promise<{ sentIds: string[]; failed: BatchFailure[] }> => {
      if (!activeTemplate?.svg || !activeCategory) {
        return { sentIds: [], failed: ids.map((id) => ({ recipient_id: id, name: "", reason: "Template not ready" })) };
      }
      const meta = activeTemplate.metadata || {};
      const defaults: Record<string, string> = {};
      (meta.editable_fields || []).forEach((f) => { defaults[f.id] = f.default ?? ""; });
      const placeholderId = meta.contributor_placeholder_id || "contributor_name_text";

      const idToName: Record<string, string> = {};
      eventContributors.forEach((ec) => {
        if (ids.includes(ec.id)) idToName[ec.id] = ec.contributor?.name || "Friend";
      });

      const failed: BatchFailure[] = [];
      const preRendered: Record<string, string> = {};
      const total = ids.length;
      let done = 0;
      let cursor = 0;
      const CONCURRENCY = 4;

      const worker = async () => {
        while (true) {
          if (cancelRef.current) return;
          const i = cursor++;
          if (i >= ids.length) return;
          const id = ids[i];
          const name = idToName[id] || "Friend";
          setActiveBatchProgress({ done, total, currentName: name });
          try {
            const svg = buildPreviewSvg(
              activeTemplate.svg,
              activeTemplate.slug,
              values,
              defaults,
              placeholderId,
              name,
              meta.fonts || [],
            );
            const blob = await renderSvgMarkupToPng(svg, { width: 1080, pixelRatio: 2 });
            const file = new File([blob], `pledge-card-${id}.png`, { type: "image/png" });
            const res = await uploadsApi.upload(file);
            const url = res.data?.url;
            if (!url) throw new Error("Upload returned no URL");
            preRendered[id] = url;
          } catch (e: any) {
            failed.push({ recipient_id: id, name, reason: e?.message || "Render/upload failed" });
          } finally {
            done += 1;
            setActiveBatchProgress({ done, total, currentName: name });
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));

      const preparedIds = Object.keys(preRendered);
      if (preparedIds.length === 0) {
        return { sentIds: [], failed };
      }
      try {
        await eventCardsApi.sendToContributors(eventId, activeCategory, preparedIds, preRendered);
        return { sentIds: preparedIds, failed };
      } catch (e: any) {
        const reason = e?.message || "Send request failed";
        preparedIds.forEach((id) => failed.push({ recipient_id: id, name: idToName[id] || "Friend", reason }));
        return { sentIds: [], failed };
      }
    },
    [activeTemplate, activeCategory, eventId, values, eventContributors],
  );

  const sendBatch = useCallback(
    async (batchNo: number, opts: { retryOnly?: boolean } = {}) => {
      const target = batches.find((b) => b.batch_no === batchNo);
      if (!target) return;
      const alreadySent = new Set(target.sent_ids);
      const failedIds = new Set(target.failed.map((f) => f.recipient_id));
      const ids = opts.retryOnly
        ? target.recipient_ids.filter((id) => failedIds.has(id) && !alreadySent.has(id))
        : target.recipient_ids.filter((id) => !alreadySent.has(id));
      if (ids.length === 0) {
        toast({ title: "Nothing to send", description: "All recipients in this batch are already sent." });
        return;
      }
      cancelRef.current = false;
      setActiveBatchNo(batchNo);
      setActiveBatchProgress({ done: 0, total: ids.length });
      const started_at = new Date().toISOString();
      persistBatches(batches.map((b) => (b.batch_no === batchNo ? { ...b, status: "sending", started_at } : b)));
      try {
        const { sentIds, failed } = await prepareAndSendIds(ids);
        const finished_at = new Date().toISOString();
        const next = batches.map((b) => {
          if (b.batch_no !== batchNo) return b;
          const newSent = Array.from(new Set([...b.sent_ids, ...sentIds]));
          // Drop previously-failed entries that are now retried successfully.
          const retainedFailures = b.failed.filter((f) => !sentIds.includes(f.recipient_id));
          const mergedFailures = [
            ...retainedFailures.filter((f) => !failed.some((g) => g.recipient_id === f.recipient_id)),
            ...failed,
          ];
          let status: BatchStatus;
          if (cancelRef.current && newSent.length < b.recipient_ids.length) status = "cancelled";
          else if (newSent.length === b.recipient_ids.length) status = "sent";
          else if (newSent.length > 0) status = "partial_failure";
          else status = "failed";
          return { ...b, sent_ids: newSent, failed: mergedFailures, status, started_at, finished_at };
        });
        persistBatches(next);
        toast({
          title: `Batch ${batchNo} ${cancelRef.current ? "cancelled" : "completed"}`,
          description: `${sentIds.length} sent, ${failed.length} failed`,
        });
      } catch (e: any) {
        toast({ title: "Batch failed", description: e?.message, variant: "destructive" });
      } finally {
        cancelRef.current = false;
        setActiveBatchNo(null);
        setActiveBatchProgress(null);
      }
    },
    [batches, persistBatches, prepareAndSendIds],
  );

  const cancelActiveBatch = useCallback(() => { cancelRef.current = true; }, []);

  const goBackToPick = useCallback(() => {
    setSendStep("pick");
  }, []);


  const previewSvgMarkup = useMemo(() => {
    if (!activeTemplate?.svg) return null;
    const meta = activeTemplate.metadata || {};
    const defaults: Record<string, string> = {};
    (meta.editable_fields || []).forEach((f) => { defaults[f.id] = f.default ?? ""; });
    return buildPreviewSvg(
      activeTemplate.svg,
      activeTemplate.slug,
      values,
      defaults,
      meta.contributor_placeholder_id || "contributor_name_text",
      currentUserName,
      meta.fonts || [],
    );
  }, [activeTemplate, values, currentUserName]);

  // ── Render ────────────────────────────────────────────────────────
  if (loadingCats) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading cards…
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          No card templates are available yet.
        </CardContent>
      </Card>
    );
  }

  const editable = activeTemplate?.metadata?.editable_fields || [];
  const lockedIds = new Set(activeTemplate?.metadata?.locked_ids || []);

  return (
    <div className="space-y-6">
      {/* Category pills */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.category}
              onClick={() => setActiveCategory(c.category)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                activeCategory === c.category
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Template gallery */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {templates.map((t) => {
              const selected = activeTemplate?.slug === t.slug;
              return (
                <button
                  key={t.slug}
                  onClick={() => pickTemplate(t.slug)}
                  className={`group relative aspect-[5/7] rounded-xl overflow-hidden border-2 transition ${
                    selected ? "border-primary shadow-md" : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <div className="w-full h-full bg-muted flex items-center justify-center overflow-hidden">
                    <TemplateThumb slug={t.slug} contributorName={currentUserName} />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="text-white text-[11px] font-medium truncate">{t.name}</p>
                  </div>
                  {selected && (
                    <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground">Selected</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Editor + preview */}
      {activeTemplate && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Edit text</CardTitle>
              {loadingTpl && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </CardHeader>
            <CardContent className="space-y-4">
              {editable.length === 0 && (
                <p className="text-sm text-muted-foreground">This template has no editable fields.</p>
              )}
              {editable.map((f) => {
                if (lockedIds.has(f.id)) return null;
                const v = values[f.id] ?? "";
                return (
                  <div key={f.id} className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                    {f.multiline ? (
                      <Textarea
                        value={v}
                        onChange={(e) => setValues((p) => ({ ...p, [f.id]: e.target.value }))}
                        maxLength={f.max_length}
                        rows={3}
                        autoComplete="off"
                      />
                    ) : (
                      <Input
                        value={v}
                        onChange={(e) => setValues((p) => ({ ...p, [f.id]: e.target.value }))}
                        maxLength={f.max_length}
                        autoComplete="off"
                      />
                    )}
                    {f.max_length && (
                      <p className="text-[10px] text-muted-foreground text-right">
                        {v.length}/{f.max_length}
                      </p>
                    )}
                  </div>
                );
              })}
              <div className="flex gap-2 pt-2">
                <Button onClick={onSave} disabled={saving}>
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving</> : "Save card"}
                </Button>
                <Button variant="outline" onClick={openSend} disabled={!savedCard}>
                  Send to contributors
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-[3/4] rounded-xl bg-white overflow-hidden flex items-center justify-center">
                {previewSvgMarkup ? (
                  <div
                    className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                    dangerouslySetInnerHTML={{ __html: previewSvgMarkup }}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground px-6 text-center">
                    Pick a template to see a preview.
                  </p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Contributor names are added automatically when the card is sent.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Send dialog */}
      <Dialog open={sendOpen} onOpenChange={(o) => { if (activeBatchNo === null) setSendOpen(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {sendStep === "pick" ? "Send card to contributors" : "Send in batches"}
            </DialogTitle>
            <DialogDescription>
              {sendStep === "pick"
                ? "Pick contributors and choose a batch size. You'll send each batch manually."
                : "Send each batch manually. The browser only processes one batch at a time."}
            </DialogDescription>
          </DialogHeader>

          {sendStep === "pick" && (
            eligibleContributors.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No contributors with a pledge yet.
              </p>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      Group recipients into batches of:
                    </label>
                    <div className="flex gap-1">
                      {[10, 20, 30, 50].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setBatchSize(n)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${
                            batchSize === n
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input
                    value={contributorSearch}
                    onChange={(e) => setContributorSearch(e.target.value)}
                    placeholder="Search by name or phone"
                    autoComplete="off"
                  />
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAllFiltered}
                    />
                    <span className="flex-1">
                      {allFilteredSelected ? "Unselect all" : "Select all"}
                      <span className="text-muted-foreground ml-1">
                        ({filteredContributors.length}
                        {contributorSearch ? ` of ${eligibleContributors.length}` : ""})
                      </span>
                    </span>
                    {selectedContributorIds.size > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {selectedContributorIds.size} selected
                      </span>
                    )}
                  </label>
                </div>

                <ScrollArea className="max-h-[40vh] pr-2">
                  <div className="space-y-1.5">
                    {filteredContributors.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No contributors match "{contributorSearch}".
                      </p>
                    ) : (
                      filteredContributors.map((ec) => {
                        const id = ec.id;
                        const checked = selectedContributorIds.has(id);
                        const name = ec.contributor?.name || "Unnamed";
                        const phone = ec.contributor?.phone || "";
                        return (
                          <label key={id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
                            <Checkbox checked={checked} onCheckedChange={() => toggleContributor(id)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{name}</p>
                              {phone && <p className="text-xs text-muted-foreground truncate">{phone}</p>}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </>
            )
          )}

          {sendStep === "batches" && (
            <BatchesView
              batches={batches}
              batchSize={batchSize}
              activeBatchNo={activeBatchNo}
              activeBatchProgress={activeBatchProgress}
              recipientNames={Object.fromEntries(
                eligibleContributors.map((ec) => [ec.id, ec.contributor?.name || "Unnamed"])
              )}
              onSendBatch={(n) => sendBatch(n)}
              onRetryFailed={(n) => sendBatch(n, { retryOnly: true })}
              onResendAll={(n) => {
                if (!window.confirm("Resend the entire batch? This may deliver the card a second time to recipients already marked as sent.")) return;
                persistBatches(batches.map((b) => (b.batch_no === n ? { ...b, sent_ids: [], failed: [], status: "not_sent" } : b)));
              }}
              onClearReport={(n) => {
                persistBatches(batches.map((b) => (b.batch_no === n ? { ...b, sent_ids: [], failed: [], status: "not_sent", started_at: undefined, finished_at: undefined } : b)));
              }}
              onCancelActive={cancelActiveBatch}
            />
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {sendStep === "pick" ? (
              <>
                <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
                <Button onClick={continueToBatches} disabled={selectedContributorIds.size === 0}>
                  Continue ({selectedContributorIds.size} → {Math.ceil(selectedContributorIds.size / Math.max(1, batchSize))} batch{Math.ceil(selectedContributorIds.size / Math.max(1, batchSize)) === 1 ? "" : "es"})
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={goBackToPick} disabled={activeBatchNo !== null}>
                  Back to selection
                </Button>
                <Button variant="outline" onClick={() => setSendOpen(false)} disabled={activeBatchNo !== null}>
                  Close
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface BatchesViewProps {
  batches: BatchState[];
  batchSize: number;
  activeBatchNo: number | null;
  activeBatchProgress: { done: number; total: number; currentName?: string } | null;
  recipientNames: Record<string, string>;
  onSendBatch: (n: number) => void;
  onRetryFailed: (n: number) => void;
  onResendAll: (n: number) => void;
  onClearReport: (n: number) => void;
  onCancelActive: () => void;
}

const STATUS_LABELS: Record<BatchStatus, string> = {
  not_sent: "Not sent",
  sending: "Sending",
  sent: "Sent",
  partial_failure: "Partial failure",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_BADGE: Record<BatchStatus, string> = {
  not_sent: "bg-muted text-muted-foreground",
  sending: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  sent: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  partial_failure: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

function BatchesView({
  batches, batchSize, activeBatchNo, activeBatchProgress, recipientNames,
  onSendBatch, onRetryFailed, onResendAll, onClearReport, onCancelActive,
}: BatchesViewProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (n: number) => setExpanded((p) => {
    const next = new Set(p);
    if (next.has(n)) next.delete(n); else next.add(n);
    return next;
  });

  const totalSelected = batches.reduce((s, b) => s + b.recipient_ids.length, 0);
  const totalSent = batches.reduce((s, b) => s + b.sent_ids.length, 0);
  const totalFailed = batches.reduce((s, b) => s + b.failed.length, 0);
  const totalPending = Math.max(0, totalSelected - totalSent - totalFailed);
  const completed = batches.filter((b) => b.status === "sent").length;
  const remaining = batches.length - completed;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
        <p className="font-medium text-foreground">
          {totalSelected} selected · {totalSent} sent · {totalFailed} failed · {totalPending} pending
        </p>
        <p className="text-muted-foreground">
          {completed} of {batches.length} batches completed · {remaining} remaining · batch size {batchSize}
        </p>
      </div>

      <ScrollArea className="max-h-[55vh] pr-2">
        <div className="space-y-2">
          {batches.map((b) => {
            const start = (b.batch_no - 1) * batchSize + 1;
            const end = start + b.recipient_ids.length - 1;
            const sentCount = b.sent_ids.length;
            const failedCount = b.failed.length;
            const pendingCount = b.recipient_ids.length - sentCount - failedCount;
            const isActive = activeBatchNo === b.batch_no;
            const isOpen = expanded.has(b.batch_no);
            return (
              <div key={b.batch_no} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      Batch {b.batch_no} · {start}–{end} of {totalSelected}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.recipient_ids.length} recipients · sent {sentCount} · failed {failedCount} · pending {pendingCount}
                    </p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[b.status]}`}>
                    {STATUS_LABELS[b.status]}
                  </span>
                </div>

                {isActive && activeBatchProgress && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      Preparing {activeBatchProgress.done} of {activeBatchProgress.total}
                      {activeBatchProgress.currentName ? `: ${activeBatchProgress.currentName}` : ""}
                    </p>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${activeBatchProgress.total ? (activeBatchProgress.done / activeBatchProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {b.status === "not_sent" && (
                    <Button size="sm" onClick={() => onSendBatch(b.batch_no)} disabled={activeBatchNo !== null}>
                      {isActive ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Sending</> : "Send batch"}
                    </Button>
                  )}
                  {(b.status === "partial_failure" || b.status === "cancelled") && pendingCount > 0 && (
                    <Button size="sm" onClick={() => onSendBatch(b.batch_no)} disabled={activeBatchNo !== null}>
                      Send remaining ({pendingCount})
                    </Button>
                  )}
                  {failedCount > 0 && (
                    <Button size="sm" variant="outline" onClick={() => onRetryFailed(b.batch_no)} disabled={activeBatchNo !== null}>
                      Retry failed ({failedCount})
                    </Button>
                  )}
                  {(b.status === "sent" || b.status === "partial_failure" || b.status === "failed" || b.status === "cancelled") && (
                    <Button size="sm" variant="ghost" onClick={() => onResendAll(b.batch_no)} disabled={activeBatchNo !== null}>
                      Resend all
                    </Button>
                  )}
                  {b.status === "sent" && (
                    <Button size="sm" variant="ghost" onClick={() => onClearReport(b.batch_no)} disabled={activeBatchNo !== null}>
                      Clear report
                    </Button>
                  )}
                  {isActive && (
                    <Button size="sm" variant="outline" onClick={onCancelActive}>
                      Cancel
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => toggle(b.batch_no)}>
                    {isOpen ? "Hide recipients" : "View recipients"}
                  </Button>
                </div>

                {isOpen && (
                  <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border">
                    <p className="font-medium text-foreground">Recipients ({b.recipient_ids.length})</p>
                    <p className="break-words">{b.recipient_ids.map((id) => recipientNames[id] || id).join(", ")}</p>
                    {b.failed.length > 0 && (
                      <>
                        <p className="font-medium text-foreground pt-1">Failed</p>
                        <ul className="space-y-0.5">
                          {b.failed.map((f) => (
                            <li key={f.recipient_id}>
                              {f.name || f.recipient_id} — {f.reason}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {b.started_at && (
                      <p className="pt-1">
                        Started {new Date(b.started_at).toLocaleString()}
                        {b.finished_at ? ` · Finished ${new Date(b.finished_at).toLocaleString()}` : ""}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
