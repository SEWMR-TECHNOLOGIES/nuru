/**
 * Shared utilities for Admin Payments Ops pages.
 * Tone helpers, money formatting, and common badge/card primitives.
 */
import { cn } from "@/lib/utils";

export const fmtMoney = (n: number | null | undefined, currency = "TZS") => {
  if (n == null) return "—";
  return `${currency} ${Number(n).toLocaleString()}`;
};

export const fmtNumber = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString();

export const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return iso; }
};

export const statusTone = (s: string | null | undefined) => {
  switch ((s ?? "").toLowerCase()) {
    case "succeeded":
    case "settled":
    case "paid":
      return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
    case "processing":
    case "pending":
    case "under_review":
      return "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/20";
    case "approved":
      return "bg-blue-500/12 text-blue-700 dark:text-blue-400 border-blue-500/20";
    case "failed":
    case "cancelled":
    case "rejected":
      return "bg-red-500/12 text-red-700 dark:text-red-400 border-red-500/20";
    case "refunded":
    case "reversed":
      return "bg-purple-500/12 text-purple-700 dark:text-purple-400 border-purple-500/20";
    case "hold":
    case "escalated":
      return "bg-orange-500/12 text-orange-700 dark:text-orange-400 border-orange-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

export const priorityTone = (p: string | null | undefined) => {
  switch (p) {
    case "high": return "bg-red-500/15 text-red-700 dark:text-red-400";
    case "medium": return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    default: return "bg-muted text-muted-foreground";
  }
};

export const StatusBadge = ({ status }: { status: string | null | undefined }) => (
  <span className={cn(
    "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border",
    statusTone(status)
  )}>
    {status ?? "—"}
  </span>
);

/** Pretty-print payment "reason" — derived from target_type + target_name. */
export const describeReason = (
  targetType?: string | null,
  targetName?: string | null,
  description?: string | null,
) => {
  if (description && description.trim()) return description.trim();
  if (!targetType) return "—";
  const human = targetType.replace(/_/g, " ");
  return targetName ? `${human}: ${targetName}` : human;
};
