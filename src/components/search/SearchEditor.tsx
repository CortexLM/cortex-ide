/**
 * SearchEditor Component - SolidJS Version
 * 
 * Displays search results in a persistent editor tab with support for:
 * - Results grouped by file with collapse/expand
 * - Click to open file at line
 * - Highlight matches in results
 * - Re-run search and clear results
 * - Save/load as .code-search file
 */

import {
  createSignal,
  createMemo,
  createEffect,
  onMount,
  onCleanup,
  For,
  Show,
  JSX,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Icon } from "../ui/Icon";
import {
  SearchResult,
  SearchMatch,
  serializeToCodeSearch,
  parseCodeSearchFile,
  generateCodeSearchFilename,
  copyMatchText,
  copyFilePath,
  copyAllResults,
} from "@/utils/searchUtils";
import type { SearchQuery, SearchEditorState } from "@/types/search";

// ============================================================================
// Types
// ============================================================================

export interface SearchEditorProps {
  /** Unique identifier for this search editor instance */
  id: string;
  /** The search query configuration */
  query: SearchQuery;
  /** Search results to display */
  results: SearchResult[];
  /** Whether the editor has unsaved changes */
  isDirty?: boolean;
  /** Whether the search is currently running */
  isSearching?: boolean;
  /** File path if saved as .code-search */
  filePath?: string;
  /** Callback when user clicks to open a file at a specific line */
  onOpenFile?: (filePath: string, line: number, column?: number) => void;
  /** Callback to re-run the search */
  onRerunSearch?: (query: SearchQuery) => void;
  /** Callback to clear all results */
  onClearResults?: () => void;
  /** Callback to save as .code-search file */
  onSave?: (content: string, suggestedFilename: string) => void;
  /** Callback when dirty state changes */
  onDirtyChange?: (isDirty: boolean) => void;
  /** Callback to close the editor */
  onClose?: () => void;
  /** Project root path for relative paths */
  projectPath?: string;
  /** Custom class name */
  class?: string;
}

interface FileGroupState {
  [filePath: string]: boolean;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  height: "100%",
  background: "var(--jb-bg-panel)",
  color: "var(--jb-text-body-color)",
  "font-family": "var(--jb-font-ui)",
  "font-size": "13px",
};

const headerStyle: JSX.CSSProperties = {
  padding: "8px 12px",
  "border-bottom": "1px solid var(--jb-border-default)",
  background: "var(--jb-bg-sidebar)",
};

const headerTopStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  gap: "8px",
  "margin-bottom": "4px",
};

const queryInfoStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "6px",
  "flex": "1",
  "min-width": "0",
};

const queryPatternStyle: JSX.CSSProperties = {
  "font-family": "var(--jb-font-code)",
  "font-weight": "500",
  color: "var(--jb-text-primary)",
  overflow: "hidden",
  "text-overflow": "ellipsis",
  "white-space": "nowrap",
};

const queryFlagsStyle: JSX.CSSProperties = {
  color: "var(--jb-text-muted-color)",
  "font-size": "11px",
};

const actionsStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "4px",
};

const actionBtnStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  width: "24px",
  height: "24px",
  padding: "0",
  background: "transparent",
  border: "none",
  "border-radius": "var(--jb-radius-sm)",
  color: "var(--jb-icon-color-default)",
  cursor: "pointer",
  transition: "background 0.15s ease",
};

const headerDetailsStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "12px",
  "font-size": "12px",
  color: "var(--jb-text-muted-color)",
};

const resultsContainerStyle: JSX.CSSProperties = {
  flex: "1",
  overflow: "auto",
};

const fileGroupStyle: JSX.CSSProperties = {
  "border-bottom": "1px solid var(--jb-border-divider)",
};

const fileHeaderStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "6px",
  padding: "6px 12px",
  cursor: "pointer",
  "user-select": "none",
  transition: "background 0.15s ease",
};

const fileNameStyle: JSX.CSSProperties = {
  "font-weight": "500",
  color: "var(--jb-text-primary)",
  cursor: "pointer",
};

const fileDirStyle: JSX.CSSProperties = {
  color: "var(--jb-text-muted-color)",
  "font-size": "12px",
  overflow: "hidden",
  "text-overflow": "ellipsis",
  "white-space": "nowrap",
  flex: "1",
};

