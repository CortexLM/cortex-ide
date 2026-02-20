/**
 * =============================================================================
 * VERSION HISTORY - Workflow Version Management
 * =============================================================================
 * 
 * A dialog for viewing and managing workflow version history. Allows users
 * to browse versions, compare changes, and restore previous versions.
 * 
 * Features:
 * - List of versions with timestamp, author, description
 * - Diff view between versions (show added/removed nodes)
 * - Restore version button
 * - Compare two versions side by side
 * - Create named version (tag)
 * - Delete old versions
 * - Auto-save indicator
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
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Badge } from "../../ui/Badge";
import { EmptyState } from "../../ui/EmptyState";

// =============================================================================
// TYPES
// =============================================================================

export interface VersionChange {
  type: "added" | "removed" | "modified";
  nodeType: string;
  nodeName: string;
  details?: string;
}

export interface WorkflowVersion {
  id: string;
  name?: string;
  description?: string;
  author: string;
  timestamp: Date;
  isAutoSave: boolean;
  isCurrent: boolean;
  isTagged: boolean;
  tag?: string;
  changes: VersionChange[];
  nodeCount: number;
  connectionCount: number;
}

export interface VersionHistoryProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Version history list */
  versions?: WorkflowVersion[];
  /** Currently selected version for comparison */
  selectedVersionId?: string;
  /** Second version for comparison */
  compareVersionId?: string;
  /** Callback to restore a version */
  onRestoreVersion?: (versionId: string) => void;
  /** Callback to delete a version */
  onDeleteVersion?: (versionId: string) => void;
  /** Callback to tag a version */
  onTagVersion?: (versionId: string, tag: string) => void;
  /** Callback to compare versions */
  onCompareVersions?: (versionId1: string, versionId2: string) => void;
  /** Callback to select a version */
  onSelectVersion?: (versionId: string) => void;
  /** Loading state */
  loading?: boolean;
  /** Auto-save enabled */
  autoSaveEnabled?: boolean;
  /** Last auto-save time */
  lastAutoSave?: Date;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return "Just now";
}

function formatFullTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =============================================================================
// CHANGE BADGE COMPONENT
// =============================================================================

interface ChangeBadgeProps {
  change: VersionChange;
}

function ChangeBadge(props: ChangeBadgeProps) {
  const config = () => {
    switch (props.change.type) {
      case "added":
        return { label: "+", color: "var(--cortex-success)", bg: "rgba(89, 168, 105, 0.15)" };
      case "removed":
        return { label: "-", color: "var(--cortex-error)", bg: "rgba(247, 84, 100, 0.15)" };
      case "modified":
        return { label: "~", color: "var(--cortex-warning)", bg: "rgba(233, 170, 70, 0.15)" };
    }
  };

  const badgeStyle: JSX.CSSProperties = {
    display: "inline-flex",
    "align-items": "center",
    gap: "4px",
    padding: "2px 6px",
    "border-radius": "var(--jb-radius-sm)",
    background: config().bg,
    color: config().color,
    "font-size": "11px",
    "font-weight": "500",
  };

  return (
    <span style={badgeStyle}>
      <span style={{ "font-weight": "700" }}>{config().label}</span>
      {props.change.nodeName}
    </span>
  );
}

// =============================================================================
// VERSION ROW COMPONENT
// =============================================================================

interface VersionRowProps {
  version: WorkflowVersion;
  isSelected: boolean;
  isComparing: boolean;
  onSelect: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onTag: (tag: string) => void;
  onCompare: () => void;
}

