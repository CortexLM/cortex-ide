/**
 * =============================================================================
 * CONSOLE PANEL - Execution Logs
 * =============================================================================
 * 
 * A real-time log stream panel for the Agent Factory that displays execution
 * logs from agents and workflows. Features color-coded log levels, filtering,
 * search, and export functionality.
 * 
 * Log Levels:
 * - DEBUG: Verbose debugging information
 * - INFO: General information
 * - WARN: Warnings
 * - ERROR: Errors
 * - TOOL: Tool execution logs
 * - INTERCEPT: Supervisor intercepts
 * - DECISION: Agent decisions
 * 
 * =============================================================================
 */

import {
  createSignal,
  createEffect,
  createMemo,
  For,
  Show,
  JSX,
} from "solid-js";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { Toggle } from "../../ui/Toggle";
import { Badge } from "../../ui/Badge";

// =============================================================================
// TYPES
// =============================================================================

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "TOOL" | "INTERCEPT" | "DECISION";

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  agentId?: string;
  agentName?: string;
  message: string;
  details?: Record<string, unknown>;
  source?: string;
}

export interface ConsolePanelProps {
  /** Log entries to display */
  logs?: LogEntry[];
  /** Available agents for filtering */
  agents?: { id: string; name: string }[];
  /** Callback when logs are cleared */
  onClear?: () => void;
  /** Callback when logs are exported */
  onExport?: (format: "json" | "txt") => void;
  /** Whether the panel is loading */
  loading?: boolean;
  /** Maximum number of logs to retain */
  maxLogs?: number;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const LOG_LEVEL_OPTIONS = [
  { value: "all", label: "All Levels" },
  { value: "DEBUG", label: "Debug" },
  { value: "INFO", label: "Info" },
  { value: "WARN", label: "Warning" },
  { value: "ERROR", label: "Error" },
  { value: "TOOL", label: "Tool" },
  { value: "INTERCEPT", label: "Intercept" },
  { value: "DECISION", label: "Decision" },
];

const LOG_LEVEL_COLORS: Record<LogLevel, { bg: string; color: string; badge: "default" | "accent" | "success" | "warning" | "error" }> = {
  DEBUG: { bg: "rgba(139, 139, 139, 0.1)", color: "var(--cortex-text-inactive)", badge: "default" },
  INFO: { bg: "rgba(53, 116, 240, 0.1)", color: "var(--cortex-info)", badge: "accent" },
  WARN: { bg: "rgba(233, 170, 70, 0.1)", color: "var(--cortex-warning)", badge: "warning" },
  ERROR: { bg: "rgba(247, 84, 100, 0.1)", color: "var(--cortex-error)", badge: "error" },
  TOOL: { bg: "rgba(89, 168, 105, 0.1)", color: "var(--cortex-success)", badge: "success" },
  INTERCEPT: { bg: "rgba(157, 91, 210, 0.1)", color: "var(--cortex-info)", badge: "accent" },
  DECISION: { bg: "rgba(204, 120, 50, 0.1)", color: "var(--cortex-warning)", badge: "warning" },
};

// =============================================================================
// LOG ENTRY COMPONENT
// =============================================================================

interface LogEntryItemProps {
  entry: LogEntry;
  onCopy?: (entry: LogEntry) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

function LogEntryItem(props: LogEntryItemProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  const levelStyle = LOG_LEVEL_COLORS[props.entry.level];

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  };

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    padding: "6px 12px",
    background: isHovered() ? "var(--jb-surface-hover)" : "transparent",
    "border-left": `3px solid ${levelStyle.color}`,
    transition: "background var(--cortex-transition-fast)",
    cursor: props.entry.details ? "pointer" : "default",
  });

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "font-family": "var(--jb-font-mono)",
    "font-size": "12px",
  };

  const timestampStyle: JSX.CSSProperties = {
    color: "var(--jb-text-muted-color)",
    "flex-shrink": "0",
  };

  const messageStyle: JSX.CSSProperties = {
    flex: "1",
    color: "var(--jb-text-body-color)",
    "white-space": "pre-wrap",
    "word-break": "break-word",
    overflow: "hidden",
  };

  const agentStyle: JSX.CSSProperties = {
    "font-size": "10px",
    color: "var(--jb-text-muted-color)",
    background: "var(--jb-surface-active)",
    padding: "1px 6px",
    "border-radius": "var(--jb-radius-sm)",
    "flex-shrink": "0",
  };

  const detailsStyle: JSX.CSSProperties = {
    "margin-top": "8px",
    "padding-left": "16px",
    "font-family": "var(--jb-font-mono)",
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
    background: "var(--jb-canvas)",
    padding: "8px 12px",
    "border-radius": "var(--jb-radius-sm)",
    "white-space": "pre-wrap",
    "word-break": "break-all",
    "max-height": "200px",
    "overflow-y": "auto",
  };

  const actionsStyle = (): JSX.CSSProperties => ({
    display: isHovered() ? "flex" : "none",
    "align-items": "center",
    gap: "4px",
    "flex-shrink": "0",
  });

  const copyButtonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "20px",
    height: "20px",
    background: "transparent",
    border: "none",
    "border-radius": "var(--jb-radius-sm)",
    color: "var(--jb-icon-color-default)",
    cursor: "pointer",
    transition: "background var(--cortex-transition-fast)",
  };

  return (
    <div
      style={containerStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => props.entry.details && props.onToggleExpand?.()}
    >
      <div style={headerStyle}>
        <span style={timestampStyle}>{formatTimestamp(props.entry.timestamp)}</span>
        <Badge variant={levelStyle.badge} size="sm">
          {props.entry.level}
        </Badge>
        <Show when={props.entry.agentName}>
          <span style={agentStyle}>{props.entry.agentName}</span>
        </Show>
        <span style={messageStyle}>{props.entry.message}</span>
        <div style={actionsStyle()}>
          <Show when={props.entry.details}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="currentColor"
              style={{
                transform: props.expanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform var(--cortex-transition-fast)",
                color: "var(--jb-icon-color-default)",
              }}
            >
              <path d="M3 4l3 3.5L9 4v1L6 8.5 3 5V4z" />
            </svg>
          </Show>
          <button
            style={copyButtonStyle}
            onClick={(e) => {
              e.stopPropagation();
              props.onCopy?.(props.entry);
            }}
            title="Copy log entry"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--jb-surface-active)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M4 0v2H0v10h8V8h4V0H4zm3 11H1V3h3v5h3v3zm4-4H5V1h6v6z" />
            </svg>
          </button>
        </div>
      </div>
      <Show when={props.expanded && props.entry.details}>
        <div style={detailsStyle}>
          {JSON.stringify(props.entry.details, null, 2)}
        </div>
      </Show>
    </div>
  );
}

