/**
 * Inline Git Blame Decorations
 * 
 * Shows git blame annotations inline in the editor, similar to GitLens in VS Code.
 * Supports two modes:
 * - Current line only: Shows blame for the line where the cursor is
 * - All lines: Shows blame for all visible lines
 * 
 * Uses Monaco's afterLineContent decorations for a clean, non-intrusive display.
 */

import { createSignal, onCleanup, createEffect } from "solid-js";
import type * as Monaco from "monaco-editor";
import { gitBlame, gitBlameLineRange } from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";

// ============================================================================
// Types
// ============================================================================

export type InlineBlameMode = "off" | "currentLine" | "allLines";

export interface InlineBlameOptions {
  /** The Monaco editor instance */
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  /** The Monaco namespace for creating decorations */
  monaco: typeof Monaco | null;
  /** The file path being edited */
  filePath: string;
  /** Display mode: off, currentLine, or allLines */
  mode: InlineBlameMode;
  /** Whether to show the commit message */
  showMessage?: boolean;
  /** Maximum length for commit messages */
  maxMessageLength?: number;
}

export interface BlameLineInfo {
  lineNumber: number;
  author: string;
  authorEmail: string;
  date: string;
  hash: string;
  message: string;
}

/** Extended commit details for hover (cached) */
export interface CommitDetails {
  hash: string;
  author: string;
  authorEmail: string;
  date: string;
  message: string;
  summary: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a date string for full display (e.g., "December 27, 2025 at 3:45 PM")
 */
function formatFullDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date string to relative time (e.g., "2 days ago", "3 months ago")
 */
function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears > 0) return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
    if (diffMonths > 0) return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
    if (diffWeeks > 0) return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    return "just now";
  } catch {
    return dateStr;
  }
}

/**
 * Truncate a string to a maximum length, adding ellipsis if needed
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

/**
 * Format blame info for display
 */
function formatBlameText(
  author: string,
  date: string,
  message?: string,
  showMessage: boolean = true,
  maxMessageLength: number = 50
): string {
  const relativeTime = formatRelativeTime(date);
  let text = `${author}, ${relativeTime}`;
  
  if (showMessage && message) {
    // Get first line of commit message
    const firstLine = message.split("\n")[0].trim();
    if (firstLine) {
      text += ` • ${truncate(firstLine, maxMessageLength)}`;
    }
  }
  
  return text;
}

/**
 * Get relative file path from full path
 */
function getRelativePath(fullPath: string): string {
  const projectPath = getProjectPath();
  if (!projectPath) return fullPath;
  
  // Normalize paths
  const normalizedFull = fullPath.replace(/\\/g, "/");
  const normalizedProject = projectPath.replace(/\\/g, "/");
  
  if (normalizedFull.startsWith(normalizedProject)) {
    return normalizedFull.slice(normalizedProject.length + 1);
  }
  
  return fullPath;
}

// ============================================================================
// Inline Blame Manager Class
// ============================================================================

// ============================================================================
// Commit Details Cache
// ============================================================================

/** Cache for commit details to avoid redundant lookups */
const commitCache = new Map<string, CommitDetails>();

/**
 * Get cached commit details or create from blame info
 */
function getCommitDetails(blameInfo: BlameLineInfo): CommitDetails {
  if (commitCache.has(blameInfo.hash)) {
    return commitCache.get(blameInfo.hash)!;
  }
  
  const details: CommitDetails = {
    hash: blameInfo.hash,
    author: blameInfo.author,
    authorEmail: blameInfo.authorEmail,
    date: blameInfo.date,
    message: blameInfo.message,
    summary: blameInfo.message.split('\n')[0].trim(),
  };
  
  commitCache.set(blameInfo.hash, details);
  return details;
}

/**
 * Clear the commit cache (useful when switching files or repos)
 */
export function clearCommitCache(): void {
  commitCache.clear();
}

// ============================================================================
// Inline Blame Manager Class
// ============================================================================

/**
 * Manages inline blame decorations for a Monaco editor instance.
 * Handles fetching blame data, creating decorations, and updating on cursor change.
 */
