/**
 * Country detection from a phone number's E.164 prefix.
 * Currently mapped to Nuru's two live regions.
 */
import type { RegionCode } from "./config";

const PREFIX_MAP: Array<{ prefix: string; code: RegionCode }> = [
  { prefix: "+255", code: "TZ" },
  { prefix: "255", code: "TZ" },
  { prefix: "+254", code: "KE" },
  { prefix: "254", code: "KE" },
];

/**
 * Returns the region code if the phone number starts with a known prefix,
 * otherwise null. Whitespace and non-digit characters are ignored.
 */
export function regionFromPhone(phone?: string | null): RegionCode | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-()]/g, "");
  for (const { prefix, code } of PREFIX_MAP) {
    if (cleaned.startsWith(prefix)) return code;
  }
  return null;
}
