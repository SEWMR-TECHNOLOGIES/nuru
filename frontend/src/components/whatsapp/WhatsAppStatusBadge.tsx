import { cn } from "@/lib/utils";
import type { WhatsAppAvailabilityStatus } from "@/lib/api/contributors";

interface Props {
  status?: WhatsAppAvailabilityStatus | null;
  className?: string;
  /** When true, render only the dot + screen-reader text (for dense lists). */
  compact?: boolean;
}

const LABELS: Record<WhatsAppAvailabilityStatus, string> = {
  whatsapp: "WhatsApp",
  not_whatsapp: "Not on WhatsApp",
  unknown: "Unknown",
  checking: "Checking…",
  failed: "Unknown",
  invalid: "Invalid number",
};

// Subtle, theme-aware tones. We deliberately avoid loud colors so the badge
// never overpowers the contributor row.
const TONES: Record<WhatsAppAvailabilityStatus, string> = {
  whatsapp:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  not_whatsapp:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  unknown:
    "bg-muted text-muted-foreground border-border",
  checking:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
  failed:
    "bg-muted text-muted-foreground border-border",
  invalid:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
};

const DOTS: Record<WhatsAppAvailabilityStatus, string> = {
  whatsapp: "bg-emerald-500",
  not_whatsapp: "bg-rose-500",
  unknown: "bg-muted-foreground/50",
  checking: "bg-sky-500 animate-pulse",
  failed: "bg-muted-foreground/50",
  invalid: "bg-amber-500",
};

export function WhatsAppStatusBadge({ status, className, compact }: Props) {
  const s: WhatsAppAvailabilityStatus = status || "unknown";
  if (compact) {
    return (
      <span
        title={LABELS[s]}
        aria-label={`WhatsApp status: ${LABELS[s]}`}
        className={cn("inline-block h-2 w-2 rounded-full", DOTS[s], className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none",
        TONES[s],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[s])} />
      {LABELS[s]}
    </span>
  );
}

export default WhatsAppStatusBadge;
