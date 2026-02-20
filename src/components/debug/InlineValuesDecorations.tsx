/**
 * InlineValuesDecorations.tsx
 * 
 * Component and hooks for displaying inline variable values in the Monaco editor
 * during debugging sessions. Shows evaluated variable values directly in the code.
 */

import { createSignal, createEffect, onCleanup, createMemo } from "solid-js";
import type * as monaco from "monaco-editor";
import { useDebug } from "../../context/DebugContext";
import {
  formatInlineValue,
  extractVariableNames,
  getInlineValuesManager,
  injectInlineValueStyles,
  type InlineValue,
  type InlineValuesDocument,
} from "../../utils/inlineValues";
import type { InlineValueState } from "../../types/debug";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Settings for inline values display
 */
export interface InlineValuesSettings {
  /** Whether inline values are enabled */
  enabled: boolean;
  /** Maximum length for displayed values before truncation */
  maxValueLength: number;
  /** Whether to show type information */
  showTypes: boolean;
  /** Debounce delay in ms for updates */
  debounceMs: number;
}

/**
 * Default settings for inline values
 */
export const DEFAULT_INLINE_VALUES_SETTINGS: InlineValuesSettings = {
  enabled: true,
  maxValueLength: 50,
  showTypes: true,
  debounceMs: 100,
};

/**
 * Props for the useInlineValues hook
 */
export interface UseInlineValuesProps {
  /** Monaco editor instance */
  editor: () => monaco.editor.IStandaloneCodeEditor | null;
  /** Current file path */
  filePath: () => string | null;
  /** Settings for inline values */
  settings?: Partial<InlineValuesSettings>;
}

/**
 * Return type for useInlineValues hook
 */
export interface UseInlineValuesReturn {
  /** Current inline value state */
  state: () => InlineValueState;
  /** Force refresh inline values */
  refresh: () => Promise<void>;
  /** Clear all inline value decorations */
  clear: () => void;
  /** Whether inline values are currently loading */
  isLoading: () => boolean;
  /** Last error if any */
  error: () => string | null;
}

// =============================================================================
// CSS STYLES
// =============================================================================

/**
 * CSS class name for inline value decorations
 */
const INLINE_VALUE_CLASS = "cortex-inline-value";
const INLINE_VALUE_CLASS_TYPE = "cortex-inline-value-type";

/**
 * Get additional CSS styles for inline values
 */
function getAdditionalStyles(): string {
  return `
    .${INLINE_VALUE_CLASS} {
      color: var(--cortex-syntax-comment);
      font-style: italic;
      font-family: var(--font-mono, 'Consolas', 'Monaco', monospace);
      font-size: 0.9em;
      opacity: 0.85;
      margin-left: 2em;
      pointer-events: none;
      user-select: none;
    }
    
    .${INLINE_VALUE_CLASS_TYPE} {
      color: var(--cortex-syntax-keyword);
      font-style: normal;
      opacity: 0.7;
    }
    
    /* Dark theme */
    .monaco-editor.vs-dark .${INLINE_VALUE_CLASS} {
      color: var(--cortex-syntax-comment);
    }
    .monaco-editor.vs-dark .${INLINE_VALUE_CLASS_TYPE} {
      color: var(--cortex-syntax-keyword);
    }
    
    /* Light theme */
    .monaco-editor.vs .${INLINE_VALUE_CLASS} {
      color: var(--cortex-success);
    }
    .monaco-editor.vs .${INLINE_VALUE_CLASS_TYPE} {
      color: var(--cortex-info);
    }
    
    /* High contrast theme */
    .monaco-editor.hc-black .${INLINE_VALUE_CLASS} {
      color: var(--cortex-success);
    }
    .monaco-editor.hc-black .${INLINE_VALUE_CLASS_TYPE} {
      color: var(--cortex-syntax-variable);
    }
    
    /* High contrast light theme */
    .monaco-editor.hc-light .${INLINE_VALUE_CLASS} {
      color: var(--cortex-success);
    }
    .monaco-editor.hc-light .${INLINE_VALUE_CLASS_TYPE} {
      color: var(--cortex-info);
    }
  `;
}

