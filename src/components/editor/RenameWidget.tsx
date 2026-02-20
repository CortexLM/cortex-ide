/**
 * RenameWidget - Symbol Renaming Widget
 * 
 * Provides an inline input for renaming symbols across the codebase.
 * Integrates with LSP for symbol rename operations with real-time validation
 * and change preview.
 * 
 * Features:
 * - Inline input positioned at the symbol location
 * - Real-time validation of new name
 * - Preview of changes (file count and occurrence count)
 * - Enter to confirm, Escape to cancel
 * - Auto-selection of the current symbol text
 * - Error display for validation failures
 * - Undo support after rename
 */

import { Show, createSignal, createEffect, onCleanup, onMount } from "solid-js";
import type * as Monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";
import type { 
  RenameLocation, 
  EditorRange 
} from "@/types/editor";
import type { 
  PrepareRenameResult, 
  WorkspaceEdit, 
  TextEdit,
  Range as LSPRange
} from "@/context/LSPContext";

// ============================================================================
// Types
// ============================================================================

/** Props for the RenameWidget component */
export interface RenameWidgetProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  /** LSP server ID for the current file */
  serverId?: string;
  /** Called when the widget should be closed */
  onClose?: () => void;
  /** Called when rename is successfully applied */
  onRename?: (oldName: string, newName: string, locations: RenameLocation[]) => void;
}

/** Internal state for the rename widget */
interface RenameState {
  visible: boolean;
  oldName: string;
  newName: string;
  position: Monaco.IPosition | null;
  range: EditorRange | null;
  uri: string | null;
  isLoading: boolean;
  error: string | null;
  preview: RenamePreview | null;
}

/** Preview information for rename operation */
interface RenamePreview {
  fileCount: number;
  occurrenceCount: number;
  locations: RenameLocation[];
}

/** Validation result for the new name */
interface ValidationResult {
  valid: boolean;
  message?: string;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate an identifier name based on common programming language rules.
 * Returns validation result with optional error message.
 */
function validateIdentifier(name: string, language?: string): ValidationResult {
  // Empty name is invalid
  if (!name || name.trim().length === 0) {
    return { valid: false, message: "Name cannot be empty" };
  }
  
  // Check for whitespace
  if (/\s/.test(name)) {
    return { valid: false, message: "Name cannot contain whitespace" };
  }
  
  // Check for starting with a number
  if (/^[0-9]/.test(name)) {
    return { valid: false, message: "Name cannot start with a number" };
  }
  
  // Language-specific validation
  const lang = language?.toLowerCase() || "";
  
  // Reserved words check (common across languages)
  const commonReserved = [
    "if", "else", "for", "while", "do", "switch", "case", "break", "continue",
    "return", "throw", "try", "catch", "finally", "new", "delete", "typeof",
    "void", "null", "undefined", "true", "false", "class", "function", "var",
    "let", "const", "import", "export", "default", "from", "as", "async", "await",
    "yield", "static", "public", "private", "protected", "extends", "implements",
    "interface", "type", "enum", "namespace", "module"
  ];
  
  // TypeScript/JavaScript specific
  if (["typescript", "javascript", "typescriptreact", "javascriptreact"].includes(lang)) {
    const jsReserved = [...commonReserved, "this", "super", "arguments", "eval", "with", "debugger"];
    if (jsReserved.includes(name)) {
      return { valid: false, message: `"${name}" is a reserved keyword` };
    }
    // Valid JS/TS identifier: starts with letter, $, or _, followed by letters, numbers, $, or _
    if (!/^[$_a-zA-Z][$_a-zA-Z0-9]*$/.test(name)) {
      return { valid: false, message: "Invalid identifier format" };
    }
  }
  
  // Rust specific
  if (lang === "rust") {
    const rustReserved = [
      "as", "break", "const", "continue", "crate", "else", "enum", "extern",
      "false", "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod",
      "move", "mut", "pub", "ref", "return", "self", "Self", "static", "struct",
      "super", "trait", "true", "type", "unsafe", "use", "where", "while",
      "async", "await", "dyn"
    ];
    if (rustReserved.includes(name)) {
      return { valid: false, message: `"${name}" is a reserved keyword in Rust` };
    }
    // Valid Rust identifier
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return { valid: false, message: "Invalid Rust identifier format" };
    }
  }
  
