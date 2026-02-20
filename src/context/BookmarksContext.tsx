/**
 * Bookmarks Context
 * 
 * Provides a system for managing bookmarks in the editor:
 * - Toggle bookmarks at specific file/line locations
 * - Navigate between bookmarks (next/previous)
 * - Persist bookmarks to localStorage
 * - List all bookmarks in a panel
 */

import {
  createContext,
  useContext,
  createSignal,
  createEffect,
  onMount,
  onCleanup,
  JSX,
  Accessor,
} from "solid-js";
import { useEditor } from "./EditorContext";

// ============================================================================
// Types
// ============================================================================

export interface Bookmark {
  id: string;
  filePath: string;
  line: number;
  column?: number;
  label?: string;
  createdAt: number;
}

interface BookmarksContextValue {
  /** All bookmarks */
  bookmarks: Accessor<Bookmark[]>;
  /** Toggle bookmark at current cursor position */
  toggleBookmark: (filePath: string, line: number, column?: number) => void;
  /** Toggle bookmark at current cursor position using editor state */
  toggleBookmarkAtCursor: () => void;
  /** Navigate to next bookmark */
  goToNextBookmark: () => void;
  /** Navigate to previous bookmark */
  goToPrevBookmark: () => void;
  /** Remove a specific bookmark by id */
  removeBookmark: (id: string) => void;
  /** Clear all bookmarks */
  clearAllBookmarks: () => void;
  /** Get bookmarks for a specific file */
  getBookmarksForFile: (filePath: string) => Bookmark[];
  /** Update a bookmark's label */
  updateBookmarkLabel: (id: string, label: string) => void;
  /** Navigate to a specific bookmark */
  navigateToBookmark: (bookmark: Bookmark) => void;
  /** Show bookmarks panel */
  showBookmarksPanel: () => void;
  /** Whether bookmarks panel is visible */
  isBookmarksPanelVisible: Accessor<boolean>;
  /** Set bookmarks panel visibility */
  setBookmarksPanelVisible: (visible: boolean) => void;
}

const BookmarksContext = createContext<BookmarksContextValue>();

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "cortex_bookmarks";

// ============================================================================
// Provider
// ============================================================================

