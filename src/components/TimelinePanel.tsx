/**
 * Timeline Panel
 *
 * A panel for browsing file timeline / local history.
 * Features:
 * - List timeline entries for the active file
 * - Restore, compare, and delete snapshots
 * - Display relative timestamps and file sizes
 * - Stats footer with total entries and disk usage
 */

import {
  Show,
  For,
  createSignal,
  createEffect,
  onMount,
  JSX,
} from "solid-js";
import {
  useTimeline,
  type TimelineEntry,
} from "@/context/TimelineContext";
import { useEditor } from "@/context/EditorContext";
import { Icon } from "./ui/Icon";

// ============================================================================
// Types
// ============================================================================

interface TimelinePanelProps {
  onClose?: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
  return `${Math.floor(diff / 86400000)} days ago`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function sourceLabel(source: string): string {
  switch (source) {
    case "autoSave":
      return "Auto Save";
    case "manualSave":
      return "Manual Save";
    case "undo":
      return "Undo";
    case "gitCommit":
      return "Git Commit";
    case "refactor":
      return "Refactor";
    default:
      return source;
  }
}

function sourceIcon(source: string): string {
  switch (source) {
    case "autoSave":
      return "clock";
    case "manualSave":
      return "floppy-disk";
    case "undo":
      return "rotate-left";
    case "gitCommit":
      return "code-branch";
    case "refactor":
      return "wand-magic-sparkles";
    default:
      return "file";
  }
}

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    background: "var(--jb-surface-raised)",
    border: "1px solid var(--jb-border-default)",
    "border-radius": "var(--jb-radius-md)",
    overflow: "hidden",
  } as JSX.CSSProperties,

  header: {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
    "border-bottom": "1px solid var(--jb-border-default)",
    "flex-shrink": "0",
  } as JSX.CSSProperties,

  headerTitle: {
    flex: "1",
    "font-weight": "600",
    "font-size": "13px",
    color: "var(--jb-text-primary)",
  } as JSX.CSSProperties,

  headerButton: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    "border-radius": "var(--jb-radius-sm)",
    color: "var(--jb-text-secondary)",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
  } as JSX.CSSProperties,

  filePath: {
    padding: "4px 12px",
    "font-size": "11px",
    color: "var(--jb-text-tertiary)",
    "border-bottom": "1px solid var(--jb-border-default)",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "flex-shrink": "0",
  } as JSX.CSSProperties,

  content: {
    flex: "1",
    "overflow-y": "auto",
    padding: "4px 0",
  } as JSX.CSSProperties,

  entryRow: {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "6px 12px",
    cursor: "pointer",
    transition: "background 0.1s",
  } as JSX.CSSProperties,

  entryIcon: {
    "flex-shrink": "0",
    width: "16px",
    height: "16px",
    color: "var(--jb-text-tertiary)",
  } as JSX.CSSProperties,

  entryInfo: {
    flex: "1",
    "min-width": "0",
    display: "flex",
    "flex-direction": "column",
    gap: "2px",
  } as JSX.CSSProperties,

  entryLabel: {
    "font-size": "12px",
    color: "var(--jb-text-primary)",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
  } as JSX.CSSProperties,

  entryMeta: {
    "font-size": "11px",
    color: "var(--jb-text-tertiary)",
    display: "flex",
    gap: "6px",
  } as JSX.CSSProperties,

  entryActions: {
    display: "flex",
    gap: "2px",
    "flex-shrink": "0",
    opacity: "0",
    transition: "opacity 0.1s",
  } as JSX.CSSProperties,

  actionButton: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "2px 4px",
    "border-radius": "var(--jb-radius-sm)",
    color: "var(--jb-text-secondary)",
    "font-size": "11px",
  } as JSX.CSSProperties,

  footer: {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "6px 12px",
    "border-top": "1px solid var(--jb-border-default)",
    "font-size": "11px",
    color: "var(--jb-text-tertiary)",
    "flex-shrink": "0",
  } as JSX.CSSProperties,

  emptyState: {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    padding: "32px 16px",
    gap: "8px",
    color: "var(--jb-text-tertiary)",
    "font-size": "12px",
  } as JSX.CSSProperties,

  loading: {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    padding: "24px",
    color: "var(--jb-text-tertiary)",
    "font-size": "12px",
  } as JSX.CSSProperties,
};

// ============================================================================
// Component
// ============================================================================

