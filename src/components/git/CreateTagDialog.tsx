/**
 * Create Tag Dialog
 * 
 * Features:
 * - Tag name input with validation
 * - Commit selector (HEAD, branch, or specific commit)
 * - Lightweight vs Annotated toggle
 * - Message input for annotated tags
 * - "Push after create" checkbox
 * - GPG sign option (if configured)
 */

import { createSignal, Show, createMemo, For, onMount } from "solid-js";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";
import { Portal } from "solid-js/web";
import { 
  Button, 
  Input, 
  Text,
  Badge,
  Textarea
} from "@/components/ui";
import {
  gitTagCreate,
  gitTagPush,
  gitIsGpgConfigured,
  gitLog,
  gitCurrentBranch,
  type GitTag,
  type GitCommit
} from "../../utils/tauri-api";

export interface CreateTagDialogProps {
  repoPath: string;
  defaultCommit?: string;     // Default to HEAD
  onCreated: (tag: GitTag) => void;
  onCancel: () => void;
}

type CommitTarget = "HEAD" | "branch" | "commit";

export function CreateTagDialog(props: CreateTagDialogProps) {
  // Form state
  const [tagName, setTagName] = createSignal("");
  const [tagType, setTagType] = createSignal<"lightweight" | "annotated">("annotated");
  const [message, setMessage] = createSignal("");
  const [commitTarget, setCommitTarget] = createSignal<CommitTarget>("HEAD");
  const [selectedCommit, setSelectedCommit] = createSignal(props.defaultCommit || "HEAD");
  const [pushAfterCreate, setPushAfterCreate] = createSignal(false);
  const [signTag, setSignTag] = createSignal(false);
  
  // UI state
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [gpgConfigured, setGpgConfigured] = createSignal(false);
  const [showCommitPicker, setShowCommitPicker] = createSignal(false);
  const [recentCommits, setRecentCommits] = createSignal<GitCommit[]>([]);
  const [currentBranch, setCurrentBranch] = createSignal<string | null>(null);
  const [commitsLoading, setCommitsLoading] = createSignal(false);

  // Load initial data
  onMount(async () => {
    // Check GPG configuration
    try {
      const configured = await gitIsGpgConfigured(props.repoPath);
      setGpgConfigured(configured);
    } catch (err) {
      console.error("Failed to check GPG config:", err);
    }

    // Get current branch
    try {
      const branch = await gitCurrentBranch(props.repoPath);
      setCurrentBranch(branch);
    } catch (err) {
      console.error("Failed to get current branch:", err);
    }

    // Load recent commits
    try {
      setCommitsLoading(true);
      const commits = await gitLog(props.repoPath, 20);
      setRecentCommits(commits);
    } catch (err) {
      console.error("Failed to load commits:", err);
    } finally {
      setCommitsLoading(false);
    }
  });

  // Tag name validation
  const tagNameValidation = createMemo(() => {
    const name = tagName().trim();
    
    if (!name) {
      return { valid: false, error: null };
    }

    // Git tag name rules
    if (name.startsWith("-")) {
      return { valid: false, error: "Tag name cannot start with a hyphen" };
    }
    if (name.endsWith(".")) {
      return { valid: false, error: "Tag name cannot end with a period" };
    }
    if (name.includes("..")) {
      return { valid: false, error: "Tag name cannot contain '..'" };
    }
    if (name.includes("@{")) {
      return { valid: false, error: "Tag name cannot contain '@{'" };
    }
    if (/[\s~^:?*\[\]\\]/.test(name)) {
      return { valid: false, error: "Tag name contains invalid characters" };
    }
    if (name.endsWith(".lock")) {
      return { valid: false, error: "Tag name cannot end with '.lock'" };
    }

    return { valid: true, error: null };
  });

  // Form validation
  const canCreate = createMemo(() => {
    const nameValid = tagNameValidation().valid;
    const hasMessage = tagType() === "lightweight" || message().trim().length > 0;
    return nameValid && hasMessage && !loading();
  });

  const getTargetCommit = (): string => {
    const target = commitTarget();
    if (target === "HEAD") return "HEAD";
    if (target === "commit") return selectedCommit();
    return selectedCommit();
  };

  const handleCreate = async () => {
    if (!canCreate()) return;

    setLoading(true);
    setError(null);

    try {
      const targetCommit = getTargetCommit();
      const isAnnotated = tagType() === "annotated";
      const tagMessage = isAnnotated ? message().trim() : undefined;
      const sign = gpgConfigured() && signTag();

      // Create the tag
      const createdTag = await gitTagCreate(
        props.repoPath,
        tagName().trim(),
        targetCommit,
        isAnnotated,
        tagMessage,
        sign
      );

      // Push if requested
      if (pushAfterCreate() && createdTag) {
        try {
          await gitTagPush(props.repoPath, tagName().trim());
          createdTag.isPushed = true;
        } catch (pushErr) {
          console.error("Failed to push tag:", pushErr);
          // Still report success, tag was created
        }
      }

      props.onCreated(createdTag);
    } catch (err) {
      setError(`Failed to create tag: ${err}`);
      console.error("Failed to create tag:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectCommit = (commit: GitCommit) => {
    setSelectedCommit(commit.hash);
    setCommitTarget("commit");
    setShowCommitPicker(false);
  };

  const formatCommitDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const overlayStyle = {
    position: "fixed" as const,
    inset: "0",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: "var(--jb-overlay-backdrop)",
    "z-index": "var(--cortex-z-highest)",
  };

  const dialogStyle = {
    width: "480px",
    "max-width": "90vw",
    "max-height": "80vh",
    background: "var(--jb-modal)",
    "border-radius": tokens.radius.lg,
    "box-shadow": "var(--jb-shadow-modal)",
    display: "flex",
    "flex-direction": "column" as const,
    overflow: "hidden",
  };

  return (
    <Portal>
      <div style={overlayStyle} onClick={props.onCancel}>
        <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              padding: `${tokens.spacing.lg} ${tokens.spacing.xl}`,
              "border-bottom": `1px solid ${tokens.colors.border.divider}`,
              "flex-shrink": "0",
            }}
          >
            <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
              <Icon name="tag" style={{ width: "18px", height: "18px", color: tokens.colors.icon.default }} />
              <Text style={{ "font-size": "16px", "font-weight": "600", color: tokens.colors.text.primary }}>
                Create Tag
              </Text>
            </div>
            <button
              type="button"
              onClick={props.onCancel}
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "24px",
                height: "24px",
                background: "transparent",
                border: "none",
                "border-radius": tokens.radius.sm,
                color: tokens.colors.icon.default,
                cursor: "pointer",
              }}
            >
              <Icon name="xmark" style={{ width: "16px", height: "16px" }} />
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: "1", "overflow-y": "auto", padding: tokens.spacing.xl }}>
            <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.xl }}>
              {/* Error message */}
              <Show when={error()}>
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: tokens.spacing.md,
                    padding: tokens.spacing.md,
                    background: `color-mix(in srgb, ${tokens.colors.semantic.error} 10%, transparent)`,
                    "border-radius": tokens.radius.md,
                  }}
                >
                  <Icon name="circle-exclamation" style={{ width: "14px", height: "14px", color: tokens.colors.semantic.error }} />
                  <Text style={{ "font-size": "12px", color: tokens.colors.semantic.error, flex: "1" }}>
                    {error()}
                  </Text>
                </div>
              </Show>

              {/* Tag name */}
              <Input
                label="Tag Name"
                placeholder="v1.0.0"
                value={tagName()}
                onInput={(e) => setTagName(e.currentTarget.value)}
                error={tagNameValidation().error || undefined}
                icon={<Icon name="tag" style={{ width: "14px", height: "14px" }} />}
                autofocus
              />

              {/* Tag type toggle */}
              <div>
                <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.sm }}>
                  Tag Type
                </Text>
                <div style={{ display: "flex", gap: tokens.spacing.sm }}>
                  <button
                    type="button"
                    onClick={() => setTagType("annotated")}
                    style={{
                      flex: "1",
                      padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
                      background: tagType() === "annotated" ? tokens.colors.interactive.selected : "transparent",
                      border: `1px solid ${tagType() === "annotated" ? tokens.colors.semantic.primary : tokens.colors.border.default}`,
                      "border-radius": tokens.radius.md,
                      cursor: "pointer",
                      transition: "all var(--cortex-transition-fast)",
                    }}
                  >
                    <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
                      <Show when={tagType() === "annotated"}>
                        <Icon name="check" style={{ width: "14px", height: "14px", color: tokens.colors.semantic.primary }} />
                      </Show>
                      <Text style={{ 
                        "font-size": "13px", 
                        "font-weight": tagType() === "annotated" ? "500" : "400",
                        color: tagType() === "annotated" ? tokens.colors.semantic.primary : tokens.colors.text.primary,
                      }}>
                        Annotated
                      </Text>
                    </div>
                    <Text style={{ "font-size": "10px", color: tokens.colors.text.muted, "margin-top": "2px" }}>
                      With message & metadata
                    </Text>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setTagType("lightweight")}
                    style={{
                      flex: "1",
                      padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
                      background: tagType() === "lightweight" ? tokens.colors.interactive.selected : "transparent",
                      border: `1px solid ${tagType() === "lightweight" ? tokens.colors.semantic.primary : tokens.colors.border.default}`,
                      "border-radius": tokens.radius.md,
                      cursor: "pointer",
                      transition: "all var(--cortex-transition-fast)",
                    }}
                  >
                    <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
                      <Show when={tagType() === "lightweight"}>
                        <Icon name="check" style={{ width: "14px", height: "14px", color: tokens.colors.semantic.primary }} />
                      </Show>
                      <Text style={{ 
                        "font-size": "13px", 
                        "font-weight": tagType() === "lightweight" ? "500" : "400",
                        color: tagType() === "lightweight" ? tokens.colors.semantic.primary : tokens.colors.text.primary,
                      }}>
                        Lightweight
                      </Text>
                    </div>
                    <Text style={{ "font-size": "10px", color: tokens.colors.text.muted, "margin-top": "2px" }}>
                      Just a reference
                    </Text>
                  </button>
                </div>
              </div>

              {/* Message input (for annotated tags) */}
              <Show when={tagType() === "annotated"}>
                <div>
                  <Textarea
                    label="Message"
                    placeholder="Tag message..."
                    value={message()}
                    onInput={(e) => setMessage(e.currentTarget.value)}
                    style={{ "min-height": "80px" }}
                  />
                  <Show when={!message().trim()}>
                    <Text style={{ "font-size": "11px", color: tokens.colors.semantic.warning, "margin-top": tokens.spacing.sm }}>
                      A message is required for annotated tags
                    </Text>
                  </Show>
                </div>
              </Show>

              {/* Commit selector */}
              <div>
                <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.sm }}>
                  Target Commit
                </Text>
                
                <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.sm }}>
                  {/* HEAD option */}
                  <label
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: tokens.spacing.md,
                      padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
                      background: commitTarget() === "HEAD" ? tokens.colors.interactive.selected : tokens.colors.interactive.hover,
                      "border-radius": tokens.radius.md,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="commitTarget"
                      checked={commitTarget() === "HEAD"}
                      onChange={() => { setCommitTarget("HEAD"); setSelectedCommit("HEAD"); }}
                      style={{ width: "14px", height: "14px", "accent-color": tokens.colors.semantic.primary }}
                    />
                    <Icon name="code-commit" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default }} />
                    <Text style={{ "font-size": "13px", color: tokens.colors.text.primary }}>
                      HEAD
                    </Text>
                    <Show when={currentBranch()}>
                      <Badge variant="default" size="sm">{currentBranch()}</Badge>
                    </Show>
                  </label>

                  {/* Specific commit option */}
                  <div
                    style={{
                      padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
                      background: commitTarget() === "commit" ? tokens.colors.interactive.selected : tokens.colors.interactive.hover,
                      "border-radius": tokens.radius.md,
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        "align-items": "center",
                        gap: tokens.spacing.md,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="commitTarget"
                        checked={commitTarget() === "commit"}
                        onChange={() => setCommitTarget("commit")}
                        style={{ width: "14px", height: "14px", "accent-color": tokens.colors.semantic.primary }}
                      />
                      <Icon name="code-commit" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default }} />
                      <Text style={{ "font-size": "13px", color: tokens.colors.text.primary }}>
                        Specific commit
                      </Text>
                    </label>
                    
                    <Show when={commitTarget() === "commit"}>
                      <div style={{ "margin-top": tokens.spacing.md, "margin-left": "26px" }}>
                        <button
                          type="button"
                          onClick={() => setShowCommitPicker(!showCommitPicker())}
                          style={{
                            display: "flex",
                            "align-items": "center",
                            "justify-content": "space-between",
                            width: "100%",
                            padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                            background: "var(--jb-input-bg)",
                            border: "var(--jb-input-border)",
                            "border-radius": tokens.radius.sm,
                            color: tokens.colors.text.primary,
                            cursor: "pointer",
                          }}
                        >
                          <Text style={{ "font-size": "12px", "font-family": "var(--jb-font-code)" }}>
                            {selectedCommit().substring(0, 7)}
                          </Text>
                          <Icon name="chevron-down" style={{ width: "12px", height: "12px", color: tokens.colors.icon.default }} />
                        </button>
                        
                        <Show when={showCommitPicker()}>
                          <div
                            style={{
                              "margin-top": tokens.spacing.sm,
                              "max-height": "200px",
                              "overflow-y": "auto",
                              background: "var(--jb-popup)",
                              border: `1px solid ${tokens.colors.border.divider}`,
                              "border-radius": tokens.radius.md,
                            }}
                          >
                            <Show when={commitsLoading()}>
                              <div style={{ padding: tokens.spacing.md, "text-align": "center" }}>
                                <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>Loading commits...</Text>
                              </div>
                            </Show>
                            <Show when={!commitsLoading()}>
                              <For each={recentCommits()}>
                                {(commit) => (
                                  <div
                                    style={{
                                      display: "flex",
                                      "align-items": "center",
                                      gap: tokens.spacing.md,
                                      padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                                      cursor: "pointer",
                                      background: selectedCommit() === commit.hash ? tokens.colors.interactive.selected : "transparent",
                                    }}
                                    onMouseEnter={(e) => {
                                      if (selectedCommit() !== commit.hash) {
                                        e.currentTarget.style.background = tokens.colors.interactive.hover;
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (selectedCommit() !== commit.hash) {
                                        e.currentTarget.style.background = "transparent";
                                      }
                                    }}
                                    onClick={() => selectCommit(commit)}
                                  >
                                    <Text style={{ "font-size": "11px", "font-family": "var(--jb-font-code)", color: tokens.colors.semantic.primary }}>
                                      {commit.shortHash}
                                    </Text>
                                    <Text 
                                      style={{ 
                                        flex: "1", 
                                        "font-size": "11px", 
                                        color: tokens.colors.text.primary,
                                        overflow: "hidden",
                                        "text-overflow": "ellipsis",
                                        "white-space": "nowrap",
                                      }}
                                    >
                                      {commit.message}
                                    </Text>
                                    <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
                                      {formatCommitDate(commit.date)}
                                    </Text>
                                  </div>
                                )}
                              </For>
                            </Show>
                          </div>
                        </Show>
                      </div>
                    </Show>
                  </div>
                </div>
              </div>

              {/* Options */}
              <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.md }}>
                <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.muted }}>
                  Options
                </Text>
                
                {/* Push after create */}
                <label style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={pushAfterCreate()}
                    onChange={(e) => setPushAfterCreate(e.currentTarget.checked)}
                    style={{ width: "14px", height: "14px", "accent-color": tokens.colors.semantic.primary }}
                  />
                  <Icon name="cloud" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default }} />
                  <Text style={{ "font-size": "13px", color: tokens.colors.text.primary }}>
                    Push to remote after creating
                  </Text>
                </label>

                {/* GPG sign option */}
                <Show when={gpgConfigured()}>
                  <label style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={signTag()}
                      onChange={(e) => setSignTag(e.currentTarget.checked)}
                      style={{ width: "14px", height: "14px", "accent-color": tokens.colors.semantic.primary }}
                    />
                    <Icon name="lock" style={{ width: "14px", height: "14px", color: signTag() ? tokens.colors.semantic.success : tokens.colors.icon.default }} />
                    <Text style={{ "font-size": "13px", color: tokens.colors.text.primary }}>
                      Sign tag with GPG
                    </Text>
                  </label>
                </Show>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "flex-end",
              gap: tokens.spacing.md,
              padding: `${tokens.spacing.lg} ${tokens.spacing.xl}`,
              "border-top": `1px solid ${tokens.colors.border.divider}`,
              "flex-shrink": "0",
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={props.onCancel}
              disabled={loading()}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              disabled={!canCreate()}
              loading={loading()}
              icon={<Icon name="tag" style={{ width: "14px", height: "14px" }} />}
            >
              Create Tag
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

export default CreateTagDialog;