const matchCountStyle: JSX.CSSProperties = {
  "font-size": "11px",
  color: "var(--jb-text-muted-color)",
  background: "var(--jb-surface-raised)",
  padding: "1px 6px",
  "border-radius": "var(--cortex-radius-lg)",
};

const matchesContainerStyle: JSX.CSSProperties = {
  "padding-left": "24px",
};

const matchLineStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "8px",
  padding: "4px 12px",
  cursor: "pointer",
  transition: "background 0.15s ease",
};

const lineNumberStyle: JSX.CSSProperties = {
  "min-width": "40px",
  color: "var(--jb-text-muted-color)",
  "font-family": "var(--jb-font-code)",
  "font-size": "12px",
  "text-align": "right",
};

const matchTextStyle: JSX.CSSProperties = {
  flex: "1",
  "font-family": "var(--jb-font-code)",
  "font-size": "12px",
  overflow: "hidden",
  "text-overflow": "ellipsis",
  "white-space": "nowrap",
};

const highlightStyle: JSX.CSSProperties = {
  background: "var(--jb-accent-bg)",
  color: "var(--jb-accent-text)",
  "border-radius": "var(--cortex-radius-sm)",
  padding: "0 2px",
};

const emptyStateStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  "align-items": "center",
  "justify-content": "center",
  height: "100%",
  gap: "16px",
  color: "var(--jb-text-muted-color)",
};

const loadingOverlayStyle: JSX.CSSProperties = {
  position: "absolute",
  inset: "0",
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  gap: "8px",
  background: "rgba(0, 0, 0, 0.5)",
  color: "var(--jb-text-primary)",
};

// ============================================================================
// Sub-components
// ============================================================================

