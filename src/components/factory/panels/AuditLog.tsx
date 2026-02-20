/**
 * =============================================================================
 * AUDIT LOG - Audit History Panel
 * =============================================================================
 * 
 * A comprehensive audit log panel for tracking agent actions and supervisor
 * decisions in the Agent Factory. Provides a filterable, sortable table view
 * with detailed entry inspection and export capabilities.
 * 
 * Features:
 * - Table view with sortable columns
 * - Filter by agent, action type, decision, risk level
 * - Date range filtering
 * - Pagination
 * - Detail modal for full audit entry
 * - Export to JSON/CSV
 * 
 * =============================================================================
 */

import {
  createSignal,
  createMemo,
  For,
  Show,
  JSX,
} from "solid-js";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import { Modal } from "../../ui/Modal";
import { EmptyState } from "../../ui/EmptyState";

// =============================================================================
// TYPES
// =============================================================================

export type AuditDecision = "approved" | "denied" | "modified" | "auto_approved" | "escalated";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ActionType = "file_read" | "file_write" | "file_delete" | "shell_execute" | "api_call" | "code_change" | "git_operation" | "other";

export interface AuditEntry {
  id: string;
  timestamp: Date;
  agentId: string;
  agentName: string;
  action: ActionType;
  actionDetail: string;
  decision: AuditDecision;
  reason: string;
  riskLevel: RiskLevel;
  supervisorId?: string;
  supervisorName?: string;
  modifiedAction?: string;
  context?: Record<string, unknown>;
  duration?: number;
}

export interface AuditLogProps {
  /** Audit entries to display */
  entries?: AuditEntry[];
  /** Callback when export is requested */
  onExport?: (format: "json" | "csv") => void;
  /** Page size for pagination */
  pageSize?: number;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DECISION_CONFIG: Record<AuditDecision, { label: string; variant: "default" | "accent" | "success" | "warning" | "error" }> = {
  approved: { label: "Approved", variant: "success" },
  denied: { label: "Denied", variant: "error" },
  modified: { label: "Modified", variant: "warning" },
  auto_approved: { label: "Auto", variant: "default" },
  escalated: { label: "Escalated", variant: "accent" },
};

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; variant: "default" | "accent" | "success" | "warning" | "error" }> = {
  low: { label: "Low", color: "var(--cortex-success)", variant: "success" },
  medium: { label: "Medium", color: "var(--cortex-warning)", variant: "warning" },
  high: { label: "High", color: "var(--cortex-warning)", variant: "warning" },
  critical: { label: "Critical", color: "var(--cortex-error)", variant: "error" },
};

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  file_read: "File Read",
  file_write: "File Write",
  file_delete: "File Delete",
  shell_execute: "Shell Execute",
  api_call: "API Call",
  code_change: "Code Change",
  git_operation: "Git Operation",
  other: "Other",
};

type SortField = "timestamp" | "agent" | "action" | "decision" | "risk";
type SortOrder = "asc" | "desc";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatShortId(id: string): string {
  return id.slice(0, 8);
}

// =============================================================================
// TABLE HEADER COMPONENT
// =============================================================================

interface TableHeaderCellProps {
  label: string;
  sortable?: boolean;
  field?: SortField;
  currentSort?: SortField;
  sortOrder?: SortOrder;
  onSort?: (field: SortField) => void;
  width?: string;
}

