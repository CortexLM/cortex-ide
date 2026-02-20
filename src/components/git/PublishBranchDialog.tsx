/**
 * Publish Branch Dialog - Push a local branch to remote with upstream tracking
 *
 * Supports:
 * - Remote selection
 * - Branch name customization
 * - Automatic upstream tracking setup
 */

import { createSignal, Show, createEffect, For } from "solid-js";
import { Icon } from "../ui/Icon";
import { Button, Input, Modal, Text } from "@/components/ui";
import { tokens } from "@/design-system/tokens";
import { gitRemotes, type GitRemote } from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";

export interface PublishBranchDialogProps {
  open: boolean;
  currentBranch: string;
  onPublish: (options: { branch: string; remote: string }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

export function PublishBranchDialog(props: PublishBranchDialogProps) {
  // Form state
  const [branchName, setBranchName] = createSignal("");
  const [selectedRemote, setSelectedRemote] = createSignal("origin");

  // Remote list state
  const [remotes, setRemotes] = createSignal<GitRemote[]>([]);
  const [showRemoteDropdown, setShowRemoteDropdown] = createSignal(false);
  const [loadingRemotes, setLoadingRemotes] = createSignal(false);

  // Fetch remotes and set defaults when dialog opens
  createEffect(() => {
    if (props.open) {
      setBranchName(props.currentBranch);
      fetchRemotes();
    }
  });

  const fetchRemotes = async () => {
    setLoadingRemotes(true);
    try {
      const projectPath = getProjectPath();
      const result = await gitRemotes(projectPath);
      setRemotes(result.remotes);
      
      // Set default to "origin" if available, otherwise first remote
      if (result.remotes.length > 0) {
        const hasOrigin = result.remotes.some((r: GitRemote) => r.name === "origin");
        if (!hasOrigin) {
          setSelectedRemote(result.remotes[0].name);
        }
      }
    } catch (err) {
      console.error("Failed to fetch remotes:", err);
    } finally {
      setLoadingRemotes(false);
    }
  };

  const handlePublish = async () => {
    if (!branchName() || !selectedRemote()) return;
    await props.onPublish({
      branch: branchName(),
      remote: selectedRemote(),
    });
  };

  const selectRemote = (remoteName: string) => {
    setSelectedRemote(remoteName);
    setShowRemoteDropdown(false);
  };

  const getRemoteUrl = () => {
    const remote = remotes().find((r) => r.name === selectedRemote());
    return remote?.url || remote?.fetchUrl || "";
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      title="Publish Branch"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={props.onCancel} disabled={props.loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handlePublish}
            loading={props.loading}
            disabled={!branchName() || !selectedRemote() || remotes().length === 0}
            icon={<Icon name="upload" style={{ width: "14px", height: "14px" }} />}
          >
            Publish
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.xl }}>
        {/* Info Box */}
        <div
          style={{
            display: "flex",
            "align-items": "flex-start",
            gap: tokens.spacing.sm,
            padding: tokens.spacing.md,
            background: tokens.colors.surface.panel,
            "border-radius": tokens.radius.md,
          }}
        >
          <Icon name="code-branch" style={{ width: "14px", height: "14px", color: tokens.colors.semantic.primary, "flex-shrink": "0", "margin-top": "2px" }} />
          <div>
            <Text style={{ "font-size": "12px", color: tokens.colors.text.primary }}>
              Publishing will push <strong>{props.currentBranch}</strong> to the remote and set up upstream tracking.
            </Text>
          </div>
        </div>

        {/* Remote Selection */}
        <div>
          <Text
            style={{
              "font-size": "12px",
              "font-weight": "500",
              color: tokens.colors.text.muted,
              "margin-bottom": tokens.spacing.sm,
            }}
          >
            Remote
          </Text>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowRemoteDropdown(!showRemoteDropdown())}
              disabled={loadingRemotes() || remotes().length === 0}
              style={{
                width: "100%",
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                background: tokens.colors.surface.overlay,
                border: `1px solid ${tokens.colors.border.default}`,
                "border-radius": tokens.radius.md,
                cursor: remotes().length > 0 ? "pointer" : "not-allowed",
                color: selectedRemote() ? tokens.colors.text.primary : tokens.colors.text.muted,
                "font-size": "13px",
                opacity: loadingRemotes() ? 0.5 : 1,
              }}
            >
              <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
                <Icon name="server" style={{ width: "14px", height: "14px", color: tokens.colors.text.muted }} />
                <span>{loadingRemotes() ? "Loading..." : (selectedRemote() || "No remotes available")}</span>
              </div>
              <Icon name="chevron-down" style={{ width: "14px", height: "14px" }} />
            </button>

