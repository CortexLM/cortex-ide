/**
 * Add Worktree Dialog - Create new git worktrees
 *
 * Supports creating worktrees with:
 * - Existing branches
 * - New branches
 * - Detached HEAD at specific commits
 * - Remote branch tracking
 */

import { createSignal, Show, For, createEffect } from "solid-js";
import { Icon } from "../ui/Icon";
import {
  gitBranches,
  type GitBranch,
} from "../../utils/tauri-api";
import {
  Button,
  Input,
  Modal,
  Text,
  Toggle,
  Badge,
} from "@/components/ui";
import { tokens } from "@/design-system/tokens";

export interface AddWorktreeDialogProps {
  open: boolean;
  repoPath: string;
  onCreated: (
    path: string,
    branch: string | null,
    createBranch: boolean,
    commitish?: string,
    force?: boolean,
    track?: string
  ) => void;
  onCancel: () => void;
  loading?: boolean;
}

type WorktreeMode = "existing-branch" | "new-branch" | "detached";

export function AddWorktreeDialog(props: AddWorktreeDialogProps) {
  // Form state
  const [worktreePath, setWorktreePath] = createSignal("");
  const [mode, setMode] = createSignal<WorktreeMode>("existing-branch");
  const [selectedBranch, setSelectedBranch] = createSignal<string | null>(null);
  const [newBranchName, setNewBranchName] = createSignal("");
  const [commitish, setCommitish] = createSignal("");
  const [trackRemote, setTrackRemote] = createSignal<string | null>(null);
  const [forceCreate, setForceCreate] = createSignal(false);

  // UI state
  const [branches, setBranches] = createSignal<GitBranch[]>([]);
  const [branchSearch, setBranchSearch] = createSignal("");
  const [_loadingBranches, setLoadingBranches] = createSignal(false);
  const [showBranchList, setShowBranchList] = createSignal(false);

  // Validation state
  const [pathError, setPathError] = createSignal<string | null>(null);
  const [branchError, setBranchError] = createSignal<string | null>(null);

  // Reset form when dialog opens/closes
  createEffect(() => {
    if (props.open) {
      resetForm();
      fetchBranches();
    }
  });

  const resetForm = () => {
    setWorktreePath("");
    setMode("existing-branch");
    setSelectedBranch(null);
    setNewBranchName("");
    setCommitish("");
    setTrackRemote(null);
    setForceCreate(false);
    setBranchSearch("");
    setPathError(null);
    setBranchError(null);
    setShowBranchList(false);
  };

  const fetchBranches = async () => {
    setLoadingBranches(true);
    try {
      const data = await gitBranches(props.repoPath);
      setBranches(data);
    } catch (err) {
      console.error("Failed to fetch branches:", err);
    } finally {
      setLoadingBranches(false);
    }
  };

  const localBranches = () => branches().filter((b) => !b.isRemote);
  const remoteBranches = () => branches().filter((b) => b.isRemote);

  const filteredLocalBranches = () => {
    const search = branchSearch().toLowerCase();
    if (!search) return localBranches();
    return localBranches().filter((b) => b.name.toLowerCase().includes(search));
  };

  const filteredRemoteBranches = () => {
    const search = branchSearch().toLowerCase();
    if (!search) return remoteBranches();
    return remoteBranches().filter((b) => b.name.toLowerCase().includes(search));
  };

  const validateForm = (): boolean => {
    let valid = true;

    // Validate path
    if (!worktreePath().trim()) {
      setPathError("Path is required");
      valid = false;
    } else {
      setPathError(null);
    }

    // Validate branch/commit based on mode
    if (mode() === "existing-branch" && !selectedBranch()) {
      setBranchError("Please select a branch");
      valid = false;
    } else if (mode() === "new-branch" && !newBranchName().trim()) {
      setBranchError("Branch name is required");
      valid = false;
    } else if (mode() === "detached" && !commitish().trim()) {
      setBranchError("Commit reference is required");
      valid = false;
    } else {
      setBranchError(null);
    }

    return valid;
  };

  const handleCreate = () => {
    if (!validateForm()) return;

    let branch: string | null = null;
    let createBranch = false;
    let commit: string | undefined;
    let track: string | undefined;

    switch (mode()) {
      case "existing-branch":
        branch = selectedBranch();
        break;
      case "new-branch":
        branch = newBranchName().trim();
        createBranch = true;
        if (commitish().trim()) {
          commit = commitish().trim();
        }
        if (trackRemote()) {
          track = trackRemote()!;
        }
        break;
      case "detached":
        commit = commitish().trim();
        break;
    }

    props.onCreated(
      worktreePath().trim(),
      branch,
      createBranch,
      commit,
      forceCreate(),
      track
    );
  };

  const selectBranch = (branchName: string) => {
    setSelectedBranch(branchName);
    setShowBranchList(false);
    setBranchSearch("");

    // Auto-suggest path based on branch name
    if (!worktreePath().trim()) {
      const safeName = branchName.replace(/[^a-zA-Z0-9-_]/g, "-");
      const parentPath = props.repoPath.substring(0, props.repoPath.lastIndexOf("/") + 1);
      setWorktreePath(`${parentPath}${safeName}`);
    }
  };

  const ModeButton = (modeProps: { value: WorktreeMode; label: string; icon: string }) => {
    const isSelected = () => mode() === modeProps.value;
    return (
      <button
        type="button"
        onClick={() => setMode(modeProps.value)}
        style={{
          flex: "1",
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          gap: tokens.spacing.sm,
          padding: tokens.spacing.md,
          background: isSelected() ? tokens.colors.interactive.selected : "transparent",
          border: `1px solid ${isSelected() ? tokens.colors.border.focus : tokens.colors.border.default}`,
          "border-radius": tokens.radius.md,
          cursor: "pointer",
          transition: "all var(--cortex-transition-fast)",
        }}
        onMouseEnter={(e) => {
          if (!isSelected()) {
            e.currentTarget.style.background = tokens.colors.interactive.hover;
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected()) {
            e.currentTarget.style.background = "transparent";
          }
        }}
      >
        <Icon
          name={modeProps.icon}
          style={{
            width: "20px",
            height: "20px",
            color: isSelected() ? tokens.colors.semantic.primary : tokens.colors.icon.default,
          }}
        />
        <Text
          style={{
            "font-size": "11px",
            "font-weight": isSelected() ? "600" : "400",
            color: isSelected() ? tokens.colors.semantic.primary : tokens.colors.text.primary,
          }}
        >
          {modeProps.label}
        </Text>
      </button>
    );
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      title="Add Worktree"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={props.onCancel} disabled={props.loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            loading={props.loading}
            disabled={!worktreePath().trim()}
          >
            Create Worktree
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.xl }}>
        {/* Mode Selection */}
        <div>
          <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.md }}>
            Worktree Type
          </Text>
          <div style={{ display: "flex", gap: tokens.spacing.md }}>
            <ModeButton value="existing-branch" label="Existing Branch" icon="code-branch" />
            <ModeButton value="new-branch" label="New Branch" icon="plus" />
            <ModeButton value="detached" label="Detached HEAD" icon="code-commit" />
          </div>
        </div>

        {/* Path Input */}
        <div>
          <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.sm }}>
            Worktree Path
          </Text>
          <div style={{ display: "flex", gap: tokens.spacing.md }}>
            <div style={{ flex: "1" }}>
              <Input
                value={worktreePath()}
                onInput={(e) => {
                  setWorktreePath(e.currentTarget.value);
                  setPathError(null);
                }}
                placeholder="/path/to/worktree"
                error={pathError() || undefined}
              />
            </div>
            <Button
              variant="secondary"
              icon={<Icon name="folder-plus" style={{ width: "14px", height: "14px" }} />}
              onClick={() => {
                // Trigger native folder picker
                window.dispatchEvent(
                  new CustomEvent("command:show-open-dialog", {
                    detail: {
                      properties: ["openDirectory", "createDirectory"],
                      callback: (paths: string[]) => {
                        if (paths && paths.length > 0) {
                          setWorktreePath(paths[0]);
                        }
                      },
                    },
                  })
                );
              }}
            >
              Browse
            </Button>
          </div>
          <Text style={{ "font-size": "10px", color: tokens.colors.text.muted, "margin-top": tokens.spacing.xs }}>
            Directory where the worktree will be created
          </Text>
        </div>

        {/* Mode-specific options */}
        <Show when={mode() === "existing-branch"}>
          <div>
            <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.sm }}>
              Select Branch
            </Text>

            {/* Branch selector */}
            <div style={{ position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: tokens.spacing.md,
                  padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                  background: tokens.colors.surface.canvas,
                  border: `1px solid ${branchError() ? tokens.colors.border.error : tokens.colors.border.default}`,
                  "border-radius": tokens.radius.md,
                  cursor: "pointer",
                }}
                onClick={() => setShowBranchList(!showBranchList())}
              >
                <Icon name="code-branch" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default }} />
                <Text style={{ flex: "1", "font-size": "12px", color: selectedBranch() ? tokens.colors.text.primary : tokens.colors.text.muted }}>
                  {selectedBranch() || "Choose a branch..."}
                </Text>
                <Show when={selectedBranch()}>
                  <Badge variant="success" size="sm">
                    selected
                  </Badge>
                </Show>
              </div>

              {/* Branch dropdown */}
              <Show when={showBranchList()}>
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: "0",
                    right: "0",
                    "margin-top": tokens.spacing.xs,
                    background: tokens.colors.surface.popup,
                    border: `1px solid ${tokens.colors.border.default}`,
                    "border-radius": tokens.radius.md,
                    "box-shadow": tokens.shadows.popup,
                    "z-index": "10",
                    "max-height": "240px",
                    "overflow-y": "auto",
                  }}
                >
                  {/* Search */}
                  <div style={{ padding: tokens.spacing.md, "border-bottom": `1px solid ${tokens.colors.border.divider}` }}>
                    <div
                      style={{
                        display: "flex",
                        "align-items": "center",
                        gap: tokens.spacing.sm,
                        padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
                        background: tokens.colors.surface.canvas,
                        "border-radius": tokens.radius.sm,
                      }}
                    >
                      <Icon name="magnifying-glass" style={{ width: "12px", height: "12px", color: tokens.colors.icon.inactive }} />
                      <input
                        type="text"
                        placeholder="Search branches..."
                        value={branchSearch()}
                        onInput={(e) => setBranchSearch(e.currentTarget.value)}
                        style={{
                          flex: "1",
                          background: "transparent",
                          border: "none",
                          outline: "none",
                          "font-size": "11px",
                          color: tokens.colors.text.primary,
                        }}
                        autofocus
                      />
                    </div>
                  </div>

                  {/* Local branches */}
                  <Show when={filteredLocalBranches().length > 0}>
                    <div style={{ padding: `${tokens.spacing.sm} ${tokens.spacing.md}` }}>
                      <Text style={{ "font-size": "10px", "font-weight": "600", "text-transform": "uppercase", "letter-spacing": "0.5px", color: tokens.colors.text.muted }}>
                        Local Branches
                      </Text>
                    </div>
                    <For each={filteredLocalBranches()}>
                      {(branch) => (
                        <div
                          style={{
                            display: "flex",
                            "align-items": "center",
                            gap: tokens.spacing.md,
                            padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                            cursor: "pointer",
                            transition: "background var(--cortex-transition-fast)",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = tokens.colors.interactive.hover)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          onClick={() => selectBranch(branch.name)}
                        >
                          <Show when={selectedBranch() === branch.name}>
                            <Icon name="check" style={{ width: "14px", height: "14px", color: tokens.colors.semantic.success }} />
                          </Show>
                          <Show when={selectedBranch() !== branch.name}>
                            <div style={{ width: "14px" }} />
                          </Show>
                          <Icon name="code-branch" style={{ width: "12px", height: "12px", color: tokens.colors.icon.default }} />
                          <Text style={{ "font-size": "12px", color: tokens.colors.text.primary }}>
                            {branch.name}
                          </Text>
                          <Show when={branch.isHead}>
                            <Badge variant="success" size="sm">
                              HEAD
                            </Badge>
                          </Show>
                        </div>
                      )}
                    </For>
                  </Show>

                  {/* Remote branches */}
                  <Show when={filteredRemoteBranches().length > 0}>
                    <div style={{ padding: `${tokens.spacing.sm} ${tokens.spacing.md}`, "border-top": `1px solid ${tokens.colors.border.divider}` }}>
                      <Text style={{ "font-size": "10px", "font-weight": "600", "text-transform": "uppercase", "letter-spacing": "0.5px", color: tokens.colors.text.muted }}>
                        Remote Branches
                      </Text>
                    </div>
                    <For each={filteredRemoteBranches()}>
                      {(branch) => (
                        <div
                          style={{
                            display: "flex",
                            "align-items": "center",
                            gap: tokens.spacing.md,
                            padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                            cursor: "pointer",
                            transition: "background var(--cortex-transition-fast)",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = tokens.colors.interactive.hover)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          onClick={() => selectBranch(branch.name)}
                        >
                          <Show when={selectedBranch() === branch.name}>
                            <Icon name="check" style={{ width: "14px", height: "14px", color: tokens.colors.semantic.success }} />
                          </Show>
                          <Show when={selectedBranch() !== branch.name}>
                            <div style={{ width: "14px" }} />
                          </Show>
                          <Icon name="link" style={{ width: "12px", height: "12px", color: tokens.colors.text.muted }} />
                          <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
                            {branch.name}
                          </Text>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              </Show>
            </div>

            <Show when={branchError()}>
              <Text style={{ "font-size": "11px", color: tokens.colors.semantic.error, "margin-top": tokens.spacing.xs }}>
                {branchError()}
              </Text>
            </Show>
          </div>
        </Show>

        <Show when={mode() === "new-branch"}>
          <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.lg }}>
            {/* New branch name */}
            <div>
              <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.sm }}>
                New Branch Name
              </Text>
              <Input
                value={newBranchName()}
                onInput={(e) => {
                  setNewBranchName(e.currentTarget.value);
                  setBranchError(null);
                }}
                placeholder="feature/my-feature"
                error={branchError() || undefined}
              />
            </div>

            {/* Start point */}
            <div>
              <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.sm }}>
                Start Point (optional)
              </Text>
              <Input
                value={commitish()}
                onInput={(e) => setCommitish(e.currentTarget.value)}
                placeholder="HEAD, branch name, or commit SHA"
              />
              <Text style={{ "font-size": "10px", color: tokens.colors.text.muted, "margin-top": tokens.spacing.xs }}>
                Leave empty to start from HEAD
              </Text>
            </div>

            {/* Track remote */}
            <div>
              <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.sm }}>
                Track Remote Branch (optional)
              </Text>
              <Input
                value={trackRemote() || ""}
                onInput={(e) => setTrackRemote(e.currentTarget.value || null)}
                placeholder="origin/main"
              />
              <Text style={{ "font-size": "10px", color: tokens.colors.text.muted, "margin-top": tokens.spacing.xs }}>
                Set upstream tracking for the new branch
              </Text>
            </div>
          </div>
        </Show>

        <Show when={mode() === "detached"}>
          <div>
            <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.sm }}>
              Commit Reference
            </Text>
            <Input
              value={commitish()}
              onInput={(e) => {
                setCommitish(e.currentTarget.value);
                setBranchError(null);
              }}
              placeholder="Commit SHA, tag, or branch"
              error={branchError() || undefined}
            />
            <Text style={{ "font-size": "10px", color: tokens.colors.text.muted, "margin-top": tokens.spacing.xs }}>
              The worktree will be in detached HEAD state at this commit
            </Text>
          </div>
        </Show>

        {/* Advanced options */}
        <div style={{ "border-top": `1px solid ${tokens.colors.border.divider}`, "padding-top": tokens.spacing.lg }}>
          <Text style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase", "letter-spacing": "0.5px", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.md }}>
            Advanced Options
          </Text>

          <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
            <div>
              <Text style={{ "font-size": "12px", color: tokens.colors.text.primary }}>
                Force create
              </Text>
              <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
                Create worktree even if the directory exists
              </Text>
            </div>
            <Toggle checked={forceCreate()} onChange={setForceCreate} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default AddWorktreeDialog;
