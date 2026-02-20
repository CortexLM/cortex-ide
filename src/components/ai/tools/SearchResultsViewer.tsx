import { Show, For, createSignal, createMemo } from "solid-js";
import { Icon } from "../../ui/Icon";
import { ToolCard, type ToolStatus } from "./ToolCard";

// ============================================================================
// Types
// ============================================================================

export interface SearchMatch {
  /** Line number (1-indexed) */
  lineNumber: number;
  /** The matching line content */
  content: string;
  /** Start index of match in content */
  matchStart?: number;
  /** End index of match in content */
  matchEnd?: number;
}

export interface FileSearchResult {
  /** File path */
  filePath: string;
  /** Matches within this file */
  matches: SearchMatch[];
}

export interface SearchResultsViewerProps {
  /** The search query */
  query: string;
  /** Search results grouped by file */
  results: FileSearchResult[];
  /** Current status */
  status?: ToolStatus;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Search options used (for display) */
  searchOptions?: {
    regex?: boolean;
    caseSensitive?: boolean;
    wholeWord?: boolean;
    includeGlob?: string;
    excludeGlob?: string;
  };
  /** Maximum matches to show per file before collapsing */
  maxMatchesPerFile?: number;
  /** Called when clicking a match */
  onMatchClick?: (filePath: string, lineNumber: number) => void;
  /** Called when clicking a file */
  onFileClick?: (filePath: string) => void;
}

// ============================================================================
// Utilities
// ============================================================================

function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath;
}

function getDirectory(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  parts.pop();
  return parts.join("/") || ".";
}

function highlightMatch(
  content: string,
  query: string,
  matchStart?: number,
  matchEnd?: number
): { before: string; match: string; after: string } {
  // If explicit match positions are provided
  if (matchStart !== undefined && matchEnd !== undefined) {
    return {
      before: content.slice(0, matchStart),
      match: content.slice(matchStart, matchEnd),
      after: content.slice(matchEnd),
    };
  }

  // Try to find the query in the content (case-insensitive)
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);

  if (index === -1) {
    return { before: content, match: "", after: "" };
  }

  return {
    before: content.slice(0, index),
    match: content.slice(index, index + query.length),
    after: content.slice(index + query.length),
  };
}

function truncateLine(content: string, maxLength: number = 200): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + "...";
}

// ============================================================================
// Component
// ============================================================================

