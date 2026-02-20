/**
 * Clone Repository Dialog - Clone a git repository from URL
 *
 * Supports:
 * - HTTPS and SSH repository URLs
 * - Custom target directory selection
 * - Real-time progress tracking
 * - Recursive submodule cloning
 * - Opens cloned repository after completion
 */

import { createSignal, Show, createEffect, onMount, onCleanup } from "solid-js";
import { Icon } from "../ui/Icon";
import { Button, Input, Modal, Text, Toggle } from "@/components/ui";
import { tokens } from "@/design-system/tokens";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import type { CloneProgress } from "@/utils/tauri-api";

export interface CloneRepositoryDialogProps {
  open: boolean;
  onClone: (url: string, targetDir: string, openAfterClone: boolean, recursive: boolean) => void;
  onCancel: () => void;
  loading?: boolean;
  progress?: CloneProgress | null;
}

// Common patterns for git repository URLs
const GIT_URL_PATTERNS = [
  /^https?:\/\/[^\s]+\.git$/i,
  /^https?:\/\/github\.com\/[^\/]+\/[^\/]+/i,
  /^https?:\/\/gitlab\.com\/[^\/]+\/[^\/]+/i,
  /^https?:\/\/bitbucket\.org\/[^\/]+\/[^\/]+/i,
  /^git@[^\s]+:[^\s]+\.git$/i,
  /^git@github\.com:[^\/]+\/[^\/]+/i,
  /^git@gitlab\.com:[^\/]+\/[^\/]+/i,
  /^ssh:\/\/[^\s]+/i,
];

function isValidGitUrl(url: string): boolean {
  if (!url.trim()) return false;
  return GIT_URL_PATTERNS.some(pattern => pattern.test(url.trim()));
}

function extractRepoName(url: string): string {
  const trimmed = url.trim();
  // Extract repo name from URL
  // Handle: https://github.com/user/repo.git or git@github.com:user/repo.git
  const match = trimmed.match(/\/([^\/]+?)(?:\.git)?$/) || 
                trimmed.match(/:([^\/]+?)(?:\.git)?$/);
  if (match) {
    return match[1].replace(/\.git$/, '');
  }
  return '';
}

