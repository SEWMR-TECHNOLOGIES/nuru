/**
 * useMigrationStatus — central hook driving the legacy-user upgrade flow.
 *
 * Reads `/users/me/migration-status` (cached, 5-min stale time) and combines
 * it with locally-tracked dismiss timestamps to compute one of three phases:
 *
 *   • "soft"     — first 0-3 days. A welcome modal CAN be shown once per session
 *                  and dismissable. Banners appear on monetized pages.
 *   • "nudge"    — days 4-13. Banners get firmer wording. Modal returns weekly.
 *   • "restrict" — day 14+. Money-OUT actions and NEW paid creation are blocked
 *                  via <MigrationGate />. Existing live items keep selling.
 *
 * The 14-day clock starts from `legacy_since` when supplied by the backend,
 * or from the first time the frontend saw the migration prompt for this user
 * (stored in localStorage as a fallback).
 */
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { migrationApi, type MigrationStatus } from "@/lib/api/migration";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export type MigrationPhase = "soft" | "nudge" | "restrict";

const FIRST_SEEN_KEY = "nuru:migration-first-seen";
const MODAL_DISMISS_KEY = "nuru:migration-modal-dismissed";
const SOFT_DAYS = 4;
const RESTRICT_DAYS = 14;

const dayMs = 1000 * 60 * 60 * 24;

const safeRead = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const safeWrite = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* quota */ }
};

const getFirstSeen = (userId: string): number => {
  const k = `${FIRST_SEEN_KEY}:${userId}`;
  const existing = safeRead(k);
  if (existing) {
    const parsed = parseInt(existing, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const now = Date.now();
  safeWrite(k, String(now));
  return now;
};

const computePhase = (status: MigrationStatus, userId: string): MigrationPhase => {
  if (!status.needs_setup) return "soft";
  const referenceMs = status.legacy_since
    ? Date.parse(status.legacy_since) || getFirstSeen(userId)
    : getFirstSeen(userId);
  const ageDays = (Date.now() - referenceMs) / dayMs;
  if (ageDays >= RESTRICT_DAYS) return "restrict";
  if (ageDays >= SOFT_DAYS) return "nudge";
  return "soft";
};

export interface UseMigrationStatusResult {
  /** Raw backend payload, or null while loading / not applicable. */
  status: MigrationStatus | null;
  /** Whether the user must complete payment setup. */
  needsSetup: boolean;
  /** Soft → Nudge → Restrict, computed from legacy_since + local first-seen. */
  phase: MigrationPhase;
  /** True when the welcome modal should auto-open this session. */
  shouldShowWelcome: boolean;
  /** Mark the welcome modal dismissed (resurfaces in 7 days during nudge phase). */
  dismissWelcome: () => void;
  /** True when a money-OUT or new-paid-creation action should be blocked. */
  isRestricted: boolean;
  isLoading: boolean;
}

export function useMigrationStatus(): UseMigrationStatusResult {
  const { data: user, userIsLoggedIn } = useCurrentUser();

  const query = useQuery({
    queryKey: ["migrationStatus", user?.id],
    queryFn: async () => {
      const res = await migrationApi.status();
      return (res.success ? res.data : null) as MigrationStatus | null;
    },
    enabled: !!userIsLoggedIn && !!user?.id,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const status = query.data ?? null;
  const phase = useMemo<MigrationPhase>(() => {
    if (!status || !user?.id) return "soft";
    return computePhase(status, user.id);
  }, [status, user?.id]);

  const needsSetup = !!status?.needs_setup;
  const isRestricted = needsSetup && phase === "restrict";

  // Welcome modal: show only AFTER the user has chosen a country (so the
  // CountryConfirmModal isn't covered by this one) AND payment setup is needed
  // AND not dismissed within the cool-down window.
  const shouldShowWelcome = useMemo(() => {
    if (!needsSetup || !user?.id) return false;
    // Wait until country is set — CountryConfirmModal has priority on first login.
    if (!user.country_code) return false;
    const dismissedAt = safeRead(`${MODAL_DISMISS_KEY}:${user.id}`);
    if (!dismissedAt) return true;
    const ts = parseInt(dismissedAt, 10);
    if (Number.isNaN(ts)) return true;
    const ageDays = (Date.now() - ts) / dayMs;
    // Reappear weekly during the "nudge" phase, daily during "restrict".
    if (phase === "restrict") return ageDays >= 1;
    if (phase === "nudge") return ageDays >= 7;
    return false; // "soft" — only once per device
  }, [needsSetup, user?.id, user?.country_code, phase]);

  const dismissWelcome = () => {
    if (!user?.id) return;
    safeWrite(`${MODAL_DISMISS_KEY}:${user.id}`, String(Date.now()));
  };

  // Seed first-seen on mount so the 14-day clock starts even if backend
  // doesn't provide legacy_since.
  useEffect(() => {
    if (needsSetup && user?.id) getFirstSeen(user.id);
  }, [needsSetup, user?.id]);

  return {
    status,
    needsSetup,
    phase,
    shouldShowWelcome,
    dismissWelcome,
    isRestricted,
    isLoading: query.isLoading,
  };
}