export function SearchResultsViewer(props: SearchResultsViewerProps) {
  const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(new Set());
  const [showAllMatches, setShowAllMatches] = createSignal<Set<string>>(new Set());

  const totalMatches = createMemo(() => {
    return props.results.reduce((sum, file) => sum + file.matches.length, 0);
  });

  const maxMatches = () => props.maxMatchesPerFile || 5;

  const toggleFile = (filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const toggleShowAll = (filePath: string) => {
    setShowAllMatches((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const isFileExpanded = (filePath: string) => {
    // Default to expanded if not explicitly collapsed
    return !expandedFiles().has(filePath);
  };

  const getDisplayMatches = (result: FileSearchResult) => {
    if (showAllMatches().has(result.filePath)) {
      return result.matches;
    }
    return result.matches.slice(0, maxMatches());
  };

  const hasHiddenMatches = (result: FileSearchResult) => {
    return result.matches.length > maxMatches() && !showAllMatches().has(result.filePath);
  };

  return (
    <ToolCard
      name="Search"
      icon={<Icon name="magnifying-glass" class="w-4 h-4" />}
      status={props.status || "completed"}
      durationMs={props.durationMs}
      defaultExpanded={true}
    >
      <div class="search-results-viewer">
        {/* Search Query Header */}
        <div
          class="search-header"
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            padding: "10px 14px",
            background: "rgba(0, 0, 0, 0.2)",
            "border-bottom": "1px solid var(--vscode-chat-requestBorder)",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", "align-items": "center", gap: "8px", flex: "1", "min-width": "0" }}>
            <Icon name="magnifying-glass" class="w-4 h-4" style={{ color: "var(--vscode-descriptionForeground)", "flex-shrink": "0" }} />
            <code
              style={{
                "font-family": "var(--monaco-monospace-font, monospace)",
                "font-size": "var(--vscode-chat-font-size-body-s)",
                color: "var(--vscode-chat-slashCommandForeground)",
                background: "var(--vscode-chat-slashCommandBackground)",
                padding: "2px 8px",
                "border-radius": "var(--cortex-radius-sm)",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
              }}
              title={props.query}
            >
              {props.query}
            </code>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", "align-items": "center", gap: "8px", "flex-shrink": "0" }}>
            <span
              style={{
                display: "flex",
                "align-items": "center",
                gap: "4px",
                padding: "2px 8px",
                "border-radius": "var(--cortex-radius-sm)",
                background: "var(--vscode-editor-background)",
                color: "var(--vscode-descriptionForeground)",
                "font-size": "var(--vscode-chat-font-size-body-xs)",
              }}
            >
              <Icon name="hashtag" class="w-3 h-3" />
              {totalMatches()} {totalMatches() === 1 ? "match" : "matches"}
            </span>
            <span
              style={{
                display: "flex",
                "align-items": "center",
                gap: "4px",
                padding: "2px 8px",
                "border-radius": "var(--cortex-radius-sm)",
                background: "var(--vscode-editor-background)",
                color: "var(--vscode-descriptionForeground)",
                "font-size": "var(--vscode-chat-font-size-body-xs)",
              }}
            >
              <Icon name="file" class="w-3 h-3" />
              {props.results.length} {props.results.length === 1 ? "file" : "files"}
            </span>
          </div>
        </div>

        {/* Search Options */}
        <Show when={props.searchOptions}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "8px",
              padding: "6px 14px",
              "border-bottom": "1px solid var(--vscode-chat-requestBorder)",
              background: "rgba(0, 0, 0, 0.1)",
              "flex-wrap": "wrap",
            }}
          >
            <Icon name="filter" class="w-3 h-3" style={{ color: "var(--vscode-descriptionForeground)" }} />
            <Show when={props.searchOptions?.regex}>
              <span class="search-option-badge" style={optionBadgeStyle()}>
                Regex
              </span>
            </Show>
            <Show when={props.searchOptions?.caseSensitive}>
              <span class="search-option-badge" style={optionBadgeStyle()}>
                Case Sensitive
              </span>
            </Show>
            <Show when={props.searchOptions?.wholeWord}>
              <span class="search-option-badge" style={optionBadgeStyle()}>
                Whole Word
              </span>
            </Show>
            <Show when={props.searchOptions?.includeGlob}>
              <span class="search-option-badge" style={optionBadgeStyle()}>
                Include: {props.searchOptions!.includeGlob}
              </span>
            </Show>
            <Show when={props.searchOptions?.excludeGlob}>
              <span class="search-option-badge" style={optionBadgeStyle()}>
                Exclude: {props.searchOptions!.excludeGlob}
              </span>
            </Show>
          </div>
        </Show>

        {/* Results List */}
        <div
          class="search-results-list"
          style={{
            "max-height": "500px",
            "overflow-y": "auto",
          }}
        >
          <Show
            when={props.results.length > 0}
            fallback={
              <div
                style={{
                  padding: "20px",
                  "text-align": "center",
                  color: "var(--vscode-descriptionForeground)",
                  "font-size": "var(--vscode-chat-font-size-body-s)",
                }}
              >
                No results found
              </div>
            }
          >
            <For each={props.results}>
              {(result) => (
                <div class="search-file-result">
                  {/* File Header */}
                  <button
                    type="button"
                    onClick={() => toggleFile(result.filePath)}
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "8px",
                      width: "100%",
                      padding: "8px 14px",
                      background: "transparent",
                      border: "none",
                      "border-bottom": "1px solid var(--vscode-chat-requestBorder)",
                      color: "var(--vscode-foreground)",
                      cursor: "pointer",
                      "text-align": "left",
                      "font-size": "var(--vscode-chat-font-size-body-s)",
                    }}
                  >
                    <span style={{ color: "var(--vscode-descriptionForeground)" }}>
<Show when={isFileExpanded(result.filePath)} fallback={<Icon name="chevron-right" class="w-4 h-4" />}>
                        <Icon name="chevron-down" class="w-4 h-4" />
                      </Show>
                    </span>
                    <Icon name="file" class="w-4 h-4" style={{ color: "var(--vscode-descriptionForeground)", "flex-shrink": "0" }} />
                    <span
                      style={{
                        "font-family": "var(--monaco-monospace-font, monospace)",
                        "font-weight": "500",
                        "flex-shrink": "0",
                      }}
                    >
                      {getFileName(result.filePath)}
                    </span>
                    <span
                      style={{
                        color: "var(--vscode-descriptionForeground)",
                        "font-size": "var(--vscode-chat-font-size-body-xs)",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                        flex: "1",
                      }}
                    >
                      {getDirectory(result.filePath)}
                    </span>
                    <span
                      style={{
                        padding: "2px 6px",
                        "border-radius": "var(--cortex-radius-sm)",
                        background: "var(--vscode-chat-slashCommandBackground)",
                        color: "var(--vscode-chat-slashCommandForeground)",
                        "font-size": "10px",
                        "flex-shrink": "0",
                      }}
                    >
                      {result.matches.length}
                    </span>
                    <Show when={props.onFileClick}>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onFileClick!(result.filePath);
                        }}
                        style={{
                          padding: "2px 4px",
                          "border-radius": "var(--cortex-radius-sm)",
                          color: "var(--vscode-descriptionForeground)",
                          cursor: "pointer",
                        }}
                        title="Open file"
                      >
                        <Icon name="arrow-up-right-from-square" class="w-3.5 h-3.5" />
                      </span>
                    </Show>
                  </button>

                  {/* Matches */}
                  <Show when={isFileExpanded(result.filePath)}>
                    <div class="search-matches">
                      <For each={getDisplayMatches(result)}>
                        {(match) => {
                          const highlighted = highlightMatch(match.content, props.query, match.matchStart, match.matchEnd);
                          return (
                            <div
                              class="search-match"
                              onClick={() => props.onMatchClick?.(result.filePath, match.lineNumber)}
                              style={{
                                display: "flex",
                                "align-items": "flex-start",
                                gap: "8px",
                                padding: "6px 14px 6px 32px",
                                cursor: props.onMatchClick ? "pointer" : "default",
                                "font-family": "var(--monaco-monospace-font, monospace)",
                                "font-size": "var(--vscode-chat-font-size-body-xs)",
                                "border-bottom": "1px solid rgba(255, 255, 255, 0.03)",
                                background: "transparent",
                                transition: "background 0.15s ease",
                              }}
                            >
                              <span
                                style={{
                                  "min-width": "40px",
                                  "text-align": "right",
                                  color: "var(--vscode-descriptionForeground)",
                                  "flex-shrink": "0",
                                }}
                              >
                                {match.lineNumber}
                              </span>
                              <span
                                style={{
                                  flex: "1",
                                  "white-space": "pre-wrap",
                                  "word-break": "break-all",
                                  color: "var(--vscode-foreground)",
                                  overflow: "hidden",
                                }}
                              >
                                <span style={{ opacity: "0.7" }}>{truncateLine(highlighted.before, 80)}</span>
                                <span
                                  style={{
                                    background: "var(--vscode-editor-findMatchHighlightBackground, rgba(234, 179, 8, 0.3))",
                                    color: "var(--vscode-foreground)",
                                    "border-radius": "var(--cortex-radius-sm)",
                                    padding: "0 2px",
                                  }}
                                >
                                  {highlighted.match}
                                </span>
                                <span style={{ opacity: "0.7" }}>{truncateLine(highlighted.after, 80)}</span>
                              </span>
                            </div>
                          );
                        }}
                      </For>

                      {/* Show More */}
                      <Show when={hasHiddenMatches(result)}>
                        <button
                          type="button"
                          onClick={() => toggleShowAll(result.filePath)}
                          style={{
                            display: "flex",
                            "align-items": "center",
                            "justify-content": "center",
                            gap: "4px",
                            width: "100%",
                            padding: "8px",
                            background: "rgba(0, 0, 0, 0.2)",
                            border: "none",
                            color: "var(--vscode-descriptionForeground)",
                            cursor: "pointer",
                            "font-size": "var(--vscode-chat-font-size-body-xs)",
                          }}
                        >
<Icon name="chevron-down" class="w-3 h-3" />
                          Show {result.matches.length - maxMatches()} more matches
                        </button>
                      </Show>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </Show>
        </div>

        <style>{`
          .search-match:hover {
            background: var(--vscode-list-hoverBackground);
          }
          .search-file-result button:hover {
            background: var(--vscode-list-hoverBackground);
          }
          .search-results-list::-webkit-scrollbar {
            width: 8px;
          }
          .search-results-list::-webkit-scrollbar-track {
            background: transparent;
          }
          .search-results-list::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: var(--cortex-radius-sm);
          }
        `}</style>
      </div>
    </ToolCard>
  );
}

function optionBadgeStyle() {
  return {
    padding: "2px 6px",
    "border-radius": "var(--cortex-radius-sm)",
    background: "var(--vscode-editor-background)",
    color: "var(--vscode-descriptionForeground)",
    "font-size": "10px",
    "font-family": "var(--monaco-monospace-font, monospace)",
  };
}

export default SearchResultsViewer;