interface SearchEditorHeaderProps {
  query: SearchQuery;
  totalFiles: number;
  totalMatches: number;
  isDirty: boolean;
  isSearching: boolean;
  onRerunSearch: () => void;
  onClearResults: () => void;
  onSave: () => void;
  onCopyAll: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

function SearchEditorHeader(props: SearchEditorHeaderProps) {
  const flagsDisplay = createMemo(() => {
    const flags: string[] = [];
    if (props.query.isRegex) flags.push("Regex");
    if (props.query.isCaseSensitive) flags.push("Case");
    if (props.query.isWholeWord) flags.push("Word");
    return flags.join(", ");
  });

  const [hoveredBtn, setHoveredBtn] = createSignal<string | null>(null);

  const btnStyle = (id: string): JSX.CSSProperties => ({
    ...actionBtnStyle,
    background: hoveredBtn() === id ? "var(--jb-surface-hover)" : "transparent",
  });

  return (
    <div style={headerStyle}>
      <div style={headerTopStyle}>
        <div style={queryInfoStyle}>
          <span style={{ color: "var(--jb-text-muted-color)" }}>Search:</span>
          <span style={queryPatternStyle} title={props.query.pattern}>
            "{props.query.pattern}"
          </span>
          <Show when={flagsDisplay()}>
            <span style={queryFlagsStyle}>({flagsDisplay()})</span>
          </Show>
          <Show when={props.isDirty}>
            <span style={{ color: "var(--jb-accent-primary)" }}>*</span>
          </Show>
        </div>
        <div style={actionsStyle}>
          <button
            style={btnStyle("refresh")}
            onClick={props.onRerunSearch}
            disabled={props.isSearching}
            title="Re-run search (Ctrl+Shift+R)"
            onMouseEnter={() => setHoveredBtn("refresh")}
            onMouseLeave={() => setHoveredBtn(null)}
          >
            <Icon name="rotate" size={14} />
          </button>
          <button
            style={btnStyle("save")}
            onClick={props.onSave}
            title="Save search results (Ctrl+S)"
            onMouseEnter={() => setHoveredBtn("save")}
            onMouseLeave={() => setHoveredBtn(null)}
          >
            <Icon name="floppy-disk" size={14} />
          </button>
          <button
            style={btnStyle("copy")}
            onClick={props.onCopyAll}
            title="Copy all results"
            onMouseEnter={() => setHoveredBtn("copy")}
            onMouseLeave={() => setHoveredBtn(null)}
          >
            <Icon name="copy" size={14} />
          </button>
          <button
            style={btnStyle("expand")}
            onClick={props.onExpandAll}
            title="Expand all"
            onMouseEnter={() => setHoveredBtn("expand")}
            onMouseLeave={() => setHoveredBtn(null)}
          >
            <Icon name="maximize" size={14} />
          </button>
          <button
            style={btnStyle("collapse")}
            onClick={props.onCollapseAll}
            title="Collapse all"
            onMouseEnter={() => setHoveredBtn("collapse")}
            onMouseLeave={() => setHoveredBtn(null)}
          >
            <Icon name="minimize" size={14} />
          </button>
          <button
            style={{
              ...btnStyle("clear"),
              color: hoveredBtn() === "clear" ? "var(--jb-status-error)" : "var(--jb-icon-color-default)",
            }}
            onClick={props.onClearResults}
            title="Clear results"
            onMouseEnter={() => setHoveredBtn("clear")}
            onMouseLeave={() => setHoveredBtn(null)}
          >
            <Icon name="xmark" size={14} />
          </button>
        </div>
      </div>
      <div style={headerDetailsStyle}>
        <span>
          <Show
            when={!props.isSearching}
            fallback={<>Searching...</>}
          >
            {props.totalMatches} result{props.totalMatches !== 1 ? "s" : ""} in{" "}
            {props.totalFiles} file{props.totalFiles !== 1 ? "s" : ""}
          </Show>
        </span>
        <Show when={props.query.includePattern}>
          <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
            <Icon name="filter" size={12} />
            {props.query.includePattern}
          </span>
        </Show>
        <Show when={props.query.excludePattern}>
          <span style={{ display: "flex", "align-items": "center", gap: "4px", color: "var(--jb-status-warning)" }}>
            <Icon name="filter" size={12} />
            {props.query.excludePattern}
          </span>
        </Show>
      </div>
    </div>
  );
}

interface FileGroupHeaderProps {
  filePath: string;
  matchCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenFile: () => void;
  onCopyPath: () => void;
  projectPath?: string;
}

function FileGroupHeader(props: FileGroupHeaderProps) {
  const [hovered, setHovered] = createSignal(false);

  const displayPath = createMemo(() => {
    if (props.projectPath && props.filePath.startsWith(props.projectPath)) {
      return props.filePath.slice(props.projectPath.length).replace(/^[\/\\]/, "");
    }
    return props.filePath;
  });

  const fileName = createMemo(() => {
    const lastSlash = Math.max(props.filePath.lastIndexOf("/"), props.filePath.lastIndexOf("\\"));
    return lastSlash >= 0 ? props.filePath.slice(lastSlash + 1) : props.filePath;
  });

  const dirPath = createMemo(() => {
    const dp = displayPath();
    const lastSlash = Math.max(dp.lastIndexOf("/"), dp.lastIndexOf("\\"));
    return lastSlash >= 0 ? dp.slice(0, lastSlash) : "";
  });

  return (
    <div
      style={{
        ...fileHeaderStyle,
        background: hovered() ? "var(--jb-surface-hover)" : "transparent",
      }}
      onClick={props.onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Show when={props.isExpanded} fallback={<Icon name="chevron-right" size={14} />}>
        <Icon name="chevron-down" size={14} />
      </Show>
      <Icon name="file" size={14} style={{ color: "var(--jb-icon-color-default)" }} />
      <span
        style={fileNameStyle}
        onClick={(e) => {
          e.stopPropagation();
          props.onOpenFile();
        }}
      >
        {fileName()}
      </span>
      <Show when={dirPath()}>
        <span style={fileDirStyle}>{dirPath()}</span>
      </Show>
      <span style={matchCountStyle}>{props.matchCount}</span>
      <button
        style={{
          ...actionBtnStyle,
          opacity: hovered() ? "1" : "0",
        }}
        onClick={(e) => {
          e.stopPropagation();
          props.onCopyPath();
        }}
        title="Copy path"
      >
        <Icon name="copy" size={12} />
      </button>
    </div>
  );
}

interface MatchLineProps {
  match: SearchMatch;
  searchPattern: string;
  isRegex: boolean;
  isCaseSensitive: boolean;
  onClick: () => void;
}

function MatchLine(props: MatchLineProps) {
  const [hovered, setHovered] = createSignal(false);

  const highlightedText = createMemo(() => {
    const text = props.match.text;

    // If we have explicit match positions, use them
    if (
      props.match.matchStart !== undefined &&
      props.match.matchEnd !== undefined &&
      props.match.matchStart !== props.match.matchEnd
    ) {
      const before = text.slice(0, props.match.matchStart);
      const highlighted = text.slice(props.match.matchStart, props.match.matchEnd);
      const after = text.slice(props.match.matchEnd);

      return { before, highlighted, after };
    }

    // Otherwise, try to find and highlight the pattern
    try {
      let regex: RegExp;
      if (props.isRegex) {
        regex = new RegExp(`(${props.searchPattern})`, props.isCaseSensitive ? "g" : "gi");
      } else {
        const escaped = props.searchPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        regex = new RegExp(`(${escaped})`, props.isCaseSensitive ? "g" : "gi");
      }

      const match = regex.exec(text);
      if (match) {
        return {
          before: text.slice(0, match.index),
          highlighted: match[0],
          after: text.slice(match.index + match[0].length),
        };
      }
    } catch {
      // If regex is invalid, just return the text
    }

    return { before: text, highlighted: "", after: "" };
  });

  const handleCopyMatch = (e: MouseEvent) => {
    e.stopPropagation();
    copyMatchText(props.match);
  };

  return (
    <div
      style={{
        ...matchLineStyle,
        background: hovered() ? "var(--jb-surface-hover)" : "transparent",
      }}
      onClick={props.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={lineNumberStyle}>{props.match.line}</span>
      <span style={matchTextStyle}>
        {highlightedText().before}
        <Show when={highlightedText().highlighted}>
          <span style={highlightStyle}>{highlightedText().highlighted}</span>
        </Show>
        {highlightedText().after}
      </span>
      <button
        style={{
          ...actionBtnStyle,
          opacity: hovered() ? "1" : "0",
          width: "20px",
          height: "20px",
        }}
        onClick={handleCopyMatch}
        title="Copy match"
      >
        <Icon name="copy" size={12} />
      </button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SearchEditor(props: SearchEditorProps) {
  // State for expanded/collapsed file groups
  const [expandedFiles, setExpandedFiles] = createStore<FileGroupState>({});

  // Initialize expanded state based on results
  createEffect(() => {
    const initial: FileGroupState = {};
    for (const result of props.results) {
      // Default: expand files with <= 10 matches, collapse others
      // Preserve existing state if it exists
      initial[result.file] =
        expandedFiles[result.file] ?? result.matches.length <= 10;
    }
    setExpandedFiles(initial);
  });

  // Calculate totals
  const totals = createMemo(() => {
    let matches = 0;
    for (const result of props.results) {
      matches += result.matches.length;
    }
    return { totalFiles: props.results.length, totalMatches: matches };
  });

  // Handlers
  const handleToggleFile = (filePath: string) => {
    setExpandedFiles(
      produce((state) => {
        state[filePath] = !state[filePath];
      })
    );
  };

  const handleExpandAll = () => {
    const newState: FileGroupState = {};
    for (const result of props.results) {
      newState[result.file] = true;
    }
    setExpandedFiles(newState);
  };

  const handleCollapseAll = () => {
    const newState: FileGroupState = {};
    for (const result of props.results) {
      newState[result.file] = false;
    }
    setExpandedFiles(newState);
  };

  const handleOpenFileAtLine = (file: string, line: number, column?: number) => {
    props.onOpenFile?.(file, line, column);
  };

  const handleRerunSearch = () => {
    props.onRerunSearch?.(props.query);
  };

  const handleSave = () => {
    const content = serializeToCodeSearch({
      query: props.query.pattern,
      isRegex: props.query.isRegex,
      isCaseSensitive: props.query.isCaseSensitive,
      isWholeWord: props.query.isWholeWord,
      includePattern: props.query.includePattern || "",
      excludePattern: props.query.excludePattern || "",
      contextLines: 0,
      results: props.results,
    });
    const suggestedFilename = generateCodeSearchFilename(props.query.pattern);
    props.onSave?.(content, suggestedFilename);
  };

  const handleCopyAll = async () => {
    await copyAllResults(props.results, {
      includeLineNumbers: true,
      includeFilePaths: true,
      format: "plain",
    });
  };

  const handleCopyPath = async (path: string) => {
    await copyFilePath(path);
  };

  const handleClearResults = () => {
    props.onClearResults?.();
  };

  // Keyboard shortcuts
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S to save
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      // Ctrl+Shift+R to re-run search
      if (e.ctrlKey && e.shiftKey && e.key === "R") {
        e.preventDefault();
        handleRerunSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  // Render empty state
  return (
    <div style={containerStyle} class={props.class}>
      <SearchEditorHeader
        query={props.query}
        totalFiles={totals().totalFiles}
        totalMatches={totals().totalMatches}
        isDirty={props.isDirty || false}
        isSearching={props.isSearching || false}
        onRerunSearch={handleRerunSearch}
        onClearResults={handleClearResults}
        onSave={handleSave}
        onCopyAll={handleCopyAll}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
      />

      <Show
        when={props.results.length > 0 || props.isSearching}
        fallback={
          <div style={emptyStateStyle}>
            <Icon name="magnifying-glass" size={48} />
            <p>No results found</p>
            <button
              style={{
                padding: "8px 16px",
                background: "var(--jb-btn-primary-bg)",
                color: "var(--jb-btn-primary-color)",
                border: "none",
                "border-radius": "var(--jb-radius-sm)",
                cursor: "pointer",
              }}
              onClick={handleRerunSearch}
            >
              Run Search Again
            </button>
          </div>
        }
      >
        <div style={resultsContainerStyle}>
          <For each={props.results}>
            {(result) => (
              <div style={fileGroupStyle}>
                <FileGroupHeader
                  filePath={result.file}
                  matchCount={result.matches.length}
                  isExpanded={expandedFiles[result.file] ?? true}
                  onToggle={() => handleToggleFile(result.file)}
                  onOpenFile={() => handleOpenFileAtLine(result.file, 1)}
                  onCopyPath={() => handleCopyPath(result.file)}
                  projectPath={props.projectPath}
                />

                <Show when={expandedFiles[result.file]}>
                  <div style={matchesContainerStyle}>
                    <For each={result.matches}>
                      {(match) => (
                        <MatchLine
                          match={match}
                          searchPattern={props.query.pattern}
                          isRegex={props.query.isRegex}
                          isCaseSensitive={props.query.isCaseSensitive}
                          onClick={() =>
                            handleOpenFileAtLine(result.file, match.line, match.column)
                          }
                        />
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>

        <Show when={props.isSearching}>
          <div style={loadingOverlayStyle}>
            <Icon name="rotate" size={20} class="animate-spin" />
            <span>Searching...</span>
          </div>
        </Show>
      </Show>
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Load search editor state from a .code-search file
 */
export function loadSearchEditorFromFile(
  content: string,
  fileId: string
): SearchEditorState {
  const parsed = parseCodeSearchFile(content);

  return {
    id: fileId,
    query: {
      pattern: parsed.query,
      isRegex: parsed.isRegex,
      isCaseSensitive: parsed.isCaseSensitive,
      isWholeWord: parsed.isWholeWord,
      includePattern: parsed.includePattern,
      excludePattern: parsed.excludePattern,
    },
    results: parsed.results.map((r) => ({
      uri: r.file,
      matches: r.matches.map((m) => ({
        range: {
          startLine: m.line - 1,
          startColumn: m.column - 1,
          endLine: m.line - 1,
          endColumn: m.column + (m.matchEnd - m.matchStart) - 1,
        },
        preview: {
          text: m.text,
          matches: [{ start: m.matchStart, end: m.matchEnd }],
        },
        lineNumber: m.line,
      })),
      lineCount: 0,
    })),
    isDirty: false,
    isPersisted: true,
  };
}

/**
 * Create a new search editor state
 */
export function createSearchEditorState(
  id: string,
  query: SearchQuery,
  results: SearchResult[] = []
): Omit<SearchEditorState, "results"> & { results: SearchResult[] } {
  return {
    id,
    query,
    results,
    isDirty: false,
    isPersisted: false,
  };
}

export default SearchEditor;

