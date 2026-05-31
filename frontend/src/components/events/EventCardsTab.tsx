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
import { useEventContributors } from "@/data/useContributors";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface Props {
  eventId: string;
}

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
  const replaceNodeText = (id: string, value: string) => {
    const re = new RegExp(
      `(<(text|tspan)\\b[^>]*\\bid\\s*=\\s*"${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>)([\\s\\S]*?)(</\\2>)`,
      "i",
    );
    svg = svg.replace(re, (_m, open, _tag, _body, close) => `${open}${escapeHtml(value)}${close}`);
  };
  Object.entries(edits).forEach(([id, val]) => {
    const def = defaults[id] ?? "";
    if ((val ?? "") !== def) replaceNodeText(id, val ?? "");
  });
  if (contributorPlaceholderId && contributorName) {
    replaceNodeText(contributorPlaceholderId, contributorName);
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
  const [sending, setSending] = useState(false);
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

  const openSend = useCallback(() => {
    if (!savedCard) {
      toast({ title: "Save the card first", description: "Configure and save the card before sending." });
      return;
    }
    if (!initialFetched.current) { fetchEventContributors(); initialFetched.current = true; }
    setSelectedContributorIds(new Set());
    setSendOpen(true);
  }, [savedCard, fetchEventContributors]);

  const toggleContributor = (id: string) => {
    setSelectedContributorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onSend = useCallback(async () => {
    if (!activeCategory || selectedContributorIds.size === 0) return;
    setSending(true);
    try {
      await eventCardsApi.sendToContributors(eventId, activeCategory, Array.from(selectedContributorIds));
      toast({ title: "Cards queued", description: `Sending to ${selectedContributorIds.size} contributor(s).` });
      setSendOpen(false);
    } catch (e: any) {
      toast({ title: "Send failed", description: e?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }, [activeCategory, eventId, selectedContributorIds]);

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
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send card to contributors</DialogTitle>
            <DialogDescription>
              Pick the contributors who should receive this card. Each person gets a copy with their own name.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh] pr-2">
            <div className="space-y-1.5">
              {(() => {
                // Only contributors with a recorded pledge ( target > 0 ) can
                // receive a thank-you card / SMS — they're the ones being thanked.
                const eligible = eventContributors.filter((ec) => Number(ec.pledge_amount || 0) > 0);
                if (eligible.length === 0) {
                  return <p className="text-sm text-muted-foreground py-6 text-center">No contributors with a pledge yet.</p>;
                }
                return eligible.map((ec) => {
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
                });
              })()}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)} disabled={sending}>Cancel</Button>
            <Button onClick={onSend} disabled={sending || selectedContributorIds.size === 0}>
              {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending</> : `Send (${selectedContributorIds.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
