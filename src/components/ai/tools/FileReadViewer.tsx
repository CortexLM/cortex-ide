import { Show, For, createSignal, createMemo, createResource } from "solid-js";
import { Icon } from "../../ui/Icon";
import { SafeHTML } from "../../ui/SafeHTML";
import { highlightCode, detectLanguageFromPath } from "@/utils/shikiHighlighter";
import { ToolCard, type ToolStatus } from "./ToolCard";

// ============================================================================
// Types
// ============================================================================

export interface FileReadViewerProps {
  /** File path being read */
  filePath: string;
  /** Content preview (may be truncated) */
  content?: string;
  /** Full content length (to show if truncated) */
  fullLength?: number;
  /** Starting line number (1-indexed) */
  startLine?: number;
  /** Ending line number (1-indexed) */
  endLine?: number;
  /** Current status */
  status?: ToolStatus;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Language for syntax highlighting (auto-detected if not provided) */
  language?: string;
  /** Maximum lines to show before collapsing */
  maxPreviewLines?: number;
  /** Called when "View Full File" is clicked */
  onViewFull?: () => void;
  /** Called when clicking a line number */
  onLineClick?: (lineNumber: number) => void;
}

// ============================================================================
// Utilities
// ============================================================================

function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath;
}

function getFileExtension(filePath: string): string {
  const fileName = getFileName(filePath);
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
}



function getFileIcon(filePath: string) {
  const ext = getFileExtension(filePath);
  const fileName = getFileName(filePath).toLowerCase();

  // Special file names
  if (fileName === "package.json" || fileName === "tsconfig.json") {
    return <Icon name="gear" class="w-4 h-4" />;
  }
  if (fileName.includes("dockerfile") || fileName === ".dockerignore") {
    return <Icon name="database" class="w-4 h-4" />;
  }

  // By extension
  const iconMap: Record<string, string> = {
    ts: "code",
    tsx: "code",
    js: "code",
    jsx: "code",
    py: "code",
    rs: "code",
    go: "code",
    java: "code",
    c: "code",
    cpp: "code",
    json: "file-lines",
    yaml: "file-lines",
    yml: "file-lines",
    toml: "file-lines",
    md: "file-lines",
    txt: "file-lines",
    png: "image",
    jpg: "image",
    jpeg: "image",
    gif: "image",
    svg: "image",
    sql: "database",
  };

  const iconName = iconMap[ext] || "file";
  return <Icon name={iconName} class="w-4 h-4" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// Component
// ============================================================================

export function FileReadViewer(props: FileReadViewerProps) {
  const [copied, setCopied] = createSignal(false);
  const [expanded, setExpanded] = createSignal(true);
  let copyTimeoutId: number | undefined;

  const language = createMemo(() => {
    if (props.language) return props.language;
    return detectLanguageFromPath(props.filePath);
  });

  const lines = createMemo(() => {
    if (!props.content) return [];
    return props.content.split("\n");
  });

  const isTruncated = createMemo(() => {
    if (!props.fullLength || !props.content) return false;
    return props.content.length < props.fullLength;
  });

  const maxLines = () => props.maxPreviewLines || 50;

  const displayLines = createMemo(() => {
    const allLines = lines();
    if (allLines.length <= maxLines()) return allLines;
    if (!expanded()) return allLines.slice(0, maxLines());
    return allLines;
  });

  const hiddenLinesCount = createMemo(() => {
    return lines().length - maxLines();
  });

  const startLineNumber = () => props.startLine || 1;

  // Syntax highlighting
  const [highlightedLines] = createResource(
    () => ({ content: props.content || "", lang: language() }),
    async ({ content, lang }) => {
      if (!content || lang === "plaintext") return null;
      try {
        return await highlightCode(content, lang);
      } catch {
        return null;
      }
    }
  );

  const handleCopy = async () => {
    if (!props.content) return;
    try {
      await navigator.clipboard.writeText(props.content);
      setCopied(true);
      if (copyTimeoutId) clearTimeout(copyTimeoutId);
      copyTimeoutId = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const lineRangeText = createMemo(() => {
    if (!props.startLine && !props.endLine) return null;
    if (props.startLine && props.endLine) {
      return `Lines ${props.startLine}-${props.endLine}`;
    }
    if (props.startLine) {
      return `From line ${props.startLine}`;
    }
    return null;
  });

  return (
    <ToolCard
      name={`Read: ${getFileName(props.filePath)}`}
      icon={getFileIcon(props.filePath)}
      status={props.status || "completed"}
      durationMs={props.durationMs}
      defaultExpanded={true}
    >
      <div class="file-read-viewer">
        {/* File Header */}
        <div
          class="file-header"
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            padding: "10px 14px",
            background: "rgba(0, 0, 0, 0.2)",
            "border-bottom": "1px solid var(--vscode-chat-requestBorder)",
          }}
        >
          <div style={{ display: "flex", "align-items": "center", gap: "8px", flex: "1", "min-width": "0" }}>
            <span style={{ color: "var(--vscode-descriptionForeground)", "flex-shrink": "0" }}>
              {getFileIcon(props.filePath)}
            </span>
            <span
              style={{
                "font-family": "var(--monaco-monospace-font, monospace)",
                "font-size": "var(--vscode-chat-font-size-body-s)",
                color: "var(--vscode-foreground)",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
              }}
              title={props.filePath}
            >
              {props.filePath}
            </span>
          </div>

          <div style={{ display: "flex", "align-items": "center", gap: "8px", "flex-shrink": "0" }}>
            {/* Line Range Badge */}
            <Show when={lineRangeText()}>
              <span
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "4px",
                  padding: "2px 8px",
                  "border-radius": "var(--cortex-radius-sm)",
                  background: "var(--vscode-chat-slashCommandBackground)",
                  color: "var(--vscode-chat-slashCommandForeground)",
                  "font-size": "var(--vscode-chat-font-size-body-xs)",
                }}
              >
                <Icon name="hashtag" class="w-3 h-3" />
                {lineRangeText()}
              </span>
            </Show>

            {/* Language Badge */}
            <Show when={language() !== "plaintext"}>
              <span
                style={{
                  padding: "2px 8px",
                  "border-radius": "var(--cortex-radius-sm)",
                  background: "var(--vscode-editor-background)",
                  color: "var(--vscode-descriptionForeground)",
                  "font-size": "var(--vscode-chat-font-size-body-xs)",
                  "font-family": "var(--monaco-monospace-font, monospace)",
                }}
              >
                {language()}
              </span>
            </Show>

            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "24px",
                height: "24px",
                padding: "0",
                background: "transparent",
                border: "none",
                color: copied() ? "var(--vscode-chat-linesAddedForeground)" : "var(--vscode-descriptionForeground)",
                cursor: "pointer",
                "border-radius": "var(--cortex-radius-sm)",
              }}
              title={copied() ? "Copied!" : "Copy content"}
            >
