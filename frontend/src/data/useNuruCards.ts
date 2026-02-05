/**
 * Nuru Cards Data Hooks
 */

import { useState, useEffect, useCallback } from "react";
import { nuruCardsApi } from "@/lib/api/nuruCards";
import type { NuruCard, NuruCardType } from "@/lib/api/types";

// ============================================================================
// CARD TYPES
// ============================================================================

export const useNuruCardTypes = () => {
  const [cardTypes, setCardTypes] = useState<NuruCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCardTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await nuruCardsApi.getCardTypes();
      if (response.success) {
        setCardTypes(response.data);
      } else {
        setError(response.message || "Failed to fetch card types");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCardTypes();
  }, [fetchCardTypes]);

  return { cardTypes, loading, error, refetch: fetchCardTypes };
};

// ============================================================================
// SINGLE CARD (primary user card)
// ============================================================================

export const useNuruCard = () => {
  const [card, setCard] = useState<NuruCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await nuruCardsApi.getMyCards();
      if (response.success && response.data.length > 0) {
        // Get the primary/first card
        setCard(response.data[0]);
      } else {
        setCard(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCard();
  }, [fetchCard]);

  const requestCard = async (cardTypeId: string) => {
    try {
      const response = await nuruCardsApi.requestCard({ card_type_id: cardTypeId });
      if (response.success) {
        await fetchCard();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  const upgradeCard = async (newCardTypeId: string) => {
    if (!card) throw new Error("No card to upgrade");
    try {
      const response = await nuruCardsApi.upgradeToPremium(card.id, { payment_method: 'mpesa' });
      if (response.success) {
        await fetchCard();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  return { card, loading, error, refetch: fetchCard, requestCard, upgradeCard };
};

// ============================================================================
// MY CARDS
// ============================================================================

export const useMyCards = () => {
  const [cards, setCards] = useState<NuruCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await nuruCardsApi.getMyCards();
      if (response.success) {
        setCards(response.data);
      } else {
        setError(response.message || "Failed to fetch cards");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const registerCard = async (data: { card_number: string; activation_code: string; pin?: string }) => {
    try {
      const response = await nuruCardsApi.registerCard(data);
      if (response.success) {
        await fetchCards();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  const updateCard = async (cardId: string, data: Parameters<typeof nuruCardsApi.updateCard>[1]) => {
    try {
      const response = await nuruCardsApi.updateCard(cardId, data);
      if (response.success) {
        await fetchCards();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  const deactivateCard = async (cardId: string, reason: string) => {
    try {
      const response = await nuruCardsApi.deactivateCard(cardId, { reason });
      if (response.success) {
        await fetchCards();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  const reportLost = async (cardId: string, reason: "lost" | "stolen", details?: string) => {
    try {
      const response = await nuruCardsApi.reportLost(cardId, { reason, details });
      if (response.success) {
        await fetchCards();
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  return { cards, loading, error, refetch: fetchCards, registerCard, updateCard, deactivateCard, reportLost };
};

// ============================================================================
// SINGLE CARD
// ============================================================================

export const useCard = (cardId: string | null) => {
  const [card, setCard] = useState<NuruCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCard = useCallback(async () => {
    if (!cardId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await nuruCardsApi.getCard(cardId);
      if (response.success) {
        setCard(response.data);
      } else {
        setError(response.message || "Failed to fetch card");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    if (cardId) fetchCard();
  }, [fetchCard, cardId]);

  return { card, loading, error, refetch: fetchCard };
};

// ============================================================================
// CHECK-IN
// ============================================================================

export const useCardCheckIn = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const checkIn = async (cardNumber: string, eventId: string, pin?: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await nuruCardsApi.checkIn({ card_number: cardNumber, event_id: eventId, pin });
      if (response.success) {
        setResult(response.data);
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Check-in failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const quickCheckIn = async (nfcId: string, eventId: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await nuruCardsApi.quickCheckIn({ nfc_id: nfcId, event_id: eventId });
      if (response.success) {
        setResult(response.data);
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Quick check-in failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { loading, error, result, checkIn, quickCheckIn, reset };
};

// ============================================================================
// CHECK-IN HISTORY
// ============================================================================

export const useCheckInHistory = (cardId: string | null) => {
  const [checkins, setCheckins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchHistory = useCallback(async (params?: { page?: number; limit?: number }) => {
    if (!cardId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await nuruCardsApi.getCheckInHistory(cardId, params);
      if (response.success) {
        setCheckins(response.data.checkins);
        setPagination(response.data.pagination);
      } else {
        setError(response.message || "Failed to fetch check-in history");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    if (cardId) fetchHistory();
  }, [fetchHistory, cardId]);

  return { checkins, loading, error, pagination, refetch: fetchHistory };
};

// ============================================================================
// CARD ANALYTICS
// ============================================================================

export const useCardAnalytics = (cardId: string | null, startDate?: string, endDate?: string) => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!cardId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await nuruCardsApi.getTapAnalytics(cardId, { start_date: startDate, end_date: endDate });
      if (response.success) {
        setAnalytics(response.data);
      } else {
        setError(response.message || "Failed to fetch analytics");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [cardId, startDate, endDate]);

  useEffect(() => {
    if (cardId) fetchAnalytics();
  }, [fetchAnalytics, cardId]);

  return { analytics, loading, error, refetch: fetchAnalytics };
};

// ============================================================================
// PREMIUM BENEFITS
// ============================================================================

export const usePremiumBenefits = () => {
  const [benefits, setBenefits] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBenefits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await nuruCardsApi.getPremiumBenefits();
      if (response.success) {
        setBenefits(response.data.benefits);
        setPricing(response.data.pricing);
      } else {
        setError(response.message || "Failed to fetch benefits");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBenefits();
  }, [fetchBenefits]);

  const upgradeToPremium = async (cardId: string, paymentMethod: string, phone?: string) => {
    try {
      const response = await nuruCardsApi.upgradeToPremium(cardId, { payment_method: paymentMethod, phone });
      if (response.success) {
        return response.data;
      }
      throw new Error(response.message);
    } catch (err) {
      throw err;
    }
  };

  return { benefits, pricing, loading, error, refetch: fetchBenefits, upgradeToPremium };
};

// ============================================================================
// EVENT CHECK-IN STATS (for organizers)
// ============================================================================

export const useEventCheckInStats = (eventId: string | null) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await nuruCardsApi.getEventCheckInStats(eventId);
      if (response.success) {
        setStats(response.data);
      } else {
        setError(response.message || "Failed to fetch stats");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) fetchStats();
  }, [fetchStats, eventId]);

  const searchGuest = async (query: string) => {
    if (!eventId) return [];
    try {
      const response = await nuruCardsApi.searchForCheckIn(eventId, query);
      if (response.success) {
        return response.data.guests;
      }
      return [];
    } catch (err) {
      console.error("Search failed:", err);
      return [];
    }
  };

  return { stats, loading, error, refetch: fetchStats, searchGuest };
};
