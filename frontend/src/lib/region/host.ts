// Resolve the user-facing Nuru host (`nuru.tz`, `nuru.ke`, …) for the
// current request. We prefer the actual hostname (so `nuru.ke` stays `nuru.ke`),
// and fall back to TZ when running on preview/lovable/localhost domains.

import { regionFromHost, REGIONS, type RegionConfig } from "./config";

/** Return the best RegionConfig for the current browser. Defaults to TZ. */
export function getActiveRegion(): RegionConfig {
  if (typeof window === "undefined") return REGIONS.TZ;
  return regionFromHost(window.location.hostname) ?? REGIONS.TZ;
}

/** Bare host like `nuru.tz` — used in receipt footers, share links, SMS copy. */
export function getActiveHost(): string {
  return getActiveRegion().host;
}
