/**
 * Nuru Cards Data Hooks
 * Uses initialLoad pattern to prevent skeleton re-renders.
 */

import { useState, useEffect, useCallback } from "react";
import { nuruCardsApi } from "@/lib/api/nuruCards";
import type { NuruCard, NuruCardType } from "@/lib/api/types";
import { throwApiError } from "@/lib/api/showApiErrors";

// ============================================================================
// CARD TYPES
// ============================================================================

let _cardTypesCache: NuruCardType[] = [];
let _cardTypesHasLoaded = false;

export const useNuruCardTypes = () => {
  const [cardTypes, setCardTypes] = useState<NuruCardType[]>(_cardTypesCache);
  const [loading, setLoading] = useState(!_cardTypesHasLoaded);
  const [error, setError] = useState<string | null>(null);

  const fetchCardTypes = useCallback(async () => {
    if (!_cardTypesHasLoaded) setLoading(true);
    setError(null);
    try {
      const response = await nuruCardsApi.getCardTypes();
      if (response.success) {
        _cardTypesCache = response.data;
        _cardTypesHasLoaded = true;
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

let _nuruCardCache: NuruCard | null = null;
let _nuruCardHasLoaded = false;

export const useNuruCard = () => {
  const [card, setCard] = useState<NuruCard | null>(_nuruCardCache);
  const [loading, setLoading] = useState(!_nuruCardHasLoaded);
  const [error, setError] = useState<string | null>(null);

  const fetchCard = useCallback(async () => {
    if (!_nuruCardHasLoaded) setLoading(true);
    setError(null);
    try {
      const response = await nuruCardsApi.getMyCards();
      if (response.success && response.data.length > 0) {
        _nuruCardCache = response.data[0];
        _nuruCardHasLoaded = true;
        setCard(response.data[0]);
      } else {
        _nuruCardHasLoaded = true;
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
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const upgradeCard = async (newCardTypeId: string) => {
    if (!card) throw new Error("No card to upgrade");
    try {
      const response = await nuruCardsApi.upgradeToPremium(card.id, { payment_method: 'mobile' });
      if (response.success) {
        await fetchCard();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { card, loading, error, refetch: fetchCard, requestCard, upgradeCard };
};

// ============================================================================
// MY CARDS
// ============================================================================

let _myCardsCache: NuruCard[] = [];
let _myCardsHasLoaded = false;

export const useMyCards = () => {
  const [cards, setCards] = useState<NuruCard[]>(_myCardsCache);
  const [loading, setLoading] = useState(!_myCardsHasLoaded);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    if (!_myCardsHasLoaded) setLoading(true);
    setError(null);
    try {
      const response = await nuruCardsApi.getMyCards();
      if (response.success) {
        _myCardsCache = response.data;
        _myCardsHasLoaded = true;
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
      throwApiError(response);
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
      throwApiError(response);
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
      throwApiError(response);
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
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { cards, loading, error, refetch: fetchCards, registerCard, updateCard, deactivateCard, reportLost };
};

// ============================================================================
// SINGLE CARD
// ============================================================================

const _singleCardCache = new Map<string, NuruCard>();

export const useCard = (cardId: string | null) => {
  const cached = cardId ? _singleCardCache.get(cardId) : null;
  const [card, setCard] = useState<NuruCard | null>(cached || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const fetchCard = useCallback(async () => {
    if (!cardId) return;
    if (!_singleCardCache.has(cardId)) setLoading(true);
    setError(null);
    try {
      const response = await nuruCardsApi.getCard(cardId);
      if (response.success) {
        _singleCardCache.set(cardId, response.data);
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
      throwApiError(response);
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
      throwApiError(response);
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

const _checkinHistoryCache = new Map<string, { checkins: any[]; pagination: any }>();

export const useCheckInHistory = (cardId: string | null) => {
  const cached = cardId ? _checkinHistoryCache.get(cardId) : null;
  const [checkins, setCheckins] = useState<any[]>(cached?.checkins || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(cached?.pagination || null);

  const fetchHistory = useCallback(async (params?: { page?: number; limit?: number }) => {
    if (!cardId) return;
    if (!_checkinHistoryCache.has(cardId)) setLoading(true);
    setError(null);
    try {
      const response = await nuruCardsApi.getCheckInHistory(cardId, params);
      if (response.success) {
        _checkinHistoryCache.set(cardId, { checkins: response.data.checkins, pagination: response.data.pagination });
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

const _cardAnalyticsCache = new Map<string, any>();

export const useCardAnalytics = (cardId: string | null, startDate?: string, endDate?: string) => {
  const cacheKey = `${cardId || ''}|${startDate || ''}|${endDate || ''}`;
  const cached = cardId ? _cardAnalyticsCache.get(cacheKey) : null;
  const [analytics, setAnalytics] = useState<any>(cached || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!cardId) return;
    if (!_cardAnalyticsCache.has(cacheKey)) setLoading(true);
    setError(null);
    try {
      const response = await nuruCardsApi.getTapAnalytics(cardId, { start_date: startDate, end_date: endDate });
      if (response.success) {
        _cardAnalyticsCache.set(cacheKey, response.data);
        setAnalytics(response.data);
      } else {
        setError(response.message || "Failed to fetch analytics");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [cacheKey, cardId, startDate, endDate]);

  useEffect(() => {
    if (cardId) fetchAnalytics();
  }, [fetchAnalytics, cardId]);

  return { analytics, loading, error, refetch: fetchAnalytics };
};

// ============================================================================
// PREMIUM BENEFITS
// ============================================================================

let _benefitsCache: { benefits: any[]; pricing: any } | null = null;
let _benefitsHasLoaded = false;

export const usePremiumBenefits = () => {
  const [benefits, setBenefits] = useState<any[]>(_benefitsCache?.benefits || []);
  const [pricing, setPricing] = useState<any>(_benefitsCache?.pricing || null);
  const [loading, setLoading] = useState(!_benefitsHasLoaded);
  const [error, setError] = useState<string | null>(null);

  const fetchBenefits = useCallback(async () => {
    if (!_benefitsHasLoaded) setLoading(true);
    setError(null);
    try {
      const response = await nuruCardsApi.getPremiumBenefits();
      if (response.success) {
        _benefitsCache = { benefits: response.data.benefits, pricing: response.data.pricing };
        _benefitsHasLoaded = true;
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
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { benefits, pricing, loading, error, refetch: fetchBenefits, upgradeToPremium };
};

// ============================================================================
// EVENT CHECK-IN STATS (for organizers)
// ============================================================================

const _checkInStatsCache = new Map<string, any>();

export const useEventCheckInStats = (eventId: string | null) => {
  const cached = eventId ? _checkInStatsCache.get(eventId) : null;
  const [stats, setStats] = useState<any>(cached || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!eventId) return;
    if (!_checkInStatsCache.has(eventId)) setLoading(true);
    setError(null);
    try {
      const response = await nuruCardsApi.getEventCheckInStats(eventId);
      if (response.success) {
        _checkInStatsCache.set(eventId, response.data);
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
