import { useState } from "react";
import { api, EventType } from "@/lib/api";

export const useEventTypes = () => {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEventTypes = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.references.getEventTypes();
      if (response.success) {
        setEventTypes(response.data);
      } else {
        setError(response.message || "Failed to fetch event types");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return { eventTypes, loading, error, fetchEventTypes };
};
