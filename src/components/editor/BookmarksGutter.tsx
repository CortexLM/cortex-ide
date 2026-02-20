/**
 * Bookmarks Gutter Decorations
 * 
 * Shows bookmark markers in the editor gutter:
 * - Blue bookmark icon for bookmarked lines
 * - Click to toggle bookmark
 * - Hover shows bookmark label if set
 * 
 * Features:
 * - Click gutter to toggle bookmark
 * - Overview ruler indicators
 * - Minimap markers
 */

import { createEffect, onCleanup } from "solid-js";
import { useBookmarks, Bookmark } from "@/context/BookmarksContext";
import type * as Monaco from "monaco-editor";

// ============================================================================
// Types
// ============================================================================

export interface BookmarksGutterProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  /** Absolute file path */
  filePath: string | null;
}

// ============================================================================
// Decoration Constants
// ============================================================================

const BOOKMARK_COLOR = "var(--cortex-info)";  // Blue
const GUTTER_CLASS = "bookmark-gutter-marker";

// ============================================================================
// CSS Injection
// ============================================================================

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement("style");
  style.id = "bookmark-gutter-styles";
  style.textContent = `
    .${GUTTER_CLASS} {
      background: ${BOOKMARK_COLOR};
      width: 4px !important;
      margin-left: 3px;
      border-radius: var(--cortex-radius-sm);
      cursor: pointer;
    }
    .${GUTTER_CLASS}:hover {
      background: var(--cortex-info);
    }
    .bookmark-gutter-clickable {
      cursor: pointer;
    }
  `;

  if (!document.getElementById("bookmark-gutter-styles")) {
    document.head.appendChild(style);
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * BookmarksGutter component
 * 
 * Manages bookmark decorations in the Monaco editor gutter.
 * Updates decorations when bookmarks change.
 */
export function BookmarksGutter(props: BookmarksGutterProps) {
  const { bookmarks, toggleBookmark, getBookmarksForFile } = useBookmarks();
  
  // Track current decorations for cleanup
  let decorationIds: string[] = [];

  /**
   * Create Monaco decoration options for a bookmark.
   */
  function createBookmarkDecoration(
    bookmark: Bookmark,
    monaco: typeof Monaco
  ): Monaco.editor.IModelDeltaDecoration {
    const hoverMessage = bookmark.label
      ? `Bookmark: ${bookmark.label}`
      : "Bookmark (click to remove)";

    return {
      range: new monaco.Range(bookmark.line, 1, bookmark.line, 1),
      options: {
        isWholeLine: false,
        linesDecorationsClassName: `${GUTTER_CLASS} bookmark-gutter-clickable`,
        overviewRuler: {
          color: BOOKMARK_COLOR,
          position: monaco.editor.OverviewRulerLane.Left,
        },
        minimap: {
          color: BOOKMARK_COLOR,
          position: monaco.editor.MinimapPosition.Gutter,
        },
        glyphMarginHoverMessage: {
          value: hoverMessage,
        },
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    };
  }

  /**
   * Update decorations based on current bookmarks
   */
  const updateDecorations = () => {
    const editor = props.editor;
    const monaco = props.monaco;
    const filePath = props.filePath;

    if (!editor || !monaco || !filePath) {
      clearDecorations();
      return;
    }

    // Inject styles on first use
    injectStyles();

    // Get bookmarks for this file
    const fileBookmarks = getBookmarksForFile(filePath);

    // Create decorations
    const newDecorations: Monaco.editor.IModelDeltaDecoration[] = fileBookmarks.map(
      (bookmark) => createBookmarkDecoration(bookmark, monaco)
    );

    // Apply decorations (deltaDecorations handles cleanup of old decorations)
    decorationIds = editor.deltaDecorations(decorationIds, newDecorations);
  };

  /**
   * Clear all decorations
   */
  const clearDecorations = () => {
    if (props.editor && decorationIds.length > 0) {
      decorationIds = props.editor.deltaDecorations(decorationIds, []);
    }
  };

  // Update decorations when bookmarks or file changes
  createEffect(() => {
    // Access bookmarks() to trigger reactivity
    void bookmarks();
    
    const editor = props.editor;
    const monaco = props.monaco;
    const filePath = props.filePath;

    if (editor && monaco && filePath) {
      updateDecorations();
    } else {
      clearDecorations();
    }
  });

  // Set up click handler for gutter
  createEffect(() => {
    const editor = props.editor;
    const monaco = props.monaco;
    const filePath = props.filePath;

    if (!editor || !monaco || !filePath) return;

    // Handle click on lines decorations (where bookmark markers are)
    const mouseDownDisposable = editor.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS) {
        const lineNumber = e.target.position?.lineNumber;
        if (lineNumber) {
          // Toggle bookmark on this line
          toggleBookmark(filePath, lineNumber);
        }
      }
    });

    onCleanup(() => {
      mouseDownDisposable.dispose();
    });
  });

  // Cleanup on unmount
  onCleanup(() => {
    clearDecorations();
  });

  // This component doesn't render anything - it only manages decorations
  return null;
}

export default BookmarksGutter;

