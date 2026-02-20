/**
 * MultiFileDiffEditor - View and navigate diffs across multiple files
 * 
 * Features:
 * - File list sidebar showing changed files
 * - Monaco DiffEditor for selected file
 * - Navigation between files (Ctrl+Alt+PageUp/Down)
 * - Inline/Side-by-side toggle
 * - Accept/Reject changes per file
 * - Statistics (additions/deletions per file)
 */

import { createSignal, createEffect, onMount, onCleanup, Show, For, createMemo, type JSX } from "solid-js";
import type * as Monaco from "monaco-editor";
import { MonacoManager } from "@/utils/monacoManager";
import { Button, IconButton, Text, Badge, EmptyState } from "@/components/ui";
import { DiffNavigator, type DiffChange } from "./DiffNavigator";
import { EditorSkeleton } from "./EditorSkeleton";
import { Icon } from "../ui/Icon";

// ============================================================================
// Types
// ============================================================================

export interface FileDiffInfo {
  /** File path (relative or absolute) */
  path: string;
  /** Original content */
  originalContent: string;
  /** Modified content */
  modifiedContent: string;
  /** Number of lines added */
  additions: number;
  /** Number of lines deleted */
  deletions: number;
  /** Language for syntax highlighting */
  language?: string;
  /** Whether file is new (no original) */
  isNew?: boolean;
  /** Whether file is deleted (no modified) */
  isDeleted?: boolean;
  /** Whether file is renamed */
  isRenamed?: boolean;
  /** Original path if renamed */
  originalPath?: string;
  /** Status: pending, accepted, rejected */
  status?: "pending" | "accepted" | "rejected";
}

export interface MultiFileDiffEditorProps {
  /** List of files with their diffs */
  files: FileDiffInfo[];
  /** Initially selected file index */
  initialFileIndex?: number;
  /** Title for the diff view */
  title?: string;
  /** Allow accepting/rejecting changes */
  allowActions?: boolean;
  /** Callback when a file is accepted */
  onAccept?: (file: FileDiffInfo, index: number) => void;
  /** Callback when a file is rejected */
  onReject?: (file: FileDiffInfo, index: number) => void;
  /** Callback when all files are accepted */
  onAcceptAll?: () => void;
  /** Callback when all files are rejected */
  onRejectAll?: () => void;
  /** Callback when closing the diff view */
  onClose?: () => void;
  /** Read-only mode */
  readOnly?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Detect language from file extension */
function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    kt: "kotlin",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    md: "markdown",
    sql: "sql",
    sh: "shell",
    bash: "shell",
    dockerfile: "dockerfile",
    toml: "ini",
  };
  return languageMap[ext] || "plaintext";
}

/** Get file name from path */
function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

/** Get directory from path */
function getDirectory(path: string): string {
  const parts = path.split(/[/\\]/);
  parts.pop();
  return parts.join("/") || "";
}

// ============================================================================
// Component
// ============================================================================

