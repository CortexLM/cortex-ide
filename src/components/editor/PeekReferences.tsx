/**
 * PeekReferences - Inline Peek References Widget
 * 
 * Shows references inline at cursor position (like VS Code's peek view).
 * Features:
 * - File tabs at top for multiple files with references
 * - Reference list with line previews
 * - Preview editor for selected reference
 * - Navigate with arrow keys
 * - Escape to close
 * - Click to navigate permanently
 */

import { Show, For, createSignal, createEffect, onCleanup, onMount, createMemo } from "solid-js";
import type * as Monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";
import type { Location, Position } from "@/context/LSPContext";

// ============================================================================
// Types
// ============================================================================

export interface ReferenceItem {
  uri: string;
  range: {
    start: Position;
    end: Position;
  };
  lineContent: string;
}

export interface FileGroup {
  uri: string;
  fileName: string;
  references: ReferenceItem[];
}

export interface PeekReferencesState {
  visible: boolean;
  loading: boolean;
  fileGroups: FileGroup[];
  activeFileIndex: number;
  activeRefIndex: number;
  originPosition: Monaco.IPosition | null;
  originUri: string | null;
  symbolName: string;
}

export interface PeekReferencesProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  onClose?: () => void;
  onNavigate?: (uri: string, line: number, column: number) => void;
}

// ============================================================================
// Utilities
// ============================================================================

