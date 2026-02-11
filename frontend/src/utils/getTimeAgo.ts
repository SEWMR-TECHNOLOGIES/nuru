/**
 * Shared time-ago utility with UTC-to-local conversion.
 * Server timestamps lack timezone info, so we append 'Z' to interpret as UTC
 * before converting to the client's local time for accurate relative display.
 */
export const getTimeAgo = (dateString: string): string => {
  // Append 'Z' if no timezone indicator present (server returns UTC without suffix)
  const normalized = dateString.endsWith('Z') || dateString.includes('+') || dateString.includes('T') && dateString.match(/[+-]\d{2}:\d{2}$/)
    ? dateString
    : dateString + 'Z';
  const date = new Date(normalized);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};
