import { useState } from "react";

// Hook to load Event Types
export const useEventTypes = () => {
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEventTypes = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/references/event-types`
      );
      const data = await res.json();
      if (data.success) {
        setEventTypes(data.data);
      } else {
        setError(data.message || "Failed to fetch event types");
      }
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return { eventTypes, loading, error, fetchEventTypes };
};