/**
 * Inject inline value styles into the document
 */
function injectStyles(): void {
  const styleId = "cortex-inline-values-decorations-styles";
  
  if (document.getElementById(styleId)) {
    return;
  }
  
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = getAdditionalStyles();
  document.head.appendChild(style);
  
  // Also inject base styles from inlineValues utility
  injectInlineValueStyles();
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a Monaco decoration for an inline value
 */
function createDecoration(
  lineNumber: number,
  value: string,
  variableName: string,
  type: string | undefined,
  settings: InlineValuesSettings
): monaco.editor.IModelDeltaDecoration {
  const formattedValue = formatInlineValue(value, settings.maxValueLength);
  
  let displayText = ` // ${variableName} = ${formattedValue}`;
  if (settings.showTypes && type) {
    displayText = ` // ${variableName}: ${type} = ${formattedValue}`;
  }
  
  return {
    range: {
      startLineNumber: lineNumber,
      startColumn: Number.MAX_SAFE_INTEGER, // End of line
      endLineNumber: lineNumber,
      endColumn: Number.MAX_SAFE_INTEGER,
    },
    options: {
      after: {
        content: displayText,
        inlineClassName: INLINE_VALUE_CLASS,
      },
      isWholeLine: false,
      stickiness: 1, // NeverGrowsWhenTypingAtEdges
    },
  };
}

/**
 * Get language ID from file path
 */
function getLanguageId(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    c: "c",
    h: "c",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    kts: "kotlin",
    lua: "lua",
  };
  
  return languageMap[ext] || "javascript";
}

/**
 * Create a document adapter for the inline values provider
 */
function createDocumentAdapter(
  editor: monaco.editor.IStandaloneCodeEditor,
  filePath: string
): InlineValuesDocument {
  const model = editor.getModel();
  
  return {
    uri: filePath,
    getText(): string {
      return model?.getValue() || "";
    },
    lineAt(line: number): { text: string } {
      const lineContent = model?.getLineContent(line + 1) || ""; // Monaco uses 1-based
      return { text: lineContent };
    },
  };
}

// =============================================================================
// HOOK: useInlineValues
// =============================================================================

/**
 * Hook for managing inline value decorations in Monaco editor
 * 
 * Integrates with DebugContext to show variable values inline during debugging.
 * Automatically updates when the debug frame changes.
 * 
 * @example
 * ```tsx
 * const { state, refresh, clear } = useInlineValues({
 *   editor: () => editorRef,
 *   filePath: () => currentFile,
 *   settings: { maxValueLength: 60 }
 * });
 * ```
 */
