/**
 * Support Data Hooks
 */

import { useState, useEffect, useCallback } from "react";
import { supportApi, SupportTicket, FAQ, FAQCategory } from "@/lib/api/support";
import { throwApiError } from "@/lib/api/showApiErrors";

// ============================================================================
// SUPPORT TICKETS
// ============================================================================

// Module-level cache for support tickets
let _ticketsCache: SupportTicket[] = [];
let _ticketsSummaryCache: any = null;
let _ticketsHasLoaded = false;

export const useMyTickets = (initialParams?: { page?: number; limit?: number; status?: string }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>(_ticketsCache);
  const [summary, setSummary] = useState<any>(_ticketsSummaryCache);
  const [loading, setLoading] = useState(!_ticketsHasLoaded);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchTickets = useCallback(async (params?: { page?: number; limit?: number; status?: string }) => {
    if (!_ticketsHasLoaded) setLoading(true);
    setError(null);
    try {
      const response = await supportApi.getMyTickets(params || initialParams);
      if (response.success) {
        _ticketsCache = response.data.tickets;
        _ticketsSummaryCache = response.data.summary;
        _ticketsHasLoaded = true;
        setTickets(response.data.tickets);
        setSummary(response.data.summary);
        setPagination(response.data.pagination);
      } else {
        setError(response.message || "Failed to fetch tickets");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [initialParams]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const createTicket = async (formData: FormData) => {
    try {
      const response = await supportApi.createTicket(formData);
      if (response.success) {
        await fetchTickets();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { tickets, summary, loading, error, pagination, refetch: fetchTickets, createTicket };
};

export const useTicket = (ticketId: string | null) => {
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTicket = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await supportApi.getTicket(ticketId);
      if (response.success) {
        setTicket(response.data);
      } else {
        setError(response.message || "Failed to fetch ticket");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (ticketId) fetchTicket();
  }, [fetchTicket, ticketId]);

  const replyToTicket = async (formData: FormData) => {
    if (!ticketId) return null;
    try {
      const response = await supportApi.replyToTicket(ticketId, formData);
      if (response.success) {
        await fetchTicket();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const closeTicket = async (reason?: string) => {
    if (!ticketId) return null;
    try {
      const response = await supportApi.closeTicket(ticketId, { reason });
      if (response.success) {
        await fetchTicket();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const reopenTicket = async (reason: string) => {
    if (!ticketId) return null;
    try {
      const response = await supportApi.reopenTicket(ticketId, { reason });
      if (response.success) {
        await fetchTicket();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const rateTicket = async (rating: 1 | 2 | 3 | 4 | 5, comment?: string) => {
    if (!ticketId) return null;
    try {
      const response = await supportApi.rateTicket(ticketId, { rating, comment });
      if (response.success) {
        await fetchTicket();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { ticket, loading, error, refetch: fetchTicket, replyToTicket, closeTicket, reopenTicket, rateTicket };
};

// ============================================================================
// FAQs
// ============================================================================

export const useFAQCategories = () => {
  const [categories, setCategories] = useState<FAQCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await supportApi.getFAQCategories();
      if (response.success) {
        setCategories(response.data);
      } else {
        setError(response.message || "Failed to fetch categories");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, loading, error, refetch: fetchCategories };
};

export const useFAQs = (category?: string, search?: string) => {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFAQs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await supportApi.getFAQs({ category, search });
      if (response.success) {
        setFaqs(response.data);
      } else {
        setError(response.message || "Failed to fetch FAQs");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    fetchFAQs();
  }, [fetchFAQs]);

  const rateFAQ = async (faqId: string, helpful: boolean) => {
    try {
      const response = await supportApi.rateFAQ(faqId, { helpful });
      if (response.success) {
        // Update local state
        setFaqs(prev => prev.map(faq => 
          faq.id === faqId 
            ? { 
                ...faq, 
                helpful_count: response.data.helpful_count, 
                not_helpful_count: response.data.not_helpful_count 
              } 
            : faq
        ));
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { faqs, loading, error, refetch: fetchFAQs, rateFAQ };
};

// ============================================================================
// LIVE CHAT
// ============================================================================

export const useLiveChat = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean>(false);

  const checkAvailability = useCallback(async () => {
    try {
      const response = await supportApi.checkChatAvailability();
      if (response.success) {
        setAvailable(response.data.available);
        return response.data;
      }
    } catch (err) {
      console.error("Failed to check availability:", err);
    }
    return null;
  }, []);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  const startChat = async (topic: string | undefined, initialMessage: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await supportApi.startChat({ topic, initial_message: initialMessage });
      if (response.success) {
        setSession(response.data);
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start chat";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (sessionId: string, content: string) => {
    try {
      const response = await supportApi.sendChatMessage(sessionId, { content });
      if (response.success) {
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const endChat = async (sessionId: string, rating?: number, feedback?: string) => {
    try {
      const response = await supportApi.endChat(sessionId, { rating, feedback });
      if (response.success) {
        setSession(null);
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const fetchSession = async (sessionId: string) => {
    try {
      const response = await supportApi.getChatSession(sessionId);
      if (response.success) {
        setSession(response.data);
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { session, loading, error, available, checkAvailability, startChat, sendMessage, endChat, fetchSession };
};

// ============================================================================
// CONTACT
// ============================================================================

export const useContactInfo = () => {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await supportApi.getContactInfo();
      if (response.success) {
        setInfo(response.data);
      } else {
        setError(response.message || "Failed to fetch contact info");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  const submitContactForm = async (data: Parameters<typeof supportApi.submitContactForm>[0]) => {
    try {
      const response = await supportApi.submitContactForm(data);
      if (response.success) {
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { info, loading, error, refetch: fetchInfo, submitContactForm };
};
