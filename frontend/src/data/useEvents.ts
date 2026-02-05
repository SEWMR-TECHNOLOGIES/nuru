/**
 * Events Data Hooks
 */

import { useState, useEffect, useCallback } from "react";
import { eventsApi, EventQueryParams, GuestQueryParams, ContributionQueryParams } from "@/lib/api/events";
import type { 
  Event, 
  EventGuest, 
  CommitteeMember, 
  EventContribution, 
  EventScheduleItem,
  EventBudgetItem 
} from "@/lib/api/types";

// ============================================================================
// EVENTS LIST
// ============================================================================

export const useEvents = (initialParams?: EventQueryParams) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchEvents = useCallback(async (params?: EventQueryParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await eventsApi.getAll(params || initialParams);
      if (response.success) {
        setEvents(response.data.events);
        setPagination(response.data.pagination);
      } else {
        setError(response.message || "Failed to fetch events");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [initialParams]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, pagination, refetch: fetchEvents };
};

// ============================================================================
// SINGLE EVENT
// ============================================================================

export const useEvent = (eventId: string | null) => {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await eventsApi.getById(eventId);
      if (response.success) {
        setEvent(response.data);
      } else {
        setError(response.message || "Failed to fetch event");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) fetchEvent();
  }, [fetchEvent, eventId]);

  return { event, loading, error, refetch: fetchEvent };
};

// ============================================================================
// EVENT GUESTS
// ============================================================================