/** Extract filename from URI */
function getFileName(uri: string): string {
  const path = uri.replace(/^file:\/\//, "").replace(/\\/g, "/");
  const parts = path.split("/");
  return parts[parts.length - 1] || uri;
}

/** Fetches file content from backend */
async function fetchFileContent(filePath: string): Promise<string | null> {
  try {
    const normalizedPath = filePath.replace(/^file:\/\//, "").replace(/\//g, "\\");
    const content = await invoke<string>("read_file", { path: normalizedPath });
    return content;
  } catch (error) {
    console.error("Failed to fetch file content for peek:", error);
    return null;
  }
}

/** Get language ID from file extension */
function getLanguageFromUri(uri: string): string {
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

/** Fetch single line content */
async function fetchLineContent(uri: string, line: number): Promise<string> {
  try {
    const content = await fetchFileContent(uri);
    if (!content) return "";
    const lines = content.split("\n");
    return lines[line] || "";
  } catch {
    return "";
  }
}

// ============================================================================
// Component
// ============================================================================

export function PeekReferences(props: PeekReferencesProps) {
  const [state, setState] = createSignal<PeekReferencesState>({
    visible: false,
    loading: false,
    fileGroups: [],
    activeFileIndex: 0,
    activeRefIndex: 0,
    originPosition: null,
    originUri: null,
    symbolName: "",
  });

  const [previewContent, setPreviewContent] = createSignal<string>("");
  const [widgetHeight, setWidgetHeight] = createSignal(350);
  const [isResizing, setIsResizing] = createSignal(false);

  let widgetContainerRef: HTMLDivElement | undefined;
  let previewEditorRef: HTMLDivElement | undefined;
  let previewEditor: Monaco.editor.IStandaloneCodeEditor | null = null;
  let viewZoneId: string | null = null;
  let refListRef: HTMLDivElement | undefined;

  // Current active file group
  const activeFileGroup = createMemo(() => {
    const groups = state().fileGroups;
    const index = state().activeFileIndex;
    return groups[index] || null;
  });

  // Current active reference
  const activeReference = createMemo(() => {
    const group = activeFileGroup();
    if (!group) return null;
    return group.references[state().activeRefIndex] || null;
  });

  // Total reference count
  const totalRefCount = createMemo(() => {
    return state().fileGroups.reduce((sum, g) => sum + g.references.length, 0);
  });

  // ============================================================================
  // Public API
  // ============================================================================

  /** Show peek widget with given references */
  const show = async (
    locations: Location[],
    symbolName: string,
    originPosition: Monaco.IPosition,
    originUri: string
  ) => {
    if (locations.length === 0) return;

    setState({
      visible: true,
      loading: true,
      fileGroups: [],
      activeFileIndex: 0,
      activeRefIndex: 0,
      originPosition,
      originUri,
      symbolName,
    });

    try {
      // Group locations by file
      const groupMap = new Map<string, ReferenceItem[]>();

      for (const loc of locations) {
        const uri = loc.uri;
        if (!groupMap.has(uri)) {
          groupMap.set(uri, []);
        }

        // Fetch line content
        const lineContent = await fetchLineContent(uri, loc.range.start.line);

        groupMap.get(uri)!.push({
          uri: loc.uri,
          range: loc.range,
          lineContent: lineContent.trim(),
        });
      }

      // Convert to array
      const fileGroups: FileGroup[] = [];
      for (const [uri, refs] of groupMap) {
        refs.sort((a, b) => a.range.start.line - b.range.start.line);
        fileGroups.push({
          uri,
          fileName: getFileName(uri),
          references: refs,
        });
      }

      // Sort by filename
      fileGroups.sort((a, b) => a.fileName.localeCompare(b.fileName));

      setState((prev) => ({
        ...prev,
        loading: false,
        fileGroups,
      }));

      // Load preview for first reference
      if (fileGroups.length > 0 && fileGroups[0].references.length > 0) {
        await loadPreview(fileGroups[0].references[0]);
      }

      // Position widget
      positionWidget();
    } catch (error) {
      console.error("Failed to load references:", error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  /** Hide the peek widget */
  const hide = () => {
    setState({
      visible: false,
      loading: false,
      fileGroups: [],
      activeFileIndex: 0,
      activeRefIndex: 0,
      originPosition: null,
      originUri: null,
      symbolName: "",
    });

    removeWidgetFromEditor();

    if (previewEditor) {
      previewEditor.dispose();
      previewEditor = null;
    }

    props.onClose?.();
  };

  // ============================================================================
  // Preview Loading
  // ============================================================================

  /** Load preview content for a reference */
  const loadPreview = async (ref: ReferenceItem) => {
    const content = await fetchFileContent(ref.uri);
    if (!content) {
      setPreviewContent("// Failed to load file content");
      return;
    }

    setPreviewContent(content);

    if (previewEditor && props.monaco) {
      const language = getLanguageFromUri(ref.uri);
      const model = previewEditor.getModel();

      if (model) {
        model.setValue(content);
        props.monaco.editor.setModelLanguage(model, language);
      }

      // Reveal and highlight the reference line
      const lineNumber = ref.range.start.line + 1;
      previewEditor.revealLineInCenter(lineNumber);
      previewEditor.setSelection({
        startLineNumber: lineNumber,
        startColumn: ref.range.start.character + 1,
        endLineNumber: ref.range.end.line + 1,
        endColumn: ref.range.end.character + 1,
      });

      // Add highlight decoration
      previewEditor.deltaDecorations([], [{
        range: {
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: "peek-reference-highlight-line",
          overviewRuler: {
            color: "var(--cortex-info)",
            position: props.monaco.editor.OverviewRulerLane.Full,
          },
        },
      }]);
    }
  };

  // ============================================================================
  // Widget Positioning
  // ============================================================================

  /** Position the widget below the cursor */
  const positionWidget = () => {
    const { editor, monaco } = props;
    const currentState = state();

    if (!editor || !monaco || !currentState.originPosition || !widgetContainerRef) return;

    removeWidgetFromEditor();

    const position = currentState.originPosition;

    // Add view zone
    editor.changeViewZones((accessor) => {
      viewZoneId = accessor.addZone({
        afterLineNumber: position.lineNumber,
        heightInPx: widgetHeight() + 10,
        domNode: document.createElement("div"),
      });
    });

    // Position widget
    const layoutInfo = editor.getLayoutInfo();
    const lineTop = editor.getTopForLineNumber(position.lineNumber + 1);
    const scrollTop = editor.getScrollTop();

    widgetContainerRef.style.position = "absolute";
    widgetContainerRef.style.top = `${lineTop - scrollTop + 20}px`;
    widgetContainerRef.style.left = `${layoutInfo.contentLeft}px`;
    widgetContainerRef.style.width = `${layoutInfo.contentWidth}px`;
    widgetContainerRef.style.zIndex = "50";

    // Add to editor DOM
    const editorDom = editor.getDomNode();
    if (editorDom && !editorDom.contains(widgetContainerRef)) {
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

    if (widgetContainerRef && widgetContainerRef.parentNode) {
      widgetContainerRef.parentNode.removeChild(widgetContainerRef);
    }
  };

  // ============================================================================
  // Navigation
  // ============================================================================

  /** Select a file tab */
  const selectFile = async (fileIndex: number) => {
    const groups = state().fileGroups;
    if (fileIndex < 0 || fileIndex >= groups.length) return;

    setState((prev) => ({
      ...prev,
      activeFileIndex: fileIndex,
      activeRefIndex: 0,
    }));

    const ref = groups[fileIndex].references[0];
    if (ref) {
      await loadPreview(ref);
    }
  };

  /** Select a reference */
  const selectReference = async (refIndex: number) => {
    const group = activeFileGroup();
    if (!group || refIndex < 0 || refIndex >= group.references.length) return;

    setState((prev) => ({ ...prev, activeRefIndex: refIndex }));
    await loadPreview(group.references[refIndex]);
    scrollToSelected();
  };

  /** Navigate to next reference */
  const goToNextRef = async () => {
    const group = activeFileGroup();
    if (!group) return;

    const currentIndex = state().activeRefIndex;
    if (currentIndex < group.references.length - 1) {
      await selectReference(currentIndex + 1);
    } else if (state().activeFileIndex < state().fileGroups.length - 1) {
      // Move to next file
      await selectFile(state().activeFileIndex + 1);
    }
  };

  /** Navigate to previous reference */
  const goToPrevRef = async () => {
    const group = activeFileGroup();
    if (!group) return;

    const currentIndex = state().activeRefIndex;
    if (currentIndex > 0) {
      await selectReference(currentIndex - 1);
    } else if (state().activeFileIndex > 0) {
      // Move to previous file, last reference
      const prevIndex = state().activeFileIndex - 1;
      const prevGroup = state().fileGroups[prevIndex];
      setState((prev) => ({
        ...prev,
        activeFileIndex: prevIndex,
        activeRefIndex: prevGroup.references.length - 1,
      }));
      await loadPreview(prevGroup.references[prevGroup.references.length - 1]);
    }
  };

  /** Navigate to the current reference (go to file) */
  const navigateToReference = () => {
    const ref = activeReference();
    if (!ref) return;

    const uri = ref.uri.startsWith("file://") ? ref.uri : `file://${ref.uri}`;
    const filePath = uri.replace(/^file:\/\//, "");
    
    props.onNavigate?.(filePath, ref.range.start.line + 1, ref.range.start.character + 1);
    hide();
  };

  /** Scroll to keep selected reference visible */
  const scrollToSelected = () => {
    if (!refListRef) return;
    const items = refListRef.querySelectorAll(".peek-ref-item");
    const selectedItem = items[state().activeRefIndex] as HTMLElement | undefined;
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: "nearest" });
    }
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  // Handle keyboard events
  createEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state().visible) return;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          hide();
          break;
        case "ArrowDown":
          e.preventDefault();
          goToNextRef();
          break;
        case "ArrowUp":
          e.preventDefault();
          goToPrevRef();
          break;
        case "ArrowLeft":
          if (e.altKey) {
            e.preventDefault();
            if (state().activeFileIndex > 0) {
              selectFile(state().activeFileIndex - 1);
            }
          }
          break;
        case "ArrowRight":
          if (e.altKey) {
            e.preventDefault();
            if (state().activeFileIndex < state().fileGroups.length - 1) {
              selectFile(state().activeFileIndex + 1);
            }
          }
          break;
        case "Enter":
          e.preventDefault();
          navigateToReference();
          break;
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
      previewEditor = props.monaco.editor.create(previewEditorRef, {
        value: previewContent(),
        language: "plaintext",
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

      // Double-click to navigate
      previewEditor.onMouseDown((e) => {
        if (e.event.detail === 2) {
          navigateToReference();
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
      const newHeight = Math.max(200, Math.min(600, startHeight + deltaY));
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

  // Listen for show/hide events
  onMount(() => {
    const handleShowPeekReferences = async (
      e: CustomEvent<{
        locations: Location[];
        symbolName: string;
        originPosition: Monaco.IPosition;
        originUri: string;
      }>
    ) => {
      if (e.detail) {
        await show(
          e.detail.locations,
          e.detail.symbolName,
          e.detail.originPosition,
          e.detail.originUri
        );
      }
    };

    const handleHidePeekReferences = () => {
      hide();
    };

    window.addEventListener("peek-references:show", handleShowPeekReferences as unknown as EventListener);
    window.addEventListener("peek-references:hide", handleHidePeekReferences);

    onCleanup(() => {
      window.removeEventListener("peek-references:show", handleShowPeekReferences as unknown as EventListener);
      window.removeEventListener("peek-references:hide", handleHidePeekReferences);
    });
  });

  // Cleanup
  onCleanup(() => {
    hide();
  });

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Show when={state().visible}>
      <div
        ref={widgetContainerRef}
        class="peek-references-widget"
        style={{
          height: `${widgetHeight()}px`,
        }}
      >
        {/* Header with file tabs */}
        <div class="peek-references-header">
          <div class="peek-references-tabs">
            <For each={state().fileGroups}>
              {(group, index) => (
                <button
                  class="peek-references-tab"
                  classList={{ active: index() === state().activeFileIndex }}
                  onClick={() => selectFile(index())}
                  title={group.uri}
                >
                  <span class="peek-tab-icon">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M14 4.5V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h7.5L14 4.5zM13 4.5V5H10a1 1 0 0 1-1-1V1.5H3a.5.5 0 0 0-.5.5v12a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V4.5H13z"/>
                    </svg>
                  </span>
                  <span class="peek-tab-name">{group.fileName}</span>
                  <span class="peek-tab-count">{group.references.length}</span>
                </button>
              )}
            </For>
          </div>

          <div class="peek-references-info">
            <span class="peek-references-symbol">{state().symbolName}</span>
            <span class="peek-references-count">
              {totalRefCount()} reference{totalRefCount() !== 1 ? "s" : ""}
            </span>
          </div>

          <div class="peek-references-actions">
            <button
              class="peek-references-action-btn"
              onClick={navigateToReference}
              title="Go to reference (Enter)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
                <path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
              </svg>
            </button>
            <button
              class="peek-references-close-btn"
              onClick={hide}
              title="Close (Escape)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body - split view */}
        <div class="peek-references-body">
          {/* Reference list */}
          <div class="peek-references-list" ref={refListRef}>
            <Show when={state().loading}>
              <div class="peek-references-loading">
                <div class="peek-references-spinner" />
                <span>Loading...</span>
              </div>
            </Show>

            <Show when={!state().loading && activeFileGroup()}>
              <For each={activeFileGroup()?.references || []}>
                {(ref, index) => {
                  const lineNumber = ref.range.start.line + 1;
                  const isSelected = () => index() === state().activeRefIndex;

                  return (
                    <div
                      class="peek-ref-item"
                      classList={{ selected: isSelected() }}
                      onClick={() => selectReference(index())}
                      onDblClick={navigateToReference}
                    >
                      <span class="peek-ref-line">{lineNumber}</span>
                      <span class="peek-ref-content">{ref.lineContent}</span>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>

          {/* Preview editor */}
          <div class="peek-references-preview">
            <div
              ref={previewEditorRef}
              class="peek-references-editor"
              style={{ height: `${widgetHeight() - 70}px` }}
            />
          </div>
        </div>

        {/* Resize handle */}
        <div
          class="peek-references-resize-handle"
          onMouseDown={handleResizeMouseDown}
          style={{ cursor: isResizing() ? "ns-resize" : "s-resize" }}
        />
      </div>
    </Show>
  );
}

// ============================================================================
// Helper functions to trigger peek from outside
// ============================================================================

/** Show peek references widget */
export function showPeekReferences(
  locations: Location[],
  symbolName: string,
  originPosition: Monaco.IPosition,
  originUri: string
) {
  window.dispatchEvent(
    new CustomEvent("peek-references:show", {
      detail: { locations, symbolName, originPosition, originUri },
    })
  );
}

/** Hide peek references widget */
export function hidePeekReferences() {
  window.dispatchEvent(new CustomEvent("peek-references:hide"));
}

export default PeekReferences;