export function useInlineValues(props: UseInlineValuesProps): UseInlineValuesReturn {
  const debug = useDebug();
  
  // Merge settings with defaults
  const settings = createMemo<InlineValuesSettings>(() => ({
    ...DEFAULT_INLINE_VALUES_SETTINGS,
    ...props.settings,
  }));
  
  // State
  const [state, setState] = createSignal<InlineValueState>({
    enabled: true,
    values: [],
  });
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [decorationIds, setDecorationIds] = createSignal<string[]>([]);
  
  // Debounce timer
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Inject styles on first use
  injectStyles();
  
  /**
   * Clear all decorations from the editor
   */
  const clearDecorations = () => {
    const editor = props.editor();
    const ids = decorationIds();
    
    if (editor && ids.length > 0) {
      editor.deltaDecorations(ids, []);
      setDecorationIds([]);
    }
  };
  
  /**
   * Clear inline values state and decorations
   */
  const clear = () => {
    clearDecorations();
    setState({ enabled: state().enabled, values: [] });
    setError(null);
  };
  
  /**
   * Refresh inline values by evaluating variables
   */
  const refresh = async (): Promise<void> => {
    const editor = props.editor();
    const filePath = props.filePath();
    const currentSettings = settings();
    
    // Check prerequisites
    if (!editor || !filePath || !currentSettings.enabled) {
      clear();
      return;
    }
    
    // Check debug state
    if (!debug.state.isDebugging || !debug.state.isPaused) {
      clear();
      return;
    }
    
    // Check if we're stopped in this file
    if (debug.state.currentFile !== filePath) {
      clear();
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const model = editor.getModel();
      if (!model) {
        clear();
        return;
      }
      
      const languageId = getLanguageId(filePath);
      
      // Get visible range
      const visibleRanges = editor.getVisibleRanges();
      if (visibleRanges.length === 0) {
        clear();
        return;
      }
      
      const startLine = visibleRanges[0].startLineNumber;
      const endLine = visibleRanges[visibleRanges.length - 1].endLineNumber;
      const stoppedLine = debug.state.currentLine || startLine;
      

      
      // Collect variables from visible lines up to stopped line
      const variableNames = new Set<string>();
      const lineEndColumn = Math.min(endLine, stoppedLine);
      
      for (let line = startLine; line <= lineEndColumn; line++) {
        const lineText = model.getLineContent(line);
        const vars = extractVariableNames(lineText, languageId);
        vars.forEach(v => variableNames.add(v.name));
      }
      
      // Evaluate variables using debug context
      const evaluatedValues = new Map<string, { value: string; type?: string }>();
      
      for (const varName of variableNames) {
        try {
          const result = await debug.evaluate(varName, "watch");
          if (result && result.result) {
            evaluatedValues.set(varName, {
              value: result.result,
              type: result.type,
            });
          }
        } catch {
          // Variable may not be in scope, skip it
        }
      }
      
      // Build inline values
      const inlineValues: InlineValue[] = [];
      const seenOnLine = new Map<number, Set<string>>();
      
      for (let line = startLine; line <= lineEndColumn; line++) {
        const lineText = model.getLineContent(line);
        const vars = extractVariableNames(lineText, languageId);
        
        if (!seenOnLine.has(line)) {
          seenOnLine.set(line, new Set());
        }
        const lineVars = seenOnLine.get(line)!;
        
        for (const varInfo of vars) {
          if (lineVars.has(varInfo.name)) continue;
          
          const evaluated = evaluatedValues.get(varInfo.name);
          if (!evaluated) continue;
          
          lineVars.add(varInfo.name);
          
          inlineValues.push({
            range: {
              startLine: line,
              startColumn: varInfo.range.startColumn,
              endLine: line,
              endColumn: varInfo.range.endColumn,
            },
            text: evaluated.value,
            type: "variable",
          });
        }
      }
      
      // Update state - convert range format from inlineValues.ts to debug.ts format
      // and filter/map type to match InlineValueType ("variable" | "expression")
      setState({
        enabled: currentSettings.enabled,
        values: inlineValues
          .filter(iv => iv.type === "variable" || iv.type === "expression")
          .map(iv => ({
            range: {
              startLine: iv.range.startLine,
              startCharacter: iv.range.startColumn,
              endLine: iv.range.endLine,
              endCharacter: iv.range.endColumn,
            },
            text: iv.text,
            type: iv.type as "variable" | "expression",
          })),
      });
      
      // Create decorations
      const decorations: monaco.editor.IModelDeltaDecoration[] = [];
      const processedLines = new Set<number>();
      
      for (const inlineValue of inlineValues) {
        const lineNumber = inlineValue.range.startLine;
        
        // Only one inline value per line for cleaner display
        if (processedLines.has(lineNumber)) continue;
        processedLines.add(lineNumber);
        
        // Find the variable name for this inline value
        const lineText = model.getLineContent(lineNumber);
        const vars = extractVariableNames(lineText, languageId);
        
        // Find matching variable
        for (const varInfo of vars) {
          const evaluated = evaluatedValues.get(varInfo.name);
          if (evaluated) {
            decorations.push(
              createDecoration(
                lineNumber,
                evaluated.value,
                varInfo.name,
                evaluated.type,
                currentSettings
              )
            );
            break; // Only one per line
          }
        }
      }
      
      // Apply decorations
      clearDecorations();
      if (decorations.length > 0) {
        const newIds = editor.deltaDecorations([], decorations);
        setDecorationIds(newIds);
      }
      
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load inline values";
      setError(message);
      console.error("[InlineValues] Error:", err);
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Debounced refresh
   */
  const debouncedRefresh = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
      refresh();
      debounceTimer = null;
    }, settings().debounceMs);
  };
  
  // Effect: Update when debug state changes
  createEffect(() => {
    const isPaused = debug.state.isPaused;
    const isDebugging = debug.state.isDebugging;
    const frameId = debug.state.activeFrameId;
    const currentFile = debug.state.currentFile;
    const filePath = props.filePath();
    const enabled = settings().enabled;
    
    // Track dependencies
    void isPaused;
    void frameId;
    void currentFile;
    void filePath;
    
    if (!enabled) {
      clear();
      return;
    }
    
    if (!isDebugging || !isPaused) {
      clear();
      return;
    }
    
    // Refresh when frame changes or file matches
    if (currentFile === filePath) {
      debouncedRefresh();
    } else {
      clear();
    }
  });
  
  // Effect: Update when editor changes
  createEffect(() => {
    const editor = props.editor();
    
    if (!editor) {
      clear();
      return;
    }
    
    // Listen to scroll events for updating visible values
    const scrollDisposable = editor.onDidScrollChange(() => {
      if (debug.state.isPaused && settings().enabled) {
        debouncedRefresh();
      }
    });
    
    onCleanup(() => {
      scrollDisposable.dispose();
    });
  });
  
  // Cleanup on unmount
  onCleanup(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    clearDecorations();
  });
  
  return {
    state,
    refresh,
    clear,
    isLoading,
    error,
  };
}

