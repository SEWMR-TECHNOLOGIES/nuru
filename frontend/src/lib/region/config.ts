// Region configuration — add new countries here to scale.
// Keep this file pure data so it can be tree-shaken and unit-tested.

export type RegionCode = "TZ" | "KE" | "INTL";

/** Primary, user-selectable region codes (excludes the synthetic INTL fallback). */
export type PrimaryRegionCode = "TZ" | "KE";

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
  INTL: {
    code: "INTL",
    name: "International",
    brandName: "Nuru",
    host: "nuru.com",
    flag: "🌍",
    timezones: [],
  },
};

// Only TZ + KE are "primary" locales. INTL is a synthetic fallback used
// when neither host nor timezone resolves to a primary market.
export const SUPPORTED_REGIONS = [REGIONS.TZ, REGIONS.KE];

/** Map a hostname to a known primary region, if any. */
export function regionFromHost(hostname: string): RegionConfig | null {
  const h = hostname.toLowerCase();
  for (const r of SUPPORTED_REGIONS) {
    if (h === r.host || h.endsWith(`.${r.host}`)) return r;
  }
  return null;
}

/** Map an ISO country code to a known primary region, if any. */
export function regionFromCountry(code: string | null | undefined): RegionConfig | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  if (upper === "TZ") return REGIONS.TZ;
  if (upper === "KE") return REGIONS.KE;
  return null;
}

/** Map a timezone string to a known primary region, if any. */
export function regionFromTimezone(tz: string | null | undefined): RegionConfig | null {
  if (!tz) return null;
  for (const r of SUPPORTED_REGIONS) {
    if (r.timezones.includes(tz)) return r;
  }
  return null;
}
