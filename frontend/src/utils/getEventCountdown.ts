/**
 * Returns a human-readable countdown string for an event date.
 * e.g. "3 weeks, 2 days to go" or "Event has passed" or "Today!"
 */
export const getEventCountdown = (dateStr?: string): { text: string; isPast: boolean } | null => {
  if (!dateStr) return null;

  const eventDate = new Date(dateStr);
  if (isNaN(eventDate.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { text: 'Today!', isPast: false };
  if (diffDays === 1) return { text: 'Tomorrow', isPast: false };
  if (diffDays === -1) return { text: 'Yesterday', isPast: true };

  if (diffDays < 0) {
    return { text: 'Event has passed', isPast: true };
  }

  if (diffDays <= 7) {
    return { text: `${diffDays} day${diffDays !== 1 ? 's' : ''} left`, isPast: false };
  }
  if (diffDays <= 30) {
    const weeks = Math.round(diffDays / 7);
    return { text: `${weeks} week${weeks !== 1 ? 's' : ''} left`, isPast: false };
  }
  if (diffDays <= 90) {
    const months = Math.round(diffDays / 30);
    return { text: `${months} month${months !== 1 ? 's' : ''} left`, isPast: false };
  }
  const months = Math.round(diffDays / 30);
  return { text: `${months} months left`, isPast: false };
};