  // Python specific
  if (lang === "python") {
    const pythonReserved = [
      "False", "None", "True", "and", "as", "assert", "async", "await", "break",
      "class", "continue", "def", "del", "elif", "else", "except", "finally",
      "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal",
      "not", "or", "pass", "raise", "return", "try", "while", "with", "yield"
    ];
    if (pythonReserved.includes(name)) {
      return { valid: false, message: `"${name}" is a reserved keyword in Python` };
    }
    // Valid Python identifier
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return { valid: false, message: "Invalid Python identifier format" };
    }
  }
  
  // Go specific
  if (lang === "go") {
    const goReserved = [
      "break", "case", "chan", "const", "continue", "default", "defer", "else",
      "fallthrough", "for", "func", "go", "goto", "if", "import", "interface",
      "map", "package", "range", "return", "select", "struct", "switch", "type", "var"
    ];
    if (goReserved.includes(name)) {
      return { valid: false, message: `"${name}" is a reserved keyword in Go` };
    }
    // Valid Go identifier
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return { valid: false, message: "Invalid Go identifier format" };
    }
  }
  
  // Generic validation for other languages
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
    return { valid: false, message: "Invalid identifier format" };
  }
  
  return { valid: true };
}

/**
 * Convert LSP Range to EditorRange
 */
function lspRangeToEditorRange(range: LSPRange): EditorRange {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

/**
 * Convert WorkspaceEdit to RenameLocation array
 */
function workspaceEditToLocations(
  edit: WorkspaceEdit, 
  newName: string
): RenameLocation[] {
  const locations: RenameLocation[] = [];
  
  if (edit.changes) {
    for (const [uri, textEdits] of Object.entries(edit.changes)) {
      for (const textEdit of textEdits) {
        locations.push({
          uri,
          range: lspRangeToEditorRange(textEdit.range),
          newText: newName,
        });
      }
    }
  }
  
  return locations;
}

/**
 * Get language ID from URI
 */
function getLanguageFromUri(uri: string): string {
  const fileName = uri.split(/[/\\]/).pop() || "";
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    kt: "kotlin",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
  };
  
  return languageMap[ext] || "plaintext";
}

// ============================================================================
// RenameWidget Component
// ============================================================================

