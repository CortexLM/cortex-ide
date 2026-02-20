/**
 * Stash Diff View - Display the contents of a stash
 *
 * Shows:
 * - Stash message and metadata
 * - List of changed files with stats
 * - Full diff in Monaco diff editor
 */

import { createSignal, Show, For, createEffect } from "solid-js";
import { Icon } from "../ui/Icon";
import { Button, Text } from "@/components/ui";
import { tokens } from "@/design-system/tokens";
import { gitStashShow, type StashDiff } from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";

export interface StashDiffViewProps {
  stashIndex: number;
  onClose: () => void;
  onApply?: (index: number) => void;
  onPop?: (index: number) => void;
  onDrop?: (index: number) => void;
}

export function StashDiffView(props: StashDiffViewProps) {
  const [stashDiff, setStashDiff] = createSignal<StashDiff | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);

  // Fetch stash details on mount or when index changes
  createEffect(() => {
    fetchStashDetails(props.stashIndex);
  });

  const fetchStashDetails = async (index: number) => {
    setLoading(true);
    setError(null);
    try {
      const projectPath = getProjectPath();
      const result = await gitStashShow(projectPath, index);
      setStashDiff(result);
      // Select first file by default
      if (result.files.length > 0) {
        setSelectedFile(result.files[0].path);
      }
    } catch (err) {
      console.error("Failed to fetch stash details:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const copyDiff = async () => {
    const diff = stashDiff()?.diff;
    if (diff) {
      await navigator.clipboard.writeText(diff);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getFileIcon = (status: string) => {
    switch (status) {
      case "added":
        return <Icon name="plus" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.success }} />;
      case "deleted":
        return <Icon name="trash" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.error }} />;
      default:
        return <Icon name="pen" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.warning }} />;
    }
  };

  const getFileDiff = (filePath: string): string => {
    const diff = stashDiff()?.diff || "";
    // Extract the diff for the specific file
    const lines = diff.split("\n");
    let inFile = false;
    let fileDiff: string[] = [];

    for (const line of lines) {
      if (line.startsWith("diff --git")) {
        if (inFile) break;
        // Check if this is the file we're looking for
        if (line.includes(`b/${filePath}`)) {
          inFile = true;
        }
      }
      if (inFile) {
        fileDiff.push(line);
      }
    }

    return fileDiff.join("\n");
  };

  const getTotalStats = () => {
    const files = stashDiff()?.files || [];
    return files.reduce(
      (acc, f) => ({
        additions: acc.additions + f.additions,
        deletions: acc.deletions + f.deletions,
      }),
      { additions: 0, deletions: 0 }
    );
  };

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        background: tokens.colors.surface.canvas,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
          background: tokens.colors.surface.popup,
        }}
      >
        <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.xs }}>
          <Text style={{ "font-size": "13px", "font-weight": "500", color: tokens.colors.text.primary }}>
            stash@{`{${props.stashIndex}}`}
          </Text>
          <Show when={stashDiff()}>
            <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
              {stashDiff()!.message}
            </Text>
          </Show>
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
          <Show when={props.onApply}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => props.onApply?.(props.stashIndex)}
            >
              Apply
            </Button>
          </Show>
          <Show when={props.onPop}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => props.onPop?.(props.stashIndex)}
            >
              Pop
            </Button>
          </Show>
          <Show when={props.onDrop}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => props.onDrop?.(props.stashIndex)}
              style={{ color: tokens.colors.semantic.error }}
            >
              Drop
            </Button>
          </Show>
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="xmark" style={{ width: "14px", height: "14px" }} />}
            onClick={props.onClose}
          />
        </div>
      </div>

      {/* Loading State */}
      <Show when={loading()}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            padding: tokens.spacing.xl,
            flex: "1",
          }}
        >
          <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
            Loading stash contents...
          </Text>
        </div>
      </Show>

      {/* Error State */}
      <Show when={error()}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            padding: tokens.spacing.xl,
            flex: "1",
          }}
        >
          <Text style={{ "font-size": "12px", color: tokens.colors.semantic.error }}>
            {error()}
          </Text>
        </div>
      </Show>

      {/* Content */}
      <Show when={!loading() && !error() && stashDiff()}>
        <div style={{ display: "flex", flex: "1", overflow: "hidden" }}>
          {/* File List */}
          <div
            style={{
              width: "250px",
              "border-right": `1px solid ${tokens.colors.border.default}`,
              overflow: "auto",
              "flex-shrink": "0",
            }}
          >
            {/* Stats Summary */}
            <div
              style={{
                padding: tokens.spacing.sm,
                "border-bottom": `1px solid ${tokens.colors.border.divider}`,
                display: "flex",
                "align-items": "center",
                gap: tokens.spacing.md,
              }}
            >
              <Text style={{ "font-size": "11px", color: tokens.colors.text.muted }}>
                {stashDiff()!.files.length} files
              </Text>
              <Text style={{ "font-size": "11px", color: tokens.colors.semantic.success }}>
                +{getTotalStats().additions}
              </Text>
              <Text style={{ "font-size": "11px", color: tokens.colors.semantic.error }}>
                -{getTotalStats().deletions}
              </Text>
            </div>

            {/* Files */}
            <For each={stashDiff()!.files}>
              {(file) => (
                <button
                  type="button"
                  onClick={() => setSelectedFile(file.path)}
                  style={{
                    width: "100%",
                    display: "flex",
                    "align-items": "center",
                    gap: tokens.spacing.sm,
                    padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
                    background: selectedFile() === file.path ? tokens.colors.interactive.hover : "transparent",
                    border: "none",
                    cursor: "pointer",
                    "text-align": "left",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedFile() !== file.path) {
                      e.currentTarget.style.background = tokens.colors.surface.panel;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedFile() !== file.path) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  {getFileIcon(file.status)}
                  <span
                    style={{
                      "font-size": "11px",
                      color: tokens.colors.text.primary,
                      flex: "1",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                      "white-space": "nowrap",
                    }}
                    title={file.path}
                  >
                    {file.path.split("/").pop()}
                  </span>
                  <div style={{ display: "flex", gap: tokens.spacing.xs }}>
                    <Text style={{ "font-size": "10px", color: tokens.colors.semantic.success }}>
                      +{file.additions}
                    </Text>
                    <Text style={{ "font-size": "10px", color: tokens.colors.semantic.error }}>
                      -{file.deletions}
                    </Text>
                  </div>
                </button>
              )}
            </For>
          </div>

          {/* Diff View */}
          <div style={{ flex: "1", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
            {/* Diff Header */}
            <div
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
                "border-bottom": `1px solid ${tokens.colors.border.divider}`,
                background: tokens.colors.surface.panel,
              }}
            >
              <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
                <Icon name="file" style={{ width: "12px", height: "12px", color: tokens.colors.text.muted }} />
                <Text style={{ "font-size": "11px", color: tokens.colors.text.primary }}>
                  {selectedFile() || "Select a file"}
                </Text>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={
                  copied() ? (
                    <Icon name="check" style={{ width: "12px", height: "12px", color: tokens.colors.semantic.success }} />
                  ) : (
                    <Icon name="copy" style={{ width: "12px", height: "12px" }} />
                  )
                }
                onClick={copyDiff}
                title="Copy diff"
              />
            </div>

            {/* Diff Content */}
            <div
              style={{
                flex: "1",
                overflow: "auto",
                "font-family": "monospace",
                "font-size": "12px",
                "line-height": "1.5",
                padding: tokens.spacing.sm,
                "white-space": "pre",
                background: tokens.colors.surface.canvas,
              }}
            >
              <Show when={selectedFile()}>
                <For each={getFileDiff(selectedFile()!).split("\n")}>
                  {(line) => (
                    <div
                      style={{
                        padding: `0 ${tokens.spacing.sm}`,
                        background: line.startsWith("+") && !line.startsWith("+++")
                          ? `${tokens.colors.semantic.success}15`
                          : line.startsWith("-") && !line.startsWith("---")
                          ? `${tokens.colors.semantic.error}15`
                          : line.startsWith("@@")
                          ? `${tokens.colors.semantic.primary}15`
                          : "transparent",
                        color: line.startsWith("+") && !line.startsWith("+++")
                          ? tokens.colors.semantic.success
                          : line.startsWith("-") && !line.startsWith("---")
                          ? tokens.colors.semantic.error
                          : line.startsWith("@@")
                          ? tokens.colors.semantic.primary
                          : tokens.colors.text.secondary,
                      }}
                    >
                      {line || " "}
                    </div>
                  )}
                </For>
              </Show>
              <Show when={!selectedFile()}>
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "center",
                    height: "100%",
                    color: tokens.colors.text.muted,
                  }}
                >
                  Select a file to view its diff
                </div>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default StashDiffView;
