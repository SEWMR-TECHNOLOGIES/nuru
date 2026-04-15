import { useState, useEffect } from "react";
import { api, ServiceCategory } from "@/lib/api";

// Module-level cache for service categories (reference data, rarely changes)
let _serviceCategoriesCache: ServiceCategory[] = [];
let _serviceCategoriesHasLoaded = false;

export const useServiceCategories = () => {
  const [categories, setCategories] = useState<ServiceCategory[]>(_serviceCategoriesCache);
  const [loading, setLoading] = useState(!_serviceCategoriesHasLoaded);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      if (!_serviceCategoriesHasLoaded) setLoading(true);
      try {
        const response = await api.references.getServiceCategories();
        if (response.success) {
          _serviceCategoriesCache = response.data;
          _serviceCategoriesHasLoaded = true;
          setCategories(response.data);
        } else {
          setError(response.message || "Failed to fetch service categories");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, loading, error };
};
