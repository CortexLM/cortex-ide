import {
  createContext,
  createSignal,
  useContext,
  ParentProps,
  createMemo,
  batch,
  onMount,
  onCleanup,
  Accessor,
  createEffect,
} from "solid-js";
import { createStore } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { getProjectPath } from "@/utils/workspace";
import type { ReplacePreviewResult, SearchHistoryPersistEntry } from "@/types/workspace";

// ============================================================================
// Search Type Definitions
// ============================================================================

/** Pattern types for search */
export type PatternType = "literal" | "regex" | "glob";

/** Search query options */
export interface SearchQueryOptions {
  /** Case sensitive search */
  caseSensitive: boolean;
  /** Match whole words only */
  wholeWord: boolean;
  /** Use regular expressions */
  useRegex: boolean;
  /** Include/exclude patterns */
  includePattern: string;
  excludePattern: string;
  /** Search in specific file types */
  fileTypes: string[];
  /** Maximum results to return */
  maxResults: number;
  /** Search only in open editors */
  searchInOpenEditors: boolean;
  /** Follow symlinks */
  followSymlinks: boolean;
  /** Use .gitignore and other ignore files */
  useIgnoreFiles: boolean;
  /** Context lines before and after match */
  contextLines: number;
  /** Pattern type for advanced search */
  patternType: PatternType;
  /** Enable multiline search */
  multiline: boolean;
}

/** Default search query options */
export const DEFAULT_SEARCH_OPTIONS: SearchQueryOptions = {
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
  includePattern: "",
  excludePattern: "",
  fileTypes: [],
  maxResults: 10000,
  searchInOpenEditors: false,
  followSymlinks: true,
  useIgnoreFiles: true,
  contextLines: 2,
  patternType: "literal",
  multiline: false,
};

/** Search query state */
export interface SearchQuery {
  /** Search pattern/text */
  pattern: string;
  /** Replace text (for search & replace) */
  replacePattern: string;
  /** Search options */
  options: SearchQueryOptions;
  /** Scope: workspace, folder, or specific paths */
  scope: SearchScope;
}

/** Search scope definition */
export interface SearchScope {
  /** Type of search scope */
  type: "workspace" | "folder" | "openEditors" | "selection" | "custom";
  /** Specific folder path (for folder scope) */
  folderPath?: string;
  /** Custom paths to search in */
  customPaths?: string[];
}

/** Default search query */
export const DEFAULT_SEARCH_QUERY: SearchQuery = {
  pattern: "",
  replacePattern: "",
  options: DEFAULT_SEARCH_OPTIONS,
  scope: { type: "workspace" },
};

/** Text range within a file */
export interface TextRange {
  /** Start line (0-indexed) */
  startLine: number;
  /** Start column (0-indexed) */
  startColumn: number;
  /** End line (0-indexed) */
  endLine: number;
  /** End column (0-indexed) */
  endColumn: number;
}

/** Single match within a search result */
export interface SearchMatch {
  /** Unique identifier for the match */
  id: string;
  /** Range of the match */
  range: TextRange;
  /** The matched text */
  matchedText: string;
  /** Preview text with context */
  preview: string;
  /** Offset within the preview where match starts */
  previewMatchStart: number;
  /** Length of match in preview */
  previewMatchLength: number;
}

/** Search result for a single file */
export interface SearchResult {
  /** Unique identifier for this result */
  id: string;
  /** File URI (file:// scheme) */
  uri: string;
  /** Absolute file path */
  path: string;
  /** Relative path from workspace root */
  relativePath: string;
  /** File name only */
  filename: string;
  /** All matches in this file */
  matches: SearchMatch[];
  /** Total match count (may differ from matches.length if truncated) */
  totalMatches: number;
  /** Whether results were truncated */
  truncated: boolean;
  /** Whether this result is expanded in UI */
  isExpanded: boolean;
  /** Whether this result is selected for replacement */
  isSelected: boolean;
}

/** Search progress information */
export interface SearchProgress {
  /** Files searched so far */
  filesSearched: number;
  /** Total files to search (estimate) */
  totalFiles: number;
  /** Matches found so far */
  matchesFound: number;
  /** Current file being searched */
  currentFile: string;
  /** Whether search is complete */
  isComplete: boolean;
  /** Whether search was cancelled */
  wasCancelled: boolean;
  /** Search duration in milliseconds */
  duration: number;
}

/** Search editor state (for search editor tabs) */
export interface SearchEditorState {
  /** Unique identifier */
  id: string;
  /** Editor title */
  title: string;
  /** The query used for this search */
  query: SearchQuery;
  /** Results from this search */
  results: SearchResult[];
  /** Progress information */
  progress: SearchProgress;
  /** When this search was created */
  createdAt: number;
  /** Whether this editor is pinned */
  isPinned: boolean;
}

/** Search history entry */
export interface SearchHistoryEntry {
  /** Unique identifier */
  id: string;
  /** The search query */
  query: SearchQuery;
  /** Timestamp when search was performed */
  timestamp: number;
  /** Total results count */
  resultsCount: number;
  /** Duration in milliseconds */
  duration: number;
}

/** Text search provider definition */
export interface TextSearchProvider {
  /** Unique provider ID */
  id: string;
  /** Display name */
  name: string;
  /** Provider priority (higher = more preferred) */
  priority: number;
  /** Supported file extensions (empty = all files) */
  supportedExtensions: string[];
  /** Whether this provider is enabled */
  enabled: boolean;
}

/** File search provider definition */
export interface FileSearchProvider {
  /** Unique provider ID */
  id: string;
  /** Display name */
  name: string;
  /** Provider priority (higher = more preferred) */
  priority: number;
  /** Whether this provider is enabled */
  enabled: boolean;
}

/** Search statistics */
export interface SearchStats {
  /** Total searches performed in this session */
  totalSearches: number;
  /** Total replaces performed */
  totalReplaces: number;
  /** Average search duration */
  averageDuration: number;
  /** Most common search patterns */
  frequentPatterns: string[];
}

// ============================================================================
// Search State
// ============================================================================

export interface SearchState {
  /** Current search query */
  query: SearchQuery;
  /** Search results */
  results: SearchResult[];
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Search progress */
  progress: SearchProgress;
  /** Error message if search failed */
  error: string | null;
  /** Whether search panel is visible */
  isPanelVisible: boolean;
  /** Whether replace mode is active */
  isReplaceMode: boolean;
  /** Search editors (for search editor tabs) */
  searchEditors: SearchEditorState[];
  /** Search history */
  searchHistory: SearchHistoryEntry[];
  /** Registered text search providers */
  textSearchProviders: TextSearchProvider[];
  /** Registered file search providers */
  fileSearchProviders: FileSearchProvider[];
  /** Active text search provider ID */
  activeTextSearchProviderId: string | null;
  /** Active file search provider ID */
  activeFileSearchProviderId: string | null;
  /** Search statistics */
  stats: SearchStats;
}

const DEFAULT_PROGRESS: SearchProgress = {
  filesSearched: 0,
  totalFiles: 0,
  matchesFound: 0,
  currentFile: "",
  isComplete: false,
  wasCancelled: false,
  duration: 0,
};

const DEFAULT_STATS: SearchStats = {
  totalSearches: 0,
  totalReplaces: 0,
  averageDuration: 0,
  frequentPatterns: [],
};

// ============================================================================
// Context Interface
// ============================================================================