// =============================================================================
// CONSOLE PANEL COMPONENT
// =============================================================================

export function ConsolePanel(props: ConsolePanelProps) {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [levelFilter, setLevelFilter] = createSignal("all");
  const [agentFilter, setAgentFilter] = createSignal("all");
  const [autoScroll, setAutoScroll] = createSignal(true);
  const [expandedLogs, setExpandedLogs] = createSignal<Set<string>>(new Set());

  let scrollContainerRef: HTMLDivElement | undefined;

  // Filter logs
  const filteredLogs = createMemo(() => {
    const logs = props.logs || [];
    const query = searchQuery().toLowerCase().trim();
    const level = levelFilter();
    const agent = agentFilter();

    return logs.filter((log) => {
      // Level filter
      if (level !== "all" && log.level !== level) return false;

      // Agent filter
      if (agent !== "all" && log.agentId !== agent) return false;

      // Search filter
      if (query) {
        const searchText = `${log.message} ${log.agentName || ""} ${log.source || ""}`.toLowerCase();
        if (!searchText.includes(query)) return false;
      }

      return true;
    });
  });

  // Agent options for filter
  const agentOptions = createMemo(() => {
    const agents = props.agents || [];
    return [
      { value: "all", label: "All Agents" },
      ...agents.map((a) => ({ value: a.id, label: a.name })),
    ];
  });

  // Auto-scroll to bottom when new logs arrive
  createEffect(() => {
    const logs = filteredLogs();
    if (autoScroll() && scrollContainerRef && logs.length > 0) {
      scrollContainerRef.scrollTop = scrollContainerRef.scrollHeight;
    }
  });

  const handleCopyEntry = async (entry: LogEntry) => {
    const text = `[${entry.timestamp.toISOString()}] [${entry.level}]${entry.agentName ? ` [${entry.agentName}]` : ""} ${entry.message}${entry.details ? `\n${JSON.stringify(entry.details, null, 2)}` : ""}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const toggleLogExpanded = (logId: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  // Styles
  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    overflow: "hidden",
    background: "var(--jb-surface-panel)",
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

  const searchContainerStyle: JSX.CSSProperties = {
    flex: "1",
    "min-width": "120px",
    "max-width": "200px",
  };

  const filterContainerStyle: JSX.CSSProperties = {
    "min-width": "100px",
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "auto",
    "font-family": "var(--jb-font-mono)",
  };

  const footerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "8px 12px",
    "border-top": "1px solid var(--jb-border-divider)",
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
  };

  const emptyStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    height: "100%",
    padding: "32px",
    color: "var(--jb-text-muted-color)",
    "text-align": "center",
  };

  const buttonGroupStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "4px",
    "margin-left": "auto",
  };

  const iconButtonStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "28px",
    height: "28px",
    background: "transparent",
    border: "none",
    "border-radius": "var(--jb-radius-sm)",
    color: "var(--jb-icon-color-default)",
    cursor: "pointer",
    transition: "background var(--cortex-transition-fast)",
  };

  return (
    <div style={containerStyle}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <div style={searchContainerStyle}>
          <Input
            placeholder="Search logs..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            style={{ height: "28px", "font-size": "12px" }}
            icon={
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M8.5 7.5L11 10l-.7.7-2.5-2.5a4.5 4.5 0 1 1 .7-.7zM5 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              </svg>
            }
          />
        </div>
        <div style={filterContainerStyle}>
          <Select
            options={LOG_LEVEL_OPTIONS}
            value={levelFilter()}
            onChange={setLevelFilter}
            style={{ height: "28px", "font-size": "12px" }}
          />
        </div>
        <Show when={(props.agents?.length || 0) > 0}>
          <div style={filterContainerStyle}>
            <Select
              options={agentOptions()}
              value={agentFilter()}
              onChange={setAgentFilter}
              style={{ height: "28px", "font-size": "12px" }}
            />
          </div>
        </Show>
        <div style={buttonGroupStyle}>
          <button
            style={iconButtonStyle}
            onClick={() => props.onClear?.()}
            title="Clear logs"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--jb-surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M5 0v1H1v2h12V1H9V0H5zM2 4v9h10V4H2zm2 2h2v5H4V6zm4 0h2v5H8V6z" />
            </svg>
          </button>
          <button
            style={iconButtonStyle}
            onClick={() => props.onExport?.("json")}
            title="Export as JSON"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--jb-surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 0L3 4h3v6h2V4h3L7 0zM1 12v2h12v-2H1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Log Content */}
      <div style={contentStyle} ref={scrollContainerRef}>
        <Show
          when={filteredLogs().length > 0}
          fallback={
            <div style={emptyStyle}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor" style={{ opacity: 0.3, "margin-bottom": "8px" }}>
                <path d="M4 4h24v2H4V4zm0 6h24v2H4v-2zm0 6h24v2H4v-2zm0 6h24v2H4v-2zm0 6h16v2H4v-2z" />
              </svg>
              <span style={{ "font-size": "13px" }}>No logs to display</span>
              <span style={{ "font-size": "11px", "margin-top": "4px" }}>
                {searchQuery() || levelFilter() !== "all" || agentFilter() !== "all"
                  ? "Try adjusting your filters"
                  : "Logs will appear here when agents run"}
              </span>
            </div>
          }
        >
          <For each={filteredLogs()}>
            {(entry) => (
              <LogEntryItem
                entry={entry}
                onCopy={handleCopyEntry}
                expanded={expandedLogs().has(entry.id)}
                onToggleExpand={() => toggleLogExpanded(entry.id)}
              />
            )}
          </For>
        </Show>
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <span>
          {filteredLogs().length} of {props.logs?.length || 0} entries
        </span>
        <Toggle
          checked={autoScroll()}
          onChange={setAutoScroll}
          label="Auto-scroll"
          size="sm"
        />
      </div>
    </div>
  );
}

export default ConsolePanel;

