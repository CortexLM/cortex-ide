/**
 * Git LFS Manager - Large File Storage management
 * 
 * Provides comprehensive Git LFS management including:
 * - LFS installation status and version
 * - Tracked patterns management
 * - File fetch/pull/push operations
 * - Storage quota monitoring
 * - File locking support
 */

import { createSignal, For, Show, createMemo, onMount, onCleanup } from "solid-js";
import { Icon } from "../ui/Icon";
import { invoke } from "@tauri-apps/api/core";
import {
  Button,
  IconButton,
  Input,
  Badge,
  Text,
  ListItem,
  ProgressBar,
  EmptyState,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from "@/components/ui";
import { tokens } from "@/design-system/tokens";
import { LFSTrackDialog } from "./LFSTrackDialog";

// ============================================================================
// Types
// ============================================================================

/** LFS tracked file information */
export interface LFSFile {
  /** File path relative to repo root */
  path: string;
  /** .gitattributes pattern that matches this file */
  pattern: string;
  /** File size in bytes */
  size: number;
  /** True if file is a pointer (content not fetched) */
  isPointer: boolean;
  /** LFS object ID (SHA256) */
  oid: string;
}

/** LFS lock information */
export interface LFSLock {
  /** Lock ID */
  id: string;
  /** Locked file path */
  path: string;
  /** Lock owner */
  owner: string;
  /** Lock timestamp */
  lockedAt: string;
}

/** LFS storage quota information */
export interface LFSStorageInfo {
  /** Bytes used on remote */
  used: number;
  /** Storage limit (null if unlimited) */
  limit: number | null;
  /** Bandwidth used this period */
  bandwidthUsed: number;
  /** Bandwidth limit (null if unlimited) */
  bandwidthLimit: number | null;
}

/** Overall LFS status for a repository */
export interface LFSStatus {
  /** Whether Git LFS is installed on the system */
  installed: boolean;
  /** LFS version string */
  version: string | null;
  /** Whether LFS is initialized in this repo */
  initialized: boolean;
  /** Tracked file patterns from .gitattributes */
  trackedPatterns: string[];
  /** LFS tracked files */
  trackedFiles: LFSFile[];
  /** Large files not tracked by LFS */
  untrackedLargeFiles: string[];
  /** Current locks */
  locks: LFSLock[];
  /** Storage information */
  storage: LFSStorageInfo | null;
}

/** Props for GitLFSManager component */
export interface GitLFSManagerProps {
  /** Repository path */
  repoPath: string;
  /** Callback when manager should close */
  onClose?: () => void;
}

// ============================================================================
// Tauri API Functions
// ============================================================================

async function getLFSStatus(repoPath: string): Promise<LFSStatus> {
  try {
    return await invoke<LFSStatus>("git_lfs_status", { path: repoPath });
  } catch (err) {
    console.error("[LFS] Failed to get status:", err);
    // Return default status if LFS commands fail
    return {
      installed: false,
      version: null,
      initialized: false,
      trackedPatterns: [],
      trackedFiles: [],
      untrackedLargeFiles: [],
      locks: [],
      storage: null,
    };
  }
}

async function initLFS(repoPath: string): Promise<void> {
  return invoke("git_lfs_init", { path: repoPath });
}

async function trackPattern(repoPath: string, pattern: string, migrate: boolean = false): Promise<void> {
  return invoke("git_lfs_track", { path: repoPath, pattern, migrate });
}

async function untrackPattern(repoPath: string, pattern: string): Promise<void> {
  return invoke("git_lfs_untrack", { path: repoPath, pattern });
}

async function fetchLFSFiles(repoPath: string, include?: string[], exclude?: string[]): Promise<void> {
  return invoke("git_lfs_fetch", { path: repoPath, include, exclude });
}

async function pullLFSFiles(repoPath: string, include?: string[], exclude?: string[]): Promise<void> {
  return invoke("git_lfs_pull", { path: repoPath, include, exclude });
}

async function pushLFSFiles(repoPath: string): Promise<void> {
  return invoke("git_lfs_push", { path: repoPath });
}

async function pruneLFSFiles(repoPath: string, dryRun: boolean = false): Promise<string[]> {
  return invoke("git_lfs_prune", { path: repoPath, dryRun });
}

async function lockFile(repoPath: string, filePath: string): Promise<void> {
  return invoke("git_lfs_lock", { path: repoPath, filePath });
}

async function unlockFile(repoPath: string, filePath: string, force: boolean = false): Promise<void> {
  return invoke("git_lfs_unlock", { path: repoPath, filePath, force });
}

// Prepared for locks feature (future use)
// async function getLFSLocks(repoPath: string): Promise<LFSLock[]> {
//   return invoke("git_lfs_locks", { path: repoPath });
// }

// ============================================================================
// Helper Functions
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getFileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1];
}

