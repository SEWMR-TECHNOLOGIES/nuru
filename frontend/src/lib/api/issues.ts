/**
 * Issues API - Issue reporting endpoints
 */

import { get, post, put, buildQueryString } from "./helpers";

export interface IssueCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  display_order: number;
}

export interface IssueResponse {
  id: string;
  message: string;
  is_admin: boolean;
  admin_name?: string;
  attachments: any[];
  created_at: string;
}

export interface Issue {
  id: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  category: { id: string; name: string; icon: string } | null;
  screenshot_urls: string[];
  response_count: number;
  last_response_at?: string;
  last_response_is_admin?: boolean;
  responses?: IssueResponse[];
  created_at: string;
  updated_at: string;
}

export interface IssueSummary {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
}

export const issuesApi = {
  // Issue Categories
  getCategories: () => get<IssueCategory[]>("/issues/categories"),

  // My Issues
  getMyIssues: (params?: { page?: number; limit?: number; status?: string }) =>
    get<any>(`/issues/${buildQueryString(params)}`),

  // Issue Detail
  getIssue: (issueId: string) => get<Issue>(`/issues/${issueId}`),

  // Submit Issue
  createIssue: (data: {
    category_id: string;
    subject: string;
    description: string;
    priority?: string;
    screenshot_urls?: string[];
  }) => post<{ id: string; subject: string; status: string }>("/issues/", data),

  // Reply to Issue
  replyToIssue: (issueId: string, data: { message: string }) =>
    post<{ id: string }>(`/issues/${issueId}/reply`, data),

  // Close Issue
  closeIssue: (issueId: string) => put<any>(`/issues/${issueId}/close`),
};
