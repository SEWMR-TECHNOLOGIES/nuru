import { cn } from "@/lib/utils";
import type { WhatsAppAvailabilityStatus } from "@/lib/api/contributors";

interface Props {
  status?: WhatsAppAvailabilityStatus | null;
  className?: string;
  /** When true, render only the dot + screen-reader text (for dense lists). */
  compact?: boolean;
  /**
   * Render the badge for "unknown"/"error" states. Default false — for numbers
   * Nuru has never successfully messaged we prefer to show nothing rather than
   * a noisy "Unknown" pill on every contributor row. Set true for legends or
   * admin views where the neutral state must still be visible.
   */
  showUnknown?: boolean;
}

// Normalize legacy + new vocabulary into a single set of UI states.
type UiState = "available" | "unavailable" | "checking" | "invalid" | "unknown";

function toUiState(s?: WhatsAppAvailabilityStatus | null): UiState {
  switch (s) {
    case "available":
    case "whatsapp":
      return "available";
    case "unavailable":
    case "not_whatsapp":
      return "unavailable";
    case "checking":
      return "checking";
    case "invalid":
      return "invalid";
    default:
      // unknown, error, failed, null, undefined → neutral
      return "unknown";
  }
}

const LABELS: Record<UiState, string> = {
  available: "WhatsApp",
  unavailable: "Not on WhatsApp",
  checking: "Checking…",
  invalid: "Invalid number",
  unknown: "Unknown",
};

const TONES: Record<UiState, string> = {
  available:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  unavailable:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  checking:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
  invalid:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  unknown: "bg-muted text-muted-foreground border-border",
};

const DOTS: Record<UiState, string> = {
  available: "bg-emerald-500",
  unavailable: "bg-rose-500",
  checking: "bg-sky-500 animate-pulse",
  invalid: "bg-amber-500",
  unknown: "bg-muted-foreground/50",
};

export function WhatsAppStatusBadge({ status, className, compact, showUnknown }: Props) {
  const s = toUiState(status);
  // Policy: numbers Nuru hasn't successfully messaged yet show nothing.
  if (s === "unknown" && !showUnknown) return null;

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
