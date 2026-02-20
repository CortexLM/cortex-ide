/**
 * MultiDiffEditor - Multi-File Diff View Component
 * 
 * A VS Code-style multi-file diff viewer that displays changes across
 * multiple files in a single scrollable view with collapsible sections.
 * 
 * Features:
 * - Scrollable list of file diffs with virtual scrolling for performance
 * - Collapsible file sections with inline Monaco diff editors
 * - File navigation with keyboard shortcuts (Ctrl+Up/Down, F7/Shift+F7)
 * - Stats summary showing files changed, insertions, deletions
 * - Filter by file type/path and search within diffs
 * - Git integration: stage/unstage, revert changes per file
 * - "Open File" action per diff
 * 
 * Use Cases:
 * - Git staged changes review
 * - Pull request review
 * - Comparing branches
 * - Commit diff viewing
 */

import {
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
  For,
  Show,

  type Accessor,
} from "solid-js";
import { Icon } from "../ui/Icon";
import type * as Monaco from "monaco-editor";
import { MonacoManager } from "@/utils/monacoManager";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Types
// ============================================================================

/** Status of a file in the diff */
export type FileStatus = "added" | "modified" | "deleted" | "renamed" | "copied";

/** A single file's diff data */
export interface FileDiff {
  /** File path (new path if renamed) */
  path: string;
  /** Old path if renamed/copied */
  oldPath?: string;
  /** File status */
  status: FileStatus;
  /** Original content (empty for added files) */
  originalContent: string;
  /** Modified content (empty for deleted files) */
  modifiedContent: string;
  /** Number of insertions */
  additions: number;
  /** Number of deletions */
  deletions: number;
  /** Whether this is a binary file */
  binary?: boolean;
  /** Language ID for syntax highlighting */
  language?: string;
}

/** Props for the MultiDiffEditor component */
export interface MultiDiffEditorProps {
  /** Array of file diffs to display */
  files: FileDiff[];
  /** Title for the diff view (e.g., "Staged Changes", "Branch Comparison") */
  title?: string;
  /** Subtitle with additional context */
  subtitle?: string;
  /** Whether files are staged (affects stage/unstage actions) */
  staged?: boolean;
  /** Callback when user wants to open a file */
  onOpenFile?: (path: string) => void;
  /** Callback when user wants to stage a file */
  onStageFile?: (path: string) => Promise<void>;
  /** Callback when user wants to unstage a file */
  onUnstageFile?: (path: string) => Promise<void>;
  /** Callback when user wants to revert/discard changes */
  onRevertFile?: (path: string) => Promise<void>;
  /** Callback when the view is closed */
  onClose?: () => void;
  /** Whether the editor is read-only (no stage/unstage/revert) */
  readOnly?: boolean;
  /** Default expanded state for files */
  defaultExpanded?: boolean;
  /** Maximum height for individual diff editors (px) */
  maxDiffHeight?: number;
  /** Repository path for operations */
  repoPath?: string;
}

/** State for a single file section */
interface FileSectionState {
  expanded: boolean;
  loading: boolean;
  editorMounted: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Default max height for each diff editor */
const DEFAULT_MAX_DIFF_HEIGHT = 400;

/** Minimum height for each diff editor */
const MIN_DIFF_HEIGHT = 100;

/** Height of file headers */
const FILE_HEADER_HEIGHT = 36;

/** Language mapping for file extensions */
const extensionLanguageMap: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  rb: "ruby",
  php: "php",
  swift: "swift",
  m: "objective-c",
  sql: "sql",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  md: "markdown",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  dockerfile: "dockerfile",
  toml: "ini",
  ini: "ini",
  lua: "lua",
  r: "r",
  scala: "scala",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  clj: "clojure",
  hs: "haskell",
  pl: "perl",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Detect language from file path
 */
function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return extensionLanguageMap[ext] || "plaintext";
}

/**
 * Get file name from path
 */
function getFileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1];
}

/**
 * Get directory from path
 */