function VersionRow(props: VersionRowProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  const [isExpanded, setIsExpanded] = createSignal(false);
  const [showTagInput, setShowTagInput] = createSignal(false);
  const [tagValue, setTagValue] = createSignal(props.version.tag || "");

  const rowStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    background: props.isSelected
      ? "var(--jb-surface-active)"
      : props.isComparing
        ? "rgba(53, 116, 240, 0.08)"
        : isHovered()
          ? "var(--jb-surface-hover)"
          : "transparent",
    border: props.isSelected
      ? "1px solid var(--jb-border-focus)"
      : props.isComparing
        ? "1px solid rgba(53, 116, 240, 0.3)"
        : "1px solid transparent",
    "border-radius": "var(--jb-radius-md)",
    padding: "10px 12px",
    cursor: "pointer",
    transition: "all var(--cortex-transition-fast)",
    "margin-bottom": "4px",
  });

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "flex-start",
    gap: "10px",
  };

  const indicatorStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "32px",
    height: "32px",
    "border-radius": "var(--cortex-radius-full)",
    background: props.version.isCurrent
      ? "var(--jb-border-focus)"
      : props.version.isAutoSave
        ? "var(--jb-surface-active)"
        : props.version.isTagged
          ? "rgba(233, 170, 70, 0.2)"
          : "var(--jb-surface-panel)",
    color: props.version.isCurrent
      ? "var(--cortex-text-primary)"
      : props.version.isAutoSave
        ? "var(--jb-text-muted-color)"
        : props.version.isTagged
          ? "var(--cortex-warning)"
          : "var(--jb-text-body-color)",
    "flex-shrink": "0",
  });

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    "min-width": "0",
  };

  const titleRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "margin-bottom": "4px",
  };

  const handleTagSubmit = () => {
    if (tagValue().trim()) {
      props.onTag(tagValue().trim());
    }
    setShowTagInput(false);
  };

  return (
    <div
      style={rowStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button, input")) {
          props.onSelect();
        }
      }}
    >
      <div style={headerStyle}>
        <div style={indicatorStyle()}>
          <Show when={props.version.isCurrent}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1zM3.5 7l2.5 2.5 4-4-.7-.7-3.3 3.3-1.8-1.8-.7.7z" />
            </svg>
          </Show>
          <Show when={!props.version.isCurrent && props.version.isAutoSave}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1zm0 1a5 5 0 1 1 0 10A5 5 0 0 1 7 2z" />
              <path d="M7 3v4l3 1.5-.4.9L6 7.5V3h1z" />
            </svg>
          </Show>
          <Show when={!props.version.isCurrent && !props.version.isAutoSave && props.version.isTagged}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M12 6L8 2H3v5l6 6 5-5V6h-2zm-3 .5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
            </svg>
          </Show>
          <Show when={!props.version.isCurrent && !props.version.isAutoSave && !props.version.isTagged}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <circle cx="7" cy="7" r="3" />
            </svg>
          </Show>
        </div>

        <div style={contentStyle}>
          <div style={titleRowStyle}>
            <span style={{ "font-size": "13px", "font-weight": "500", color: "var(--jb-text-body-color)" }}>
              {props.version.name || props.version.description || (props.version.isAutoSave ? "Auto-save" : "Manual save")}
            </span>
            <Show when={props.version.isCurrent}>
              <Badge variant="accent" size="sm">Current</Badge>
            </Show>
            <Show when={props.version.isAutoSave}>
              <Badge variant="default" size="sm">Auto</Badge>
            </Show>
            <Show when={props.version.tag}>
              <Badge variant="warning" size="sm">{props.version.tag}</Badge>
            </Show>
          </div>

          <div style={{ display: "flex", "align-items": "center", gap: "8px", "font-size": "11px", color: "var(--jb-text-muted-color)" }}>
            <span title={formatFullTimestamp(props.version.timestamp)}>
              {formatTimestamp(props.version.timestamp)}
            </span>
            <span>by {props.version.author}</span>
            <span>{props.version.nodeCount} nodes</span>
          </div>

          {/* Changes summary */}
          <Show when={props.version.changes.length > 0}>
            <div style={{ display: "flex", gap: "6px", "flex-wrap": "wrap", "margin-top": "8px" }}>
              <For each={props.version.changes.slice(0, 3)}>
                {(change) => <ChangeBadge change={change} />}
              </For>
              <Show when={props.version.changes.length > 3}>
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--jb-border-focus)",
                    "font-size": "11px",
                    cursor: "pointer",
                    padding: "0",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded());
                  }}
                >
                  +{props.version.changes.length - 3} more
                </button>
              </Show>
            </div>
          </Show>
        </div>

        {/* Actions */}
        <Show when={isHovered() || props.isSelected}>
          <div style={{ display: "flex", gap: "4px", "flex-shrink": "0" }}>
            <Show when={!props.version.isCurrent}>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onRestore();
                }}
                title="Restore this version"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M2 6a4 4 0 0 1 7.2-2.4l-1.7.6L11 6V2.5l-.8.8A5 5 0 1 0 11 7H10a4 4 0 0 1-8-1z" />
                </svg>
              </Button>
            </Show>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                props.onCompare();
              }}
              title="Compare with this version"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M1 2h4v8H1V2zm1 1v6h2V3H2zm5-1h4v8H7V2zm1 1v6h2V3H8z" />
              </svg>
            </Button>
            <Show when={!props.version.isTagged}>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTagInput(true);
                }}
                title="Tag this version"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M10 5L7 2H3v4l5 5 4-4V5h-2zm-2 .5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
                </svg>
              </Button>
            </Show>
            <Show when={!props.version.isCurrent}>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onDelete();
                }}
                title="Delete this version"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M4 1h4v1h3v1H1V2h3V1zM2 4h8v7H2V4zm2 1v5h1V5H4zm3 0v5h1V5H7z" />
                </svg>
              </Button>
            </Show>
          </div>
        </Show>
      </div>

      {/* Expanded changes */}
      <Show when={isExpanded()}>
        <div style={{ "margin-top": "8px", "padding-top": "8px", "border-top": "1px solid var(--jb-border-divider)", "margin-left": "42px" }}>
          <div style={{ display: "flex", gap: "6px", "flex-wrap": "wrap" }}>
            <For each={props.version.changes}>
              {(change) => <ChangeBadge change={change} />}
            </For>
          </div>
        </div>
      </Show>

      {/* Tag input */}
      <Show when={showTagInput()}>
        <div
          style={{ display: "flex", gap: "8px", "margin-top": "10px", "margin-left": "42px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <Input
            placeholder="Enter tag name..."
            value={tagValue()}
            onInput={(e) => setTagValue(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTagSubmit();
              if (e.key === "Escape") setShowTagInput(false);
            }}
            style={{ flex: "1" }}
          />
          <Button variant="primary" size="sm" onClick={handleTagSubmit}>
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowTagInput(false)}>
            Cancel
          </Button>
        </div>
      </Show>
    </div>
  );
}