export function BookmarksProvider(props: { children: JSX.Element }) {
  const editor = useEditor();
  const [bookmarks, setBookmarks] = createSignal<Bookmark[]>([]);
  const [isBookmarksPanelVisible, setBookmarksPanelVisible] = createSignal(false);
  
  // Current cursor position (tracked via events)
  const [currentLine, setCurrentLine] = createSignal(1);
  const [currentColumn, setCurrentColumn] = createSignal(1);

  // Load bookmarks from localStorage on mount
  onMount(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate structure
        if (Array.isArray(parsed)) {
          setBookmarks(parsed.filter(isValidBookmark));
        }
      }
    } catch (e) {
      console.error("[Bookmarks] Failed to load bookmarks from localStorage:", e);
    }
  });

  // Save bookmarks to localStorage when they change
  createEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks()));
    } catch (e) {
      console.error("[Bookmarks] Failed to save bookmarks to localStorage:", e);
    }
  });

  // Dispatch bookmarks:changed event for minimap decorations
  createEffect(() => {
    const currentBookmarks = bookmarks();
    const activeFile = editor.state.openFiles.find(
      (f) => f.id === editor.state.activeFileId
    );
    const activeFilePath = activeFile?.path;

    if (activeFilePath) {
      const fileBookmarks = currentBookmarks
        .filter((b) => b.filePath === activeFilePath)
        .map((b) => ({ id: b.id, line: b.line, label: b.label }));

      window.dispatchEvent(
        new CustomEvent("bookmarks:changed", {
          detail: {
            bookmarks: fileBookmarks,
            fileUri: `file://${activeFilePath.replace(/\\/g, "/")}`,
          },
        })
      );
    }
  });

  // Listen for cursor position changes
  onMount(() => {
    const handleCursorChange = (e: CustomEvent<{ line: number; column: number }>) => {
      setCurrentLine(e.detail.line);
      setCurrentColumn(e.detail.column);
    };

    window.addEventListener("editor-cursor-change", handleCursorChange as EventListener);
    
    onCleanup(() => {
      window.removeEventListener("editor-cursor-change", handleCursorChange as EventListener);
    });
  });

  // Listen for bookmark events from keyboard shortcuts
  onMount(() => {
    const handleToggleBookmark = () => {
      toggleBookmarkAtCursor();
    };

    const handleNextBookmark = () => {
      goToNextBookmark();
    };

    const handlePrevBookmark = () => {
      goToPrevBookmark();
    };

    const handleShowPanel = () => {
      showBookmarksPanel();
    };

    const handleClearAll = () => {
      clearAllBookmarks();
    };

    window.addEventListener("bookmarks:toggle", handleToggleBookmark);
    window.addEventListener("bookmarks:next", handleNextBookmark);
    window.addEventListener("bookmarks:prev", handlePrevBookmark);
    window.addEventListener("bookmarks:show-panel", handleShowPanel);
    window.addEventListener("bookmarks:clear-all", handleClearAll);

    onCleanup(() => {
      window.removeEventListener("bookmarks:toggle", handleToggleBookmark);
      window.removeEventListener("bookmarks:next", handleNextBookmark);
      window.removeEventListener("bookmarks:prev", handlePrevBookmark);
      window.removeEventListener("bookmarks:show-panel", handleShowPanel);
      window.removeEventListener("bookmarks:clear-all", handleClearAll);
    });
  });

  /**
   * Validate that an object is a valid Bookmark
   */
  function isValidBookmark(obj: unknown): obj is Bookmark {
    if (typeof obj !== "object" || obj === null) return false;
    const b = obj as Record<string, unknown>;
    return (
      typeof b.id === "string" &&
      typeof b.filePath === "string" &&
      typeof b.line === "number" &&
      typeof b.createdAt === "number"
    );
  }

  /**
   * Get current file path from editor state
   */
  const getCurrentFilePath = (): string | null => {
    const activeFile = editor.state.openFiles.find(
      (f) => f.id === editor.state.activeFileId
    );
    return activeFile?.path || null;
  };

  /**
   * Toggle a bookmark at a specific file and line
   */
  const toggleBookmark = (filePath: string, line: number, column?: number) => {
    const existing = bookmarks().find(
      (b) => b.filePath === filePath && b.line === line
    );

    if (existing) {
      // Remove existing bookmark
      setBookmarks((bs) => bs.filter((b) => b.id !== existing.id));
    } else {
      // Add new bookmark
      const newBookmark: Bookmark = {
        id: crypto.randomUUID(),
        filePath,
        line,
        column,
        createdAt: Date.now(),
      };
      setBookmarks((bs) => [...bs, newBookmark]);
    }
  };

  /**
   * Toggle bookmark at current cursor position
   */
  const toggleBookmarkAtCursor = () => {
    const filePath = getCurrentFilePath();
    if (!filePath) {
      console.warn("[Bookmarks] No active file to toggle bookmark");
      return;
    }
    toggleBookmark(filePath, currentLine(), currentColumn());
  };

  /**
   * Navigate to a specific bookmark
   */
  const navigateToBookmark = (bookmark: Bookmark) => {
    // Open file if not already open
    editor.openFile(bookmark.filePath);

    // Dispatch navigation event for the editor to handle
    window.dispatchEvent(
      new CustomEvent("editor:navigate-to", {
        detail: {
          filePath: bookmark.filePath,
          line: bookmark.line,
          column: bookmark.column || 1,
        },
      })
    );

    // Also dispatch outline:navigate for compatibility
    window.dispatchEvent(
      new CustomEvent("outline:navigate", {
        detail: {
          line: bookmark.line,
          column: bookmark.column || 1,
        },
      })
    );
  };

  /**
   * Navigate to the next bookmark
   */
  const goToNextBookmark = () => {
    const allBookmarks = bookmarks();
    if (allBookmarks.length === 0) return;

    const currentFile = getCurrentFilePath();
    const line = currentLine();

    // Sort bookmarks by file path and line
    const sorted = [...allBookmarks].sort((a, b) => {
      if (a.filePath !== b.filePath) {
        return a.filePath.localeCompare(b.filePath);
      }
      return a.line - b.line;
    });

    // Find next bookmark after current position
    let nextBookmark = sorted.find((b) => {
      if (!currentFile) return true;
      if (b.filePath > currentFile) return true;
      if (b.filePath === currentFile && b.line > line) return true;
      return false;
    });

    // Wrap around to first bookmark if no next found
    if (!nextBookmark) {
      nextBookmark = sorted[0];
    }

    if (nextBookmark) {
      navigateToBookmark(nextBookmark);
    }
  };

  /**
   * Navigate to the previous bookmark
   */
  const goToPrevBookmark = () => {
    const allBookmarks = bookmarks();
    if (allBookmarks.length === 0) return;

    const currentFile = getCurrentFilePath();
    const line = currentLine();

    // Sort bookmarks by file path and line (descending)
    const sorted = [...allBookmarks].sort((a, b) => {
      if (a.filePath !== b.filePath) {
        return b.filePath.localeCompare(a.filePath);
      }
      return b.line - a.line;
    });

    // Find previous bookmark before current position
    let prevBookmark = sorted.find((b) => {
      if (!currentFile) return true;
      if (b.filePath < currentFile) return true;
      if (b.filePath === currentFile && b.line < line) return true;
      return false;
    });

    // Wrap around to last bookmark if no previous found
    if (!prevBookmark) {
      prevBookmark = sorted[0];
    }

    if (prevBookmark) {
      navigateToBookmark(prevBookmark);
    }
  };

  /**
   * Remove a bookmark by id
   */
  const removeBookmark = (id: string) => {
    setBookmarks((bs) => bs.filter((b) => b.id !== id));
  };

  /**
   * Clear all bookmarks
   */
  const clearAllBookmarks = () => {
    setBookmarks([]);
  };

  /**
   * Get bookmarks for a specific file
   */
  const getBookmarksForFile = (filePath: string): Bookmark[] => {
    return bookmarks().filter((b) => b.filePath === filePath);
  };

  /**
   * Update a bookmark's label
   */
  const updateBookmarkLabel = (id: string, label: string) => {
    setBookmarks((bs) =>
      bs.map((b) => (b.id === id ? { ...b, label } : b))
    );
  };

  /**
   * Show bookmarks panel
   */
  const showBookmarksPanel = () => {
    setBookmarksPanelVisible(true);
    window.dispatchEvent(new CustomEvent("bookmarks:panel-opened"));
  };

  const value: BookmarksContextValue = {
    bookmarks,
    toggleBookmark,
    toggleBookmarkAtCursor,
    goToNextBookmark,
    goToPrevBookmark,
    removeBookmark,
    clearAllBookmarks,
    getBookmarksForFile,
    updateBookmarkLabel,
    navigateToBookmark,
    showBookmarksPanel,
    isBookmarksPanelVisible,
    setBookmarksPanelVisible,
  };

  return (
    <BookmarksContext.Provider value={value}>
      {props.children}
    </BookmarksContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useBookmarks() {
  const context = useContext(BookmarksContext);
  if (!context) {
    throw new Error("useBookmarks must be used within a BookmarksProvider");
  }
  return context;
}
