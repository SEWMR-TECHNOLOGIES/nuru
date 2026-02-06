/**
 * Settings Data Hook
 */

import { useState, useEffect, useCallback } from "react";
import { settingsApi, UserSettings } from "@/lib/api/settings";
import { throwApiError } from "@/lib/api/showApiErrors";

export const useSettings = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await settingsApi.getSettings();
      if (response.success) {
        setSettings(response.data);
      } else {
        setError(response.message || "Failed to fetch settings");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (data: Partial<UserSettings>) => {
    setUpdating(true);
    try {
      const response = await settingsApi.updateSettings(data);
      if (response.success) {
        setSettings(response.data);
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    } finally {
      setUpdating(false);
    }
  };

  const enableTwoFactor = async () => {
    try {
      const response = await settingsApi.enableTwoFactor();
      if (response.success) {
        return response.data;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const disableTwoFactor = async (code: string) => {
    try {
      const response = await settingsApi.disableTwoFactor({ code });
      if (response.success) {
        await fetchSettings();
        return true;
      }
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  return { 
    settings, 
    loading, 
    error, 
    updating,
    refetch: fetchSettings, 
    updateSettings,
    enableTwoFactor,
    disableTwoFactor
  };
};
