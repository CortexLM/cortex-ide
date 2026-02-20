/**
 * Git Gutter Decorations (QuickDiff)
 * 
 * Shows colored bars in the editor gutter for added/modified/deleted lines,
 * similar to VS Code's quickDiffDecorator feature.
 * 
 * - Green bar: Added lines
 * - Blue bar: Modified lines
 * - Red triangle: Deleted lines (in the gutter margin)
 * 
 * Features:
 * - Click to stage/unstage hunks
 * - Right-click context menu for stage/unstage/revert options
 * - Navigation between changes (Alt+F3 / Shift+Alt+F3)
 */

import { createEffect, onCleanup, createSignal } from "solid-js";
import { gitDiff, gitStageHunk, gitUnstageHunk, gitDiscard } from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";
import { editorLogger } from "../../utils/logger";
import type * as Monaco from "monaco-editor";

// ============================================================================
// Types
// ============================================================================

export interface GitGutterDecorationsProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  /** Absolute file path */
  filePath: string | null;
  /** Whether the file has been modified since last save */
  isModified?: boolean;
}

/** Types of line changes in git diff */
type LineChangeType = "added" | "modified" | "deleted";

/** Represents a range of changed lines */
interface LineChange {
  type: LineChangeType;
  startLine: number;
  endLine: number;
  /** Index of the hunk this change belongs to */
  hunkIndex: number;
}

/** Represents a parsed hunk from the diff */
interface ParsedHunk {
  index: number;
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  startLine: number;
  endLine: number;
}

/** Context menu item action */
type ContextMenuAction = "stage-hunk" | "unstage-hunk" | "revert-hunk";

// ============================================================================
// Global State for Diff Navigation
// ============================================================================

/**
 * Global store for line changes per file path.
 * Allows navigation functions to access the current changes without
 * requiring a reference to the component instance.
 */
const lineChangesStore = new Map<string, LineChange[]>();

/**
 * Update the line changes for a specific file path.
 */
function setLineChanges(filePath: string, changes: LineChange[]): void {
  lineChangesStore.set(filePath, changes);
}

/**
 * Get the line changes for a specific file path.
 */
export function getLineChanges(filePath: string): LineChange[] {
  return lineChangesStore.get(filePath) || [];
}

/**
 * Clear the line changes for a specific file path.
 */
function clearLineChangesStore(filePath: string): void {
  lineChangesStore.delete(filePath);
}

// ============================================================================
// Diff Navigation Functions
// ============================================================================

/**
 * Navigate to the next git change in the editor.
 * If at the last change, wraps around to the first change.
 */
export function goToNextChange(
  editor: Monaco.editor.IStandaloneCodeEditor,
  filePath: string
): void {
  const changes = getLineChanges(filePath);
  if (changes.length === 0) return;

  const currentLine = editor.getPosition()?.lineNumber || 1;
  
  // Sort changes by start line
  const sortedChanges = [...changes].sort((a, b) => a.startLine - b.startLine);
  
  // Find the next change after the current line
  const nextChange = sortedChanges.find(c => c.startLine > currentLine);
  
  if (nextChange) {
    // Navigate to the next change
    editor.revealLineInCenter(nextChange.startLine);
    editor.setPosition({ lineNumber: nextChange.startLine, column: 1 });
  } else if (sortedChanges.length > 0) {
    // Wrap around to the first change
    const firstChange = sortedChanges[0];
    editor.revealLineInCenter(firstChange.startLine);
    editor.setPosition({ lineNumber: firstChange.startLine, column: 1 });
  }
  
  editor.focus();
}

/**
 * Navigate to the previous git change in the editor.
 * If at the first change, wraps around to the last change.
 */
export function goToPrevChange(
  editor: Monaco.editor.IStandaloneCodeEditor,
  filePath: string
): void {
  const changes = getLineChanges(filePath);
  if (changes.length === 0) return;

  const currentLine = editor.getPosition()?.lineNumber || 1;
  
  // Sort changes by start line in descending order
  const sortedChanges = [...changes].sort((a, b) => b.startLine - a.startLine);
  
  // Find the previous change before the current line
  const prevChange = sortedChanges.find(c => c.startLine < currentLine);
  
  if (prevChange) {
    // Navigate to the previous change
    editor.revealLineInCenter(prevChange.startLine);
    editor.setPosition({ lineNumber: prevChange.startLine, column: 1 });
  } else if (sortedChanges.length > 0) {
    // Wrap around to the last change
    const lastChange = sortedChanges[0];
    editor.revealLineInCenter(lastChange.startLine);
    editor.setPosition({ lineNumber: lastChange.startLine, column: 1 });
  }
  
  editor.focus();
}

