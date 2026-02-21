/**
 * Supermaven Context Provider
 * Manages Supermaven AI completion integration with the editor
 */

import { 
  createContext, 
  useContext, 
  ParentProps, 
  onMount, 
  onCleanup, 
  createEffect,
  createSignal,
  batch,
} from "solid-js";
import { createStore } from "solid-js/store";
import { useEditor } from "./EditorContext";
import { 
  getSupermaven, 
  type SupermavenState,
  type SupermavenCompletion,
  type CursorContext,
} from "@/utils/ai/SupermavenProvider";

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY_CONFIG = "cortex_supermaven_config";

// ============================================================================
// Types
// ============================================================================

interface SupermavenContextState {
  enabled: boolean;
  apiKey: string;
  status: SupermavenState["status"];
  isLoading: boolean;
  currentCompletion: SupermavenCompletion | null;
  ghostText: string | null;
  ghostTextPosition: { line: number; column: number } | null;
  serviceTier: "free" | "pro" | "unknown" | undefined;
  errorMessage: string | undefined;
  debounceMs: number;
}

interface SupermavenContextValue {
  state: SupermavenContextState;
  
  // Configuration
  setEnabled: (enabled: boolean) => void;
  setApiKey: (apiKey: string) => void;
  setDebounceMs: (ms: number) => void;
  
  // Connection
  connect: () => Promise<void>;
  disconnect: () => void;
  signOut: () => Promise<void>;
  
  // Completions
  requestCompletion: () => void;
  acceptCompletion: () => void;
  acceptPartialCompletion: (mode: "word" | "line" | "char") => void;
  dismissCompletion: () => void;
  
  // Status
  getActivationUrl: () => string | undefined;
}

// ============================================================================
// Default State
// ============================================================================

const defaultState: SupermavenContextState = {
  enabled: false,
  apiKey: "",
  status: "disconnected",
  isLoading: false,
  currentCompletion: null,
  ghostText: null,
  ghostTextPosition: null,
  serviceTier: undefined,
  errorMessage: undefined,
  debounceMs: 150,
};

// ============================================================================
// Context
// ============================================================================

const SupermavenContext = createContext<SupermavenContextValue>();

