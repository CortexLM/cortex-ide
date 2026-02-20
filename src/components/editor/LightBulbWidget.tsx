/**
 * LightBulbWidget - Code Actions Light Bulb Indicator
 * 
 * Displays a light bulb icon in the editor margin when code actions are available
 * at the current cursor position. Clicking the light bulb or pressing Ctrl+.
 * opens the quick fix/refactoring menu.
 * 
 * Features:
 * - Positioned in the glyph margin next to the current line
 * - Shows yellow bulb when code actions are available
 * - Animates on hover for better UX
 * - Keyboard shortcut: Ctrl+. (Cmd+. on macOS)
 * - Integrates with LSP code actions
 */

import { Show, createSignal, createEffect, onCleanup, onMount } from "solid-js";
import type * as Monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types
// ============================================================================

/** Props for the LightBulbWidget component */
export interface LightBulbWidgetProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  /** Current file URI */
  uri?: string;
}

/** LSP Code Action structure */
interface LSPCodeAction {
  title: string;
  kind?: string;
  diagnostics?: Array<{
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    message: string;
    severity?: number;
  }>;
  isPreferred?: boolean;
  disabled?: { reason: string };
  edit?: unknown;
  command?: {
    title: string;
    command: string;
    arguments?: unknown[];
  };
  data?: unknown;
}

/** LSP Code Action response */
interface LSPCodeActionsResponse {
  actions: LSPCodeAction[];
}

/** Widget state */
interface LightBulbState {
  visible: boolean;
  line: number;
  hasQuickFix: boolean;
  hasRefactor: boolean;
  top: number;
  left: number;
}

// ============================================================================
// LightBulbWidget Component
// ============================================================================

