/**
 * Mobile money phone-number validation for the supported markets (TZ, KE).
 *
 * Accepted formats:
 *   - International:  +255712345678  /  +254712345678
 *   - Local with 0:   0712345678
 *   - Bare 9-digit:   712345678
 *
 * Returns a normalized E.164 string when valid, plus a friendly message when
 * invalid. The messages are user-facing — no jargon.
 */
export interface PhoneCheck {
  ok: boolean;
  message: string;
  /** E.164 normalized phone (only when ok=true). */
  e164?: string;
}

const RULES: Record<string, { cc: string; localPrefixes: string[]; example: string }> = {
  TZ: { cc: "255", localPrefixes: ["6", "7"], example: "0712 345 678" },
  KE: { cc: "254", localPrefixes: ["1", "7"], example: "0712 345 678" },
};

export function validateMobileMoneyPhone(raw: string, country?: string | null): PhoneCheck {
  const phone = (raw || "").replace(/[\s\-()]/g, "");
  if (!phone) return { ok: false, message: "Mobile number is required" };

  const cc = (country || "").toUpperCase();
  const rule = RULES[cc];
  if (!rule) {
    // Unknown country — just require an E.164-ish shape.
    return /^\+?\d{9,15}$/.test(phone)
      ? { ok: true, message: "", e164: phone.startsWith("+") ? phone : `+${phone}` }
      : { ok: false, message: "Enter a valid mobile number." };
  }

  // Strip a leading + or 00 if present.
  let digits = phone.replace(/^\+/, "").replace(/^00/, "");

  if (digits.startsWith(rule.cc)) {
    // Already includes country code.
    digits = digits.slice(rule.cc.length);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (!/^\d{9}$/.test(digits)) {
    return {
      ok: false,
      message: `Enter a valid ${cc} mobile number (e.g. ${rule.example}).`,
    };
  }

  if (!rule.localPrefixes.some((p) => digits.startsWith(p))) {
    return {
      ok: false,
      message: `That doesn't look like a ${cc} mobile number. Try one starting with ${rule.localPrefixes.map((p) => `0${p}`).join(" or ")}.`,
    };
  }

  return { ok: true, message: "", e164: `+${rule.cc}${digits}` };
}