export function SupermavenProvider(props: ParentProps) {
  const editor = useEditor();
  const supermaven = getSupermaven();
  
  const [state, setState] = createStore<SupermavenContextState>(defaultState);
  const [lastCursor, setLastCursor] = createSignal<{ line: number; column: number; fileId: string } | null>(null);

  // ============================================================================
  // Initialization
  // ============================================================================

  const loadConfig = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (stored) {
        const config = JSON.parse(stored);
        batch(() => {
          setState("enabled", config.enabled ?? false);
          setState("apiKey", config.apiKey ?? "");
          setState("debounceMs", config.debounceMs ?? 150);
        });
        
        // Configure provider
        supermaven.configure({
          apiKey: config.apiKey || "",
          enabled: config.enabled ?? false,
          debounceMs: config.debounceMs ?? 150,
        });
        
        // Auto-connect if configured
        if (config.enabled && config.apiKey) {
          supermaven.connect();
        }
      }
    } catch (e) {
      console.error("[Supermaven] Failed to load config:", e);
    }
  };

  const saveConfig = () => {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({
        enabled: state.enabled,
        apiKey: state.apiKey,
        debounceMs: state.debounceMs,
      }));
    } catch (e) {
      console.error("[Supermaven] Failed to save config:", e);
    }
  };

  // ============================================================================
  // Supermaven State Sync
  // ============================================================================

  onMount(() => {
    loadConfig();

    // Subscribe to Supermaven state changes
    const unsubState = supermaven.onStateChange((newState) => {
      batch(() => {
        setState("status", newState.status);
        setState("isLoading", newState.isLoading);
        setState("currentCompletion", newState.currentCompletion);
        setState("serviceTier", newState.serviceTier);
        setState("errorMessage", newState.errorMessage);
        
        // Update ghost text
        if (newState.currentCompletion) {
          setState("ghostText", newState.currentCompletion.text);
          setState("ghostTextPosition", {
            line: newState.currentCompletion.range.startLine,
            column: newState.currentCompletion.range.startColumn,
          });
        } else {
          setState("ghostText", null);
          setState("ghostTextPosition", null);
        }
      });
    });

    // Subscribe to completion updates for ghost text
    const unsubCompletion = supermaven.onCompletion((completion) => {
      if (completion) {
        // Emit event for Monaco editor to render ghost text
        window.dispatchEvent(new CustomEvent("supermaven:ghost-text", {
          detail: {
            text: completion.text,
            line: completion.range.startLine,
            column: completion.range.startColumn,
          },
        }));
      } else {
        window.dispatchEvent(new CustomEvent("supermaven:ghost-text", {
          detail: null,
        }));
      }
    });

    // Handle cursor changes to request completions
    const handleCursorChange = (e: CustomEvent) => {
      const { line, column } = e.detail;
      const activeFileId = editor.state.activeFileId;
      
      if (!activeFileId) return;
      
      setLastCursor({ line, column, fileId: activeFileId });
      
      if (state.enabled && state.status === "ready") {
        requestCompletionForCursor(line, column);
      }
    };

    // Handle key events for accepting completions
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.currentCompletion) return;
      
      // Tab - Accept full completion
      if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        acceptCompletion();
        return;
      }
      
      // Ctrl+Right - Accept word
      if (e.key === "ArrowRight" && e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        acceptPartialCompletion("word");
        return;
      }
      
      // Ctrl+End - Accept line
      if (e.key === "End" && e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        acceptPartialCompletion("line");
        return;
      }
      
      // Escape - Dismiss completion
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        dismissCompletion();
        return;
      }
      
      // Any other key that modifies content should dismiss
      if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
        // Let the editor handle the key, completion will be refreshed
        dismissCompletion();
      }
    };

    window.addEventListener("editor:cursor-change", handleCursorChange as EventListener);
    window.addEventListener("keydown", handleKeyDown, { capture: true });

    onCleanup(() => {
      unsubState();
      unsubCompletion();
      window.removeEventListener("editor:cursor-change", handleCursorChange as EventListener);
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    });
  });

  // Save config when it changes
  createEffect(() => {
    // Track dependencies for reactivity
    void state.enabled;
    void state.apiKey;
    void state.debounceMs;
    
    saveConfig();
  });

  // ============================================================================
  // Completion Request
  // ============================================================================

  const requestCompletionForCursor = (line: number, column: number) => {
    const activeFile = editor.state.openFiles.find(
      f => f.id === editor.state.activeFileId
    );
    
    if (!activeFile) return;
    
    // Calculate offset from line and column
    const lines = activeFile.content.split("\n");
    let offset = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for newline
    }
    offset += column - 1;
    
    const context: CursorContext = {
      path: activeFile.path,
      content: activeFile.content,
      language: activeFile.language,
      line,
      column,
      offset,
    };
    
    supermaven.requestCompletion(context);
  };

  // ============================================================================
  // Context Actions
  // ============================================================================

  const setEnabled = (enabled: boolean) => {
    setState("enabled", enabled);
    supermaven.configure({ enabled });
    
    if (enabled && state.apiKey) {
      supermaven.connect();
    } else if (!enabled) {
      supermaven.disconnect();
      dismissCompletion();
    }
  };

  const setApiKey = (apiKey: string) => {
    setState("apiKey", apiKey);
    supermaven.configure({ apiKey });
    
    if (state.enabled && apiKey) {
      supermaven.connect();
    }
  };

  const setDebounceMs = (ms: number) => {
    setState("debounceMs", ms);
    supermaven.configure({ debounceMs: ms });
  };

  const connect = async () => {
    await supermaven.connect();
  };

  const disconnect = () => {
    supermaven.disconnect();
  };

  const signOut = async () => {
    await supermaven.signOut();
    setState("apiKey", "");
    saveConfig();
  };

  const requestCompletion = () => {
    const cursor = lastCursor();
    if (cursor && state.enabled) {
      requestCompletionForCursor(cursor.line, cursor.column);
    }
  };

  const acceptCompletion = () => {
    const completion = supermaven.acceptCompletion();
    if (completion) {
      // Emit event for editor to insert the completion
      window.dispatchEvent(new CustomEvent("supermaven:accept", {
        detail: {
          text: completion.text,
          range: completion.range,
        },
      }));
    }
  };

  const acceptPartialCompletion = (mode: "word" | "line" | "char") => {
    const text = supermaven.acceptPartialCompletion(mode);
    if (text) {
      // Emit event for editor to insert partial completion
      window.dispatchEvent(new CustomEvent("supermaven:accept-partial", {
        detail: { text },
      }));
    }
  };

  const dismissCompletion = () => {
    supermaven.dismissCompletion();
  };

  const getActivationUrl = () => {
    return supermaven.getActivationUrl();
  };

  // ============================================================================
  // Context Value
  // ============================================================================

  const contextValue: SupermavenContextValue = {
    state,
    setEnabled,
    setApiKey,
    setDebounceMs,
    connect,
    disconnect,
    signOut,
    requestCompletion,
    acceptCompletion,
    acceptPartialCompletion,
    dismissCompletion,
    getActivationUrl,
  };

  return (
    <SupermavenContext.Provider value={contextValue}>
      {props.children}
    </SupermavenContext.Provider>
  );
}

export function useSupermaven() {
  const context = useContext(SupermavenContext);
  if (!context) {
    throw new Error("useSupermaven must be used within SupermavenProvider");
  }
  return context;
}

export type { SupermavenContextValue, SupermavenContextState };
