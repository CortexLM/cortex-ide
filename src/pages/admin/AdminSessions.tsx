import { JSX, createSignal, createEffect, onMount } from "solid-js";
import { SessionFilters } from "@/components/admin/SessionFilters";
import { SessionsTable } from "@/components/admin/SessionsTable";
import { BulkActions } from "@/components/admin/BulkActions";
import { Pagination } from "@/components/admin/Pagination";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import {
  fetchAdminSessions,
  fetchSessionStats,
  bulkAction,
  exportSessions,
} from "@/api/admin";
import type {
  AdminSession,
  SessionFilters as SessionFiltersType,
  SessionStats,
  AdminSessionsResponse,
} from "@/types/admin";

/**
 * Admin page for managing sessions
 * Route: /admin/sessions
 */
export default function AdminSessionsPage() {
  const [filters, setFilters] = createSignal<SessionFiltersType>({
    search: "",
    dateRange: "all",
    status: "all",
    page: 1,
    pageSize: 20,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const [data, setData] = createSignal<AdminSessionsResponse | null>(null);
  const [stats, setStats] = createSignal<SessionStats | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [selectedIds, setSelectedIds] = createSignal<string[]>([]);
  const [error, setError] = createSignal<string | null>(null);

  // Fetch sessions when filters change
  createEffect(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchAdminSessions(filters());
      setData(result);
      // Clear selection when data changes
      setSelectedIds([]);
    } catch (e) {
      const err = e as Error;
      setError(err.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  });

  // Fetch stats on mount
  onMount(async () => {
    try {
      const statsData = await fetchSessionStats();
      setStats(statsData);
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    }
  });

  const handleSelect = (id: string, selected: boolean) => {
    if (selected) {
      setSelectedIds([...selectedIds(), id]);
    } else {
      setSelectedIds(selectedIds().filter((i) => i !== id));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected && data()) {
      setSelectedIds(data()!.sessions.map((s) => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleDelete = async () => {
    try {
      await bulkAction(selectedIds(), "delete");
      // Refresh data
      const result = await fetchAdminSessions(filters());
      setData(result);
      setSelectedIds([]);
    } catch (e) {
      console.error("Failed to delete sessions:", e);
    }
  };

  const handleArchive = async () => {
    try {
      await bulkAction(selectedIds(), "archive");
      const result = await fetchAdminSessions(filters());
      setData(result);
      setSelectedIds([]);
    } catch (e) {
      console.error("Failed to archive sessions:", e);
    }
  };

  const handleRestore = async () => {
    try {
      await bulkAction(selectedIds(), "restore");
      const result = await fetchAdminSessions(filters());
      setData(result);
      setSelectedIds([]);
    } catch (e) {
      console.error("Failed to restore sessions:", e);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportSessions(selectedIds());
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sessions-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to export sessions:", e);
    }
  };

  const handlePageChange = (page: number) => {
    setFilters({ ...filters(), page });
  };

  const handleViewSession = (session: AdminSession) => {
    // Navigate to session detail view
    window.location.href = `/admin/sessions/${session.id}`;
  };

  const containerStyle: JSX.CSSProperties = {
    padding: "24px",
    "max-width": "1400px",
    margin: "0 auto",
  };

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "justify-content": "space-between",
    "align-items": "center",
    "margin-bottom": "24px",
  };

  const titleStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "24px",
    "font-weight": "600",
    color: "var(--text-title)",
    margin: "0",
  };

  const statsGridStyle: JSX.CSSProperties = {
    display: "grid",
    "grid-template-columns": "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    "margin-bottom": "24px",
  };

  const statCardStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "4px",
  };

  const statLabelStyle: JSX.CSSProperties = {
    "font-size": "12px",
    color: "var(--text-muted)",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
  };

  const statValueStyle: JSX.CSSProperties = {
    "font-size": "24px",
    "font-weight": "600",
    color: "var(--text-title)",
  };

  const errorStyle: JSX.CSSProperties = {
    padding: "16px",
    background: "color-mix(in srgb, var(--state-error) 10%, transparent)",
    "border-radius": "var(--jb-radius-lg)",
    color: "var(--state-error)",
    "margin-bottom": "16px",
    display: "flex",
    "align-items": "center",
    gap: "8px",
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined) return "-";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Sessions Management</h1>
      </div>

      {/* Stats Cards */}
      {stats() && (
        <div style={statsGridStyle}>
          <Card padding="md">
            <div style={statCardStyle}>
              <span style={statLabelStyle}>Total Sessions</span>
              <span style={statValueStyle}>{formatNumber(stats()!.totalSessions)}</span>
            </div>
          </Card>
          <Card padding="md">
            <div style={statCardStyle}>
              <span style={statLabelStyle}>Active Sessions</span>
              <span style={statValueStyle}>{formatNumber(stats()!.activeSessions)}</span>
            </div>
          </Card>
          <Card padding="md">
            <div style={statCardStyle}>
              <span style={statLabelStyle}>Total Messages</span>
              <span style={statValueStyle}>{formatNumber(stats()!.totalMessages)}</span>
            </div>
          </Card>
          <Card padding="md">
            <div style={statCardStyle}>
              <span style={statLabelStyle}>Total Tokens</span>
              <span style={statValueStyle}>{formatNumber(stats()!.totalTokens)}</span>
            </div>
          </Card>
          <Card padding="md">
            <div style={statCardStyle}>
              <span style={statLabelStyle}>Sessions Today</span>
              <span style={statValueStyle}>{formatNumber(stats()!.sessionsToday)}</span>
            </div>
          </Card>
        </div>
      )}

      {/* Error message */}
      {error() && (
        <div style={errorStyle}>
          <Icon name="triangle-exclamation" size={16} />
          <span>{error()}</span>
        </div>
      )}

      {/* Filters */}
      <SessionFilters filters={filters()} onChange={setFilters} />

      {/* Sessions Table */}
      <SessionsTable
        sessions={data()?.sessions || []}
        loading={loading()}
        selectedIds={selectedIds()}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        onViewSession={handleViewSession}
      />

      {/* Bulk Actions */}
      <BulkActions
        selectedIds={selectedIds()}
        onDelete={handleDelete}
        onArchive={handleArchive}
        onRestore={filters().status === "archived" ? handleRestore : undefined}
        onExport={handleExport}
      />

      {/* Pagination */}
      <Pagination
        total={data()?.total || 0}
        page={filters().page}
        pageSize={filters().pageSize}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
