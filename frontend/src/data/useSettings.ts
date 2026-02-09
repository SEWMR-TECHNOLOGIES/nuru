/**
 * Settings Data Hook - aligned with nuru-api-doc MODULE 19
 * Response format: { success, data: { notifications: {...}, privacy: {...}, ... } }
 * Update responses: { success, data: { notifications: {...}, updated_at } }
 */

import { useState, useEffect, useCallback } from "react";
import { settingsApi, AllSettings } from "@/lib/api/settings";
import { throwApiError } from "@/lib/api/showApiErrors";

export const useSettings = () => {
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await settingsApi.getSettings();
      if (response.success && response.data) {
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

  const updateNotifications = async (data: any) => {
    setUpdating(true);
    try {
      const response = await settingsApi.updateNotifications(data);
      if (response.success && response.data) {
        // API returns { notifications: {...}, updated_at } in data
        const updatedNotifications = response.data.notifications;
        if (updatedNotifications) {
          setSettings(prev => prev ? { ...prev, notifications: updatedNotifications } : prev);
        }
        return response.data;
      }
      throwApiError(response);
    } finally {
      setUpdating(false);
    }
  };

  const updatePrivacy = async (data: any) => {
    setUpdating(true);
    try {
      const response = await settingsApi.updatePrivacy(data);
      if (response.success && response.data) {
        // API returns { privacy: {...}, updated_at } in data
        const updatedPrivacy = response.data.privacy;
        if (updatedPrivacy) {
          setSettings(prev => prev ? { ...prev, privacy: updatedPrivacy } : prev);
        }
        return response.data;
      }
      throwApiError(response);
    } finally {
      setUpdating(false);
    }
  };

  const updatePreferences = async (data: any) => {
    setUpdating(true);
    try {
      const response = await settingsApi.updatePreferences(data);
      if (response.success && response.data) {
        // API returns { preferences: {...}, updated_at } in data
        const updatedPreferences = response.data.preferences;
        if (updatedPreferences) {
          setSettings(prev => prev ? { ...prev, preferences: updatedPreferences } : prev);
        }
        return response.data;
      }
      throwApiError(response);
    } finally {
      setUpdating(false);
    }
  };

  const enableTwoFactor = async () => {
    try {
      const response = await settingsApi.enableTwoFactor();
      if (response.success) return response.data;
      throwApiError(response);
    } catch (err) {
      throw err;
    }
  };

  const disableTwoFactor = async (code: string, password: string) => {
    try {
      const response = await settingsApi.disableTwoFactor({ code, password });
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
    updateNotifications,
    updatePrivacy,
    updatePreferences,
    enableTwoFactor,
    disableTwoFactor
  };
};