export interface SearchContextValue {
  /** Current state */
  state: SearchState;

  /** Accessor for search query */
  searchQuery: Accessor<SearchQuery>;
  /** Accessor for search results */
  searchResults: Accessor<SearchResult[]>;
  /** Accessor for isSearching */
  isSearching: Accessor<boolean>;
  /** Accessor for search editors */
  searchEditors: Accessor<SearchEditorState[]>;
  /** Accessor for search history */
  searchHistory: Accessor<SearchHistoryEntry[]>;
  /** Accessor for progress */
  searchProgress: Accessor<SearchProgress>;
  /** Accessor for error */
  searchError: Accessor<string | null>;
  /** Accessor for regex validation error */
  regexError: Accessor<string | null>;

  // Query management
  /** Update search query */
  setSearchQuery: (query: Partial<SearchQuery>) => void;
  /** Update search options */
  setSearchOptions: (options: Partial<SearchQueryOptions>) => void;
  /** Update search scope */
  setSearchScope: (scope: SearchScope) => void;
  /** Clear search query */
  clearQuery: () => void;

  // Search operations
  /** Perform search with current query */
  performSearch: (query?: Partial<SearchQuery>) => Promise<void>;
  /** Cancel ongoing search */
  cancelSearch: () => void;
  /** Refresh search results */
  refreshSearch: () => Promise<void>;

  // Replace operations
  /** Replace all matches */
  replaceAll: (replaceText?: string) => Promise<void>;
  /** Replace matches in a specific file */
  replaceInFile: (uri: string, replaceText?: string) => Promise<void>;
  /** Replace a single match */
  replaceMatch: (uri: string, matchId: string, replaceText?: string) => Promise<void>;
  /** Toggle replace mode */
  toggleReplaceMode: () => void;
  /** Set replace mode */
  setReplaceMode: (enabled: boolean) => void;

  // History management
  /** Add entry to search history */
  addToHistory: (query: SearchQuery) => void;
  /** Clear search history */
  clearHistory: () => void;
  /** Load search from history */
  loadFromHistory: (entryId: string) => void;
  /** Remove specific history entry */
  removeFromHistory: (entryId: string) => void;

  // Search editors
  /** Create a new search editor */
  createSearchEditor: () => string;
  /** Close a search editor */
  closeSearchEditor: (id: string) => void;
  /** Update search editor */
  updateSearchEditor: (id: string, updates: Partial<SearchEditorState>) => void;
  /** Pin/unpin search editor */
  toggleSearchEditorPin: (id: string) => void;
  /** Get search editor by ID */
  getSearchEditor: (id: string) => SearchEditorState | undefined;

  // Result management
  /** Toggle result expansion */
  toggleResultExpanded: (resultId: string) => void;
  /** Toggle result selection for replace */
  toggleResultSelected: (resultId: string) => void;
  /** Select all results */
  selectAllResults: () => void;
  /** Deselect all results */
  deselectAllResults: () => void;
  /** Expand all results */
  expandAllResults: () => void;
  /** Collapse all results */
  collapseAllResults: () => void;
  /** Clear search results */
  clearResults: () => void;

  // Panel visibility
  /** Toggle search panel */
  togglePanel: () => void;
  /** Show search panel */
  showPanel: () => void;
  /** Hide search panel */
  hidePanel: () => void;

  // Provider management
  /** Register a text search provider */
  registerTextSearchProvider: (provider: TextSearchProvider) => void;
  /** Unregister a text search provider */
  unregisterTextSearchProvider: (providerId: string) => void;
  /** Register a file search provider */
  registerFileSearchProvider: (provider: FileSearchProvider) => void;
  /** Unregister a file search provider */
  unregisterFileSearchProvider: (providerId: string) => void;
  /** Set active text search provider */
  setActiveTextSearchProvider: (providerId: string) => void;
  /** Set active file search provider */
  setActiveFileSearchProvider: (providerId: string) => void;
  /** Get all text search providers */
  getTextSearchProviders: () => TextSearchProvider[];
  /** Get all file search providers */
  getFileSearchProviders: () => FileSearchProvider[];

  // Utility
  /** Get total match count */
  getTotalMatchCount: () => number;
  /** Get selected result count */
  getSelectedResultCount: () => number;
  /** Get search statistics */
  getStats: () => SearchStats;
  /** Export results to various formats */
  exportResults: (format: "json" | "csv" | "text") => string;

  /** Validate a regex pattern */
  validateRegex: (pattern: string) => Promise<{ valid: boolean; error: string | null }>;
  /** Undo the last replace operation on a file */
  undoReplace: (filePath: string) => Promise<void>;
  /** Save search history to backend persistent storage */
  persistHistory: () => Promise<void>;
  /** Load search history from backend persistent storage */
  loadPersistedHistory: () => Promise<void>;
  /** Perform search across multiple workspace roots */
  performMultiRootSearch: (roots: string[], query?: Partial<SearchQuery>) => Promise<void>;
  /** Get replace preview without applying */
  replacePreview: () => Promise<ReplacePreviewResult | null>;
  /** Current replace preview results */
  replacePreviewResults: () => ReplacePreviewResult | null;
  /** Clear replace preview */
  clearReplacePreview: () => void;
  /** Perform streaming multi-root search via backend */
  performStreamingSearch: (roots: string[], query?: Partial<SearchQuery>) => Promise<void>;
  /** Persist search history to backend */
  persistHistoryToBackend: () => Promise<void>;
  /** Load search history from backend */
  loadHistoryFromBackend: () => Promise<void>;
  /** Delete a specific history item from backend */
  deleteHistoryItemFromBackend: (id: string) => Promise<void>;
  /** Clear all history from backend */
  clearHistoryFromBackend: () => Promise<void>;
  /** Preview replace results without applying */
  previewReplace: (replaceText?: string) => Promise<{
    entries: Array<{
      filePath: string;
      originalLines: string[];
      modifiedLines: string[];
      matchCount: number;
    }>;
    totalReplacements: number;
    totalFiles: number;
  } | null>;
  /** Clear persisted search history on backend */
  clearPersistedHistory: () => Promise<void>;
  /** Search with advanced filters */
  searchWithFilters: (options: {
    paths: string[];
    fileList?: string[];
    multiline?: boolean;
  }) => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const SearchContext = createContext<SearchContextValue>();

const SEARCH_HISTORY_KEY = "cortex_search_history";
const MAX_HISTORY_ENTRIES = 100;
const MAX_FREQUENT_PATTERNS = 10;

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function loadSearchHistory(): SearchHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];

  const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, MAX_HISTORY_ENTRIES);
      }
    } catch (err) {
      console.debug("[Search] Parse history failed:", err);
    }
  }
  return [];
}

function saveSearchHistory(history: SearchHistoryEntry[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      SEARCH_HISTORY_KEY,
      JSON.stringify(history.slice(0, MAX_HISTORY_ENTRIES))
    );
  } catch (e) {
    console.error("Failed to save search history:", e);
  }
}

