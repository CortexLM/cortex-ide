/**
 * Default Settings View Component
 * 
 * Displays all default settings in a read-only Monaco editor with:
 * - Full JSON rendering of DEFAULT_SETTINGS
 * - Syntax highlighting
 * - Search/filter capability via Monaco's find widget
 * - Read-only mode (no editing)
 */

import { Show, createSignal, onMount, onCleanup, createMemo } from "solid-js";
import { Icon } from '../ui/Icon';
import { MonacoManager } from "@/utils/monacoManager";
import { DEFAULT_SETTINGS } from "@/context/SettingsContext";
import type * as Monaco from "monaco-editor";

// ============================================================================
// Types
// ============================================================================

interface DefaultSettingsViewProps {
  /** Optional height override (defaults to 100%) */
  height?: string;
  /** Optional callback when search is triggered */
  onSearch?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function DefaultSettingsView(props: DefaultSettingsViewProps) {
  // State
  const [isLoaded, setIsLoaded] = createSignal(false);
  
  // Refs
  let containerRef: HTMLDivElement | undefined;
  let editorRef: Monaco.editor.IStandaloneCodeEditor | undefined;
  let monacoRef: typeof Monaco | undefined;
  let modelRef: Monaco.editor.ITextModel | undefined;

  // Generate default settings JSON content
  const defaultSettingsJson = createMemo(() => {
    return JSON.stringify(DEFAULT_SETTINGS, null, 2);
  });

  // Initialize Monaco editor
  const initializeEditor = async () => {
    if (!containerRef) return;

    try {
      const manager = MonacoManager.getInstance();
      monacoRef = await manager.ensureLoaded();

      // Create model with JSON language
      const modelUri = monacoRef.Uri.parse("cortex-default-settings");
      modelRef = monacoRef.editor.createModel(
        defaultSettingsJson(),
        "json",
        modelUri
      );

      // Create editor in read-only mode
      editorRef = monacoRef.editor.create(containerRef, {
        model: modelRef,
        theme: "cortex-dark",
        language: "json",
        automaticLayout: true,
        fontSize: 13,
        fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
        lineNumbers: "on",
        minimap: { enabled: true, maxColumn: 80 },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        wrappingIndent: "indent",
        tabSize: 2,
        insertSpaces: true,
        folding: true,
        foldingStrategy: "indentation",
        showFoldingControls: "mouseover",
        bracketPairColorization: { enabled: true },
        guides: {
          indentation: true,
          bracketPairs: true
        },
        renderWhitespace: "selection",
        // Read-only settings
        readOnly: true,
        domReadOnly: true,
        // Hide cursor in read-only mode
        cursorStyle: "line",
        cursorBlinking: "solid",
        // Enable find widget for search
        find: {
          addExtraSpaceOnTop: true,
          autoFindInSelection: "never",
          seedSearchStringFromSelection: "always"
        }
      });

      setIsLoaded(true);

      // Focus editor
      editorRef.focus();

    } catch (e) {
      console.error("[DefaultSettingsView] Failed to initialize editor:", e);
    }
  };

  // Open find widget
  const openSearch = () => {
    if (editorRef) {
      editorRef.getAction("actions.find")?.run();
      props.onSearch?.();
    }
  };

  // Handle Ctrl+F for search
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      openSearch();
    }
  };

  // Mount
  onMount(() => {
    initializeEditor();
    window.addEventListener("keydown", handleKeyDown);
  });

  // Cleanup
  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
    modelRef?.dispose?.();
    editorRef?.dispose?.();
  });

  return (
    <div 
      class="default-settings-view h-full flex flex-col bg-background"
      style={{ height: props.height || "100%" }}
    >
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-background-secondary">
        <div class="flex items-center gap-2">
          <Icon name="lock" class="h-4 w-4 text-foreground-muted" />
          <span class="text-sm font-medium">Default Settings</span>
          <span class="text-xs text-foreground-muted">(Read-only)</span>
        </div>
        
        <div class="flex items-center gap-2">
          {/* Search button */}
          <button
            onClick={openSearch}
            class="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-foreground-muted hover:text-foreground hover:bg-background-tertiary transition-colors"
            title="Search (Ctrl+F)"
          >
            <Icon name="magnifying-glass" class="h-3.5 w-3.5" />
            Search
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div class="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20">
        <div class="flex items-center gap-2 text-xs text-blue-400">
          <Icon name="circle-info" class="h-3.5 w-3.5 shrink-0" />
          <span>
            These are the built-in default values for all settings. 
            Use this as a reference when customizing your settings.
          </span>
        </div>
      </div>

      {/* Loading State */}
      <Show when={!isLoaded()}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-sm text-foreground-muted">Loading...</div>
        </div>
      </Show>

      {/* Editor Container */}
      <div 
        ref={containerRef!} 
        class="flex-1 min-h-0"
        style={{ display: isLoaded() ? "block" : "none" }}
      />

      {/* Footer */}
      <div class="flex items-center justify-between px-4 py-1.5 border-t border-border bg-background-secondary text-xs text-foreground-muted">
        <div class="flex items-center gap-4">
          <span>
            <kbd class="px-1 py-0.5 bg-background-tertiary rounded text-[10px]">Ctrl+F</kbd> Search
          </span>
          <span>
            <kbd class="px-1 py-0.5 bg-background-tertiary rounded text-[10px]">Ctrl+G</kbd> Go to Line
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span>JSON</span>
          <span>•</span>
          <span>Read-only</span>
        </div>
      </div>
    </div>
  );
}

export default DefaultSettingsView;
