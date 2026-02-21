/**
 * Edit Predictions Component
 * 
 * VS Code Inline Completions Specifications:
 * - Ghost text: font-style italic, opacity 0.7
 * - z-index: 39 for inline suggestions hints
 * - Inline edit border-radius: var(--cortex-radius-sm)
 */
import { createSignal, createMemo, onMount, onCleanup } from "solid-js";
import { useEditor } from "@/context/EditorContext";
import { invoke } from "@tauri-apps/api/core";

interface Prediction {
  text: string;
  range: { startLine: number; startColumn: number; endLine: number; endColumn: number };
  confidence: number;
}

/** VS Code inline completion styles */
const GHOST_TEXT_STYLES = {
  fontStyle: "italic",
  opacity: 0.7,
  color: "var(--editor-ghost-text-foreground, var(--text-weak))",
  background: "var(--editor-ghost-text-background, transparent)",
  border: "1px solid var(--editor-ghost-text-border, transparent)",
} as const;

export function useEditPredictions() {
  const { state } = useEditor();
  const [prediction, setPrediction] = createSignal<Prediction | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [enabled, setEnabled] = createSignal(true);

  let debounceTimer: number | undefined;

  // PERFORMANCE: Memoize to prevent recalculation
  const activeFile = createMemo(() => state.openFiles.find((f) => f.id === state.activeFileId));

  // Listen for cursor changes
  onMount(() => {
    const handleCursorChange = (e: CustomEvent) => {
      const { line, column } = e.detail;
      
      if (!enabled()) return;
      
      // Debounce prediction requests
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        fetchPrediction(line, column);
      }, 500);
    };

    window.addEventListener("editor:cursor-change", handleCursorChange as EventListener);
    onCleanup(() => {
      window.removeEventListener("editor:cursor-change", handleCursorChange as EventListener);
      clearTimeout(debounceTimer);
    });
  });

  const fetchPrediction = async (line: number, column: number) => {
    const file = activeFile();
    if (!file) {
      setPrediction(null);
      return;
    }

    setLoading(true);
    try {
      // Use Tauri invoke for AI predictions
      const data = await invoke<{
        prediction?: {
          text: string;
          range?: { startLine: number; startColumn: number; endLine: number; endColumn: number };
          confidence?: number;
        };
      }>("ai_predict", {
        content: file.content,
        language: file.language,
        cursor: { line, column },
        filePath: file.path,
      });

      if (data?.prediction?.text) {
        setPrediction({
          text: data.prediction.text,
          range: data.prediction.range || {
            startLine: line,
            startColumn: column,
            endLine: line,
            endColumn: column,
          },
          confidence: data.prediction.confidence || 0.5,
        });
      } else {
        setPrediction(null);
      }
    } catch (err) {
      console.error("Failed to fetch prediction:", err);
      setPrediction(null);
    } finally {
      setLoading(false);
    }
  };

  const acceptPrediction = () => {
    const pred = prediction();
    if (!pred) return;

    // Emit event to insert prediction in editor
    // VS Code specs: ghost text uses italic + opacity 0.7
    window.dispatchEvent(new CustomEvent("prediction:insert", {
      detail: {
        ...pred,
        styles: GHOST_TEXT_STYLES,
      },
    }));
    
    setPrediction(null);
  };

  const dismissPrediction = () => {
    setPrediction(null);
  };

  return {
    prediction,
    loading,
    enabled,
    setEnabled,
    acceptPrediction,
    dismissPrediction,
  };
}

// Ghost text overlay component for Monaco
export function EditPredictionOverlay(props: { 
  prediction: Prediction | null;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  // Listen for Tab key to accept prediction
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (props.prediction && e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        props.onAccept();
      } else if (props.prediction && e.key === "Escape") {
        props.onDismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  // The actual ghost text rendering is handled by Monaco editor
  // This component just provides the keyboard handlers
  return null;
}

// Prediction status indicator for status bar
// VS Code specs: inline suggestions hints - z-index 39
export function PredictionStatusIndicator(props: {
  enabled: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      class="inline-suggestions-hints flex items-center gap-1 px-2 py-0.5 rounded transition-colors hover:bg-white/10"
      style={{
        /* VS Code: z-index 39 for inline suggestions */
        "z-index": "39",
        padding: "4px",
      }}
      onClick={props.onToggle}
      title={props.enabled ? "Disable predictions" : "Enable predictions"}
    >
      <span 
        class="w-2 h-2 rounded-full"
        style={{
          background: props.enabled 
            ? (props.loading ? "var(--accent-warning)" : "var(--accent-success)")
            : "var(--text-weak)",
        }}
      />
      <span class="text-xs" style={{ color: "var(--text-weak)" }}>
        {props.enabled ? (props.loading ? "Predicting..." : "AI") : "AI Off"}
      </span>
    </button>
  );
}

