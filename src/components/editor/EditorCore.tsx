/**
 * EditorCore - Core Monaco editor creation, model management, and base options
 *
 * Extracts Monaco instance creation, model management, base editor options
 * construction, and the SmartSelectManager from CodeEditor.tsx for better
 * modularity and reusability.
 */

import type * as Monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";
import { LANGUAGE_MAP } from "./modules/EditorTypes";
import { estimateLineCount } from "./modules/EditorUtils";
import {
  MonacoManager,
  LARGE_FILE_THRESHOLDS,
  type LargeFileSettings,
} from "@/utils/monacoManager";
import { editorLogger } from "@/utils/logger";
import type { EditorSettings, SettingsState } from "@/context/SettingsContext";

// ============================================================================
// Selection Range Types (LSP Specification)
// ============================================================================

/** LSP SelectionRange for smart expand/shrink selection */
export interface LSPSelectionRange {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  parent?: LSPSelectionRange;
}

/** LSP Selection Range response */
export interface LSPSelectionRangeResponse {
  ranges: LSPSelectionRange[] | null;
}

// ============================================================================
// Module-Level State
// ============================================================================

/**
 * Track whether LSP providers have been registered globally.
 * This prevents duplicate registrations across editor instances.
 */
export let providersRegistered = false;

/**
 * Set the providersRegistered flag.
 * Used by CodeEditor to mark providers as registered after first initialization.
 */
export function setProvidersRegistered(value: boolean): void {
  providersRegistered = value;
}

/** Global Monaco instance reference */
export let monacoInstance: typeof Monaco | null = null;

/**
 * Set the global Monaco instance reference.
 * Used by CodeEditor during Monaco initialization.
 */
export function setMonacoInstance(instance: typeof Monaco | null): void {
  monacoInstance = instance;
}

// ============================================================================
// Smart Select Manager - Tracks selection history for expand/shrink
// ============================================================================

/**
 * Manages smart selection with history tracking.
 * Supports expand (Word → String → Expression → Statement → Block → Function → Class → File)
 * and shrink (reverse through history) operations.
 */
export class SmartSelectManager {
  private selectionHistory: Map<string, Monaco.IRange[]> = new Map();
  private lastPosition: Map<string, { line: number; column: number }> =
    new Map();
  private cachedRanges: Map<string, LSPSelectionRange[]> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private readonly CACHE_TTL_MS = 2000;

  /**
   * Get a unique key for tracking selection per editor instance
   */
  private getEditorKey(uri: string): string {
    return uri;
  }

  /**
   * Clear selection history for an editor (also serves as clearFileCache)
   */
  clearHistory(uri: string): void {
    const key = this.getEditorKey(uri);
    this.selectionHistory.delete(key);
    this.lastPosition.delete(key);
    this.cachedRanges.delete(key);
    this.cacheTimestamps.delete(key);
  }

  /**
   * Clear cache for a specific file URI (alias for clearHistory)
   */
  clearFileCache(uri: string): void {
    this.clearHistory(uri);
  }