// ============================================================================
// Diff Parsing
// ============================================================================

/** Result of parsing a diff */
interface ParsedDiff {
  changes: LineChange[];
  hunks: ParsedHunk[];
}

/**
 * Parse a unified diff string and extract line-level changes and hunks.
 * 
 * The diff format is:
 * @@ -old_start,old_count +new_start,new_count @@
 * 
 * Lines starting with:
 * - ' ' (space): Context line (unchanged)
 * - '+': Added line
 * - '-': Removed line
 */
function parseDiffToLineChanges(diffText: string): ParsedDiff {
  if (!diffText || diffText.trim() === "") {
    return { changes: [], hunks: [] };
  }

  const changes: LineChange[] = [];
  const hunks: ParsedHunk[] = [];
  const lines = diffText.split("\n");
  
  let currentNewLine = 0;
  let consecutiveAdded: number[] = [];
  let consecutiveDeleted: number[] = [];
  let lastDeletedAtLine = -1;
  let currentHunkIndex = -1;
  let currentHunkEndLine = 0;

  for (const line of lines) {
    // Parse hunk header to get line numbers
    // Format: @@ -old_start,old_count +new_start,new_count @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      // Flush any pending consecutive changes before starting new hunk
      flushConsecutiveChanges(changes, consecutiveAdded, consecutiveDeleted, lastDeletedAtLine, currentHunkIndex);
      
      // Save previous hunk end line
      if (currentHunkIndex >= 0 && hunks[currentHunkIndex]) {
        hunks[currentHunkIndex].endLine = currentHunkEndLine;
      }
      
      consecutiveAdded = [];
      consecutiveDeleted = [];
      lastDeletedAtLine = -1;
      
      const oldStart = parseInt(hunkMatch[1], 10);
      const oldCount = parseInt(hunkMatch[2] || "1", 10);
      const newStart = parseInt(hunkMatch[3], 10);
      const newCount = parseInt(hunkMatch[4] || "1", 10);
      
      currentNewLine = newStart;
      currentHunkIndex++;
      currentHunkEndLine = newStart;
      
      hunks.push({
        index: currentHunkIndex,
        header: line,
        oldStart,
        oldCount,
        newStart,
        newCount,
        startLine: newStart,
        endLine: newStart + newCount - 1,
      });
      continue;
    }

    // Skip diff headers and other non-content lines
    if (line.startsWith("diff ") || line.startsWith("index ") || 
        line.startsWith("---") || line.startsWith("+++") ||
        line.startsWith("\\")) {
      continue;
    }

    // Process content lines
    if (line.startsWith("+")) {
      // Added line
      consecutiveAdded.push(currentNewLine);
      currentHunkEndLine = Math.max(currentHunkEndLine, currentNewLine);
      currentNewLine++;
    } else if (line.startsWith("-")) {
      // Deleted line - mark at the current position in the new file
      // Deletions are shown at the line where they were removed from
      lastDeletedAtLine = currentNewLine;
      consecutiveDeleted.push(currentNewLine);
      // Don't increment currentNewLine for deletions
    } else if (line.startsWith(" ") || line === "") {
      // Context line or empty line
      // Flush any pending consecutive changes
      flushConsecutiveChanges(changes, consecutiveAdded, consecutiveDeleted, lastDeletedAtLine, currentHunkIndex);
      consecutiveAdded = [];
      consecutiveDeleted = [];
      lastDeletedAtLine = -1;
      
      if (line.startsWith(" ")) {
        currentHunkEndLine = Math.max(currentHunkEndLine, currentNewLine);
        currentNewLine++;
      }
    }
  }

  // Flush any remaining changes
  flushConsecutiveChanges(changes, consecutiveAdded, consecutiveDeleted, lastDeletedAtLine, currentHunkIndex);
  
  // Update last hunk end line
  if (currentHunkIndex >= 0 && hunks[currentHunkIndex]) {
    hunks[currentHunkIndex].endLine = currentHunkEndLine;
  }

  return { changes, hunks };
}

