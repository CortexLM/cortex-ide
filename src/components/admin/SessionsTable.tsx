import { JSX, For, Show } from "solid-js";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { AdminSession, SessionStatus } from "@/types/admin";

interface SessionsTableProps {
  sessions: AdminSession[];
  loading: boolean;
  selectedIds: string[];
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onViewSession?: (session: AdminSession) => void;
}

export function SessionsTable(props: SessionsTableProps) {
  const allSelected = () =>
    props.sessions.length > 0 &&
    props.sessions.every((s) => props.selectedIds.includes(s.id));

  const someSelected = () =>
    props.selectedIds.length > 0 && !allSelected();

  const tableStyle: JSX.CSSProperties = {
    width: "100%",
    "border-collapse": "collapse",
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
  };

  const thStyle: JSX.CSSProperties = {
    "text-align": "left",
    padding: "12px 16px",
    "font-weight": "500",
    color: "var(--text-muted)",
    "border-bottom": "1px solid var(--border-default)",
    background: "var(--surface-card)",
    position: "sticky",
    top: "0",
    "z-index": "1",
  };

  const tdStyle: JSX.CSSProperties = {
    padding: "12px 16px",
    "border-bottom": "1px solid var(--border-weak)",
    color: "var(--text-primary)",
  };

  const checkboxStyle: JSX.CSSProperties = {
    width: "16px",
    height: "16px",
    cursor: "pointer",
    "accent-color": "var(--accent-primary)",
  };

  const rowStyle = (selected: boolean): JSX.CSSProperties => ({
    background: selected ? "var(--surface-hover)" : "transparent",
    transition: "background 150ms ease",
    cursor: "pointer",
  });

  const truncateStyle: JSX.CSSProperties = {
    "max-width": "200px",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  };

  const loadingRowStyle: JSX.CSSProperties = {
    "text-align": "center",
    padding: "40px 16px",
    color: "var(--text-muted)",
  };

  const emptyRowStyle: JSX.CSSProperties = {
    "text-align": "center",
    padding: "40px 16px",
    color: "var(--text-weaker)",
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const statusVariant = (status: SessionStatus) => {
    switch (status) {
      case "active":
        return "success";
      case "completed":
        return "default";
      case "archived":
        return "warning";
      case "deleted":
        return "error";
      default:
        return "default";
    }
  };

  return (
    <div style={{ overflow: "auto", "max-height": "calc(100vh - 400px)", "border-radius": "var(--jb-radius-lg)", border: "1px solid var(--border-default)" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: "40px" }}>
              <input
                type="checkbox"
                style={checkboxStyle}
                checked={allSelected()}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected();
                }}
                onChange={(e) => props.onSelectAll(e.currentTarget.checked)}
              />
            </th>
            <th style={thStyle}>Title</th>
            <th style={thStyle}>User</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Messages</th>
            <th style={thStyle}>Tokens</th>
            <th style={thStyle}>Model</th>
            <th style={thStyle}>Created</th>
            <th style={thStyle}>Last Activity</th>
            <th style={{ ...thStyle, width: "60px" }}>Shared</th>
          </tr>
        </thead>
        <tbody>
          <Show when={props.loading}>
            <tr>
              <td colspan="10" style={loadingRowStyle}>
                <Icon name="spinner" size={20} class="animate-spin" style={{ "margin-right": "8px" }} />
                Loading sessions...
              </td>
            </tr>
          </Show>

          <Show when={!props.loading && props.sessions.length === 0}>
            <tr>
              <td colspan="10" style={emptyRowStyle}>
                No sessions found matching your criteria.
              </td>
            </tr>
          </Show>

          <Show when={!props.loading && props.sessions.length > 0}>
            <For each={props.sessions}>
              {(session) => {
                const isSelected = () => props.selectedIds.includes(session.id);

                return (
                  <tr
                    style={rowStyle(isSelected())}
                    onMouseEnter={(e) => {
                      if (!isSelected()) {
                        e.currentTarget.style.background = "var(--surface-hover)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected()) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                    onClick={() => props.onViewSession?.(session)}
                  >
                    <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        style={checkboxStyle}
                        checked={isSelected()}
                        onChange={(e) => props.onSelect(session.id, e.currentTarget.checked)}
                      />
                    </td>
                    <td style={{ ...tdStyle, ...truncateStyle }} title={session.title}>
                      {session.title || "Untitled Session"}
                    </td>
                    <td style={{ ...tdStyle, ...truncateStyle }} title={session.userEmail}>
                      {session.userEmail || session.userId}
                    </td>
                    <td style={tdStyle}>
                      <Badge variant={statusVariant(session.status)} size="sm">
                        {session.status}
                      </Badge>
                    </td>
                    <td style={tdStyle}>{formatNumber(session.messageCount)}</td>
                    <td style={tdStyle}>{formatNumber(session.totalTokens)}</td>
                    <td style={{ ...tdStyle, "font-size": "12px" }}>{session.model}</td>
                    <td style={{ ...tdStyle, "font-size": "12px" }}>{formatDate(session.createdAt)}</td>
                    <td style={{ ...tdStyle, "font-size": "12px" }}>{formatDate(session.lastActivityAt)}</td>
                    <td style={{ ...tdStyle, "text-align": "center" }}>
                      <Show when={session.isShared}>
                        <Icon name="link" size={14} style={{ color: "var(--accent-primary)" }} />
                      </Show>
                    </td>
                  </tr>
                );
              }}
            </For>
          </Show>
        </tbody>
      </table>
    </div>
  );
}
