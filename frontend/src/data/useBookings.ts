/**
 * Bookings Data Hooks
 */

import { useState, useEffect, useCallback } from "react";
import { bookingsApi, BookingQueryParams } from "@/lib/api/bookings";
import type { BookingRequest } from "@/lib/api/types";
import { throwApiError } from "@/lib/api/showApiErrors";

const computeSummary = (items: any[]) => ({
  total: items.length,
  pending: items.filter((b: any) => b.status === 'pending').length,
  accepted: items.filter((b: any) => b.status === 'accepted').length,
  rejected: items.filter((b: any) => b.status === 'rejected').length,
  completed: items.filter((b: any) => b.status === 'completed').length,
  cancelled: items.filter((b: any) => b.status === 'cancelled').length,
});

// ============================================================================
// MY BOOKINGS (Client perspective)
// ============================================================================

export const useMyBookings = (initialParams?: BookingQueryParams) => {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchBookings = useCallback(async (params?: BookingQueryParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await bookingsApi.getMyBookings(params || initialParams);
      if (response.success) {
        // Backend returns flat array via standard_response
        const items = Array.isArray(response.data) ? response.data : (response.data?.bookings || []);
        setBookings(items);
        // Compute summary from items if not provided
        const s = response.data?.summary || computeSummary(items);
        setSummary(s);
        setPagination(response.data?.pagination || (response as any).pagination || null);
      } else {
        setError(response.message || "Failed to fetch bookings");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [initialParams]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const createBooking = async (data: Parameters<typeof bookingsApi.create>[0]) => {
    try {
      const response = await bookingsApi.create(data);
      if (response.success) {
        await fetchBookings();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const cancelBooking = async (bookingId: string, reason: string) => {
    try {
      const response = await bookingsApi.cancel(bookingId, { reason, notify_other_party: true });
      if (response.success) {
        await fetchBookings();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { 
    bookings, 
    summary, 
    loading, 
    error, 
    pagination, 
    refetch: fetchBookings,
    createBooking,
    cancelBooking
  };
};

// ============================================================================
// INCOMING BOOKINGS (Vendor perspective)
// ============================================================================

export const useIncomingBookings = (initialParams?: BookingQueryParams) => {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchBookings = useCallback(async (params?: BookingQueryParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await bookingsApi.getIncomingBookings(params || initialParams);
      if (response.success) {
        const items = Array.isArray(response.data) ? response.data : (response.data?.bookings || []);
        setBookings(items);
        const s = response.data?.summary || computeSummary(items);
        setSummary(s);
        setPagination(response.data?.pagination || (response as any).pagination || null);
      } else {
        setError(response.message || "Failed to fetch bookings");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [initialParams]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const respondToBooking = async (bookingId: string, data: Parameters<typeof bookingsApi.respond>[1]) => {
    try {
      const response = await bookingsApi.respond(bookingId, data);
      if (response.success) {
        await fetchBookings();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const completeBooking = async (bookingId: string, data?: { completion_notes?: string; final_amount?: number }) => {
    try {
      const response = await bookingsApi.complete(bookingId, data || {});
      if (response.success) {
        await fetchBookings();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { 
    bookings, 
    summary, 
    loading, 
    error, 
    pagination, 
    refetch: fetchBookings,
    respondToBooking,
    completeBooking
  };
};

// ============================================================================
// SINGLE BOOKING
// ============================================================================

export const useBooking = (bookingId: string | null) => {
  const [booking, setBooking] = useState<BookingRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooking = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await bookingsApi.getById(bookingId);
      if (response.success) {
        setBooking(response.data);
      } else {
        setError(response.message || "Failed to fetch booking");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (bookingId) fetchBooking();
  }, [fetchBooking, bookingId]);

  return { booking, loading, error, refetch: fetchBooking };
};

// ============================================================================
// BOOKING CALENDAR
// ============================================================================

export const useBookingCalendar = (startDate: string, endDate: string, serviceId?: string) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await bookingsApi.getCalendar({ start_date: startDate, end_date: endDate, service_id: serviceId });
      if (response.success) {
        setBookings(response.data.bookings);
      } else {
        setError(response.message || "Failed to fetch calendar");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, serviceId]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const blockDates = async (dates: string[], reason?: string) => {
    if (!serviceId) return;
    try {
      const response = await bookingsApi.blockDates({ service_id: serviceId, dates, reason });
      if (response.success) {
        await fetchCalendar();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const unblockDates = async (dates: string[]) => {
    if (!serviceId) return;
    try {
      const response = await bookingsApi.unblockDates({ service_id: serviceId, dates });
      if (response.success) {
        await fetchCalendar();
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { bookings, loading, error, refetch: fetchCalendar, blockDates, unblockDates };
};
