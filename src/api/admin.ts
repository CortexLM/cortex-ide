/**
 * API functions for admin panel
 */

import type {
  AdminSession,
  AdminSessionsResponse,
  SessionFilters,
  SessionStats,
  BulkAction,
} from "@/types/admin";

const API_BASE = "/api/v1/admin";

/**
 * Fetch paginated sessions for admin view
 */
export async function fetchAdminSessions(
  filters: SessionFilters
): Promise<AdminSessionsResponse> {
  const params = new URLSearchParams();
  
  if (filters.search) params.set("search", filters.search);
  if (filters.dateRange !== "all") params.set("dateRange", filters.dateRange);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  params.set("page", filters.page.toString());
  params.set("pageSize", filters.pageSize.toString());
  params.set("sortBy", filters.sortBy);
  params.set("sortOrder", filters.sortOrder);
  
  const response = await fetch(`${API_BASE}/sessions?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch sessions");
  }
  
  return response.json();
}

/**
 * Get session statistics
 */
export async function fetchSessionStats(): Promise<SessionStats> {
  const response = await fetch(`${API_BASE}/sessions/stats`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch statistics");
  }
  
  return response.json();
}

/**
 * Delete a single session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: "DELETE",
  });
  
  if (!response.ok) {
    throw new Error("Failed to delete session");
  }
}

/**
 * Archive a single session
 */
export async function archiveSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/archive`, {
    method: "POST",
  });
  
  if (!response.ok) {
    throw new Error("Failed to archive session");
  }
}

/**
 * Restore a single session from archive
 */
export async function restoreSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/restore`, {
    method: "POST",
  });
  
  if (!response.ok) {
    throw new Error("Failed to restore session");
  }
}

/**
 * Perform bulk action on sessions
 */
export async function bulkAction(
  sessionIds: string[],
  action: BulkAction
): Promise<{ success: number; failed: number }> {
  const response = await fetch(`${API_BASE}/sessions/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionIds, action }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to ${action} sessions`);
  }
  
  return response.json();
}

/**
 * Export sessions to CSV
 */
export async function exportSessions(
  sessionIds: string[]
): Promise<Blob> {
  const response = await fetch(`${API_BASE}/sessions/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionIds }),
  });
  
  if (!response.ok) {
    throw new Error("Failed to export sessions");
  }
  
  return response.blob();
}

/**
 * Get session details for admin view
 */
export async function fetchSessionDetails(
  sessionId: string
): Promise<AdminSession & { messages: unknown[] }> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch session details");
  }
  
  return response.json();
}
