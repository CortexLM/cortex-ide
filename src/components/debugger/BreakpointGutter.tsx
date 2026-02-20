import { createEffect, onCleanup, createSignal, Show } from "solid-js";
import type * as Monaco from "monaco-editor";
import { useDebug } from "@/context/DebugContext";
import { Portal } from "solid-js/web";

export interface BreakpointGutterProps {
  editor: Monaco.editor.IStandaloneCodeEditor;
  monaco: typeof Monaco;
  filePath: string;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  line: number;
  column?: number;
  hasBreakpoint: boolean;
  hasLogpoint: boolean;
  isInlineBreakpoint: boolean;
}

interface LogpointEditState {
  visible: boolean;
  x: number;
  y: number;
  line: number;
  message: string;
  isNew: boolean;
}

/**
 * Component that manages breakpoint decorations in a Monaco editor.
 * This handles:
 * - Displaying breakpoint markers in the gutter
 * - Inline breakpoints (multiple per line at different columns)
 * - Click handling to toggle breakpoints
 * - Shift+Click to add inline breakpoints at specific column positions
 * - Right-click context menu for logpoints
 * - Double-click to edit logpoints
 * - Current line highlighting during debugging
 */
export function useBreakpointGutter(props: BreakpointGutterProps) {
  const debug = useDebug();
  let decorationIds: string[] = [];
  let inlineBreakpointDecorationIds: string[] = [];
  let currentLineDecorationId: string[] = [];
  let lastClickTime = 0;
  let lastClickLine = 0;

  // Context menu state
  const [contextMenu, setContextMenu] = createSignal<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    line: 0,
    column: undefined,
    hasBreakpoint: false,
    hasLogpoint: false,
    isInlineBreakpoint: false,
  });

  // Logpoint edit dialog state
  const [logpointEdit, setLogpointEdit] = createSignal<LogpointEditState>({
    visible: false,
    x: 0,
    y: 0,
    line: 0,
    message: "",
    isNew: true,
  });

  // Close context menu when clicking elsewhere
  const handleDocumentClick = () => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  // Close logpoint edit when pressing Escape
  const handleDocumentKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setContextMenu((prev) => ({ ...prev, visible: false }));
      setLogpointEdit((prev) => ({ ...prev, visible: false }));
    }
  };

  // Create glyph margin decoration class
  const setupGlyphMargin = () => {
    // Add CSS for breakpoint markers
    const style = document.createElement("style");
    style.id = "breakpoint-gutter-styles";
    style.textContent = `
      .breakpoint-glyph {
        background: var(--cortex-error);
        border-radius: 50%;
        width: 10px !important;
        height: 10px !important;
        margin-left: 5px;
        margin-top: 5px;
        cursor: pointer;
      }
      .breakpoint-glyph-unverified {
        background: var(--cortex-text-inactive);
        border-radius: 50%;
        width: 10px !important;
        height: 10px !important;
        margin-left: 5px;
        margin-top: 5px;
        cursor: pointer;
      }
      .breakpoint-glyph-conditional {
        background: var(--cortex-warning);
        border-radius: 50%;
        width: 10px !important;
        height: 10px !important;
        margin-left: 5px;
        margin-top: 5px;
        cursor: pointer;
      }
      .breakpoint-glyph-disabled {
        background: transparent;
        border: 2px solid var(--cortex-text-inactive);
        border-radius: 50%;
        width: 8px !important;
        height: 8px !important;
        margin-left: 5px;
        margin-top: 5px;
        cursor: pointer;
        opacity: 0.6;
      }
      .breakpoint-glyph-logpoint {
        background: var(--cortex-info);
        border-radius: var(--cortex-radius-sm);
        width: 10px !important;
        height: 10px !important;
        margin-left: 5px;
        margin-top: 5px;
        cursor: pointer;
      }
      .current-line-highlight {
        background: rgba(255, 255, 0, 0.2) !important;
      }
      .current-line-glyph {
        width: 0;
        height: 0;
        border-left: 8px solid var(--cortex-warning);
        border-top: 5px solid transparent;
        border-bottom: 5px solid transparent;
        margin-left: 4px;
        margin-top: 5px;
      }
      /* Inline breakpoint markers (diamond shape like VS Code) */
      .inline-breakpoint-marker {
        display: inline-block;
        width: 0;
        height: 0;
        border: 5px solid transparent;
        border-left-color: var(--cortex-error);
        border-right-color: var(--cortex-error);
        cursor: pointer;
        position: relative;
        margin: 0 2px;
        vertical-align: middle;
      }
      .inline-breakpoint-marker::before {
        content: '';
        display: none;
      }
      .inline-breakpoint-marker-unverified {
        border-left-color: var(--cortex-text-inactive);
        border-right-color: var(--cortex-text-inactive);
      }
      .inline-breakpoint-marker-conditional {
        border-left-color: var(--cortex-warning);
        border-right-color: var(--cortex-warning);
      }
      .inline-breakpoint-marker-disabled {
        border-left-color: var(--cortex-text-inactive)60;
        border-right-color: var(--cortex-text-inactive)60;
        opacity: 0.6;
      }
      /* Before decorator style for inline breakpoints */
      .inline-breakpoint-decoration {
        color: var(--cortex-error) !important;
        cursor: pointer;
      }
      .inline-breakpoint-decoration::before {
        content: '◆';
        font-size: 10px;
        margin-right: 2px;
      }
      .inline-breakpoint-decoration-unverified {
        color: var(--cortex-text-inactive) !important;
      }
      .inline-breakpoint-decoration-conditional {
        color: var(--cortex-warning) !important;
      }
      .inline-breakpoint-decoration-disabled {
        color: var(--cortex-text-inactive) !important;
        opacity: 0.6;
      }
    `;

    if (!document.getElementById("breakpoint-gutter-styles")) {
      document.head.appendChild(style);
    }
  };

  // Update decorations based on breakpoints
  const updateDecorations = () => {
    const breakpoints = debug.getBreakpointsForFile(props.filePath);
    
    // Separate line-level breakpoints from inline (column-specific) breakpoints
    const lineBreakpoints = breakpoints.filter((bp) => bp.column === undefined);
    const inlineBreakpoints = breakpoints.filter((bp) => bp.column !== undefined);
    
    // Create gutter decorations for line-level breakpoints
    const gutterDecorations: Monaco.editor.IModelDeltaDecoration[] = lineBreakpoints.map((bp) => {
      // Determine the glyph class based on breakpoint state
      let glyphClass: string;
      if (!bp.enabled) {
        glyphClass = "breakpoint-glyph-disabled";
      } else if (bp.logMessage) {
        glyphClass = "breakpoint-glyph-logpoint";
      } else if (bp.condition) {
        glyphClass = "breakpoint-glyph-conditional";
      } else if (bp.verified) {
        glyphClass = "breakpoint-glyph";
      } else {
        glyphClass = "breakpoint-glyph-unverified";
      }

      // Build hover message
      let hoverValue = "Breakpoint";
      if (!bp.enabled) {
        hoverValue = "Breakpoint (disabled)";
      } else if (bp.logMessage) {
        hoverValue = `Logpoint: ${bp.logMessage}`;
      } else if (bp.condition) {
        hoverValue = `Conditional breakpoint: ${bp.condition}`;
      } else if (bp.hitCondition) {
        hoverValue = `Hit count breakpoint: ${bp.hitCondition}`;
      } else if (bp.message) {
        hoverValue = bp.message;
      }

      return {
        range: new props.monaco.Range(bp.line, 1, bp.line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: glyphClass,
          glyphMarginHoverMessage: { value: hoverValue },
          stickiness: props.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      };
    });

    decorationIds = props.editor.deltaDecorations(decorationIds, gutterDecorations);
    
    // Create inline decorations for column-specific breakpoints
    const inlineDecorations: Monaco.editor.IModelDeltaDecoration[] = inlineBreakpoints.map((bp) => {
      // Determine the inline decoration class based on breakpoint state
      let inlineClass = "inline-breakpoint-decoration";
      if (!bp.enabled) {
        inlineClass += " inline-breakpoint-decoration-disabled";
      } else if (bp.condition) {
        inlineClass += " inline-breakpoint-decoration-conditional";
      } else if (!bp.verified) {
        inlineClass += " inline-breakpoint-decoration-unverified";
      }

      // Build hover message for inline breakpoint
      let hoverValue = `Inline breakpoint at column ${bp.column}`;
      if (!bp.enabled) {
        hoverValue = `Inline breakpoint (disabled) at column ${bp.column}`;
      } else if (bp.condition) {
        hoverValue = `Conditional inline breakpoint: ${bp.condition}`;
      } else if (bp.hitCondition) {
        hoverValue = `Hit count inline breakpoint: ${bp.hitCondition}`;
      } else if (bp.message) {
        hoverValue = bp.message;
      }

      return {
        range: new props.monaco.Range(bp.line, bp.column!, bp.line, bp.column!),
        options: {
          isWholeLine: false,
          before: {
            content: "◆",
            inlineClassName: inlineClass,
          },
          hoverMessage: { value: hoverValue },
          stickiness: props.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      };
    });

    inlineBreakpointDecorationIds = props.editor.deltaDecorations(inlineBreakpointDecorationIds, inlineDecorations);
  };

  // Update current line indicator during debugging
  const updateCurrentLine = () => {
    const activeFrame = debug.state.stackFrames.find(
      (f) => f.id === debug.state.activeFrameId
    );

    if (!activeFrame || activeFrame.source?.path !== props.filePath) {
      currentLineDecorationId = props.editor.deltaDecorations(currentLineDecorationId, []);
      return;
    }

    const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [
      {
        range: new props.monaco.Range(activeFrame.line, 1, activeFrame.line, 1),
        options: {
          isWholeLine: true,
          className: "current-line-highlight",
          glyphMarginClassName: "current-line-glyph",
          stickiness: props.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      },
    ];

    currentLineDecorationId = props.editor.deltaDecorations(currentLineDecorationId, newDecorations);

    // Scroll to current line
    props.editor.revealLineInCenter(activeFrame.line);
  };

  // Handle mouse clicks in the glyph margin or editor content area
  const handleMouseDown = (e: Monaco.editor.IEditorMouseEvent) => {
    const isGutterClick = e.target.type === props.monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN;
    const isContentClick = e.target.type === props.monaco.editor.MouseTargetType.CONTENT_TEXT ||
                          e.target.type === props.monaco.editor.MouseTargetType.CONTENT_EMPTY;
    
    // Shift+Click in content area adds inline breakpoint
    if (e.event.shiftKey && isContentClick && e.target.position) {
      const lineNumber = e.target.position.lineNumber;
      const column = e.target.position.column;
      
      // Toggle inline breakpoint at specific column
      debug.toggleBreakpoint(props.filePath, lineNumber, column);
      return;
    }
    
    // Regular gutter click behavior
    if (!isGutterClick) {
      return;
    }

    const lineNumber = e.target.position?.lineNumber;
    if (!lineNumber) return;

    const breakpoints = debug.getBreakpointsForFile(props.filePath);
    // For gutter clicks, only look at line-level breakpoints (no column)
    const existingBp = breakpoints.find((bp) => bp.line === lineNumber && bp.column === undefined);
    const hasLogpoint = existingBp?.logMessage !== undefined;

    // Check for double-click on logpoint to edit
    const now = Date.now();
    if (lastClickLine === lineNumber && now - lastClickTime < 300 && hasLogpoint) {
      // Double-click detected on logpoint - open edit dialog
      const rect = props.editor.getDomNode()?.getBoundingClientRect();
      if (rect) {
        setLogpointEdit({
          visible: true,
          x: rect.left + 50,
          y: rect.top + (lineNumber * 20),
          line: lineNumber,
          message: existingBp?.logMessage || "",
          isNew: false,
        });
      }
      lastClickTime = 0;
      lastClickLine = 0;
      return;
    }

    lastClickTime = now;
    lastClickLine = lineNumber;

    // Toggle line-level breakpoint on single click (no column)
    debug.toggleBreakpoint(props.filePath, lineNumber);
  };

  // Handle right-click context menu in glyph margin or on inline breakpoints
  const handleContextMenu = (e: Monaco.editor.IEditorMouseEvent) => {
    const isGutterClick = e.target.type === props.monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN;
    const isContentClick = e.target.type === props.monaco.editor.MouseTargetType.CONTENT_TEXT ||
                          e.target.type === props.monaco.editor.MouseTargetType.CONTENT_EMPTY;
    
    if (!isGutterClick && !isContentClick) {
      return;
    }

    const lineNumber = e.target.position?.lineNumber;
    if (!lineNumber) return;

    // Prevent default browser context menu
    e.event.preventDefault();
    e.event.stopPropagation();

    const breakpoints = debug.getBreakpointsForFile(props.filePath);
    const column = isContentClick ? e.target.position?.column : undefined;
    
    // Check for inline breakpoint at this position
    const inlineBreakpoint = column !== undefined 
      ? breakpoints.find((bp) => bp.line === lineNumber && bp.column === column)
      : undefined;
    
    // Check for line-level breakpoint
    const lineLevelBreakpoint = breakpoints.find((bp) => bp.line === lineNumber && bp.column === undefined);
    
    // Determine which breakpoint to show context for
    const existingBp = inlineBreakpoint || lineLevelBreakpoint;
    const isInlineContext = !!inlineBreakpoint;

    setContextMenu({
      visible: true,
      x: e.event.posx,
      y: e.event.posy,
      line: lineNumber,
      column: isInlineContext ? column : undefined,
      hasBreakpoint: !!existingBp,
      hasLogpoint: existingBp?.logMessage !== undefined,
      isInlineBreakpoint: isInlineContext,
    });
  };

  // Context menu action handlers
  const handleAddBreakpoint = () => {
    const menu = contextMenu();
    debug.toggleBreakpoint(props.filePath, menu.line, menu.column);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleAddInlineBreakpoint = () => {
    const menu = contextMenu();
    // Get current cursor position if no column specified
    const position = props.editor.getPosition();
    const column = menu.column || position?.column || 1;
    debug.toggleBreakpoint(props.filePath, menu.line, column);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleAddLogpoint = () => {
    const menu = contextMenu();
    const rect = props.editor.getDomNode()?.getBoundingClientRect();
    if (rect) {
      setLogpointEdit({
        visible: true,
        x: menu.x,
        y: menu.y,
        line: menu.line,
        message: "Log: ",
        isNew: true,
      });
    }
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleEditLogpoint = () => {
    const menu = contextMenu();
    const breakpoints = debug.getBreakpointsForFile(props.filePath);
    // Find the correct breakpoint based on whether it's inline or line-level
    const existingBp = menu.column !== undefined
      ? breakpoints.find((bp) => bp.line === menu.line && bp.column === menu.column)
      : breakpoints.find((bp) => bp.line === menu.line && bp.column === undefined);
    
    setLogpointEdit({
      visible: true,
      x: menu.x,
      y: menu.y,
      line: menu.line,
      message: existingBp?.logMessage || "",
      isNew: false,
    });
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleRemoveBreakpoint = () => {
    const menu = contextMenu();
    debug.removeBreakpoint(props.filePath, menu.line, menu.column);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleConvertToLogpoint = () => {
    const menu = contextMenu();
    setLogpointEdit({
      visible: true,
      x: menu.x,
      y: menu.y,
      line: menu.line,
      message: "Log: ",
      isNew: false,
    });
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleConvertToBreakpoint = () => {
    const menu = contextMenu();
    debug.convertToBreakpoint(props.filePath, menu.line);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleSaveLogpoint = async () => {
    const edit = logpointEdit();
    if (edit.message.trim()) {
      await debug.addLogpoint(props.filePath, edit.line, edit.message);
    }
    setLogpointEdit((prev) => ({ ...prev, visible: false }));
  };

  const handleCancelLogpointEdit = () => {
    setLogpointEdit((prev) => ({ ...prev, visible: false }));
  };

  // Setup
  createEffect(() => {
    setupGlyphMargin();

    // Enable glyph margin
    props.editor.updateOptions({ glyphMargin: true });

    // Add click handler
    const mouseDownDisposable = props.editor.onMouseDown(handleMouseDown);
    
    // Add context menu handler
    const contextMenuDisposable = props.editor.onContextMenu(handleContextMenu);

    // Add document-level event listeners
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleDocumentKeyDown);

    onCleanup(() => {
      mouseDownDisposable?.dispose?.();
      contextMenuDisposable?.dispose?.();
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleDocumentKeyDown);
      props.editor.deltaDecorations(decorationIds, []);
      props.editor.deltaDecorations(inlineBreakpointDecorationIds, []);
      props.editor.deltaDecorations(currentLineDecorationId, []);
    });
  });

  // React to breakpoint changes
  createEffect(() => {
    // Access the breakpoints to trigger reactivity
    void debug.state.breakpoints[props.filePath];
    updateDecorations();
  });

  // React to current line changes
  createEffect(() => {
    // Access these values to trigger reactivity
    void debug.state.activeFrameId;
    void debug.state.stackFrames;
    updateCurrentLine();
  });

  // Return UI components for context menu and logpoint edit dialog
  return {
    ContextMenu: () => (
      <Show when={contextMenu().visible}>
        <Portal>
          <div
            class="fixed z-50 min-w-[180px] rounded shadow-lg py-1"
            style={{
              left: `${contextMenu().x}px`,
              top: `${contextMenu().y}px`,
              background: "var(--surface-raised)",
              border: "1px solid var(--border-weak)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Show when={!contextMenu().hasBreakpoint}>
              <button
                class="w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-sunken)] transition-colors"
                style={{ color: "var(--text-base)" }}
                onClick={handleAddBreakpoint}
              >
                Add Breakpoint
              </button>
              <button
                class="w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-sunken)] transition-colors"
                style={{ color: "var(--cortex-error)" }}
                onClick={handleAddInlineBreakpoint}
              >
                Add Inline Breakpoint
              </button>
              <button
                class="w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-sunken)] transition-colors"
                style={{ color: "var(--cortex-info)" }}
                onClick={handleAddLogpoint}
              >
                Add Logpoint...
              </button>
            </Show>
            <Show when={contextMenu().hasBreakpoint && !contextMenu().hasLogpoint && !contextMenu().isInlineBreakpoint}>
              <button
                class="w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-sunken)] transition-colors"
                style={{ color: "var(--text-base)" }}
                onClick={handleRemoveBreakpoint}
              >
                Remove Breakpoint
              </button>
              <button
                class="w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-sunken)] transition-colors"
                style={{ color: "var(--cortex-error)" }}
                onClick={handleAddInlineBreakpoint}
              >
                Add Inline Breakpoint
              </button>
              <button
                class="w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-sunken)] transition-colors"
                style={{ color: "var(--cortex-info)" }}
                onClick={handleConvertToLogpoint}
              >
                Convert to Logpoint...
              </button>
            </Show>
            <Show when={contextMenu().hasBreakpoint && !contextMenu().hasLogpoint && contextMenu().isInlineBreakpoint}>
              <button
                class="w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-sunken)] transition-colors"
                style={{ color: "var(--text-base)" }}
                onClick={handleRemoveBreakpoint}
              >
                Remove Inline Breakpoint
              </button>
            </Show>
            <Show when={contextMenu().hasLogpoint}>
              <button
                class="w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-sunken)] transition-colors"
                style={{ color: "var(--cortex-info)" }}
                onClick={handleEditLogpoint}
              >
                Edit Logpoint...
              </button>
              <button
                class="w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-sunken)] transition-colors"
                style={{ color: "var(--text-base)" }}
                onClick={handleConvertToBreakpoint}
              >
                Convert to Breakpoint
              </button>
              <button
                class="w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-sunken)] transition-colors"
                style={{ color: "var(--text-weak)" }}
                onClick={handleRemoveBreakpoint}
              >
                Remove Logpoint
              </button>
            </Show>
          </div>
        </Portal>
      </Show>
    ),
    LogpointEditDialog: () => (
      <Show when={logpointEdit().visible}>
        <Portal>
          <div
            class="fixed z-50 rounded shadow-lg p-3"
            style={{
              left: `${logpointEdit().x}px`,
              top: `${logpointEdit().y}px`,
              background: "var(--surface-raised)",
              border: "1px solid var(--cortex-info)",
              "min-width": "300px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="text-xs mb-2" style={{ color: "var(--text-base)" }}>
              {logpointEdit().isNew ? "Add Logpoint" : "Edit Logpoint"} at line {logpointEdit().line}
            </div>
            <div class="text-xs mb-2" style={{ color: "var(--text-weak)" }}>
              Use {"{expression}"} to interpolate values
            </div>
            <input
              type="text"
              value={logpointEdit().message}
              onInput={(e) => setLogpointEdit((prev) => ({ ...prev, message: e.currentTarget.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveLogpoint();
                if (e.key === "Escape") handleCancelLogpointEdit();
              }}
              placeholder="e.g., Value is {x}"
              class="w-full px-2 py-1.5 text-xs rounded outline-none mb-2"
              style={{
                background: "var(--surface-sunken)",
                color: "var(--text-base)",
                border: "1px solid var(--border-weak)",
              }}
              autofocus
            />
            <div class="flex justify-end gap-2">
              <button
                onClick={handleCancelLogpointEdit}
                class="px-3 py-1 text-xs rounded"
                style={{ color: "var(--text-weak)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLogpoint}
                class="px-3 py-1 text-xs rounded"
                style={{ background: "var(--cortex-info)", color: "white" }}
              >
                {logpointEdit().isNew ? "Add" : "Save"}
              </button>
            </div>
          </div>
        </Portal>
      </Show>
    ),
  };
}

/**
 * Hook to get inline variable values for the current debugging session.
 * This can be used to show variable values next to the code.
 */
export function useInlineVariables(
  editor: () => Monaco.editor.IStandaloneCodeEditor | null,
  monaco: () => typeof Monaco | null,
  filePath: () => string
) {
  const debug = useDebug();
  let inlineDecorationIds: string[] = [];

  const updateInlineValues = async () => {
    const ed = editor();
    const mon = monaco();
    if (!ed || !mon) return;

    // Only show inline values when paused
    if (!debug.state.isPaused) {
      inlineDecorationIds = ed.deltaDecorations(inlineDecorationIds, []);
      return;
    }

    const activeFrame = debug.state.stackFrames.find(
      (f) => f.id === debug.state.activeFrameId
    );

    if (!activeFrame || activeFrame.source?.path !== filePath()) {
      inlineDecorationIds = ed.deltaDecorations(inlineDecorationIds, []);
      return;
    }

    // Get variables for the current frame
    const variables = debug.state.variables;

    // Create inline decorations for simple variables on the current line
    const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [];

    for (const variable of variables.slice(0, 10)) {
      // Limit to prevent performance issues
      // Find occurrences of the variable name in the code
      const model = ed.getModel();
      if (!model) continue;

      const matches = model.findMatches(
        `\\b${variable.name}\\b`,
        true, // searchOnlyEditableRange
        true, // isRegex
        true, // matchCase
        null, // wordSeparators
        false // captureMatches
      );

      for (const match of matches) {
        // Only add decoration near the current line
        if (Math.abs(match.range.startLineNumber - activeFrame.line) > 5) continue;

        newDecorations.push({
          range: new mon.Range(
            match.range.startLineNumber,
            match.range.endColumn,
            match.range.startLineNumber,
            match.range.endColumn
          ),
          options: {
            after: {
              content: ` = ${variable.value}`,
              inlineClassName: "inline-debug-value",
            },
            stickiness: mon.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });
      }
    }

    // Add CSS for inline values
    const style = document.createElement("style");
    style.id = "inline-debug-value-styles";
    style.textContent = `
      .inline-debug-value {
        color: var(--cortex-text-inactive);
        font-style: italic;
        margin-left: 8px;
        opacity: 0.8;
      }
    `;

    if (!document.getElementById("inline-debug-value-styles")) {
      document.head.appendChild(style);
    }

    inlineDecorationIds = ed.deltaDecorations(inlineDecorationIds, newDecorations);
  };

  createEffect(() => {
    // Access these values to trigger reactivity
    void debug.state.isPaused;
    void debug.state.variables;
    void debug.state.activeFrameId;
    updateInlineValues();
  });

  onCleanup(() => {
    const ed = editor();
    if (ed) {
      ed.deltaDecorations(inlineDecorationIds, []);
    }
  });
}

