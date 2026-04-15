/**
 * Templates API - Event template browsing
 */

import { get } from "./helpers";

export interface EventTemplateTask {
  id: string;
  title: string;
  description?: string;
  category?: string;
  priority: "high" | "medium" | "low";
  days_before_event?: number;
  display_order: number;
}

export interface EventTemplate {
  id: string;
  event_type_id: string;
  name: string;
  description?: string;
  estimated_budget_min?: number;
  estimated_budget_max?: number;
  estimated_timeline_days?: number;
  guest_range_min?: number;
  guest_range_max?: number;
  tips?: string[];
  task_count: number;
  tasks: EventTemplateTask[];
  display_order: number;
}

export interface ChecklistItem {
  id: string;
  event_id: string;
  template_task_id?: string;
  title: string;
  description?: string;
  category?: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed" | "skipped";
  due_date?: string;
  completed_at?: string;
  assigned_to?: string;
  assigned_name?: string;
  assigned_avatar?: string;
  notes?: string;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export const templatesApi = {
  /**
   * List available templates, optionally filtered by event type
   */
  getAll: (eventTypeId?: string) =>
    get<EventTemplate[]>(`/templates${eventTypeId ? `?event_type_id=${eventTypeId}` : ''}`),

  /**
   * Get a single template with tasks
   */
  getById: (templateId: string) =>
    get<EventTemplate>(`/templates/${templateId}`),
};
