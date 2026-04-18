import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Hourglass, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

interface RateLimitDetail {
  retryAfter?: number; // seconds
  message?: string;
  context?: "auth" | "general";
}

function formatTime(s: number) {
  if (s <= 0) return "0s";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, "0")}s`;
  return `${sec}s`;
}

export default function RateLimitModal() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<RateLimitDetail>({});
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<RateLimitDetail>;
      const d = ce.detail || {};
      const retry = Math.max(1, Math.min(d.retryAfter ?? 60, 600));
      setDetail(d);
      setRemaining(retry);
      setOpen(true);
    };
    window.addEventListener("api:rate-limited", handler);
    return () => window.removeEventListener("api:rate-limited", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [open]);

  const isAuth = detail.context === "auth";
  const title = isAuth ? "Hold on a moment" : "You're going a bit fast";
  const body =
    detail.message ||
    (isAuth
      ? "You're making sign-in attempts too quickly. We've temporarily limited access to protect your account."
      : "You're making requests too quickly. We've temporarily limited access to protect your data.");

  const canRetry = remaining === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && canRetry && setOpen(false)}>
      <DialogContent
        className="max-w-sm p-0 overflow-hidden border-border"
        onInteractOutside={(e) => !canRetry && e.preventDefault()}
        onEscapeKeyDown={(e) => !canRetry && e.preventDefault()}
      >
        <div className="p-7 flex flex-col items-center text-center gap-5">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
          >
            {isAuth ? (
              <ShieldAlert className="w-8 h-8 text-primary" />
            ) : (
              <Hourglass className="w-8 h-8 text-primary" />
            )}
          </motion.div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
          </div>

          <div className="w-full rounded-xl bg-muted/50 border border-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{canRetry ? "You can try again now" : "Try again in"}</span>
            </div>
            <span className="font-mono font-bold text-sm text-foreground tabular-nums">
              {canRetry ? "—" : formatTime(remaining)}
            </span>
          </div>

          <Button
            className="w-full"
            disabled={!canRetry}
            onClick={() => setOpen(false)}
          >
            {canRetry ? "Continue" : `Please wait…`}
          </Button>

          <p className="text-[11px] text-muted-foreground">
            This protects everyone on Nuru from abuse. Thanks for your patience.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Helper to dispatch a rate-limit event from anywhere in the app.
 */
export function emitRateLimited(detail: RateLimitDetail) {
  window.dispatchEvent(new CustomEvent("api:rate-limited", { detail }));
}