// =============================================================================
// HOOK: useInlineValuesManager
// =============================================================================

/**
 * Hook for accessing the global InlineValuesManager
 * 
 * Provides access to the singleton manager for registering
 * custom providers and managing inline values across editors.
 */
export function useInlineValuesManager() {
  const manager = getInlineValuesManager();
  
  onCleanup(() => {
    // Don't dispose the singleton, just clear decorations
    manager.clearDecorations();
  });
  
  return manager;
}

// =============================================================================
// COMPONENT: InlineValuesOverlay
// =============================================================================

/**
 * Props for InlineValuesOverlay component
 */
export interface InlineValuesOverlayProps {
  /** Monaco editor instance */
  editor: monaco.editor.IStandaloneCodeEditor | null;
  /** Current file path */
  filePath: string | null;
  /** Settings override */
  settings?: Partial<InlineValuesSettings>;
}

/**
 * Component that manages inline value decorations for an editor
 * 
 * This component doesn't render any UI itself, but manages the
 * Monaco decorations for inline values during debugging.
 * 
 * @example
 * ```tsx
 * <InlineValuesOverlay
 *   editor={editorInstance}
 *   filePath="/path/to/file.ts"
 *   settings={{ maxValueLength: 80 }}
 * />
 * ```
 */
export function InlineValuesOverlay(props: InlineValuesOverlayProps) {
  // Use the hook to manage inline values
  useInlineValues({
    editor: () => props.editor,
    filePath: () => props.filePath,
    settings: props.settings,
  });
  
  // This component doesn't render anything
  return null;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  INLINE_VALUE_CLASS,
  INLINE_VALUE_CLASS_TYPE,
  getLanguageId,
  createDocumentAdapter,
  createDecoration,
};