function getDirectory(path: string): string {
  const parts = path.split(/[/\\]/);
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

/**
 * Get file extension from path
 */
function getExtension(path: string): string {
  const parts = path.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/**
 * Get status color
 */
function getStatusColor(status: FileStatus): string {
  switch (status) {
    case "added":
      return tokens.colors.semantic.success;
    case "deleted":
      return tokens.colors.semantic.error;
    case "modified":
      return tokens.colors.semantic.warning;
    case "renamed":
    case "copied":
      return tokens.colors.semantic.info;
    default:
      return tokens.colors.text.muted;
  }
}

/**
 * Get status letter for badge
 */
function getStatusLetter(status: FileStatus): string {
  switch (status) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "modified":
      return "M";
    case "renamed":
      return "R";
    case "copied":
      return "C";
    default:
      return "?";
  }
}

/**
 * Calculate optimal diff height based on content
 */
function calculateDiffHeight(
  originalContent: string,
  modifiedContent: string,
  maxHeight: number
): number {
  const originalLines = originalContent.split("\n").length;
  const modifiedLines = modifiedContent.split("\n").length;
  const maxLines = Math.max(originalLines, modifiedLines);
  const lineHeight = 20; // Monaco default line height
  const calculatedHeight = maxLines * lineHeight + 40; // Extra padding
  return Math.max(MIN_DIFF_HEIGHT, Math.min(calculatedHeight, maxHeight));
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Stats Summary Bar
 */
function StatsSummary(props: {
  files: FileDiff[];
  filteredCount: number;
}) {
  const stats = createMemo(() => {
    const total = props.files.length;
    const additions = props.files.reduce((sum, f) => sum + f.additions, 0);
    const deletions = props.files.reduce((sum, f) => sum + f.deletions, 0);
    const added = props.files.filter((f) => f.status === "added").length;
    const modified = props.files.filter((f) => f.status === "modified").length;
    const deleted = props.files.filter((f) => f.status === "deleted").length;
    const renamed = props.files.filter((f) => f.status === "renamed" || f.status === "copied").length;

    return { total, additions, deletions, added, modified, deleted, renamed };
  });

  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        gap: tokens.spacing.lg,
        padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
        background: tokens.colors.surface.panel,
        "border-bottom": `1px solid ${tokens.colors.border.divider}`,
        "font-size": tokens.typography.fontSize.xs,
        "flex-wrap": "wrap",
      }}
    >
      {/* File counts */}
      <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
        <span style={{ color: tokens.colors.text.muted }}>
          {props.filteredCount === stats().total
            ? `${stats().total} files`
            : `${props.filteredCount} of ${stats().total} files`}
        </span>

        <Show when={stats().added > 0}>
          <span style={{ color: tokens.colors.semantic.success }}>
            +{stats().added} added
          </span>
        </Show>

        <Show when={stats().modified > 0}>
          <span style={{ color: tokens.colors.semantic.warning }}>
            ~{stats().modified} modified
          </span>
        </Show>

        <Show when={stats().deleted > 0}>
          <span style={{ color: tokens.colors.semantic.error }}>
            -{stats().deleted} deleted
          </span>
        </Show>

        <Show when={stats().renamed > 0}>
          <span style={{ color: tokens.colors.semantic.info }}>
            {stats().renamed} renamed
          </span>
        </Show>
      </div>

      {/* Line changes */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: tokens.spacing.md,
          "margin-left": "auto",
        }}
      >
        <span style={{ color: tokens.colors.semantic.success }}>
          <Icon name="plus" style={{ width: "12px", height: "12px", "vertical-align": "middle", "margin-right": "2px" }} />
          {stats().additions.toLocaleString()}
        </span>
        <span style={{ color: tokens.colors.semantic.error }}>
          <Icon name="minus" style={{ width: "12px", height: "12px", "vertical-align": "middle", "margin-right": "2px" }} />
          {stats().deletions.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

/**
 * Search and Filter Bar
 */
function SearchFilterBar(props: {
  searchQuery: Accessor<string>;
  setSearchQuery: (query: string) => void;
  filterType: Accessor<string>;
  setFilterType: (type: string) => void;
  extensionOptions: string[];
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  const [showFilterDropdown, setShowFilterDropdown] = createSignal(false);

  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        gap: tokens.spacing.md,
        padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
        "border-bottom": `1px solid ${tokens.colors.border.divider}`,
      }}
    >
      {/* Search input */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: tokens.spacing.sm,
          flex: 1,
          background: tokens.colors.surface.canvas,
          border: `1px solid ${tokens.colors.border.default}`,
          "border-radius": tokens.radius.md,
          padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
        }}
      >
        <Icon name="magnifying-glass" style={{ width: "14px", height: "14px", color: tokens.colors.text.muted }} />
        <input
          type="text"
          placeholder="Search files or content..."
          value={props.searchQuery()}
          onInput={(e) => props.setSearchQuery(e.currentTarget.value)}
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            outline: "none",
            color: tokens.colors.text.primary,
            "font-size": tokens.typography.fontSize.sm,
          }}
        />
        <Show when={props.searchQuery()}>
          <button
            onClick={() => props.setSearchQuery("")}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: tokens.spacing.xs,
              display: "flex",
              "align-items": "center",
            }}
          >
            <Icon name="xmark" style={{ width: "12px", height: "12px", color: tokens.colors.text.muted }} />
          </button>
        </Show>
      </div>

      {/* Filter dropdown */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setShowFilterDropdown(!showFilterDropdown())}
          style={{
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.sm,
            background: props.filterType() ? tokens.colors.interactive.selected : "transparent",
            border: `1px solid ${tokens.colors.border.default}`,
            "border-radius": tokens.radius.md,
            padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
            cursor: "pointer",
            color: tokens.colors.text.primary,
            "font-size": tokens.typography.fontSize.sm,
          }}
        >
          <Icon name="filter" style={{ width: "14px", height: "14px" }} />
          <span>{props.filterType() || "Filter"}</span>
          <Icon name="chevron-down" style={{ width: "12px", height: "12px" }} />
        </button>

        <Show when={showFilterDropdown()}>
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              "margin-top": tokens.spacing.xs,
              background: tokens.colors.surface.popup,
              border: `1px solid ${tokens.colors.border.divider}`,
              "border-radius": tokens.radius.md,
              "box-shadow": tokens.shadows.popup,
              "z-index": tokens.zIndex.dropdown,
              "min-width": "120px",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => {
                props.setFilterType("");
                setShowFilterDropdown(false);
              }}
              style={{
                display: "block",
                width: "100%",
                padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                border: "none",
                background: !props.filterType() ? tokens.colors.interactive.selected : "transparent",
                color: tokens.colors.text.primary,
                "text-align": "left",
                cursor: "pointer",
                "font-size": tokens.typography.fontSize.sm,
              }}
            >
              All files
            </button>
            <For each={props.extensionOptions}>
              {(ext) => (
                <button
                  onClick={() => {
                    props.setFilterType(ext);
                    setShowFilterDropdown(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
                    border: "none",
                    background: props.filterType() === ext ? tokens.colors.interactive.selected : "transparent",
                    color: tokens.colors.text.primary,
                    "text-align": "left",
                    cursor: "pointer",
                    "font-size": tokens.typography.fontSize.sm,
                  }}
                >
                  .{ext}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Expand/Collapse all */}
      <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.xs }}>
        <button
          onClick={props.onExpandAll}
          title="Expand all"
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            width: "28px",
            height: "28px",
            background: "transparent",
            border: "none",
            "border-radius": tokens.radius.sm,
            cursor: "pointer",
            color: tokens.colors.text.muted,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = tokens.colors.interactive.hover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Icon name="maximize" style={{ width: "14px", height: "14px" }} />
        </button>
        <button
          onClick={props.onCollapseAll}
          title="Collapse all"
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            width: "28px",
            height: "28px",
            background: "transparent",
            border: "none",
            "border-radius": tokens.radius.sm,
            cursor: "pointer",
            color: tokens.colors.text.muted,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = tokens.colors.interactive.hover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Icon name="minimize" style={{ width: "14px", height: "14px" }} />
        </button>
      </div>
    </div>
  );
}

