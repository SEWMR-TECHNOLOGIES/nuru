/**
 * useCurrency — single source of truth for the currency a user sees.
 *
 * Resolution order:
 *   1. Explicit `currency_code` on the authenticated user profile.
 *   2. Currency derived from the user's `country_code` (TZ→TZS, KE→KES).
 *   3. Currency derived from the current host (nuru.tz / nuru.ke).
 *   4. Browser timezone fallback.
 *   5. "TZS" as ultimate default so the UI never shows nothing.
 *
 * Side effect: the resolved currency is mirrored into localStorage so the
 * legacy `formatPrice()` helper (used in non-React utilities) stays in sync.
 */

import { useEffect, useMemo } from "react";
import { useCurrentUser } from "./useCurrentUser";
import {
  REGIONS,
  RegionCode,
  regionFromCountry,
  regionFromHost,
  regionFromTimezone,
} from "@/lib/region/config";
import {
  formatMoney,
  setActiveCurrency,
  type FormatMoneyOptions,
  type SupportedCurrency,
} from "@/utils/formatPrice";

// Country → currency mapping. INTL is the synthetic fallback used outside
// our two primary markets (TZ, KE) — defaults the hero/UI to USD.
const COUNTRY_TO_CURRENCY: Record<RegionCode, SupportedCurrency> = {
  TZ: "TZS",
  KE: "KES",
  INTL: "USD",
};

const detectFromTimezone = (): RegionCode | null => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return regionFromTimezone(tz)?.code ?? null;
  } catch {
    return null;
  }
};

export interface UseCurrencyResult {
  /** Active ISO currency code, e.g. "TZS" / "KES". */
  currency: SupportedCurrency;
  /** Active country code if known. */
  countryCode: RegionCode | null;
  /** True until the auth query has resolved (avoids "TZS flash" for KE users). */
  isResolving: boolean;
  /** True when the source was the user's saved profile (highest confidence). */
  isFromProfile: boolean;
  /** Convenient pre-bound formatter. */
  format: (
    amount: number | string | null | undefined,
    options?: Omit<FormatMoneyOptions, "currency">
  ) => string;
}

export const useCurrency = (): UseCurrencyResult => {
  const { data: user, isLoading } = useCurrentUser();

  const result = useMemo<UseCurrencyResult>(() => {
    // 1. Profile currency wins outright
    if (user?.currency_code) {
      const code = (user.country_code as RegionCode | undefined) ?? null;
      return {
        currency: user.currency_code,
        countryCode: code && code in REGIONS ? code : null,
        isResolving: false,
        isFromProfile: true,
        format: (amount, options) =>
          formatMoney(amount, { ...options, currency: user.currency_code! }),
      };
    }

    // 2. Profile country → derive currency
    if (user?.country_code) {
      const region = regionFromCountry(user.country_code);
      if (region) {
        const currency = COUNTRY_TO_CURRENCY[region.code];
        return {
          currency,
          countryCode: region.code,
          isResolving: false,
          isFromProfile: true,
          format: (amount, options) =>
            formatMoney(amount, { ...options, currency }),
        };
      }
    }

    // 3. Host (nuru.tz / nuru.ke)
    const fromHost =
      typeof window !== "undefined"
        ? regionFromHost(window.location.hostname)
        : null;

    // 4. Timezone fallback. If neither host nor timezone matches a primary
    //    region we resolve to "INTL" → USD (international visitor).
    const code = (fromHost?.code ?? detectFromTimezone() ?? "INTL") as RegionCode;
    const currency = COUNTRY_TO_CURRENCY[code];

    return {
      currency,
      // Only expose primary country codes externally; INTL is synthetic.
      countryCode: code === "INTL" ? null : code,
      isResolving: isLoading,
      isFromProfile: false,
      format: (amount, options) =>
        formatMoney(amount, { ...options, currency }),
    };
  }, [user?.currency_code, user?.country_code, isLoading]);

  // Mirror to localStorage for legacy formatPrice() callers.
  useEffect(() => {
    setActiveCurrency(result.currency);
  }, [result.currency]);

  return result;
};