export class InlineBlameManager {
  private editor: Monaco.editor.IStandaloneCodeEditor | null = null;
  private monaco: typeof Monaco | null = null;
  private decorationIds: string[] = [];
  private blameData: Map<number, BlameLineInfo> = new Map();
  private mode: InlineBlameMode = "off";
  private showMessage: boolean = true;
  private maxMessageLength: number = 50;
  private currentLine: number = 1;
  private filePath: string = "";
  private isLoading: boolean = false;
  private cursorDisposable: Monaco.IDisposable | null = null;
  private scrollDisposable: Monaco.IDisposable | null = null;
  private hoverProviderDisposable: Monaco.IDisposable | null = null;
  
  /**
   * Initialize the manager with editor and options
   */
  initialize(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
    filePath: string,
    mode: InlineBlameMode = "currentLine",
    showMessage: boolean = true,
    maxMessageLength: number = 50
  ): void {
    this.editor = editor;
    this.monaco = monaco;
    this.filePath = filePath;
    this.mode = mode;
    this.showMessage = showMessage;
    this.maxMessageLength = maxMessageLength;
    
    // Set up cursor position listener
    this.setupCursorListener();
    
    // Set up scroll listener for "allLines" mode
    this.setupScrollListener();
    
    // Set up hover provider for blame details
    this.setupHoverProvider();
    
    // Initial update
    if (this.mode !== "off") {
      this.updateCurrentLine();
      this.fetchBlameData();
    }
  }
  
  /**
   * Set up hover provider for detailed blame information
   */
  private setupHoverProvider(): void {
    if (!this.editor || !this.monaco) return;
    
    // Dispose existing hover provider if any
    this.hoverProviderDisposable?.dispose();
    
    const monaco = this.monaco;
    const getBlameForLine = (lineNumber: number) => this.blameData.get(lineNumber);
    const getMode = () => this.mode;
    
    // Register a hover provider for all languages
    this.hoverProviderDisposable = monaco.languages.registerHoverProvider('*', {
      provideHover: (model, position) => {
        // Only show hover when blame is active
        if (getMode() === 'off') return null;
        
        const blameInfo = getBlameForLine(position.lineNumber);
        if (!blameInfo) return null;
        
        // Get cached commit details
        const details = getCommitDetails(blameInfo);
        
        // Format the hover content in markdown
        const contents: Monaco.IMarkdownString[] = [
          { 
            value: `**${details.author}** <${details.authorEmail}>`,
            isTrusted: true 
          },
          { value: `---` },
          { 
            value: `**Commit:** \`${details.hash.slice(0, 8)}\``,
            isTrusted: true 
          },
          { 
            value: `**Date:** ${formatFullDate(details.date)} _(${formatRelativeTime(details.date)})_`,
            isTrusted: true 
          },
          { value: `---` },
          { 
            value: `**Message:**\n\n${details.message}`,
            isTrusted: true 
          },
        ];
        
        // Add summary line if message is multi-line
        if (details.summary !== details.message.trim()) {
          contents.push({ value: `---` });
          contents.push({ 
            value: `*${details.summary}*`,
            isTrusted: true 
          });
        }
        
        return {
          range: new monaco.Range(
            position.lineNumber, 
            1, 
            position.lineNumber, 
            model.getLineMaxColumn(position.lineNumber)
          ),
          contents,
        };
      }
    });
  }
  
  /**
   * Set up listener for cursor position changes
   */
  private setupCursorListener(): void {
    if (!this.editor) return;
    
    this.cursorDisposable?.dispose();
    this.cursorDisposable = this.editor.onDidChangeCursorPosition((e) => {
      const newLine = e.position.lineNumber;
      if (newLine !== this.currentLine) {
        this.currentLine = newLine;
        if (this.mode === "currentLine" && !this.isLoading) {
          this.updateDecorations();
        }
      }
    });
  }
  
  /**
   * Set up listener for scroll changes (for allLines mode)
   */
  private setupScrollListener(): void {
    if (!this.editor) return;
    
    this.scrollDisposable?.dispose();
    this.scrollDisposable = this.editor.onDidScrollChange(() => {
      if (this.mode === "allLines" && !this.isLoading) {
        this.updateDecorations();
      }
    });
  }
  