  /**
   * Clear all caches - call on component cleanup
   */
  clearAllCaches(): void {
    this.selectionHistory.clear();
    this.lastPosition.clear();
    this.cachedRanges.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Prune old caches based on timestamp - call periodically to prevent memory leaks
   * @param maxAge Maximum age in milliseconds (default: 5 minutes)
   */
  pruneOldCaches(maxAge: number = 300000): void {
    const now = Date.now();
    for (const [uri, timestamp] of this.cacheTimestamps) {
      if (now - timestamp > maxAge) {
        this.clearFileCache(uri);
      }
    }
  }

  /**
   * Check if the cursor has moved, invalidating history
   */
  private hasPositionChanged(
    uri: string,
    currentPos: { line: number; column: number },
  ): boolean {
    const key = this.getEditorKey(uri);
    const lastPos = this.lastPosition.get(key);
    if (!lastPos) return true;
    return (
      lastPos.line !== currentPos.line || lastPos.column !== currentPos.column
    );
  }

  /**
   * Update the tracked position
   */
  private updatePosition(
    uri: string,
    pos: { line: number; column: number },
  ): void {
    const key = this.getEditorKey(uri);
    this.lastPosition.set(key, { ...pos });
  }

  /**
   * Push a selection to history
   */
  private pushToHistory(uri: string, range: Monaco.IRange): void {
    const key = this.getEditorKey(uri);
    const history = this.selectionHistory.get(key) || [];

    const lastRange = history[history.length - 1];
    if (
      lastRange &&
      lastRange.startLineNumber === range.startLineNumber &&
      lastRange.startColumn === range.startColumn &&
      lastRange.endLineNumber === range.endLineNumber &&
      lastRange.endColumn === range.endColumn
    ) {
      return;
    }

    history.push({ ...range });
    this.selectionHistory.set(key, history);
  }

  /**
   * Pop from selection history (for shrink)
   */
  private popFromHistory(uri: string): Monaco.IRange | null {
    const key = this.getEditorKey(uri);
    const history = this.selectionHistory.get(key) || [];

    if (history.length <= 1) {
      return null;
    }

    history.pop();
    this.selectionHistory.set(key, history);

    return history[history.length - 1] || null;
  }

  /**
   * Get cached LSP selection ranges or fetch new ones
   */
  private async getSelectionRanges(
    uri: string,
    position: { line: number; character: number },
  ): Promise<LSPSelectionRange[] | null> {
    const key = this.getEditorKey(uri);
    const now = Date.now();
    const cachedTimestamp = this.cacheTimestamps.get(key);

    if (cachedTimestamp && now - cachedTimestamp < this.CACHE_TTL_MS) {
      return this.cachedRanges.get(key) || null;
    }

    try {
      const response = await invoke<LSPSelectionRangeResponse>(
        "lsp_selection_range",
        {
          params: {
            uri,
            positions: [position],
          },
        },
      );

      if (response?.ranges && response.ranges.length > 0) {
        this.cachedRanges.set(key, response.ranges);
        this.cacheTimestamps.set(key, now);
        return response.ranges;
      }
    } catch (error) {
      console.debug("LSP selection range not available:", error);
    }

    return null;
  }

  /**
   * Convert LSP SelectionRange to flat array of Monaco ranges (from innermost to outermost)
   */
  private flattenSelectionRanges(
    lspRange: LSPSelectionRange,
    _monaco: typeof Monaco,
  ): Monaco.IRange[] {
    const ranges: Monaco.IRange[] = [];
    let current: LSPSelectionRange | undefined = lspRange;

    while (current) {
      ranges.push({
        startLineNumber: current.range.start.line + 1,
        startColumn: current.range.start.character + 1,
        endLineNumber: current.range.end.line + 1,
        endColumn: current.range.end.character + 1,
      });
      current = current.parent;
    }

    return ranges;
  }

  /**
   * Find the next larger selection from the available ranges
   */
  private findNextLargerRange(
    currentSelection: Monaco.IRange,
    availableRanges: Monaco.IRange[],
  ): Monaco.IRange | null {
    for (const range of availableRanges) {
      const containsCurrent =
        (range.startLineNumber < currentSelection.startLineNumber ||
          (range.startLineNumber === currentSelection.startLineNumber &&
            range.startColumn <= currentSelection.startColumn)) &&
        (range.endLineNumber > currentSelection.endLineNumber ||
          (range.endLineNumber === currentSelection.endLineNumber &&
            range.endColumn >= currentSelection.endColumn));

      const isLarger =
        range.startLineNumber < currentSelection.startLineNumber ||
        range.startColumn < currentSelection.startColumn ||
        range.endLineNumber > currentSelection.endLineNumber ||
        range.endColumn > currentSelection.endColumn;

      if (containsCurrent && isLarger) {
        return range;
      }
    }
    return null;
  }

  /**
   * Expand selection - goes from smaller to larger scope
   * Order: Word → String → Expression → Statement → Block → Function → Class → File
   */
  async expandSelection(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
  ): Promise<void> {
    const model = editor.getModel();
    const selection = editor.getSelection();
    if (!model || !selection) return;

    const uri = model.uri.toString();
    const position = selection.getPosition();

    if (
      this.hasPositionChanged(uri, {
        line: position.lineNumber,
        column: position.column,
      })
    ) {
      this.clearHistory(uri);
    }

    this.pushToHistory(uri, {
      startLineNumber: selection.startLineNumber,
      startColumn: selection.startColumn,
      endLineNumber: selection.endLineNumber,
      endColumn: selection.endColumn,
    });

    const lspRanges = await this.getSelectionRanges(uri, {
      line: position.lineNumber - 1,
      character: position.column - 1,
    });

    if (lspRanges && lspRanges.length > 0) {
      const flatRanges = this.flattenSelectionRanges(lspRanges[0], monaco);
      const nextRange = this.findNextLargerRange(
        {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn,
        },
        flatRanges,
      );

      if (nextRange) {
        editor.setSelection(
          new monaco.Selection(
            nextRange.startLineNumber,
            nextRange.startColumn,
            nextRange.endLineNumber,
            nextRange.endColumn,
          ),
        );
        this.pushToHistory(uri, nextRange);
        this.updatePosition(uri, {
          line: position.lineNumber,
          column: position.column,
        });
        return;
      }
    }

    editor.trigger("smartSelect", "editor.action.smartSelect.expand", null);

    const newSelection = editor.getSelection();
    if (newSelection) {
      this.pushToHistory(uri, {
        startLineNumber: newSelection.startLineNumber,
        startColumn: newSelection.startColumn,
        endLineNumber: newSelection.endLineNumber,
        endColumn: newSelection.endColumn,
      });
    }
    this.updatePosition(uri, {
      line: position.lineNumber,
      column: position.column,
    });
  }

  /**
   * Shrink selection - goes from larger to smaller scope (reverse of expand)
   */
  shrinkSelection(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
  ): void {
    const model = editor.getModel();
    const selection = editor.getSelection();
    if (!model || !selection) return;

    const uri = model.uri.toString();

    const previousRange = this.popFromHistory(uri);

    if (previousRange) {
      editor.setSelection(
        new monaco.Selection(
          previousRange.startLineNumber,
          previousRange.startColumn,
          previousRange.endLineNumber,
          previousRange.endColumn,
        ),
      );
      return;
    }

    editor.trigger("smartSelect", "editor.action.smartSelect.shrink", null);
  }
}

/** Global Smart Select Manager instance */
export const smartSelectManager = new SmartSelectManager();

// ============================================================================
// Editor Options Builder
// ============================================================================

/**
 * Constructs the IStandaloneEditorConstructionOptions object from language-specific
 * editor settings, global settings state, and large file optimizations.
 *
 * @param langEditorSettings - Effective editor settings (merged base + language overrides)
 * @param settingsState - Global settings state from SettingsContext
 * @param initialCursorStyle - Cursor style based on vim mode ("block" or "line")
 * @param lineCount - Estimated line count for large file optimizations
 * @param monacoManager - MonacoManager instance for applying file-size options
 * @param largeFileSettings - Large file optimization settings from user configuration
 * @returns The constructed editor options object
 */
export function buildEditorOptions(
  langEditorSettings: EditorSettings,
  settingsState: SettingsState,
  initialCursorStyle: Monaco.editor.IStandaloneEditorConstructionOptions["cursorStyle"],
  lineCount: number,
  monacoManager: MonacoManager,
  largeFileSettings: LargeFileSettings,
): Monaco.editor.IStandaloneEditorConstructionOptions {
  const baseOptions: Monaco.editor.IStandaloneEditorConstructionOptions = {
    theme: "cortex-dark",
    automaticLayout: true,
    lineNumbers: langEditorSettings.lineNumbers ?? "on",
    lineNumbersMinChars: 4,
    glyphMargin: true,
    folding: langEditorSettings.foldingEnabled ?? true,
    foldingHighlight: true,
    foldingStrategy: "indentation",
    showFoldingControls:
      langEditorSettings.showFoldingControls ?? "mouseover",
    minimap: {
      enabled: langEditorSettings.minimapEnabled ?? true,
      autohide: "mouseover",
      side: "right",
      showSlider: "mouseover",
      renderCharacters: false,
      maxColumn: 80,
      scale: 1,
      size: "proportional",
    },
    fontSize: langEditorSettings.fontSize ?? 13,
    lineHeight:
      (langEditorSettings.lineHeight ?? 1.5) *
      (langEditorSettings.fontSize ?? 13),
    fontFamily:
      langEditorSettings.fontFamily ??
      "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
    fontLigatures: langEditorSettings.fontLigatures ?? true,
    tabSize: langEditorSettings.tabSize ?? 2,
    insertSpaces: langEditorSettings.insertSpaces ?? true,
    detectIndentation: true,
    wordWrap: langEditorSettings.wordWrap ?? "off",
    wordWrapColumn: langEditorSettings.wordWrapColumn ?? 80,
    scrollBeyondLastLine: langEditorSettings.scrollBeyondLastLine ?? false,
    smoothScrolling: langEditorSettings.smoothScrolling ?? true,
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",
    cursorStyle: initialCursorStyle,
    cursorWidth: 2,
    renderLineHighlight: "line",
    renderWhitespace: langEditorSettings.renderWhitespace ?? "selection",
    renderControlCharacters:
      settingsState.settings.editor.renderControlCharacters ?? false,
    roundedSelection: true,
    bracketPairColorization: {
      enabled: langEditorSettings.bracketPairColorization ?? true,
      independentColorPoolPerBracketType: true,
    },
    matchBrackets: "always",
    autoClosingBrackets: langEditorSettings.autoClosingBrackets ?? "always",
    autoClosingQuotes: "always",
    autoClosingDelete: "always",
    autoSurround: "languageDefined",
    linkedEditing: langEditorSettings.linkedEditing ?? true,
    guides: {
      bracketPairs: langEditorSettings.guidesBracketPairs ?? true,
      bracketPairsHorizontal: true,
      highlightActiveBracketPair: true,
      indentation: langEditorSettings.guidesIndentation ?? true,
      highlightActiveIndentation: true,
    },
    padding: { top: 8, bottom: 8 },
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
      useShadows: false,
    },
    multiCursorModifier: "alt",
    multiCursorMergeOverlapping: true,
    columnSelection: false,
    dragAndDrop: true,
    copyWithSyntaxHighlighting: true,
    occurrencesHighlight: "singleFile",
    selectionHighlight: true,
    find: {
      addExtraSpaceOnTop: false,
      seedSearchStringFromSelection: "selection",
      autoFindInSelection: "multiline",
    },
    quickSuggestions: true,
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: "on",
    links: true,
    contextmenu: true,
    stickyScroll: {
      enabled: langEditorSettings.stickyScrollEnabled ?? false,
      maxLineCount: 5,
    },
    inlayHints: {
      enabled: "on",
      fontSize: 12,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      padding: true,
    },
    codeLens: settingsState.settings.editor.codeLens?.enabled ?? true,
    codeLensFontFamily:
      settingsState.settings.editor.codeLens?.fontFamily || undefined,
    codeLensFontSize:
      settingsState.settings.editor.codeLens?.fontSize || 12,
    formatOnType: langEditorSettings.formatOnType ?? false,
    smartSelect: {
      selectLeadingAndTrailingWhitespace: false,
      selectSubwords: true,
    },
    unicodeHighlight: {
      ambiguousCharacters:
        settingsState.settings.editor.unicodeHighlight
          ?.ambiguousCharacters ?? true,
      invisibleCharacters:
        settingsState.settings.editor.unicodeHighlight
          ?.invisibleCharacters ?? true,
      nonBasicASCII:
        settingsState.settings.editor.unicodeHighlight?.nonBasicASCII ??
        false,
      includeComments:
        settingsState.settings.editor.unicodeHighlight?.includeComments ??
        "inUntrustedWorkspace",
      includeStrings:
        settingsState.settings.editor.unicodeHighlight?.includeStrings ??
        true,
      allowedCharacters: (settingsState.settings.editor.unicodeHighlight
        ?.allowedCharacters ?? {}) as Record<string, true>,
      allowedLocales: (settingsState.settings.editor.unicodeHighlight
        ?.allowedLocales ?? { _os: true, _vscode: true }) as Record<
        string,
        true
      >,
    },
    largeFileOptimizations:
      settingsState.settings.editor.largeFileOptimizations ?? true,
    maxTokenizationLineLength:
      settingsState.settings.editor.maxTokenizationLineLength ?? 20000,
  };