/**
 * File Section Header
 */
function FileHeader(props: {
  file: FileDiff;
  expanded: boolean;
  loading: boolean;
  staged?: boolean;
  readOnly?: boolean;
  onToggle: () => void;
  onOpenFile?: () => void;
  onStageFile?: () => void | Promise<void>;
  onUnstageFile?: () => void | Promise<void>;
  onRevertFile?: () => void | Promise<void>;
  focused?: boolean;
}) {
  const [isHovered, setIsHovered] = createSignal(false);
  const [actionLoading, setActionLoading] = createSignal<string | null>(null);

  const handleAction = async (action: () => void | Promise<void>, name: string) => {
    if (!action) return;
    setActionLoading(name);
    try {
      await action();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        height: `${FILE_HEADER_HEIGHT}px`,
        padding: `0 ${tokens.spacing.lg}`,
        background: props.focused
          ? tokens.colors.interactive.selected
          : isHovered()
          ? tokens.colors.interactive.hover
          : "transparent",
        cursor: "pointer",
        "user-select": "none",
        "border-bottom": `1px solid ${tokens.colors.border.divider}`,
        transition: `background ${tokens.transitions.fast}`,
      }}
      onClick={props.onToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Expand/collapse icon */}
      <div style={{ "margin-right": tokens.spacing.sm, display: "flex" }}>
        {props.expanded ? (
          <Icon name="chevron-down" style={{ width: "14px", height: "14px", color: tokens.colors.text.muted }} />
        ) : (
          <Icon name="chevron-right" style={{ width: "14px", height: "14px", color: tokens.colors.text.muted }} />
        )}
      </div>

      {/* File icon */}
      <Icon name="file" style={{ width: "14px", height: "14px", "margin-right": tokens.spacing.md, color: tokens.colors.icon.default }} />

      {/* File name and path */}
      <div style={{ flex: 1, "min-width": 0, display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
        <span
          style={{
            "font-size": tokens.typography.fontSize.sm,
            "font-weight": tokens.typography.fontWeight.medium,
            color: tokens.colors.text.primary,
            overflow: "hidden",
            "text-overflow": "ellipsis",
            "white-space": "nowrap",
          }}
        >
          {getFileName(props.file.path)}
        </span>
        <Show when={getDirectory(props.file.path)}>
          <span
            style={{
              "font-size": tokens.typography.fontSize.xs,
              color: tokens.colors.text.muted,
              overflow: "hidden",
              "text-overflow": "ellipsis",
              "white-space": "nowrap",
            }}
          >
            {getDirectory(props.file.path)}
          </span>
        </Show>
        <Show when={props.file.oldPath}>
          <span style={{ "font-size": tokens.typography.fontSize.xs, color: tokens.colors.text.muted }}>
            ← {getFileName(props.file.oldPath!)}
          </span>
        </Show>
      </div>

      {/* Status badge */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          width: "18px",
          height: "18px",
          "border-radius": tokens.radius.sm,
          background: `color-mix(in srgb, ${getStatusColor(props.file.status)} 20%, transparent)`,
          "font-size": "10px",
          "font-weight": tokens.typography.fontWeight.semibold,
          color: getStatusColor(props.file.status),
          "margin-right": tokens.spacing.md,
        }}
      >
        {getStatusLetter(props.file.status)}
      </div>

      {/* Line counts */}
      <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md, "margin-right": tokens.spacing.lg }}>
        <Show when={props.file.additions > 0}>
          <span style={{ "font-size": tokens.typography.fontSize.xs, color: tokens.colors.semantic.success }}>
            +{props.file.additions}
          </span>
        </Show>
        <Show when={props.file.deletions > 0}>
          <span style={{ "font-size": tokens.typography.fontSize.xs, color: tokens.colors.semantic.error }}>
            -{props.file.deletions}
          </span>
        </Show>
      </div>

      {/* Actions */}
      <Show when={isHovered() && !props.readOnly}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: tokens.spacing.xs,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Open file */}
          <Show when={props.onOpenFile}>
            <button
              onClick={() => props.onOpenFile?.()}
              title="Open file"
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "24px",
                height: "24px",
                background: "transparent",
                border: "none",
                "border-radius": tokens.radius.sm,
                cursor: "pointer",
                color: tokens.colors.text.muted,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = tokens.colors.interactive.active)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="arrow-up-right-from-square" style={{ width: "14px", height: "14px" }} />
            </button>
          </Show>

          {/* Stage/Unstage */}
          <Show when={!props.staged && props.onStageFile}>
            <button
              onClick={() => handleAction(props.onStageFile!, "stage")}
              title="Stage file"
              disabled={actionLoading() === "stage"}
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "24px",
                height: "24px",
                background: `color-mix(in srgb, ${tokens.colors.semantic.success} 20%, transparent)`,
                border: "none",
                "border-radius": tokens.radius.sm,
                cursor: actionLoading() === "stage" ? "wait" : "pointer",
                color: tokens.colors.semantic.success,
              }}
            >
              {actionLoading() === "stage" ? (
                <Icon name="spinner" style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />
              ) : (
                <Icon name="plus" style={{ width: "14px", height: "14px" }} />
              )}
            </button>
          </Show>

          <Show when={props.staged && props.onUnstageFile}>
            <button
              onClick={() => handleAction(props.onUnstageFile!, "unstage")}
              title="Unstage file"
              disabled={actionLoading() === "unstage"}
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "24px",
                height: "24px",
                background: `color-mix(in srgb, ${tokens.colors.semantic.warning} 20%, transparent)`,
                border: "none",
                "border-radius": tokens.radius.sm,
                cursor: actionLoading() === "unstage" ? "wait" : "pointer",
                color: tokens.colors.semantic.warning,
              }}
            >
              {actionLoading() === "unstage" ? (
                <Icon name="spinner" style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />
              ) : (
                <Icon name="minus" style={{ width: "14px", height: "14px" }} />
              )}
            </button>
          </Show>

          {/* Revert */}
          <Show when={props.onRevertFile && props.file.status !== "added"}>
            <button
              onClick={() => handleAction(props.onRevertFile!, "revert")}
              title="Revert changes"
              disabled={actionLoading() === "revert"}
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "24px",
                height: "24px",
                background: `color-mix(in srgb, ${tokens.colors.semantic.error} 20%, transparent)`,
                border: "none",
                "border-radius": tokens.radius.sm,
                cursor: actionLoading() === "revert" ? "wait" : "pointer",
                color: tokens.colors.semantic.error,
              }}
            >
              {actionLoading() === "revert" ? (
                <Icon name="spinner" style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />
              ) : (
                <Icon name="rotate-left" style={{ width: "14px", height: "14px" }} />
              )}
            </button>
          </Show>
        </div>
      </Show>

      {/* Loading indicator when expanding */}
      <Show when={props.loading}>
        <Icon name="spinner"
          style={{
            width: "14px",
            height: "14px",
            color: tokens.colors.text.muted,
            animation: "spin 1s linear infinite",
          }}
        />
      </Show>
    </div>
  );
}