export const useEventGuests = (eventId: string | null, initialParams?: GuestQueryParams) => {
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchGuests = useCallback(async (params?: GuestQueryParams) => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await eventsApi.getGuests(eventId, params || initialParams);
      if (response.success) {
        setGuests(response.data.guests);
        setSummary(response.data.summary);
        setPagination(response.data.pagination);
      } else {
        setError(response.message || "Failed to fetch guests");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [eventId, initialParams]);

  useEffect(() => {
    if (eventId) fetchGuests();
  }, [fetchGuests, eventId]);

  const addGuest = async (data: Partial<EventGuest>) => {
    if (!eventId) return null;
    try {
      const response = await eventsApi.addGuest(eventId, data);
      if (response.success) {
        await fetchGuests();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  const updateGuest = async (guestId: string, data: Partial<EventGuest>) => {
    if (!eventId) return null;
    try {
      const response = await eventsApi.updateGuest(eventId, guestId, data);
      if (response.success) {
        await fetchGuests();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  const deleteGuest = async (guestId: string) => {
    if (!eventId) return;
    try {
      const response = await eventsApi.deleteGuest(eventId, guestId);
      if (response.success) {
        await fetchGuests();
      } else {
        throw new Error(response.message);
      }
    } catch (err) {
      throw err;
    }
  };

  const sendInvitation = async (guestId: string, method: "email" | "sms" | "whatsapp", customMessage?: string) => {
    if (!eventId) return null;
    try {
      const response = await eventsApi.sendInvitation(eventId, guestId, { method, custom_message: customMessage });
      if (response.success) {
        await fetchGuests();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  const checkinGuest = async (guestId: string) => {
    if (!eventId) return null;
    try {
      const response = await eventsApi.checkinGuest(eventId, guestId);
      if (response.success) {
        await fetchGuests();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  return { 
    guests, 
    summary, 
    loading, 
    error, 
    pagination, 
    refetch: fetchGuests,
    addGuest,
    updateGuest,
    deleteGuest,
    sendInvitation,
    checkinGuest
  };
};

// ============================================================================
// EVENT COMMITTEE
// ============================================================================

export const useEventCommittee = (eventId: string | null) => {
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommittee = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await eventsApi.getCommittee(eventId);
      if (response.success) {
        setMembers(response.data);
      } else {
        setError(response.message || "Failed to fetch committee");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) fetchCommittee();
  }, [fetchCommittee, eventId]);

  const addMember = async (data: Parameters<typeof eventsApi.addCommitteeMember>[1]) => {
    if (!eventId) return null;
    try {
      const response = await eventsApi.addCommitteeMember(eventId, data);
      if (response.success) {
        await fetchCommittee();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  const updateMember = async (memberId: string, data: Partial<CommitteeMember>) => {
    if (!eventId) return null;
    try {
      const response = await eventsApi.updateCommitteeMember(eventId, memberId, data);
      if (response.success) {
        await fetchCommittee();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  const removeMember = async (memberId: string) => {
    if (!eventId) return;
    try {
      const response = await eventsApi.removeCommitteeMember(eventId, memberId);
      if (response.success) {
        await fetchCommittee();
      } else {
        throw new Error(response.message);
      }
    } catch (err) {
      throw err;
    }
  };

  return { members, loading, error, refetch: fetchCommittee, addMember, updateMember, removeMember };
};

// ============================================================================
// EVENT CONTRIBUTIONS
// ============================================================================

export const useEventContributions = (eventId: string | null, initialParams?: ContributionQueryParams) => {
  const [contributions, setContributions] = useState<EventContribution[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchContributions = useCallback(async (params?: ContributionQueryParams) => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await eventsApi.getContributions(eventId, params || initialParams);
      if (response.success) {
        setContributions(response.data.contributions);
        setSummary(response.data.summary);
        setPagination(response.data.pagination);
      } else {
        setError(response.message || "Failed to fetch contributions");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [eventId, initialParams]);

  useEffect(() => {
    if (eventId) fetchContributions();
  }, [fetchContributions, eventId]);

  const addContribution = async (data: Partial<EventContribution>) => {
    if (!eventId) return null;
    try {
      const response = await eventsApi.addContribution(eventId, data);
      if (response.success) {
        await fetchContributions();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  const sendThankYou = async (contributionId: string, method: "email" | "sms" | "whatsapp", customMessage?: string) => {
    if (!eventId) return null;
    try {
      const response = await eventsApi.sendThankYou(eventId, contributionId, { method, custom_message: customMessage });
      if (response.success) {
        await fetchContributions();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  return { contributions, summary, loading, error, pagination, refetch: fetchContributions, addContribution, sendThankYou };
};

// ============================================================================
// EVENT SCHEDULE
// ============================================================================

export const useEventSchedule = (eventId: string | null) => {
  const [schedule, setSchedule] = useState<EventScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await eventsApi.getSchedule(eventId);
      if (response.success) {
        setSchedule(response.data);
      } else {
        setError(response.message || "Failed to fetch schedule");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) fetchSchedule();
  }, [fetchSchedule, eventId]);

  const addItem = async (data: Partial<EventScheduleItem>) => {
    if (!eventId) return null;
    try {
      const response = await eventsApi.addScheduleItem(eventId, data);
      if (response.success) {
        await fetchSchedule();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  const updateItem = async (itemId: string, data: Partial<EventScheduleItem>) => {
    if (!eventId) return null;
    try {
      const response = await eventsApi.updateScheduleItem(eventId, itemId, data);
      if (response.success) {
        await fetchSchedule();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!eventId) return;
    try {
      const response = await eventsApi.deleteScheduleItem(eventId, itemId);
      if (response.success) {
        await fetchSchedule();
      } else {
        throw new Error(response.message);
      }
    } catch (err) {
      throw err;
    }
  };

  return { schedule, loading, error, refetch: fetchSchedule, addItem, updateItem, deleteItem };
};

// ============================================================================
// EVENT BUDGET
// ============================================================================

export const useEventBudget = (eventId: string | null) => {
  const [items, setItems] = useState<EventBudgetItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBudget = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await eventsApi.getBudget(eventId);
      if (response.success) {
        setItems(response.data.items);
        setSummary(response.data.summary);
      } else {
        setError(response.message || "Failed to fetch budget");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) fetchBudget();
  }, [fetchBudget, eventId]);

  const addItem = async (data: Partial<EventBudgetItem>) => {
    if (!eventId) return null;
    try {
      const response = await eventsApi.addBudgetItem(eventId, data);
      if (response.success) {
        await fetchBudget();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  const updateItem = async (itemId: string, data: Partial<EventBudgetItem>) => {
    if (!eventId) return null;
    try {
      const response = await eventsApi.updateBudgetItem(eventId, itemId, data);
      if (response.success) {
        await fetchBudget();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!eventId) return;
    try {
      const response = await eventsApi.deleteBudgetItem(eventId, itemId);
      if (response.success) {
        await fetchBudget();
      } else {
        throw new Error(response.message);
      }
    } catch (err) {
      throw err;
    }
  };

  return { items, summary, loading, error, refetch: fetchBudget, addItem, updateItem, deleteItem };
};

// ============================================================================
// DELETE EVENT
// ============================================================================

export const useDeleteEvent = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteEvent = async (eventId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await eventsApi.delete(eventId);
      if (!response.success) {
        throw new Error(response.message || "Failed to delete event");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { deleteEvent, loading, error };
};