<Show when={copied()} fallback={<Icon name="copy" class="w-3.5 h-3.5" />}>
                <Icon name="check" class="w-3.5 h-3.5" />
              </Show>
            </button>

            {/* View Full Button */}
            <Show when={props.onViewFull}>
              <button
                type="button"
                onClick={props.onViewFull}
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "4px",
                  padding: "4px 8px",
                  "border-radius": "var(--cortex-radius-sm)",
                  background: "transparent",
                  border: "1px solid var(--vscode-chat-requestBorder)",
                  color: "var(--vscode-descriptionForeground)",
                  cursor: "pointer",
                  "font-size": "var(--vscode-chat-font-size-body-xs)",
                }}
                title="View full file"
              >
                <Icon name="arrow-up-right-from-square" class="w-3 h-3" />
                Open
              </button>
            </Show>
          </div>
        </div>

        {/* Content Preview */}
        <Show when={props.content}>
          <div
            class="file-content"
            style={{
              "font-family": "var(--monaco-monospace-font, monospace)",
              "font-size": "var(--vscode-chat-font-size-body-xs)",
              "line-height": "1.5",
              "overflow-x": "auto",
              background: "var(--vscode-editor-background)",
            }}
          >
            {/* Lines with line numbers */}
            <div style={{ display: "flex" }}>
              {/* Line Numbers Gutter */}
              <div
                class="line-numbers"
                style={{
                  display: "flex",
                  "flex-direction": "column",
                  padding: "10px 0",
                  "background": "rgba(0, 0, 0, 0.2)",
                  "border-right": "1px solid var(--vscode-chat-requestBorder)",
                  "user-select": "none",
                  "flex-shrink": "0",
                }}
              >
                <For each={displayLines()}>
                  {(_, index) => (
                    <div
                      style={{
                        "min-width": "40px",
                        "text-align": "right",
                        "padding-right": "12px",
                        "padding-left": "12px",
                        color: "var(--vscode-descriptionForeground)",
                        cursor: props.onLineClick ? "pointer" : "default",
                      }}
                      onClick={() => props.onLineClick?.(startLineNumber() + index())}
                    >
                      {startLineNumber() + index()}
                    </div>
                  )}
                </For>
              </div>

              {/* Code Content */}
              <pre
                style={{
                  margin: "0",
                  padding: "10px 14px",
                  flex: "1",
                  "overflow-x": "auto",
                }}
              >
                <Show when={highlightedLines()} fallback={
                  <code style={{ color: "var(--vscode-foreground)" }}>
                    <For each={displayLines()}>
                      {(line) => (
                        <div style={{ "min-height": "1.5em" }}>
                          {line || " "}
                        </div>
                      )}
                    </For>
                  </code>
                }>
                  <SafeHTML html={highlightedLines()!} class="shiki-container" />
                </Show>
              </pre>
            </div>

            {/* Expand/Collapse for long files */}
            <Show when={hiddenLinesCount() > 0}>
              <button
                type="button"
                onClick={() => setExpanded(!expanded())}
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  gap: "6px",
                  width: "100%",
                  padding: "8px",
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "none",
                  "border-top": "1px solid var(--vscode-chat-requestBorder)",
                  color: "var(--vscode-descriptionForeground)",
                  cursor: "pointer",
                  "font-size": "var(--vscode-chat-font-size-body-xs)",
                }}
              >
