// Region configuration — add new countries here to scale.
// Keep this file pure data so it can be tree-shaken and unit-tested.

export type RegionCode = "TZ" | "KE";

export interface RegionConfig {
  code: RegionCode;
  /** Display name shown in UI */
  name: string;
  /** Short brand label e.g. "Nuru Tanzania" */
  brandName: string;
  /** Bare hostname (no protocol, no path) */
  host: string;
  /** Emoji flag for lightweight visual */
  flag: string;
  /** IANA timezone hints used as a last-resort detection fallback */
  timezones: string[];
}

export const REGIONS: Record<RegionCode, RegionConfig> = {
  TZ: {
    code: "TZ",
    name: "Tanzania",
    brandName: "Nuru Tanzania",
    host: "nuru.tz",
    flag: "🇹🇿",
    timezones: ["Africa/Dar_es_Salaam"],
  },
  KE: {
    code: "KE",
    name: "Kenya",
    brandName: "Nuru Kenya",
    host: "nuru.ke",
    flag: "🇰🇪",
    timezones: ["Africa/Nairobi"],
  },
};

export const SUPPORTED_REGIONS = Object.values(REGIONS);

/** Map a hostname to a known region, if any. */
export function regionFromHost(hostname: string): RegionConfig | null {
  const h = hostname.toLowerCase();
  for (const r of SUPPORTED_REGIONS) {
    if (h === r.host || h.endsWith(`.${r.host}`)) return r;
  }
  return null;
}

/** Map an ISO country code to a known region, if any. */
export function regionFromCountry(code: string | null | undefined): RegionConfig | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  return (REGIONS as Record<string, RegionConfig>)[upper] ?? null;
}

/** Map a timezone string to a known region, if any. */
export function regionFromTimezone(tz: string | null | undefined): RegionConfig | null {
  if (!tz) return null;
  for (const r of SUPPORTED_REGIONS) {
    if (r.timezones.includes(tz)) return r;
  }
  return null;
}
