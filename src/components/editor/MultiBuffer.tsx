import { Show, Suspense, createSignal, createMemo, createEffect, onMount, onCleanup, JSX, lazy, For } from "solid-js";
import { useEditor, SplitDirection, OpenFile, EditorGroup } from "@/context/EditorContext";
import { CodeEditor } from "./CodeEditor";
import { TabBar } from "./TabBar";
import { ImageViewer, isImageFile, SVGPreview, isSVGFile } from "../viewers";
import { Icon } from "../ui/Icon";
import { Card, Text } from "@/components/ui";
import "@/styles/animations.css";

// Lazy load DiffEditor for better performance - only loaded when needed
const DiffEditorLazy = lazy(() => import("./DiffEditor"));

// Lazy load CortexSettingsPanel - only loaded when Settings tab is opened
const CortexSettingsPanelLazy = lazy(() => import("@/components/cortex/CortexSettingsPanel"));

const SETTINGS_VIRTUAL_PATH = "virtual:///Settings";

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  splitRatio: "editor_split_ratio",
} as const;

// ============================================================================
// Editor Group Panel
// ============================================================================

interface EditorGroupPanelProps {
  group: EditorGroup;
  groupIndex: number;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  showCloseButton: boolean;
  totalGroups: number;
}

function EditorGroupPanel(props: EditorGroupPanelProps) {
  const { setActiveFile, closeFile, getGroupFiles, moveFileToGroup } = useEditor();
  
  const files = () => getGroupFiles(props.group.id);
  // Track if we're in the middle of closing a file to prevent re-renders during cleanup
  const [isClosingFile, setIsClosingFile] = createSignal(false);
  
  // Use a defensive check to prevent accessing undefined/null during cleanup
  const activeFile = createMemo(() => {
    // Don't update during file closing to prevent SolidJS cleanup race condition
    if (isClosingFile()) return undefined;
    const activeId = props.group.activeFileId;
    if (!activeId) return undefined;
    return files().find((f) => f.id === activeId);
  });
  
  // Listen for file closing event to prevent re-renders during cleanup
  onMount(() => {
    const handleFileClosing = (e: CustomEvent<{ fileId: string }>) => {
      const closingFileId = e.detail?.fileId;
      // Check if this file belongs to our group
      if (closingFileId && files().some(f => f.id === closingFileId)) {
        setIsClosingFile(true);
        // Reset after the close operation completes
        setTimeout(() => setIsClosingFile(false), 50);
      }
    };
    
    window.addEventListener('editor:file-closing', handleFileClosing as EventListener);
    
    onCleanup(() => {
      window.removeEventListener('editor:file-closing', handleFileClosing as EventListener);
    });
  });
  
  const handleFileSelect = (fileId: string) => {
    setActiveFile(fileId);
    props.onActivate();
  };
  
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  };
  
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const fileId = e.dataTransfer?.getData("text/plain");
    if (fileId) {
      moveFileToGroup(fileId, props.group.id);
    }
  };

  const handleNewFile = () => {
    // Dispatch event for new file creation
    window.dispatchEvent(new CustomEvent("create-new-file", { 
      detail: { groupId: props.group.id } 
    }));
  };

  return (
    <div
      class="flex-1 flex flex-col min-h-0 overflow-hidden"
      style={{
        outline: props.isActive ? "2px solid var(--accent)" : "none",
        "outline-offset": "-2px",
        // Figma design: Container background for tab bar area
        background: "var(--cortex-bg-primary, var(--cortex-bg-secondary))",
      }}
      onClick={props.onActivate}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-editor-group={props.group.id}
      data-group-index={props.groupIndex}
    >
      <TabBar 
        files={files()}
        activeFileId={props.group.activeFileId}
        onFileSelect={handleFileSelect}
        onFileClose={(fileId) => closeFile(fileId)}
        onNewFile={handleNewFile}
        groupId={props.group.id}
        showCloseGroupButton={props.showCloseButton}
        onCloseGroup={props.onClose}
      />
      
      {/* Use CSS visibility instead of Show to prevent SolidJS cleanup race condition
          when closing the last file. Monaco editor needs time to dispose properly. */}
      <div
        style={{
          display: activeFile() ? "none" : "flex",
          flex: "1",
          "min-height": "0",
        }}
      >
        <EmptyGroupState 
          groupIndex={props.groupIndex} 
          totalGroups={props.totalGroups}
        />
      </div>
      <Show when={activeFile()}>
        <FileViewer 
          file={activeFile()!} 
          groupId={props.group.id}
        />
      </Show>
    </div>
  );
}