function createMatchId(fileUri: string, match: TextRange): string {
  return `${fileUri}:${match.startLine}:${match.startColumn}:${match.endLine}:${match.endColumn}`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSearchPattern(query: SearchQuery): string {
  let pattern = query.pattern;

  if (!query.options.useRegex) {
    pattern = escapeRegex(pattern);
  }

  if (query.options.wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }

  return pattern;
}

// ============================================================================
// Provider
// ============================================================================

export function SearchProvider(props: ParentProps) {
  const [state, setState] = createStore<SearchState>({
    query: { ...DEFAULT_SEARCH_QUERY },
    results: [],
    isSearching: false,
    progress: { ...DEFAULT_PROGRESS },
    error: null,
    isPanelVisible: false,
    isReplaceMode: false,
    searchEditors: [],
    searchHistory: [],
    textSearchProviders: [],
    fileSearchProviders: [],
    activeTextSearchProviderId: null,
    activeFileSearchProviderId: null,
    stats: { ...DEFAULT_STATS },
  });

  // Cancellation token for search
  let searchCancelToken: AbortController | null = null;
  let searchStartTime = 0;

  const [replacePreviewResults, setReplacePreviewResults] = createSignal<ReplacePreviewResult | null>(null);

  // Regex validation state
  const [regexValidationError, setRegexValidationError] = createSignal<string | null>(null);
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Accessors
  const searchQuery = () => state.query;
  const searchResults = () => state.results;
  const isSearching = () => state.isSearching;
  const searchEditors = () => state.searchEditors;
  const searchHistory = () => state.searchHistory;
  const searchProgress = () => state.progress;
  const searchError = () => state.error;

  // Derived values
  const totalMatchCount = createMemo(() => {
    return state.results.reduce((sum, r) => sum + r.totalMatches, 0);
  });

  const selectedResultCount = createMemo(() => {
    return state.results.filter((r) => r.isSelected).length;
  });

  // Load history on mount
  onMount(() => {
    const history = loadSearchHistory();
    setState("searchHistory", history);

    // Update frequent patterns from history
    updateFrequentPatterns(history);
  });

  // Listen for streaming search results from the backend
  onMount(() => {
    let unlistenStreamingResult: UnlistenFn | null = null;

    const setupListeners = async () => {
      unlistenStreamingResult = await listen("search:streaming-result", (event) => {
        const payload = event.payload as { file: string; matches: Array<{ line: number; column: number; text: string; matchStart: number; matchEnd: number }> };
        if (payload && payload.file && payload.matches) {
          const projectPath = getProjectPath();
          const relativePath = payload.file.replace(projectPath + "/", "").replace(projectPath + "\\", "");
          const filename = relativePath.split("/").pop() || relativePath.split("\\").pop() || relativePath;
          const resultId = generateId();
          const result: SearchResult = {
            id: resultId,
            uri: `file://${payload.file}`,
            path: payload.file,
            relativePath,
            filename,
            matches: payload.matches.map((m) => ({
              id: createMatchId(`file://${payload.file}`, { startLine: m.line - 1, startColumn: m.matchStart, endLine: m.line - 1, endColumn: m.matchEnd }),
              range: { startLine: m.line - 1, startColumn: m.matchStart, endLine: m.line - 1, endColumn: m.matchEnd },
              matchedText: m.text.slice(m.matchStart, m.matchEnd),
              preview: m.text,
              previewMatchStart: m.matchStart,
              previewMatchLength: m.matchEnd - m.matchStart,
            })),
            totalMatches: payload.matches.length,
            truncated: false,
            isExpanded: true,
            isSelected: true,
          };
          setState("results", (prev) => [...prev, result]);
        }
      });
    };

    setupListeners();

    onCleanup(() => {
      unlistenStreamingResult?.();
    });
  });

  // Search-as-you-type with debounce
  createEffect(() => {
    const pattern = state.query.pattern;
    const isRegex = state.query.options.useRegex;
    
    // Clear previous debounce
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }

    // Validate regex in real-time
    if (isRegex && pattern.trim()) {
      validateRegex(pattern).then(result => {
        setRegexValidationError(result.error);
      });
    } else {
      setRegexValidationError(null);
    }

    // Auto-search after debounce (only if pattern is long enough)
    if (pattern.trim().length >= 2) {
      searchDebounceTimer = setTimeout(() => {
        performSearch();
      }, 300);
    }
  });

  // Update frequent patterns from history
  function updateFrequentPatterns(history: SearchHistoryEntry[]): void {
    const patternCounts = new Map<string, number>();
    
    for (const entry of history) {
      const pattern = entry.query.pattern;
      if (pattern) {
        patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
      }
    }

    const sorted = Array.from(patternCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_FREQUENT_PATTERNS)
      .map(([pattern]) => pattern);

    setState("stats", "frequentPatterns", sorted);
  }

  // Query management
  const setSearchQuery = (query: Partial<SearchQuery>): void => {
    setState("query", (prev) => ({
      ...prev,
      ...query,
      options: query.options
        ? { ...prev.options, ...query.options }
        : prev.options,
      scope: query.scope ? { ...prev.scope, ...query.scope } : prev.scope,
    }));
  };

  const setSearchOptions = (options: Partial<SearchQueryOptions>): void => {
    setState("query", "options", (prev) => ({ ...prev, ...options }));
  };

  const setSearchScope = (scope: SearchScope): void => {
    setState("query", "scope", scope);
  };

  const clearQuery = (): void => {
    setState("query", { ...DEFAULT_SEARCH_QUERY });
    setState("results", []);
    setState("error", null);
    setState("progress", { ...DEFAULT_PROGRESS });
  };

  // Search operations
  const performSearch = async (query?: Partial<SearchQuery>): Promise<void> => {
    // Cancel any ongoing search
    if (searchCancelToken) {
      searchCancelToken.abort();
    }

    // Update query if provided
    if (query) {
      setSearchQuery(query);
    }

    const currentQuery = state.query;

    // Validate query
    if (!currentQuery.pattern.trim()) {
      setState("error", "Search pattern is required");
      return;
    }

    // Setup cancellation
    searchCancelToken = new AbortController();
    searchStartTime = Date.now();

    batch(() => {
      setState("isSearching", true);
      setState("error", null);
      setState("results", []);
      setState("progress", {
        filesSearched: 0,
        totalFiles: 0,
        matchesFound: 0,
        currentFile: "",
        isComplete: false,
        wasCancelled: false,
        duration: 0,
      });
    });

    try {
      // Build search parameters
      const searchPattern = buildSearchPattern(currentQuery);

      const projectPath = getProjectPath();
      if (!projectPath) {
        setState("error", "No project open");
        setState("isSearching", false);
        return;
      }

      // Perform search via backend
      const searchResponse = await invoke<{
        results: Array<{
          file: string;
          matches: Array<{
            line: number;
            column: number;
            text: string;
            matchStart: number;
            matchEnd: number;
          }>;
        }>;
        totalMatches: number;
        filesSearched: number;
      }>("fs_search_content", {
        path: projectPath,
        query: searchPattern,
        caseSensitive: currentQuery.options.caseSensitive,
        regex: currentQuery.options.useRegex || currentQuery.options.patternType === "regex",
        wholeWord: currentQuery.options.wholeWord,
        include: currentQuery.options.includePattern || undefined,
        exclude: currentQuery.options.excludePattern || undefined,
        maxResults: currentQuery.options.maxResults,
      });

      // Check if search was cancelled
      if (searchCancelToken?.signal.aborted) {
        return;
      }

      const duration = Date.now() - searchStartTime;

      // Transform backend response into SearchResult format
      const processedResults: SearchResult[] = searchResponse.results.map((entry) => {
        const relativePath = entry.file.replace(projectPath + "/", "").replace(projectPath + "\\", "");
        const filename = relativePath.split("/").pop() || relativePath.split("\\").pop() || relativePath;
        const resultId = generateId();
        return {
          id: resultId,
          uri: `file://${entry.file}`,
          path: entry.file,
          relativePath,
          filename,
          matches: entry.matches.map((m) => ({
            id: createMatchId(`file://${entry.file}`, {
              startLine: m.line - 1,
              startColumn: m.matchStart,
              endLine: m.line - 1,
              endColumn: m.matchEnd,
            }),
            range: {
              startLine: m.line - 1,
              startColumn: m.matchStart,
              endLine: m.line - 1,
              endColumn: m.matchEnd,
            },
            matchedText: m.text.slice(m.matchStart, m.matchEnd),
            preview: m.text,
            previewMatchStart: m.matchStart,
            previewMatchLength: m.matchEnd - m.matchStart,
          })),
          totalMatches: entry.matches.length,
          truncated: false,
          isExpanded: true,
          isSelected: true,
        };
      });

      batch(() => {
        setState("results", processedResults);
        setState("progress", {
          filesSearched: searchResponse.filesSearched,
          totalFiles: searchResponse.filesSearched,
          matchesFound: searchResponse.totalMatches,
          currentFile: "",
          isComplete: true,
          wasCancelled: false,
          duration,
        });
        setState("isSearching", false);
      });

      // Update statistics
      setState("stats", (prev) => ({
        ...prev,
        totalSearches: prev.totalSearches + 1,
        averageDuration:
          (prev.averageDuration * prev.totalSearches + duration) /
          (prev.totalSearches + 1),
      }));

      // Add to history
      addToHistory(currentQuery);

      // Dispatch event
      window.dispatchEvent(
        new CustomEvent("search:complete", {
          detail: {
            query: currentQuery,
            resultsCount: processedResults.length,
            matchesCount: state.progress.matchesFound,
            duration,
          },
        })
      );
    } catch (err) {
      if (searchCancelToken?.signal.aborted) {
        setState("progress", (prev) => ({
          ...prev,
          isComplete: true,
          wasCancelled: true,
          duration: Date.now() - searchStartTime,
        }));
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setState("error", errorMessage);
        console.error("Search failed:", err);
      }
    } finally {
      setState("isSearching", false);
      searchCancelToken = null;
    }
  };

  const cancelSearch = (): void => {
    if (searchCancelToken) {
      searchCancelToken.abort();
      setState("isSearching", false);
      setState("progress", (prev) => ({
        ...prev,
        wasCancelled: true,
        isComplete: true,
        duration: Date.now() - searchStartTime,
      }));
    }
  };

  const refreshSearch = async (): Promise<void> => {
    if (state.query.pattern.trim()) {
      await performSearch();
    }
  };

  // Replace operations
  const replaceAll = async (replaceText?: string): Promise<void> => {
    const replace = replaceText ?? state.query.replacePattern;
    const selectedResults = state.results.filter((r) => r.isSelected);

    if (selectedResults.length === 0) {
      return;
    }

    try {
      setState("isSearching", true);
      setState("error", null);

      // Transform results to backend format
      const backendResults = selectedResults.map((r) => ({
        uri: r.uri,
        matches: r.matches.map((m) => ({
          id: m.id,
          line: m.range.startLine + 1,
          column: m.range.startColumn,
          length: m.previewMatchLength,
          line_text: m.preview,
          preview: m.preview,
        })),
        totalMatches: r.totalMatches,
      }));

      // Perform replace via backend
      await invoke("search_replace_all", {
        results: backendResults,
        replaceText: replace,
        useRegex: state.query.options.useRegex,
        preserveCase: state.query.options.caseSensitive,
      });

      // Update statistics
      const totalReplaced = selectedResults.reduce(
        (sum, r) => sum + r.totalMatches,
        0
      );
      setState("stats", (prev) => ({
        ...prev,
        totalReplaces: prev.totalReplaces + totalReplaced,
      }));

      // Refresh search to show updated results
      await refreshSearch();

      // Dispatch event
      window.dispatchEvent(
        new CustomEvent("search:replace-complete", {
          detail: {
            filesModified: selectedResults.length,
            replacementsCount: totalReplaced,
          },
        })
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setState("error", `Replace failed: ${errorMessage}`);
      console.error("Replace failed:", err);
    } finally {
      setState("isSearching", false);
    }
  };

  const replaceInFile = async (uri: string, replaceText?: string): Promise<void> => {
    const replace = replaceText ?? state.query.replacePattern;
    const result = state.results.find((r) => r.uri === uri);

    if (!result) {
      return;
    }

    try {
      setState("isSearching", true);

      const backendMatches = result.matches.map((m) => ({
        id: m.id,
        line: m.range.startLine + 1,
        column: m.range.startColumn,
        length: m.previewMatchLength,
        line_text: m.preview,
        preview: m.preview,
      }));

      await invoke("search_replace_in_file", {
        uri,
        matches: backendMatches,
        replaceText: replace,
        useRegex: state.query.options.useRegex,
        preserveCase: state.query.options.caseSensitive,
      });

      // Remove result from list
      setState("results", (prev) => prev.filter((r) => r.uri !== uri));

      // Update stats
      setState("stats", (prev) => ({
        ...prev,
        totalReplaces: prev.totalReplaces + result.totalMatches,
      }));

      // Dispatch event
      window.dispatchEvent(
        new CustomEvent("search:replace-in-file", {
          detail: { uri, replacementsCount: result.totalMatches },
        })
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setState("error", `Replace in file failed: ${errorMessage}`);
      console.error("Replace in file failed:", err);
    } finally {
      setState("isSearching", false);
    }
  };

  const replaceMatch = async (
    uri: string,
    matchId: string,
    replaceText?: string
  ): Promise<void> => {
    const replace = replaceText ?? state.query.replacePattern;
    const result = state.results.find((r) => r.uri === uri);
    const match = result?.matches.find((m) => m.id === matchId);

    if (!result || !match) {
      return;
    }

    try {
      await invoke("search_replace_match", {
        request: {
          uri,
          match: {
            id: match.id,
            line: match.range.startLine + 1,
            column: match.range.startColumn,
            length: match.previewMatchLength,
            line_text: match.preview,
            preview: match.preview,
          },
          replaceText: replace,
          useRegex: state.query.options.useRegex,
          preserveCase: state.query.options.caseSensitive,
        },
      });

      // Update result: remove match or remove entire result if no matches left
      setState("results", (prev) =>
        prev
          .map((r) => {
            if (r.uri !== uri) return r;
            const newMatches = r.matches.filter((m) => m.id !== matchId);
            if (newMatches.length === 0) {
              return null;
            }
            return {
              ...r,
              matches: newMatches,
              totalMatches: r.totalMatches - 1,
            };
          })
          .filter((r): r is SearchResult => r !== null)
      );

      // Update stats
      setState("stats", (prev) => ({
        ...prev,
        totalReplaces: prev.totalReplaces + 1,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setState("error", `Replace match failed: ${errorMessage}`);
      console.error("Replace match failed:", err);
    }
  };

  const toggleReplaceMode = (): void => {
    setState("isReplaceMode", (prev) => !prev);
  };

  const setReplaceMode = (enabled: boolean): void => {
    setState("isReplaceMode", enabled);
  };

  // History management
  const addToHistory = (query: SearchQuery): void => {
    const entry: SearchHistoryEntry = {
      id: generateId(),
      query: { ...query },
      timestamp: Date.now(),
      resultsCount: state.results.length,
      duration: state.progress.duration,
    };

    setState("searchHistory", (prev) => {
      // Remove duplicate if exists (same pattern)
      const filtered = prev.filter(
        (e) =>
          e.query.pattern !== query.pattern ||
          e.query.options.caseSensitive !== query.options.caseSensitive ||
          e.query.options.useRegex !== query.options.useRegex
      );
      const updated = [entry, ...filtered].slice(0, MAX_HISTORY_ENTRIES);
      saveSearchHistory(updated);
      updateFrequentPatterns(updated);
      return updated;
    });
  };

  const clearHistory = (): void => {
    setState("searchHistory", []);
    setState("stats", "frequentPatterns", []);
    saveSearchHistory([]);
  };

  const loadFromHistory = (entryId: string): void => {
    const entry = state.searchHistory.find((e) => e.id === entryId);
    if (entry) {
      setState("query", { ...entry.query });
      performSearch();
    }
  };

  const removeFromHistory = (entryId: string): void => {
    setState("searchHistory", (prev) => {
      const updated = prev.filter((e) => e.id !== entryId);
      saveSearchHistory(updated);
      updateFrequentPatterns(updated);
      return updated;
    });
  };

  // Search editors
  const createSearchEditor = (): string => {
    const id = generateId();
    const editor: SearchEditorState = {
      id,
      title: `Search: ${state.query.pattern || "Untitled"}`,
      query: { ...state.query },
      results: [...state.results],
      progress: { ...state.progress },
      createdAt: Date.now(),
      isPinned: false,
    };

    setState("searchEditors", (prev) => [...prev, editor]);

    // Dispatch event
    window.dispatchEvent(
      new CustomEvent("search:editor-created", {
        detail: { id, editor },
      })
    );

    return id;
  };

  const closeSearchEditor = (id: string): void => {
    setState("searchEditors", (prev) => prev.filter((e) => e.id !== id));

    window.dispatchEvent(
      new CustomEvent("search:editor-closed", { detail: { id } })
    );
  };

  const updateSearchEditor = (
    id: string,
    updates: Partial<SearchEditorState>
  ): void => {
    setState("searchEditors", (prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  };

  const toggleSearchEditorPin = (id: string): void => {
    setState("searchEditors", (prev) =>
      prev.map((e) => (e.id === id ? { ...e, isPinned: !e.isPinned } : e))
    );
  };

  const getSearchEditor = (id: string): SearchEditorState | undefined => {
    return state.searchEditors.find((e) => e.id === id);
  };

  // Result management
  const toggleResultExpanded = (resultId: string): void => {
    setState("results", (prev) =>
      prev.map((r) =>
        r.id === resultId ? { ...r, isExpanded: !r.isExpanded } : r
      )
    );
  };

  const toggleResultSelected = (resultId: string): void => {
    setState("results", (prev) =>
      prev.map((r) =>
        r.id === resultId ? { ...r, isSelected: !r.isSelected } : r
      )
    );
  };

  const selectAllResults = (): void => {
    setState("results", (prev) => prev.map((r) => ({ ...r, isSelected: true })));
  };

  const deselectAllResults = (): void => {
    setState("results", (prev) => prev.map((r) => ({ ...r, isSelected: false })));
  };

  const expandAllResults = (): void => {
    setState("results", (prev) => prev.map((r) => ({ ...r, isExpanded: true })));
  };

  const collapseAllResults = (): void => {
    setState("results", (prev) => prev.map((r) => ({ ...r, isExpanded: false })));
  };

  const clearResults = (): void => {
    setState("results", []);
    setState("progress", { ...DEFAULT_PROGRESS });
    setState("error", null);
  };

  // Panel visibility
  const togglePanel = (): void => {
    setState("isPanelVisible", (prev) => !prev);
  };

  const showPanel = (): void => {
    setState("isPanelVisible", true);
  };

  const hidePanel = (): void => {
    setState("isPanelVisible", false);
  };

  // Provider management
  const registerTextSearchProvider = (provider: TextSearchProvider): void => {
    setState("textSearchProviders", (prev) => {
      // Replace if exists, otherwise add
      const existing = prev.findIndex((p) => p.id === provider.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = provider;
        return updated;
      }
      return [...prev, provider].sort((a, b) => b.priority - a.priority);
    });

    // Set as active if first provider or higher priority
    if (
      !state.activeTextSearchProviderId ||
      provider.priority > (state.textSearchProviders.find(
        (p) => p.id === state.activeTextSearchProviderId
      )?.priority ?? 0)
    ) {
      setState("activeTextSearchProviderId", provider.id);
    }

    window.dispatchEvent(
      new CustomEvent("search:text-provider-registered", {
        detail: { provider },
      })
    );
  };

  const unregisterTextSearchProvider = (providerId: string): void => {
    setState("textSearchProviders", (prev) =>
      prev.filter((p) => p.id !== providerId)
    );

    // Update active provider if needed
    if (state.activeTextSearchProviderId === providerId) {
      const remaining = state.textSearchProviders;
      setState(
        "activeTextSearchProviderId",
        remaining.length > 0 ? remaining[0].id : null
      );
    }

    window.dispatchEvent(
      new CustomEvent("search:text-provider-unregistered", {
        detail: { providerId },
      })
    );
  };

  const registerFileSearchProvider = (provider: FileSearchProvider): void => {
    setState("fileSearchProviders", (prev) => {
      const existing = prev.findIndex((p) => p.id === provider.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = provider;
        return updated;
      }
      return [...prev, provider].sort((a, b) => b.priority - a.priority);
    });

    if (
      !state.activeFileSearchProviderId ||
      provider.priority > (state.fileSearchProviders.find(
        (p) => p.id === state.activeFileSearchProviderId
      )?.priority ?? 0)
    ) {
      setState("activeFileSearchProviderId", provider.id);
    }

    window.dispatchEvent(
      new CustomEvent("search:file-provider-registered", {
        detail: { provider },
      })
    );
  };

  const unregisterFileSearchProvider = (providerId: string): void => {
    setState("fileSearchProviders", (prev) =>
      prev.filter((p) => p.id !== providerId)
    );

    if (state.activeFileSearchProviderId === providerId) {
      const remaining = state.fileSearchProviders;
      setState(
        "activeFileSearchProviderId",
        remaining.length > 0 ? remaining[0].id : null
      );
    }

    window.dispatchEvent(
      new CustomEvent("search:file-provider-unregistered", {
        detail: { providerId },
      })
    );
  };

  const setActiveTextSearchProvider = (providerId: string): void => {
    if (state.textSearchProviders.some((p) => p.id === providerId)) {
      setState("activeTextSearchProviderId", providerId);
    }
  };

  const setActiveFileSearchProvider = (providerId: string): void => {
    if (state.fileSearchProviders.some((p) => p.id === providerId)) {
      setState("activeFileSearchProviderId", providerId);
    }
  };

  const getTextSearchProviders = (): TextSearchProvider[] => {
    return state.textSearchProviders;
  };

  const getFileSearchProviders = (): FileSearchProvider[] => {
    return state.fileSearchProviders;
  };

  // Utility functions
  const getTotalMatchCount = (): number => totalMatchCount();

  const getSelectedResultCount = (): number => selectedResultCount();

  const getStats = (): SearchStats => state.stats;

  const exportResults = (format: "json" | "csv" | "text"): string => {
    const results = state.results;

    switch (format) {
      case "json":
        return JSON.stringify(results, null, 2);

      case "csv": {
        const headers = ["File", "Line", "Column", "Match", "Preview"];
        const rows = results.flatMap((r) =>
          r.matches.map((m) => [
            r.path,
            m.range.startLine + 1,
            m.range.startColumn + 1,
            `"${m.matchedText.replace(/"/g, '""')}"`,
            `"${m.preview.replace(/"/g, '""')}"`,
          ])
        );
        return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      }

      case "text":
      default: {
        const lines: string[] = [];
        for (const result of results) {
          lines.push(`\n${result.path}:`);
          for (const match of result.matches) {
            lines.push(
              `  ${match.range.startLine + 1}:${match.range.startColumn + 1}: ${match.preview}`
            );
          }
        }
        return lines.join("\n");
      }
    }
  };

  // Listen for external commands
  onMount(() => {
    const handleSearchCommand = (e: CustomEvent<{ pattern?: string }>) => {
      showPanel();
      if (e.detail?.pattern) {
        setSearchQuery({ pattern: e.detail.pattern });
        performSearch();
      }
    };

    const handleReplaceCommand = (
      e: CustomEvent<{ pattern?: string; replace?: string }>
    ) => {
      showPanel();
      setReplaceMode(true);
      if (e.detail?.pattern) {
        setSearchQuery({
          pattern: e.detail.pattern,
          replacePattern: e.detail.replace || "",
        });
      }
    };

    window.addEventListener("command:search", handleSearchCommand as EventListener);
    window.addEventListener(
      "command:search-replace",
      handleReplaceCommand as EventListener
    );

    onCleanup(() => {
      window.removeEventListener(
        "command:search",
        handleSearchCommand as EventListener
      );
      window.removeEventListener(
        "command:search-replace",
        handleReplaceCommand as EventListener
      );
    });
  });

  const validateRegex = async (pattern: string): Promise<{ valid: boolean; error: string | null }> => {
    try {
      const result = await invoke<{ valid: boolean; error: string | null }>("search_validate_regex", { pattern });
      return result;
    } catch (err) {
      return { valid: false, error: String(err) };
    }
  };

  const undoReplace = async (filePath: string): Promise<void> => {
    try {
      await invoke("search_undo_replace", { filePath });
      await refreshSearch();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setState("error", `Undo replace failed: ${errorMessage}`);
      console.error("Undo replace failed:", err);
    }
  };

  const persistHistory = async (): Promise<void> => {
    try {
      const entries = state.searchHistory.map(entry => ({
        id: entry.id,
        pattern: entry.query.pattern,
        timestamp: entry.timestamp,
        isReplace: !!entry.query.replacePattern,
        replacePattern: entry.query.replacePattern || null,
      }));
      await invoke("search_history_save", { entries });
    } catch (err) {
      console.error("Failed to persist search history:", err);
    }
  };

  const loadPersistedHistory = async (): Promise<void> => {
    try {
      const data = await invoke<{
        searchEntries: Array<{ id: string; pattern: string; timestamp: number; isReplace: boolean; replacePattern: string | null }>;
        replaceEntries: Array<{ id: string; pattern: string; timestamp: number; isReplace: boolean; replacePattern: string | null }>;
      }>("search_history_load");
      console.debug("[Search] Loaded persisted history:", data.searchEntries.length, "search,", data.replaceEntries.length, "replace");
    } catch (err) {
      console.error("Failed to load persisted history:", err);
    }
  };

  const performMultiRootSearch = async (roots: string[], query?: Partial<SearchQuery>): Promise<void> => {
    if (query) {
      setSearchQuery(query);
    }

    const currentQuery = state.query;
    if (!currentQuery.pattern.trim()) {
      setState("error", "Search pattern is required");
      return;
    }

    searchCancelToken = new AbortController();
    searchStartTime = Date.now();

    batch(() => {
      setState("isSearching", true);
      setState("error", null);
      setState("results", []);
      setState("progress", {
        filesSearched: 0,
        totalFiles: 0,
        matchesFound: 0,
        currentFile: "",
        isComplete: false,
        wasCancelled: false,
        duration: 0,
      });
    });

    try {
      const searchPattern = buildSearchPattern(currentQuery);
      const allResults: SearchResult[] = [];
      let totalFilesSearched = 0;
      let totalMatchesFound = 0;

      for (const root of roots) {
        if (searchCancelToken?.signal.aborted) break;

        const searchResponse = await invoke<{
          results: Array<{
            file: string;
            matches: Array<{
              line: number;
              column: number;
              text: string;
              matchStart: number;
              matchEnd: number;
            }>;
          }>;
          totalMatches: number;
          filesSearched: number;
        }>("fs_search_content", {
          path: root,
          query: searchPattern,
          caseSensitive: currentQuery.options.caseSensitive,
          regex: currentQuery.options.useRegex || currentQuery.options.patternType === "regex",
          wholeWord: currentQuery.options.wholeWord,
          include: currentQuery.options.includePattern || undefined,
          exclude: currentQuery.options.excludePattern || undefined,
          maxResults: currentQuery.options.maxResults,
        });

        totalFilesSearched += searchResponse.filesSearched;
        totalMatchesFound += searchResponse.totalMatches;

        const processedResults: SearchResult[] = searchResponse.results.map((entry) => {
          const relativePath = entry.file.replace(root + "/", "").replace(root + "\\", "");
          const filename = relativePath.split("/").pop() || relativePath.split("\\").pop() || relativePath;
          const resultId = generateId();
          return {
            id: resultId,
            uri: `file://${entry.file}`,
            path: entry.file,
            relativePath,
            filename,
            matches: entry.matches.map((m) => ({
              id: createMatchId(`file://${entry.file}`, {
                startLine: m.line - 1,
                startColumn: m.matchStart,
                endLine: m.line - 1,
                endColumn: m.matchEnd,
              }),
              range: {
                startLine: m.line - 1,
                startColumn: m.matchStart,
                endLine: m.line - 1,
                endColumn: m.matchEnd,
              },
              matchedText: m.text.slice(m.matchStart, m.matchEnd),
              preview: m.text,
              previewMatchStart: m.matchStart,
              previewMatchLength: m.matchEnd - m.matchStart,
            })),
            totalMatches: entry.matches.length,
            truncated: false,
            isExpanded: true,
            isSelected: true,
          };
        });

        allResults.push(...processedResults);
      }

      const duration = Date.now() - searchStartTime;

      batch(() => {
        setState("results", allResults);
        setState("progress", {
          filesSearched: totalFilesSearched,
          totalFiles: totalFilesSearched,
          matchesFound: totalMatchesFound,
          currentFile: "",
          isComplete: true,
          wasCancelled: false,
          duration,
        });
        setState("isSearching", false);
      });

      setState("stats", (prev) => ({
        ...prev,
        totalSearches: prev.totalSearches + 1,
        averageDuration:
          (prev.averageDuration * prev.totalSearches + duration) /
          (prev.totalSearches + 1),
      }));

      addToHistory(currentQuery);
    } catch (err) {
      if (searchCancelToken?.signal.aborted) {
        setState("progress", (prev) => ({
          ...prev,
          isComplete: true,
          wasCancelled: true,
          duration: Date.now() - searchStartTime,
        }));
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setState("error", errorMessage);
        console.error("Multi-root search failed:", err);
      }
    } finally {
      setState("isSearching", false);
      searchCancelToken = null;
    }
  };

  const replacePreview = async (): Promise<ReplacePreviewResult | null> => {
    const selectedResults = state.results.filter((r) => r.isSelected);
    if (selectedResults.length === 0) return null;

    try {
      const backendResults = selectedResults.map((r) => ({
        uri: r.uri,
        matches: r.matches.map((m) => ({
          id: m.id,
          line: m.range.startLine + 1,
          column: m.range.startColumn,
          length: m.previewMatchLength,
          line_text: m.preview,
          preview: m.preview,
        })),
        totalMatches: r.totalMatches,
      }));

      const preview = await invoke<ReplacePreviewResult>("search_replace_preview", {
        results: backendResults,
        replaceText: state.query.replacePattern,
        useRegex: state.query.options.useRegex,
        preserveCase: state.query.options.caseSensitive,
      });

      setReplacePreviewResults(preview);
      return preview;
    } catch (err) {
      console.error("Failed to get replace preview:", err);
      setState("error", `Preview failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  };

  const previewReplace = async (replaceText?: string) => {
    const replace = replaceText ?? state.query.replacePattern;
    const selectedResults = state.results.filter((r) => r.isSelected);
    if (selectedResults.length === 0) return null;

    try {
      const backendResults = selectedResults.map((r) => ({
        uri: r.uri,
        matches: r.matches.map((m) => ({
          id: m.id,
          line: m.range.startLine + 1,
          column: m.range.startColumn,
          length: m.previewMatchLength,
          line_text: m.preview,
          preview: m.preview,
        })),
        totalMatches: r.totalMatches,
      }));

      const result = await invoke<{
        entries: Array<{
          filePath: string;
          originalLines: string[];
          modifiedLines: string[];
          matchCount: number;
        }>;
        totalReplacements: number;
        totalFiles: number;
      }>("search_replace_preview", {
        results: backendResults,
        replaceText: replace,
        useRegex: state.query.options.useRegex,
        preserveCase: state.query.options.caseSensitive,
      });

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setState("error", `Replace preview failed: ${errorMessage}`);
      console.error("Replace preview failed:", err);
      return null;
    }
  };

  const clearReplacePreview = (): void => {
    setReplacePreviewResults(null);
  };

  const clearPersistedHistory = async (): Promise<void> => {
    try {
      await invoke("search_history_clear");
      clearHistory();
    } catch (err) {
      console.error("Failed to clear persisted history:", err);
    }
  };

  const performStreamingSearch = async (roots: string[], query?: Partial<SearchQuery>): Promise<void> => {
    if (query) setSearchQuery(query);
    const currentQuery = state.query;
    if (!currentQuery.pattern.trim()) {
      setState("error", "Search pattern is required");
      return;
    }

    searchCancelToken = new AbortController();
    searchStartTime = Date.now();

    batch(() => {
      setState("isSearching", true);
      setState("error", null);
      setState("results", []);
      setState("progress", { filesSearched: 0, totalFiles: 0, matchesFound: 0, currentFile: "", isComplete: false, wasCancelled: false, duration: 0 });
    });

    try {
      const searchResponse = await invoke<{
        results: Array<{ file: string; matches: Array<{ line: number; column: number; text: string; matchStart: number; matchEnd: number }> }>;
        totalMatches: number;
        filesSearched: number;
      }>("search_workspace", {
        roots,
        query: buildSearchPattern(currentQuery),
        caseSensitive: currentQuery.options.caseSensitive,
        regex: currentQuery.options.useRegex || currentQuery.options.patternType === "regex",
        wholeWord: currentQuery.options.wholeWord,
        include: currentQuery.options.includePattern || undefined,
        exclude: currentQuery.options.excludePattern || undefined,
        maxResults: currentQuery.options.maxResults,
      });

      const duration = Date.now() - searchStartTime;

      batch(() => {
        setState("progress", {
          filesSearched: searchResponse.filesSearched,
          totalFiles: searchResponse.filesSearched,
          matchesFound: searchResponse.totalMatches,
          currentFile: "",
          isComplete: true,
          wasCancelled: false,
          duration,
        });
        setState("isSearching", false);
      });

      setState("stats", (prev) => ({
        ...prev,
        totalSearches: prev.totalSearches + 1,
        averageDuration: (prev.averageDuration * prev.totalSearches + duration) / (prev.totalSearches + 1),
      }));

      addToHistory(currentQuery);
    } catch (err) {
      if (searchCancelToken?.signal.aborted) {
        setState("progress", (prev) => ({ ...prev, isComplete: true, wasCancelled: true, duration: Date.now() - searchStartTime }));
      } else {
        setState("error", err instanceof Error ? err.message : String(err));
      }
    } finally {
      setState("isSearching", false);
      searchCancelToken = null;
    }
  };

  const searchWithFilters = async (options: {
    paths: string[];
    fileList?: string[];
    multiline?: boolean;
  }): Promise<void> => {
    const currentQuery = state.query;
    if (!currentQuery.pattern.trim()) {
      setState("error", "Search pattern is required");
      return;
    }

    searchCancelToken = new AbortController();
    searchStartTime = Date.now();

    batch(() => {
      setState("isSearching", true);
      setState("error", null);
      setState("results", []);
      setState("progress", {
        filesSearched: 0,
        totalFiles: 0,
        matchesFound: 0,
        currentFile: "",
        isComplete: false,
        wasCancelled: false,
        duration: 0,
      });
    });

    try {
      const searchResponse = await invoke<Array<{
        uri: string;
        matches: Array<{
          id: string;
          line: number;
          column: number;
          length: number;
          lineText: string;
          preview: string;
        }>;
        totalMatches: number;
      }>>("search_with_filters", {
        options: {
          query: currentQuery.pattern,
          paths: options.paths,
          caseSensitive: currentQuery.options.caseSensitive,
          useRegex: currentQuery.options.useRegex,
          wholeWord: currentQuery.options.wholeWord,
          multiline: options.multiline ?? currentQuery.options.multiline,
          includePattern: currentQuery.options.includePattern || null,
          excludePattern: currentQuery.options.excludePattern || null,
          maxResults: currentQuery.options.maxResults,
          fileList: options.fileList ?? null,
        },
      });

      const duration = Date.now() - searchStartTime;

      const processedResults: SearchResult[] = searchResponse.map((entry) => {
        const filePath = entry.uri.replace("file://", "");
        const relativePath = filePath.split("/").slice(-3).join("/");
        const filename = relativePath.split("/").pop() || relativePath;
        const resultId = generateId();
        return {
          id: resultId,
          uri: entry.uri,
          path: filePath,
          relativePath,
          filename,
          matches: entry.matches.map((m) => ({
            id: m.id,
            range: {
              startLine: m.line - 1,
              startColumn: m.column - 1,
              endLine: m.line - 1,
              endColumn: m.column - 1 + m.length,
            },
            matchedText: m.lineText.slice(m.column - 1, m.column - 1 + m.length),
            preview: m.lineText,
            previewMatchStart: m.column - 1,
            previewMatchLength: m.length,
          })),
          totalMatches: entry.totalMatches,
          truncated: false,
          isExpanded: true,
          isSelected: true,
        };
      });

      batch(() => {
        setState("results", processedResults);
        setState("progress", {
          filesSearched: processedResults.length,
          totalFiles: processedResults.length,
          matchesFound: processedResults.reduce((sum, r) => sum + r.totalMatches, 0),
          currentFile: "",
          isComplete: true,
          wasCancelled: false,
          duration,
        });
        setState("isSearching", false);
      });

      addToHistory(currentQuery);
    } catch (err) {
      if (searchCancelToken?.signal.aborted) {
        setState("progress", (prev) => ({
          ...prev,
          isComplete: true,
          wasCancelled: true,
          duration: Date.now() - searchStartTime,
        }));
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setState("error", errorMessage);
      }
    } finally {
      setState("isSearching", false);
      searchCancelToken = null;
    }
  };

  const persistHistoryToBackend = async (): Promise<void> => {
    try {
      for (const entry of state.searchHistory.slice(0, 20)) {
        const persistEntry: SearchHistoryPersistEntry = {
          id: entry.id,
          pattern: entry.query.pattern,
          replacePattern: entry.query.replacePattern || null,
          caseSensitive: entry.query.options.caseSensitive,
          useRegex: entry.query.options.useRegex,
          wholeWord: entry.query.options.wholeWord,
          timestamp: entry.timestamp,
          resultsCount: entry.resultsCount,
        };
        await invoke("add_search_history", { entry: persistEntry });
      }
    } catch (err) {
      console.error("Failed to persist history to backend:", err);
    }
  };

  const loadHistoryFromBackend = async (): Promise<void> => {
    try {
      const entries = await invoke<SearchHistoryPersistEntry[]>("get_search_history");
      console.debug("[Search] Loaded", entries.length, "entries from backend");
    } catch (err) {
      console.error("Failed to load history from backend:", err);
    }
  };

  const deleteHistoryItemFromBackend = async (id: string): Promise<void> => {
    try {
      await invoke("delete_search_history_item", { id });
    } catch (err) {
      console.error("Failed to delete history item from backend:", err);
    }
  };

  const clearHistoryFromBackend = async (): Promise<void> => {
    try {
      await invoke("clear_search_history");
    } catch (err) {
      console.error("Failed to clear history from backend:", err);
    }
  };

  // Context value
  const value: SearchContextValue = {
    state,
    searchQuery,
    searchResults,
    isSearching,
    searchEditors,
    searchHistory,
    searchProgress,
    searchError,
    setSearchQuery,
    setSearchOptions,
    setSearchScope,
    clearQuery,
    performSearch,
    cancelSearch,
    refreshSearch,
    replaceAll,
    replaceInFile,
    replaceMatch,
    toggleReplaceMode,
    setReplaceMode,
    addToHistory,
    clearHistory,
    loadFromHistory,
    removeFromHistory,
    createSearchEditor,
    closeSearchEditor,
    updateSearchEditor,
    toggleSearchEditorPin,
    getSearchEditor,
    toggleResultExpanded,
    toggleResultSelected,
    selectAllResults,
    deselectAllResults,
    expandAllResults,
    collapseAllResults,
    clearResults,
    togglePanel,
    showPanel,
    hidePanel,
    registerTextSearchProvider,
    unregisterTextSearchProvider,
    registerFileSearchProvider,
    unregisterFileSearchProvider,
    setActiveTextSearchProvider,
    setActiveFileSearchProvider,
    getTextSearchProviders,
    getFileSearchProviders,
    getTotalMatchCount,
    getSelectedResultCount,
    getStats,
    exportResults,
    validateRegex,
    undoReplace,
    persistHistory,
    loadPersistedHistory,
    performMultiRootSearch,
    replacePreview,
    replacePreviewResults,
    clearReplacePreview,
    performStreamingSearch,
    persistHistoryToBackend,
    loadHistoryFromBackend,
    deleteHistoryItemFromBackend,
    clearHistoryFromBackend,
    regexError: regexValidationError,
    previewReplace,
    clearPersistedHistory,
    searchWithFilters,
  };

  return (
    <SearchContext.Provider value={value}>
      {props.children}
    </SearchContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useSearch(): SearchContextValue {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return context;
}

/** Hook for search query management */
export function useSearchQuery() {
  const { searchQuery, setSearchQuery, setSearchOptions, setSearchScope, clearQuery } =
    useSearch();
  return {
    query: searchQuery,
    setQuery: setSearchQuery,
    setOptions: setSearchOptions,
    setScope: setSearchScope,
    clear: clearQuery,
  };
}

/** Hook for search results */
export function useSearchResults() {
  const {
    searchResults,
    isSearching,
    searchProgress,
    searchError,
    toggleResultExpanded,
    toggleResultSelected,
    selectAllResults,
    deselectAllResults,
    expandAllResults,
    collapseAllResults,
    clearResults,
    getTotalMatchCount,
    getSelectedResultCount,
  } = useSearch();

  return {
    results: searchResults,
    isSearching,
    progress: searchProgress,
    error: searchError,
    toggleExpanded: toggleResultExpanded,
    toggleSelected: toggleResultSelected,
    selectAll: selectAllResults,
    deselectAll: deselectAllResults,
    expandAll: expandAllResults,
    collapseAll: collapseAllResults,
    clear: clearResults,
    totalMatchCount: getTotalMatchCount,
    selectedResultCount: getSelectedResultCount,
  };
}

/** Hook for search operations */
export function useSearchOperations() {
  const { performSearch, cancelSearch, refreshSearch, replaceAll, replaceInFile, replaceMatch } =
    useSearch();

  return {
    search: performSearch,
    cancel: cancelSearch,
    refresh: refreshSearch,
    replaceAll,
    replaceInFile,
    replaceMatch,
  };
}

/** Hook for search history */
export function useSearchHistory() {
  const { searchHistory, addToHistory, clearHistory, loadFromHistory, removeFromHistory } =
    useSearch();

  return {
    history: searchHistory,
    add: addToHistory,
    clear: clearHistory,
    load: loadFromHistory,
    remove: removeFromHistory,
  };
}

/** Hook for search editors */
export function useSearchEditors() {
  const {
    searchEditors,
    createSearchEditor,
    closeSearchEditor,
    updateSearchEditor,
    toggleSearchEditorPin,
    getSearchEditor,
  } = useSearch();

  return {
    editors: searchEditors,
    create: createSearchEditor,
    close: closeSearchEditor,
    update: updateSearchEditor,
    togglePin: toggleSearchEditorPin,
    get: getSearchEditor,
  };
}

/** Hook for search providers */
export function useSearchProviders() {
  const {
    registerTextSearchProvider,
    unregisterTextSearchProvider,
    registerFileSearchProvider,
    unregisterFileSearchProvider,
    setActiveTextSearchProvider,
    setActiveFileSearchProvider,
    getTextSearchProviders,
    getFileSearchProviders,
  } = useSearch();

  return {
    registerTextProvider: registerTextSearchProvider,
    unregisterTextProvider: unregisterTextSearchProvider,
    registerFileProvider: registerFileSearchProvider,
    unregisterFileProvider: unregisterFileSearchProvider,
    setActiveTextProvider: setActiveTextSearchProvider,
    setActiveFileProvider: setActiveFileSearchProvider,
    getTextProviders: getTextSearchProviders,
    getFileProviders: getFileSearchProviders,
  };
}
