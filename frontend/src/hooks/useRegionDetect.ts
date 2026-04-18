import { useEffect, useState } from "react";
import {
  REGIONS,
  RegionConfig,
  regionFromCountry,
  regionFromHost,
  regionFromTimezone,
} from "@/lib/region/config";

const DISMISS_KEY = "nuru:region-switch-dismissed";
const CACHE_KEY = "nuru:detected-country";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

interface CachedCountry {
  code: string;
  ts: number;
}

interface DismissRecord {
  /** Region the user dismissed the prompt FOR (i.e. the region we suggested) */
  suggested: string;
  /** Region they were ON when they dismissed (current host region) */
  on: string;
  ts: number;
}

export interface RegionDetectResult {
  /** Region of the domain currently being viewed (e.g. nuru.ke → KE) */
  currentRegion: RegionConfig | null;
  /** Region the user appears to be physically in */
  detectedRegion: RegionConfig | null;
  /** True when detected differs from current AND user hasn't dismissed it */
  shouldSuggest: boolean;
  /** Loading flag while detection is in flight */
  isLoading: boolean;
  /** Mark the suggestion as dismissed so it stops appearing */
  dismiss: () => void;
  /** Build the equivalent URL on the suggested region's host, preserving path */
  buildSwitchUrl: (target: RegionConfig) => string;
}

/**
 * Pure client-side country detection via Intl timezone.
 * No network calls, no API keys, no quotas — instant and private.
 */
function detectCountryFromBrowser(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const r = regionFromTimezone(tz);
    if (r) return r.code;
  } catch {
    /* ignore */
  }
  return null;
}


function readCache(): string | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedCountry = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.code;
  } catch {
    return null;
  }
}

function writeCache(code: string) {
  try {
    const payload: CachedCountry = { code, ts: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota errors */
  }
}

function readDismiss(): DismissRecord | null {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? (JSON.parse(raw) as DismissRecord) : null;
  } catch {
    return null;
  }
}

export function useRegionDetect(): RegionDetectResult {
  const currentRegion =
    typeof window !== "undefined" ? regionFromHost(window.location.hostname) : null;

  const [detectedRegion, setDetectedRegion] = useState<RegionConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dismissedAt, setDismissedAt] = useState<DismissRecord | null>(() => readDismiss());

  useEffect(() => {
    let cancelled = false;

    // Synchronous detection — no network, no awaits.
    // 1. Cached country from a previous visit (still useful to remember manual overrides later)
    const cached = readCache();
    let code = cached ?? detectCountryFromBrowser();

    if (!cancelled) {
      if (code) writeCache(code);
      setDetectedRegion(regionFromCountry(code));
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    if (!detectedRegion) return;
    const record: DismissRecord = {
      suggested: detectedRegion.code,
      on: currentRegion?.code ?? "unknown",
      ts: Date.now(),
    };
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(record));
    } catch {
      /* ignore */
    }
    setDismissedAt(record);
  };

  const buildSwitchUrl = (target: RegionConfig) => {
    if (typeof window === "undefined") return `https://${target.host}`;
    const { pathname, search, hash } = window.location;
    return `https://${target.host}${pathname}${search}${hash}`;
  };

  // Only suggest when we have a known current region, a different detected region,
  // and the user has not previously dismissed this exact suggestion pair.
  const isDifferent =
    !!currentRegion && !!detectedRegion && currentRegion.code !== detectedRegion.code;

  const wasDismissedForThisPair =
    dismissedAt &&
    detectedRegion &&
    currentRegion &&
    dismissedAt.suggested === detectedRegion.code &&
    dismissedAt.on === currentRegion.code;

  const shouldSuggest = !isLoading && isDifferent && !wasDismissedForThisPair;

  return {
    currentRegion,
    detectedRegion,
    shouldSuggest,
    isLoading,
    dismiss,
    buildSwitchUrl,
  };
}

// Re-export for convenience
export { REGIONS };