export function RenameWidget(props: RenameWidgetProps) {
  // Widget state
  const [state, setState] = createSignal<RenameState>({
    visible: false,
    oldName: "",
    newName: "",
    position: null,
    range: null,
    uri: null,
    isLoading: false,
    error: null,
    preview: null,
  });
  
  // Validation state
  const [validation, setValidation] = createSignal<ValidationResult>({ valid: true });
  
  // Input element reference
  let inputRef: HTMLInputElement | undefined;
  
  // Widget container reference
  let widgetRef: HTMLDivElement | undefined;
  
  // Store undo information for reverting
  let undoEdits: { uri: string; edits: TextEdit[] }[] = [];
  
  // Debounce timer for preview updates
  let previewDebounceTimer: number | null = null;
  
  // ============================================================================
  // Public API - Called from CodeEditor
  // ============================================================================
  
  /**
   * Show the rename widget at the current cursor position.
   * Calls LSP prepareRename to get the renameable range.
   */
  const show = async () => {
    const { editor, monaco, serverId } = props;
    if (!editor || !monaco || !serverId) return;
    
    const model = editor.getModel();
    const position = editor.getPosition();
    if (!model || !position) return;
    
    const uri = model.uri.toString();
    
    setState({
      visible: false,
      oldName: "",
      newName: "",
      position,
      range: null,
      uri,
      isLoading: true,
      error: null,
      preview: null,
    });
    
    try {
      // Call LSP prepareRename to check if rename is valid at this position
      const prepareResult = await invoke<PrepareRenameResult | null>("lsp_prepare_rename", {
        serverId,
        params: {
          uri,
          position: {
            line: position.lineNumber - 1,
            character: position.column - 1,
          },
        },
      });
      
      if (!prepareResult) {
        // prepareRename returned null - try to get word at position as fallback
        const wordInfo = model.getWordAtPosition(position);
        if (!wordInfo) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: "Cannot rename this symbol",
          }));
          return;
        }
        
        // Use word info as fallback
        const range: EditorRange = {
          startLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: wordInfo.endColumn,
        };
        
        setState({
          visible: true,
          oldName: wordInfo.word,
          newName: wordInfo.word,
          position,
          range,
          uri,
          isLoading: false,
          error: null,
          preview: null,
        });
      } else {
        // Use prepareRename result
        const range = lspRangeToEditorRange(prepareResult.range);
        const placeholder = prepareResult.placeholder;
        
        setState({
          visible: true,
          oldName: placeholder,
          newName: placeholder,
          position,
          range,
          uri,
          isLoading: false,
          error: null,
          preview: null,
        });
      }
      
      // Focus and select input after state update
      requestAnimationFrame(() => {
        if (inputRef) {
          inputRef.focus();
          inputRef.select();
        }
      });
      
    } catch (error) {
      console.error("Failed to prepare rename:", error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: "Failed to prepare rename operation",
      }));
    }
  };
  
  /**
   * Hide the rename widget and cleanup.
   */
  const hide = () => {
    if (previewDebounceTimer) {
      clearTimeout(previewDebounceTimer);
      previewDebounceTimer = null;
    }
    
    setState({
      visible: false,
      oldName: "",
      newName: "",
      position: null,
      range: null,
      uri: null,
      isLoading: false,
      error: null,
      preview: null,
    });
    
    setValidation({ valid: true });
    undoEdits = [];
    
    props.onClose?.();
  };
  
  // ============================================================================
  // Rename Operations
  // ============================================================================
  
  /**
   * Fetch preview of the rename operation (files and occurrences count).
   */
  const fetchPreview = async (newName: string) => {
    const { serverId } = props;
    const currentState = state();
    
    if (!serverId || !currentState.uri || !currentState.position) return;
    
    try {
      const workspaceEdit = await invoke<WorkspaceEdit>("lsp_rename", {
        serverId,
        params: {
          uri: currentState.uri,
          position: {
            line: currentState.position.lineNumber - 1,
            character: currentState.position.column - 1,
          },
          new_name: newName,
        },
      });
      
      if (workspaceEdit && workspaceEdit.changes) {
        const locations = workspaceEditToLocations(workspaceEdit, newName);
        const fileCount = Object.keys(workspaceEdit.changes).length;
        const occurrenceCount = locations.length;
        
        setState(prev => ({
          ...prev,
          preview: {
            fileCount,
            occurrenceCount,
            locations,
          },
        }));
      }
    } catch (error) {
      // Preview fetch failed - not critical, just don't show preview
      console.debug("Failed to fetch rename preview:", error);
    }
  };
  
  /**
   * Execute the rename operation.
   */
  const executeRename = async () => {
    const { editor, monaco, serverId } = props;
    const currentState = state();
    
    if (!editor || !monaco || !serverId) return;
    if (!currentState.uri || !currentState.position) return;
    if (!validation().valid) return;
    if (currentState.newName === currentState.oldName) {
      hide();
      return;
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const workspaceEdit = await invoke<WorkspaceEdit>("lsp_rename", {
        serverId,
        params: {
          uri: currentState.uri,
          position: {
            line: currentState.position.lineNumber - 1,
            character: currentState.position.column - 1,
          },
          new_name: currentState.newName,
        },
      });
      
      if (!workspaceEdit || !workspaceEdit.changes) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: "No changes returned from rename operation",
        }));
        return;
      }
      
      // Store edits for undo
      undoEdits = [];
      
      // Apply edits to all files
      const locations: RenameLocation[] = [];
      
      for (const [fileUri, textEdits] of Object.entries(workspaceEdit.changes)) {
        // Store original text for undo
        const originalEdits: TextEdit[] = [];
        
        // Apply edits using backend
        for (const edit of textEdits) {
          locations.push({
            uri: fileUri,
            range: lspRangeToEditorRange(edit.range),
            newText: currentState.newName,
          });
          
          // Store reverse edit for undo
          originalEdits.push({
            range: edit.range,
            newText: currentState.oldName,
          });
        }
        
        undoEdits.push({ uri: fileUri, edits: originalEdits });
        
        // Apply edits via backend
        try {
          await invoke("apply_workspace_edit", {
            uri: fileUri,
            edits: textEdits.map(e => ({
              range: {
                start: { line: e.range.start.line, character: e.range.start.character },
                end: { line: e.range.end.line, character: e.range.end.character },
              },
              new_text: e.newText,
            })),
          });
        } catch (applyError) {
          console.error(`Failed to apply edits to ${fileUri}:`, applyError);
        }
      }
      
      // Also update current editor model if it's one of the affected files
      const model = editor.getModel();
      if (model) {
        const currentUri = model.uri.toString();
        const currentFileEdits = workspaceEdit.changes[currentUri];
        
        if (currentFileEdits) {
          // Sort edits in reverse order to apply from bottom to top
          const sortedEdits = [...currentFileEdits].sort((a, b) => {
            if (a.range.start.line !== b.range.start.line) {
              return b.range.start.line - a.range.start.line;
            }
            return b.range.start.character - a.range.start.character;
          });
          
          // Apply edits using Monaco's pushEditOperations for undo support
          model.pushEditOperations(
            [],
            sortedEdits.map(edit => ({
              range: new monaco.Range(
                edit.range.start.line + 1,
                edit.range.start.character + 1,
                edit.range.end.line + 1,
                edit.range.end.character + 1
              ),
              text: edit.newText,
            })),
            () => null
          );
        }
      }
      
      // Notify parent of successful rename
      props.onRename?.(currentState.oldName, currentState.newName, locations);
      
      // Show success message
      showRenameToast(
        `Renamed "${currentState.oldName}" to "${currentState.newName}" in ${Object.keys(workspaceEdit.changes).length} file(s)`
      );
      
      hide();
      
    } catch (error) {
      console.error("Failed to execute rename:", error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to rename symbol",
      }));
    }
  };
  
  /**
   * Undo the last rename operation.
   */
  const undoRename = async () => {
    const { editor, monaco } = props;
    if (!editor || !monaco || undoEdits.length === 0) return;
    
    try {
      for (const { uri, edits } of undoEdits) {
        await invoke("apply_workspace_edit", {
          uri,
          edits: edits.map(e => ({
            range: {
              start: { line: e.range.start.line, character: e.range.start.character },
              end: { line: e.range.end.line, character: e.range.end.character },
            },
            new_text: e.newText,
          })),
        });
      }
      
      // Also undo in current editor
      editor.trigger("keyboard", "undo", null);
      
      showRenameToast("Rename undone");
      undoEdits = [];
    } catch (error) {
      console.error("Failed to undo rename:", error);
    }
  };
  
  // ============================================================================
  // Event Handlers
  // ============================================================================
  
  /**
   * Handle input value change with validation and preview update.
   */
  const handleInputChange = (e: InputEvent) => {
    const target = e.target as HTMLInputElement;
    const newName = target.value;
    const currentState = state();
    
    setState(prev => ({ ...prev, newName, error: null }));
    
    // Validate the new name
    const language = currentState.uri ? getLanguageFromUri(currentState.uri) : undefined;
    const validationResult = validateIdentifier(newName, language);
    setValidation(validationResult);
    
    // Debounce preview fetch
    if (previewDebounceTimer) {
      clearTimeout(previewDebounceTimer);
    }
    
    if (validationResult.valid && newName !== currentState.oldName && newName.length > 0) {
      previewDebounceTimer = window.setTimeout(() => {
        fetchPreview(newName);
      }, 300);
    } else {
      setState(prev => ({ ...prev, preview: null }));
    }
  };
  
  /**
   * Handle keyboard events in the input.
   */
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      executeRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      hide();
    }
  };
  
  // ============================================================================
  // Event Listeners
  // ============================================================================
  
  onMount(() => {
    // Listen for rename:show event from CodeEditor
    const handleShowRename = async () => {
      await show();
    };
    
    const handleHideRename = () => {
      hide();
    };
    
    const handleUndoRename = async () => {
      await undoRename();
    };
    
    window.addEventListener("rename:show", handleShowRename);
    window.addEventListener("rename:hide", handleHideRename);
    window.addEventListener("rename:undo", handleUndoRename);
    
    onCleanup(() => {
      window.removeEventListener("rename:show", handleShowRename);
      window.removeEventListener("rename:hide", handleHideRename);
      window.removeEventListener("rename:undo", handleUndoRename);
      
      if (previewDebounceTimer) {
        clearTimeout(previewDebounceTimer);
      }
    });
  });
  
  // Handle click outside to close
  createEffect(() => {
    if (!state().visible) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (widgetRef && !widgetRef.contains(e.target as Node)) {
        hide();
      }
    };
    
    // Delay adding listener to avoid immediate close
    const timerId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    
    onCleanup(() => {
      clearTimeout(timerId);
      document.removeEventListener("mousedown", handleClickOutside);
    });
  });
  
  // ============================================================================
  // Widget Positioning
  // ============================================================================
  
  /**
   * Calculate widget position based on cursor location.
   */
  const getWidgetStyle = () => {
    const { editor } = props;
    const currentState = state();
    
    if (!editor || !currentState.position || !currentState.range) {
      return {};
    }
    
    const layoutInfo = editor.getLayoutInfo();
    
    // Get the pixel position of the range start
    const startPosition = {
      lineNumber: currentState.range.startLineNumber,
      column: currentState.range.startColumn,
    };
    
    const coordinates = editor.getScrolledVisiblePosition(startPosition);
    
    if (!coordinates) {
      return {};
    }
    
    // Get editor DOM node position
    const editorDom = editor.getDomNode();
    if (!editorDom) {
      return {};
    }
    
    const editorRect = editorDom.getBoundingClientRect();
    
    return {
      position: "fixed" as const,
      left: `${editorRect.left + coordinates.left + layoutInfo.contentLeft}px`,
      top: `${editorRect.top + coordinates.top}px`,
      "z-index": "1000",
    };
  };
  
  // ============================================================================
  // Render
  // ============================================================================
  
  return (
    <Show when={state().visible}>
      <div
        ref={widgetRef}
        class="rename-widget"
        style={getWidgetStyle()}
      >
        {/* Input Container */}
        <div class="rename-widget-input-container">
          <input
            ref={inputRef}
            type="text"
            class="rename-widget-input"
            classList={{
              "rename-widget-input-error": !validation().valid || !!state().error,
            }}
            value={state().newName}
            onInput={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={state().isLoading}
            placeholder="Enter new name"
            spellcheck={false}
            autocomplete="off"
          />
          
          {/* Action Buttons */}
          <div class="rename-widget-actions">
            <button
              class="rename-widget-btn rename-widget-btn-confirm"
              onClick={executeRename}
              disabled={!validation().valid || state().isLoading || state().newName === state().oldName}
              title="Rename (Enter)"
            >
              <Show when={state().isLoading} fallback={
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path fill-rule="evenodd" d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
              }>
                <div class="rename-widget-spinner" />
              </Show>
            </button>
            
            <button
              class="rename-widget-btn rename-widget-btn-cancel"
              onClick={hide}
              title="Cancel (Escape)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </button>
          </div>
        </div>
        
        {/* Validation Error */}
        <Show when={!validation().valid && validation().message}>
          <div class="rename-widget-error">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
            </svg>
            <span>{validation().message}</span>
          </div>
        </Show>
        
        {/* LSP Error */}
        <Show when={state().error}>
          <div class="rename-widget-error">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
            </svg>
            <span>{state().error}</span>
          </div>
        </Show>
        
        {/* Preview Info */}
        <Show when={state().preview && validation().valid && state().newName !== state().oldName}>
          <div class="rename-widget-preview">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="M8.93 6.588l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
            <span>
              {state().preview!.occurrenceCount} occurrence{state().preview!.occurrenceCount !== 1 ? "s" : ""} in {state().preview!.fileCount} file{state().preview!.fileCount !== 1 ? "s" : ""}
            </span>
          </div>
        </Show>
        
        {/* Keyboard Shortcuts Hint */}
        <div class="rename-widget-hint">
          <span>Enter</span> to rename
          <span class="rename-widget-hint-separator">|</span>
          <span>Escape</span> to cancel
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Show a toast notification for rename operations.
 */
function showRenameToast(message: string): void {
  const existingToast = document.querySelector(".rename-toast");
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement("div");
  toast.className = "rename-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add("rename-toast-visible");
  });
  
  // Remove after delay
  setTimeout(() => {
    toast.classList.remove("rename-toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================================================
// Public API - Event Dispatchers
// ============================================================================

/**
 * Dispatch event to show the rename widget.
 */
export function showRenameWidget(): void {
  window.dispatchEvent(new CustomEvent("rename:show"));
}

/**
 * Dispatch event to hide the rename widget.
 */
export function hideRenameWidget(): void {
  window.dispatchEvent(new CustomEvent("rename:hide"));
}

/**
 * Dispatch event to undo the last rename operation.
 */
export function undoRename(): void {
  window.dispatchEvent(new CustomEvent("rename:undo"));
}