// ============================================================================
// Empty Group State
// ============================================================================

interface EmptyGroupStateProps {
  groupIndex: number;
  totalGroups: number;
}

function EmptyGroupState(props: EmptyGroupStateProps) {
  const kbdStyle: JSX.CSSProperties = {
    padding: "2px 8px",
    background: "var(--jb-surface-active)",
    border: "1px solid var(--jb-border-default)",
    "border-radius": "var(--jb-radius-sm)",
    "font-family": "var(--jb-font-mono)",
    "font-size": "var(--jb-text-muted-size)",
  };

  return (
    <div 
      style={{ 
        flex: "1",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        background: "var(--jb-canvas)",
      }}
    >
      <Card padding="lg" style={{ "text-align": "center", "max-width": "280px" }}>
        <div style={{ 
          display: "flex", 
          "flex-direction": "column", 
          "align-items": "center", 
          gap: "12px" 
        }}>
<Icon name="file" style={{ 
            width: "32px", 
            height: "32px", 
            color: "var(--jb-text-muted-color)" 
          }} />
          <Text variant="body">
            {props.totalGroups > 1 
              ? `Editor ${props.groupIndex + 1} - No file open`
              : "No file open"
            }
          </Text>
          <Text variant="muted" size="sm">
            Drag a file here or use keyboard shortcuts
          </Text>
          <div style={{ 
            display: "flex", 
            "flex-direction": "column", 
            gap: "8px",
            "margin-top": "4px",
          }}>
            <div style={{ display: "flex", "align-items": "center", "justify-content": "center", gap: "8px" }}>
              <kbd style={kbdStyle}>Ctrl+P</kbd>
              <Text variant="muted" size="sm">Open file</Text>
            </div>
            <div style={{ display: "flex", "align-items": "center", "justify-content": "center", gap: "8px" }}>
              <kbd style={kbdStyle}>Ctrl+N</kbd>
              <Text variant="muted" size="sm">New file</Text>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// File Viewer
// ============================================================================

interface FileViewerProps {
  file: OpenFile;
  groupId: string;
}

function FileViewer(props: FileViewerProps) {
  const { updateFileContent } = useEditor();
  
  // Check if it's a Settings virtual tab
  const isSettings = () => props.file.path === SETTINGS_VIRTUAL_PATH;
  
  // Check if it's an SVG file (special handling with live preview)
  const isSvg = () => isSVGFile(props.file.name);
  
  // Check if it's a non-SVG image file
  const isNonSvgImage = () => isImageFile(props.file.name) && !isSvg();
  
  return (
    <Show
      when={isSettings()}
      fallback={
        <Show
          when={isSvg()}
          fallback={
            <Show
              when={isNonSvgImage()}
              fallback={
                <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <CodeEditor file={props.file} groupId={props.groupId} />
                </div>
              }
            >
              <ImageViewer
                path={props.file.path}
                name={props.file.name}
              />
            </Show>
          }
        >
          <SVGPreview
            content={props.file.content}
            filePath={props.file.path}
            fileName={props.file.name}
            onContentChange={(content) => updateFileContent(props.file.id, content)}
          />
        </Show>
      }
    >
      <Suspense fallback={<div style={{ flex: "1", display: "flex", "align-items": "center", "justify-content": "center" }}>Loading settings...</div>}>
        <CortexSettingsPanelLazy />
      </Suspense>
    </Show>
  );
}

// ============================================================================
// Split Container
// ============================================================================

interface SplitContainerProps {
  direction: SplitDirection;
  first: () => JSX.Element;
  second: () => JSX.Element;
  ratio: number;
  onRatioChange: (ratio: number) => void;
  storageKey?: string;
}

function SplitContainer(props: SplitContainerProps) {
  const [isDragging, setIsDragging] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging() || !containerRef) return;
    
    const rect = containerRef.getBoundingClientRect();
    let newRatio: number;
    
    if (props.direction === "horizontal") {
      newRatio = (e.clientY - rect.top) / rect.height;
    } else {
      newRatio = (e.clientX - rect.left) / rect.width;
    }
    
    newRatio = Math.max(0.15, Math.min(0.85, newRatio));
    props.onRatioChange(newRatio);
    
    // Save to localStorage
    if (props.storageKey) {
      localStorage.setItem(props.storageKey, newRatio.toString());
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    // Reset to 50%
    props.onRatioChange(0.5);
    if (props.storageKey) {
      localStorage.setItem(props.storageKey, "0.5");
    }
  };

  onMount(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  });

  onCleanup(() => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  });

  const isVertical = () => props.direction === "vertical";

  return (
    <div
      ref={containerRef}
      class="flex-1 flex overflow-hidden"
      style={{
        "flex-direction": isVertical() ? "row" : "column",
      }}
    >
      <div
        style={{
          [isVertical() ? "width" : "height"]: `${props.ratio * 100}%`,
          "min-width": isVertical() ? "100px" : undefined,
          "min-height": !isVertical() ? "100px" : undefined,
        }}
        class="flex overflow-hidden"
      >
        {props.first()}
      </div>
      
      <div
        class="shrink-0 flex items-center justify-center transition-colors"
        style={{
          width: isVertical() ? "4px" : "100%",
          height: isVertical() ? "100%" : "4px",
          background: isDragging() ? "var(--accent)" : "var(--border-weak)",
          cursor: isVertical() ? "col-resize" : "row-resize",
        }}
        onMouseDown={handleMouseDown}
        onDblClick={handleDoubleClick}
      />
      
      <div
        style={{
          [isVertical() ? "width" : "height"]: `${(1 - props.ratio) * 100}%`,
          "min-width": isVertical() ? "100px" : undefined,
          "min-height": !isVertical() ? "100px" : undefined,
        }}
        class="flex overflow-hidden"
      >
        {props.second()}
      </div>
    </div>
  );
}