// =============================================================================
// COMPARE VIEW COMPONENT
// =============================================================================

interface CompareViewProps {
  version1: WorkflowVersion;
  version2: WorkflowVersion;
  onClose: () => void;
}

function CompareView(props: CompareViewProps) {
  const containerStyle: JSX.CSSProperties = {
    background: "var(--jb-canvas)",
    "border-radius": "var(--jb-radius-md)",
    padding: "16px",
    "margin-top": "16px",
  };

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    "margin-bottom": "12px",
  };

  const columnsStyle: JSX.CSSProperties = {
    display: "grid",
    "grid-template-columns": "1fr 1fr",
    gap: "16px",
  };

  const columnStyle: JSX.CSSProperties = {
    background: "var(--jb-surface-panel)",
    "border-radius": "var(--jb-radius-sm)",
    padding: "12px",
  };

  const columnHeaderStyle: JSX.CSSProperties = {
    "font-size": "12px",
    "font-weight": "600",
    color: "var(--jb-text-body-color)",
    "margin-bottom": "8px",
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ "font-size": "13px", "font-weight": "600", color: "var(--jb-text-body-color)" }}>
          Comparing Versions
        </div>
        <Button variant="ghost" size="sm" onClick={props.onClose}>
          Close Comparison
        </Button>
      </div>

      <div style={columnsStyle}>
        <div style={columnStyle}>
          <div style={columnHeaderStyle}>
            {props.version1.name || formatTimestamp(props.version1.timestamp)}
            <Show when={props.version1.tag}>
              <Badge variant="warning" size="sm" style={{ "margin-left": "6px" }}>
                {props.version1.tag}
              </Badge>
            </Show>
          </div>
          <div style={{ "font-size": "11px", color: "var(--jb-text-muted-color)", "margin-bottom": "8px" }}>
            {props.version1.nodeCount} nodes, {props.version1.connectionCount} connections
          </div>
          <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
            <For each={props.version1.changes}>
              {(change) => <ChangeBadge change={change} />}
            </For>
          </div>
        </div>

        <div style={columnStyle}>
          <div style={columnHeaderStyle}>
            {props.version2.name || formatTimestamp(props.version2.timestamp)}
            <Show when={props.version2.tag}>
              <Badge variant="warning" size="sm" style={{ "margin-left": "6px" }}>
                {props.version2.tag}
              </Badge>
            </Show>
          </div>
          <div style={{ "font-size": "11px", color: "var(--jb-text-muted-color)", "margin-bottom": "8px" }}>
            {props.version2.nodeCount} nodes, {props.version2.connectionCount} connections
          </div>
          <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
            <For each={props.version2.changes}>
              {(change) => <ChangeBadge change={change} />}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// VERSION HISTORY COMPONENT