function getFileDir(path: string): string {
  const parts = path.split(/[/\\]/);
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

// ============================================================================
// Component
// ============================================================================

export function GitLFSManager(props: GitLFSManagerProps) {
  const [status, setStatus] = createSignal<LFSStatus | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [operationLoading, setOperationLoading] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [activeTab, setActiveTab] = createSignal("files");
  const [showTrackDialog, setShowTrackDialog] = createSignal(false);
  const [selectedFiles, setSelectedFiles] = createSignal<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = createSignal("");
  const [expandedSections, setExpandedSections] = createSignal({
    tracked: true,
    untracked: true,
    locks: true,
  });
  const [prunePreview, setPrunePreview] = createSignal<string[] | null>(null);

  // Load LFS status on mount and listen for command palette events
  onMount(() => {
    refreshStatus();
    
    // Event handlers for command palette integration
    const handleOpenTrackDialog = () => {
      if (status()?.initialized) {
        setShowTrackDialog(true);
      }
    };
    
    const handleFetchEvent = () => {
      if (status()?.initialized && !operationLoading()) {
        handleFetch();
      }
    };
    
    const handlePullEvent = () => {
      if (status()?.initialized && !operationLoading()) {
        handlePull();
      }
    };
    
    const handlePushEvent = () => {
      if (status()?.initialized && !operationLoading()) {
        handlePush();
      }
    };
    
    window.addEventListener("lfs:open-track-dialog", handleOpenTrackDialog);
    window.addEventListener("lfs:fetch", handleFetchEvent);
    window.addEventListener("lfs:pull", handlePullEvent);
    window.addEventListener("lfs:push", handlePushEvent);
    
    onCleanup(() => {
      window.removeEventListener("lfs:open-track-dialog", handleOpenTrackDialog);
      window.removeEventListener("lfs:fetch", handleFetchEvent);
      window.removeEventListener("lfs:pull", handlePullEvent);
      window.removeEventListener("lfs:push", handlePushEvent);
    });
  });

  const refreshStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const lfsStatus = await getLFSStatus(props.repoPath);
      setStatus(lfsStatus);
    } catch (err) {
      setError(`Failed to get LFS status: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Initialize LFS in repository
  const handleInitLFS = async () => {
    setOperationLoading("init");
    setError(null);
    try {
      await initLFS(props.repoPath);
      await refreshStatus();
    } catch (err) {
      setError(`Failed to initialize LFS: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  // Track a new pattern
  const handleTrackPattern = async (pattern: string, migrate: boolean) => {
    setOperationLoading("track");
    setError(null);
    try {
      await trackPattern(props.repoPath, pattern, migrate);
      await refreshStatus();
      setShowTrackDialog(false);
    } catch (err) {
      setError(`Failed to track pattern: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  // Untrack a pattern
  const handleUntrackPattern = async (pattern: string) => {
    if (!confirm(`Remove LFS tracking for "${pattern}"? Existing files will remain as LFS objects.`)) {
      return;
    }
    setOperationLoading(`untrack-${pattern}`);
    setError(null);
    try {
      await untrackPattern(props.repoPath, pattern);
      await refreshStatus();
    } catch (err) {
      setError(`Failed to untrack pattern: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  // Fetch LFS files
  const handleFetch = async () => {
    setOperationLoading("fetch");
    setError(null);
    try {
      const selected = Array.from(selectedFiles());
      await fetchLFSFiles(props.repoPath, selected.length > 0 ? selected : undefined);
      await refreshStatus();
    } catch (err) {
      setError(`Failed to fetch LFS files: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  // Pull LFS files
  const handlePull = async () => {
    setOperationLoading("pull");
    setError(null);
    try {
      const selected = Array.from(selectedFiles());
      await pullLFSFiles(props.repoPath, selected.length > 0 ? selected : undefined);
      await refreshStatus();
    } catch (err) {
      setError(`Failed to pull LFS files: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  // Push LFS files
  const handlePush = async () => {
    setOperationLoading("push");
    setError(null);
    try {
      await pushLFSFiles(props.repoPath);
      await refreshStatus();
    } catch (err) {
      setError(`Failed to push LFS files: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  // Preview prune
  const handlePrunePreview = async () => {
    setOperationLoading("prune-preview");
    setError(null);
    try {
      const files = await pruneLFSFiles(props.repoPath, true);
      setPrunePreview(files);
    } catch (err) {
      setError(`Failed to preview prune: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  // Execute prune
  const handlePrune = async () => {
    if (!confirm("This will permanently delete old LFS files from local storage. Continue?")) {
      return;
    }
    setOperationLoading("prune");
    setError(null);
    try {
      await pruneLFSFiles(props.repoPath, false);
      setPrunePreview(null);
      await refreshStatus();
    } catch (err) {
      setError(`Failed to prune LFS files: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  // Lock a file
  const handleLock = async (filePath: string) => {
    setOperationLoading(`lock-${filePath}`);
    setError(null);
    try {
      await lockFile(props.repoPath, filePath);
      await refreshStatus();
    } catch (err) {
      setError(`Failed to lock file: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  // Unlock a file
  const handleUnlock = async (filePath: string, force: boolean = false) => {
    setOperationLoading(`unlock-${filePath}`);
    setError(null);
    try {
      await unlockFile(props.repoPath, filePath, force);
      await refreshStatus();
    } catch (err) {
      setError(`Failed to unlock file: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  // Toggle file selection
  const toggleFileSelection = (path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Toggle section expansion
  const toggleSection = (section: "tracked" | "untracked" | "locks") => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Filter files by search query
  const filteredFiles = createMemo(() => {
    const query = searchQuery().toLowerCase();
    const s = status();
    if (!s || !query) return s?.trackedFiles || [];
    return s.trackedFiles.filter(
      (f) => f.path.toLowerCase().includes(query) || f.pattern.toLowerCase().includes(query)
    );
  });

  // Compute storage percentage
  const storagePercentage = createMemo(() => {
    const s = status()?.storage;
    if (!s || !s.limit) return null;
    return Math.min(100, (s.used / s.limit) * 100);
  });

  // Count pointer files (not fetched)
  const pointerFileCount = createMemo(() => {
    return status()?.trackedFiles.filter((f) => f.isPointer).length || 0;
  });

  // Render section header
  const SectionHeader = (props: {
    title: string;
    count: number;
    expanded: boolean;
    onToggle: () => void;
  }) => (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        height: "32px",
        padding: "0 12px",
        cursor: "pointer",
        "user-select": "none",
        background: tokens.colors.surface.panel,
        "border-bottom": `1px solid ${tokens.colors.border.divider}`,
      }}
      onClick={props.onToggle}
    >
      <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
        {props.expanded ? (
          <Icon name="chevron-down" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default }} />
        ) : (
          <Icon name="chevron-right" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default }} />
        )}
        <Text
          style={{
            "font-size": "12px",
            "font-weight": "600",
            "text-transform": "uppercase",
            "letter-spacing": "0.5px",
            color: tokens.colors.text.muted,
          }}
        >
          {props.title}
        </Text>
        <Badge variant="default" size="sm">
          {props.count}
        </Badge>
      </div>
    </div>
  );

  // Loading state
  if (loading()) {
    return (
      <div
        style={{
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          "justify-content": "center",
          padding: "48px",
          gap: tokens.spacing.lg,
        }}
      >
        <Icon
          name="spinner"
          style={{
            width: "32px",
            height: "32px",
            animation: "spin 1s linear infinite",
            color: tokens.colors.icon.default,
          }}
        />
        <Text style={{ color: tokens.colors.text.muted }}>Loading LFS status...</Text>
      </div>
    );
  }

  // LFS not installed
  if (!status()?.installed) {
    return (
      <EmptyState
        icon={<Icon name="circle-exclamation" style={{ width: "48px", height: "48px" }} />}
        title="Git LFS Not Installed"
        description="Git Large File Storage is not installed on your system. Install it to manage large files efficiently."
        action={
          <Button
            variant="primary"
            onClick={() => window.open("https://git-lfs.github.com/", "_blank")}
          >
            Download Git LFS
          </Button>
        }
      />
    );
  }

  // LFS not initialized in repo
  if (!status()?.initialized) {
    return (
      <div style={{ padding: "24px", "text-align": "center" }}>
        <Icon
          name="cloud"
          style={{
            width: "48px",
            height: "48px",
            margin: "0 auto 16px",
            color: tokens.colors.text.muted,
          }}
        />
        <Text
          style={{
            display: "block",
            "font-size": "16px",
            "font-weight": "500",
            "margin-bottom": "8px",
            color: tokens.colors.text.primary,
          }}
        >
          Initialize Git LFS
        </Text>
        <Text
          style={{
            display: "block",
            "font-size": "13px",
            "margin-bottom": "24px",
            color: tokens.colors.text.muted,
          }}
        >
          Git LFS is installed (v{status()?.version}) but not initialized in this repository.
        </Text>
        <Button
          variant="primary"
          loading={operationLoading() === "init"}
          onClick={handleInitLFS}
        >
          Initialize LFS
        </Button>
        <Show when={error()}>
          <div
            style={{
              "margin-top": "16px",
              padding: "12px",
              background: `color-mix(in srgb, ${tokens.colors.semantic.error} 10%, transparent)`,
              "border-radius": tokens.radius.md,
              color: tokens.colors.semantic.error,
              "font-size": "12px",
            }}
          >
            {error()}
          </div>
        </Show>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        background: tokens.colors.surface.base,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "12px 16px",
          "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          background: tokens.colors.surface.panel,
        }}
      >
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
          <Icon name="cloud" style={{ width: "20px", height: "20px", color: tokens.colors.semantic.primary }} />
          <div>
            <Text style={{ "font-size": "14px", "font-weight": "600", color: tokens.colors.text.primary }}>
              Git LFS
            </Text>
            <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
              v{status()?.version}
            </Text>
          </div>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
          <IconButton tooltip="Refresh" onClick={refreshStatus} disabled={!!operationLoading()}>
            <Show
              when={loading()}
              fallback={<Icon name="rotate" style={{ width: "16px", height: "16px" }} />}
            >
              <Icon name="spinner" style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
            </Show>
          </IconButton>
          <Show when={props.onClose}>
            <IconButton tooltip="Close" onClick={props.onClose}>
              <Icon name="xmark" style={{ width: "16px", height: "16px" }} />
            </IconButton>
          </Show>
        </div>
      </div>

      {/* Error banner */}
      <Show when={error()}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.md,
            padding: "8px 16px",
            background: `color-mix(in srgb, ${tokens.colors.semantic.error} 10%, transparent)`,
            color: tokens.colors.semantic.error,
            "font-size": "12px",
          }}
        >
          <Icon name="circle-exclamation" style={{ width: "14px", height: "14px", "flex-shrink": "0" }} />
          <Text style={{ flex: "1" }}>{error()}</Text>
          <IconButton size="sm" onClick={() => setError(null)}>
            <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
          </IconButton>
        </div>
      </Show>

      {/* Storage info bar */}
      <Show when={status()?.storage}>
        <div
          style={{
            padding: "12px 16px",
            "border-bottom": `1px solid ${tokens.colors.border.divider}`,
            background: tokens.colors.surface.panel,
          }}
        >
          <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "8px" }}>
            <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
              <Icon name="hard-drive" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default }} />
              <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>Storage</Text>
            </div>
            <Text style={{ "font-size": "12px", color: tokens.colors.text.primary }}>
              {formatBytes(status()!.storage!.used)}
              <Show when={status()!.storage!.limit}>
                {" / "}{formatBytes(status()!.storage!.limit!)}
              </Show>
            </Text>
          </div>
          <Show when={storagePercentage() !== null}>
            <ProgressBar
              value={storagePercentage()!}
              variant={storagePercentage()! > 90 ? "error" : storagePercentage()! > 75 ? "primary" : "default"}
              size="sm"
            />
          </Show>
        </div>
      </Show>

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: tokens.spacing.sm,
          padding: "8px 16px",
          "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          "flex-wrap": "wrap",
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          loading={operationLoading() === "fetch"}
          onClick={handleFetch}
          disabled={!!operationLoading()}
          icon={<Icon name="download" style={{ width: "14px", height: "14px" }} />}
        >
          Fetch
        </Button>
        <Button
          variant="ghost"
          size="sm"
          loading={operationLoading() === "pull"}
          onClick={handlePull}
          disabled={!!operationLoading()}
          icon={<Icon name="download" style={{ width: "14px", height: "14px" }} />}
        >
          Pull
        </Button>
        <Button
          variant="ghost"
          size="sm"
          loading={operationLoading() === "push"}
          onClick={handlePush}
          disabled={!!operationLoading()}
          icon={<Icon name="upload" style={{ width: "14px", height: "14px" }} />}
        >
          Push
        </Button>
        <div style={{ flex: "1" }} />
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowTrackDialog(true)}
          disabled={!!operationLoading()}
          icon={<Icon name="plus" style={{ width: "14px", height: "14px" }} />}
        >
          Track Pattern
        </Button>
      </div>

      {/* Tabs */}
      <Tabs activeTab={activeTab()} onChange={setActiveTab}>
        <TabList>
          <Tab id="files">
            Files
            <Show when={pointerFileCount() > 0}>
              <Badge variant="warning" size="sm" style={{ "margin-left": "6px" }}>
                {pointerFileCount()}
              </Badge>
            </Show>
          </Tab>
          <Tab id="patterns">
            Patterns
            <Badge variant="default" size="sm" style={{ "margin-left": "6px" }}>
              {status()?.trackedPatterns.length || 0}
            </Badge>
          </Tab>
          <Tab id="locks">
            Locks
            <Show when={(status()?.locks.length || 0) > 0}>
              <Badge variant="warning" size="sm" style={{ "margin-left": "6px" }}>
                {status()?.locks.length}
              </Badge>
            </Show>
          </Tab>
          <Tab id="storage">Storage</Tab>
        </TabList>

        {/* Files Tab */}
        <TabPanel id="files">
          <div style={{ height: "100%", "overflow-y": "auto" }}>
            {/* Search */}
            <div style={{ padding: "8px 16px" }}>
              <Input
                placeholder="Search files..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                icon={<Icon name="magnifying-glass" style={{ width: "14px", height: "14px" }} />}
              />
            </div>

            {/* Tracked files */}
            <SectionHeader
              title="LFS Files"
              count={filteredFiles().length}
              expanded={expandedSections().tracked}
              onToggle={() => toggleSection("tracked")}
            />
            <Show when={expandedSections().tracked}>
              <Show
                when={filteredFiles().length > 0}
                fallback={
                  <div style={{ padding: "16px", "text-align": "center" }}>
                    <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
                      No LFS files found
                    </Text>
                  </div>
                }
              >
                <For each={filteredFiles()}>
                  {(file) => (
                    <ListItem
                      icon={
                        file.isPointer ? (
                          <Icon name="download" style={{ width: "14px", height: "14px", color: tokens.colors.semantic.warning }} />
                        ) : (
                          <Icon name="check" style={{ width: "14px", height: "14px", color: tokens.colors.semantic.success }} />
                        )
                      }
                      label={getFileName(file.path)}
                      description={getFileDir(file.path) || undefined}
                      selected={selectedFiles().has(file.path)}
                      onClick={() => toggleFileSelection(file.path)}
                      iconRight={
                        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
                          <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
                            {formatBytes(file.size)}
                          </Text>
                          <Show when={file.isPointer}>
                            <Badge variant="warning" size="sm">Pointer</Badge>
                          </Show>
                          <IconButton
                            size="sm"
                            tooltip="Lock file"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLock(file.path);
                            }}
                            disabled={operationLoading()?.startsWith("lock")}
                          >
                            <Icon name="lock" style={{ width: "12px", height: "12px" }} />
                          </IconButton>
                        </div>
                      }
                    />
                  )}
                </For>
              </Show>
            </Show>

            {/* Untracked large files */}
            <Show when={(status()?.untrackedLargeFiles.length || 0) > 0}>
              <SectionHeader
                title="Large Files (Not LFS)"
                count={status()!.untrackedLargeFiles.length}
                expanded={expandedSections().untracked}
                onToggle={() => toggleSection("untracked")}
              />
              <Show when={expandedSections().untracked}>
                <For each={status()!.untrackedLargeFiles}>
                  {(filePath) => (
                    <ListItem
                      icon={<Icon name="triangle-exclamation" style={{ width: "14px", height: "14px", color: tokens.colors.semantic.warning }} />}
                      label={getFileName(filePath)}
                      description={getFileDir(filePath) || undefined}
                      iconRight={
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Suggest tracking pattern based on extension
                            const ext = filePath.split(".").pop();
                            if (ext) {
                              setShowTrackDialog(true);
                            }
                          }}
                        >
                          Track
                        </Button>
                      }
                    />
                  )}
                </For>
              </Show>
            </Show>
          </div>
        </TabPanel>

        {/* Patterns Tab */}
        <TabPanel id="patterns">
          <div style={{ height: "100%", "overflow-y": "auto" }}>
            <Show
              when={(status()?.trackedPatterns.length || 0) > 0}
              fallback={
                <div style={{ padding: "32px 16px", "text-align": "center" }}>
                  <Icon
                    name="file"
                    style={{
                      width: "32px",
                      height: "32px",
                      margin: "0 auto 12px",
                      color: tokens.colors.text.muted,
                    }}
                  />
                  <Text style={{ display: "block", "font-size": "13px", color: tokens.colors.text.muted }}>
                    No patterns tracked
                  </Text>
                  <Text style={{ display: "block", "font-size": "12px", "margin-top": "4px", color: tokens.colors.text.muted }}>
                    Track patterns like *.psd, *.zip, *.mp4
                  </Text>
                </div>
              }
            >
              <For each={status()!.trackedPatterns}>
                {(pattern) => (
                  <ListItem
                    icon={<Icon name="file" style={{ width: "14px", height: "14px" }} />}
                    label={pattern}
                    iconRight={
                      <IconButton
                        size="sm"
                        tooltip="Untrack pattern"
                        onClick={() => handleUntrackPattern(pattern)}
                        disabled={operationLoading() === `untrack-${pattern}`}
                      >
                        <Show
                          when={operationLoading() === `untrack-${pattern}`}
                          fallback={<Icon name="trash" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.error }} />}
                        >
                          <Icon name="spinner" style={{ width: "12px", height: "12px", animation: "spin 1s linear infinite" }} />
                        </Show>
                      </IconButton>
                    }
                  />
                )}
              </For>
            </Show>
          </div>
        </TabPanel>

        {/* Locks Tab */}
        <TabPanel id="locks">
          <div style={{ height: "100%", "overflow-y": "auto" }}>
            <Show
              when={(status()?.locks.length || 0) > 0}
              fallback={
                <div style={{ padding: "32px 16px", "text-align": "center" }}>
                  <Icon
                    name="lock-open"
                    style={{
                      width: "32px",
                      height: "32px",
                      margin: "0 auto 12px",
                      color: tokens.colors.text.muted,
                    }}
                  />
                  <Text style={{ display: "block", "font-size": "13px", color: tokens.colors.text.muted }}>
                    No locked files
                  </Text>
                  <Text style={{ display: "block", "font-size": "12px", "margin-top": "4px", color: tokens.colors.text.muted }}>
                    Lock files to prevent conflicts when editing
                  </Text>
                </div>
              }
            >
              <For each={status()!.locks}>
                {(lock) => (
                  <ListItem
                    icon={<Icon name="lock" style={{ width: "14px", height: "14px", color: tokens.colors.semantic.warning }} />}
                    label={getFileName(lock.path)}
                    description={`Locked by ${lock.owner}`}
                    iconRight={
                      <IconButton
                        size="sm"
                        tooltip="Unlock"
                        onClick={() => handleUnlock(lock.path)}
                        disabled={operationLoading() === `unlock-${lock.path}`}
                      >
                        <Show
                          when={operationLoading() === `unlock-${lock.path}`}
                          fallback={<Icon name="lock-open" style={{ width: "12px", height: "12px" }} />}
                        >
                          <Icon name="spinner" style={{ width: "12px", height: "12px", animation: "spin 1s linear infinite" }} />
                        </Show>
                      </IconButton>
                    }
                  />
                )}
              </For>
            </Show>
          </div>
        </TabPanel>

        {/* Storage Tab */}
        <TabPanel id="storage">
          <div style={{ padding: "16px" }}>
            <Show
              when={status()?.storage}
              fallback={
                <div style={{ "text-align": "center", padding: "32px 0" }}>
                  <Text style={{ color: tokens.colors.text.muted }}>
                    Storage information not available
                  </Text>
                </div>
              }
            >
              <div style={{ "margin-bottom": "24px" }}>
                <Text style={{ display: "block", "font-size": "14px", "font-weight": "500", "margin-bottom": "12px", color: tokens.colors.text.primary }}>
                  Remote Storage
                </Text>
                <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "16px" }}>
                  <div
                    style={{
                      padding: "16px",
                      background: tokens.colors.surface.panel,
                      "border-radius": tokens.radius.md,
                      border: `1px solid ${tokens.colors.border.divider}`,
                    }}
                  >
                    <Text style={{ "font-size": "11px", "text-transform": "uppercase", color: tokens.colors.text.muted }}>
                      Used
                    </Text>
                    <Text style={{ display: "block", "font-size": "20px", "font-weight": "600", "margin-top": "4px", color: tokens.colors.text.primary }}>
                      {formatBytes(status()!.storage!.used)}
                    </Text>
                  </div>
                  <div
                    style={{
                      padding: "16px",
                      background: tokens.colors.surface.panel,
                      "border-radius": tokens.radius.md,
                      border: `1px solid ${tokens.colors.border.divider}`,
                    }}
                  >
                    <Text style={{ "font-size": "11px", "text-transform": "uppercase", color: tokens.colors.text.muted }}>
                      Limit
                    </Text>
                    <Text style={{ display: "block", "font-size": "20px", "font-weight": "600", "margin-top": "4px", color: tokens.colors.text.primary }}>
                      {status()!.storage!.limit ? formatBytes(status()!.storage!.limit!) : "Unlimited"}
                    </Text>
                  </div>
                </div>
              </div>

              {/* Prune section */}
              <div>
                <Text style={{ display: "block", "font-size": "14px", "font-weight": "500", "margin-bottom": "12px", color: tokens.colors.text.primary }}>
                  Local Cleanup
                </Text>
                <Text style={{ display: "block", "font-size": "12px", "margin-bottom": "12px", color: tokens.colors.text.muted }}>
                  Remove old LFS files from local storage that are no longer needed.
                </Text>
                <div style={{ display: "flex", gap: tokens.spacing.sm }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={operationLoading() === "prune-preview"}
                    onClick={handlePrunePreview}
                    disabled={!!operationLoading()}
                  >
                    Preview Cleanup
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={operationLoading() === "prune"}
                    onClick={handlePrune}
                    disabled={!!operationLoading() || !prunePreview()}
                  >
                    Clean Up
                  </Button>
                </div>

                <Show when={prunePreview()}>
                  <div
                    style={{
                      "margin-top": "16px",
                      padding: "12px",
                      background: tokens.colors.surface.panel,
                      "border-radius": tokens.radius.md,
                      border: `1px solid ${tokens.colors.border.divider}`,
                      "max-height": "200px",
                      "overflow-y": "auto",
                    }}
                  >
                    <Text style={{ display: "block", "font-size": "11px", "font-weight": "600", "margin-bottom": "8px", color: tokens.colors.text.muted }}>
                      Files to remove ({prunePreview()!.length})
                    </Text>
                    <Show
                      when={prunePreview()!.length > 0}
                      fallback={
                        <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
                          No files to clean up
                        </Text>
                      }
                    >
                      <For each={prunePreview()!}>
                        {(file) => (
                          <Text style={{ display: "block", "font-size": "11px", "font-family": "monospace", color: tokens.colors.text.primary }}>
                            {file}
                          </Text>
                        )}
                      </For>
                    </Show>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </TabPanel>
      </Tabs>

      {/* Track Dialog */}
      <LFSTrackDialog
        open={showTrackDialog()}
        repoPath={props.repoPath}
        onTrack={handleTrackPattern}
        onCancel={() => setShowTrackDialog(false)}
      />

      {/* Keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default GitLFSManager;
