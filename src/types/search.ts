/**
 * Search Types
 *
 * Centralized type definitions for search-related functionality including
 * search editor, text search providers, file search providers, and replace operations.
 */

// ============================================================================
// Common Types (re-exported for convenience)
// ============================================================================

/**
 * Represents a URI reference.
 */
export interface Uri {
  scheme: string;
  authority: string;
  path: string;
  query: string;
  fragment: string;
  fsPath: string;
}

/**
 * Represents a range in an editor (0-based positions).
 */
export interface Range {
  /** 0-based start line */
  startLine: number;
  /** 0-based start column */
  startColumn: number;
  /** 0-based end line */
  endLine: number;
  /** 0-based end column */
  endColumn: number;
}

/**
 * Represents a text edit operation.
 */
export interface TextEdit {
  range: Range;
  newText: string;
}

/**
 * Token for cancellation support.
 */
export interface CancellationToken {
  isCancellationRequested: boolean;
  onCancellationRequested: (callback: () => void) => { dispose: () => void };
}

/**
 * Progress reporter interface.
 */
export interface Progress<T> {
  report(value: T): void;
}

// ============================================================================
// Search Query Types
// ============================================================================

/**
 * Represents a search query with all search options.
 */
export interface SearchQuery {
  /** The search pattern */
  pattern: string;
  /** Whether to use regular expression matching */
  isRegex: boolean;
  /** Whether the search is case sensitive */
  isCaseSensitive: boolean;
  /** Whether to match whole words only */
  isWholeWord: boolean;
  /** Glob pattern for files to include */
  includePattern?: string;
  /** Glob pattern for files to exclude */
  excludePattern?: string;
  /** Whether to enable multi-line regex matching */
  isMultiline?: boolean;
  /** Whether to use ignore files (e.g., .gitignore) */
  useIgnoreFiles?: boolean;
  /** Whether to follow symbolic links */
  followSymlinks?: boolean;
}

// ============================================================================
// Search Match Types
// ============================================================================

/**
 * Represents a single match within a search result.
 */
export interface SearchMatch {
  /** Range of the match in the document */
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  /** Preview of the match with context */
  preview: {
    /** The text containing the match */
    text: string;
    /** Positions of matches within the preview text */
    matches: { start: number; end: number }[];
  };
  /** 1-based line number of the match */
  lineNumber: number;
}

/**
 * Represents all matches within a single file.
 */
export interface SearchResult {
  /** URI of the file */
  uri: string;
  /** All matches in this file */
  matches: SearchMatch[];
  /** Total number of lines in the file */
  lineCount: number;
}

// ============================================================================
// Search Editor Types
// ============================================================================

/**
 * State for a search editor tab.
 */
export interface SearchEditorState {
  /** Unique identifier for this search editor */
  id: string;
  /** The search query configuration */
  query: SearchQuery;
  /** Search results */
  results: SearchResult[];
  /** Whether the search has unsaved changes */
  isDirty: boolean;
  /** Whether the search has been saved to disk */
  isPersisted: boolean;
}

// ============================================================================
// Search History Types
// ============================================================================

/**
 * Represents an entry in the search history.
 */
export interface SearchHistoryEntry {
  /** The search query that was executed */
  query: SearchQuery;
  /** Unix timestamp when the search was executed */
  timestamp: number;
  /** Number of results returned */
  resultCount: number;
}

// ============================================================================
// Multi-line Search Types
// ============================================================================

/**
 * State for multi-line search mode.
 */
export interface MultiLineSearchState {
  /** Whether multi-line mode is enabled */
  enabled: boolean;
  /** The multi-line regex pattern */
  pattern: string;
  /** Regex flags (e.g., "gms") */
  flags: string;
}

// ============================================================================
// Text Search Provider API Types
// ============================================================================

/**
 * Query parameters for text search.
 */
export interface TextSearchQuery {
  /** The search pattern */
  pattern: string;
  /** Whether to use regular expression matching */
  isRegExp?: boolean;
  /** Whether the search is case sensitive */
  isCaseSensitive?: boolean;
  /** Whether to match whole words only */
  isWordMatch?: boolean;
  /** Whether to enable multi-line matching */
  isMultiline?: boolean;
}

/**
 * Options for text search operations.
 */
export interface TextSearchOptions {
  /** The folder to search in */
  folder: Uri;
  /** Glob patterns for files to include */
  includes: string[];
  /** Glob patterns for files to exclude */
  excludes: string[];
  /** Maximum number of results to return */
  maxResults?: number;
  /** Options for generating previews */
  previewOptions?: {
    /** Number of lines to include in the preview */
    matchLines: number;
    /** Maximum characters per line in the preview */
    charsPerLine: number;
  };
  /** Number of lines of context to include before each match */
  beforeContext?: number;
  /** Number of lines of context to include after each match */
  afterContext?: number;
}

/**
 * A single text search result.
 */
export interface TextSearchResult {
  /** URI of the file containing the match */
  uri: Uri;
  /** Range(s) of the match in the document */
  ranges: Range | Range[];
  /** Preview of the match with highlighting info */
  preview: {
    /** The preview text */
    text: string;
    /** Range(s) of matches within the preview */
    matches: Range | Range[];
  };
}

/**
 * Completion status of a text search operation.
 */
export interface TextSearchComplete {
  /** Whether the search was limited by maxResults */
  limitHit?: boolean;
  /** Optional message about the search (e.g., warnings) */
  message?: string;
}

/**
 * Interface for text search providers.
 */
export interface TextSearchProvider {
  /**
   * Provide text search results.
   * @param query The search query
   * @param options Search options
   * @param progress Progress reporter for streaming results
   * @param token Cancellation token
   * @returns Promise resolving to search completion status
   */
  provideTextSearchResults(
    query: TextSearchQuery,
    options: TextSearchOptions,
    progress: Progress<TextSearchResult>,
    token: CancellationToken
  ): Promise<TextSearchComplete>;
}

// ============================================================================
// File Search Provider API Types
// ============================================================================

/**
 * Query parameters for file search.
 */
export interface FileSearchQuery {
  /** The file name pattern to search for */
  pattern: string;
}

/**
 * Options for file search operations.
 */
export interface FileSearchOptions {
  /** The folder to search in */
  folder: Uri;
  /** Glob patterns for files to include */
  includes: string[];
  /** Glob patterns for files to exclude */
  excludes: string[];
  /** Maximum number of results to return */
  maxResults?: number;
}

/**
 * Interface for file search providers.
 */
export interface FileSearchProvider {
  /**
   * Provide file search results.
   * @param query The file search query
   * @param options Search options
   * @param token Cancellation token
   * @returns Promise resolving to an array of matching file URIs
   */
  provideFileSearchResults(
    query: FileSearchQuery,
    options: FileSearchOptions,
    token: CancellationToken
  ): Promise<Uri[]>;
}

// ============================================================================
// Search Decoration Types
// ============================================================================

/**
 * Decoration information for search results in a file.
 */
export interface SearchDecoration {
  /** URI of the file */
  uri: string;
  /** Number of matches in the file */
  matchCount: number;
  /** Ranges to highlight in the file */
  highlightRanges: Range[];
}

// ============================================================================
// Replace Types
// ============================================================================

/**
 * Result of a replace operation for a single file.
 */
export interface ReplaceResult {
  /** URI of the file */
  uri: string;
  /** Text edits to apply */
  edits: TextEdit[];
  /** Whether to preserve case during replacement */
  preserveCase: boolean;
}


