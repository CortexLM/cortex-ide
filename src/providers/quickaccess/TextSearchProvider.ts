/**
 * =============================================================================
 * TEXT SEARCH PROVIDER - Quick Access Provider for '%' prefix
 * =============================================================================
 * 
 * Triggered by '%' prefix - searches text content across all files in the workspace.
 * 
 * Features:
 * - Debounced search with configurable delay
 * - Minimum query length requirement (default 2 chars)
 * - Results grouped by file
 * - Preview of matches with line context
 * - Navigate to file location on accept
 * - Support for search options (regex, case sensitive, whole word)
 * - Integration with SearchContext
 * 
 * @example
 * ```typescript
 * const provider = createTextSearchProvider({
 *   searchContent: fsSearchContent,
 *   getProjectPath: () => getProjectPath(),
 *   openFileAtLocation: (uri, line, column) => openFile(uri, line, column),
 * });
 * ```
 */

import type { JSX } from "solid-js";
import { Icon } from "../../components/ui/Icon";
import type { QuickAccessItem, QuickAccessProvider, QuickAccessItemButton } from "./types";

// =============================================================================
// Types
// =============================================================================

/**
 * Individual match within a file
 */
export interface SearchMatchResult {
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

/**
 * Search result entry grouped by file
 */
export interface SearchResultEntry {
  file: string;
  matches: SearchMatchResult[];
}

/**
 * Response from content search API
 */
export interface ContentSearchResponse {
  results: SearchResultEntry[];
  totalMatches: number;
  filesSearched: number;
}

/**
 * Search content options for Tauri API
 */
export interface SearchContentOptions {
  path: string;
  pattern: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  maxResults?: number;
  includeHidden?: boolean;
  filePattern?: string;
}

/**
 * Options for configuring the text search provider
 */
export interface TextSearchProviderOptions {
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Maximum number of results to return (default: 100) */
  maxResults?: number;
  /** Minimum query length before searching (default: 2) */
  minQueryLength?: number;
  /** Maximum number of files to show in grouped results (default: 20) */
  maxFilesShown?: number;
  /** Maximum matches per file to show (default: 5) */
  maxMatchesPerFile?: number;
}

/**
 * Data associated with each text search item
 */
export interface TextSearchItemData {
  /** Type of item */
  type: "file" | "match" | "option" | "more";
  /** File path (relative to project) */
  filePath?: string;
  /** Full file path */
  fullPath?: string;
  /** Line number of match */
  line?: number;
  /** Column number of match */
  column?: number;
  /** Match content preview */
  preview?: string;
  /** Total matches in file (for file items) */
  matchCount?: number;
  /** Option key (for option items) */
  optionKey?: "caseSensitive" | "regex" | "wholeWord";
  /** All matches for file (for file items) */
  matches?: SearchMatchResult[];
}

/**
 * Dependencies required by the provider
 */
export interface TextSearchProviderDependencies {
  /** Function to search file contents */
  searchContent: (options: SearchContentOptions) => Promise<ContentSearchResponse>;
  /** Function to get the current project path */
  getProjectPath: () => string;
  /** Function to open a file at a specific location */
  openFileAtLocation: (uri: string, line: number, column: number) => void;
  /** Optional: Function to open the full search panel */
  openSearchPanel?: (query: string, options?: SearchOptions) => void;
  /** Function to hide the quick access panel */
  hide: () => void;
}

/**
 * Search options state
 */
export interface SearchOptions {
  caseSensitive: boolean;
  regex: boolean;
  wholeWord: boolean;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get relative path from full path
 */
function getRelativePath(fullPath: string, projectPath: string): string {
  if (!projectPath) return fullPath;
  
  // Normalize separators
  const normalizedFull = fullPath.replace(/\\/g, "/");
  const normalizedProject = projectPath.replace(/\\/g, "/");
  
  if (normalizedFull.toLowerCase().startsWith(normalizedProject.toLowerCase())) {
    let relative = normalizedFull.slice(normalizedProject.length);
    if (relative.startsWith("/")) {
      relative = relative.slice(1);
    }
    return relative;
  }
  
  return fullPath;
}

/**
 * Get file name from path
 */
function getFileName(path: string): string {
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
}

/**
 * Get directory from path
 */
function getDirectory(path: string): string {
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return lastSlash > 0 ? path.slice(0, lastSlash) : "";
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Highlight match in text (returns text with markers for highlighting)
 */
function highlightMatch(text: string, query: string, caseSensitive: boolean): string {
  if (!query) return text;
  
  const flags = caseSensitive ? "g" : "gi";
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  
  try {
    return text.replace(new RegExp(escaped, flags), "\u00AB$&\u00BB");
  } catch {
    return text;
  }
}

// =============================================================================
// Provider Implementation
// =============================================================================

/**
 * Create a text search provider for the Quick Access system
 */
export function createTextSearchProvider(
  dependencies: TextSearchProviderDependencies,
  options: TextSearchProviderOptions = {}
): QuickAccessProvider<TextSearchItemData> {
  const {
    debounceMs = 300,
    maxResults = 100,
    minQueryLength = 2,
    maxFilesShown = 20,
    maxMatchesPerFile = 5,
  } = options;

  const { searchContent, getProjectPath, openFileAtLocation, openSearchPanel, hide } = dependencies;

  // Search state
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let abortController: AbortController | null = null;
  let lastQuery = "";
  let cachedResults: QuickAccessItem<TextSearchItemData>[] = [];
  
  // Search options (persisted during session)
  let searchOptions: SearchOptions = {
    caseSensitive: false,
    regex: false,
    wholeWord: false,
  };

  /**
   * Create option toggle items shown at the top
   */
  const createOptionItems = (query: string): QuickAccessItem<TextSearchItemData>[] => {
    const items: QuickAccessItem<TextSearchItemData>[] = [];
    
    // Show options as toggle buttons
    if (query.length > 0) {
      items.push({
        id: "options-row",
        label: "Search Options:",
        description: `${searchOptions.caseSensitive ? "[Aa]" : "Aa"} ${searchOptions.regex ? "[.*]" : ".*"} ${searchOptions.wholeWord ? "[W]" : "W"}`,
        detail: "Click to toggle options",
        icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "gear", style: props.style }),
        iconColor: "#71717a",
        disabled: false,
        alwaysShow: true,
        data: { type: "option" },
      });
    }
    
    return items;
  };

