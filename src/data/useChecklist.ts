/**
 * Event Checklist Data Hook
 */

import { useState, useCallback, useEffect } from "react";
import { eventsApi } from "@/lib/api/events";
import { templatesApi } from "@/lib/api/templates";
import type { ChecklistItem, EventTemplate } from "@/lib/api/templates";
import { throwApiError } from "@/lib/api/showApiErrors";

export const useEventChecklist = (eventId: string | null) => {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [summary, setSummary] = useState<{
    total: number; completed: number; in_progress: number; pending: number; progress_percentage: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChecklist = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await eventsApi.getChecklist(eventId);
      if (response.success) {
        setItems(response.data.items);
        setSummary(response.data.summary);
      } else {
        setError(response.message || "Failed to fetch checklist");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) fetchChecklist();
  }, [fetchChecklist, eventId]);

  const addItem = async (data: Partial<ChecklistItem>) => {
    if (!eventId) return null;
    const response = await eventsApi.addChecklistItem(eventId, data);
    if (response.success) {
      await fetchChecklist();
      return response.data;
    }
    throwApiError(response);
  };

  const updateItem = async (itemId: string, data: Partial<ChecklistItem>) => {
    if (!eventId) return null;
    const response = await eventsApi.updateChecklistItem(eventId, itemId, data);
    if (response.success) {
      await fetchChecklist();
      return response.data;
    }
    throwApiError(response);
  };

  const deleteItem = async (itemId: string) => {
    if (!eventId) return;
    const response = await eventsApi.deleteChecklistItem(eventId, itemId);
    if (response.success) {
      await fetchChecklist();
    } else {
      throwApiError(response);
    }
  };

  const applyTemplate = async (templateId: string, clearExisting = false) => {
    if (!eventId) return null;
    const response = await eventsApi.applyTemplate(eventId, { template_id: templateId, clear_existing: clearExisting });
    if (response.success) {
      await fetchChecklist();
      return response.data;
    }
    throwApiError(response);
  };

  return { items, summary, loading, error, refetch: fetchChecklist, addItem, updateItem, deleteItem, applyTemplate };
};

export const useEventTemplates = (eventTypeId?: string) => {
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await templatesApi.getAll(eventTypeId);
      if (response.success) {
        setTemplates(response.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [eventTypeId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return { templates, loading, refetch: fetchTemplates };
};
