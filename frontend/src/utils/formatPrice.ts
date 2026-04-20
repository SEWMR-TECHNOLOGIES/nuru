/**
 * Currency-aware money formatter.
 *
 * Phase 3 refactor: removes the hardcoded "TZS " prefix. The currency code is
 * now resolved per-call (or per-user via the `useCurrency` hook). When no
 * currency is provided we fall back to the user's default region currency
 * read from localStorage, then to "TZS" as the absolute last resort so legacy
 * call sites never crash.
 *
 * Always render through `formatMoney` (or the `useCurrency().format` wrapper)
 * so that switching a user from TZS → KES updates every screen automatically.
 */

const FALLBACK_CURRENCY = "TZS";
const CURRENCY_STORAGE_KEY = "nuru:active-currency";

export type SupportedCurrency = "TZS" | "KES" | string;

export interface FormatMoneyOptions {
  currency?: SupportedCurrency;
  /** When true, no currency code is prefixed — useful inside currency-labelled inputs. */
  bare?: boolean;
  /** Override decimal precision. Defaults to 0 (whole units). */
  fractionDigits?: number;
}

const readActiveCurrency = (): string => {
  try {
    return localStorage.getItem(CURRENCY_STORAGE_KEY) || FALLBACK_CURRENCY;
  } catch {
    return FALLBACK_CURRENCY;
  }
};

/**
 * Persist the active currency so non-React code paths (legacy `formatPrice`
 * calls) can keep rendering correctly until they're migrated to `useCurrency`.
 */
export const setActiveCurrency = (currency: string | null | undefined): void => {
  try {
    if (currency) localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    else localStorage.removeItem(CURRENCY_STORAGE_KEY);
  } catch {
    /* ignore quota errors */
  }
};

export const getActiveCurrency = (): string => readActiveCurrency();

const toNumber = (amount: number | string | null | undefined): number => {
  if (amount === null || amount === undefined || amount === "") return 0;
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return Number.isFinite(n) ? n : 0;
};

/**
 * Format a money amount with the active or explicit currency code.
 * Example: formatMoney(12500, { currency: "KES" }) → "KES 12,500"
 */
export const formatMoney = (
  amount: number | string | null | undefined,
  options: FormatMoneyOptions = {}
): string => {
  const value = toNumber(amount);
  const fractionDigits = options.fractionDigits ?? 0;
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  if (options.bare) return formatted;
  const currency = options.currency || readActiveCurrency();
  return `${currency} ${formatted}`;
};

// Legacy `formatPrice` export removed — use `useCurrency().format` (or
// `formatMoney` for non-React utilities) so the active currency always wins.
