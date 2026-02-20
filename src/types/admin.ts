/**
 * Types for admin panel functionality
 */

/** Session status */
export type SessionStatus = "active" | "completed" | "archived" | "deleted";

/** Admin session view */
export interface AdminSession {
  id: string;
  userId: string;
  userEmail?: string;
  title: string;
  status: SessionStatus;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  model: string;
  totalTokens: number;
  isShared: boolean;
  shareToken?: string;
}

/** Filters for admin sessions list */
export interface SessionFilters {
  search: string;
  dateRange: "all" | "today" | "week" | "month" | "custom";
  status: SessionStatus | "all";
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
  sortBy: "createdAt" | "updatedAt" | "messageCount" | "totalTokens";
  sortOrder: "asc" | "desc";
}

/** Paginated sessions response */
export interface AdminSessionsResponse {
  sessions: AdminSession[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Bulk action type */
export type BulkAction = "delete" | "archive" | "restore" | "export";

/** Session statistics */
export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  totalTokens: number;
  averageMessagesPerSession: number;
  sessionsToday: number;
  sessionsThisWeek: number;
}