  const editorOptions = monacoManager.getOptionsForFile(
    baseOptions,
    lineCount,
    largeFileSettings,
  );

  if (
    largeFileSettings.largeFileOptimizations &&
    lineCount > LARGE_FILE_THRESHOLDS.DISABLE_MINIMAP
  ) {
    editorLogger.debug(
      `Large file detected (${lineCount} lines), applying optimizations`,
    );
  }

  return editorOptions;
}

// ============================================================================
// Editor Instance Creation
// ============================================================================

/**
 * Creates a new Monaco editor instance in the given container.
 *
 * @param containerRef - The DOM element to mount the editor in
 * @param editorOptions - Construction options for the editor
 * @param monaco - The Monaco instance to use for creation
 * @returns The created standalone code editor
 */
export function initializeEditor(
  containerRef: HTMLDivElement,
  editorOptions: Monaco.editor.IStandaloneEditorConstructionOptions,
  monaco: typeof Monaco,
): Monaco.editor.IStandaloneCodeEditor {
  return monaco.editor.create(containerRef, editorOptions);
}

// ============================================================================
// Model Management
// ============================================================================

/**
 * Swaps the model on an existing editor instance, applying large file
 * optimizations and cursor style updates.
 *
 * @param editorInstance - The existing editor instance
 * @param monacoManager - MonacoManager for model caching
 * @param filePath - File path for the model
 * @param content - File content
 * @param monacoLanguage - Monaco language identifier
 * @param lineCount - Estimated line count for optimizations
 * @param largeFileSettings - Large file settings from user configuration
 * @param langEditorSettings - Language-specific editor settings
 * @param initialCursorStyle - Cursor style to apply ("block" or "line")
 */