            {/* Dropdown */}
            <Show when={showRemoteDropdown() && remotes().length > 0}>
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: "0",
                  right: "0",
                  background: tokens.colors.surface.overlay,
                  border: `1px solid ${tokens.colors.border.default}`,
                  "border-radius": tokens.radius.md,
                  "box-shadow": tokens.shadows.popup,
                  "z-index": "100",
                  "max-height": "200px",
                  overflow: "auto",
                }}
              >
                <For each={remotes()}>
                  {(remote) => (
                    <button
                      type="button"
                      onClick={() => selectRemote(remote.name)}
                      style={{
                        width: "100%",
                        display: "flex",
                        "flex-direction": "column",
                        "align-items": "flex-start",
                        gap: tokens.spacing.xs,
                        padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                        background: remote.name === selectedRemote() ? tokens.colors.interactive.hover : "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: tokens.colors.text.primary,
                        "font-size": "12px",
                        "text-align": "left",
                      }}
                      onMouseEnter={(e) => {
                        if (remote.name !== selectedRemote()) {
                          e.currentTarget.style.background = tokens.colors.interactive.hover;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (remote.name !== selectedRemote()) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      <span style={{ "font-weight": "500" }}>{remote.name}</span>
                      <Show when={remote.url}>
                        <span style={{ "font-size": "10px", color: tokens.colors.text.muted, "word-break": "break-all" }}>
                          {remote.url}
                        </span>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <Show when={getRemoteUrl()}>
            <Text
              style={{
                "font-size": "10px",
                color: tokens.colors.text.muted,
                "margin-top": tokens.spacing.xs,
                "word-break": "break-all",
              }}
            >
              {getRemoteUrl()}
            </Text>
          </Show>
        </div>

        {/* Branch Name */}
        <div>
          <Text
            style={{
              "font-size": "12px",
              "font-weight": "500",
              color: tokens.colors.text.muted,
              "margin-bottom": tokens.spacing.sm,
            }}
          >
            Branch name on remote
          </Text>
          <Input
            value={branchName()}
            onInput={(e) => setBranchName(e.currentTarget.value)}
            placeholder="Branch name"
          />
          <Text
            style={{
              "font-size": "10px",
              color: tokens.colors.text.muted,
              "margin-top": tokens.spacing.xs,
            }}
          >
            The branch will be published as <strong>{selectedRemote()}/{branchName() || props.currentBranch}</strong>
          </Text>
        </div>

        {/* No Remotes Warning */}
        <Show when={!loadingRemotes() && remotes().length === 0}>
          <div
            style={{
              display: "flex",
              "align-items": "flex-start",
              gap: tokens.spacing.sm,
              padding: tokens.spacing.md,
              background: `${tokens.colors.semantic.warning}15`,
              "border-radius": tokens.radius.md,
              border: `1px solid ${tokens.colors.semantic.warning}40`,
            }}
          >
            <Icon
              name="circle-exclamation"
              style={{
                width: "14px",
                height: "14px",
                color: tokens.colors.semantic.warning,
                "flex-shrink": "0",
                "margin-top": "2px",
              }}
            />
            <div>
              <Text style={{ "font-size": "12px", color: tokens.colors.semantic.warning, "font-weight": "500" }}>
                No remotes configured
              </Text>
              <Text style={{ "font-size": "11px", color: tokens.colors.text.muted, "margin-top": tokens.spacing.xs }}>
                Add a remote first using Git: Add Remote command.
              </Text>
            </div>
          </div>
        </Show>

        {/* Error Display */}
        <Show when={props.error}>
          <div
            style={{
              display: "flex",
              "align-items": "flex-start",
              gap: tokens.spacing.sm,
              padding: tokens.spacing.md,
              background: `${tokens.colors.semantic.error}15`,
              "border-radius": tokens.radius.md,
              border: `1px solid ${tokens.colors.semantic.error}40`,
            }}
          >
            <Icon
              name="circle-exclamation"
              style={{
                width: "14px",
                height: "14px",
                color: tokens.colors.semantic.error,
                "flex-shrink": "0",
                "margin-top": "2px",
              }}
            />
            <Text style={{ "font-size": "12px", color: tokens.colors.semantic.error }}>
              {props.error}
            </Text>
          </div>
        </Show>
      </div>
    </Modal>
  );
}

export default PublishBranchDialog;