<Show when={expanded()} fallback={
                  <>
                    <Icon name="chevron-down" class="w-3 h-3" />
                    Show {hiddenLinesCount()} more lines
                  </>
                }>
                  <>
                    <Icon name="chevron-up" class="w-3 h-3" />
                    Show less
                  </>
                </Show>
              </button>
            </Show>
          </div>
        </Show>

        {/* Truncation Warning */}
        <Show when={isTruncated()}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "8px",
              padding: "8px 14px",
              background: "rgba(251, 191, 36, 0.1)",
              "border-top": "1px solid var(--vscode-chat-requestBorder)",
              color: "var(--vscode-notificationsWarningIcon-foreground)",
              "font-size": "var(--vscode-chat-font-size-body-xs)",
            }}
          >
            <span>
              Content truncated ({formatFileSize(props.content?.length || 0)} of {formatFileSize(props.fullLength || 0)})
            </span>
            <Show when={props.onViewFull}>
              <button
                type="button"
                onClick={props.onViewFull}
                style={{
                  padding: "2px 8px",
                  "border-radius": "var(--cortex-radius-sm)",
                  background: "transparent",
                  border: "1px solid var(--vscode-notificationsWarningIcon-foreground)",
                  color: "var(--vscode-notificationsWarningIcon-foreground)",
                  cursor: "pointer",
                  "font-size": "var(--vscode-chat-font-size-body-xs)",
                }}
              >
                View Full
              </button>
            </Show>
          </div>
        </Show>

        {/* Empty State */}
        <Show when={!props.content && props.status === "completed"}>
          <div
            style={{
              padding: "20px",
              "text-align": "center",
              color: "var(--vscode-descriptionForeground)",
              "font-size": "var(--vscode-chat-font-size-body-s)",
            }}
          >
            File is empty
          </div>
        </Show>

        <style>{`
          .file-content::-webkit-scrollbar {
            height: 8px;
          }
          .file-content::-webkit-scrollbar-track {
            background: transparent;
          }
          .file-content::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: var(--cortex-radius-sm);
          }
          .shiki-container pre {
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
          }
          .shiki-container code {
            display: block;
          }
          .shiki-container .line {
            min-height: 1.5em;
          }
          .line-numbers div:hover {
            background: var(--vscode-list-hoverBackground);
          }
        `}</style>
      </div>
    </ToolCard>
  );
}

export default FileReadViewer;