export function swapEditorModel(
  editorInstance: Monaco.editor.IStandaloneCodeEditor,
  monacoManager: MonacoManager,
  filePath: string,
  content: string,
  monacoLanguage: string,
  lineCount: number,
  largeFileSettings: LargeFileSettings,
  langEditorSettings: EditorSettings,
  initialCursorStyle: Monaco.editor.IStandaloneEditorConstructionOptions["cursorStyle"],
): void {
  const model = monacoManager.getOrCreateModel(
    filePath,
    content,
    monacoLanguage,
  );
  editorInstance.setModel(model);

  monacoManager.updateEditorForFileSize(
    editorInstance,
    lineCount,
    largeFileSettings,
    langEditorSettings.minimapEnabled ?? true,
    langEditorSettings.foldingEnabled ?? true,
    langEditorSettings.bracketPairColorization ?? true,
  );

  editorInstance.updateOptions({ cursorStyle: initialCursorStyle });
}

/**
 * Creates and sets a model for a newly created editor instance.
 *
 * @param editorInstance - The newly created editor instance
 * @param monacoManager - MonacoManager for model caching
 * @param filePath - File path for the model
 * @param content - File content
 * @param monacoLanguage - Monaco language identifier
 * @returns The created or cached text model
 */
export function setupEditorModel(
  editorInstance: Monaco.editor.IStandaloneCodeEditor,
  monacoManager: MonacoManager,
  filePath: string,
  content: string,
  monacoLanguage: string,
): Monaco.editor.ITextModel {
  const model = monacoManager.getOrCreateModel(
    filePath,
    content,
    monacoLanguage,
  );
  editorInstance.setModel(model);
  return model;
}

export { LANGUAGE_MAP, estimateLineCount, LARGE_FILE_THRESHOLDS };
export type { LargeFileSettings, EditorSettings };
