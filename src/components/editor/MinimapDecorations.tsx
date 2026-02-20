/**
 * Minimap Decorations Component
 * 
 * Shows decorations in the Monaco editor minimap and overview ruler:
 * 1. Diagnostic errors (red marks)
 * 2. Diagnostic warnings (yellow marks)
 * 3. Search results (orange marks)
 * 4. Git changes (green/blue/red marks)
 * 5. Bookmarks (blue marks)
 * 
 * Integrates with:
 * - DiagnosticsContext for errors/warnings
 * - BufferSearch for search matches
 * - GitGutterDecorations for git changes
 * - BookmarksContext for bookmark marks
 */

import { createEffect, onCleanup, createSignal } from "solid-js";
import { useDiagnostics } from "@/context/DiagnosticsContext";
import type * as Monaco from "monaco-editor";

// ============================================================================
// Types
// ============================================================================

export interface MinimapDecorationsProps {
  /** Monaco editor instance */
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  /** Monaco namespace */
  monaco: typeof Monaco | null;
  /** Current file URI (file:// format) */
  fileUri: string | null;
  /** Enable diagnostic decorations */
  showDiagnostics?: boolean;
  /** Enable search result decorations */
  showSearchResults?: boolean;
  /** Enable git change decorations */
  showGitChanges?: boolean;
  /** Enable bookmark decorations */
  showBookmarks?: boolean;
}

/** Decoration category for tracking */
type DecorationCategory = "diagnostic" | "search" | "git" | "bookmark" | "selection";

/** Search match from BufferSearch */
interface SearchMatch {
  line: number;
  start: number;
  end: number;
}

/** Bookmark from BookmarksContext */
interface Bookmark {
  id: string;
  line: number;
  label?: string;
}

// ============================================================================
// Colors
// ============================================================================

/** Colors for minimap/overview ruler decorations */
const DECORATION_COLORS = {
  // Diagnostics
  error: "rgba(255, 0, 0, 0.7)",           // Red
  errorMinimap: "rgba(255, 0, 0, 0.8)",
  warning: "rgba(255, 204, 0, 0.7)",       // Yellow/Orange
  warningMinimap: "rgba(255, 204, 0, 0.8)",
  information: "rgba(0, 122, 204, 0.6)",   // Blue
  informationMinimap: "rgba(0, 122, 204, 0.7)",
  hint: "rgba(128, 128, 128, 0.5)",        // Gray
  hintMinimap: "rgba(128, 128, 128, 0.6)",
  
  // Search
  searchMatch: "rgba(255, 165, 0, 0.7)",   // Orange
  searchMatchMinimap: "rgba(255, 165, 0, 0.8)",
  currentMatch: "rgba(255, 215, 0, 0.9)",  // Gold for current match
  currentMatchMinimap: "rgba(255, 215, 0, 1.0)",
  
  // Git changes
  gitAdded: "rgba(78, 201, 176, 0.7)",     // Green
  gitAddedMinimap: "rgba(78, 201, 176, 0.8)",
  gitModified: "rgba(86, 156, 214, 0.7)",  // Blue
  gitModifiedMinimap: "rgba(86, 156, 214, 0.8)",
  gitDeleted: "rgba(241, 76, 76, 0.7)",    // Red
  gitDeletedMinimap: "rgba(241, 76, 76, 0.8)",
  
  // Bookmarks
  bookmark: "rgba(100, 149, 237, 0.7)",    // Cornflower blue
  bookmarkMinimap: "rgba(100, 149, 237, 0.8)",
  
  // Selection
  selection: "rgba(173, 214, 255, 0.3)",
  selectionMinimap: "rgba(173, 214, 255, 0.4)",
} as const;

// ============================================================================
// Decoration Management
// ============================================================================

/** Track decorations by category for efficient updates */
interface DecorationState {
  diagnostic: string[];
  search: string[];
  git: string[];
  bookmark: string[];
  selection: string[];
}