function TableHeaderCell(props: TableHeaderCellProps) {
  const isActive = () => props.currentSort === props.field;

  const style: JSX.CSSProperties = {
    padding: "8px 12px",
    "font-size": "11px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: "var(--jb-text-header-color)",
    background: "var(--jb-surface-panel)",
    "border-bottom": "1px solid var(--jb-border-default)",
    "text-align": "left",
    cursor: props.sortable ? "pointer" : "default",
    "user-select": "none",
    "white-space": "nowrap",
    width: props.width,
    position: "sticky",
    top: "0",
    "z-index": "1",
  };

  const handleClick = () => {
    if (props.sortable && props.field && props.onSort) {
      props.onSort(props.field);
    }
  };

  return (
    <th
      style={style}
      onClick={handleClick}
      onMouseEnter={(e) => {
        if (props.sortable) {
          e.currentTarget.style.background = "var(--jb-surface-hover)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--jb-surface-panel)";
      }}
    >
      <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
        <span>{props.label}</span>
        <Show when={props.sortable}>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="currentColor"
            style={{
              opacity: isActive() ? "1" : "0.3",
              transform: isActive() && props.sortOrder === "asc" ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform var(--cortex-transition-fast)",
            }}
          >
            <path d="M5 7L1 3h8L5 7z" />
          </svg>
        </Show>
      </div>
    </th>
  );
}

// =============================================================================
// TABLE ROW COMPONENT
// =============================================================================

interface AuditRowProps {
  entry: AuditEntry;
  onClick?: () => void;
}

function AuditRow(props: AuditRowProps) {
  const [isHovered, setIsHovered] = createSignal(false);

  const cellStyle: JSX.CSSProperties = {
    padding: "10px 12px",
    "font-size": "12px",
    color: "var(--jb-text-body-color)",
    "border-bottom": "1px solid var(--jb-border-divider)",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "max-width": "200px",
  };

  const rowStyle = (): JSX.CSSProperties => ({
    background: isHovered() ? "var(--jb-surface-hover)" : "transparent",
    cursor: "pointer",
    transition: "background var(--cortex-transition-fast)",
  });

  return (
    <tr
      style={rowStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={props.onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onClick?.();
        }
      }}
      tabIndex={0}
      role="button"
    >
      <td style={{ ...cellStyle, "font-family": "var(--jb-font-mono)", "font-size": "11px", color: "var(--jb-text-muted-color)" }}>
        {formatShortId(props.entry.id)}
      </td>
      <td style={{ ...cellStyle, "font-size": "11px" }}>
        {formatTimestamp(props.entry.timestamp)}
      </td>
      <td style={cellStyle}>
        {props.entry.agentName}
      </td>
      <td style={cellStyle}>
        <Badge variant="default" size="sm">
          {ACTION_TYPE_LABELS[props.entry.action]}
        </Badge>
      </td>
      <td style={cellStyle}>
        <Badge variant={DECISION_CONFIG[props.entry.decision].variant} size="sm">
          {DECISION_CONFIG[props.entry.decision].label}
        </Badge>
      </td>
      <td style={cellStyle}>
        <Badge variant={RISK_CONFIG[props.entry.riskLevel].variant} size="sm">
          {RISK_CONFIG[props.entry.riskLevel].label}
        </Badge>
      </td>
      <td style={{ ...cellStyle, "max-width": "250px" }} title={props.entry.reason}>
        {props.entry.reason}
      </td>
    </tr>
  );
}

// =============================================================================
// DETAIL MODAL COMPONENT
// =============================================================================

interface DetailModalProps {
  entry: AuditEntry | null;
  open: boolean;
  onClose: () => void;
}

