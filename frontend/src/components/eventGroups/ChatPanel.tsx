/**
 * Premium chat panel for the Event Group Workspace.
 * - WhatsApp-style bubbles, image messages, replies, reactions
 * - Soft polling via ?after= cursor (no UI flicker)
 * - Quick reactions (6) + full picker
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Smile, Reply, Trash2, X, CheckCheck, ArrowDown, Send, Lock } from "lucide-react";
import CustomImageIcon from "@/assets/icons/image-icon.svg";
import ChatIcon from "@/assets/icons/chat-icon.svg";
import { motion, AnimatePresence } from "framer-motion";
import { formatLocalTime } from "@/utils/formatLocalDateTime";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { eventGroupsApi } from "@/lib/api/eventGroups";
import { uploadsApi } from "@/lib/api/uploads";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePolling } from "@/hooks/usePolling";
import { toast } from "sonner";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const FULL_EMOJIS = [
  ...QUICK_EMOJIS, "🎉", "🔥", "💯", "👏", "🤝", "💪", "✨", "🥳", "💸", "💰",
  "🤔", "😎", "😭", "😡", "🙌", "👀", "🚀", "💡", "✅", "❌",
];

interface Member {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  role?: string;
  user_id?: string | null;
}
interface ReactionGroup { emoji: string; count: number; members: string[]; mine?: boolean }
interface Msg {
  id: string;
  message_type: "text" | "image" | "system";
  content?: string | null;
  image_url?: string | null;
  sender_member_id?: string | null;
  sender_name?: string | null;
  sender_avatar_url?: string | null;
  reply_to?: { id: string; content?: string; sender_name?: string } | null;
  reactions?: ReactionGroup[];
  created_at: string;
  is_deleted?: boolean;
  metadata?: {
    kind?: string;
    contributor_name?: string;
    amount?: number;
    pledge?: number;
    paid?: number;
    balance?: number;
    currency?: string;
  } | null;
}

/**
 * Premium system-message renderer. For payment events we draw a richer card
 * with avatar circle, amount, and an inline pledge progress bar. When the
 * contributor has fully paid their pledge we switch to a celebratory
 * "Pledge complete" treatment.
 */
