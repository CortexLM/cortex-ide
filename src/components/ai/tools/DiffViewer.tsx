import { Show, For, createSignal, createMemo } from "solid-js";
import { parsePatch } from "diff";
import { Icon } from "../../ui/Icon";
import { ToolCard, type ToolStatus } from "./ToolCard";

// Local type definitions since diff module types may not be exported properly
interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

// ============================================================================
// Types
// ============================================================================

export interface DiffViewerProps {
  /** The unified diff patch string */
  patch: string;
  /** File path (optional, extracted from patch if not provided) */
  filePath?: string;
  /** Current status */
  status?: ToolStatus;
  /** Duration in milliseconds */
  durationMs?: number;
  /** View mode: unified or side-by-side */
  viewMode?: "unified" | "split";
  /** Whether to show accept/reject buttons for each hunk */
  showHunkActions?: boolean;
  /** Called when a hunk is accepted */
  onAcceptHunk?: (hunkIndex: number) => void;
  /** Called when a hunk is rejected */
  onRejectHunk?: (hunkIndex: number) => void;
  /** Called when all changes are accepted */
  onAcceptAll?: () => void;
  /** Called when all changes are rejected */
  onRejectAll?: () => void;
  /** Language for syntax highlighting (auto-detected if not provided) */
  language?: string;
  /** Number of context lines to show initially */
  contextLines?: number;
}

interface DiffLine {
  type: "add" | "remove" | "context" | "header";
  content: string;
  oldLine?: number;
  newLine?: number;
}

interface HunkWithState {
  hunk: Hunk;
  index: number;
  expanded: boolean;
  lines: DiffLine[];
}

// ============================================================================
// Utilities
// ============================================================================

function getFileName(filePath: string): string {
  return filePath.split("/").pop() || filePath;
}

// ============================================================================
// Component
// ============================================================================

