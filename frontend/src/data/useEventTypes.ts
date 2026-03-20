import { useState } from "react";
import { api, EventType } from "@/lib/api";

let _eventTypesCache: EventType[] = [];
let _eventTypesHasLoaded = false;

export const useEventTypes = () => {
  const [eventTypes, setEventTypes] = useState<EventType[]>(_eventTypesCache);
  const [loading, setLoading] = useState(!_eventTypesHasLoaded);
  const [error, setError] = useState<string | null>(null);

  const fetchEventTypes = async () => {
    if (!_eventTypesHasLoaded) setLoading(true);
    setError(null);

    try {
      const response = await api.references.getEventTypes();
      if (response.success) {
        _eventTypesCache = response.data;
        _eventTypesHasLoaded = true;
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
