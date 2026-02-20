/**
 * Git Worktree Manager - Manage multiple working directories
 *
 * Worktrees allow working on multiple branches simultaneously
 * without stashing or switching. This component provides a full
 * UI for managing git worktrees.
 */

import { createSignal, For, Show, onMount, onCleanup, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import {
  gitWorktreeList,
  gitWorktreeAdd,
  gitWorktreeRemove,
  gitWorktreeLock,
  gitWorktreeUnlock,
  gitWorktreeMove,
  gitWorktreeRepair,
  gitWorktreePrune,
  gitStatus,
  type GitWorktree,
} from "../../utils/tauri-api";
import {
  Button,
  IconButton,
  Input,
  Badge,
  Text,
  Modal,
} from "@/components/ui";
import { tokens } from "@/design-system/tokens";
import { AddWorktreeDialog } from "./AddWorktreeDialog";

export interface WorktreeManagerProps {
  repoPath: string;
  onClose?: () => void;
  onWorktreeSelect?: (worktree: GitWorktree) => void;
  onOpenInNewWindow?: (worktree: GitWorktree) => void;
}

export function WorktreeManager(props: WorktreeManagerProps) {
  const [worktrees, setWorktrees] = createSignal<GitWorktree[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [expandedWorktree, setExpandedWorktree] = createSignal<string | null>(null);
  const [showAddDialog, setShowAddDialog] = createSignal(false);
  const [operationLoading, setOperationLoading] = createSignal<string | null>(null);

  // Confirmation dialogs
  const [confirmRemove, setConfirmRemove] = createSignal<GitWorktree | null>(null);
  const [showMoveDialog, setShowMoveDialog] = createSignal<GitWorktree | null>(null);
  const [newMovePath, setNewMovePath] = createSignal("");

  // Worktree status cache (dirty/clean)
  const [worktreeStatus, setWorktreeStatus] = createSignal<Record<string, boolean>>({});

  onMount(() => {
    fetchWorktrees();
    
    // Event handlers for command palette integration
    const handleOpenAddDialog = () => {
      setShowAddDialog(true);
    };
    
    window.addEventListener("worktree:open-add-dialog", handleOpenAddDialog);
    
    onCleanup(() => {
      window.removeEventListener("worktree:open-add-dialog", handleOpenAddDialog);
    });
  });

  const fetchWorktrees = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gitWorktreeList(props.repoPath);
      setWorktrees(data);

      // Check status for each worktree
      const statusMap: Record<string, boolean> = {};
      for (const wt of data) {
        try {
          const status = await gitStatus(wt.path);
          const isDirty =
            status.staged.length > 0 ||
            status.unstaged.length > 0 ||
            status.untracked.length > 0;
          statusMap[wt.path] = isDirty;
        } catch {
          // If we can't get status, assume clean
          statusMap[wt.path] = false;
        }
      }
      setWorktreeStatus(statusMap);
    } catch (err) {
      console.error("Failed to fetch worktrees:", err);
      setError(`Failed to load worktrees: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredWorktrees = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return worktrees();

    return worktrees().filter(
      (wt) =>
        wt.path.toLowerCase().includes(query) ||
        wt.branch?.toLowerCase().includes(query) ||
        wt.commit.toLowerCase().includes(query)
    );
  });

  const addWorktree = async (
    path: string,
    branch: string | null,
    createBranch: boolean,
    commitish?: string,
    force?: boolean,
    track?: string
  ) => {
    setOperationLoading("add");
    try {
      await gitWorktreeAdd(props.repoPath, path, {
        branch,
        createBranch,
        commitish,
        force,
        track,
      });
      setShowAddDialog(false);
      await fetchWorktrees();
    } catch (err) {
      console.error("Failed to add worktree:", err);
      setError(`Failed to add worktree: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  const removeWorktree = async (worktree: GitWorktree, force: boolean = false) => {
    setOperationLoading(`remove-${worktree.path}`);
    try {
      await gitWorktreeRemove(props.repoPath, worktree.path, force);
      setConfirmRemove(null);
      await fetchWorktrees();
    } catch (err) {
      console.error("Failed to remove worktree:", err);
      setError(`Failed to remove worktree: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  const lockWorktree = async (worktree: GitWorktree, reason?: string) => {
    setOperationLoading(`lock-${worktree.path}`);
    try {
      await gitWorktreeLock(props.repoPath, worktree.path, reason);
      await fetchWorktrees();
    } catch (err) {
      console.error("Failed to lock worktree:", err);
      setError(`Failed to lock worktree: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  const unlockWorktree = async (worktree: GitWorktree) => {
    setOperationLoading(`unlock-${worktree.path}`);
    try {
      await gitWorktreeUnlock(props.repoPath, worktree.path);
      await fetchWorktrees();
    } catch (err) {
      console.error("Failed to unlock worktree:", err);
      setError(`Failed to unlock worktree: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  const moveWorktree = async (worktree: GitWorktree, newPath: string) => {
    setOperationLoading(`move-${worktree.path}`);
    try {
      await gitWorktreeMove(props.repoPath, worktree.path, newPath);
      setShowMoveDialog(null);
      setNewMovePath("");
      await fetchWorktrees();
    } catch (err) {
      console.error("Failed to move worktree:", err);
      setError(`Failed to move worktree: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  const repairWorktrees = async () => {
    setOperationLoading("repair");
    try {
      await gitWorktreeRepair(props.repoPath);
      await fetchWorktrees();
    } catch (err) {
      console.error("Failed to repair worktrees:", err);
      setError(`Failed to repair worktrees: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  const pruneWorktrees = async () => {
    setOperationLoading("prune");
    try {
      await gitWorktreePrune(props.repoPath);
      await fetchWorktrees();
    } catch (err) {
      console.error("Failed to prune worktrees:", err);
      setError(`Failed to prune worktrees: ${err}`);
    } finally {
      setOperationLoading(null);
    }
  };

  const openInNewWindow = (worktree: GitWorktree) => {
    props.onOpenInNewWindow?.(worktree);
    // Dispatch event to open worktree in new window
    window.dispatchEvent(
      new CustomEvent("command:workbench.openWorktree", {
        detail: { path: worktree.path },
      })
    );
  };

  const toggleExpanded = (path: string) => {
    setExpandedWorktree(expandedWorktree() === path ? null : path);
  };

  const getWorktreeName = (path: string): string => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1];
  };

  // Helper for potential future use (e.g., path navigation)
  // const getParentPath = (path: string): string => {
  //   const parts = path.split(/[/\\]/);
  //   if (parts.length <= 1) return "";
  //   return parts.slice(0, -1).join("/");
  // };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        "flex-direction": "column",
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
          padding: `0 ${tokens.spacing.lg}`,
          height: "36px",
          "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          "flex-shrink": "0",
        }}
      >
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
          <Icon name="folder" size={16} style={{ color: tokens.colors.icon.default }} />
          <Text style={{ "font-size": "13px", "font-weight": "600", color: tokens.colors.text.primary }}>
            Worktrees
          </Text>
          <Badge variant="default" size="sm">
            {worktrees().length}
          </Badge>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "2px" }}>
          <IconButton
            tooltip="Add Worktree"
            onClick={() => setShowAddDialog(true)}
            disabled={!!operationLoading()}
          >
            <Icon name="plus" size={16} />
          </IconButton>
          <IconButton
            tooltip="Repair Worktrees"
            onClick={repairWorktrees}
            disabled={!!operationLoading()}
          >
            <Show
              when={operationLoading() !== "repair"}
              fallback={<Icon name="spinner" size={16} style={{ animation: "spin 1s linear infinite" }} />}
            >
              <Icon name="wrench" size={16} />
            </Show>
          </IconButton>
          <IconButton
            tooltip="Prune Stale Worktrees"
            onClick={pruneWorktrees}
            disabled={!!operationLoading()}
          >
            <Show
              when={operationLoading() !== "prune"}
              fallback={<Icon name="spinner" size={16} style={{ animation: "spin 1s linear infinite" }} />}
            >
              <Icon name="trash" size={16} />
            </Show>
          </IconButton>
          <IconButton
            tooltip="Refresh"
            onClick={fetchWorktrees}
            disabled={loading()}
          >
            <Icon name="rotate" size={16} style={{ animation: loading() ? "spin 1s linear infinite" : undefined }} />
          </IconButton>
        </div>
      </div>

      {/* Search */}
      <Show when={worktrees().length > 2}>
        <div style={{ padding: `${tokens.spacing.md} ${tokens.spacing.lg}` }}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.md,
              padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
              background: tokens.colors.surface.canvas,
              "border-radius": tokens.radius.md,
              border: `1px solid ${tokens.colors.border.default}`,
            }}
          >
            <Icon name="magnifying-glass" size={14} style={{ color: tokens.colors.icon.inactive, "flex-shrink": "0" }} />
            <input
              type="text"
              placeholder="Search worktrees..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              style={{
                flex: "1",
                background: "transparent",
                border: "none",
                outline: "none",
                "font-size": "12px",
                color: tokens.colors.text.primary,
              }}
            />
          </div>
        </div>
      </Show>

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
          <Icon name="triangle-exclamation" size={14} style={{ "flex-shrink": "0" }} />
          <Text as="span" style={{ flex: "1" }}>
            {error()}
          </Text>
          <IconButton size="sm" onClick={() => setError(null)}>
            <Icon name="xmark" size={12} />
          </IconButton>
        </div>
      </Show>

      {/* Content */}
      <div style={{ flex: "1", "overflow-y": "auto" }}>
        <Show when={loading()}>
          <div style={{ display: "flex", "align-items": "center", "justify-content": "center", height: "128px" }}>
            <Icon name="spinner" size={20} style={{ animation: "spin 1s linear infinite", color: tokens.colors.icon.default }} />
          </div>
        </Show>

        <Show when={!loading() && filteredWorktrees().length === 0}>
          <div
            style={{
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              "justify-content": "center",
              padding: "32px 16px",
              "text-align": "center",
            }}
          >
            <Icon name="folder" size={32} style={{ "margin-bottom": tokens.spacing.md, color: tokens.colors.text.muted }} />
            <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.muted }}>
              {worktrees().length === 0 ? "No worktrees found" : "No matching worktrees"}
            </Text>
            <Show when={worktrees().length === 0}>
              <Text style={{ "font-size": "10px", "margin-top": tokens.spacing.sm, color: tokens.colors.text.muted }}>
                Add a worktree to work on multiple branches simultaneously
              </Text>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddDialog(true)}
                style={{ "margin-top": tokens.spacing.lg }}
              >
                Add Worktree
              </Button>
            </Show>
          </div>
        </Show>

        <Show when={!loading() && filteredWorktrees().length > 0}>
          <div style={{ "padding-bottom": tokens.spacing.md }}>
            <For each={filteredWorktrees()}>
              {(worktree) => {
                const isExpanded = () => expandedWorktree() === worktree.path;
                const isMain = () => worktree.isMain;
                const isDirty = () => worktreeStatus()[worktree.path] || false;
                const isOperating = () =>
                  operationLoading()?.includes(worktree.path) ||
                  operationLoading() === `lock-${worktree.path}` ||
                  operationLoading() === `unlock-${worktree.path}`;

                return (
                  <div>
                    {/* Worktree item */}
                    <div
                      style={{
                        display: "flex",
                        "align-items": "flex-start",
                        padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
                        cursor: "pointer",
                        transition: "background var(--cortex-transition-fast)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = tokens.colors.interactive.hover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      onClick={() => toggleExpanded(worktree.path)}
                    >
                      {/* Expand/collapse icon */}
                      <button
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: "2px",
                          cursor: "pointer",
                          "margin-right": tokens.spacing.sm,
                          "margin-top": "2px",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(worktree.path);
                        }}
                      >
                        {isExpanded() ? (
                          <Icon name="chevron-down" size={14} style={{ color: tokens.colors.icon.default }} />
                        ) : (
                          <Icon name="chevron-right" size={14} style={{ color: tokens.colors.icon.default }} />
                        )}
                      </button>

                      {/* Worktree icon */}
                      <div style={{ "margin-right": tokens.spacing.md, "margin-top": "2px" }}>
                        <Show when={isMain()} fallback={<Icon name="folder" size={16} style={{ color: tokens.colors.icon.default }} />}>
                          <Icon name="house" size={16} style={{ color: tokens.colors.semantic.primary }} />
                        </Show>
                      </div>

                      {/* Content */}
                      <div style={{ flex: "1", "min-width": "0" }}>
                        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
                          <Text
                            style={{
                              "font-size": "12px",
                              "font-weight": "500",
                              overflow: "hidden",
                              "text-overflow": "ellipsis",
                              "white-space": "nowrap",
                              color: isMain() ? tokens.colors.semantic.primary : tokens.colors.text.primary,
                            }}
                          >
                            {getWorktreeName(worktree.path)}
                          </Text>

                          <Show when={isMain()}>
                            <Badge variant="success" size="sm">
                              main
                            </Badge>
                          </Show>

                          <Show when={worktree.isLocked}>
                            <span title="Locked">
                              <Icon name="lock" size={12} style={{ color: tokens.colors.semantic.warning }} />
                            </span>
                          </Show>

                          <Show when={isDirty()}>
                            <Badge variant="warning" size="sm">
                              dirty
                            </Badge>
                          </Show>

                          <Show when={worktree.prunable}>
                            <Badge variant="error" size="sm">
                              prunable
                            </Badge>
                          </Show>
                        </div>

                        {/* Branch and commit info */}
                        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md, "margin-top": "2px" }}>
                          <Show when={worktree.branch}>
                            <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs }}>
                              <Icon name="code-branch" size={12} style={{ color: tokens.colors.text.muted }} />
                              <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
                                {worktree.branch}
                              </Text>
                            </div>
                          </Show>
                          <Show when={!worktree.branch}>
                            <Text style={{ "font-size": "10px", color: tokens.colors.text.muted, "font-style": "italic" }}>
                              detached HEAD
                            </Text>
                          </Show>
                          <Text style={{ "font-size": "10px", "font-family": tokens.typography.fontFamily.mono, color: tokens.colors.text.muted }}>
                            {worktree.commit.substring(0, 7)}
                          </Text>
                        </div>

                        {/* Path */}
                        <span title={worktree.path}>
                          <Text
                            style={{
                              "font-size": "10px",
                              color: tokens.colors.text.muted,
                              overflow: "hidden",
                              "text-overflow": "ellipsis",
                              "white-space": "nowrap",
                              "margin-top": "2px",
                            }}
                          >
                            {worktree.path}
                          </Text>
                        </span>
                      </div>

                      {/* Quick actions */}
                      <div
                        style={{
                          display: "flex",
                          "align-items": "center",
                          gap: "2px",
                          "flex-shrink": "0",
                          "margin-left": tokens.spacing.md,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Show when={isOperating()}>
                          <Icon name="spinner" size={14} style={{ animation: "spin 1s linear infinite", color: tokens.colors.icon.default }} />
                        </Show>

                        <Show when={!isOperating()}>
                          <IconButton
                            size="sm"
                            tooltip="Open in New Window"
                            onClick={() => openInNewWindow(worktree)}
                          >
                            <Icon name="arrow-up-right-from-square" size={14} />
                          </IconButton>

                          <Show when={!isMain()}>
                            <Show
                              when={worktree.isLocked}
                              fallback={
                                <IconButton
                                  size="sm"
                                  tooltip="Lock Worktree"
                                  onClick={() => lockWorktree(worktree)}
                                >
                                  <Icon name="lock-open" size={14} />
                                </IconButton>
                              }
                            >
                              <IconButton
                                size="sm"
                                tooltip="Unlock Worktree"
                                onClick={() => unlockWorktree(worktree)}
                              >
                                <Icon name="lock" size={14} style={{ color: tokens.colors.semantic.warning }} />
                              </IconButton>
                            </Show>

                            <IconButton
                              size="sm"
                              tooltip="Remove Worktree"
                              onClick={() => setConfirmRemove(worktree)}
                            >
                              <Icon name="trash" size={14} style={{ color: tokens.colors.semantic.error }} />
                            </IconButton>
                          </Show>
                        </Show>
                      </div>
                    </div>

                    {/* Expanded details */}
                    <Show when={isExpanded()}>
                      <div
                        style={{
                          margin: `0 ${tokens.spacing.lg} ${tokens.spacing.md}`,
                          "margin-left": "44px",
                          padding: tokens.spacing.lg,
                          background: tokens.colors.surface.canvas,
                          "border-radius": tokens.radius.md,
                        }}
                      >
                        <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.md }}>
                          {/* Full path */}
                          <div>
                            <Text style={{ "font-size": "10px", "font-weight": "600", "text-transform": "uppercase", "letter-spacing": "0.5px", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.xs }}>
                              Path
                            </Text>
                            <Text style={{ "font-size": "11px", "font-family": tokens.typography.fontFamily.mono, color: tokens.colors.text.primary, "word-break": "break-all" }}>
                              {worktree.path}
                            </Text>
                          </div>

                          {/* Branch */}
                          <div>
                            <Text style={{ "font-size": "10px", "font-weight": "600", "text-transform": "uppercase", "letter-spacing": "0.5px", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.xs }}>
                              Branch
                            </Text>
                            <Text style={{ "font-size": "11px", color: tokens.colors.text.primary }}>
                              {worktree.branch || "(detached HEAD)"}
                            </Text>
                          </div>

                          {/* Commit */}
                          <div>
                            <Text style={{ "font-size": "10px", "font-weight": "600", "text-transform": "uppercase", "letter-spacing": "0.5px", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.xs }}>
                              HEAD Commit
                            </Text>
                            <Text style={{ "font-size": "11px", "font-family": tokens.typography.fontFamily.mono, color: tokens.colors.text.primary }}>
                              {worktree.commit}
                            </Text>
                          </div>

                          {/* Status */}
                          <div>
                            <Text style={{ "font-size": "10px", "font-weight": "600", "text-transform": "uppercase", "letter-spacing": "0.5px", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.xs }}>
                              Status
                            </Text>
                            <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
                              <Show when={isDirty()}>
                                <Badge variant="warning" size="sm">
                                  Has uncommitted changes
                                </Badge>
                              </Show>
                              <Show when={!isDirty()}>
                                <Badge variant="success" size="sm">
                                  Clean
                                </Badge>
                              </Show>
                              <Show when={worktree.isLocked}>
                                <Badge variant="warning" size="sm">
                                  Locked
                                </Badge>
                              </Show>
                            </div>
                          </div>

                          {/* Actions */}
                          <Show when={!isMain()}>
                            <div
                              style={{
                                display: "flex",
                                "align-items": "center",
                                gap: tokens.spacing.md,
                                "padding-top": tokens.spacing.md,
                                "border-top": `1px solid ${tokens.colors.border.divider}`,
                              }}
                            >
                              <Button
                                variant="primary"
                                size="sm"
                                icon={<Icon name="arrow-up-right-from-square" size={14} />}
                                onClick={() => openInNewWindow(worktree)}
                              >
                                Open
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<Icon name="up-down-left-right" size={14} />}
                                onClick={() => {
                                  setShowMoveDialog(worktree);
                                  setNewMovePath(worktree.path);
                                }}
                              >
                                Move
                              </Button>
                              <Show when={worktree.isLocked}>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={<Icon name="lock-open" size={14} />}
                                  onClick={() => unlockWorktree(worktree)}
                                >
                                  Unlock
                                </Button>
                              </Show>
                              <Show when={!worktree.isLocked}>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={<Icon name="lock" size={14} />}
                                  onClick={() => lockWorktree(worktree)}
                                >
                                  Lock
                                </Button>
                              </Show>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={<Icon name="trash" size={14} />}
                                onClick={() => setConfirmRemove(worktree)}
                                style={{ color: tokens.colors.semantic.error }}
                              >
                                Remove
                              </Button>
                            </div>
                          </Show>
                        </div>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* Add Worktree Dialog */}
      <AddWorktreeDialog
        open={showAddDialog()}
        repoPath={props.repoPath}
        onCancel={() => setShowAddDialog(false)}
        onCreated={(path, branch, createBranch, commitish, force, track) => {
          addWorktree(path, branch, createBranch, commitish, force, track);
        }}
        loading={operationLoading() === "add"}
      />

      {/* Remove Confirmation Dialog */}
      <Modal
        open={!!confirmRemove()}
        onClose={() => setConfirmRemove(null)}
        title="Remove Worktree?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => confirmRemove() && removeWorktree(confirmRemove()!, worktreeStatus()[confirmRemove()!.path] || false)}
              loading={operationLoading()?.startsWith("remove-")}
              style={{ background: tokens.colors.semantic.error }}
            >
              {worktreeStatus()[confirmRemove()?.path || ""] ? "Force Remove" : "Remove"}
            </Button>
          </>
        }
      >
        <Show when={confirmRemove()}>
          <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.md }}>
            <Text style={{ color: tokens.colors.text.primary }}>
              Are you sure you want to remove this worktree?
            </Text>
            <div
              style={{
                padding: tokens.spacing.md,
                background: tokens.colors.surface.canvas,
                "border-radius": tokens.radius.md,
              }}
            >
              <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.primary }}>
                {getWorktreeName(confirmRemove()!.path)}
              </Text>
              <Text style={{ "font-size": "11px", "font-family": tokens.typography.fontFamily.mono, color: tokens.colors.text.muted, "margin-top": tokens.spacing.xs }}>
                {confirmRemove()!.path}
              </Text>
            </div>
            <Show when={worktreeStatus()[confirmRemove()!.path]}>
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: tokens.spacing.md,
                  padding: tokens.spacing.md,
                  background: `color-mix(in srgb, ${tokens.colors.semantic.warning} 10%, transparent)`,
                  "border-radius": tokens.radius.md,
                  color: tokens.colors.semantic.warning,
                }}
              >
                <Icon name="triangle-exclamation" size={16} style={{ "flex-shrink": "0" }} />
                <Text style={{ "font-size": "12px", color: "inherit" }}>
                  This worktree has uncommitted changes. They will be lost.
                </Text>
              </div>
            </Show>
          </div>
        </Show>
      </Modal>

      {/* Move Worktree Dialog */}
      <Modal
        open={!!showMoveDialog()}
        onClose={() => {
          setShowMoveDialog(null);
          setNewMovePath("");
        }}
        title="Move Worktree"
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setShowMoveDialog(null);
                setNewMovePath("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => showMoveDialog() && moveWorktree(showMoveDialog()!, newMovePath())}
              disabled={!newMovePath().trim() || newMovePath() === showMoveDialog()?.path}
              loading={operationLoading()?.startsWith("move-")}
            >
              Move
            </Button>
          </>
        }
      >
        <Show when={showMoveDialog()}>
          <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.lg }}>
            <div>
              <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.sm }}>
                Current Location
              </Text>
              <Text style={{ "font-size": "12px", "font-family": tokens.typography.fontFamily.mono, color: tokens.colors.text.primary }}>
                {showMoveDialog()!.path}
              </Text>
            </div>
            <div>
              <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.sm }}>
                New Location
              </Text>
              <Input
                value={newMovePath()}
                onInput={(e) => setNewMovePath(e.currentTarget.value)}
                placeholder="/path/to/new/location"
                autofocus
              />
            </div>
          </div>
        </Show>
      </Modal>

      {/* Keyframes for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default WorktreeManager;