// ============================================================================
// Diff View
// ============================================================================

interface DiffViewProps {
  leftFile: OpenFile;
  rightFile: OpenFile;
  /** Use Monaco's native diff editor instead of side-by-side code editors */
  useNativeDiff?: boolean;
}

/**
 * DiffView - Shows differences between two files
 * 
 * Supports two modes:
 * 1. Native diff mode (useNativeDiff=true): Uses Monaco's built-in diff editor
 *    - Better for code review with inline/side-by-side toggle
 *    - Lazy loaded for better initial performance
 * 2. Split view mode (default): Uses two CodeEditor components side by side
 *    - Better for editing both files simultaneously
 */
export function DiffView(props: DiffViewProps) {
  const useNative = () => props.useNativeDiff ?? false;

  return (
    <Show
      when={useNative()}
      fallback={
        // Traditional side-by-side view with two CodeEditor components
        <div style={{ flex: "1", display: "flex", overflow: "hidden" }}>
          <SplitContainer
            direction="vertical"
            ratio={0.5}
            onRatioChange={() => {}}
            first={() => (
              <div style={{ flex: "1", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
                <div 
                  style={{ 
                    height: "32px",
                    display: "flex",
                    "align-items": "center",
                    padding: "0 12px",
                    "border-bottom": "1px solid var(--jb-border-default)",
                    "flex-shrink": "0",
                    background: "var(--jb-surface-base)",
                  }}
                >
                  <Text variant="muted" size="sm">{props.leftFile.name} (Original)</Text>
                </div>
                <CodeEditor file={props.leftFile} />
              </div>
            )}
            second={() => (
              <div style={{ flex: "1", display: "flex", "flex-direction": "column", overflow: "hidden" }}>
                <div 
                  style={{ 
                    height: "32px",
                    display: "flex",
                    "align-items": "center",
                    padding: "0 12px",
                    "border-bottom": "1px solid var(--jb-border-default)",
                    "flex-shrink": "0",
                    background: "var(--jb-surface-base)",
                  }}
                >
                  <Text variant="muted" size="sm">{props.rightFile.name} (Modified)</Text>
                </div>
                <CodeEditor file={props.rightFile} />
              </div>
            )}
          />
        </div>
      }
    >
      {/* Lazy-loaded Monaco native diff editor */}
      <DiffEditorLazy
        originalContent={props.leftFile.content}
        modifiedContent={props.rightFile.content}
        language={props.rightFile.language || props.leftFile.language || "plaintext"}
        originalPath={props.leftFile.name}
        modifiedPath={props.rightFile.name}
      />
    </Show>
  );
}

// ============================================================================
// Multi Buffer Toolbar
// ============================================================================

interface MultiBufferToolbarProps {
  hasSplit: boolean;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  onUnsplit: () => void;
}

function MultiBufferToolbar(_props: MultiBufferToolbarProps) {
  // Hidden by default - split controls are in TabBar actions
  // This toolbar is kept for backwards compatibility but not displayed
  return null;
  
  /* Original toolbar - disabled for cleaner VS Code-like layout
  return (
    <div 
      class="h-7 flex items-center justify-end gap-1 px-2 border-b shrink-0"
      style={{ 
        background: "var(--surface-base)",
        "border-color": "var(--border-weak)",
      }}
    >
      <button
        onClick={props.onSplitVertical}
        class="p-1 rounded hover:bg-[var(--surface-raised)] transition-colors"
        style={{ color: "var(--text-weak)" }}
        title="Split Editor Right (Ctrl+\)"
      >
        <Icon name="columns" class="w-3.5 h-3.5" />
      </button>
      
      <button
        onClick={props.onSplitHorizontal}
        class="p-1 rounded hover:bg-[var(--surface-raised)] transition-colors"
        style={{ color: "var(--text-weak)" }}
        title="Split Editor Down (Ctrl+K Ctrl+\)"
      >
        <Icon name="table-columns" class="w-3.5 h-3.5" />
      </button>
      
      <Show when={props.hasSplit}>
        <button
          onClick={props.onUnsplit}
          class="p-1 rounded hover:bg-[var(--surface-raised)] transition-colors"
          style={{ color: "var(--text-weak)" }}
          title="Close All Splits"
        >
          <Icon name="maximize" class="w-3.5 h-3.5" />
        </button>
      </Show>
    </div>
  );
  */
}

// ============================================================================
// Main MultiBuffer Component
// ============================================================================

export function MultiBuffer() {
  const { 
    state, 
    splitEditor, 
    closeGroup, 
    setActiveGroup,
    unsplit,
  } = useEditor();
  
  // Load saved split ratio or default to 0.5
  const getSavedRatio = () => {
    const saved = localStorage.getItem(STORAGE_KEYS.splitRatio);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed)) return parsed;
    }
    return 0.5;
  };
  
  // Reserved for future resizable split feature
  const [_splitRatio, _setSplitRatio] = createSignal(getSavedRatio());
  const [agentModeActive, setAgentModeActive] = createSignal(false);
  const [newSplitIndex, setNewSplitIndex] = createSignal<number | null>(null);
  
  // JetBrains style: Auto-unsplit when all groups are empty
  // This prevents showing multiple empty welcome pages
  createEffect(() => {
    if (state.groups.length > 1) {
      const allGroupsEmpty = state.groups.every(g => g.fileIds.length === 0);
      if (allGroupsEmpty) {
        // Defer to next tick to avoid update-in-update issues
        setTimeout(() => unsplit(), 0);
      }
    }
  });
  
  // Listen for agent mode events
  onMount(() => {
    const handleAgentActive = (e: CustomEvent) => {
      if (e.detail?.allSplits) {
        setAgentModeActive(true);
      }
    };
    
    const handleAgentInactive = () => {
      setAgentModeActive(false);
    };
    
    window.addEventListener("editor:agentActive", handleAgentActive as EventListener);
    window.addEventListener("editor:agentInactive", handleAgentInactive);
    
    onCleanup(() => {
      window.removeEventListener("editor:agentActive", handleAgentActive as EventListener);
      window.removeEventListener("editor:agentInactive", handleAgentInactive);
    });
  });
  
  // Keyboard shortcuts for splits
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+\ : Split right (vertical)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "\\") {
        e.preventDefault();
        splitEditor("vertical");
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });
  
  // Track group count changes for animation
  let prevGroupCount = state.groups.length;
  onMount(() => {
    const checkGroupChanges = () => {
      if (state.groups.length > prevGroupCount) {
        // New split added - animate the new one
        setNewSplitIndex(state.groups.length - 1);
        setTimeout(() => setNewSplitIndex(null), 300);
      }
      prevGroupCount = state.groups.length;
    };
    
    // Check periodically (simple approach)
    const interval = setInterval(checkGroupChanges, 100);
    onCleanup(() => clearInterval(interval));
  });
  
  // PERFORMANCE: Memoize to prevent recalculation
  const hasSplit = createMemo(() => state.groups.length > 1);
  
  // Create a single EditorGroupPanel - memoized to prevent re-creation
  const createGroupPanel = (group: EditorGroup, index: number, total: number) => (
    <EditorGroupPanel
      group={group}
      groupIndex={index}
      isActive={state.activeGroupId === group.id}
      onActivate={() => setActiveGroup(group.id)}
      onClose={() => closeGroup(group.id)}
      showCloseButton={total > 1}
      totalGroups={total}
    />
  );

  return (
    <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
      <MultiBufferToolbar 
        hasSplit={hasSplit()}
        onSplitHorizontal={() => splitEditor("horizontal")}
        onSplitVertical={() => splitEditor("vertical")}
        onUnsplit={unsplit}
      />
      
      <div class="flex-1 flex overflow-hidden">
        {/* No groups */}
        <Show when={state.groups.length === 0}>
          <div style={{ 
            flex: "1", 
            display: "flex", 
            "align-items": "center", 
            "justify-content": "center",
            background: "var(--jb-canvas)",
          }}>
            <Text variant="muted">No editor groups</Text>
          </div>
        </Show>
        
        {/* Single group - no split */}
        <Show when={state.groups.length === 1}>
          <div 
            class={`flex-1 flex overflow-hidden relative ${agentModeActive() ? "agent-mode-active" : ""}`}
          >
            {createGroupPanel(state.groups[0], 0, 1)}
            <Show when={agentModeActive()}>
              <div class="agent-mode-overlay" />
            </Show>
          </div>
        </Show>
        
        {/* Multiple groups - render as flat flex container (no recursion) */}
        <Show when={state.groups.length > 1}>
          <div 
            class="flex-1 flex overflow-hidden"
            style={{ 
              "flex-direction": state.splits[0]?.direction === "horizontal" ? "column" : "row",
              gap: "1px",
            }}
          >
            <For each={state.groups}>
              {(group, index) => (
                <div 
                  class={`flex overflow-hidden relative ${
                    newSplitIndex() === index() ? "agent-split-entering" : ""
                  } ${agentModeActive() ? "agent-mode-active" : ""}`}
                  style={{ 
                    flex: `1 1 ${100 / state.groups.length}%`,
                    "min-width": state.splits[0]?.direction === "vertical" ? "150px" : undefined,
                    "min-height": state.splits[0]?.direction === "horizontal" ? "100px" : undefined,
                    // JetBrains Islands style: gap instead of borders
                    "margin-right": state.splits[0]?.direction === "vertical" && index() < state.groups.length - 1 
                      ? "2px" : undefined,
                    "margin-bottom": state.splits[0]?.direction === "horizontal" && index() < state.groups.length - 1 
                      ? "2px" : undefined,
                  }}
                >
                  {createGroupPanel(group, index(), state.groups.length)}
                  <Show when={agentModeActive()}>
                    <div class="agent-mode-overlay" />
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default MultiBuffer;

