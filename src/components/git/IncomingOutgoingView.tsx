/**
 * Incoming/Outgoing Changes View
 * Shows commits that will be pulled (incoming) or pushed (outgoing)
 */

import { createSignal, createEffect, For, Show, onMount, onCleanup, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";
import {
  Button,
  IconButton,
  Badge,
  Text,
  EmptyState,
} from "@/components/ui";
import { gitCommitFiles } from "@/utils/tauri-api";

// ============================================================================
// Types
// ============================================================================

export interface CommitInfo {
  hash: string;
  hashShort: string;
  message: string;
  author: string;
  authorEmail: string;
  date: Date;
  parents: string[];
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface IncomingOutgoingState {
  incoming: CommitInfo[];
  outgoing: CommitInfo[];
  loading: boolean;
  lastFetched: Date | null;
  error: string | null;
}

export interface IncomingOutgoingViewProps {
  repoPath: string;
  branch: string;
  remoteBranch?: string;
  onPull?: () => Promise<void>;
  onPush?: () => Promise<void>;
  onFetch?: () => Promise<void>;
  onSync?: () => Promise<void>;
  onCommitSelect?: (commit: CommitInfo) => void;
  onFileSelect?: (path: string, commit: CommitInfo) => void;
  /** External loading state for operations */
  operationLoading?: string | null;
  /** External error state */
  externalError?: string | null;
  /** Incoming commit count from parent (optimization) */
  incomingCount?: number;
  /** Outgoing commit count from parent (optimization) */
  outgoingCount?: number;
}

export interface CommitFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? "just now" : `${diffMins}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function formatFullDate(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileStatusIcon(status: string) {
  switch (status) {
    case "added":
      return <Icon name="plus" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.success }} />;
    case "deleted":
      return <Icon name="minus" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.error }} />;
    case "modified":
      return <Icon name="pen-to-square" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.warning }} />;
    default:
      return <Icon name="file" style={{ width: "12px", height: "12px", color: tokens.colors.icon.default }} />;
  }
}

// ============================================================================
// Commit Detail Panel Component
// ============================================================================

interface CommitDetailPanelProps {
  commit: CommitInfo;
  files: CommitFile[];
  filesLoading: boolean;
  onClose: () => void;
  onFileSelect?: (path: string) => void;
}

function CommitDetailPanel(props: CommitDetailPanelProps) {
  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(props.commit.hash);
    } catch (err) {
      console.error("Failed to copy hash:", err);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: "0",
        background: tokens.colors.surface.panel,
        display: "flex",
        "flex-direction": "column",
        "z-index": "10",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
          "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          "flex-shrink": "0",
        }}
      >
        <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.primary }}>
          Commit Details
        </Text>
        <IconButton size="sm" tooltip="Close" onClick={props.onClose}>
          <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
        </IconButton>
      </div>

      {/* Content */}
      <div style={{ flex: "1", overflow: "auto", padding: tokens.spacing.lg }}>
        {/* Commit info */}
        <div style={{ "margin-bottom": tokens.spacing.lg }}>
          {/* Hash */}
          <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm, "margin-bottom": tokens.spacing.md }}>
            <Icon name="code-commit" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default }} />
            <Text style={{ "font-size": "12px", "font-family": "var(--jb-font-code)", color: tokens.colors.text.primary }}>
              {props.commit.hashShort}
            </Text>
            <IconButton size="sm" tooltip="Copy full hash" onClick={copyHash}>
              <Icon name="copy" style={{ width: "12px", height: "12px" }} />
            </IconButton>
          </div>

          {/* Message */}
          <Text
            style={{
              "font-size": "13px",
              "font-weight": "500",
              color: tokens.colors.text.primary,
              "margin-bottom": tokens.spacing.md,
              "white-space": "pre-wrap",
              "word-break": "break-word",
            }}
          >
            {props.commit.message}
          </Text>

          {/* Author */}
          <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm, "margin-bottom": tokens.spacing.sm }}>
            <Icon name="user" style={{ width: "12px", height: "12px", color: tokens.colors.icon.default }} />
            <Text style={{ "font-size": "11px", color: tokens.colors.text.secondary }}>
              {props.commit.author}
            </Text>
            <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
              &lt;{props.commit.authorEmail}&gt;
            </Text>
          </div>

          {/* Date */}
          <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
            <Icon name="clock" style={{ width: "12px", height: "12px", color: tokens.colors.icon.default }} />
            <Text style={{ "font-size": "11px", color: tokens.colors.text.secondary }}>
              {formatFullDate(props.commit.date)}
            </Text>
            <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
              ({formatRelativeTime(props.commit.date)})
            </Text>
          </div>

          {/* Stats */}
          <Show when={props.commit.filesChanged > 0 || props.commit.insertions > 0 || props.commit.deletions > 0}>
            <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md, "margin-top": tokens.spacing.md }}>
              <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
                {props.commit.filesChanged} file{props.commit.filesChanged !== 1 ? "s" : ""} changed
              </Text>
              <Show when={props.commit.insertions > 0}>
                <Text style={{ "font-size": "11px", color: tokens.colors.semantic.success }}>
                  +{props.commit.insertions}
                </Text>
              </Show>
              <Show when={props.commit.deletions > 0}>
                <Text style={{ "font-size": "11px", color: tokens.colors.semantic.error }}>
                  -{props.commit.deletions}
                </Text>
              </Show>
            </div>
          </Show>
        </div>

        {/* Changed files */}
        <div>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.sm,
              "margin-bottom": tokens.spacing.md,
              padding: `${tokens.spacing.sm} 0`,
              "border-top": `1px solid ${tokens.colors.border.divider}`,
            }}
          >
            <Icon name="file" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default }} />
            <Text style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase", "letter-spacing": "0.5px", color: tokens.colors.text.muted }}>
              Changed Files
            </Text>
            <Show when={!props.filesLoading}>
              <Badge variant="default" size="sm">{props.files.length}</Badge>
            </Show>
          </div>

          <Show when={props.filesLoading}>
            <div style={{ display: "flex", "align-items": "center", "justify-content": "center", padding: tokens.spacing.lg }}>
              <Icon name="spinner" style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite", color: tokens.colors.icon.default }} />
            </div>
          </Show>

          <Show when={!props.filesLoading && props.files.length === 0}>
            <Text style={{ "font-size": "12px", color: tokens.colors.text.muted, padding: tokens.spacing.md }}>
              No file information available
            </Text>
          </Show>

          <Show when={!props.filesLoading && props.files.length > 0}>
            <div style={{ display: "flex", "flex-direction": "column", gap: "1px" }}>
              <For each={props.files}>
                {(file) => (
                  <div
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: tokens.spacing.sm,
                      padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                      "border-radius": tokens.radius.sm,
                      cursor: props.onFileSelect ? "pointer" : "default",
                      transition: "background var(--cortex-transition-fast)",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    onClick={() => props.onFileSelect?.(file.path)}
                  >
                    {getFileStatusIcon(file.status)}
                    <Text
                      style={{
                        flex: "1",
                        "font-size": "12px",
                        color: tokens.colors.text.primary,
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                      }}
                    >
                      {file.path}
                    </Text>
                    <Show when={file.additions > 0}>
                      <Text style={{ "font-size": "10px", color: tokens.colors.semantic.success }}>
                        +{file.additions}
                      </Text>
                    </Show>
                    <Show when={file.deletions > 0}>
                      <Text style={{ "font-size": "10px", color: tokens.colors.semantic.error }}>
                        -{file.deletions}
                      </Text>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Commit List Item Component
// ============================================================================

interface CommitListItemProps {
  commit: CommitInfo;
  selected: boolean;
  onClick: () => void;
}

function CommitListItem(props: CommitListItemProps) {
  return (
    <div
      style={{
        display: "flex",
        "align-items": "flex-start",
        gap: tokens.spacing.md,
        padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
        cursor: "pointer",
        transition: "background var(--cortex-transition-fast)",
        background: props.selected ? tokens.colors.interactive.selected : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!props.selected) e.currentTarget.style.background = tokens.colors.interactive.hover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = props.selected ? tokens.colors.interactive.selected : "transparent";
      }}
      onClick={props.onClick}
    >
      {/* Commit icon */}
      <div
        style={{
          width: "24px",
          height: "24px",
          "border-radius": tokens.radius.full,
          background: tokens.colors.accent.muted,
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          "flex-shrink": "0",
          "margin-top": "2px",
        }}
      >
        <Icon name="code-commit" style={{ width: "12px", height: "12px", color: tokens.colors.accent.primary }} />
      </div>

      {/* Commit info */}
      <div style={{ flex: "1", "min-width": "0" }}>
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm, "margin-bottom": "2px" }}>
          <Text
            style={{
              "font-size": "11px",
              "font-family": "var(--jb-font-code)",
              color: tokens.colors.text.muted,
            }}
          >
            {props.commit.hashShort}
          </Text>
        </div>
        <Text
          style={{
            "font-size": "12px",
            color: tokens.colors.text.primary,
            overflow: "hidden",
            "text-overflow": "ellipsis",
            "white-space": "nowrap",
            "margin-bottom": "2px",
          }}
        >
          {props.commit.message.split("\n")[0]}
        </Text>
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
          <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
            {props.commit.author}
          </Text>
          <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
            {formatRelativeTime(props.commit.date)}
          </Text>
        </div>
      </div>

      {/* Stats */}
      <Show when={props.commit.insertions > 0 || props.commit.deletions > 0}>
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm, "flex-shrink": "0" }}>
          <Show when={props.commit.insertions > 0}>
            <Text style={{ "font-size": "10px", color: tokens.colors.semantic.success }}>
              +{props.commit.insertions}
            </Text>
          </Show>
          <Show when={props.commit.deletions > 0}>
            <Text style={{ "font-size": "10px", color: tokens.colors.semantic.error }}>
              -{props.commit.deletions}
            </Text>
          </Show>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Section Header Component
// ============================================================================

interface SectionHeaderProps {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  icon: "incoming" | "outgoing";
  action?: {
    label: string;
    iconName: string;
    onClick: () => void;
    loading?: boolean;
    disabled?: boolean;
  };
}

function SectionHeader(props: SectionHeaderProps) {
  const iconName = props.icon === "incoming" ? "circle-arrow-down" : "circle-arrow-up";
  const iconColor = props.icon === "incoming" ? tokens.colors.semantic.warning : tokens.colors.semantic.success;

  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        height: "32px",
        padding: `0 ${tokens.spacing.lg}`,
        cursor: "pointer",
        "user-select": "none",
        transition: "background var(--cortex-transition-fast)",
        background: tokens.colors.surface.panel,
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
      onMouseLeave={(e) => e.currentTarget.style.background = tokens.colors.surface.panel}
      onClick={props.onToggle}
    >
      <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
        {props.expanded ? (
          <Icon name="chevron-down" style={{ width: "12px", height: "12px", color: tokens.colors.icon.default }} />
        ) : (
          <Icon name="chevron-right" style={{ width: "12px", height: "12px", color: tokens.colors.icon.default }} />
        )}
        <Icon name={iconName} style={{ width: "14px", height: "14px", color: iconColor }} />
        <Text
          style={{
            "font-size": "11px",
            "font-weight": "600",
            "text-transform": "uppercase",
            "letter-spacing": "0.5px",
            color: tokens.colors.text.muted,
          }}
        >
          {props.title}
        </Text>
        <Show when={props.count > 0}>
          <Badge 
            variant={props.icon === "incoming" ? "warning" : "success"} 
            size="sm"
          >
            {props.count}
          </Badge>
        </Show>
      </div>

      <Show when={props.action && props.count > 0}>
        <Button
          variant="ghost"
          size="sm"
          loading={props.action?.loading}
          disabled={props.action?.disabled}
          onClick={(e) => {
            e.stopPropagation();
            props.action?.onClick();
          }}
          icon={<Icon name={props.action!.iconName} style={{ width: "12px", height: "12px" }} />}
          style={{ "font-size": "10px", height: "22px", padding: "0 8px" }}
        >
          {props.action?.label}
        </Button>
      </Show>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function IncomingOutgoingView(props: IncomingOutgoingViewProps) {
  // State
  const [state, setState] = createSignal<IncomingOutgoingState>({
    incoming: [],
    outgoing: [],
    loading: false,
    lastFetched: null,
    error: null,
  });

  const [incomingExpanded, setIncomingExpanded] = createSignal(true);
  const [outgoingExpanded, setOutgoingExpanded] = createSignal(true);
  const [selectedCommit, setSelectedCommit] = createSignal<CommitInfo | null>(null);
  const [commitFiles, setCommitFiles] = createSignal<CommitFile[]>([]);
  const [filesLoading, setFilesLoading] = createSignal(false);

  // Auto-refresh interval
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  // Computed values
  const incoming = () => state().incoming;
  const outgoing = () => state().outgoing;
  const loading = () => state().loading;
  const error = () => props.externalError || state().error;
  const lastFetched = () => state().lastFetched;

  const isUpToDate = createMemo(() => {
    return incoming().length === 0 && outgoing().length === 0 && !loading() && !error();
  });

  const operationInProgress = createMemo(() => {
    return props.operationLoading === "pull" ||
           props.operationLoading === "push" ||
           props.operationLoading === "fetch" ||
           props.operationLoading === "sync";
  });

  // Fetch incoming/outgoing commits
  const fetchChanges = async () => {
    if (!props.repoPath || !props.branch) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Note: In a real implementation, this would call the backend
      // to get the actual commit data using git rev-list
      // For now, we rely on the parent component to provide counts
      // via props.incomingCount and props.outgoingCount

      setState({
        incoming: [], // Will be populated by backend call
        outgoing: [], // Will be populated by backend call
        loading: false,
        lastFetched: new Date(),
        error: null,
      });
    } catch (err) {
      console.error("Failed to fetch incoming/outgoing changes:", err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: "Failed to fetch changes. Check your connection.",
      }));
    }
  };

  // Fetch files for a commit
  const fetchCommitFiles = async (commit: CommitInfo) => {
    setFilesLoading(true);
    try {
      const files = await gitCommitFiles(props.repoPath, commit.hash);
      setCommitFiles(files as CommitFile[]);
    } catch (err) {
      console.error("Failed to fetch commit files:", err);
      setCommitFiles([]);
    } finally {
      setFilesLoading(false);
    }
  };

  // Event handlers
  const handlePull = async () => {
    if (props.onPull) {
      await props.onPull();
      await fetchChanges();
    }
  };

  const handlePush = async () => {
    if (props.onPush) {
      await props.onPush();
      await fetchChanges();
    }
  };

  const handleFetch = async () => {
    if (props.onFetch) {
      await props.onFetch();
      await fetchChanges();
    }
  };

  const handleSync = async () => {
    if (props.onSync) {
      await props.onSync();
      await fetchChanges();
    }
  };

  const handleRefresh = () => {
    fetchChanges();
  };

  const handleCommitSelect = (commit: CommitInfo) => {
    setSelectedCommit(commit);
    fetchCommitFiles(commit);
    props.onCommitSelect?.(commit);
  };

  const handleCloseDetail = () => {
    setSelectedCommit(null);
    setCommitFiles([]);
  };

  const handleFileSelect = (path: string) => {
    const commit = selectedCommit();
    if (commit && props.onFileSelect) {
      props.onFileSelect(path, commit);
    }
  };

  // Lifecycle
  onMount(() => {
    fetchChanges();

    // Set up auto-refresh every 5 minutes
    refreshInterval = setInterval(fetchChanges, 5 * 60 * 1000);
  });

  onCleanup(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  // Watch for prop changes
  createEffect(() => {
    const path = props.repoPath;
    const branch = props.branch;
    if (path && branch) {
      fetchChanges();
    }
  });

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        "flex-direction": "column",
        position: "relative",
        overflow: "hidden",
        background: tokens.colors.surface.panel,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
          "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          "flex-shrink": "0",
        }}
      >
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
          <Icon name="code-branch" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default }} />
          <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.primary }}>
            {props.branch}
          </Text>
          <Show when={props.remoteBranch && props.remoteBranch !== props.branch}>
            <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
              {props.remoteBranch}
            </Text>
          </Show>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
          {/* Sync button */}
          <Show when={props.onSync && (props.incomingCount || 0) > 0 && (props.outgoingCount || 0) > 0}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSync}
              loading={props.operationLoading === "sync"}
              disabled={operationInProgress()}
              icon={<Icon name="rotate" style={{ width: "12px", height: "12px" }} />}
              style={{ "font-size": "10px" }}
            >
              Sync
            </Button>
          </Show>

          {/* Fetch button */}
          <IconButton
            tooltip="Fetch from remote"
            onClick={handleFetch}
            disabled={operationInProgress()}
          >
            <Show
              when={props.operationLoading === "fetch"}
              fallback={<Icon name="rotate" style={{ width: "14px", height: "14px" }} />}
            >
              <Icon name="spinner" style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />
            </Show>
          </IconButton>

          {/* Refresh button */}
          <IconButton
            tooltip="Refresh"
            onClick={handleRefresh}
            disabled={loading()}
          >
            <Show
              when={loading()}
              fallback={<Icon name="rotate" style={{ width: "14px", height: "14px" }} />}
            >
              <Icon name="spinner" style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />
            </Show>
          </IconButton>
        </div>
      </div>

      {/* Error banner */}
      <Show when={error()}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.md,
            padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
            background: `color-mix(in srgb, ${tokens.colors.semantic.error} 10%, transparent)`,
            color: tokens.colors.semantic.error,
            "font-size": "12px",
          }}
        >
          <Icon name="circle-exclamation" style={{ width: "14px", height: "14px", "flex-shrink": "0" }} />
          <Text as="span" style={{ flex: "1" }}>{error()}</Text>
          <IconButton
            size="sm"
            onClick={() => setState(prev => ({ ...prev, error: null }))}
          >
            <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
          </IconButton>
        </div>
      </Show>

      {/* Content */}
      <div style={{ flex: "1", overflow: "auto" }}>
        {/* Loading state */}
        <Show when={loading() && incoming().length === 0 && outgoing().length === 0}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              height: "128px",
            }}
          >
            <Icon name="spinner" style={{ width: "20px", height: "20px", animation: "spin 1s linear infinite", color: tokens.colors.icon.default }} />
          </div>
        </Show>

        {/* Up-to-date state */}
        <Show when={isUpToDate() && !loading()}>
          <EmptyState
            icon={<Icon name="code-branch" style={{ width: "32px", height: "32px" }} />}
            title="Up to date"
            description={`${props.branch} is synchronized with the remote`}
          />
        </Show>

        {/* Incoming changes section */}
        <Show when={(props.incomingCount ?? incoming().length) > 0 || !isUpToDate()}>
          <div style={{ "border-bottom": `1px solid ${tokens.colors.border.divider}` }}>
            <SectionHeader
              title="Incoming Changes"
              count={props.incomingCount ?? incoming().length}
              expanded={incomingExpanded()}
              onToggle={() => setIncomingExpanded(!incomingExpanded())}
              icon="incoming"
              action={props.onPull ? {
                label: "Pull",
                iconName: "download",
                onClick: handlePull,
                loading: props.operationLoading === "pull",
                disabled: operationInProgress() || (props.incomingCount ?? 0) === 0,
              } : undefined}
            />

            <Show when={incomingExpanded()}>
              <Show when={incoming().length > 0}>
                <For each={incoming()}>
                  {(commit) => (
                    <CommitListItem
                      commit={commit}
                      selected={selectedCommit()?.hash === commit.hash}
                      onClick={() => handleCommitSelect(commit)}
                    />
                  )}
                </For>
              </Show>

              <Show when={incoming().length === 0 && (props.incomingCount ?? 0) > 0}>
                <div style={{ padding: `${tokens.spacing.md} ${tokens.spacing.lg}` }}>
                  <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
                    {props.incomingCount} commit{(props.incomingCount ?? 0) !== 1 ? "s" : ""} to pull
                  </Text>
                </div>
              </Show>

              <Show when={incoming().length === 0 && (props.incomingCount ?? 0) === 0}>
                <div style={{ padding: `${tokens.spacing.md} ${tokens.spacing.lg}` }}>
                  <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
                    No incoming changes
                  </Text>
                </div>
              </Show>
            </Show>
          </div>
        </Show>

        {/* Outgoing changes section */}
        <Show when={(props.outgoingCount ?? outgoing().length) > 0 || !isUpToDate()}>
          <div style={{ "border-bottom": `1px solid ${tokens.colors.border.divider}` }}>
            <SectionHeader
              title="Outgoing Changes"
              count={props.outgoingCount ?? outgoing().length}
              expanded={outgoingExpanded()}
              onToggle={() => setOutgoingExpanded(!outgoingExpanded())}
              icon="outgoing"
              action={props.onPush ? {
                label: "Push",
                iconName: "upload",
                onClick: handlePush,
                loading: props.operationLoading === "push",
                disabled: operationInProgress() || (props.outgoingCount ?? 0) === 0,
              } : undefined}
            />

            <Show when={outgoingExpanded()}>
              <Show when={outgoing().length > 0}>
                <For each={outgoing()}>
                  {(commit) => (
                    <CommitListItem
                      commit={commit}
                      selected={selectedCommit()?.hash === commit.hash}
                      onClick={() => handleCommitSelect(commit)}
                    />
                  )}
                </For>
              </Show>

              <Show when={outgoing().length === 0 && (props.outgoingCount ?? 0) > 0}>
                <div style={{ padding: `${tokens.spacing.md} ${tokens.spacing.lg}` }}>
                  <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
                    {props.outgoingCount} commit{(props.outgoingCount ?? 0) !== 1 ? "s" : ""} to push
                  </Text>
                </div>
              </Show>

              <Show when={outgoing().length === 0 && (props.outgoingCount ?? 0) === 0}>
                <div style={{ padding: `${tokens.spacing.md} ${tokens.spacing.lg}` }}>
                  <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
                    No outgoing changes
                  </Text>
                </div>
              </Show>
            </Show>
          </div>
        </Show>

        {/* Last fetched time */}
        <Show when={lastFetched()}>
          <div
            style={{
              padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
              "text-align": "center",
            }}
          >
            <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
              Last updated: {formatRelativeTime(lastFetched()!)}
            </Text>
          </div>
        </Show>
      </div>

      {/* Commit detail panel */}
      <Show when={selectedCommit()}>
        <CommitDetailPanel
          commit={selectedCommit()!}
          files={commitFiles()}
          filesLoading={filesLoading()}
          onClose={handleCloseDetail}
          onFileSelect={handleFileSelect}
        />
      </Show>

      {/* Spinner keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Compact Incoming/Outgoing Section for GitPanel Sidebar
// ============================================================================

export interface IncomingOutgoingSectionProps {
  incomingCount: number;
  outgoingCount: number;
  onPull?: () => Promise<void>;
  onPush?: () => Promise<void>;
  onShowIncoming?: () => void;
  onShowOutgoing?: () => void;
  operationLoading?: string | null;
}

export function IncomingOutgoingSection(props: IncomingOutgoingSectionProps) {
  const [incomingExpanded, setIncomingExpanded] = createSignal(true);
  const [outgoingExpanded, setOutgoingExpanded] = createSignal(true);

  const operationInProgress = () => {
    return props.operationLoading === "pull" || props.operationLoading === "push";
  };

  return (
    <div>
      {/* Incoming Changes */}
      <Show when={props.incomingCount > 0}>
        <div style={{ "border-bottom": `1px solid ${tokens.colors.border.divider}` }}>
          <SectionHeader
            title="Incoming"
            count={props.incomingCount}
            expanded={incomingExpanded()}
            onToggle={() => setIncomingExpanded(!incomingExpanded())}
            icon="incoming"
            action={props.onPull ? {
              label: "Pull",
              iconName: "download",
              onClick: props.onPull,
              loading: props.operationLoading === "pull",
              disabled: operationInProgress(),
            } : undefined}
          />

          <Show when={incomingExpanded()}>
            <div
              style={{
                padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
              }}
            >
              <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
                {props.incomingCount} commit{props.incomingCount !== 1 ? "s" : ""} to pull
              </Text>
              <Show when={props.onShowIncoming}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={props.onShowIncoming}
                  style={{ "font-size": "10px", padding: "0 6px", height: "20px" }}
                >
                  View
                </Button>
              </Show>
            </div>
          </Show>
        </div>
      </Show>

      {/* Outgoing Changes */}
      <Show when={props.outgoingCount > 0}>
        <div style={{ "border-bottom": `1px solid ${tokens.colors.border.divider}` }}>
          <SectionHeader
            title="Outgoing"
            count={props.outgoingCount}
            expanded={outgoingExpanded()}
            onToggle={() => setOutgoingExpanded(!outgoingExpanded())}
            icon="outgoing"
            action={props.onPush ? {
              label: "Push",
              iconName: "upload",
              onClick: props.onPush,
              loading: props.operationLoading === "push",
              disabled: operationInProgress(),
            } : undefined}
          />

          <Show when={outgoingExpanded()}>
            <div
              style={{
                padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
              }}
            >
              <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
                {props.outgoingCount} commit{props.outgoingCount !== 1 ? "s" : ""} to push
              </Text>
              <Show when={props.onShowOutgoing}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={props.onShowOutgoing}
                  style={{ "font-size": "10px", padding: "0 6px", height: "20px" }}
                >
                  View
                </Button>
              </Show>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export default IncomingOutgoingView;
