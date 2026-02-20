/**
 * DiffEditor - Optimized Monaco Diff Editor Component
 * 
 * Features:
 * - Lazy loading: Monaco diff editor is only loaded when component mounts
 * - Inline diff mode for small changes (< 100 lines difference)
 * - Side-by-side mode for larger changes
 * - Large file optimizations
 */

import { createSignal, createEffect, onCleanup, onMount, Show, type JSX } from "solid-js";
import type * as Monaco from "monaco-editor";
import { MonacoManager } from "@/utils/monacoManager";
import { EditorSkeleton } from "./EditorSkeleton";
import { Button, Text, EmptyState } from "@/components/ui";

// ============================================================================
// Types
// ============================================================================

interface DiffEditorProps {
  /** Original (left side) content */
  originalContent: string;
  /** Modified (right side) content */
  modifiedContent: string;
  /** Language ID for syntax highlighting */
  language: string;
  /** Original file path/name for display */
  originalPath?: string;
  /** Modified file path/name for display */
  modifiedPath?: string;
  /** Callback when modified content changes */
  onModifiedChange?: (content: string) => void;
  /** Force inline diff mode regardless of change size */
  forceInlineMode?: boolean;
  /** Force side-by-side mode regardless of change size */
  forceSideBySideMode?: boolean;
  /** Whether the modified content is read-only */
  readOnly?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Threshold for switching to inline diff mode */
const INLINE_DIFF_THRESHOLD = 100;

/** Language mapping for Monaco */
const languageMap: Record<string, string> = {
  typescript: "typescript",
  javascript: "javascript",
  rust: "rust",
  python: "python",
  go: "go",
  json: "json",
  html: "html",
  css: "css",
  yaml: "yaml",
  toml: "ini",
  markdown: "markdown",
  sql: "sql",
  shell: "shell",
  dockerfile: "dockerfile",
  plaintext: "plaintext",
};

// ============================================================================
// Component
// ============================================================================

export function DiffEditor(props: DiffEditorProps) {
  let containerRef: HTMLDivElement | undefined;
  let diffEditorInstance: Monaco.editor.IStandaloneDiffEditor | null = null;
  
  const [isLoading, setIsLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [diffMode, setDiffMode] = createSignal<"inline" | "sideBySide">("sideBySide");
  
  const monacoManager = MonacoManager.getInstance();

  /**
   * Calculate the number of changed lines between original and modified content
   */
  const calculateChangedLines = (original: string, modified: string): number => {
    const originalLines = original.split("\n");
    const modifiedLines = modified.split("\n");
    
    // Simple diff calculation - count lines that differ
    let changedCount = 0;
    const maxLines = Math.max(originalLines.length, modifiedLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      if (originalLines[i] !== modifiedLines[i]) {
        changedCount++;
      }
    }
    
    return changedCount;
  };

  /**
   * Determine the best diff mode based on content
   */
  const determineDiffMode = (): "inline" | "sideBySide" => {
    if (props.forceInlineMode) return "inline";
    if (props.forceSideBySideMode) return "sideBySide";
    
    const changedLines = calculateChangedLines(props.originalContent, props.modifiedContent);
    return changedLines < INLINE_DIFF_THRESHOLD ? "inline" : "sideBySide";
  };

  onMount(async () => {
    if (!containerRef) {
      setLoadError("Container not available");
      setIsLoading(false);
      return;
    }

    try {
      // Lazy load Monaco
      const monaco = await monacoManager.ensureLoaded();
      
      const monacoLanguage = languageMap[props.language] || props.language || "plaintext";
      
      // Calculate line counts for optimizations
      const originalLineCount = props.originalContent.split("\n").length;
      const modifiedLineCount = props.modifiedContent.split("\n").length;
      const maxLineCount = Math.max(originalLineCount, modifiedLineCount);
      const largeFileOpts = monacoManager.getLargeFileOptions(maxLineCount);
      
      // Determine diff mode
      const mode = determineDiffMode();
      setDiffMode(mode);
      
      // Create the diff editor
      diffEditorInstance = monaco.editor.createDiffEditor(containerRef, {
        theme: "cortex-dark",
        automaticLayout: true,
        
        // Diff-specific options
        renderSideBySide: mode === "sideBySide",
        enableSplitViewResizing: true,
        renderIndicators: true,
        renderMarginRevertIcon: true,
        ignoreTrimWhitespace: false,
        
        // Large file optimizations
        minimap: { enabled: !largeFileOpts.disableMinimap },
        folding: !largeFileOpts.disableFolding,
        
        // General options
        readOnly: props.readOnly ?? false,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
        fontLigatures: true,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        
        // Rendering
        renderLineHighlight: "line",
        renderWhitespace: "selection",
        
        // Scrollbar
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          useShadows: false,
        },
      });
      
      // Create models for original and modified content
      const originalUri = monaco.Uri.parse(`diff://original/${props.originalPath || "original"}`);
      const modifiedUri = monaco.Uri.parse(`diff://modified/${props.modifiedPath || "modified"}`);
      
      // Clean up any existing models with same URIs
      const existingOriginal = monaco.editor.getModel(originalUri);
      const existingModified = monaco.editor.getModel(modifiedUri);
      if (existingOriginal) existingOriginal?.dispose?.();
      if (existingModified) existingModified?.dispose?.();
      
      const originalModel = monaco.editor.createModel(props.originalContent, monacoLanguage, originalUri);
      const modifiedModel = monaco.editor.createModel(props.modifiedContent, monacoLanguage, modifiedUri);
      
      // Set the models on the diff editor
      diffEditorInstance.setModel({
        original: originalModel,
        modified: modifiedModel,
      });
      
      // Listen for modified content changes
      if (props.onModifiedChange) {
        const disposable = modifiedModel.onDidChangeContent(() => {
          props.onModifiedChange?.(modifiedModel.getValue());
        });
        
        // Store for cleanup
        diffEditorInstance.onDidDispose(() => {
          disposable?.dispose?.();
        });
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load diff editor:", error);
      setLoadError(error instanceof Error ? error.message : "Failed to load diff editor");
      setIsLoading(false);
    }
  });

  // Update content when props change
  createEffect(() => {
    if (!diffEditorInstance) return;
    
    const model = diffEditorInstance.getModel();
    if (!model) return;
    
    // Update original model content
    if (model.original.getValue() !== props.originalContent) {
      model.original.setValue(props.originalContent);
    }
    
    // Update modified model content (only if not edited locally)
    const currentModified = model.modified.getValue();
    if (currentModified !== props.modifiedContent && !props.onModifiedChange) {
      model.modified.setValue(props.modifiedContent);
    }
  });

  // Update diff mode when forced mode props change
  createEffect(() => {
    if (!diffEditorInstance) return;
    
    const mode = determineDiffMode();
    if (mode !== diffMode()) {
      setDiffMode(mode);
      diffEditorInstance.updateOptions({
        renderSideBySide: mode === "sideBySide",
      });
    }
  });

  onCleanup(() => {
    if (diffEditorInstance) {
      const model = diffEditorInstance.getModel();
      if (model) {
        model.original?.dispose?.();
        model.modified?.dispose?.();
      }
      diffEditorInstance?.dispose?.();
      diffEditorInstance = null;
    }
  });

  /**
   * Toggle between inline and side-by-side modes
   */
  const toggleDiffMode = () => {
    if (!diffEditorInstance) return;
    
    const newMode = diffMode() === "inline" ? "sideBySide" : "inline";
    setDiffMode(newMode);
    diffEditorInstance.updateOptions({
      renderSideBySide: newMode === "sideBySide",
    });
  };

  const containerStyle: JSX.CSSProperties = {
    flex: "1",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    background: "var(--jb-panel)",
  };

  const headerStyle: JSX.CSSProperties = {
    height: "32px",
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "0 12px",
    "border-bottom": "1px solid var(--jb-border-divider)",
    "flex-shrink": "0",
    background: "var(--jb-app-root)",
  };

  const pathsContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "16px",
  };

  const errorContainerStyle: JSX.CSSProperties = {
    flex: "1",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
  };

  const editorContainerStyle: JSX.CSSProperties = {
    flex: "1",
    display: isLoading() || loadError() ? "none" : "block",
  };

  return (
    <div style={containerStyle}>
      {/* Header with file info and mode toggle */}
      <div style={headerStyle}>
        <div style={pathsContainerStyle}>
          <Show when={props.originalPath}>
            <Text variant="muted" size="xs">
              {props.originalPath}
            </Text>
          </Show>
          <Show when={props.originalPath && props.modifiedPath}>
            <Text variant="muted" size="xs" style={{ opacity: "0.5" }}>→</Text>
          </Show>
          <Show when={props.modifiedPath}>
            <Text variant="muted" size="xs">
              {props.modifiedPath}
            </Text>
          </Show>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleDiffMode}
          title={diffMode() === "inline" ? "Switch to side-by-side view" : "Switch to inline view"}
        >
          {diffMode() === "inline" ? "Side by Side" : "Inline"}
        </Button>
      </div>
      
      {/* Loading state */}
      <Show when={isLoading()}>
        <EditorSkeleton lineCount={20} showMessage={true} />
      </Show>
      
      {/* Error state */}
      <Show when={loadError()}>
        <div style={errorContainerStyle}>
          <EmptyState
            title="Failed to load diff editor"
            description={loadError() || "An unknown error occurred"}
          />
        </div>
      </Show>
      
      {/* Editor container */}
      <div 
        ref={containerRef} 
        style={editorContainerStyle}
      />
    </div>
  );
}

export default DiffEditor;