/** Diff editor reference for navigation */
export interface DiffEditorRef {
  goToNextChange: () => void;
  goToPreviousChange: () => void;
  getChangesCount: () => number;
}

/**
 * Inline Monaco Diff Editor for a single file
 */
function InlineDiffEditor(props: {
  file: FileDiff;
  height: number;
  onMount?: () => void;
  onEditorReady?: (ref: DiffEditorRef) => void;
}) {
  let containerRef: HTMLDivElement | undefined;
  let diffEditorInstance: Monaco.editor.IStandaloneDiffEditor | null = null;
  // Track current change index for navigation (since Monaco's DiffNavigator is deprecated)
  let currentChangeIndex = 0;
  const monacoManager = MonacoManager.getInstance();

  onMount(async () => {
    if (!containerRef) return;

    try {
      const monaco = await monacoManager.ensureLoaded();
      const language = props.file.language || detectLanguage(props.file.path);

      // Create the diff editor
      diffEditorInstance = monaco.editor.createDiffEditor(containerRef, {
        theme: "cortex-dark",
        automaticLayout: true,
        renderSideBySide: true,
        enableSplitViewResizing: true,
        renderIndicators: true,
        renderMarginRevertIcon: false,
        ignoreTrimWhitespace: false,
        readOnly: true,
        originalEditable: false,
        fontSize: 12,
        lineHeight: 18,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
        fontLigatures: true,
        scrollBeyondLastLine: false,
        minimap: { enabled: false },
        lineNumbers: "on",
        folding: false,
        glyphMargin: false,
        lineDecorationsWidth: 0,
        scrollbar: {
          vertical: "auto",
          horizontal: "auto",
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
          useShadows: false,
        },
      });

      // Create unique URIs for models
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const originalUri = monaco.Uri.parse(`diff://multi/original-${timestamp}-${random}/${props.file.oldPath || props.file.path}`);
      const modifiedUri = monaco.Uri.parse(`diff://multi/modified-${timestamp}-${random}/${props.file.path}`);

      // Clean up any existing models with same URIs
      const existingOriginal = monaco.editor.getModel(originalUri);
      const existingModified = monaco.editor.getModel(modifiedUri);
      if (existingOriginal) existingOriginal.dispose();
      if (existingModified) existingModified.dispose();

      // Create models
      const originalModel = monaco.editor.createModel(
        props.file.originalContent,
        language,
        originalUri
      );
      const modifiedModel = monaco.editor.createModel(
        props.file.modifiedContent,
        language,
        modifiedUri
      );

      // Set models on diff editor
      diffEditorInstance.setModel({
        original: originalModel,
        modified: modifiedModel,
      });

      // Helper function to navigate to a specific change
      const goToChange = (index: number) => {
        if (!diffEditorInstance) return;
        const changes = diffEditorInstance.getLineChanges();
        if (!changes || changes.length === 0) return;
        
        // Clamp index to valid range
        currentChangeIndex = Math.max(0, Math.min(index, changes.length - 1));
        const change = changes[currentChangeIndex];
        
        // Reveal the change in the modified editor
        const modifiedEditor = diffEditorInstance.getModifiedEditor();
        if (modifiedEditor && change) {
          modifiedEditor.revealLineInCenter(change.modifiedStartLineNumber);
          modifiedEditor.setPosition({ lineNumber: change.modifiedStartLineNumber, column: 1 });
        }
      };

      // Expose navigation methods
      props.onEditorReady?.({
        goToNextChange: () => {
          const changes = diffEditorInstance?.getLineChanges();
          if (changes && changes.length > 0) {
            currentChangeIndex = (currentChangeIndex + 1) % changes.length;
            goToChange(currentChangeIndex);
          }
        },
        goToPreviousChange: () => {
          const changes = diffEditorInstance?.getLineChanges();
          if (changes && changes.length > 0) {
            currentChangeIndex = (currentChangeIndex - 1 + changes.length) % changes.length;
            goToChange(currentChangeIndex);
          }
        },
        getChangesCount: () => {
          const changes = diffEditorInstance?.getLineChanges();
          return changes?.length ?? 0;
        },
      });

      props.onMount?.();
    } catch (err) {
      console.error("Failed to initialize inline diff editor:", err);
    }
  });

  onCleanup(() => {
    if (diffEditorInstance) {
      const model = diffEditorInstance.getModel();
      if (model) {
        model.original?.dispose?.();
        model.modified?.dispose?.();
      }
      diffEditorInstance.dispose();
      diffEditorInstance = null;
    }
  });

  return (
    <div
      ref={containerRef}
      style={{
        height: `${props.height}px`,
        width: "100%",
        "border-bottom": `1px solid ${tokens.colors.border.divider}`,
      }}
    />
  );
}