/**
 * Create a minimap/overview ruler decoration for diagnostics
 */
function createDiagnosticDecoration(
  lineNumber: number,
  severity: "error" | "warning" | "information" | "hint",
  monaco: typeof Monaco
): Monaco.editor.IModelDeltaDecoration {
  const colors = {
    error: { ruler: DECORATION_COLORS.error, minimap: DECORATION_COLORS.errorMinimap },
    warning: { ruler: DECORATION_COLORS.warning, minimap: DECORATION_COLORS.warningMinimap },
    information: { ruler: DECORATION_COLORS.information, minimap: DECORATION_COLORS.informationMinimap },
    hint: { ruler: DECORATION_COLORS.hint, minimap: DECORATION_COLORS.hintMinimap },
  };
  
  const rulerLane = {
    error: monaco.editor.OverviewRulerLane.Right,
    warning: monaco.editor.OverviewRulerLane.Right,
    information: monaco.editor.OverviewRulerLane.Center,
    hint: monaco.editor.OverviewRulerLane.Left,
  };

  return {
    range: new monaco.Range(lineNumber, 1, lineNumber, 1),
    options: {
      overviewRuler: {
        color: colors[severity].ruler,
        position: rulerLane[severity],
      },
      minimap: {
        color: colors[severity].minimap,
        position: monaco.editor.MinimapPosition.Inline,
      },
    },
  };
}

/**
 * Create a minimap/overview ruler decoration for search matches
 */
function createSearchDecoration(
  lineNumber: number,
  startColumn: number,
  endColumn: number,
  isCurrent: boolean,
  monaco: typeof Monaco
): Monaco.editor.IModelDeltaDecoration {
  const color = isCurrent ? DECORATION_COLORS.currentMatch : DECORATION_COLORS.searchMatch;
  const minimapColor = isCurrent ? DECORATION_COLORS.currentMatchMinimap : DECORATION_COLORS.searchMatchMinimap;
  
  return {
    range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
    options: {
      overviewRuler: {
        color,
        position: monaco.editor.OverviewRulerLane.Center,
      },
      minimap: {
        color: minimapColor,
        position: monaco.editor.MinimapPosition.Inline,
      },
    },
  };
}

/**
 * Create a minimap/overview ruler decoration for git changes
 */
function createGitDecoration(
  startLine: number,
  endLine: number,
  changeType: "added" | "modified" | "deleted",
  monaco: typeof Monaco
): Monaco.editor.IModelDeltaDecoration {
  const colors = {
    added: { ruler: DECORATION_COLORS.gitAdded, minimap: DECORATION_COLORS.gitAddedMinimap },
    modified: { ruler: DECORATION_COLORS.gitModified, minimap: DECORATION_COLORS.gitModifiedMinimap },
    deleted: { ruler: DECORATION_COLORS.gitDeleted, minimap: DECORATION_COLORS.gitDeletedMinimap },
  };
  
  return {
    range: new monaco.Range(startLine, 1, endLine, 1),
    options: {
      overviewRuler: {
        color: colors[changeType].ruler,
        position: monaco.editor.OverviewRulerLane.Left,
      },
      minimap: {
        color: colors[changeType].minimap,
        position: monaco.editor.MinimapPosition.Gutter,
      },
    },
  };
}

/**
 * Create a minimap/overview ruler decoration for bookmarks
 */
function createBookmarkDecoration(
  lineNumber: number,
  monaco: typeof Monaco
): Monaco.editor.IModelDeltaDecoration {
  return {
    range: new monaco.Range(lineNumber, 1, lineNumber, 1),
    options: {
      overviewRuler: {
        color: DECORATION_COLORS.bookmark,
        position: monaco.editor.OverviewRulerLane.Full,
      },
      minimap: {
        color: DECORATION_COLORS.bookmarkMinimap,
        position: monaco.editor.MinimapPosition.Gutter,
      },
    },
  };
}