export function DiffViewer(props: DiffViewerProps) {
  const [viewMode, setViewMode] = createSignal<"unified" | "split">(props.viewMode || "unified");
  const [expandedHunks, setExpandedHunks] = createSignal<Set<number>>(new Set());

  // Parse the diff
  const parsedDiffs = createMemo(() => {
    try {
      return parsePatch(props.patch);
    } catch {
      return [];
    }
  });

  // Get the file path from props or parsed diff
  const filePath = createMemo(() => {
    if (props.filePath) return props.filePath;
    const diff = parsedDiffs()[0];
    return diff?.newFileName?.replace(/^b\//, "") || diff?.oldFileName?.replace(/^a\//, "") || "unknown";
  });

  // Process hunks with lines
  const hunksWithState = createMemo((): HunkWithState[] => {
    const diff = parsedDiffs()[0];
    if (!diff?.hunks) return [];

    return diff.hunks.map((hunk, index) => {
      const lines: DiffLine[] = [];
      let oldLine = hunk.oldStart;
      let newLine = hunk.newStart;

      for (const line of hunk.lines) {
        if (line.startsWith("+")) {
          lines.push({ type: "add", content: line.slice(1), newLine: newLine++ });
        } else if (line.startsWith("-")) {
          lines.push({ type: "remove", content: line.slice(1), oldLine: oldLine++ });
        } else {
          lines.push({ type: "context", content: line.slice(1), oldLine: oldLine++, newLine: newLine++ });
        }
      }

      return {
        hunk,
        index,
        expanded: expandedHunks().has(index),
        lines,
      };
    });
  });

  // Stats
  const stats = createMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const h of hunksWithState()) {
      for (const line of h.lines) {
        if (line.type === "add") additions++;
        if (line.type === "remove") deletions++;
      }
    }
    return { additions, deletions };
  });

  const toggleHunk = (index: number) => {
    setExpandedHunks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <ToolCard
      name={`Edit: ${getFileName(filePath())}`}
      icon={<Icon name="code-merge" class="w-4 h-4" />}
      status={props.status || "completed"}
      durationMs={props.durationMs}
      defaultExpanded={true}
    >
      <div class="diff-viewer">
        {/* File Header */}
        <div
          class="diff-file-header"
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            padding: "10px 14px",
            background: "rgba(0, 0, 0, 0.2)",
            "border-bottom": "1px solid var(--vscode-chat-requestBorder)",
          }}
        >
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <Icon name="file" class="w-4 h-4" style={{ color: "var(--vscode-descriptionForeground)" }} />
            <span
              style={{
                "font-family": "var(--monaco-monospace-font, monospace)",
                "font-size": "var(--vscode-chat-font-size-body-s)",
                color: "var(--vscode-foreground)",
              }}
            >
              {filePath()}
            </span>
          </div>

          <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
            {/* Stats */}
            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
              <span
                style={{
                  "font-size": "var(--vscode-chat-font-size-body-xs)",
                  color: "var(--vscode-chat-linesAddedForeground)",
                }}
              >
                +{stats().additions}
              </span>
              <span
                style={{
                  "font-size": "var(--vscode-chat-font-size-body-xs)",
                  color: "var(--vscode-chat-linesRemovedForeground)",
                }}
              >
                -{stats().deletions}
              </span>
            </div>

            {/* View Mode Toggle */}
            <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
              <button
                type="button"
                onClick={() => setViewMode("unified")}
                style={{
                  padding: "4px 8px",
                  "border-radius": "var(--cortex-radius-sm)",
                  border: "none",
                  background: viewMode() === "unified" ? "var(--vscode-toolbar-activeBackground)" : "transparent",
                  color: viewMode() === "unified" ? "var(--vscode-foreground)" : "var(--vscode-descriptionForeground)",
                  cursor: "pointer",
                  "font-size": "var(--vscode-chat-font-size-body-xs)",
                }}
              >
                Unified
              </button>
              <button
                type="button"
                onClick={() => setViewMode("split")}
                style={{
                  padding: "4px 8px",
                  "border-radius": "var(--cortex-radius-sm)",
                  border: "none",
                  background: viewMode() === "split" ? "var(--vscode-toolbar-activeBackground)" : "transparent",
                  color: viewMode() === "split" ? "var(--vscode-foreground)" : "var(--vscode-descriptionForeground)",
                  cursor: "pointer",
                  "font-size": "var(--vscode-chat-font-size-body-xs)",
                }}
              >
                Split
              </button>
            </div>
          </div>
        </div>

        {/* Accept/Reject All Actions */}
        <Show when={props.showHunkActions && (props.onAcceptAll || props.onRejectAll)}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "flex-end",
              gap: "8px",
              padding: "8px 14px",
              "border-bottom": "1px solid var(--vscode-chat-requestBorder)",
              background: "rgba(0, 0, 0, 0.1)",
            }}
          >
            <Show when={props.onRejectAll}>
              <button
                type="button"
                onClick={props.onRejectAll}
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "4px",
                  padding: "4px 10px",
                  "border-radius": "var(--cortex-radius-sm)",
                  border: "1px solid var(--vscode-chat-linesRemovedForeground)",
                  background: "transparent",
                  color: "var(--vscode-chat-linesRemovedForeground)",
                  cursor: "pointer",
                  "font-size": "var(--vscode-chat-font-size-body-xs)",
                }}
              >
                <Icon name="xmark" class="w-3 h-3" />
                Reject All
              </button>
            </Show>
            <Show when={props.onAcceptAll}>
              <button
                type="button"
                onClick={props.onAcceptAll}
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "4px",
                  padding: "4px 10px",
                  "border-radius": "var(--cortex-radius-sm)",
                  border: "none",
                  background: "var(--vscode-chat-linesAddedForeground)",
                  color: "var(--cortex-text-primary)",
                  cursor: "pointer",
                  "font-size": "var(--vscode-chat-font-size-body-xs)",
                  "font-weight": "500",
                }}
              >
                <Icon name="check" class="w-3 h-3" />
                Accept All
              </button>
            </Show>
          </div>
        </Show>

        {/* Diff Content */}
        <div
          class="diff-content"
          style={{
            "font-family": "var(--monaco-monospace-font, monospace)",
            "font-size": "var(--vscode-chat-font-size-body-xs)",
            "line-height": "1.5",
            "overflow-x": "auto",
          }}
        >
          <Show when={viewMode() === "unified"}>
            <UnifiedDiffView
              hunks={hunksWithState()}
              showHunkActions={props.showHunkActions}
              onAcceptHunk={props.onAcceptHunk}
              onRejectHunk={props.onRejectHunk}
              onToggleHunk={toggleHunk}
            />
          </Show>

          <Show when={viewMode() === "split"}>
            <SplitDiffView
              hunks={hunksWithState()}
              showHunkActions={props.showHunkActions}
              onAcceptHunk={props.onAcceptHunk}
              onRejectHunk={props.onRejectHunk}
            />
          </Show>
        </div>

        <style>{`
          .diff-line-add {
            background: var(--vscode-diffEditor-insertedLineBackground);
          }
          .diff-line-remove {
            background: var(--vscode-diffEditor-removedLineBackground);
          }
          .diff-line-context {
            background: transparent;
          }
          .diff-line:hover {
            filter: brightness(1.1);
          }
          .diff-gutter {
            user-select: none;
          }
        `}</style>
      </div>
    </ToolCard>
  );
}

