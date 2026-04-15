/**
 * Event Checklist Data Hook
 * Uses initialLoad pattern to prevent skeleton re-renders on background refetch.
 */

import { useState, useCallback, useEffect } from "react";
import { eventsApi } from "@/lib/api/events";
import { templatesApi } from "@/lib/api/templates";
import type { ChecklistItem, EventTemplate } from "@/lib/api/templates";
import { throwApiError } from "@/lib/api/showApiErrors";

const _checklistCache = new Map<string, { items: ChecklistItem[]; summary: any }>();

export const useEventChecklist = (eventId: string | null) => {
  const cached = eventId ? _checklistCache.get(eventId) : null;
  const [items, setItems] = useState<ChecklistItem[]>(cached?.items || []);
  const [summary, setSummary] = useState<{
    total: number; completed: number; in_progress: number; pending: number; progress_percentage: number;
  } | null>(cached?.summary || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const fetchChecklist = useCallback(async () => {
    if (!eventId) return;
    if (!_checklistCache.has(eventId)) setLoading(true);
    setError(null);
    try {
      const response = await eventsApi.getChecklist(eventId);
      if (response.success) {
        _checklistCache.set(eventId, { items: response.data.items, summary: response.data.summary });
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

let _templatesCache: EventTemplate[] = [];
let _templatesHasLoaded = false;

export const useEventTemplates = (eventTypeId?: string) => {
  const [templates, setTemplates] = useState<EventTemplate[]>(_templatesCache);
  const [loading, setLoading] = useState(!_templatesHasLoaded);

  const fetchTemplates = useCallback(async () => {
    if (!_templatesHasLoaded) setLoading(true);
    try {
      const response = await templatesApi.getAll(eventTypeId);
      if (response.success) {
        _templatesCache = response.data;
        _templatesHasLoaded = true;
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
