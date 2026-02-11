/**
 * Settings Data Hook - aligned with backend /settings endpoints
 * Backend returns flat fields: { notifications: {email_notifications, push_notifications, ...}, privacy: {...}, ... }
 * Update endpoints accept flat field objects and return success without nested data
 */

import { useState, useEffect, useCallback } from "react";
import { settingsApi } from "@/lib/api/settings";

// Module-level cache for settings
let _settingsCache: any = null;
let _settingsHasLoaded = false;

export const useSettings = () => {
  const [settings, setSettings] = useState<any>(_settingsCache);
  const [loading, setLoading] = useState(!_settingsHasLoaded);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!_settingsHasLoaded) setLoading(true);
    setError(null);
    try {
      const response = await settingsApi.getSettings();
      if (response.success && response.data) {
        _settingsCache = response.data;
        _settingsHasLoaded = true;
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

  const updateNotifications = async (data: Record<string, any>) => {
    setUpdating(true);
    try {
      const response = await settingsApi.updateNotifications(data as any);
      if (response.success) {
        // Optimistically merge the update into local state
        setSettings((prev: any) => prev ? {
          ...prev,
          notifications: { ...prev.notifications, ...data }
        } : prev);
        return response.data;
      }
      throw new Error(response.message || 'Failed to update');
    } finally {
      setUpdating(false);
    }
  };

  const updatePrivacy = async (data: Record<string, any>) => {
    setUpdating(true);
    try {
      const response = await settingsApi.updatePrivacy(data as any);
      if (response.success) {
        setSettings((prev: any) => prev ? {
          ...prev,
          privacy: { ...prev.privacy, ...data }
        } : prev);
        return response.data;
      }
      throw new Error(response.message || 'Failed to update');
    } finally {
      setUpdating(false);
    }
  };

  const updatePreferences = async (data: Record<string, any>) => {
    setUpdating(true);
    try {
      const response = await settingsApi.updatePreferences(data as any);
      if (response.success) {
        setSettings((prev: any) => prev ? {
          ...prev,
          preferences: { ...prev.preferences, ...data }
        } : prev);
        return response.data;
      }
      throw new Error(response.message || 'Failed to update');
    } finally {
      setUpdating(false);
    }
  };

  const enableTwoFactor = async () => {
    const response = await settingsApi.enableTwoFactor();
    if (response.success) return response.data;
    throw new Error(response.message || 'Failed');
  };

  const disableTwoFactor = async (code: string, password: string) => {
    const response = await settingsApi.disableTwoFactor({ code, password });
    if (response.success) {
      await fetchSettings();
      return true;
    }
    throw new Error(response.message || 'Failed');
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
