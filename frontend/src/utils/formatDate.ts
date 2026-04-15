/**
 * Date formatting utilities
 * Supports: dd/mm/yyyy, "12 June 2025", "Monday, 12 June 2025"
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

function toDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/** "12/06/2025" */
export const formatDateShort = (input: string | Date | null | undefined): string => {
  const d = toDate(input);
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/** "12 June 2025" */
export const formatDateMedium = (input: string | Date | null | undefined): string => {
  const d = toDate(input);
  if (!d) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** "Monday, 12 June 2025" */
export const formatDateLong = (input: string | Date | null | undefined): string => {
  const d = toDate(input);
  if (!d) return '';
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** "12 June 2025" — default for most UI */
export const formatEventDate = formatDateMedium;

/** Format time "HH:MM" from ISO string */
export const formatTime = (input: string | Date | null | undefined): string => {
  const d = toDate(input);
  if (!d) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

/** "12 June 2025, 14:30" */
export const formatDateTime = (input: string | Date | null | undefined): string => {
  const d = toDate(input);
  if (!d) return '';
  return `${formatDateMedium(d)}, ${formatTime(d)}`;
};