// =============================================================================

export function VersionHistory(props: VersionHistoryProps) {
  const versions = () => props.versions || [];

  const [selectedId, setSelectedId] = createSignal<string | null>(props.selectedVersionId || null);
  const [compareId, setCompareId] = createSignal<string | null>(props.compareVersionId || null);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal<string | null>(null);

  const selectedVersion = createMemo(() => versions().find((v) => v.id === selectedId()));
  const compareVersion = createMemo(() => versions().find((v) => v.id === compareId()));

  const handleSelect = (versionId: string) => {
    setSelectedId(versionId);
    props.onSelectVersion?.(versionId);
  };

  const handleCompare = (versionId: string) => {
    if (selectedId() && selectedId() !== versionId) {
      setCompareId(versionId);
      props.onCompareVersions?.(selectedId()!, versionId);
    } else {
      setSelectedId(versionId);
    }
  };

  const handleRestore = (versionId: string) => {
    props.onRestoreVersion?.(versionId);
    props.onClose();
  };

  const handleDelete = (versionId: string) => {
    props.onDeleteVersion?.(versionId);
    setShowDeleteConfirm(null);
    if (selectedId() === versionId) setSelectedId(null);
    if (compareId() === versionId) setCompareId(null);
  };

  // Styles
  const headerInfoStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "12px",
    background: "var(--jb-surface-panel)",
    "border-radius": "var(--jb-radius-md)",
    "margin-bottom": "16px",
  };

  const listStyle: JSX.CSSProperties = {
    "max-height": "400px",
    overflow: "auto",
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Version History"
      size="lg"
      style={{ width: "700px", "max-width": "95vw" }}
    >
      {/* Auto-save info */}
      <div style={headerInfoStyle}>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <Show when={props.autoSaveEnabled}>
            <Badge variant="success" size="sm">Auto-save ON</Badge>
          </Show>
          <Show when={!props.autoSaveEnabled}>
            <Badge variant="default" size="sm">Auto-save OFF</Badge>
          </Show>
          <Show when={props.lastAutoSave}>
            <span style={{ "font-size": "11px", color: "var(--jb-text-muted-color)" }}>
              Last saved {formatTimestamp(props.lastAutoSave!)}
            </span>
          </Show>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Badge variant="default" size="sm">{versions().length} versions</Badge>
        </div>
      </div>

      {/* Compare view */}
      <Show when={selectedVersion() && compareVersion()}>
        <CompareView
          version1={selectedVersion()!}
          version2={compareVersion()!}
          onClose={() => setCompareId(null)}
        />
      </Show>

      {/* Version list */}
      <Show
        when={!props.loading}
        fallback={
          <div style={{ display: "flex", "justify-content": "center", padding: "40px" }}>
            <div style={{ color: "var(--jb-text-muted-color)" }}>Loading versions...</div>
          </div>
        }
      >
        <Show
          when={versions().length > 0}
          fallback={
            <EmptyState
              icon={
                <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
                  <path d="M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm0 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z" />
                  <path d="M16 8v8l6 3-.9 1.8-7.1-3.5V8h2z" />
                </svg>
              }
              title="No Version History"
              description="Version history will appear here as you save your workflow"
            />
          }
        >
          <div style={listStyle}>
            <For each={versions()}>
              {(version) => (
                <VersionRow
                  version={version}
                  isSelected={selectedId() === version.id}
                  isComparing={compareId() === version.id}
                  onSelect={() => handleSelect(version.id)}
                  onRestore={() => handleRestore(version.id)}
                  onDelete={() => setShowDeleteConfirm(version.id)}
                  onTag={(tag) => props.onTagVersion?.(version.id, tag)}
                  onCompare={() => handleCompare(version.id)}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>

      {/* Delete confirmation modal */}
      <Modal
        open={showDeleteConfirm() !== null}
        onClose={() => setShowDeleteConfirm(null)}
        title="Delete Version"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => handleDelete(showDeleteConfirm()!)}>
              Delete
            </Button>
          </>
        }
      >
        <p style={{ color: "var(--jb-text-body-color)", "font-size": "13px" }}>
          Are you sure you want to delete this version? This action cannot be undone.
        </p>
      </Modal>
    </Modal>
  );
}

export default VersionHistory;