export function TimelinePanel(props: TimelinePanelProps) {
  const timeline = useTimeline();
  const editor = useEditor();
  const [hoveredId, setHoveredId] = createSignal<string | null>(null);

  const activeFilePath = () => {
    const fileId = editor.state.activeFileId;
    if (!fileId) return null;
    const file = editor.state.openFiles.find((f) => f.id === fileId);
    return file?.path ?? null;
  };

  onMount(() => {
    const path = activeFilePath();
    if (path) {
      timeline.loadEntries(path);
    }
    timeline.refreshStats();
  });

  createEffect(() => {
    const path = activeFilePath();
    if (path) {
      timeline.loadEntries(path);
    }
  });

  const handleRestore = async (entry: TimelineEntry) => {
    try {
      await timeline.restoreSnapshot(entry.id);
    } catch {
      // error is set in context
    }
  };

  const handleDelete = async (entry: TimelineEntry) => {
    try {
      await timeline.deleteEntry(entry.id);
    } catch {
      // error is set in context
    }
  };

  const handleCompare = async (entry: TimelineEntry) => {
    const entries = timeline.state.entries;
    const idx = entries.findIndex((e) => e.id === entry.id);
    if (idx < entries.length - 1) {
      try {
        await timeline.compare(entry.id, entries[idx + 1].id);
      } catch {
        // error is set in context
      }
    }
  };

  const handleRefresh = () => {
    const path = activeFilePath();
    if (path) {
      timeline.loadEntries(path);
    }
    timeline.refreshStats();
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>Timeline</span>
        <button
          style={styles.headerButton}
          onClick={handleRefresh}
          title="Refresh"
        >
          <Icon name="arrows-rotate" size={14} />
        </button>
        <Show when={props.onClose}>
          <button
            style={styles.headerButton}
            onClick={props.onClose}
            title="Close"
          >
            <Icon name="xmark" size={14} />
          </button>
        </Show>
      </div>

      <Show when={timeline.state.selectedFilePath}>
        <div style={styles.filePath} title={timeline.state.selectedFilePath!}>
          {timeline.state.selectedFilePath}
        </div>
      </Show>

      <div style={styles.content}>
        <Show when={timeline.state.loading}>
          <div style={styles.loading}>Loading timeline…</div>
        </Show>

        <Show when={!timeline.state.loading && timeline.state.entries.length === 0}>
          <div style={styles.emptyState}>
            <Icon name="clock-rotate-left" size={24} />
            <span>No timeline entries</span>
            <span style={{ "font-size": "11px" }}>
              Snapshots will appear here as you edit files
            </span>
          </div>
        </Show>

        <Show when={!timeline.state.loading && timeline.state.entries.length > 0}>
          <For each={timeline.state.entries}>
            {(entry) => (
              <div
                style={{
                  ...styles.entryRow,
                  background:
                    hoveredId() === entry.id
                      ? "var(--jb-surface-hover)"
                      : "transparent",
                }}
                onMouseEnter={() => setHoveredId(entry.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div style={styles.entryIcon}>
                  <Icon name={sourceIcon(entry.source)} size={14} />
                </div>
                <div style={styles.entryInfo}>
                  <div style={styles.entryLabel}>
                    {entry.label ?? sourceLabel(entry.source)}
                  </div>
                  <div style={styles.entryMeta}>
                    <span>{formatRelativeTime(entry.timestamp)}</span>
                    <span>{formatBytes(entry.size)}</span>
                  </div>
                </div>
                <div
                  style={{
                    ...styles.entryActions,
                    opacity: hoveredId() === entry.id ? "1" : "0",
                  }}
                >
                  <button
                    style={styles.actionButton}
                    onClick={() => handleRestore(entry)}
                    title="Restore"
                  >
                    <Icon name="rotate-left" size={12} />
                  </button>
                  <button
                    style={styles.actionButton}
                    onClick={() => handleCompare(entry)}
                    title="Compare with previous"
                  >
                    <Icon name="code-compare" size={12} />
                  </button>
                  <button
                    style={styles.actionButton}
                    onClick={() => handleDelete(entry)}
                    title="Delete"
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>

      <div style={styles.footer}>
        <Show
          when={timeline.state.stats}
          fallback={<span>No stats available</span>}
        >
          <span>
            {timeline.state.stats!.totalEntries} entries across{" "}
            {timeline.state.stats!.totalFiles} files
          </span>
          <span>{formatBytes(timeline.state.stats!.diskUsageBytes)}</span>
        </Show>
      </div>
    </div>
  );
}

export default TimelinePanel;