const SystemMessage = ({ msg, isNew }: { msg: Msg; isNew: boolean }) => {
  const meta = msg.metadata;
  const isPayment = meta?.kind === "payment" && typeof meta.amount === "number";

  if (!isPayment) {
    return (
      <motion.div
        initial={isNew ? { opacity: 0, y: 4 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex justify-center my-3"
      >
        <div className="text-[11px] px-3 py-1.5 rounded-full bg-muted text-muted-foreground max-w-[85%] text-center">
          {msg.content}
        </div>
      </motion.div>
    );
  }

  const name = meta!.contributor_name || "Someone";
  const amount = meta!.amount || 0;
  const pledge = meta!.pledge || 0;
  const paid = meta!.paid || 0;
  const balance = typeof meta!.balance === "number" ? meta!.balance : Math.max(0, pledge - paid);
  const currency = meta!.currency || "TZS";
  const pct = pledge > 0 ? Math.min(100, Math.round((paid / pledge) * 100)) : 0;
  const complete = pledge > 0 && balance <= 0;
  const fmt = (n: number) => `${currency} ${Math.round(n).toLocaleString()}`;
  const initials = name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();

  const dateLabel = toLocal(msg.created_at).toLocaleDateString([], { day: "2-digit", month: "short" });
  const timeLabel = formatTime(msg.created_at);

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col items-stretch my-5 w-full max-w-[88%] sm:max-w-[420px]"
    >
      {/* Stacked date/time meta — outside card, top-right */}
      <div className="flex justify-end items-baseline gap-1.5 mb-1 pr-1">
        <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
          {dateLabel}
        </span>
        <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/40" />
        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
          {timeLabel}
        </span>
      </div>

      <div
        className={`relative w-full rounded-2xl p-[1px] ${
          complete
            ? "bg-[linear-gradient(135deg,hsl(152_76%_45%/0.55),hsl(152_76%_45%/0.15))]"
            : "bg-[linear-gradient(135deg,hsl(152_70%_45%/0.35),hsl(152_70%_45%/0.08))]"
        } shadow-[0_8px_24px_-12px_hsl(152_70%_35%/0.35)]`}
      >
        <div className="relative rounded-[15px] bg-card overflow-hidden">
          {/* Soft top sheen */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-[radial-gradient(ellipse_at_top,hsl(152_70%_45%/0.10),transparent_70%)]" />
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div
              className={`relative w-10 h-10 rounded-full flex items-center justify-center font-bold text-[12px] shrink-0 ${
                complete
                  ? "bg-emerald-500 text-white"
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30"
              }`}
            >
              {complete ? "🏆" : initials}
              {complete && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-card flex items-center justify-center">
                  <span className="text-[8px] text-white font-bold leading-none">✓</span>
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] uppercase tracking-[0.12em] font-bold text-emerald-700 dark:text-emerald-400">
                  {complete ? "Pledge complete" : "New contribution"}
                </span>
                <span className="text-[15px] font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  +{fmt(amount)}
                </span>
              </div>
              <p className="text-[13px] font-semibold text-foreground truncate mt-0.5">
                {name}
              </p>

              {pledge > 0 ? (
                <div className="mt-2">
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full rounded-full bg-emerald-500"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-1">
                    <span className="text-muted-foreground tabular-nums">
                      {fmt(paid)} <span className="opacity-60">of</span> {fmt(pledge)}
                    </span>
                    <span className="font-bold text-foreground tabular-nums">{pct}%</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};


interface Props {
  groupId: string;
  members: Member[];
  meMemberId?: string | null;
  isAdmin?: boolean;
  isClosed?: boolean;
}

const initials = (n?: string | null) =>
  (n || "?").trim().split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();

// Server timestamps may be naive UTC — normalize before any Date math/format.
const ensureUtc = (input: string): string => {
  if (!input) return input;
  if (input.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(input)) return input;
  if (input.includes("T")) return `${input}Z`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(input)) return `${input.replace(" ", "T")}Z`;
  return input;
};
const toLocal = (iso: string) => new Date(ensureUtc(iso));

const formatTime = (iso: string) => formatLocalTime(iso);

const isSameDay = (a: string, b: string) => toLocal(a).toDateString() === toLocal(b).toDateString();
const dayLabel = (iso: string) => {
  const d = toLocal(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
};

// Module-level cache per groupId so toggling between Chat ↔ Contributors
// tabs (which unmounts the panel) does NOT show the skeleton again.
const chatCache: Record<string, { messages: Msg[]; cursor: string | null }> = {};

const ChatPanel = ({ groupId, meMemberId, isClosed }: Props) => {
  const { data: user } = useCurrentUser();
  const cached = chatCache[groupId];
  const [messages, setMessages] = useState<Msg[]>(cached?.messages || []);
  const [loading, setLoading] = useState(!cached);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string; caption: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCursorRef = useRef<string | null>(cached?.cursor || null);
  const stickToBottomRef = useRef(true);
  const seenIdsRef = useRef<Set<string>>(new Set(cached?.messages.map(m => m.id) || []));
  const [newCount, setNewCount] = useState(0);
  const [openReactionFor, setOpenReactionFor] = useState<string | null>(null);

  const isGuest = !user || (typeof window !== "undefined" && !!localStorage.getItem("eg_guest_token"));

  const scrollToBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    });
  };

  const loadInitial = async () => {
    // Only show skeleton on the very first load — silent refresh otherwise.
    if (!chatCache[groupId]) setLoading(true);
    const res = await eventGroupsApi.messages(groupId, { limit: 50 });
    if (res.success && res.data) {
      const list: Msg[] = res.data.messages || [];
      list.forEach(m => seenIdsRef.current.add(m.id));
      setMessages(list);
      lastCursorRef.current = list.length ? list[list.length - 1].created_at : null;
      chatCache[groupId] = { messages: list, cursor: lastCursorRef.current };
      setTimeout(() => scrollToBottom(false), 30);
    }
    setLoading(false);
    eventGroupsApi.markRead(groupId).catch(() => {});
  };

  const pollNew = async () => {
    if (!lastCursorRef.current) return;
    const res = await eventGroupsApi.messages(groupId, { after: lastCursorRef.current, limit: 50 });
    if (res.success && res.data) {
      const fresh: Msg[] = res.data.messages || [];
      if (fresh.length) {
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          // Drop any optimistic "tmp-*" bubble whose content matches an
          // incoming real message from this same sender — prevents the
          // duplicate that appears when the poll lands before send() resolves.
          const incomingKeys = new Set(
            fresh.map(f => `${f.sender_member_id || ""}::${(f.content || "").trim()}`)
          );
          const cleaned = prev.filter(m => {
            if (!m.id.startsWith("tmp-")) return true;
            const key = `${m.sender_member_id || ""}::${(m.content || "").trim()}`;
            return !incomingKeys.has(key);
          });
          const merged = [...cleaned, ...fresh.filter(f => !ids.has(f.id))];
          return merged;
        });
        lastCursorRef.current = fresh[fresh.length - 1].created_at;
        if (stickToBottomRef.current) {
          // User is at the bottom — animate the new bubbles in softly.
          setTimeout(() => scrollToBottom(true), 30);
          eventGroupsApi.markRead(groupId).catch(() => {});
        } else {
          // User scrolled up — surface a "new messages" pill and DO NOT
          // hijack their scroll position (WhatsApp behaviour).
          setNewCount(c => c + fresh.length);
        }
      }
    }
  };

  useEffect(() => { loadInitial(); /* eslint-disable-next-line */ }, [groupId]);
  usePolling(pollNew, 6000, !loading);

  // Keep the per-group cache in sync so a tab toggle re-mounts instantly
  // with the latest messages instead of flashing the skeleton.
  useEffect(() => {
    chatCache[groupId] = { messages, cursor: lastCursorRef.current };
  }, [messages, groupId]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickToBottomRef.current = atBottom;
    if (atBottom && newCount > 0) setNewCount(0);
  };

  const jumpToLatest = () => {
    setNewCount(0);
    stickToBottomRef.current = true;
    scrollToBottom(true);
    eventGroupsApi.markRead(groupId).catch(() => {});
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || isClosed) return;
    // Optimistic UI — clear input immediately and show pending bubble (WhatsApp-style).
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const replySnapshot = replyTo;
    const optimistic: Msg = {
      id: tempId,
      message_type: "text",
      content: text,
      sender_member_id: meMemberId || null,
      sender_name: "You",
      reply_to: replySnapshot ? { id: replySnapshot.id, content: replySnapshot.content || "", sender_name: replySnapshot.sender_name || "" } : null,
      reactions: [],
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setDraft(""); setReplyTo(null);
    stickToBottomRef.current = true;
    setTimeout(() => scrollToBottom(true), 30);
    setSending(true);
    const res = await eventGroupsApi.sendMessage(groupId, {
      content: text,
      reply_to_id: replySnapshot?.id,
    });
    if (res.success && res.data) {
      const real = res.data;
      // Replace temp bubble with the real message — and guard against the
      // case where the polling cursor already pulled the same message in
      // (would otherwise show a duplicate).
      setMessages(prev => {
        const hasReal = prev.some(m => m.id === real.id);
        if (hasReal) return prev.filter(m => m.id !== tempId);
        return prev.map(m => (m.id === tempId ? real : m));
      });
      lastCursorRef.current = real.created_at;
      seenIdsRef.current.add(real.id);
    } else {
      // Rollback on failure.
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setDraft(text);
      toast.error(res.message || "Failed to send");
    }
    setSending(false);
  };

  // Step 1 — picking a file just opens the WhatsApp-style caption preview.
  const handleImage = (file: File) => {
    if (isClosed) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Image must be smaller than 20MB");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPendingImage({ file, previewUrl, caption: "" });
  };

  // Step 2 — confirm: optimistically push the image bubble (with sending dots),
  // close the preview immediately, then upload + send in the background.
  const sendPendingImage = async () => {
    if (!pendingImage || uploading) return;
    const { file, caption, previewUrl } = pendingImage;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimistic: any = {
      id: tempId,
      message_type: "image",
      content: caption.trim() || null,
      image_url: previewUrl,
      sender_member_id: meMemberId || null,
      sender_name: "You",
      reactions: [],
      created_at: new Date().toISOString(),
      __sending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setPendingImage(null);
    stickToBottomRef.current = true;
    setTimeout(() => scrollToBottom(true), 30);
    setUploading(true);
    try {
      const upRes = await uploadsApi.upload(file);
      if (!upRes.success) throw new Error(upRes.message || "Upload failed");
      const url =
        (upRes.data as any)?.url ||
        (upRes.data as any)?.file_url ||
        (upRes.data as any)?.public_url;
      if (!url) throw new Error("Upload failed");
      const res = await eventGroupsApi.sendMessage(groupId, {
        image_url: url,
        content: caption.trim() || undefined,
      });
      if (res.success && res.data) {
        const real = res.data;
        setMessages(prev => {
          const hasReal = prev.some(m => m.id === real.id);
          if (hasReal) return prev.filter(m => m.id !== tempId);
          return prev.map(m => (m.id === tempId ? real : m));
        });
        lastCursorRef.current = real.created_at;
        seenIdsRef.current.add(real.id);
        URL.revokeObjectURL(previewUrl);
      } else {
        throw new Error(res.message || "Failed to send image");
      }
    } catch (e: any) {
      // Rollback the optimistic bubble on failure.
      setMessages(prev => prev.filter(m => m.id !== tempId));
      URL.revokeObjectURL(previewUrl);
      toast.error(e?.message || "Image upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const cancelPendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const react = async (msg: Msg, emoji: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msg.id) return m;
      const groups = Array.isArray(m.reactions) ? [...m.reactions] : [];
      const idx = groups.findIndex(g => g.emoji === emoji);
      if (idx >= 0) {
        const g = { ...groups[idx] };
        const wasMine = !!g.mine;
        g.mine = !wasMine;
        g.count = Math.max(0, g.count + (wasMine ? -1 : 1));
        if (g.count === 0) groups.splice(idx, 1); else groups[idx] = g;
      } else {
        groups.push({ emoji, count: 1, members: [], mine: true });
      }
      return { ...m, reactions: groups };
    }));
    const res = await eventGroupsApi.reactToMessage(groupId, msg.id, emoji);
    if (!res.success) {
      loadInitial();
      toast.error(res.message || "Failed to react");
    }
  };

  const remove = async (msg: Msg) => {
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_deleted: true, content: "(deleted)" } : m));
    await eventGroupsApi.deleteMessage(groupId, msg.id);
  };

  const grouped = useMemo(() => messages, [messages]);

  return (
    <div className="relative flex flex-col h-[calc(100vh-220px)] min-h-[480px] bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-1.5 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.04),transparent_60%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.25))]">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className={`flex ${i%2 ? "justify-start" : "justify-end"}`}>
                <div className="h-12 w-2/3 max-w-sm rounded-2xl bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <img src={ChatIcon} alt="" className="w-6 h-6 icon-adaptive" />
            </div>
            <p className="font-medium">No messages yet</p>
            <p className="text-xs">Say hi to your group 👋</p>
          </div>
        ) : (
          grouped.map((m, i) => {
            const prev = grouped[i - 1];
            const showDay = !prev || !isSameDay(prev.created_at, m.created_at);
            const mine = m.sender_member_id && m.sender_member_id === meMemberId;
            const isSystem = m.message_type === "system";
            // Only animate truly new bubbles — initial-load messages render
            // flat to avoid the WhatsApp-style "shift" flicker.
            const isNew = !seenIdsRef.current.has(m.id);
            if (isNew) seenIdsRef.current.add(m.id);
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="flex justify-center my-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-card/80 backdrop-blur border border-border/60 text-muted-foreground shadow-sm">
                      {dayLabel(m.created_at)}
                    </span>
                  </div>
                )}
                {isSystem ? (
                  <SystemMessage msg={m} isNew={isNew} />
                ) : (
                  <motion.div
                    initial={isNew ? { opacity: 0, y: 4 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className={`flex gap-2 ${mine ? "justify-end" : "justify-start"} group`}
                  >
                    {!mine && (
                      <Avatar className="w-8 h-8 mt-auto mb-0.5 shrink-0 ring-1 ring-border">
                        {m.sender_avatar_url && <AvatarImage src={m.sender_avatar_url} />}
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                          {initials(m.sender_name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`relative max-w-[78%] sm:max-w-[65%] ${mine ? "items-end" : "items-start"}`}>
                      {!mine && m.sender_name && (
                        <p className="text-[10px] text-muted-foreground mb-1 ml-2 font-semibold">{m.sender_name}</p>
                      )}
                      {m.image_url ? (
                        // Image messages: image floats on its own (no bubble bg).
                        // Caption (if any) renders as a small bubble below.
                        <div className="flex flex-col gap-1 items-stretch">
                          {m.reply_to && (
                            <div className={`text-[11px] px-2 py-1 rounded-md border-l-2 max-w-[260px] ${
                              mine ? "bg-primary/10 border-primary/60 self-end" : "bg-muted border-primary self-start"
                            }`}>
                              <p className="font-semibold opacity-80">{m.reply_to.sender_name}</p>
                              <p className="opacity-70 line-clamp-1">{m.reply_to.content}</p>
                            </div>
                          )}
                          <div className={`relative ${mine ? "self-end" : "self-start"}`}>
                            <img
                              src={m.image_url}
                              alt=""
                              className={`rounded-xl max-h-56 max-w-[240px] sm:max-w-[260px] w-auto h-auto object-contain ${(m as any).__sending ? "opacity-70" : ""}`}
                            />
                            {(m as any).__sending && (
                              <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                                <div className="flex items-center gap-1.5 bg-background/90 px-3 py-1.5 rounded-full shadow-md">
                                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                  <span className="text-[10px] font-semibold text-muted-foreground ml-1">Sending</span>
                                </div>
                              </div>
                            )}
                          </div>
                          {m.content && (
                            <div className={`rounded-2xl px-3 py-1.5 max-w-[260px] ${
                              mine
                                ? "bg-[hsl(var(--primary)/0.10)] border border-primary/15 self-end rounded-br-md"
                                : "bg-card border border-border/70 self-start rounded-bl-md"
                            }`}>
                              <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                            </div>
                          )}
                          <div className={`flex items-center gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                            <span className="text-[10px] text-muted-foreground">{formatTime(m.created_at)}</span>
                            {mine && !(m as any).__sending && <CheckCheck className="w-3 h-3 text-primary/70" />}
                          </div>
                        </div>
                      ) : (
                      <div
                        className={`relative rounded-2xl px-3.5 py-2 shadow-[0_1px_2px_hsl(var(--foreground)/0.06)] transition-shadow hover:shadow-md ${
                          mine
                            ? "bg-[hsl(var(--primary)/0.10)] text-foreground border border-primary/15 rounded-br-md"
                            : "bg-card border border-border/70 rounded-bl-md"
                        }`}
                      >
                        {m.reply_to && (
                          <div className={`text-[11px] mb-1 px-2 py-1 rounded-md border-l-2 ${
                            mine ? "bg-primary/10 border-primary/60" : "bg-muted border-primary"
                          }`}>
                            <p className="font-semibold opacity-80">{m.reply_to.sender_name}</p>
                            <p className="opacity-70 line-clamp-1">{m.reply_to.content}</p>
                          </div>
                        )}
                        {m.content && <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>}
                        <div className={`flex items-center gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                          <span className="text-[10px] text-muted-foreground">
                            {formatTime(m.created_at)}
                          </span>
                          {mine && <CheckCheck className="w-3 h-3 text-primary/70" />}
                        </div>

                        {/* Hover toolbar */}
                        {!isClosed && !m.is_deleted && (
                          <div className={`absolute -top-3 ${mine ? "left-2" : "right-2"} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-background border border-border rounded-full shadow-md px-1`}>
                            <Popover
                              open={openReactionFor === m.id}
                              onOpenChange={(o) => setOpenReactionFor(o ? m.id : null)}
                            >
                              <PopoverTrigger asChild>
                                <button className="p-1 hover:bg-muted rounded-full" title="React">
                                  <Smile className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-2" align={mine ? "start" : "end"}>
                                <div className="flex gap-1 mb-2">
                                  {QUICK_EMOJIS.map(e => (
                                    <button key={e} onClick={() => { react(m, e); setOpenReactionFor(null); }} className="text-xl hover:scale-125 transition-transform">{e}</button>
                                  ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1 max-w-[260px] border-t border-border pt-2">
                                  {FULL_EMOJIS.map(e => (
                                    <button key={e} onClick={() => { react(m, e); setOpenReactionFor(null); }} className="text-lg hover:bg-muted rounded p-1">{e}</button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                            <button className="p-1 hover:bg-muted rounded-full" title="Reply" onClick={() => setReplyTo(m)}>
                              <Reply className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            {mine && (
                              <button className="p-1 hover:bg-muted rounded-full" title="Delete" onClick={() => remove(m)}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      )}

                      {/* Reactions */}
                      {m.reactions && m.reactions.length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1.5 ${mine ? "justify-end" : "justify-start"}`}>
                          {m.reactions.map(r => (
                            <button
                              key={r.emoji}
                              onClick={() => react(m, r.emoji)}
                              className={`flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 border shadow-sm transition-all hover:scale-105 ${
                                r.mine ? "bg-primary/15 border-primary/50 text-primary" : "bg-card/90 backdrop-blur border-border"
                              }`}
                            >
                              <span>{r.emoji}</span>
                              <span className="font-bold">{r.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* WhatsApp-style "new messages" pill — only when scrolled up */}
      <AnimatePresence>
        {newCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={jumpToLatest}
            className="self-center -mt-10 mb-1 z-10 flex items-center gap-1.5 bg-primary text-primary-foreground rounded-full shadow-lg px-3 py-1.5 text-xs font-semibold hover:scale-105 transition-transform"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            {newCount} new message{newCount !== 1 ? "s" : ""}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Reply preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-border bg-muted/40 px-3 py-2 flex items-center gap-2">
            <div className="border-l-2 border-primary pl-2 flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-primary">Replying to {replyTo.sender_name}</p>
              <p className="text-xs text-muted-foreground truncate">{replyTo.content || "Image"}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-muted rounded">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer */}
      <div className="border-t border-border/70 bg-card/95 backdrop-blur p-2.5 sm:p-3">
        {isClosed ? (
          <div className="text-center text-xs text-muted-foreground py-2 flex items-center justify-center gap-2">
            <Lock className="w-3.5 h-3.5" /> This event has ended. Group is read-only.
          </div>
        ) : (
          <div className="flex items-end gap-2 bg-muted/40 rounded-2xl border border-border/60 px-1.5 py-1 focus-within:border-primary/40 focus-within:bg-card transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImage(f);
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-xl h-9 w-9 hover:bg-primary/10"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              title="Send image"
            >
              <img src={CustomImageIcon} alt="Attach image" className="w-5 h-5 icon-adaptive" />
            </Button>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={isGuest ? "Type as guest…" : "Write a message…"}
              className="resize-none min-h-[36px] max-h-32 flex-1 border-0 bg-transparent focus-visible:ring-0 shadow-none px-1 text-[14px]"
            />
            <Button
              onClick={send}
              disabled={!draft.trim() || sending}
              size="icon"
              className="shrink-0 rounded-xl h-9 w-9 bg-primary hover:bg-primary/90 disabled:opacity-40 transition-all"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Image caption preview (WhatsApp-style) */}
      <AnimatePresence>
        {pendingImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 bg-background/95 backdrop-blur-sm flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <button
                onClick={cancelPendingImage}
                disabled={uploading}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
              <p className="text-sm font-semibold">Send image</p>
              <div className="w-9" />
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4">
              <img
                src={pendingImage.previewUrl}
                alt="Preview"
                className="max-h-full max-w-full rounded-xl shadow-lg object-contain"
              />
            </div>
            <div className="border-t border-border bg-card/95 backdrop-blur p-3">
              <div className="flex items-end gap-2 bg-muted/40 rounded-2xl border border-border/60 px-2 py-1.5 focus-within:border-primary/40 focus-within:bg-card transition-colors">
                <Textarea
                  value={pendingImage.caption}
                  onChange={(e) =>
                    setPendingImage(p => (p ? { ...p, caption: e.target.value } : p))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendPendingImage();
                    }
                  }}
                  rows={1}
                  placeholder="Add a caption…"
                  disabled={uploading}
                  className="resize-none min-h-[36px] max-h-32 flex-1 border-0 bg-transparent focus-visible:ring-0 shadow-none px-1 text-[14px]"
                />
                <Button
                  onClick={sendPendingImage}
                  disabled={uploading}
                  size="icon"
                  className="shrink-0 rounded-xl h-9 w-9 bg-primary hover:bg-primary/90 disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatPanel;
