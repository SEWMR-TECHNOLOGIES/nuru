import * as React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, X } from "lucide-react";

// ── Country data (ISO 3166-1, sorted by name) ─────────────────────────────
export interface CountryData {
  code: string;   // ISO 3166-1 alpha-2
  name: string;
  dialCode: string;
  flag: string;    // emoji flag
}

export const COUNTRIES: CountryData[] = [
  { code: "AF", name: "Afghanistan", dialCode: "+93", flag: "🇦🇫" },
  { code: "AL", name: "Albania", dialCode: "+355", flag: "🇦🇱" },
  { code: "DZ", name: "Algeria", dialCode: "+213", flag: "🇩🇿" },
  { code: "AO", name: "Angola", dialCode: "+244", flag: "🇦🇴" },
  { code: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "AT", name: "Austria", dialCode: "+43", flag: "🇦🇹" },
  { code: "BH", name: "Bahrain", dialCode: "+973", flag: "🇧🇭" },
  { code: "BD", name: "Bangladesh", dialCode: "+880", flag: "🇧🇩" },
  { code: "BE", name: "Belgium", dialCode: "+32", flag: "🇧🇪" },
  { code: "BJ", name: "Benin", dialCode: "+229", flag: "🇧🇯" },
  { code: "BW", name: "Botswana", dialCode: "+267", flag: "🇧🇼" },
  { code: "BR", name: "Brazil", dialCode: "+55", flag: "🇧🇷" },
  { code: "BF", name: "Burkina Faso", dialCode: "+226", flag: "🇧🇫" },
  { code: "BI", name: "Burundi", dialCode: "+257", flag: "🇧🇮" },
  { code: "KH", name: "Cambodia", dialCode: "+855", flag: "🇰🇭" },
  { code: "CM", name: "Cameroon", dialCode: "+237", flag: "🇨🇲" },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { code: "CF", name: "Central African Republic", dialCode: "+236", flag: "🇨🇫" },
  { code: "TD", name: "Chad", dialCode: "+235", flag: "🇹🇩" },
  { code: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱" },
  { code: "CN", name: "China", dialCode: "+86", flag: "🇨🇳" },
  { code: "CO", name: "Colombia", dialCode: "+57", flag: "🇨🇴" },
  { code: "KM", name: "Comoros", dialCode: "+269", flag: "🇰🇲" },
  { code: "CG", name: "Congo", dialCode: "+242", flag: "🇨🇬" },
  { code: "CD", name: "Congo (DRC)", dialCode: "+243", flag: "🇨🇩" },
  { code: "CR", name: "Costa Rica", dialCode: "+506", flag: "🇨🇷" },
  { code: "CI", name: "Côte d'Ivoire", dialCode: "+225", flag: "🇨🇮" },
  { code: "HR", name: "Croatia", dialCode: "+385", flag: "🇭🇷" },
  { code: "CU", name: "Cuba", dialCode: "+53", flag: "🇨🇺" },
  { code: "CZ", name: "Czech Republic", dialCode: "+420", flag: "🇨🇿" },
  { code: "DK", name: "Denmark", dialCode: "+45", flag: "🇩🇰" },
  { code: "DJ", name: "Djibouti", dialCode: "+253", flag: "🇩🇯" },
  { code: "EG", name: "Egypt", dialCode: "+20", flag: "🇪🇬" },
  { code: "GQ", name: "Equatorial Guinea", dialCode: "+240", flag: "🇬🇶" },
  { code: "ER", name: "Eritrea", dialCode: "+291", flag: "🇪🇷" },
  { code: "ET", name: "Ethiopia", dialCode: "+251", flag: "🇪🇹" },
  { code: "FI", name: "Finland", dialCode: "+358", flag: "🇫🇮" },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { code: "GA", name: "Gabon", dialCode: "+241", flag: "🇬🇦" },
  { code: "GM", name: "Gambia", dialCode: "+220", flag: "🇬🇲" },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { code: "GH", name: "Ghana", dialCode: "+233", flag: "🇬🇭" },
  { code: "GR", name: "Greece", dialCode: "+30", flag: "🇬🇷" },
  { code: "GN", name: "Guinea", dialCode: "+224", flag: "🇬🇳" },
  { code: "HT", name: "Haiti", dialCode: "+509", flag: "🇭🇹" },
  { code: "HN", name: "Honduras", dialCode: "+504", flag: "🇭🇳" },
  { code: "HK", name: "Hong Kong", dialCode: "+852", flag: "🇭🇰" },
  { code: "HU", name: "Hungary", dialCode: "+36", flag: "🇭🇺" },
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { code: "ID", name: "Indonesia", dialCode: "+62", flag: "🇮🇩" },
  { code: "IR", name: "Iran", dialCode: "+98", flag: "🇮🇷" },
  { code: "IQ", name: "Iraq", dialCode: "+964", flag: "🇮🇶" },
  { code: "IE", name: "Ireland", dialCode: "+353", flag: "🇮🇪" },
  { code: "IL", name: "Israel", dialCode: "+972", flag: "🇮🇱" },
  { code: "IT", name: "Italy", dialCode: "+39", flag: "🇮🇹" },
  { code: "JM", name: "Jamaica", dialCode: "+1876", flag: "🇯🇲" },
  { code: "JP", name: "Japan", dialCode: "+81", flag: "🇯🇵" },
  { code: "JO", name: "Jordan", dialCode: "+962", flag: "🇯🇴" },
  { code: "KZ", name: "Kazakhstan", dialCode: "+7", flag: "🇰🇿" },
  { code: "KE", name: "Kenya", dialCode: "+254", flag: "🇰🇪" },
  { code: "KW", name: "Kuwait", dialCode: "+965", flag: "🇰🇼" },
  { code: "LB", name: "Lebanon", dialCode: "+961", flag: "🇱🇧" },
  { code: "LS", name: "Lesotho", dialCode: "+266", flag: "🇱🇸" },
  { code: "LR", name: "Liberia", dialCode: "+231", flag: "🇱🇷" },
  { code: "LY", name: "Libya", dialCode: "+218", flag: "🇱🇾" },
  { code: "MG", name: "Madagascar", dialCode: "+261", flag: "🇲🇬" },
  { code: "MW", name: "Malawi", dialCode: "+265", flag: "🇲🇼" },
  { code: "MY", name: "Malaysia", dialCode: "+60", flag: "🇲🇾" },
  { code: "ML", name: "Mali", dialCode: "+223", flag: "🇲🇱" },
  { code: "MX", name: "Mexico", dialCode: "+52", flag: "🇲🇽" },
  { code: "MA", name: "Morocco", dialCode: "+212", flag: "🇲🇦" },
  { code: "MZ", name: "Mozambique", dialCode: "+258", flag: "🇲🇿" },
  { code: "MM", name: "Myanmar", dialCode: "+95", flag: "🇲🇲" },
  { code: "NA", name: "Namibia", dialCode: "+264", flag: "🇳🇦" },
  { code: "NP", name: "Nepal", dialCode: "+977", flag: "🇳🇵" },
  { code: "NL", name: "Netherlands", dialCode: "+31", flag: "🇳🇱" },
  { code: "NZ", name: "New Zealand", dialCode: "+64", flag: "🇳🇿" },
  { code: "NE", name: "Niger", dialCode: "+227", flag: "🇳🇪" },
  { code: "NG", name: "Nigeria", dialCode: "+234", flag: "🇳🇬" },
  { code: "NO", name: "Norway", dialCode: "+47", flag: "🇳🇴" },
  { code: "OM", name: "Oman", dialCode: "+968", flag: "🇴🇲" },
  { code: "PK", name: "Pakistan", dialCode: "+92", flag: "🇵🇰" },
  { code: "PS", name: "Palestine", dialCode: "+970", flag: "🇵🇸" },
  { code: "PA", name: "Panama", dialCode: "+507", flag: "🇵🇦" },
  { code: "PY", name: "Paraguay", dialCode: "+595", flag: "🇵🇾" },
  { code: "PE", name: "Peru", dialCode: "+51", flag: "🇵🇪" },
  { code: "PH", name: "Philippines", dialCode: "+63", flag: "🇵🇭" },
  { code: "PL", name: "Poland", dialCode: "+48", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", dialCode: "+351", flag: "🇵🇹" },
  { code: "QA", name: "Qatar", dialCode: "+974", flag: "🇶🇦" },
  { code: "RO", name: "Romania", dialCode: "+40", flag: "🇷🇴" },
  { code: "RU", name: "Russia", dialCode: "+7", flag: "🇷🇺" },
  { code: "RW", name: "Rwanda", dialCode: "+250", flag: "🇷🇼" },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966", flag: "🇸🇦" },
  { code: "SN", name: "Senegal", dialCode: "+221", flag: "🇸🇳" },
  { code: "RS", name: "Serbia", dialCode: "+381", flag: "🇷🇸" },
  { code: "SL", name: "Sierra Leone", dialCode: "+232", flag: "🇸🇱" },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬" },
  { code: "SO", name: "Somalia", dialCode: "+252", flag: "🇸🇴" },
  { code: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦" },
  { code: "KR", name: "South Korea", dialCode: "+82", flag: "🇰🇷" },
  { code: "SS", name: "South Sudan", dialCode: "+211", flag: "🇸🇸" },
  { code: "ES", name: "Spain", dialCode: "+34", flag: "🇪🇸" },
  { code: "LK", name: "Sri Lanka", dialCode: "+94", flag: "🇱🇰" },
  { code: "SD", name: "Sudan", dialCode: "+249", flag: "🇸🇩" },
  { code: "SZ", name: "Eswatini", dialCode: "+268", flag: "🇸🇿" },
  { code: "SE", name: "Sweden", dialCode: "+46", flag: "🇸🇪" },
  { code: "CH", name: "Switzerland", dialCode: "+41", flag: "🇨🇭" },
  { code: "TW", name: "Taiwan", dialCode: "+886", flag: "🇹🇼" },
  { code: "TZ", name: "Tanzania", dialCode: "+255", flag: "🇹🇿" },
  { code: "TH", name: "Thailand", dialCode: "+66", flag: "🇹🇭" },
  { code: "TG", name: "Togo", dialCode: "+228", flag: "🇹🇬" },
  { code: "TN", name: "Tunisia", dialCode: "+216", flag: "🇹🇳" },
  { code: "TR", name: "Turkey", dialCode: "+90", flag: "🇹🇷" },
  { code: "UG", name: "Uganda", dialCode: "+256", flag: "🇺🇬" },
  { code: "UA", name: "Ukraine", dialCode: "+380", flag: "🇺🇦" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { code: "UY", name: "Uruguay", dialCode: "+598", flag: "🇺🇾" },
  { code: "VE", name: "Venezuela", dialCode: "+58", flag: "🇻🇪" },
  { code: "VN", name: "Vietnam", dialCode: "+84", flag: "🇻🇳" },
  { code: "YE", name: "Yemen", dialCode: "+967", flag: "🇾🇪" },
  { code: "ZM", name: "Zambia", dialCode: "+260", flag: "🇿🇲" },
  { code: "ZW", name: "Zimbabwe", dialCode: "+263", flag: "🇿🇼" },
];

const DEFAULT_COUNTRY = COUNTRIES.find(c => c.code === "TZ")!;

// ── IP-based country detection ─────────────────────────────────────────────
let _detectedCountry: CountryData | null = null;
let _detecting = false;
const _listeners: Array<(c: CountryData) => void> = [];

async function detectCountryByIP(): Promise<CountryData> {
  if (_detectedCountry) return _detectedCountry;
  if (_detecting) {
    return new Promise(resolve => { _listeners.push(resolve); });
  }
  _detecting = true;
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    const countryCode = data?.country_code;
    if (countryCode) {
      const found = COUNTRIES.find(c => c.code === countryCode);
      if (found) {
        _detectedCountry = found;
        _listeners.forEach(fn => fn(found));
        _listeners.length = 0;
        return found;
      }
    }
  } catch {
    // fallback silently
  } finally {
    _detecting = false;
  }
  _detectedCountry = DEFAULT_COUNTRY;
  _listeners.forEach(fn => fn(DEFAULT_COUNTRY));
  _listeners.length = 0;
  return DEFAULT_COUNTRY;
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useDetectedCountry() {
  const [country, setCountry] = useState<CountryData>(DEFAULT_COUNTRY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    detectCountryByIP().then(c => {
      if (!cancelled) { setCountry(c); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  return { country, loading };
}

// ── Component ──────────────────────────────────────────────────────────────
export interface CountryPhoneInputProps {
  value: string; // full international number without + e.g. "255712345678"
  onChange: (fullNumber: string, countryCode: string) => void;
  defaultCountry?: CountryData;
  autoDetect?: boolean;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}

const CountryPhoneInput = React.forwardRef<HTMLInputElement, CountryPhoneInputProps>(
  ({ value, onChange, defaultCountry, autoDetect = true, className, disabled, autoFocus, placeholder }, ref) => {
    const { country: detectedCountry, loading: detecting } = useDetectedCountry();
    const [selectedCountry, setSelectedCountry] = useState<CountryData>(defaultCountry || DEFAULT_COUNTRY);
    const [localNumber, setLocalNumber] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const hasAutoDetected = useRef(false);

    // Auto-detect country on mount
    useEffect(() => {
      if (autoDetect && !detecting && !hasAutoDetected.current && !value) {
        hasAutoDetected.current = true;
        setSelectedCountry(detectedCountry);
      }
    }, [autoDetect, detecting, detectedCountry, value]);

    // Sync from external value
    useEffect(() => {
      if (value) {
        // Try to match country from value
        const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
        for (const c of sorted) {
          const code = c.dialCode.replace("+", "");
          if (value.startsWith(code)) {
            setSelectedCountry(c);
            setLocalNumber(value.slice(code.length));
            return;
          }
        }
        setLocalNumber(value);
      }
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setDropdownOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Focus search when dropdown opens
    useEffect(() => {
      if (dropdownOpen) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else {
        setSearch("");
      }
    }, [dropdownOpen]);

    const emitChange = (country: CountryData, number: string) => {
      const dialDigits = country.dialCode.replace("+", "");
      const cleaned = number.replace(/[^\d]/g, "");
      onChange(dialDigits + cleaned, country.code);
    };

    const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^\d]/g, "");
      setLocalNumber(raw);
      emitChange(selectedCountry, raw);
    };

    const selectCountry = (c: CountryData) => {
      setSelectedCountry(c);
      setDropdownOpen(false);
      emitChange(c, localNumber);
    };

    const filteredCountries = useMemo(() => {
      if (!search.trim()) return COUNTRIES;
      const q = search.toLowerCase();
      return COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
      );
    }, [search]);

    return (
      <div ref={containerRef} className={cn("relative", className)}>
        <div className="flex">
          {/* Country selector button */}
          <button
            type="button"
            onClick={() => !disabled && setDropdownOpen(!dropdownOpen)}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 px-3 h-12 rounded-l-xl border border-r-0 border-input bg-muted/50",
              "hover:bg-muted transition-colors text-sm shrink-0",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <span className="text-lg leading-none">{selectedCountry.flag}</span>
            <span className="text-foreground font-medium">{selectedCountry.dialCode}</span>
            <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", dropdownOpen && "rotate-180")} />
          </button>

          {/* Phone number input */}
          <Input
            ref={ref}
            type="tel"
            inputMode="numeric"
            value={localNumber}
            onChange={handleLocalChange}
            placeholder={placeholder || "Phone number"}
            disabled={disabled}
            autoFocus={autoFocus}
            autoComplete="off"
            className="h-12 rounded-l-none rounded-r-xl border-l-0 focus-visible:ring-offset-0"
          />
        </div>

        {/* Dropdown */}
        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-full bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search country..."
                  className="w-full h-9 pl-8 pr-8 text-sm bg-transparent border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* Country list */}
            <div className="max-h-56 overflow-y-auto">
              {filteredCountries.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No countries found</p>
              )}
              {filteredCountries.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => selectCountry(c)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left",
                    c.code === selectedCountry.code && "bg-primary/5 text-primary font-medium"
                  )}
                >
                  <span className="text-lg leading-none">{c.flag}</span>
                  <span className="flex-1 truncate text-foreground">{c.name}</span>
                  <span className="text-muted-foreground text-xs">{c.dialCode}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

CountryPhoneInput.displayName = "CountryPhoneInput";

// ── Utility: check if number is Tanzanian ──────────────────────────────────
export function isTanzanianNumber(fullNumber: string): boolean {
  const cleaned = fullNumber.replace(/[^\d]/g, "");
  return cleaned.startsWith("255") && cleaned.length === 12;
}

// ── Utility: format for display ────────────────────────────────────────────
export function formatPhoneDisplay(fullNumber: string): string {
  if (!fullNumber) return "";
  const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  for (const c of sorted) {
    const code = c.dialCode.replace("+", "");
    if (fullNumber.startsWith(code)) {
      return `+${code} ${fullNumber.slice(code.length)}`;
    }
  }
  return `+${fullNumber}`;
}

// ── Utility: mask phone number for display (e.g. +255 7** *** *89) ─────────
export function maskPhoneDisplay(fullNumber: string): string {
  if (!fullNumber) return "";
  const cleaned = fullNumber.replace(/[^\d]/g, "");
  if (cleaned.length < 6) return "***";
  // Find country code
  const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  let dialCode = "";
  let local = cleaned;
  for (const c of sorted) {
    const code = c.dialCode.replace("+", "");
    if (cleaned.startsWith(code)) {
      dialCode = code;
      local = cleaned.slice(code.length);
      break;
    }
  }
  if (!dialCode) {
    dialCode = cleaned.slice(0, 3);
    local = cleaned.slice(3);
  }
  // Show first digit and last 2 digits of local number, mask rest
  if (local.length <= 3) return `+${dialCode} ${"*".repeat(local.length)}`;
  const first = local[0];
  const last2 = local.slice(-2);
  const masked = first + "*".repeat(local.length - 3) + last2;
  // Format in groups of 3
  const groups = masked.match(/.{1,3}/g) || [masked];
  return `+${dialCode} ${groups.join(" ")}`;
}

export { CountryPhoneInput };
