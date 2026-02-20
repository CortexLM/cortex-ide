/**
 * PeekWidget - Inline Peek Definition Widget
 * 
 * Shows definition preview inline at cursor position without navigating away.
 * Supports multiple results with navigation (< 1/5 >).
 * 
 * Features:
 * - Embedded Monaco editor for syntax-highlighted preview
 * - Dark header with filename and close button
 * - Resizable widget with scrollable content
 * - Multiple results navigation
 * - Escape to close
 */

import { Show, createSignal, createEffect, onCleanup, onMount } from "solid-js";
import type * as Monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types
// ============================================================================

/** A single definition location result */
export interface PeekLocation {
  uri: string;
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

/** Props for the PeekWidget component */
export interface PeekWidgetProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  /** Called when the widget should be closed */
  onClose?: () => void;
  /** Called when user wants to navigate to the definition (e.g., double-click) */
  onNavigate?: (location: PeekLocation) => void;
}

/** State for the peek widget */
export interface PeekWidgetState {
  visible: boolean;
  locations: PeekLocation[];
  currentIndex: number;
  originPosition: Monaco.IPosition | null;
  originUri: string | null;
}

// ============================================================================
// File Content Fetching
// ============================================================================

/** Fetches file content from backend */
async function fetchFileContent(filePath: string): Promise<string | null> {
  try {
    // Convert URI to file path
    const normalizedPath = filePath.replace(/^file:\/\//, "").replace(/\//g, "\\");
    const content = await invoke<string>("read_file", { path: normalizedPath });
    return content;
  } catch (error) {
    console.error("Failed to fetch file content for peek:", error);
    return null;
  }
}

/** Extract filename from URI */
function getFileName(uri: string): string {
  const path = uri.replace(/^file:\/\//, "");
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || uri;
}

/** Extract directory path from URI */
function getDirName(uri: string): string {
  const path = uri.replace(/^file:\/\//, "");
  const parts = path.split(/[/\\]/);
  parts.pop(); // Remove filename
  const dirPath = parts.join("/");
  // Return last 2-3 parts for brevity
  const displayParts = parts.slice(-3);
  return displayParts.length < parts.length ? ".../" + displayParts.join("/") : dirPath;
}

/** Get language ID from file extension */
function getLanguageFromUri(uri: string, _monaco?: typeof Monaco): string {
  const fileName = getFileName(uri);
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
    h: "cpp",
    hpp: "cpp",
    cs: "csharp",
    css: "css",
    scss: "scss",
    less: "less",
    html: "html",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sql: "sql",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
  };
  
  return languageMap[ext] || "plaintext";
}

// ============================================================================
// PeekWidget Component
// ============================================================================

export function PeekWidget(props: PeekWidgetProps) {
  // Widget state
  const [state, setState] = createSignal<PeekWidgetState>({
    visible: false,
    locations: [],
    currentIndex: 0,
    originPosition: null,
    originUri: null,
  });
  
  // Preview content
  const [previewContent, setPreviewContent] = createSignal<string>("");
  const [previewLoading, setPreviewLoading] = createSignal(false);
  
  // Embedded editor reference
  let previewEditorRef: HTMLDivElement | undefined;
  let previewEditor: Monaco.editor.IStandaloneCodeEditor | null = null;
  
  // ViewZone ID for positioning
  let viewZoneId: string | null = null;
  
  // Widget container ref
  let widgetContainerRef: HTMLDivElement | undefined;
  
  // Resizing state
  const [widgetHeight, setWidgetHeight] = createSignal(300);
  const [isResizing, setIsResizing] = createSignal(false);
  
  // ============================================================================
  // Public API - Called from CodeEditor
  // ============================================================================
  
  /** Show peek widget with given locations */
  const show = async (locations: PeekLocation[], originPosition: Monaco.IPosition, originUri: string) => {
    if (locations.length === 0) return;
    
    setState({
      visible: true,
      locations,
      currentIndex: 0,
      originPosition,
      originUri,
    });
    
    // Load content for first location
    await loadPreviewContent(locations[0]);
    
    // Position the widget
    positionWidget();
  };
  
  /** Hide the peek widget */
  const hide = () => {
    setState({
      visible: false,
      locations: [],
      currentIndex: 0,
      originPosition: null,
      originUri: null,
    });
    
    // Remove view zone
    removeWidgetFromEditor();
    
    // Dispose preview editor
    if (previewEditor) {
      previewEditor.dispose();
      previewEditor = null;
    }
    
    props.onClose?.();
  };
  
  // Expose show/hide methods to parent via custom event
  onMount(() => {
    const handleShowPeek = async (e: Event) => {
      const customEvent = e as CustomEvent<{
        locations: PeekLocation[];
        originPosition: Monaco.IPosition;
        originUri: string;
      }>;
      if (customEvent.detail) {
        await show(customEvent.detail.locations, customEvent.detail.originPosition, customEvent.detail.originUri);
      }
    };
    
    const handleHidePeek = () => {
      hide();
    };
    
    window.addEventListener("peek:show", handleShowPeek);
    window.addEventListener("peek:hide", handleHidePeek);
    
    onCleanup(() => {
      window.removeEventListener("peek:show", handleShowPeek);
      window.removeEventListener("peek:hide", handleHidePeek);
    });
  });
  
  // ============================================================================
  // Content Loading
  // ============================================================================
  
  /** Load content for a specific location */
  const loadPreviewContent = async (location: PeekLocation) => {
    setPreviewLoading(true);
    
    try {
      const content = await fetchFileContent(location.uri);
      if (content) {
        setPreviewContent(content);
        
        // Update preview editor if it exists
        if (previewEditor && props.monaco) {
          const language = getLanguageFromUri(location.uri, props.monaco);
          const model = previewEditor.getModel();
          
          if (model) {
            model.setValue(content);
            props.monaco.editor.setModelLanguage(model, language);
          }
          
          // Reveal the definition line
          previewEditor.revealLineInCenter(location.range.startLineNumber);
          
          // Highlight the definition
          previewEditor.setSelection({
            startLineNumber: location.range.startLineNumber,
            startColumn: location.range.startColumn,
            endLineNumber: location.range.endLineNumber,
            endColumn: location.range.endColumn,
          });
          
          // Add decoration to highlight the line
          previewEditor.deltaDecorations([], [{
            range: {
              startLineNumber: location.range.startLineNumber,
              startColumn: 1,
              endLineNumber: location.range.startLineNumber,
              endColumn: 1,
            },
            options: {
              isWholeLine: true,
              className: "peek-definition-highlight-line",
              overviewRuler: {
                color: "var(--cortex-info)",
                position: props.monaco.editor.OverviewRulerLane.Full,
              },
            },
          }]);
        }
      }
    } catch (error) {
      console.error("Failed to load peek preview:", error);
      setPreviewContent("// Failed to load file content");
    } finally {
      setPreviewLoading(false);
    }
  };
  
  // ============================================================================
  // Widget Positioning
  // ============================================================================
  
  /** Position the widget below the cursor using ViewZone */
  const positionWidget = () => {
    const { editor, monaco } = props;
    const currentState = state();
    
    if (!editor || !monaco || !currentState.originPosition || !widgetContainerRef) return;
    
    // Remove any existing widget
    removeWidgetFromEditor();
    
    // Create overlay widget for positioning
    const position = currentState.originPosition;
    
    // Add a view zone to make space for the widget
    editor.changeViewZones((accessor) => {
      viewZoneId = accessor.addZone({
        afterLineNumber: position.lineNumber,
        heightInPx: widgetHeight() + 10,
        domNode: document.createElement("div"), // Placeholder
      });
    });
    
    // Position manually relative to the line
    const layoutInfo = editor.getLayoutInfo();
    const lineTop = editor.getTopForLineNumber(position.lineNumber + 1);
    const scrollTop = editor.getScrollTop();
    
    if (widgetContainerRef) {
      widgetContainerRef.style.position = "absolute";
      widgetContainerRef.style.top = `${lineTop - scrollTop + 20}px`;
      widgetContainerRef.style.left = `${layoutInfo.contentLeft}px`;
      widgetContainerRef.style.width = `${layoutInfo.contentWidth}px`;
      widgetContainerRef.style.zIndex = "50";
    }
    
    // Add to editor's DOM
    const editorDom = editor.getDomNode();
    if (editorDom && widgetContainerRef && !editorDom.contains(widgetContainerRef)) {
      editorDom.appendChild(widgetContainerRef);
    }
  };
  
  /** Remove widget from editor */
  const removeWidgetFromEditor = () => {
    const { editor } = props;
    
    if (editor && viewZoneId) {
      editor.changeViewZones((accessor) => {
        if (viewZoneId) {
          accessor.removeZone(viewZoneId);
          viewZoneId = null;
        }
      });
    }
    
    // Remove from DOM
    if (widgetContainerRef && widgetContainerRef.parentNode) {
      widgetContainerRef.parentNode.removeChild(widgetContainerRef);
    }
  };
  
  // ============================================================================
  // Navigation
  // ============================================================================
  
  /** Go to previous definition */
  const goToPrevious = async () => {
    const currentState = state();
    if (currentState.locations.length <= 1) return;
    
    const newIndex = currentState.currentIndex === 0 
      ? currentState.locations.length - 1 
      : currentState.currentIndex - 1;
    
    setState({ ...currentState, currentIndex: newIndex });
    await loadPreviewContent(currentState.locations[newIndex]);
  };
  
  /** Go to next definition */
  const goToNext = async () => {
    const currentState = state();
    if (currentState.locations.length <= 1) return;
    
    const newIndex = (currentState.currentIndex + 1) % currentState.locations.length;
    
    setState({ ...currentState, currentIndex: newIndex });
    await loadPreviewContent(currentState.locations[newIndex]);
  };
  
  /** Navigate to the current definition (go to file) */
  const navigateToDefinition = () => {
    const currentState = state();
    const location = currentState.locations[currentState.currentIndex];
    
    if (location) {
      props.onNavigate?.(location);
      hide();
    }
  };
  
  // ============================================================================
  // Event Handling
  // ============================================================================
  
  // Handle keyboard events
  createEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state().visible) return;
      
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        hide();
      } else if (e.key === "ArrowUp" && e.altKey) {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "ArrowDown" && e.altKey) {
        e.preventDefault();
        goToNext();
      } else if (e.key === "Enter") {
        e.preventDefault();
        navigateToDefinition();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown, true);
    
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown, true);
    });
  });
  
  // Create preview editor when visible
  createEffect(() => {
    const currentState = state();
    
    if (currentState.visible && previewEditorRef && props.monaco && !previewEditor) {
      // Create embedded editor
      previewEditor = props.monaco.editor.create(previewEditorRef, {
        value: previewContent(),
        language: currentState.locations[0] 
          ? getLanguageFromUri(currentState.locations[0].uri, props.monaco) 
          : "plaintext",
        theme: "cortex-dark",
        readOnly: true,
        minimap: { enabled: false },
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        folding: true,
        glyphMargin: false,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 3,
        renderLineHighlight: "none",
        overviewRulerBorder: false,
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: {
          vertical: "auto",
          horizontal: "auto",
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
        fontSize: 12,
        lineHeight: 18,
        padding: { top: 8, bottom: 8 },
        automaticLayout: true,
      });
      
      // Handle double-click to navigate
      previewEditor.onMouseDown((e) => {
        if (e.event.detail === 2) { // Double click
          navigateToDefinition();
        }
      });
    }
  });
  
  // Update widget position on scroll
  createEffect(() => {
    const { editor } = props;
    if (!editor || !state().visible) return;
    
    const scrollDisposable = editor.onDidScrollChange(() => {
      if (state().visible) {
        positionWidget();
      }
    });
    
    onCleanup(() => {
      scrollDisposable.dispose();
    });
  });
  
  // Handle resize
  const handleResizeMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startY = e.clientY;
    const startHeight = widgetHeight();
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(150, Math.min(600, startHeight + deltaY));
      setWidgetHeight(newHeight);
      
      // Update view zone
      if (props.editor && viewZoneId) {
        props.editor.changeViewZones((accessor) => {
          if (viewZoneId) {
            accessor.removeZone(viewZoneId);
            viewZoneId = accessor.addZone({
              afterLineNumber: state().originPosition?.lineNumber || 1,
              heightInPx: newHeight + 10,
              domNode: document.createElement("div"),
            });
          }
        });
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };
  
  // Cleanup
  onCleanup(() => {
    hide();
  });
  
  // Get current location info
  const currentLocation = () => {
    const currentState = state();
    return currentState.locations[currentState.currentIndex];
  };
  
  return (
    <Show when={state().visible}>
      <div
        ref={widgetContainerRef}
        class="peek-widget"
        style={{
          height: `${widgetHeight()}px`,
        }}
      >
        {/* Header */}
        <div class="peek-widget-header">
          <div class="peek-widget-title">
            <span class="peek-widget-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M14 4.5V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h7.5L14 4.5zM13 4.5V5H10a1 1 0 0 1-1-1V1.5H3a.5.5 0 0 0-.5.5v12a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V4.5H13z"/>
              </svg>
            </span>
            <span class="peek-widget-filename">{currentLocation() ? getFileName(currentLocation()!.uri) : ""}</span>
            <span class="peek-widget-dirname">{currentLocation() ? getDirName(currentLocation()!.uri) : ""}</span>
            <Show when={currentLocation()}>
              <span class="peek-widget-line">
                :{currentLocation()!.range.startLineNumber}
              </span>
            </Show>
          </div>
          
          <div class="peek-widget-actions">
            {/* Navigation for multiple results */}
            <Show when={state().locations.length > 1}>
              <button
                class="peek-widget-nav-btn"
                onClick={goToPrevious}
                title="Previous definition (Alt+↑)"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path fill-rule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/>
                </svg>
              </button>
              <span class="peek-widget-count">
                {state().currentIndex + 1} / {state().locations.length}
              </span>
              <button
                class="peek-widget-nav-btn"
                onClick={goToNext}
                title="Next definition (Alt+↓)"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                </svg>
              </button>
            </Show>
            
            {/* Go to definition button */}
            <button
              class="peek-widget-action-btn"
              onClick={navigateToDefinition}
              title="Go to definition (Enter)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
                <path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
              </svg>
            </button>
            
            {/* Close button */}
            <button
              class="peek-widget-close-btn"
              onClick={hide}
              title="Close (Escape)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </button>
          </div>
        </div>
        
        {/* Body - Embedded Editor */}
        <div class="peek-widget-body">
          <Show when={previewLoading()}>
            <div class="peek-widget-loading">
              <div class="peek-widget-spinner" />
              <span>Loading...</span>
            </div>
          </Show>
          <div
            ref={previewEditorRef}
            class="peek-widget-editor"
            style={{
              height: `${widgetHeight() - 40}px`,
              display: previewLoading() ? "none" : "block",
            }}
          />
        </div>
        
        {/* Resize Handle */}
        <div
          class="peek-widget-resize-handle"
          onMouseDown={handleResizeMouseDown}
          style={{
            cursor: isResizing() ? "ns-resize" : "s-resize",
          }}
        />
      </div>
    </Show>
  );
}

// ============================================================================
// Helper to trigger peek from CodeEditor
// ============================================================================

/** Dispatch event to show peek widget */
export function showPeekWidget(
  locations: PeekLocation[],
  originPosition: Monaco.IPosition,
  originUri: string
) {
  window.dispatchEvent(
    new CustomEvent("peek:show", {
      detail: { locations, originPosition, originUri },
    })
  );
}

/** Dispatch event to hide peek widget */
export function hidePeekWidget() {
  window.dispatchEvent(new CustomEvent("peek:hide"));
}