/**
 * Create a minimap/overview ruler decoration for selections
 */
function createSelectionDecoration(
  startLine: number,
  endLine: number,
  monaco: typeof Monaco
): Monaco.editor.IModelDeltaDecoration {
  return {
    range: new monaco.Range(startLine, 1, endLine, 1),
    options: {
      overviewRuler: {
        color: DECORATION_COLORS.selection,
        position: monaco.editor.OverviewRulerLane.Full,
      },
      minimap: {
        color: DECORATION_COLORS.selectionMinimap,
        position: monaco.editor.MinimapPosition.Inline,
      },
    },
  };
}

// ============================================================================
// Component
// ============================================================================

/**
 * MinimapDecorations Component
 * 
 * Manages minimap and overview ruler decorations for various editor features.
 * This is a headless component that doesn't render anything - it only
 * manages Monaco decorations.
 */
export function MinimapDecorations(props: MinimapDecorationsProps) {
  const diagnostics = useDiagnostics();
  
  // Track decoration IDs by category
  const [decorationState, setDecorationState] = createSignal<DecorationState>({
    diagnostic: [],
    search: [],
    git: [],
    bookmark: [],
    selection: [],
  });
  
  // Track current search matches from BufferSearch
  const [searchMatches, setSearchMatches] = createSignal<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = createSignal(-1);
  
  // Track bookmarks from event
  const [bookmarks, setBookmarks] = createSignal<Bookmark[]>([]);
  
  // Default settings
  const showDiagnostics = () => props.showDiagnostics ?? true;
  const showSearchResults = () => props.showSearchResults ?? true;
  const showGitChanges = () => props.showGitChanges ?? true;
  const showBookmarks = () => props.showBookmarks ?? true;
  
  /**
   * Update decorations for a specific category
   */
  const updateCategoryDecorations = (
    category: DecorationCategory,
    decorations: Monaco.editor.IModelDeltaDecoration[]
  ) => {
    const editor = props.editor;
    if (!editor) return;
    
    const currentState = decorationState();
    const oldIds = currentState[category];
    
    // Apply new decorations and get new IDs
    const newIds = editor.deltaDecorations(oldIds, decorations);
    
    // Update state
    setDecorationState((prev) => ({
      ...prev,
      [category]: newIds,
    }));
  };
  
  /**
   * Clear all decorations for a category
   */
  const clearCategoryDecorations = (category: DecorationCategory) => {
    updateCategoryDecorations(category, []);
  };
  
  /**
   * Clear all minimap decorations
   */
  const clearAllDecorations = () => {
    const editor = props.editor;
    if (!editor) return;
    
    const currentState = decorationState();
    const allIds = [
      ...currentState.diagnostic,
      ...currentState.search,
      ...currentState.git,
      ...currentState.bookmark,
      ...currentState.selection,
    ];
    
    editor.deltaDecorations(allIds, []);
    
    setDecorationState({
      diagnostic: [],
      search: [],
      git: [],
      bookmark: [],
      selection: [],
    });
  };
  
  // ============================================================================
  // Diagnostic Decorations
  // ============================================================================
  
  createEffect(() => {
    const editor = props.editor;
    const monaco = props.monaco;
    const fileUri = props.fileUri;
    
    if (!editor || !monaco || !fileUri || !showDiagnostics()) {
      clearCategoryDecorations("diagnostic");
      return;
    }
    
    // Get diagnostics for the current file
    const fileDiagnostics = diagnostics.getDiagnosticsForFile(fileUri);
    
    // Create decorations
    const decorations: Monaco.editor.IModelDeltaDecoration[] = [];
    
    // Use a Set to track lines already decorated to avoid overlapping
    const decoratedLines = new Set<string>();
    
    for (const diag of fileDiagnostics) {
      const lineNumber = diag.range.start.line + 1; // Convert 0-based to 1-based
      const key = `${lineNumber}-${diag.severity}`;
      
      if (!decoratedLines.has(key)) {
        decoratedLines.add(key);
        decorations.push(
          createDiagnosticDecoration(lineNumber, diag.severity, monaco)
        );
      }
    }
    
    updateCategoryDecorations("diagnostic", decorations);
  });
  
  // ============================================================================
  // Search Result Decorations
  // ============================================================================
  
  // Listen for search highlights from BufferSearch
  createEffect(() => {
    const handleSearchHighlights = (e: CustomEvent<{
      matches: SearchMatch[];
      currentIndex: number;
    }>) => {
      setSearchMatches(e.detail.matches);
      setCurrentMatchIndex(e.detail.currentIndex);
    };
    
    window.addEventListener(
      "buffer-search-highlights",
      handleSearchHighlights as EventListener
    );
    
    onCleanup(() => {
      window.removeEventListener(
        "buffer-search-highlights",
        handleSearchHighlights as EventListener
      );
    });
  });
  
  // Update search decorations when matches change
  createEffect(() => {
    const editor = props.editor;
    const monaco = props.monaco;
    
    if (!editor || !monaco || !showSearchResults()) {
      clearCategoryDecorations("search");
      return;
    }
    
    const matches = searchMatches();
    const currentIndex = currentMatchIndex();
    
    if (matches.length === 0) {
      clearCategoryDecorations("search");
      return;
    }
    
    // Create decorations for each match
    const decorations: Monaco.editor.IModelDeltaDecoration[] = matches.map(
      (match, index) =>
        createSearchDecoration(
          match.line,
          match.start,
          match.end,
          index === currentIndex,
          monaco
        )
    );
    
    updateCategoryDecorations("search", decorations);
  });
  
  // Clear search decorations when search is closed
  createEffect(() => {
    const handleSearchClose = () => {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      clearCategoryDecorations("search");
    };
    
    window.addEventListener("buffer-search:closed", handleSearchClose);
    
    onCleanup(() => {
      window.removeEventListener("buffer-search:closed", handleSearchClose);
    });
  });
  
  // ============================================================================
  // Git Change Decorations
  // ============================================================================
  
  // Listen for git changes from GitGutterDecorations
  createEffect(() => {
    const editor = props.editor;
    const monaco = props.monaco;
    const fileUri = props.fileUri;
    
    if (!editor || !monaco || !fileUri || !showGitChanges()) {
      clearCategoryDecorations("git");
      return;
    }
    
    const handleGitChanges = (e: CustomEvent<{
      changes: Array<{
        type: "added" | "modified" | "deleted";
        startLine: number;
        endLine: number;
      }>;
    }>) => {
      if (!props.monaco) return;
      
      const decorations: Monaco.editor.IModelDeltaDecoration[] = e.detail.changes.map(
        (change) =>
          createGitDecoration(change.startLine, change.endLine, change.type, props.monaco!)
      );
      
      updateCategoryDecorations("git", decorations);
    };
    
    window.addEventListener("git-gutter:changes", handleGitChanges as EventListener);
    
    onCleanup(() => {
      window.removeEventListener("git-gutter:changes", handleGitChanges as EventListener);
    });
  });
  
  // ============================================================================
  // Bookmark Decorations
  // ============================================================================
  
  // Listen for bookmark changes from BookmarksContext
  createEffect(() => {
    const handleBookmarksChanged = (e: CustomEvent<{
      bookmarks: Bookmark[];
      fileUri: string;
    }>) => {
      if (e.detail.fileUri === props.fileUri) {
        setBookmarks(e.detail.bookmarks);
      }
    };
    
    window.addEventListener("bookmarks:changed", handleBookmarksChanged as EventListener);
    
    onCleanup(() => {
      window.removeEventListener("bookmarks:changed", handleBookmarksChanged as EventListener);
    });
  });
  
  // Update bookmark decorations when bookmarks change
  createEffect(() => {
    const editor = props.editor;
    const monaco = props.monaco;
    
    if (!editor || !monaco || !showBookmarks()) {
      clearCategoryDecorations("bookmark");
      return;
    }
    
    const currentBookmarks = bookmarks();
    
    if (currentBookmarks.length === 0) {
      clearCategoryDecorations("bookmark");
      return;
    }
    
    const decorations: Monaco.editor.IModelDeltaDecoration[] = currentBookmarks.map(
      (bookmark) => createBookmarkDecoration(bookmark.line, monaco)
    );
    
    updateCategoryDecorations("bookmark", decorations);
  });
  
  // ============================================================================
  // Selection Decorations
  // ============================================================================
  
  createEffect(() => {
    const editor = props.editor;
    const monaco = props.monaco;
    
    if (!editor || !monaco) {
      clearCategoryDecorations("selection");
      return;
    }
    
    const selectionDisposable = editor.onDidChangeCursorSelection(() => {
      if (!props.editor || !props.monaco) return;
      const selections = props.editor.getSelections();
      if (!selections || selections.length === 0) {
        updateCategoryDecorations("selection", []);
        return;
      }
      const selectionDecorations: Monaco.editor.IModelDeltaDecoration[] = [];
      for (const sel of selections) {
        if (!sel.isEmpty()) {
          selectionDecorations.push(
            createSelectionDecoration(sel.startLineNumber, sel.endLineNumber, props.monaco!)
          );
        }
      }
      updateCategoryDecorations("selection", selectionDecorations);
    });
    
    onCleanup(() => selectionDisposable.dispose());
  });
  
  // ============================================================================
  // Viewport Position Indicator
  // ============================================================================
  
  createEffect(() => {
    const editor = props.editor;
    
    if (!editor) return;
    
    // The minimap slider already handles viewport position natively in Monaco
    // No additional decorations needed for viewport position
    const viewportDisposable = editor.onDidScrollChange(() => {});
    
    onCleanup(() => viewportDisposable.dispose());
  });
  
  // ============================================================================
  // Cleanup
  // ============================================================================
  
  // Clear all decorations when editor, file, or component changes
  createEffect(() => {
    // Track these for reactivity
    void props.editor;
    void props.fileUri;
    
    // Cleanup when file changes
    return () => {
      clearAllDecorations();
    };
  });
  
  // Cleanup on unmount
  onCleanup(() => {
    clearAllDecorations();
  });
  
  // This is a headless component - doesn't render anything
  return null;
}