export function MultiFileDiffEditor(props: MultiFileDiffEditorProps) {
  let diffContainerRef: HTMLDivElement | undefined;
  let diffEditorInstance: Monaco.editor.IStandaloneDiffEditor | null = null;
  
  const [selectedIndex, setSelectedIndex] = createSignal(props.initialFileIndex || 0);
  const [isLoading, setIsLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [diffMode, setDiffMode] = createSignal<"inline" | "sideBySide">("sideBySide");
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);
  const [changes, setChanges] = createSignal<DiffChange[]>([]);
  const [currentChangeIndex, setCurrentChangeIndex] = createSignal(0);
  
  const monacoManager = MonacoManager.getInstance();

  // Current file accessor
  const currentFile = createMemo(() => props.files[selectedIndex()]);

  // Statistics
  const totalStats = createMemo(() => {
    return props.files.reduce(
      (acc, file) => ({
        additions: acc.additions + file.additions,
        deletions: acc.deletions + file.deletions,
        pending: acc.pending + (file.status === "pending" || !file.status ? 1 : 0),
        accepted: acc.accepted + (file.status === "accepted" ? 1 : 0),
        rejected: acc.rejected + (file.status === "rejected" ? 1 : 0),
      }),
      { additions: 0, deletions: 0, pending: 0, accepted: 0, rejected: 0 }
    );
  });

  // Initialize diff editor
  const initDiffEditor = async () => {
    if (!diffContainerRef) {
      setLoadError("Container not available");
      setIsLoading(false);
      return;
    }

    try {
      const monaco = await monacoManager.ensureLoaded();
      
      // Create the diff editor
      diffEditorInstance = monaco.editor.createDiffEditor(diffContainerRef, {
        theme: "cortex-dark",
        automaticLayout: true,
        renderSideBySide: diffMode() === "sideBySide",
        enableSplitViewResizing: true,
        renderIndicators: true,
        renderMarginRevertIcon: true,
        ignoreTrimWhitespace: false,
        readOnly: props.readOnly ?? false,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
        fontLigatures: true,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        renderLineHighlight: "line",
        renderWhitespace: "selection",
        minimap: { enabled: true },
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          useShadows: false,
        },
      });

      // Set up change navigation listener
      diffEditorInstance.onDidUpdateDiff(() => {
        updateDiffChanges();
      });
      
      setIsLoading(false);
      
      // Load initial file
      if (props.files.length > 0) {
        loadFileIntoEditor(props.files[selectedIndex()]);
      }
    } catch (error) {
      console.error("Failed to load diff editor:", error);
      setLoadError(error instanceof Error ? error.message : "Failed to load diff editor");
      setIsLoading(false);
    }
  };

  // Load a file into the diff editor
  const loadFileIntoEditor = async (file: FileDiffInfo) => {
    if (!diffEditorInstance) return;
    
    const monaco = await monacoManager.ensureLoaded();
    const language = file.language || detectLanguage(file.path);
    
    // Clean up existing models
    const model = diffEditorInstance.getModel();
    if (model) {
      model.original?.dispose?.();
      model.modified?.dispose?.();
    }
    
    // Create new models
    const originalUri = monaco.Uri.parse(`diff://original/${file.path}`);
    const modifiedUri = monaco.Uri.parse(`diff://modified/${file.path}`);
    
    // Clean up any existing models with same URIs
    const existingOriginal = monaco.editor.getModel(originalUri);
    const existingModified = monaco.editor.getModel(modifiedUri);
    if (existingOriginal) existingOriginal.dispose();
    if (existingModified) existingModified.dispose();
    
    const originalModel = monaco.editor.createModel(file.originalContent, language, originalUri);
    const modifiedModel = monaco.editor.createModel(file.modifiedContent, language, modifiedUri);
    
    diffEditorInstance.setModel({
      original: originalModel,
      modified: modifiedModel,
    });
  };

  // Update diff changes for navigation
  const updateDiffChanges = () => {
    if (!diffEditorInstance) return;
    
    const lineChanges = diffEditorInstance.getLineChanges();
    if (!lineChanges) {
      setChanges([]);
      return;
    }
    
    const newChanges: DiffChange[] = lineChanges.map((change, index) => {
      const isAddition = change.originalStartLineNumber === 0;
      const isDeletion = change.modifiedStartLineNumber === 0;
      
      return {
        id: `change-${index}`,
        lineNumber: change.modifiedStartLineNumber || change.originalStartLineNumber,
        type: isAddition ? "addition" : isDeletion ? "deletion" : "modification",
        lineCount: Math.max(
          change.originalEndLineNumber - change.originalStartLineNumber + 1,
          change.modifiedEndLineNumber - change.modifiedStartLineNumber + 1
        ),
      };
    });
    
    setChanges(newChanges);
    setCurrentChangeIndex(0);
  };

  // Navigate to a specific change
  const navigateToChange = (index: number) => {
    if (!diffEditorInstance || index < 0 || index >= changes().length) return;
    
    setCurrentChangeIndex(index);
    const change = changes()[index];
    
    // Scroll to the change in the modified editor
    const modifiedEditor = diffEditorInstance.getModifiedEditor();
    modifiedEditor.revealLineInCenter(change.lineNumber);
  };

  // Handle file selection
  const selectFile = (index: number) => {
    if (index < 0 || index >= props.files.length) return;
    setSelectedIndex(index);
    loadFileIntoEditor(props.files[index]);
  };

  // Navigate between files
  const goToPreviousFile = () => {
    if (selectedIndex() > 0) {
      selectFile(selectedIndex() - 1);
    }
  };

  const goToNextFile = () => {
    if (selectedIndex() < props.files.length - 1) {
      selectFile(selectedIndex() + 1);
    }
  };

  // Toggle diff mode
  const toggleDiffMode = () => {
    const newMode = diffMode() === "inline" ? "sideBySide" : "inline";
    setDiffMode(newMode);
    diffEditorInstance?.updateOptions({
      renderSideBySide: newMode === "sideBySide",
    });
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+Alt+PageUp: Previous file
    if (e.ctrlKey && e.altKey && e.key === "PageUp") {
      e.preventDefault();
      goToPreviousFile();
    }
    // Ctrl+Alt+PageDown: Next file
    if (e.ctrlKey && e.altKey && e.key === "PageDown") {
      e.preventDefault();
      goToNextFile();
    }
  };

  onMount(() => {
    initDiffEditor();
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
    if (diffEditorInstance) {
      const model = diffEditorInstance.getModel();
      if (model) {
        model.original?.dispose?.();
        model.modified?.dispose?.();
      }
      diffEditorInstance.dispose();
      diffEditorInstance = null;
    }
  });

  // Update editor when selected file changes
  createEffect(() => {
    const file = currentFile();
    if (file && diffEditorInstance) {
      loadFileIntoEditor(file);
    }
  });

  // Styles
  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    height: "100%",
    background: "var(--jb-panel)",
    overflow: "hidden",
  };

  const sidebarStyle: JSX.CSSProperties = {
    width: sidebarCollapsed() ? "0" : "250px",
    "min-width": sidebarCollapsed() ? "0" : "250px",
    "border-right": sidebarCollapsed() ? "none" : "1px solid var(--jb-border-divider)",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    transition: "width 0.2s ease, min-width 0.2s ease",
  };

  const sidebarHeaderStyle: JSX.CSSProperties = {
    padding: "8px 12px",
    "border-bottom": "1px solid var(--jb-border-divider)",
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    "flex-shrink": "0",
  };

  const fileListStyle: JSX.CSSProperties = {
    flex: "1",
    "overflow-y": "auto",
  };

  const fileItemStyle = (isSelected: boolean, status?: string): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
    cursor: "pointer",
    background: isSelected ? "var(--jb-selection)" : "transparent",
    "border-left": isSelected ? "2px solid var(--jb-primary)" : "2px solid transparent",
    opacity: status === "rejected" ? "0.5" : "1",
  });

  const mainAreaStyle: JSX.CSSProperties = {
    flex: "1",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
  };

  const toolbarStyle: JSX.CSSProperties = {
    height: "40px",
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "0 12px",
    "border-bottom": "1px solid var(--jb-border-divider)",
    background: "var(--jb-app-root)",
    "flex-shrink": "0",
  };

  const toolbarLeftStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
  };

  const toolbarRightStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
  };

  const editorAreaStyle: JSX.CSSProperties = {
    flex: "1",
    display: isLoading() || loadError() ? "none" : "block",
    overflow: "hidden",
  };

  const statsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
    "border-top": "1px solid var(--jb-border-divider)",
    "flex-shrink": "0",
    "font-size": "12px",
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "accepted": return <Icon name="check" style={{ color: "var(--jb-green)" }} />;
      case "rejected": return <Icon name="xmark" style={{ color: "var(--jb-red)" }} />;
      default: return null;
    }
  };

  return (
    <div style={containerStyle}>
      {/* Sidebar with file list */}
      <div style={sidebarStyle}>
        <Show when={!sidebarCollapsed()}>
          <div style={sidebarHeaderStyle}>
            <Text size="sm" style={{ "font-weight": "500" }}>
              {props.title || "Changed Files"}
            </Text>
            <Badge variant="default">{props.files.length}</Badge>
          </div>
          
          <div style={fileListStyle}>
            <For each={props.files}>
              {(file, index) => (
                <div
                  style={fileItemStyle(index() === selectedIndex(), file.status)}
                  onClick={() => selectFile(index())}
                  onMouseEnter={(e) => {
                    if (index() !== selectedIndex()) {
                      (e.currentTarget as HTMLDivElement).style.background = "var(--jb-button-hover)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (index() !== selectedIndex()) {
                      (e.currentTarget as HTMLDivElement).style.background = "transparent";
                    }
                  }}
                >
                  <Icon name="file" style={{ width: "14px", height: "14px", "flex-shrink": "0" }} />
                  <div style={{ flex: "1", "min-width": "0" }}>
                    <Text size="sm" style={{ display: "block", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                      {getFileName(file.path)}
                    </Text>
                    <Text size="xs" variant="muted" style={{ display: "block", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                      {getDirectory(file.path)}
                    </Text>
                  </div>
                  <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                    {getStatusIcon(file.status)}
                    <Text size="xs" style={{ color: "var(--jb-green)" }}>+{file.additions}</Text>
                    <Text size="xs" style={{ color: "var(--jb-red)" }}>-{file.deletions}</Text>
                  </div>
                </div>
              )}
            </For>
          </div>
          
          {/* Stats footer */}
          <div style={statsStyle}>
            <Text variant="muted" size="xs">
              Total: <span style={{ color: "var(--jb-green)" }}>+{totalStats().additions}</span>
              {" / "}
              <span style={{ color: "var(--jb-red)" }}>-{totalStats().deletions}</span>
            </Text>
            <Show when={props.allowActions}>
              <Text variant="muted" size="xs" style={{ "margin-left": "auto" }}>
                {totalStats().accepted} accepted, {totalStats().rejected} rejected
              </Text>
            </Show>
          </div>
        </Show>
      </div>

      {/* Sidebar toggle */}
<IconButton
            icon={sidebarCollapsed() ? <Icon name="chevron-right" /> : <Icon name="chevron-left" />}
            size="sm"
            variant="ghost"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed())}
            style={{
          position: "absolute",
          left: sidebarCollapsed() ? "0" : "238px",
          top: "50%",
          transform: "translateY(-50%)",
          "z-index": "10",
          background: "var(--jb-panel)",
          border: "1px solid var(--jb-border)",
          "border-radius": "0 4px 4px 0",
        }}
        title={sidebarCollapsed() ? "Show file list" : "Hide file list"}
      />

      {/* Main diff editor area */}
      <div style={mainAreaStyle}>
        {/* Toolbar */}
        <div style={toolbarStyle}>
          <div style={toolbarLeftStyle}>
<IconButton
        icon={<Icon name="chevron-up" />}
        size="sm"
        variant="ghost"
        onClick={goToPreviousFile}
        disabled={selectedIndex() === 0}
        title="Previous File (Ctrl+Alt+PageUp)"
      />
            <Show when={currentFile()}>
              <Text size="sm" style={{ "font-weight": "500" }}>
                {currentFile()?.path}
              </Text>
            </Show>
<IconButton
              icon={<Icon name="chevron-right" />}
              size="sm"
              variant="ghost"
              onClick={goToNextFile}
              disabled={selectedIndex() === props.files.length - 1}
              title="Next File (Ctrl+Alt+PageDown)"
            />
          </div>
          
          <div style={toolbarRightStyle}>
            {/* Change navigator */}
            <DiffNavigator
              changes={changes()}
              currentIndex={currentChangeIndex()}
              onNavigate={navigateToChange}
              showList={true}
            />
            
            {/* Mode toggle */}
            <IconButton
              icon={diffMode() === "inline" ? <Icon name="columns" /> : <Icon name="align-left" />}
              size="sm"
              variant="ghost"
              onClick={toggleDiffMode}
              title={diffMode() === "inline" ? "Side by Side View" : "Inline View"}
            />
            
            {/* Actions */}
            <Show when={props.allowActions && currentFile()}>
              <div style={{ display: "flex", gap: "4px", "margin-left": "8px" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => props.onAccept?.(currentFile()!, selectedIndex())}
                  disabled={currentFile()?.status === "accepted"}
                >
                  <Icon name="check" style={{ "margin-right": "4px" }} />
                  Accept
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => props.onReject?.(currentFile()!, selectedIndex())}
                  disabled={currentFile()?.status === "rejected"}
                >
                  <Icon name="xmark" style={{ "margin-right": "4px" }} />
                  Reject
                </Button>
              </div>
            </Show>
            
            {/* Close button */}
            <Show when={props.onClose}>
              <IconButton
                icon={<Icon name="xmark" />}
                size="sm"
                variant="ghost"
                onClick={props.onClose}
                title="Close"
              />
            </Show>
          </div>
        </div>
        
        {/* Loading state */}
        <Show when={isLoading()}>
          <EditorSkeleton lineCount={20} showMessage={true} />
        </Show>
        
        {/* Error state */}
        <Show when={loadError()}>
          <div style={{ flex: "1", display: "flex", "align-items": "center", "justify-content": "center" }}>
            <EmptyState
              title="Failed to load diff editor"
              description={loadError() || "An unknown error occurred"}
            />
          </div>
        </Show>
        
        {/* Empty state */}
        <Show when={!isLoading() && !loadError() && props.files.length === 0}>
          <div style={{ flex: "1", display: "flex", "align-items": "center", "justify-content": "center" }}>
            <EmptyState
              title="No files to compare"
              description="There are no file changes to display"
            />
          </div>
        </Show>
        
        {/* Editor container */}
        <div ref={diffContainerRef} style={editorAreaStyle} />
      </div>
    </div>
  );
}

export default MultiFileDiffEditor;