export function LightBulbWidget(props: LightBulbWidgetProps) {
  // Widget state
  const [state, setState] = createSignal<LightBulbState>({
    visible: false,
    line: 0,
    hasQuickFix: false,
    hasRefactor: false,
    top: 0,
    left: 0,
  });
  
  // Hover state for animation
  const [isHovered, setIsHovered] = createSignal(false);
  
  // Loading state
  const [isLoading, setIsLoading] = createSignal(false);
  
  // Cache for code actions to avoid refetching
  let codeActionsCache: Map<string, { actions: LSPCodeAction[]; timestamp: number }> = new Map();
  const CACHE_TTL_MS = 2000;
  
  // Debounce timer for cursor changes
  let cursorDebounceTimer: number | null = null;
  
  // Disposables for cleanup
  let disposables: Monaco.IDisposable[] = [];
  
  // ============================================================================
  // Code Actions Fetching
  // ============================================================================
  
  /**
   * Fetch code actions from LSP for the current cursor position.
   */
  const fetchCodeActions = async (line: number, column: number): Promise<LSPCodeAction[]> => {
    const { editor, monaco, uri } = props;
    if (!editor || !monaco || !uri) return [];
    
    const model = editor.getModel();
    if (!model) return [];
    
    const cacheKey = `${uri}:${line}:${column}`;
    const cached = codeActionsCache.get(cacheKey);
    
    // Check cache
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.actions;
    }
    
    setIsLoading(true);
    
    try {
      const languageId = model.getLanguageId();
      const filePath = uri.replace("file://", "").replace(/\//g, "\\");
      
      // Get diagnostics at this position for context
      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      const diagnosticsAtLine = markers.filter(m => 
        m.startLineNumber <= line && m.endLineNumber >= line
      );
      
      // Build diagnostic context for LSP
      const diagnostics = diagnosticsAtLine.map(m => ({
        range: {
          start: { line: m.startLineNumber - 1, character: m.startColumn - 1 },
          end: { line: m.endLineNumber - 1, character: m.endColumn - 1 },
        },
        message: m.message,
        severity: m.severity,
      }));
      
      // Call LSP code actions via multi-provider
      const response = await invoke<LSPCodeActionsResponse>("lsp_multi_code_actions", {
        language: languageId,
        params: {
          uri: filePath,
          range: {
            start: { line: line - 1, character: 0 },
            end: { line: line - 1, character: model.getLineMaxColumn(line) - 1 },
          },
          context: {
            diagnostics,
            only: null, // Get all code action kinds
            triggerKind: 2, // Invoked (not automatic)
          },
        },
      });
      
      const actions = response?.actions || [];
      
      // Cache the result
      codeActionsCache.set(cacheKey, { actions, timestamp: Date.now() });
      
      return actions;
    } catch (error) {
      console.debug("Failed to fetch code actions:", error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Update the light bulb visibility based on available code actions.
   */
  const updateLightBulb = async () => {
    const { editor, monaco } = props;
    if (!editor || !monaco) {
      setState(prev => ({ ...prev, visible: false }));
      return;
    }
    
    const position = editor.getPosition();
    if (!position) {
      setState(prev => ({ ...prev, visible: false }));
      return;
    }
    
    const line = position.lineNumber;
    const column = position.column;
    
    // Fetch code actions
    const actions = await fetchCodeActions(line, column);
    
    if (actions.length === 0) {
      setState(prev => ({ ...prev, visible: false }));
      return;
    }
    
    // Categorize actions
    const hasQuickFix = actions.some(a => 
      a.kind?.startsWith("quickfix") || a.isPreferred
    );
    const hasRefactor = actions.some(a => 
      a.kind?.startsWith("refactor") || a.kind?.startsWith("source")
    );
    
    // Calculate position in the glyph margin
    const layoutInfo = editor.getLayoutInfo();
    const lineTop = editor.getTopForLineNumber(line);
    const scrollTop = editor.getScrollTop();
    
    // Position in glyph margin (left side of line numbers)
    const left = layoutInfo.glyphMarginLeft + 2;
    const top = lineTop - scrollTop + 2;
    
    setState({
      visible: true,
      line,
      hasQuickFix,
      hasRefactor,
      top,
      left,
    });
  };
  
  /**
   * Trigger code actions menu (called on click or Ctrl+.)
   */
  const triggerCodeActions = () => {
    const { editor, monaco } = props;
    if (!editor || !monaco) return;
    
    // Trigger Monaco's built-in quick fix menu
    editor.trigger("lightbulb", "editor.action.quickFix", null);
  };
  
  // ============================================================================
  // Event Handlers
  // ============================================================================
  
  /**
   * Handle cursor position changes with debouncing.
   */
  const handleCursorChange = () => {
    if (cursorDebounceTimer) {
      clearTimeout(cursorDebounceTimer);
    }
    
    cursorDebounceTimer = window.setTimeout(() => {
      updateLightBulb();
    }, 250) as unknown as number;
  };
  
  /**
   * Handle scroll events to update position.
   */
  const handleScroll = () => {
    const { editor, monaco } = props;
    if (!editor || !monaco || !state().visible) return;
    
    const position = editor.getPosition();
    if (!position) return;
    
    const layoutInfo = editor.getLayoutInfo();
    const lineTop = editor.getTopForLineNumber(position.lineNumber);
    const scrollTop = editor.getScrollTop();
    
    const left = layoutInfo.glyphMarginLeft + 2;
    const top = lineTop - scrollTop + 2;
    
    setState(prev => ({ ...prev, top, left }));
  };
  
  /**
   * Handle content changes - invalidate cache for changed lines.
   */
  const handleContentChange = (e: Monaco.editor.IModelContentChangedEvent) => {
    // Invalidate cache for affected lines
    const { uri } = props;
    if (!uri) return;
    
    for (const change of e.changes) {
      const startLine = change.range.startLineNumber;
      const endLine = change.range.endLineNumber;
      
      // Remove cached entries for affected lines
      for (const key of codeActionsCache.keys()) {
        if (key.startsWith(`${uri}:`)) {
          const linePart = key.split(":")[1];
          const line = parseInt(linePart, 10);
          if (line >= startLine && line <= endLine) {
            codeActionsCache.delete(key);
          }
        }
      }
    }
    
    // Update light bulb after content change
    handleCursorChange();
  };
  
  // ============================================================================
  // Lifecycle
  // ============================================================================
  
  // Setup editor event listeners
  createEffect(() => {
    const { editor, monaco } = props;
    if (!editor || !monaco) return;
    
    // Clean up previous disposables
    disposables.forEach(d => {
      if (d && typeof d.dispose === 'function') {
        d.dispose();
      }
    });
    disposables = [];
    
    // Listen for cursor position changes
    disposables.push(
      editor.onDidChangeCursorPosition(handleCursorChange)
    );
    
    // Listen for scroll changes
    disposables.push(
      editor.onDidScrollChange(handleScroll)
    );
    
    // Listen for content changes
    disposables.push(
      editor.onDidChangeModelContent(handleContentChange)
    );
    
    // Listen for model changes (file switch)
    disposables.push(
      editor.onDidChangeModel(() => {
        codeActionsCache.clear();
        setState(prev => ({ ...prev, visible: false }));
        handleCursorChange();
      })
    );
    
    // Add Ctrl+. keyboard shortcut
    // addCommand returns a string (command ID) or null, not IDisposable
    // We can't dispose of it directly, but it will be cleaned up when editor is disposed
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Period,
      triggerCodeActions,
      "editorTextFocus"
    );
    
    // Initial update
    updateLightBulb();
  });
  
  // Listen for external events
  onMount(() => {
    // Listen for lightbulb:trigger event
    const handleTrigger = () => {
      triggerCodeActions();
    };
    
    // Listen for lightbulb:refresh event
    const handleRefresh = () => {
      codeActionsCache.clear();
      updateLightBulb();
    };
    
    window.addEventListener("lightbulb:trigger", handleTrigger);
    window.addEventListener("lightbulb:refresh", handleRefresh);
    
    onCleanup(() => {
      window.removeEventListener("lightbulb:trigger", handleTrigger);
      window.removeEventListener("lightbulb:refresh", handleRefresh);
      
      // Clean up disposables
      disposables.forEach(d => {
        if (d && typeof d.dispose === 'function') {
          d.dispose();
        }
      });
      disposables = [];
      
      // Clear timers
      if (cursorDebounceTimer) {
        clearTimeout(cursorDebounceTimer);
      }
      
      // Clear cache
      codeActionsCache.clear();
    });
  });
  
  // ============================================================================
  // Render
  // ============================================================================
  
  return (
    <Show when={state().visible}>
      <div
        class="lightbulb-widget"
        classList={{
          "lightbulb-widget-hovered": isHovered(),
          "lightbulb-widget-quickfix": state().hasQuickFix,
          "lightbulb-widget-refactor": state().hasRefactor && !state().hasQuickFix,
          "lightbulb-widget-loading": isLoading(),
        }}
        style={{
          position: "absolute",
          top: `${state().top}px`,
          left: `${state().left}px`,
          "z-index": "100",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={triggerCodeActions}
        title="Show Code Actions (Ctrl+.)"
      >
        {/* Light Bulb Icon */}
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 16 16" 
          fill="currentColor"
          class="lightbulb-icon"
        >
          {/* Quick Fix Bulb (filled) */}
          <Show when={state().hasQuickFix}>
            <path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.695 8.695 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.68-.208.3-.33.565-.37.847a.75.75 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848l.213-.253c.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75zM6 15a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1H6v1zm1.5-6.75a.75.75 0 0 0-1.5 0v3a.75.75 0 0 0 1.5 0v-3zm2.5 0a.75.75 0 0 0-1.5 0v3a.75.75 0 0 0 1.5 0v-3z"/>
          </Show>
          {/* Refactor Bulb (outline) */}
          <Show when={!state().hasQuickFix}>
            <path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.695 8.695 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.68-.208.3-.33.565-.37.847a.75.75 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848l.213-.253c.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75zM6 15a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-1H6v1z"/>
          </Show>
        </svg>
      </div>
    </Show>
  );
}

// ============================================================================
// Public API - Event Dispatchers
// ============================================================================

/**
 * Dispatch event to trigger code actions at current position.
 */
export function triggerLightBulb(): void {
  window.dispatchEvent(new CustomEvent("lightbulb:trigger"));
}

/**
 * Dispatch event to refresh light bulb state (refetch code actions).
 */
export function refreshLightBulb(): void {
  window.dispatchEvent(new CustomEvent("lightbulb:refresh"));
}
