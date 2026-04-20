/**
 * Convert a server timestamp (UTC, may be naive) to the user's local time.
 *
 * Some backend rows still come back as naive ISO strings without a tz
 * suffix. We treat those as UTC by appending `Z` so the browser converts
 * them to the user's local timezone correctly. Without this, dates appear
 * shifted by the difference between server and viewer timezones.
 */
const ensureUtc = (input: string): string => {
  if (!input) return input;
  if (input.endsWith('Z')) return input;
  if (/[+-]\d{2}:?\d{2}$/.test(input)) return input;
  if (input.includes('T')) return `${input}Z`;
  // "2025-01-02 12:34:56" → ISO + Z
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(input)) {
    return `${input.replace(' ', 'T')}Z`;
  }
  return input;
};

const toDate = (input: string | Date | null | undefined): Date | null => {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(ensureUtc(input));
  return isNaN(d.getTime()) ? null : d;
};

/** "12 Jun 2025, 14:30" — user's local timezone */
export const formatLocalDateTime = (input: string | Date | null | undefined): string => {
  const d = toDate(input);
  if (!d) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** "12 Jun 2025" — user's local timezone */
export const formatLocalDate = (input: string | Date | null | undefined): string => {
  const d = toDate(input);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

/** "14:30" — user's local timezone */
export const formatLocalTime = (input: string | Date | null | undefined): string => {
  const d = toDate(input);
  if (!d) return '—';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};
