import { useState, useEffect, useCallback } from "react";
import { api, UserService, servicesApi } from "@/lib/api";

interface ServicesSummary {
  total_services: number;
  active_services: number;
  verified_services: number;
  pending_verification: number;
  total_reviews: number;
  average_rating: number;
}

// Module-level cache for user services
let _userServicesCache: UserService[] = [];
let _userServicesSummaryCache: ServicesSummary | null = null;
let _userServicesRecentReviewsCache: any[] = [];
let _userServicesHasLoaded = false;

export const useUserServices = () => {
  const [services, setServices] = useState<UserService[]>(_userServicesCache);
  const [summary, setSummary] = useState<ServicesSummary | null>(_userServicesSummaryCache);
  const [recentReviews, setRecentReviews] = useState<any[]>(_userServicesRecentReviewsCache);
  const [loading, setLoading] = useState(!_userServicesHasLoaded);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    if (!_userServicesHasLoaded) setLoading(true);
    setError(null);

    try {
      const response = await api.userServices.getAll();
      if (response.success && response.data) {
        const data = response.data as any;
        let items: UserService[] = [];
        let sum: ServicesSummary | null = null;
        let reviews: any[] = [];
        if (data.services && Array.isArray(data.services)) {
          items = data.services;
          sum = data.summary || null;
          reviews = data.recent_reviews || [];
        } else if (Array.isArray(data)) {
          items = data;
        }
        _userServicesCache = items;
        _userServicesSummaryCache = sum;
        _userServicesRecentReviewsCache = reviews;
        _userServicesHasLoaded = true;
        setServices(items);
        setSummary(sum);
        setRecentReviews(reviews);
      } else {
        setError(response.message || "Failed to fetch user services");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return { services, summary, recentReviews, loading, error, refetch: fetchServices };
};

// ============================================================================
// ALL SERVICES (for FindServices page - public listing)
// ============================================================================

// Module-level cache for public services listing
let _servicesCache: UserService[] = [];
let _servicesPaginationCache: any = null;
let _servicesHasLoaded = false;

export const useServices = (params?: { category?: string; location?: string; search?: string }) => {
  const [services, setServices] = useState<UserService[]>(_servicesCache);
  const [loading, setLoading] = useState(!_servicesHasLoaded);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(_servicesPaginationCache);

  const fetchServices = useCallback(async () => {
    if (!_servicesHasLoaded) setLoading(true);
    setError(null);

    try {
      const response = await servicesApi.search(params);
      if (response.success) {
        _servicesCache = response.data.services;
        _servicesPaginationCache = response.data.pagination;
        _servicesHasLoaded = true;
        setServices(response.data.services);
        setPagination(response.data.pagination);
      } else {
        setError(response.message || "Failed to fetch services");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return { services, loading, error, pagination, refetch: fetchServices };
};