// ============================================================================
// Utility Hook for Custom Decorations
// ============================================================================

/**
 * Hook to add custom minimap decorations from external components.
 * Returns functions to add and clear decorations.
 */
export function useMinimapDecorations(
  editor: () => Monaco.editor.IStandaloneCodeEditor | null,
  _monaco: () => typeof Monaco | null
) {
  const [decorationIds, setDecorationIds] = createSignal<string[]>([]);
  
  const addDecorations = (decorations: Monaco.editor.IModelDeltaDecoration[]) => {
    const editorInstance = editor();
    if (!editorInstance) return;
    
    const oldIds = decorationIds();
    const newIds = editorInstance.deltaDecorations(oldIds, decorations);
    setDecorationIds(newIds);
  };
  
  const clearDecorations = () => {
    const editorInstance = editor();
    if (!editorInstance) return;
    
    const oldIds = decorationIds();
    editorInstance.deltaDecorations(oldIds, []);
    setDecorationIds([]);
  };
  
  onCleanup(() => {
    clearDecorations();
  });
  
  return {
    addDecorations,
    clearDecorations,
    createDiagnosticDecoration,
    createSearchDecoration,
    createGitDecoration,
    createBookmarkDecoration,
    createSelectionDecoration,
  };
}

export default MinimapDecorations;