/**
 * Process consecutive added/deleted lines to determine if they are
 * additions, deletions, or modifications (replaced lines).
 */
function flushConsecutiveChanges(
  changes: LineChange[],
  addedLines: number[],
  deletedLines: number[],
  _lastDeletedAtLine: number,
  hunkIndex: number
): void {
  if (addedLines.length === 0 && deletedLines.length === 0) {
    return;
  }

  // If we have both added and deleted lines at the same location,
  // treat them as modifications
  if (addedLines.length > 0 && deletedLines.length > 0) {
    // Lines were replaced - mark as modified
    const startLine = Math.min(...addedLines);
    const endLine = Math.max(...addedLines);
    changes.push({
      type: "modified",
      startLine,
      endLine,
      hunkIndex,
    });
    
    // If there are more deletions than additions, mark the remaining as deleted
    if (deletedLines.length > addedLines.length && addedLines.length > 0) {
      changes.push({
        type: "deleted",
        startLine: addedLines[addedLines.length - 1],
        endLine: addedLines[addedLines.length - 1],
        hunkIndex,
      });
    }
  } else if (addedLines.length > 0) {
    // Pure additions
    const startLine = Math.min(...addedLines);
    const endLine = Math.max(...addedLines);
    changes.push({
      type: "added",
      startLine,
      endLine,
      hunkIndex,
    });
  } else if (deletedLines.length > 0) {
    // Pure deletions - mark at the first deleted line position
    const deletedAt = Math.min(...deletedLines);
    changes.push({
      type: "deleted",
      startLine: deletedAt,
      endLine: deletedAt,
      hunkIndex,
    });
  }
}

// ============================================================================
// Decoration Management
// ============================================================================

/** CSS class names for gutter decorations */
const GUTTER_DECORATION_CLASSES = {
  added: "git-gutter-added",
  modified: "git-gutter-modified",
  deleted: "git-gutter-deleted",
} as const;

/** Overview ruler colors for each change type */
const OVERVIEW_RULER_COLORS = {
  added: "var(--cortex-syntax-function)",    // Green
  modified: "var(--cortex-syntax-keyword)", // Blue
  deleted: "var(--cortex-error)",  // Red
} as const;

/**
 * Create Monaco decoration options for a line change.
 */
function createGutterDecoration(
  change: LineChange,
  monaco: typeof Monaco
): Monaco.editor.IModelDeltaDecoration {
  const glyphClass = GUTTER_DECORATION_CLASSES[change.type];
  const overviewColor = OVERVIEW_RULER_COLORS[change.type];

  // For deleted lines, we only show a marker at a single line position
  const isDeleteMarker = change.type === "deleted";

  // Base description
  const typeLabel = change.type === "added" 
    ? "Added" 
    : change.type === "modified"
      ? "Modified"
      : "Deleted";

  return {
    range: new monaco.Range(
      change.startLine,
      1,
      isDeleteMarker ? change.startLine : change.endLine,
      1
    ),
    options: {
      isWholeLine: !isDeleteMarker,
      // Add clickable class to enable pointer cursor and hover effects
      linesDecorationsClassName: `${glyphClass} git-gutter-clickable`,
      overviewRuler: {
        color: overviewColor,
        position: monaco.editor.OverviewRulerLane.Left,
      },
      minimap: {
        color: overviewColor,
        position: monaco.editor.MinimapPosition.Gutter,
      },
      // Hover message explaining the change with action hint
      glyphMarginHoverMessage: {
        value: `${typeLabel} line(s)\n\nClick to stage hunk • Right-click for options`,
      },
    },
  };
}

// ============================================================================
// Component
// ============================================================================

/**
 * GitGutterDecorations component
 * 
 * Manages git diff decorations in the Monaco editor gutter.
 * Updates decorations when:
 * - File content changes
 * - File is saved (via git status refresh)
 * - Git status changes externally
 */