function DetailModal(props: DetailModalProps) {
  if (!props.entry) return null;

  const sectionStyle: JSX.CSSProperties = {
    "margin-bottom": "16px",
  };

  const labelStyle: JSX.CSSProperties = {
    "font-size": "11px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: "var(--jb-text-header-color)",
    "margin-bottom": "6px",
  };

  const valueStyle: JSX.CSSProperties = {
    "font-size": "13px",
    color: "var(--jb-text-body-color)",
  };

  const codeStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-mono)",
    "font-size": "12px",
    background: "var(--jb-canvas)",
    padding: "8px 12px",
    "border-radius": "var(--jb-radius-sm)",
    "white-space": "pre-wrap",
    "word-break": "break-all",
    "max-height": "200px",
    overflow: "auto",
  };

  const rowStyle: JSX.CSSProperties = {
    display: "grid",
    "grid-template-columns": "1fr 1fr",
    gap: "16px",
    "margin-bottom": "16px",
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Audit Entry Details"
      size="lg"
    >
      <div>
        {/* Header Info */}
        <div style={rowStyle}>
          <div>
            <div style={labelStyle}>Entry ID</div>
            <div style={{ ...valueStyle, "font-family": "var(--jb-font-mono)", "font-size": "12px" }}>
              {props.entry.id}
            </div>
          </div>
          <div>
            <div style={labelStyle}>Timestamp</div>
            <div style={valueStyle}>
              {props.entry.timestamp.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Agent Info */}
        <div style={rowStyle}>
          <div>
            <div style={labelStyle}>Agent</div>
            <div style={valueStyle}>
              {props.entry.agentName}
              <span style={{ color: "var(--jb-text-muted-color)", "font-size": "11px", "margin-left": "8px" }}>
                ({props.entry.agentId})
              </span>
            </div>
          </div>
          <div>
            <div style={labelStyle}>Supervisor</div>
            <div style={valueStyle}>
              {props.entry.supervisorName || "—"}
            </div>
          </div>
        </div>

        {/* Action Info */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Action</div>
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <Badge variant="default">{ACTION_TYPE_LABELS[props.entry.action]}</Badge>
            <span style={valueStyle}>{props.entry.actionDetail}</span>
          </div>
        </div>

        {/* Decision */}
        <div style={rowStyle}>
          <div>
            <div style={labelStyle}>Decision</div>
            <Badge variant={DECISION_CONFIG[props.entry.decision].variant}>
              {DECISION_CONFIG[props.entry.decision].label}
            </Badge>
          </div>
          <div>
            <div style={labelStyle}>Risk Level</div>
            <Badge variant={RISK_CONFIG[props.entry.riskLevel].variant}>
              {RISK_CONFIG[props.entry.riskLevel].label}
            </Badge>
          </div>
        </div>

        {/* Reason */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Reason</div>
          <div style={valueStyle}>{props.entry.reason}</div>
        </div>

        {/* Modified Action */}
        <Show when={props.entry.modifiedAction}>
          <div style={sectionStyle}>
            <div style={labelStyle}>Modified Action</div>
            <div style={codeStyle}>{props.entry.modifiedAction}</div>
          </div>
        </Show>

        {/* Context */}
        <Show when={props.entry.context}>
          <div style={sectionStyle}>
            <div style={labelStyle}>Context</div>
            <div style={codeStyle}>
              {JSON.stringify(props.entry.context, null, 2)}
            </div>
          </div>
        </Show>

        {/* Duration */}
        <Show when={props.entry.duration !== undefined}>
          <div style={sectionStyle}>
            <div style={labelStyle}>Duration</div>
            <div style={valueStyle}>{props.entry.duration}ms</div>
          </div>
        </Show>
      </div>
    </Modal>
  );
}

// =============================================================================
// AUDIT LOG COMPONENT
// =============================================================================

export function AuditLog(props: AuditLogProps) {
  const pageSize = () => props.pageSize || 20;

  // State
  const [searchQuery, setSearchQuery] = createSignal("");
  const [agentFilter, setAgentFilter] = createSignal("all");
  const [actionFilter, setActionFilter] = createSignal("all");
  const [decisionFilter, setDecisionFilter] = createSignal("all");
  const [riskFilter, setRiskFilter] = createSignal("all");
  const [sortField, setSortField] = createSignal<SortField>("timestamp");
  const [sortOrder, setSortOrder] = createSignal<SortOrder>("desc");
  const [currentPage, setCurrentPage] = createSignal(1);
  const [selectedEntry, setSelectedEntry] = createSignal<AuditEntry | null>(null);

  // Derived state
  const entries = () => props.entries || [];

  const agents = createMemo(() => {
    const agentMap = new Map<string, string>();
    for (const entry of entries()) {
      agentMap.set(entry.agentId, entry.agentName);
    }
    return Array.from(agentMap.entries()).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  });

  const filteredEntries = createMemo(() => {
    let result = entries();
    const query = searchQuery().toLowerCase().trim();

    // Search filter
    if (query) {
      result = result.filter(
        (e) =>
          e.agentName.toLowerCase().includes(query) ||
          e.actionDetail.toLowerCase().includes(query) ||
          e.reason.toLowerCase().includes(query) ||
          e.id.toLowerCase().includes(query)
      );
    }

    // Agent filter
    if (agentFilter() !== "all") {
      result = result.filter((e) => e.agentId === agentFilter());
    }

    // Action filter
    if (actionFilter() !== "all") {
      result = result.filter((e) => e.action === actionFilter());
    }

    // Decision filter
    if (decisionFilter() !== "all") {
      result = result.filter((e) => e.decision === decisionFilter());
    }

    // Risk filter
    if (riskFilter() !== "all") {
      result = result.filter((e) => e.riskLevel === riskFilter());
    }

    return result;
  });

  const sortedEntries = createMemo(() => {
    const result = [...filteredEntries()];
    const field = sortField();
    const order = sortOrder();

    result.sort((a, b) => {
      let comparison = 0;
      switch (field) {
        case "timestamp":
          comparison = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case "agent":
          comparison = a.agentName.localeCompare(b.agentName);
          break;
        case "action":
          comparison = a.action.localeCompare(b.action);
          break;
        case "decision":
          comparison = a.decision.localeCompare(b.decision);
          break;
        case "risk":
          const riskOrder = { low: 0, medium: 1, high: 2, critical: 3 };
          comparison = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
          break;
      }
      return order === "asc" ? comparison : -comparison;
    });

    return result;
  });

  const paginatedEntries = createMemo(() => {
    const start = (currentPage() - 1) * pageSize();
    return sortedEntries().slice(start, start + pageSize());
  });

  const totalPages = createMemo(() => Math.ceil(sortedEntries().length / pageSize()));

  const handleSort = (field: SortField) => {
    if (sortField() === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  // Styles
  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    overflow: "hidden",
    ...props.style,
  };

  const toolbarStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
    "border-bottom": "1px solid var(--jb-border-divider)",
    "flex-wrap": "wrap",
  };

  const filterStyle: JSX.CSSProperties = {
    "min-width": "100px",
  };

  const tableContainerStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "auto",
  };

  const tableStyle: JSX.CSSProperties = {
    width: "100%",
    "border-collapse": "collapse",
    "font-family": "var(--jb-font-ui)",
  };

  const paginationStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "8px 12px",
    "border-top": "1px solid var(--jb-border-divider)",
    "font-size": "12px",
    color: "var(--jb-text-muted-color)",
  };

  const pageButtonStyle = (active: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "28px",
    height: "28px",
    background: active ? "var(--jb-btn-primary-bg)" : "transparent",
    color: active ? "var(--jb-btn-primary-color)" : "var(--jb-text-body-color)",
    border: "none",
    "border-radius": "var(--jb-radius-sm)",
    cursor: "pointer",
    "font-size": "12px",
    transition: "background var(--cortex-transition-fast)",
  });

  return (
    <div style={containerStyle}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <div style={{ flex: "1", "min-width": "120px", "max-width": "200px" }}>
          <Input
            placeholder="Search..."
            value={searchQuery()}
            onInput={(e) => {
              setSearchQuery(e.currentTarget.value);
              setCurrentPage(1);
            }}
            style={{ height: "28px", "font-size": "12px" }}
            icon={
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M8.5 7.5L11 10l-.7.7-2.5-2.5a4.5 4.5 0 1 1 .7-.7zM5 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              </svg>
            }
          />
        </div>

        <Show when={agents().length > 0}>
          <div style={filterStyle}>
            <Select
              options={[{ value: "all", label: "All Agents" }, ...agents()]}
              value={agentFilter()}
              onChange={(v) => {
                setAgentFilter(v);
                setCurrentPage(1);
              }}
              style={{ height: "28px", "font-size": "12px" }}
            />
          </div>
        </Show>

        <div style={filterStyle}>
          <Select
            options={[
              { value: "all", label: "All Actions" },
              ...Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => ({ value, label })),
            ]}
            value={actionFilter()}
            onChange={(v) => {
              setActionFilter(v);
              setCurrentPage(1);
            }}
            style={{ height: "28px", "font-size": "12px" }}
          />
        </div>

        <div style={filterStyle}>
          <Select
            options={[
              { value: "all", label: "All Decisions" },
              ...Object.entries(DECISION_CONFIG).map(([value, config]) => ({
                value,
                label: config.label,
              })),
            ]}
            value={decisionFilter()}
            onChange={(v) => {
              setDecisionFilter(v);
              setCurrentPage(1);
            }}
            style={{ height: "28px", "font-size": "12px" }}
          />
        </div>

        <div style={filterStyle}>
          <Select
            options={[
              { value: "all", label: "All Risk" },
              ...Object.entries(RISK_CONFIG).map(([value, config]) => ({
                value,
                label: config.label,
              })),
            ]}
            value={riskFilter()}
            onChange={(v) => {
              setRiskFilter(v);
              setCurrentPage(1);
            }}
            style={{ height: "28px", "font-size": "12px" }}
          />
        </div>

        <div style={{ display: "flex", gap: "4px", "margin-left": "auto" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => props.onExport?.("json")}
            icon={
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 0L2 4h3v4h2V4h3L6 0zM0 10v2h12v-2H0z" />
              </svg>
            }
          >
            JSON
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => props.onExport?.("csv")}
            icon={
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 0L2 4h3v4h2V4h3L6 0zM0 10v2h12v-2H0z" />
              </svg>
            }
          >
            CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div style={tableContainerStyle}>
        <Show
          when={sortedEntries().length > 0}
          fallback={
            <EmptyState
              icon={
                <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
                  <path d="M4 4h24v4H4V4zM4 12h24v4H4v-4zM4 20h24v4H4v-4zM4 28h16v4H4v-4z" />
                </svg>
              }
              title="No Audit Entries"
              description={
                searchQuery() || agentFilter() !== "all" || actionFilter() !== "all"
                  ? "Try adjusting your filters"
                  : "Audit entries will appear here when agents perform actions"
              }
            />
          }
        >
          <table style={tableStyle}>
            <thead>
              <tr>
                <TableHeaderCell label="ID" width="80px" />
                <TableHeaderCell
                  label="Time"
                  sortable
                  field="timestamp"
                  currentSort={sortField()}
                  sortOrder={sortOrder()}
                  onSort={handleSort}
                  width="140px"
                />
                <TableHeaderCell
                  label="Agent"
                  sortable
                  field="agent"
                  currentSort={sortField()}
                  sortOrder={sortOrder()}
                  onSort={handleSort}
                />
                <TableHeaderCell
                  label="Action"
                  sortable
                  field="action"
                  currentSort={sortField()}
                  sortOrder={sortOrder()}
                  onSort={handleSort}
                  width="120px"
                />
                <TableHeaderCell
                  label="Decision"
                  sortable
                  field="decision"
                  currentSort={sortField()}
                  sortOrder={sortOrder()}
                  onSort={handleSort}
                  width="100px"
                />
                <TableHeaderCell
                  label="Risk"
                  sortable
                  field="risk"
                  currentSort={sortField()}
                  sortOrder={sortOrder()}
                  onSort={handleSort}
                  width="80px"
                />
                <TableHeaderCell label="Reason" />
              </tr>
            </thead>
            <tbody>
              <For each={paginatedEntries()}>
                {(entry) => (
                  <AuditRow
                    entry={entry}
                    onClick={() => setSelectedEntry(entry)}
                  />
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </div>

      {/* Pagination */}
      <Show when={totalPages() > 1}>
        <div style={paginationStyle}>
          <span>
            Showing {(currentPage() - 1) * pageSize() + 1} -{" "}
            {Math.min(currentPage() * pageSize(), sortedEntries().length)} of{" "}
            {sortedEntries().length}
          </span>
          <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
            <button
              style={pageButtonStyle(false)}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage() === 1}
              onMouseEnter={(e) => {
                if (currentPage() !== 1) {
                  e.currentTarget.style.background = "var(--jb-surface-hover)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M8 2L4 6l4 4V2z" />
              </svg>
            </button>
            <For each={Array.from({ length: Math.min(5, totalPages()) }, (_, i) => {
              const start = Math.max(1, currentPage() - 2);
              return start + i;
            }).filter((p) => p <= totalPages())}>
              {(page) => (
                <button
                  style={pageButtonStyle(currentPage() === page)}
                  onClick={() => setCurrentPage(page)}
                  onMouseEnter={(e) => {
                    if (currentPage() !== page) {
                      e.currentTarget.style.background = "var(--jb-surface-hover)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage() !== page) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  {page}
                </button>
              )}
            </For>
            <button
              style={pageButtonStyle(false)}
              onClick={() => setCurrentPage((p) => Math.min(totalPages(), p + 1))}
              disabled={currentPage() === totalPages()}
              onMouseEnter={(e) => {
                if (currentPage() !== totalPages()) {
                  e.currentTarget.style.background = "var(--jb-surface-hover)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M4 2l4 4-4 4V2z" />
              </svg>
            </button>
          </div>
        </div>
      </Show>

      {/* Detail Modal */}
      <DetailModal
        entry={selectedEntry()}
        open={selectedEntry() !== null}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
}

export default AuditLog;