export function CloneRepositoryDialog(props: CloneRepositoryDialogProps) {
  // Form state
  const [repoUrl, setRepoUrl] = createSignal("");
  const [targetDir, setTargetDir] = createSignal("");
  const [openAfterClone, setOpenAfterClone] = createSignal(true);
  const [recursive, setRecursive] = createSignal(false);

  // Validation state
  const [urlError, setUrlError] = createSignal<string | null>(null);
  const [dirError, setDirError] = createSignal<string | null>(null);
  const [suggestedName, setSuggestedName] = createSignal("");

  // Reset form when dialog opens/closes
  createEffect(() => {
    if (props.open) {
      resetForm();
    }
  });

  // Update suggested repo name when URL changes
  createEffect(() => {
    const url = repoUrl();
    if (url) {
      const name = extractRepoName(url);
      setSuggestedName(name);
      // Auto-populate target directory if empty
      if (!targetDir() && name) {
        // Get user's home directory or default
        const defaultDir = getUserHomeDir();
        setTargetDir(`${defaultDir}/${name}`);
      }
    }
  });

  const getUserHomeDir = (): string => {
    // Try to get from environment or use reasonable default
    if (typeof window !== 'undefined') {
      // On Windows
      const userProfile = (window as any).__TAURI_INTERNALS__?.environment?.USERPROFILE;
      if (userProfile) return userProfile;
      // On Unix
      const home = (window as any).__TAURI_INTERNALS__?.environment?.HOME;
      if (home) return home;
    }
    // Fallback - will be replaced by folder picker
    return "~/projects";
  };

  const resetForm = () => {
    setRepoUrl("");
    setTargetDir("");
    setOpenAfterClone(true);
    setRecursive(false);
    setUrlError(null);
    setDirError(null);
    setSuggestedName("");
  };

  const validateForm = (): boolean => {
    let valid = true;

    // Validate URL
    const url = repoUrl().trim();
    if (!url) {
      setUrlError("Repository URL is required");
      valid = false;
    } else if (!isValidGitUrl(url)) {
      setUrlError("Please enter a valid git repository URL");
      valid = false;
    } else {
      setUrlError(null);
    }

    // Validate target directory
    const dir = targetDir().trim();
    if (!dir) {
      setDirError("Target directory is required");
      valid = false;
    } else {
      setDirError(null);
    }

    return valid;
  };

  const handleClone = () => {
    if (!validateForm()) return;
    props.onClone(repoUrl().trim(), targetDir().trim(), openAfterClone(), recursive());
  };

  // Helper to get progress percentage
  const getProgressPercent = () => {
    const p = props.progress;
    if (!p || p.total === 0) return 0;
    return Math.round((p.current / p.total) * 100);
  };

  // Helper to get stage display text
  const getStageText = (stage: string): string => {
    switch (stage) {
      case "starting": return "Starting...";
      case "counting": return "Counting objects";
      case "compressing": return "Compressing objects";
      case "receiving": return "Receiving objects";
      case "resolving": return "Resolving deltas";
      case "checking_out": return "Checking out files";
      case "updating": return "Updating files";
      case "complete": return "Complete";
      case "error": return "Error";
      default: return "Working...";
    }
  };

  // Helper to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const handleBrowse = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Clone Directory",
      });
      
      if (selected && typeof selected === 'string') {
        // If we have a suggested name, append it
        const name = suggestedName();
        if (name) {
          // Use forward slash for consistency
          const separator = selected.includes('\\') ? '\\' : '/';
          setTargetDir(`${selected}${separator}${name}`);
        } else {
          setTargetDir(selected);
        }
        setDirError(null);
      }
    } catch (e) {
      console.error("Failed to open directory picker:", e);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && isValidGitUrl(text)) {
        setRepoUrl(text);
        setUrlError(null);
      }
    } catch (e) {
      // Clipboard access denied or failed
    }
  };

  // Listen for global event to open dialog with pre-filled URL
  onMount(() => {
    const handleCloneEvent = (e: CustomEvent<{ url?: string }>) => {
      if (e.detail?.url) {
        setRepoUrl(e.detail.url);
      }
    };
    window.addEventListener("git:clone-repository-prefill", handleCloneEvent as EventListener);
    onCleanup(() => {
      window.removeEventListener("git:clone-repository-prefill", handleCloneEvent as EventListener);
    });
  });

  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      title="Clone Repository"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={props.onCancel} disabled={props.loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleClone}
            loading={props.loading}
            disabled={!repoUrl().trim() || !targetDir().trim()}
          >
            Clone
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.xl }}>
        {/* Repository URL */}
        <div>
          <Text
            style={{
              "font-size": "12px",
              "font-weight": "500",
              color: tokens.colors.text.muted,
              "margin-bottom": tokens.spacing.sm,
            }}
          >
            Repository URL
          </Text>
          <div style={{ display: "flex", gap: tokens.spacing.sm }}>
            <div style={{ flex: "1" }}>
              <Input
                value={repoUrl()}
                onInput={(e) => {
                  setRepoUrl(e.currentTarget.value);
                  setUrlError(null);
                }}
                placeholder="https://github.com/user/repository.git"
                error={urlError() || undefined}
                autofocus
              />
            </div>
            <Button
              variant="secondary"
              onClick={handlePaste}
              title="Paste from clipboard"
            >
              Paste
            </Button>
          </div>
          <Show when={urlError()}>
            <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs, "margin-top": tokens.spacing.xs }}>
              <Icon name="circle-exclamation" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.error }} />
              <Text style={{ "font-size": "11px", color: tokens.colors.semantic.error }}>
                {urlError()}
              </Text>
            </div>
          </Show>
          <Text
            style={{
              "font-size": "10px",
              color: tokens.colors.text.muted,
              "margin-top": tokens.spacing.xs,
            }}
          >
            Supports HTTPS and SSH URLs (github.com, gitlab.com, bitbucket.org, etc.)
          </Text>
        </div>

        {/* Target Directory */}
        <div>
          <Text
            style={{
              "font-size": "12px",
              "font-weight": "500",
              color: tokens.colors.text.muted,
              "margin-bottom": tokens.spacing.sm,
            }}
          >
            Clone to Directory
          </Text>
          <div style={{ display: "flex", gap: tokens.spacing.sm }}>
            <div style={{ flex: "1" }}>
              <Input
                value={targetDir()}
                onInput={(e) => {
                  setTargetDir(e.currentTarget.value);
                  setDirError(null);
                }}
                placeholder="/path/to/directory"
                error={dirError() || undefined}
              />
            </div>
            <Button
              variant="secondary"
              icon={<Icon name="folder-plus" style={{ width: "14px", height: "14px" }} />}
              onClick={handleBrowse}
            >
              Browse
            </Button>
          </div>
          <Show when={dirError()}>
            <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs, "margin-top": tokens.spacing.xs }}>
              <Icon name="circle-exclamation" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.error }} />
              <Text style={{ "font-size": "11px", color: tokens.colors.semantic.error }}>
                {dirError()}
              </Text>
            </div>
          </Show>
          <Text
            style={{
              "font-size": "10px",
              color: tokens.colors.text.muted,
              "margin-top": tokens.spacing.xs,
            }}
          >
            The repository will be cloned into this directory
          </Text>
        </div>

        {/* Options */}
        <div
          style={{
            "border-top": `1px solid ${tokens.colors.border.divider}`,
            "padding-top": tokens.spacing.lg,
            display: "flex",
            "flex-direction": "column",
            gap: tokens.spacing.md,
          }}
        >
          <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
            <div>
              <Text style={{ "font-size": "12px", color: tokens.colors.text.primary }}>
                Open folder after clone
              </Text>
              <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
                Automatically open the cloned repository
              </Text>
            </div>
            <Toggle checked={openAfterClone()} onChange={setOpenAfterClone} />
          </div>
          <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
            <div>
              <Text style={{ "font-size": "12px", color: tokens.colors.text.primary }}>
                Clone submodules
              </Text>
              <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
                Recursively clone submodules (--recurse-submodules)
              </Text>
            </div>
            <Toggle checked={recursive()} onChange={setRecursive} />
          </div>
        </div>

        {/* Progress Display */}
        <Show when={props.loading && props.progress}>
          <div
            style={{
              display: "flex",
              "flex-direction": "column",
              gap: tokens.spacing.sm,
              padding: tokens.spacing.md,
              background: tokens.colors.surface.panel,
              "border-radius": tokens.radius.md,
              border: `1px solid ${tokens.colors.border.default}`,
            }}
          >
            <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
              <Icon
                name="download"
                style={{
                  width: "14px",
                  height: "14px",
                  color: tokens.colors.semantic.primary,
                  animation: props.progress?.stage === "complete" ? "none" : "spin 1s linear infinite",
                }}
              />
              <Text style={{ "font-size": "12px", color: tokens.colors.text.primary, "font-weight": "500" }}>
                {getStageText(props.progress?.stage || "unknown")}
              </Text>
              <Show when={props.progress && props.progress.total > 0}>
                <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
                  ({props.progress!.current} / {props.progress!.total})
                </Text>
              </Show>
            </div>
            
            {/* Progress bar */}
            <div
              style={{
                height: "4px",
                background: tokens.colors.border.default,
                "border-radius": "var(--cortex-radius-sm)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${getProgressPercent()}%`,
                  background: props.progress?.stage === "error" 
                    ? tokens.colors.semantic.error 
                    : tokens.colors.semantic.primary,
                  "border-radius": "var(--cortex-radius-sm)",
                  transition: "width 0.2s ease-out",
                }}
              />
            </div>
            
            <Show when={props.progress?.bytesReceived}>
              <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
                Downloaded: {formatBytes(props.progress!.bytesReceived!)}
              </Text>
            </Show>
            
            <Show when={props.progress?.message && props.progress.stage !== "complete"}>
              <Text 
                style={{ 
                  "font-size": "10px", 
                  color: tokens.colors.text.muted,
                  "font-family": "monospace",
                  "white-space": "nowrap",
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                }}
              >
                {props.progress!.message}
              </Text>
            </Show>
          </div>
        </Show>

        {/* Info box */}
        <Show when={!props.loading}>
          <div
            style={{
              display: "flex",
              "align-items": "flex-start",
              gap: tokens.spacing.md,
              padding: tokens.spacing.md,
              background: tokens.colors.surface.panel,
              "border-radius": tokens.radius.md,
              border: `1px solid ${tokens.colors.border.default}`,
            }}
          >
            <Icon
              name="code-branch"
              style={{
                width: "16px",
                height: "16px",
                color: tokens.colors.semantic.primary,
                "flex-shrink": "0",
                "margin-top": "2px",
              }}
            />
            <div>
              <Text style={{ "font-size": "11px", color: tokens.colors.text.secondary }}>
                Clone progress will be shown here. For SSH URLs, make sure your SSH keys are configured.
              </Text>
            </div>
          </div>
        </Show>
      </div>
    </Modal>
  );
}

export default CloneRepositoryDialog;