export function GitGutterDecorations(props: GitGutterDecorationsProps) {
  // Track current decorations for cleanup
  let decorationIds: string[] = [];
  
  // Debounce timer for content changes
  let updateTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Track last fetched diff to avoid redundant updates
  const [lastDiff, setLastDiff] = createSignal<string>("");
  
  // Track parsed hunks for click handling
  const [parsedHunks, setParsedHunks] = createSignal<ParsedHunk[]>([]);
  const [localLineChanges, setLocalLineChanges] = createSignal<LineChange[]>([]);
  
  // Context menu state
  const [contextMenu, setContextMenu] = createSignal<{
    x: number;
    y: number;
    hunkIndex: number;
  } | null>(null);
  
  // Loading state for operations
  const [isOperating, setIsOperating] = createSignal(false);
  
  /**
   * Fetch git diff and update decorations
   */
  const updateGutterDecorations = async () => {
    const editor = props.editor;
    const monaco = props.monaco;
    const filePath = props.filePath;
    
    if (!editor || !monaco || !filePath) {
      clearDecorations();
      return;
    }

    try {
      // Get project path from localStorage (standard location in this codebase)
      const projectPath = getProjectPath();
      if (!projectPath) {
        clearDecorations();
        return;
      }

      // Fetch unstaged diff for the file
      // The gitDiff function returns raw diff text
      const diffText = await gitDiff(projectPath, filePath, false);
      
      // Skip update if diff hasn't changed
      if (diffText === lastDiff()) {
        return;
      }
      setLastDiff(diffText);

      // Parse diff into line changes and hunks
      const { changes: lineChanges, hunks } = parseDiffToLineChanges(diffText);

      // Store changes in global store for navigation
      setLineChanges(filePath, lineChanges);
      
      // Store locally for click handling
      setLocalLineChanges(lineChanges);
      setParsedHunks(hunks);

      // Create decorations
      const newDecorations: Monaco.editor.IModelDeltaDecoration[] = lineChanges.map(
        (change) => createGutterDecoration(change, monaco)
      );

      // Apply decorations using deltaDecorations (handles cleanup of old decorations)
      decorationIds = editor.deltaDecorations(decorationIds, newDecorations);
    } catch (error) {
      // Git diff may fail for new files or non-git repos - this is expected
      console.debug("[GitGutter] Failed to fetch diff:", error);
      clearDecorations();
    }
  };

  /**
   * Clear all decorations
   */
  const clearDecorations = () => {
    if (props.editor && decorationIds.length > 0) {
      decorationIds = props.editor.deltaDecorations(decorationIds, []);
    }
    if (props.filePath) {
      clearLineChangesStore(props.filePath);
    }
    setLastDiff("");
    setLocalLineChanges([]);
    setParsedHunks([]);
  };
  
  /**
   * Find the hunk index for a given line number
   */
  const findHunkForLine = (lineNumber: number): number => {
    // First check if there's a change at this line
    const change = localLineChanges().find(
      c => lineNumber >= c.startLine && lineNumber <= c.endLine
    );
    if (change) {
      return change.hunkIndex;
    }
    
    // Fall back to checking hunk ranges
    const hunk = parsedHunks().find(
      h => lineNumber >= h.startLine && lineNumber <= h.endLine
    );
    return hunk?.index ?? -1;
  };
  
  /**
   * Stage a hunk by index
   */
  const stageHunk = async (hunkIndex: number) => {
    if (isOperating()) return;
    
    const projectPath = getProjectPath();
    const filePath = props.filePath;
    
    if (!projectPath || !filePath) {
      editorLogger.warn("[GitGutter] Cannot stage hunk: missing project path or file path");
      return;
    }
    
    setIsOperating(true);
    try {
      await gitStageHunk(projectPath, filePath, hunkIndex);
      
      // Dispatch event to refresh git status
      window.dispatchEvent(new CustomEvent("git:refresh"));
      
      // Update decorations after a short delay
      setTimeout(updateGutterDecorations, 100);
    } catch (error) {
      console.error("[GitGutter] Failed to stage hunk:", error);
    } finally {
      setIsOperating(false);
    }
  };
  
  /**
   * Unstage a hunk by index (note: this works on staged diffs)
   */
  const unstageHunk = async (hunkIndex: number) => {
    if (isOperating()) return;
    
    const projectPath = getProjectPath();
    const filePath = props.filePath;
    
    if (!projectPath || !filePath) {
      editorLogger.warn("[GitGutter] Cannot unstage hunk: missing project path or file path");
      return;
    }
    
    setIsOperating(true);
    try {
      await gitUnstageHunk(projectPath, filePath, hunkIndex);
      
      // Dispatch event to refresh git status
      window.dispatchEvent(new CustomEvent("git:refresh"));
      
      // Update decorations after a short delay
      setTimeout(updateGutterDecorations, 100);
    } catch (error) {
      console.error("[GitGutter] Failed to unstage hunk:", error);
    } finally {
      setIsOperating(false);
    }
  };
  
  /**
   * Revert changes for the entire file (discard all changes)
   */
  const revertFile = async () => {
    if (isOperating()) return;
    
    const projectPath = getProjectPath();
    const filePath = props.filePath;
    
    if (!projectPath || !filePath) {
      editorLogger.warn("[GitGutter] Cannot revert: missing project path or file path");
      return;
    }
    
    // Confirm before reverting
    if (!window.confirm(`Discard all changes in this file?\n\n${filePath}\n\nThis cannot be undone.`)) {
      return;
    }
    
    setIsOperating(true);
    try {
      await gitDiscard(projectPath, filePath);
      
      // Dispatch event to refresh git status and reload file
      window.dispatchEvent(new CustomEvent("git:refresh"));
      window.dispatchEvent(new CustomEvent("file:reload-request", { 
        detail: { path: filePath } 
      }));
      
      // Update decorations after a short delay
      setTimeout(updateGutterDecorations, 100);
    } catch (error) {
      console.error("[GitGutter] Failed to revert file:", error);
    } finally {
      setIsOperating(false);
    }
  };
  
  /**
   * Handle context menu action
   */
  const handleContextMenuAction = (action: ContextMenuAction) => {
    const menu = contextMenu();
    if (!menu) return;
    
    setContextMenu(null);
    
    switch (action) {
      case "stage-hunk":
        stageHunk(menu.hunkIndex);
        break;
      case "unstage-hunk":
        unstageHunk(menu.hunkIndex);
        break;
      case "revert-hunk":
        revertFile();
        break;
    }
  };

  /**
   * Debounced update - prevents too many API calls during rapid typing
   */
  const scheduleUpdate = () => {
    if (updateTimer) {
      clearTimeout(updateTimer);
    }
    // Debounce for 500ms after content changes
    updateTimer = setTimeout(() => {
      updateGutterDecorations();
    }, 500);
  };

  // Update decorations when editor, monaco, or filePath changes
  createEffect(() => {
    const editor = props.editor;
    const monaco = props.monaco;
    const filePath = props.filePath;
    
    // Trigger reactivity
    void editor;
    void monaco;
    void filePath;
    
    if (editor && monaco && filePath) {
      // Initial update
      updateGutterDecorations();
    } else {
      clearDecorations();
    }
  });

  // Listen for content changes to schedule updates
  createEffect(() => {
    const editor = props.editor;
    if (!editor) return;

    const disposable = editor.onDidChangeModelContent(() => {
      scheduleUpdate();
    });

    onCleanup(() => {
      disposable.dispose();
    });
  });

  // Listen for file save events to refresh decorations
  createEffect(() => {
    const handleFileSaved = (e: CustomEvent<{ fileId?: string; path?: string }>) => {
      // Update decorations after save (git status will have changed)
      if (props.filePath && (e.detail.path === props.filePath || !e.detail.path)) {
        // Clear debounce timer and update immediately on save
        if (updateTimer) {
          clearTimeout(updateTimer);
          updateTimer = null;
        }
        // Small delay to allow git index to update
        setTimeout(updateGutterDecorations, 100);
      }
    };

    window.addEventListener("file:saved", handleFileSaved as EventListener);

    onCleanup(() => {
      window.removeEventListener("file:saved", handleFileSaved as EventListener);
    });
  });

  // Listen for git status refresh events
  createEffect(() => {
    const handleGitRefresh = () => {
      // Update decorations when git status changes
      if (updateTimer) {
        clearTimeout(updateTimer);
        updateTimer = null;
      }
      updateGutterDecorations();
    };

    window.addEventListener("git:status-changed", handleGitRefresh);
    window.addEventListener("git:refresh", handleGitRefresh);

    onCleanup(() => {
      window.removeEventListener("git:status-changed", handleGitRefresh);
      window.removeEventListener("git:refresh", handleGitRefresh);
    });
  });

  // Set up gutter click handlers
  createEffect(() => {
    const editor = props.editor;
    const monaco = props.monaco;
    if (!editor || !monaco) return;
    
    // Handle left click on gutter - stage hunk
    const mouseDownDisposable = editor.onMouseDown((e) => {
      // Check if clicking on lines decorations (where git gutter indicators are)
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS) {
        const lineNumber = e.target.position?.lineNumber;
        if (lineNumber) {
          const hunkIndex = findHunkForLine(lineNumber);
          if (hunkIndex >= 0) {
            // Left click - stage hunk
            stageHunk(hunkIndex);
          }
        }
      }
    });
    
    // Handle right click on gutter - show context menu
    const contextMenuDisposable = editor.onContextMenu((e) => {
      // Check if right-clicking on lines decorations
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS) {
        const lineNumber = e.target.position?.lineNumber;
        if (lineNumber) {
          const hunkIndex = findHunkForLine(lineNumber);
          if (hunkIndex >= 0) {
            e.event.preventDefault();
            e.event.stopPropagation();
            
            // Show custom context menu
            setContextMenu({
              x: e.event.posx,
              y: e.event.posy,
              hunkIndex,
            });
          }
        }
      }
    });
    
    onCleanup(() => {
      mouseDownDisposable.dispose();
      contextMenuDisposable.dispose();
    });
  });
  
  // Close context menu when clicking elsewhere
  createEffect(() => {
    const menu = contextMenu();
    if (!menu) return;
    
    const handleClickOutside = () => {
      // Close menu on any click outside
      setContextMenu(null);
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
      }
    };
    
    // Delay to avoid closing immediately on the same click
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }, 0);
    
    onCleanup(() => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    });
  });

  // Cleanup on unmount
  onCleanup(() => {
    if (updateTimer) {
      clearTimeout(updateTimer);
    }
    clearDecorations();
  });

  // Render context menu if open
  const menu = contextMenu();
  if (menu) {
    return (
      <div
        class="git-gutter-context-menu"
        style={{
          position: "fixed",
          left: `${menu.x}px`,
          top: `${menu.y}px`,
          "z-index": 10000,
          background: "var(--surface-raised, var(--cortex-bg-primary))",
          border: "1px solid var(--border-weak, var(--cortex-bg-hover))",
          "border-radius": "var(--cortex-radius-sm)",
          "box-shadow": "0 2px 8px rgba(0, 0, 0, 0.3)",
          "min-width": "160px",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          class="git-gutter-menu-item"
          style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
            width: "100%",
            padding: "6px 12px",
            border: "none",
            background: "transparent",
            color: "var(--text-base, var(--cortex-text-primary))",
            "font-size": "13px",
            "text-align": "left",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover, var(--cortex-bg-hover))")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          onClick={() => handleContextMenuAction("stage-hunk")}
          disabled={isOperating()}
        >
          <span style={{ color: "var(--cortex-syntax-function)" }}>+</span>
          Stage Hunk
        </button>
        <button
          class="git-gutter-menu-item"
          style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
            width: "100%",
            padding: "6px 12px",
            border: "none",
            background: "transparent",
            color: "var(--text-base, var(--cortex-text-primary))",
            "font-size": "13px",
            "text-align": "left",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover, var(--cortex-bg-hover))")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          onClick={() => handleContextMenuAction("unstage-hunk")}
          disabled={isOperating()}
        >
          <span style={{ color: "var(--cortex-syntax-keyword)" }}>−</span>
          Unstage Hunk
        </button>
        <div style={{ height: "1px", background: "var(--border-weak, var(--cortex-bg-hover))", margin: "4px 0" }} />
        <button
          class="git-gutter-menu-item"
          style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
            width: "100%",
            padding: "6px 12px",
            border: "none",
            background: "transparent",
            color: "var(--cortex-error)",
            "font-size": "13px",
            "text-align": "left",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover, var(--cortex-bg-hover))")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          onClick={() => handleContextMenuAction("revert-hunk")}
          disabled={isOperating()}
        >
          <span>⟲</span>
          Revert All Changes
        </button>
      </div>
    );
  }

  // No context menu - return null
  return null;
}

export default GitGutterDecorations;