  /**
   * Update the current line number
   */
  private updateCurrentLine(): void {
    if (!this.editor) return;
    const position = this.editor.getPosition();
    if (position) {
      this.currentLine = position.lineNumber;
    }
  }
  
  /**
   * Fetch blame data for the current file
   */
  async fetchBlameData(): Promise<void> {
    if (!this.filePath || this.isLoading) return;
    
    this.isLoading = true;
    this.blameData.clear();
    
    try {
      const projectPath = getProjectPath();
      if (!projectPath) {
        console.debug("[InlineBlame] No project path found");
        return;
      }
      
      const relativePath = getRelativePath(this.filePath);
      const entries = await gitBlame(projectPath, relativePath);
      
      // Process blame entries and map to line numbers
      for (const entry of entries) {
        // Each entry covers lines from lineStart to lineEnd
        for (let line = entry.lineStart; line <= entry.lineEnd; line++) {
          this.blameData.set(line, {
            lineNumber: line,
            author: entry.author,
            authorEmail: entry.authorEmail || '',
            date: entry.date,
            hash: entry.hash,
            message: entry.message || entry.content,
          });
        }
      }
      
      // Update decorations after fetching
      this.updateDecorations();
    } catch (error) {
      console.debug("[InlineBlame] Failed to fetch blame data:", error);
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Update the mode (off, currentLine, allLines)
   */
  setMode(mode: InlineBlameMode): void {
    this.mode = mode;
    
    if (mode === "off") {
      this.clearDecorations();
    } else {
      // Refetch if we don't have data
      if (this.blameData.size === 0) {
        this.fetchBlameData();
      } else {
        this.updateDecorations();
      }
    }
  }
  
  /**
   * Update the file path and refetch blame data
   */
  setFilePath(filePath: string): void {
    if (filePath !== this.filePath) {
      this.filePath = filePath;
      this.blameData.clear();
      this.clearDecorations();
      
      if (this.mode !== "off") {
        this.fetchBlameData();
      }
    }
  }
  
  /**
   * Clear all blame decorations
   */
  clearDecorations(): void {
    if (!this.editor) return;
    this.decorationIds = this.editor.deltaDecorations(this.decorationIds, []);
  }
  
  /**
   * Update decorations based on current mode
   */
  updateDecorations(): void {
    if (!this.editor || !this.monaco || this.mode === "off") {
      return;
    }
    
    const model = this.editor.getModel();
    if (!model) return;
    
    const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [];
    
    if (this.mode === "currentLine") {
      // Show blame only for current line
      const blameInfo = this.blameData.get(this.currentLine);
      if (blameInfo) {
        const text = formatBlameText(
          blameInfo.author,
          blameInfo.date,
          blameInfo.message,
          this.showMessage,
          this.maxMessageLength
        );
        
        newDecorations.push({
          range: new this.monaco.Range(this.currentLine, 1, this.currentLine, 1),
          options: {
            after: {
              content: `    ${text}`,
              inlineClassName: "inline-blame-decoration",
            },
            isWholeLine: true,
          },
        });
      }
    } else if (this.mode === "allLines") {
      // Show blame for all visible lines
      const visibleRanges = this.editor.getVisibleRanges();
      const lineCount = model.getLineCount();
      
      for (const range of visibleRanges) {
        const startLine = Math.max(1, range.startLineNumber);
        const endLine = Math.min(lineCount, range.endLineNumber);
        
        for (let line = startLine; line <= endLine; line++) {
          const blameInfo = this.blameData.get(line);
          if (blameInfo) {
            const text = formatBlameText(
              blameInfo.author,
              blameInfo.date,
              blameInfo.message,
              this.showMessage,
              this.maxMessageLength
            );
            
            // Highlight current line differently
            const isCurrentLine = line === this.currentLine;
            
            newDecorations.push({
              range: new this.monaco.Range(line, 1, line, 1),
              options: {
                after: {
                  content: `    ${text}`,
                  inlineClassName: isCurrentLine 
                    ? "inline-blame-decoration inline-blame-current"
                    : "inline-blame-decoration inline-blame-faded",
                },
                isWholeLine: true,
              },
            });
          }
        }
      }
    }
    
    // Apply decorations
    this.decorationIds = this.editor.deltaDecorations(this.decorationIds, newDecorations);
  }
  
  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.clearDecorations();
    this.cursorDisposable?.dispose();
    this.scrollDisposable?.dispose();
    this.hoverProviderDisposable?.dispose();
    this.editor = null;
    this.monaco = null;
    this.blameData.clear();
  }
  
  /**
   * Get blame information for a specific line
   * Useful for external access to blame data
   */
  getBlameForLine(lineNumber: number): BlameLineInfo | undefined {
    return this.blameData.get(lineNumber);
  }
  
  /**
   * Fetch blame data for a specific line range (partial blame for performance).
   * Merges results into existing blame data.
   */
  async fetchBlameForRange(startLine: number, endLine: number): Promise<void> {
    if (!this.filePath) return;
    
    try {
      const projectPath = getProjectPath();
      if (!projectPath) return;
      
      const relativePath = getRelativePath(this.filePath);
      const entries = await gitBlameLineRange(projectPath, relativePath, startLine, endLine);
      
      for (const entry of entries) {
        for (let line = entry.lineStart; line <= entry.lineEnd; line++) {
          this.blameData.set(line, {
            lineNumber: line,
            author: entry.author,
            authorEmail: entry.authorEmail || '',
            date: entry.date,
            hash: entry.hash,
            message: entry.message || entry.content,
          });
        }
      }
      
      this.updateDecorations();
    } catch (error) {
      console.debug("[InlineBlame] Failed to fetch blame range:", error);
    }
  }
}

// ============================================================================
// Global State
// ============================================================================

/** Global inline blame mode state */
const [globalInlineBlameMode, setGlobalInlineBlameMode] = createSignal<InlineBlameMode>("off");

/** Get the current inline blame mode */
export function getInlineBlameMode(): InlineBlameMode {
  return globalInlineBlameMode();
}

/** Set the inline blame mode */
export function setInlineBlameMode(mode: InlineBlameMode): void {
  setGlobalInlineBlameMode(mode);
  // Dispatch event for editors to respond
  window.dispatchEvent(new CustomEvent("inline-blame:mode-changed", { detail: { mode } }));
}

/** Toggle inline blame mode */
export function toggleInlineBlame(): void {
  const currentMode = globalInlineBlameMode();
  // Cycle through modes: off -> currentLine -> allLines -> off
  const nextMode: InlineBlameMode = 
    currentMode === "off" ? "currentLine" :
    currentMode === "currentLine" ? "allLines" : "off";
  
  setInlineBlameMode(nextMode);
}

// ============================================================================
// SolidJS Hook for Use in Components
// ============================================================================

/**
 * Hook to use inline blame in a component.
 * Manages the InlineBlameManager lifecycle.
 */
export function useInlineBlame(options: () => InlineBlameOptions): {
  mode: () => InlineBlameMode;
  setMode: (mode: InlineBlameMode) => void;
  toggle: () => void;
  refresh: () => void;
} {
  const manager = new InlineBlameManager();
  
  // Initialize when editor and monaco are available
  createEffect(() => {
    const opts = options();
    if (opts.editor && opts.monaco && opts.filePath) {
      manager.initialize(
        opts.editor,
        opts.monaco,
        opts.filePath,
        opts.mode,
        opts.showMessage ?? true,
        opts.maxMessageLength ?? 50
      );
    }
  });
  
  // Update mode when it changes
  createEffect(() => {
    const opts = options();
    manager.setMode(opts.mode);
  });
  
  // Update file path when it changes
  createEffect(() => {
    const opts = options();
    if (opts.filePath) {
      manager.setFilePath(opts.filePath);
    }
  });
  
  // Clean up on unmount
  onCleanup(() => {
    manager.dispose();
  });
  
  return {
    mode: globalInlineBlameMode,
    setMode: setInlineBlameMode,
    toggle: toggleInlineBlame,
    refresh: () => manager.fetchBlameData(),
  };
}

// ============================================================================
// Export Manager Instance Creator
// ============================================================================

/**
 * Create a new InlineBlameManager instance.
 * Use this when you need manual control over the manager lifecycle.
 */
export function createInlineBlameManager(): InlineBlameManager {
  return new InlineBlameManager();
}