// ============================================================================
// Unified Diff View
// ============================================================================

interface UnifiedDiffViewProps {
  hunks: HunkWithState[];
  showHunkActions?: boolean;
  onAcceptHunk?: (index: number) => void;
  onRejectHunk?: (index: number) => void;
  onToggleHunk: (index: number) => void;
}

function UnifiedDiffView(props: UnifiedDiffViewProps) {
  return (
    <div class="unified-diff">
      <For each={props.hunks}>
        {(hunkState) => (
          <div class="diff-hunk">
            {/* Hunk Header */}
            <div
              class="diff-hunk-header"
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                padding: "6px 14px",
                background: "var(--vscode-editor-background)",
                "border-bottom": "1px solid var(--vscode-chat-requestBorder)",
                color: "var(--vscode-descriptionForeground)",
                "font-size": "var(--vscode-chat-font-size-body-xs)",
              }}
            >
              <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => props.onToggleHunk(hunkState.index)}
                  style={{
                    display: "flex",
                    "align-items": "center",
                    padding: "2px",
                    background: "transparent",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                >
<Show when={hunkState.expanded} fallback={<Icon name="chevron-right" class="w-3 h-3" />}>
                    <Icon name="chevron-down" class="w-3 h-3" />
                  </Show>
                </button>
                <span>
                  @@ -{hunkState.hunk.oldStart},{hunkState.hunk.oldLines} +{hunkState.hunk.newStart},{hunkState.hunk.newLines} @@
                </span>
              </div>

              <Show when={props.showHunkActions}>
                <div style={{ display: "flex", gap: "4px" }}>
                  <Show when={props.onRejectHunk}>
                    <button
                      type="button"
                      onClick={() => props.onRejectHunk!(hunkState.index)}
                      style={{
                        padding: "2px 6px",
                        "border-radius": "var(--cortex-radius-sm)",
                        border: "1px solid var(--vscode-chat-linesRemovedForeground)",
                        background: "transparent",
                        color: "var(--vscode-chat-linesRemovedForeground)",
                        cursor: "pointer",
                        "font-size": "10px",
                      }}
                    >
                      Reject
                    </button>
                  </Show>
                  <Show when={props.onAcceptHunk}>
                    <button
                      type="button"
                      onClick={() => props.onAcceptHunk!(hunkState.index)}
                      style={{
                        padding: "2px 6px",
                        "border-radius": "var(--cortex-radius-sm)",
                        border: "none",
                        background: "var(--vscode-chat-linesAddedForeground)",
                        color: "var(--cortex-text-primary)",
                        cursor: "pointer",
                        "font-size": "10px",
                      }}
                    >
                      Accept
                    </button>
                  </Show>
                </div>
              </Show>
            </div>

            {/* Hunk Lines */}
            <Show when={!hunkState.expanded || true}>
              <div class="diff-lines">
                <For each={hunkState.lines}>
                  {(line) => (
                    <div
                      class={`diff-line diff-line-${line.type}`}
                      style={{
                        display: "flex",
                        "min-height": "20px",
                      }}
                    >
                      <span
                        class="diff-gutter"
                        style={{
                          width: "40px",
                          "flex-shrink": "0",
                          "text-align": "right",
                          "padding-right": "8px",
                          color: "var(--vscode-descriptionForeground)",
                          "border-right": "1px solid var(--vscode-chat-requestBorder)",
                          background: "rgba(0,0,0,0.1)",
                        }}
                      >
                        {line.oldLine || ""}
                      </span>
                      <span
                        class="diff-gutter"
                        style={{
                          width: "40px",
                          "flex-shrink": "0",
                          "text-align": "right",
                          "padding-right": "8px",
                          color: "var(--vscode-descriptionForeground)",
                          "border-right": "1px solid var(--vscode-chat-requestBorder)",
                          background: "rgba(0,0,0,0.1)",
                        }}
                      >
                        {line.newLine || ""}
                      </span>
                      <span
                        class="diff-symbol"
                        style={{
                          width: "20px",
                          "flex-shrink": "0",
                          "text-align": "center",
                          color:
                            line.type === "add"
                              ? "var(--vscode-chat-linesAddedForeground)"
                              : line.type === "remove"
                                ? "var(--vscode-chat-linesRemovedForeground)"
                                : "var(--vscode-descriptionForeground)",
                        }}
                      >
                        {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                      </span>
                      <span
                        class="diff-content"
                        style={{
                          flex: "1",
                          "padding-left": "4px",
                          "white-space": "pre",
                          "overflow-x": "auto",
                        }}
                      >
                        {line.content}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}

// ============================================================================
// Split Diff View
// ============================================================================

interface SplitDiffViewProps {
  hunks: HunkWithState[];
  showHunkActions?: boolean;
  onAcceptHunk?: (index: number) => void;
  onRejectHunk?: (index: number) => void;
}

function SplitDiffView(props: SplitDiffViewProps) {
  // Process lines for side-by-side view
  const processedHunks = createMemo(() => {
    return props.hunks.map((hunkState) => {
      const leftLines: (DiffLine | null)[] = [];
      const rightLines: (DiffLine | null)[] = [];

      let i = 0;
      while (i < hunkState.lines.length) {
        const line = hunkState.lines[i];

        if (line.type === "context") {
          leftLines.push(line);
          rightLines.push(line);
          i++;
        } else if (line.type === "remove") {
          // Check if next line is an add (modification)
          const nextLine = hunkState.lines[i + 1];
          if (nextLine?.type === "add") {
            leftLines.push(line);
            rightLines.push(nextLine);
            i += 2;
          } else {
            leftLines.push(line);
            rightLines.push(null);
            i++;
          }
        } else if (line.type === "add") {
          leftLines.push(null);
          rightLines.push(line);
          i++;
        } else {
          i++;
        }
      }

      return {
        ...hunkState,
        leftLines,
        rightLines,
      };
    });
  });

  return (
    <div class="split-diff">
      <For each={processedHunks()}>
        {(hunkState) => (
          <div class="diff-hunk">
            {/* Hunk Header */}
            <div
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                padding: "6px 14px",
                background: "var(--vscode-editor-background)",
                "border-bottom": "1px solid var(--vscode-chat-requestBorder)",
                color: "var(--vscode-descriptionForeground)",
                "font-size": "var(--vscode-chat-font-size-body-xs)",
              }}
            >
              <span>
                @@ -{hunkState.hunk.oldStart},{hunkState.hunk.oldLines} +{hunkState.hunk.newStart},{hunkState.hunk.newLines} @@
              </span>

              <Show when={props.showHunkActions}>
                <div style={{ display: "flex", gap: "4px" }}>
                  <Show when={props.onRejectHunk}>
                    <button
                      type="button"
                      onClick={() => props.onRejectHunk!(hunkState.index)}
                      style={{
                        padding: "2px 6px",
                        "border-radius": "var(--cortex-radius-sm)",
                        border: "1px solid var(--vscode-chat-linesRemovedForeground)",
                        background: "transparent",
                        color: "var(--vscode-chat-linesRemovedForeground)",
                        cursor: "pointer",
                        "font-size": "10px",
                      }}
                    >
                      Reject
                    </button>
                  </Show>
                  <Show when={props.onAcceptHunk}>
                    <button
                      type="button"
                      onClick={() => props.onAcceptHunk!(hunkState.index)}
                      style={{
                        padding: "2px 6px",
                        "border-radius": "var(--cortex-radius-sm)",
                        border: "none",
                        background: "var(--vscode-chat-linesAddedForeground)",
                        color: "var(--cortex-text-primary)",
                        cursor: "pointer",
                        "font-size": "10px",
                      }}
                    >
                      Accept
                    </button>
                  </Show>
                </div>
              </Show>
            </div>

            {/* Split Lines */}
            <div style={{ display: "flex" }}>
              {/* Left Side (Old) */}
              <div style={{ flex: "1", "border-right": "1px solid var(--vscode-chat-requestBorder)" }}>
                <For each={hunkState.leftLines}>
                  {(line) => (
                    <div
                      class={`diff-line ${line ? `diff-line-${line.type}` : ""}`}
                      style={{
                        display: "flex",
                        "min-height": "20px",
                        background: line?.type === "remove" ? "var(--vscode-diffEditor-removedLineBackground)" : "transparent",
                      }}
                    >
                      <span
                        class="diff-gutter"
                        style={{
                          width: "40px",
                          "flex-shrink": "0",
                          "text-align": "right",
                          "padding-right": "8px",
                          color: "var(--vscode-descriptionForeground)",
                          "border-right": "1px solid var(--vscode-chat-requestBorder)",
                          background: "rgba(0,0,0,0.1)",
                        }}
                      >
                        {line?.oldLine || ""}
                      </span>
                      <span
                        class="diff-content"
                        style={{
                          flex: "1",
                          "padding-left": "8px",
                          "white-space": "pre",
                          "overflow-x": "auto",
                        }}
                      >
                        {line?.content || ""}
                      </span>
                    </div>
                  )}
                </For>
              </div>

              {/* Right Side (New) */}
              <div style={{ flex: "1" }}>
                <For each={hunkState.rightLines}>
                  {(line) => (
                    <div
                      class={`diff-line ${line ? `diff-line-${line.type}` : ""}`}
                      style={{
                        display: "flex",
                        "min-height": "20px",
                        background: line?.type === "add" ? "var(--vscode-diffEditor-insertedLineBackground)" : "transparent",
                      }}
                    >
                      <span
                        class="diff-gutter"
                        style={{
                          width: "40px",
                          "flex-shrink": "0",
                          "text-align": "right",
                          "padding-right": "8px",
                          color: "var(--vscode-descriptionForeground)",
                          "border-right": "1px solid var(--vscode-chat-requestBorder)",
                          background: "rgba(0,0,0,0.1)",
                        }}
                      >
                        {line?.newLine || ""}
                      </span>
                      <span
                        class="diff-content"
                        style={{
                          flex: "1",
                          "padding-left": "8px",
                          "white-space": "pre",
                          "overflow-x": "auto",
                        }}
                      >
                        {line?.content || ""}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

export default DiffViewer;