  /**
   * Create items for search results grouped by file
   */
  const createResultItems = (
    results: SearchResultEntry[],
    query: string,
    projectPath: string
  ): QuickAccessItem<TextSearchItemData>[] => {
    const items: QuickAccessItem<TextSearchItemData>[] = [];
    let fileIndex = 0;
    
    for (const entry of results) {
      if (fileIndex >= maxFilesShown) {
        items.push({
          id: "more-results",
          label: `... and ${results.length - maxFilesShown} more files`,
          description: "Open Search Panel for all results",
          icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "chevron-right", style: props.style }),
          iconColor: "#71717a",
          data: { type: "more" },
        });
        break;
      }
      
      const relativePath = getRelativePath(entry.file, projectPath);
      const fileName = getFileName(relativePath);
      const directory = getDirectory(relativePath);
      const fullPath = `${projectPath}/${relativePath}`.replace(/\\/g, "/");
      
      // File header item
      items.push({
        id: `file-${fileIndex}`,
        label: fileName,
        description: `${entry.matches.length} match${entry.matches.length !== 1 ? "es" : ""}`,
        detail: directory || undefined,
        icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "file", style: props.style }),
        iconColor: "#3b82f6",
        data: {
          type: "file",
          filePath: relativePath,
          fullPath,
          matchCount: entry.matches.length,
          matches: entry.matches,
        },
      });
      
      // Match items under this file (limited)
      const visibleMatches = entry.matches.slice(0, maxMatchesPerFile);
      
      for (let matchIndex = 0; matchIndex < visibleMatches.length; matchIndex++) {
        const match = visibleMatches[matchIndex];
        const preview = truncate(match.text.trim(), 80);
        const highlightedPreview = highlightMatch(preview, query, searchOptions.caseSensitive);
        
        items.push({
          id: `match-${fileIndex}-${matchIndex}`,
          label: `  ${match.line}:${match.column}`,
          description: highlightedPreview,
          icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "magnifying-glass", style: props.style }),
          iconColor: "#71717a",
          data: {
            type: "match",
            filePath: relativePath,
            fullPath,
            line: match.line,
            column: match.column,
            preview: match.text,
          },
        });
      }
      
      // Show "more matches" indicator if needed
      if (entry.matches.length > maxMatchesPerFile) {
        items.push({
          id: `more-matches-${fileIndex}`,
          label: `  ... ${entry.matches.length - maxMatchesPerFile} more matches`,
          description: "Click file header to see all",
          iconColor: "#71717a",
          disabled: true,
          data: { type: "more" },
        });
      }
      
      fileIndex++;
    }
    
    return items;
  };

  /**
   * Provide items for the given query
   */
  const provideItems = async (query: string): Promise<QuickAccessItem<TextSearchItemData>[]> => {
    // Clear previous debounce
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Cancel previous request
    if (abortController) {
      abortController.abort();
    }

    // Option items always shown when there's a query
    const optionItems = createOptionItems(query);

    // Check minimum query length
    if (query.length < minQueryLength) {
      return [
        ...optionItems,
        {
          id: "hint",
          label: `Type at least ${minQueryLength} characters to search...`,
          description: "Search text in all files",
          disabled: true,
          alwaysShow: true,
        },
      ];
    }

    // Get project path
    const projectPath = getProjectPath();
    if (!projectPath) {
      return [
        ...optionItems,
        {
          id: "no-project",
          label: "No project folder is open",
          description: "Open a folder to search in files",
          disabled: true,
          alwaysShow: true,
        },
      ];
    }

    // Return cached results for same query while debouncing
    if (query === lastQuery && cachedResults.length > 0) {
      return [...optionItems, ...cachedResults];
    }

    // Create new abort controller
    abortController = new AbortController();
    const signal = abortController.signal;

    // Show loading state initially
    const loadingItems: QuickAccessItem<TextSearchItemData>[] = [
      ...optionItems,
      {
        id: "searching",
        label: "Searching...",
        description: `Looking for "${query}" in files`,
        disabled: true,
        alwaysShow: true,
      },
    ];

    // Debounce the actual request
    return new Promise((resolve) => {
      // Immediately return loading state
      if (query !== lastQuery) {
        resolve(loadingItems);
      }

      debounceTimer = setTimeout(async () => {
        try {
          const response = await searchContent({
            path: projectPath,
            pattern: query,
            caseSensitive: searchOptions.caseSensitive,
            regex: searchOptions.regex,
            wholeWord: searchOptions.wholeWord,
            maxResults,
          });

          // Check if request was aborted
          if (signal.aborted) {
            resolve([]);
            return;
          }

          // Transform to QuickAccessItems
          const resultItems = createResultItems(response.results, query, projectPath);

          // Handle empty results
          if (resultItems.length === 0) {
            cachedResults = [{
              id: "no-results",
              label: `No results found for "${query}"`,
              description: "Try a different search term",
              disabled: true,
              alwaysShow: true,
            }];
          } else {
            cachedResults = resultItems;
          }

          lastQuery = query;
          resolve([...optionItems, ...cachedResults]);
        } catch (error) {
          if (signal.aborted) {
            resolve([]);
            return;
          }

          console.error("Text search provider error:", error);
          resolve([
            ...optionItems,
            {
              id: "error",
              label: "Search failed",
              description: error instanceof Error ? error.message : "Unknown error",
              disabled: true,
              alwaysShow: true,
            },
          ]);
        }
      }, debounceMs);
    });
  };

  /**
   * Handle item selection
   */
  const onSelect = (item: QuickAccessItem<TextSearchItemData>): void => {
    if (!item.data) {
      return;
    }

    const { type, fullPath, line, column, matches } = item.data;

    switch (type) {
      case "file":
        // Open file at first match
        if (fullPath && matches && matches.length > 0) {
          hide();
          openFileAtLocation(fullPath, matches[0].line, matches[0].column);
        }
        break;

      case "match":
        // Open file at specific match location
        if (fullPath && line !== undefined) {
          hide();
          openFileAtLocation(fullPath, line, column || 1);
        }
        break;

      case "option":
        // Toggle search options (cycle through)
        // This opens a submenu-like behavior - for now just toggle case sensitive
        searchOptions.caseSensitive = !searchOptions.caseSensitive;
        // Force refresh
        lastQuery = "";
        cachedResults = [];
        break;

      case "more":
        // Open full search panel
        if (openSearchPanel && lastQuery) {
          hide();
          openSearchPanel(lastQuery, searchOptions);
        }
        break;
    }
  };

  /**
   * Handle button click on items
   */
  const onButtonClick = (
    item: QuickAccessItem<TextSearchItemData>,
    _button: QuickAccessItemButton,
    buttonIndex: number
  ): void => {
    // Handle option toggles
    if (item.data?.type === "option") {
      switch (buttonIndex) {
        case 0: // Case sensitive
          searchOptions.caseSensitive = !searchOptions.caseSensitive;
          break;
        case 1: // Regex
          searchOptions.regex = !searchOptions.regex;
          break;
        case 2: // Whole word
          searchOptions.wholeWord = !searchOptions.wholeWord;
          break;
      }
      // Force refresh
      lastQuery = "";
      cachedResults = [];
    }
  };

  /**
   * Cleanup function to cancel pending operations
   */
  const cleanup = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    lastQuery = "";
    cachedResults = [];
  };

  /**
   * Get current search options
   */
  const getSearchOptions = (): SearchOptions => ({ ...searchOptions });

  /**
   * Set search options
   */
  const setSearchOptions = (options: Partial<SearchOptions>): void => {
    searchOptions = { ...searchOptions, ...options };
    // Force refresh
    lastQuery = "";
    cachedResults = [];
  };

  return {
    id: "text-search",
    prefix: "%",
    name: "Search in Files",
    description: "Search for text in all workspace files",
    placeholder: "Search text in files...",
    provideItems,
    onSelect,
    onButtonClick,
    // Expose additional methods
    cleanup,
    getSearchOptions,
    setSearchOptions,
  } as QuickAccessProvider<TextSearchItemData> & {
    cleanup: () => void;
    getSearchOptions: () => SearchOptions;
    setSearchOptions: (options: Partial<SearchOptions>) => void;
  };
}

// =============================================================================
// Default Export
// =============================================================================

export default createTextSearchProvider;