/**
 * Binary file placeholder
 */
function BinaryFilePlaceholder(props: { file: FileDiff }) {
  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        height: "80px",
        background: tokens.colors.surface.canvas,
        color: tokens.colors.text.muted,
        "font-size": tokens.typography.fontSize.sm,
        "border-bottom": `1px solid ${tokens.colors.border.divider}`,
      }}
    >
      Binary file {props.file.status === "added" ? "added" : props.file.status === "deleted" ? "deleted" : "changed"}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MultiDiffEditor(props: MultiDiffEditorProps) {
  // State
  const [searchQuery, setSearchQuery] = createSignal("");
  const [filterType, setFilterType] = createSignal("");
  const [focusedIndex, setFocusedIndex] = createSignal(0);
  const [fileSections, setFileSections] = createSignal<Map<string, FileSectionState>>(new Map());

  let containerRef: HTMLDivElement | undefined;
  let scrollContainerRef: HTMLDivElement | undefined;
  
  // Track diff editors for navigation
  const diffEditorRefs = new Map<string, DiffEditorRef>();

  // Initialize file sections
  createEffect(() => {
    const newSections = new Map<string, FileSectionState>();
    props.files.forEach((file) => {
      const existing = fileSections().get(file.path);
      newSections.set(file.path, existing || {
        expanded: props.defaultExpanded ?? true,
        loading: false,
        editorMounted: false,
      });
    });
    setFileSections(newSections);
  });

  // Filtered files
  const filteredFiles = createMemo(() => {
    let files = props.files;

    // Filter by extension
    if (filterType()) {
      files = files.filter((f) => getExtension(f.path) === filterType());
    }

    // Filter by search query
    if (searchQuery()) {
      const query = searchQuery().toLowerCase();
      files = files.filter((f) => {
        // Match path
        if (f.path.toLowerCase().includes(query)) return true;
        // Match content
        if (f.originalContent.toLowerCase().includes(query)) return true;
        if (f.modifiedContent.toLowerCase().includes(query)) return true;
        return false;
      });
    }

    return files;
  });

  // Available extension options for filter
  const extensionOptions = createMemo(() => {
    const extensions = new Set<string>();
    props.files.forEach((f) => {
      const ext = getExtension(f.path);
      if (ext) extensions.add(ext);
    });
    return Array.from(extensions).sort();
  });

  // Toggle file expansion
  const toggleFile = (path: string) => {
    setFileSections((sections) => {
      const newSections = new Map(sections);
      const current = newSections.get(path);
      if (current) {
        newSections.set(path, { ...current, expanded: !current.expanded });
      }
      return newSections;
    });
  };

  // Expand all files
  const expandAll = () => {
    setFileSections((sections) => {
      const newSections = new Map<string, FileSectionState>();
      sections.forEach((state, path) => {
        newSections.set(path, { ...state, expanded: true });
      });
      return newSections;
    });
  };

  // Collapse all files
  const collapseAll = () => {
    setFileSections((sections) => {
      const newSections = new Map<string, FileSectionState>();
      sections.forEach((state, path) => {
        newSections.set(path, { ...state, expanded: false });
      });
      return newSections;
    });
  };

  // Mark editor as mounted
  const markEditorMounted = (path: string) => {
    setFileSections((sections) => {
      const newSections = new Map(sections);
      const current = newSections.get(path);
      if (current) {
        newSections.set(path, { ...current, loading: false, editorMounted: true });
      }
      return newSections;
    });
  };

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    const files = filteredFiles();
    if (files.length === 0) return;

    // Navigate between files: Ctrl+Down/Up
    if (e.ctrlKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      const newIndex = Math.max(0, Math.min(files.length - 1, focusedIndex() + delta));
      setFocusedIndex(newIndex);

      // Scroll to focused file
      if (scrollContainerRef) {
        const fileElements = scrollContainerRef.querySelectorAll("[data-file-section]");
        const targetElement = fileElements[newIndex] as HTMLElement;
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
      return;
    }

    // Navigate between changes in file: F7 / Shift+F7
    if (e.key === "F7") {
      e.preventDefault();
      const focusedFile = files[focusedIndex()];
      if (focusedFile) {
        const editorRef = diffEditorRefs.get(focusedFile.path);
        if (editorRef) {
          if (e.shiftKey) {
            editorRef.goToPreviousChange();
          } else {
            editorRef.goToNextChange();
          }
        }
      }
      return;
    }

    // Toggle expand/collapse: Enter or Space
    if (e.key === "Enter" || e.key === " ") {
      const focusedFile = files[focusedIndex()];
      if (focusedFile) {
        e.preventDefault();
        toggleFile(focusedFile.path);
      }
      return;
    }
  };

  onMount(() => {
    containerRef?.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    containerRef?.removeEventListener("keydown", handleKeyDown);
  });

  const maxDiffHeight = () => props.maxDiffHeight ?? DEFAULT_MAX_DIFF_HEIGHT;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        background: tokens.colors.surface.panel,
        outline: "none",
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
          "flex-shrink": 0,
        }}
      >
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
          <span
            style={{
              "font-size": tokens.typography.fontSize.base,
              "font-weight": tokens.typography.fontWeight.semibold,
              color: tokens.colors.text.primary,
            }}
          >
            {props.title || "Multi-File Diff"}
          </span>
          <Show when={props.subtitle}>
            <span style={{ "font-size": tokens.typography.fontSize.sm, color: tokens.colors.text.muted }}>
              {props.subtitle}
            </span>
          </Show>
        </div>

        <Show when={props.onClose}>
          <button
            onClick={props.onClose}
            title="Close"
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "28px",
              height: "28px",
              background: "transparent",
              border: "none",
              "border-radius": tokens.radius.sm,
              cursor: "pointer",
              color: tokens.colors.text.muted,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = tokens.colors.interactive.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Icon name="xmark" style={{ width: "16px", height: "16px" }} />
          </button>
        </Show>
      </div>

      {/* Stats summary */}
      <StatsSummary files={props.files} filteredCount={filteredFiles().length} />

      {/* Search and filter bar */}
      <SearchFilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterType={filterType}
        setFilterType={setFilterType}
        extensionOptions={extensionOptions()}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
      />

      {/* File list with diffs */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          "overflow-y": "auto",
          "overflow-x": "hidden",
        }}
      >
        <Show
          when={filteredFiles().length > 0}
          fallback={
            <div
              style={{
                display: "flex",
                "flex-direction": "column",
                "align-items": "center",
                "justify-content": "center",
                height: "200px",
                color: tokens.colors.text.muted,
              }}
            >
              <Icon name="file" style={{ width: "32px", height: "32px", "margin-bottom": tokens.spacing.md }} />
              <span style={{ "font-size": tokens.typography.fontSize.sm }}>
                {searchQuery() || filterType() ? "No files match your criteria" : "No files to display"}
              </span>
            </div>
          }
        >
          <For each={filteredFiles()}>
            {(file, index) => {
              const sectionState = () => fileSections().get(file.path);
              const isExpanded = () => sectionState()?.expanded ?? false;
              const isLoading = () => sectionState()?.loading ?? false;
              const isFocused = () => focusedIndex() === index();

              const diffHeight = () =>
                calculateDiffHeight(file.originalContent, file.modifiedContent, maxDiffHeight());

              return (
                <div data-file-section>
                  <FileHeader
                    file={file}
                    expanded={isExpanded()}
                    loading={isLoading()}
                    staged={props.staged}
                    readOnly={props.readOnly}
                    focused={isFocused()}
                    onToggle={() => toggleFile(file.path)}
                    onOpenFile={props.onOpenFile ? () => props.onOpenFile!(file.path) : undefined}
                    onStageFile={props.onStageFile ? () => props.onStageFile!(file.path) : undefined}
                    onUnstageFile={props.onUnstageFile ? () => props.onUnstageFile!(file.path) : undefined}
                    onRevertFile={props.onRevertFile ? () => props.onRevertFile!(file.path) : undefined}
                  />

                  <Show when={isExpanded()}>
                    <Show
                      when={!file.binary}
                      fallback={<BinaryFilePlaceholder file={file} />}
                    >
                      <InlineDiffEditor
                        file={file}
                        height={diffHeight()}
                        onMount={() => markEditorMounted(file.path)}
                        onEditorReady={(ref) => diffEditorRefs.set(file.path, ref)}
                      />
                    </Show>
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default MultiDiffEditor;
