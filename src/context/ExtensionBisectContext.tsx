import {
  createContext,
  useContext,
  ParentProps,
  createMemo,
  createEffect,
  onCleanup,
  batch,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useExtensions } from "./ExtensionsContext";

// ============================================================================
// Types
// ============================================================================

export interface BisectState {
  /** Whether bisect session is active */
  active: boolean;
  /** Current step number (1-based) */
  step: number;
  /** Total estimated steps (log2 of extension count) */
  totalSteps: number;
  /** Extensions that have been ruled out */
  testedExtensions: string[];
  /** Extensions currently disabled by bisect */
  currentlyDisabled: string[];
  /** Remaining suspected extensions */
  suspectedExtensions: string[];
  /** The problematic extension once found */
  foundExtension: string | null;
  /** Original enabled state of extensions before bisect started */
  originalEnabledState: Map<string, boolean>;
  /** Whether bisect completed (either found or cancelled) */
  completed: boolean;
  /** Timestamp when bisect started */
  startedAt: number | null;
}

export type BisectPhase = 
  | "idle"
  | "starting"
  | "testing"
  | "found"
  | "cancelled"
  | "no-problem";

export interface ExtensionBisectContextValue {
  /** Current bisect state */
  state: BisectState;
  /** Current phase of the bisect process */
  phase: () => BisectPhase;
  /** Progress percentage (0-100) */
  progress: () => number;
  /** Start a new bisect session */
  startBisect: () => Promise<void>;
  /** Report that the problem still persists with current config */
  reportProblemPersists: () => Promise<void>;
  /** Report that the problem is gone with current config */
  reportProblemGone: () => Promise<void>;
  /** Cancel the bisect session and restore extensions */
  cancelBisect: () => Promise<void>;
  /** Reset bisect state after completion */
  resetBisect: () => void;
  /** Check if a specific extension is disabled by bisect */
  isExtensionDisabledByBisect: (extensionId: string) => boolean;
  /** Get the currently disabled extensions count */
  disabledCount: () => number;
  /** Get the remaining suspected extensions count */
  suspectedCount: () => number;
  /** Disable the found problematic extension */
  disableProblematicExtension: () => Promise<void>;
  /** Uninstall the found problematic extension */
  uninstallProblematicExtension: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const BISECT_STORAGE_KEY = "cortex-extension-bisect-state";

const initialState: BisectState = {
  active: false,
  step: 0,
  totalSteps: 0,
  testedExtensions: [],
  currentlyDisabled: [],
  suspectedExtensions: [],
  foundExtension: null,
  originalEnabledState: new Map(),
  completed: false,
  startedAt: null,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate the number of steps needed for binary search
 */
function calculateTotalSteps(extensionCount: number): number {
  if (extensionCount <= 1) return 1;
  return Math.ceil(Math.log2(extensionCount));
}

/**
 * Split array into two halves
 */
function splitInHalf<T>(arr: T[]): [T[], T[]] {
  const mid = Math.ceil(arr.length / 2);
  return [arr.slice(0, mid), arr.slice(mid)];
}

/**
 * Serialize state for localStorage (handle Map)
 */
function serializeState(state: BisectState): string {
  return JSON.stringify({
    ...state,
    originalEnabledState: Array.from(state.originalEnabledState.entries()),
  });
}

/**
 * Deserialize state from localStorage
 */
function deserializeState(json: string): BisectState | null {
  try {
    const parsed = JSON.parse(json);
    return {
      ...parsed,
      originalEnabledState: new Map(parsed.originalEnabledState || []),
    };
  } catch {
    return null;
  }
}

/**
 * Load persisted bisect state
 */
function loadPersistedState(): BisectState | null {
  try {
    const stored = localStorage.getItem(BISECT_STORAGE_KEY);
    if (stored) {
      return deserializeState(stored);
    }
  } catch (err) {
    console.debug("[ExtensionBisect] Load state failed:", err);
  }
  return null;
}

/**
 * Save bisect state to localStorage
 */
function saveState(state: BisectState): void {
  try {
    if (state.active) {
      localStorage.setItem(BISECT_STORAGE_KEY, serializeState(state));
    } else {
      localStorage.removeItem(BISECT_STORAGE_KEY);
    }
  } catch (err) {
    console.debug("[ExtensionBisect] Save state failed:", err);
  }
}

// ============================================================================
// Context
// ============================================================================

const ExtensionBisectContext = createContext<ExtensionBisectContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function ExtensionBisectProvider(props: ParentProps) {
  const extensions = useExtensions();
  
  // Try to restore persisted state
  const persistedState = loadPersistedState();
  
  const [state, setState] = createStore<BisectState>(
    persistedState || { ...initialState }
  );

  // Derived state
  const phase = createMemo<BisectPhase>(() => {
    if (!state.active && !state.completed) return "idle";
    if (state.foundExtension) return "found";
    if (state.completed && !state.foundExtension) return "no-problem";
    if (state.step === 0) return "starting";
    return "testing";
  });

  const progress = createMemo(() => {
    if (state.totalSteps === 0) return 0;
    return Math.round((state.step / state.totalSteps) * 100);
  });

  const disabledCount = createMemo(() => state.currentlyDisabled.length);
  const suspectedCount = createMemo(() => state.suspectedExtensions.length);

  // Persist state changes
  createEffect(() => {
    saveState(state);
  });

  /**
   * Start a new bisect session
   */
  const startBisect = async (): Promise<void> => {
    // Get all enabled extensions
    const enabledExts = extensions.enabledExtensions();
    
    if (enabledExts.length === 0) {
      console.warn("[ExtensionBisect] No enabled extensions to bisect");
      return;
    }

    if (enabledExts.length === 1) {
      // Only one extension - it's the problematic one
      batch(() => {
        setState({
          active: true,
          step: 1,
          totalSteps: 1,
          testedExtensions: [],
          currentlyDisabled: [],
          suspectedExtensions: [enabledExts[0].manifest.name],
          foundExtension: enabledExts[0].manifest.name,
          originalEnabledState: new Map(
            enabledExts.map(e => [e.manifest.name, true])
          ),
          completed: true,
          startedAt: Date.now(),
        });
      });
      
      window.dispatchEvent(new CustomEvent("extension-bisect:found", {
        detail: { extension: enabledExts[0].manifest.name }
      }));
      return;
    }

    // Save original state
    const originalState = new Map<string, boolean>();
    extensions.extensions().forEach(ext => {
      originalState.set(ext.manifest.name, ext.enabled);
    });

    const extensionNames = enabledExts.map(e => e.manifest.name);
    const totalSteps = calculateTotalSteps(extensionNames.length);

    // Initialize state
    batch(() => {
      setState({
        active: true,
        step: 1,
        totalSteps,
        testedExtensions: [],
        currentlyDisabled: [],
        suspectedExtensions: extensionNames,
        foundExtension: null,
        originalEnabledState: originalState,
        completed: false,
        startedAt: Date.now(),
      });
    });

    // Disable first half
    const [firstHalf, _secondHalf] = splitInHalf(extensionNames);
    
    // Disable the first half
    for (const name of firstHalf) {
      await extensions.disableExtension(name);
    }

    setState("currentlyDisabled", firstHalf);

    window.dispatchEvent(new CustomEvent("extension-bisect:started", {
      detail: { 
        totalExtensions: extensionNames.length,
        totalSteps 
      }
    }));
  };

  /**
   * Report that the problem still persists
   * This means the problematic extension is among the enabled ones
   */
  const reportProblemPersists = async (): Promise<void> => {
    if (!state.active || state.completed) return;

    // Problem persists = problematic extension is in the ENABLED set (not in currentlyDisabled)
    const enabledSuspected = state.suspectedExtensions.filter(
      name => !state.currentlyDisabled.includes(name)
    );

    if (enabledSuspected.length <= 1) {
      // Found it!
      const found = enabledSuspected[0] || null;
      
      batch(() => {
        setState(produce(s => {
          s.step += 1;
          s.foundExtension = found;
          s.completed = true;
          s.testedExtensions = [...s.testedExtensions, ...s.currentlyDisabled];
        }));
      });

      if (found) {
        window.dispatchEvent(new CustomEvent("extension-bisect:found", {
          detail: { extension: found }
        }));
      } else {
        window.dispatchEvent(new CustomEvent("extension-bisect:no-problem"));
      }
      return;
    }

    // Continue bisecting the enabled set
    const [firstHalf, _secondHalf] = splitInHalf(enabledSuspected);

    // Re-enable the previously disabled ones that were ruled out
    for (const name of state.currentlyDisabled) {
      await extensions.enableExtension(name);
    }

    // Disable the first half of the remaining suspects
    for (const name of firstHalf) {
      await extensions.disableExtension(name);
    }

    batch(() => {
      setState(produce(s => {
        s.step += 1;
        s.testedExtensions = [...s.testedExtensions, ...s.currentlyDisabled];
        s.currentlyDisabled = firstHalf;
        s.suspectedExtensions = enabledSuspected;
      }));
    });

    window.dispatchEvent(new CustomEvent("extension-bisect:step", {
      detail: { 
        step: state.step,
        totalSteps: state.totalSteps,
        suspected: enabledSuspected.length 
      }
    }));
  };

  /**
   * Report that the problem is gone
   * This means the problematic extension is among the disabled ones
   */
  const reportProblemGone = async (): Promise<void> => {
    if (!state.active || state.completed) return;

    // Problem gone = problematic extension is in the DISABLED set
    const disabledSuspected = state.currentlyDisabled;

    if (disabledSuspected.length <= 1) {
      // Found it!
      const found = disabledSuspected[0] || null;
      
      // Re-enable all disabled extensions first
      for (const name of state.currentlyDisabled) {
        await extensions.enableExtension(name);
      }
      
      // Then disable only the problematic one
      if (found) {
        await extensions.disableExtension(found);
      }

      batch(() => {
        setState(produce(s => {
          s.step += 1;
          s.foundExtension = found;
          s.completed = true;
          s.currentlyDisabled = found ? [found] : [];
        }));
      });

      if (found) {
        window.dispatchEvent(new CustomEvent("extension-bisect:found", {
          detail: { extension: found }
        }));
      } else {
        window.dispatchEvent(new CustomEvent("extension-bisect:no-problem"));
      }
      return;
    }

    // Continue bisecting the disabled set
    const [firstHalf, secondHalf] = splitInHalf(disabledSuspected);

    // Re-enable the second half (they're ruled out)
    for (const name of secondHalf) {
      await extensions.enableExtension(name);
    }

    // Keep the first half disabled

    batch(() => {
      setState(produce(s => {
        s.step += 1;
        s.testedExtensions = [...s.testedExtensions, ...secondHalf];
        s.currentlyDisabled = firstHalf;
        s.suspectedExtensions = disabledSuspected;
      }));
    });

    window.dispatchEvent(new CustomEvent("extension-bisect:step", {
      detail: { 
        step: state.step,
        totalSteps: state.totalSteps,
        suspected: disabledSuspected.length 
      }
    }));
  };

  /**
   * Cancel bisect and restore original extension states
   */
  const cancelBisect = async (): Promise<void> => {
    if (!state.active && !state.completed) return;

    // Restore original extension states
    for (const [name, wasEnabled] of state.originalEnabledState) {
      const currentExt = extensions.extensions().find(e => e.manifest.name === name);
      if (currentExt) {
        if (wasEnabled && !currentExt.enabled) {
          await extensions.enableExtension(name);
        } else if (!wasEnabled && currentExt.enabled) {
          await extensions.disableExtension(name);
        }
      }
    }

    // Reset state
    setState({ ...initialState });
    localStorage.removeItem(BISECT_STORAGE_KEY);

    window.dispatchEvent(new CustomEvent("extension-bisect:cancelled"));
  };

  /**
   * Reset bisect state after completion (for starting fresh)
   */
  const resetBisect = (): void => {
    setState({ ...initialState });
    localStorage.removeItem(BISECT_STORAGE_KEY);
  };

  /**
   * Check if an extension is disabled by the bisect process
   */
  const isExtensionDisabledByBisect = (extensionId: string): boolean => {
    return state.active && state.currentlyDisabled.includes(extensionId);
  };

  /**
   * Disable the found problematic extension and end bisect
   */
  const disableProblematicExtension = async (): Promise<void> => {
    if (!state.foundExtension) return;

    // Ensure it's disabled
    const ext = extensions.extensions().find(e => e.manifest.name === state.foundExtension);
    if (ext?.enabled) {
      await extensions.disableExtension(state.foundExtension);
    }

    // Restore other extensions to their original state
    for (const [name, wasEnabled] of state.originalEnabledState) {
      if (name === state.foundExtension) continue;
      
      const currentExt = extensions.extensions().find(e => e.manifest.name === name);
      if (currentExt) {
        if (wasEnabled && !currentExt.enabled) {
          await extensions.enableExtension(name);
        } else if (!wasEnabled && currentExt.enabled) {
          await extensions.disableExtension(name);
        }
      }
    }

    window.dispatchEvent(new CustomEvent("extension-bisect:extension-disabled", {
      detail: { extension: state.foundExtension }
    }));

    resetBisect();
  };

  /**
   * Uninstall the found problematic extension and end bisect
   */
  const uninstallProblematicExtension = async (): Promise<void> => {
    if (!state.foundExtension) return;

    const foundName = state.foundExtension;

    // Restore other extensions first
    for (const [name, wasEnabled] of state.originalEnabledState) {
      if (name === foundName) continue;
      
      const currentExt = extensions.extensions().find(e => e.manifest.name === name);
      if (currentExt) {
        if (wasEnabled && !currentExt.enabled) {
          await extensions.enableExtension(name);
        } else if (!wasEnabled && currentExt.enabled) {
          await extensions.disableExtension(name);
        }
      }
    }

    // Uninstall the problematic extension
    await extensions.uninstallExtension(foundName);

    window.dispatchEvent(new CustomEvent("extension-bisect:extension-uninstalled", {
      detail: { extension: foundName }
    }));

    resetBisect();
  };

  // Cleanup on unmount - don't auto-cancel, preserve state for reload
  onCleanup(() => {
    // State is already persisted via createEffect
  });

  const value: ExtensionBisectContextValue = {
    state,
    phase,
    progress,
    startBisect,
    reportProblemPersists,
    reportProblemGone,
    cancelBisect,
    resetBisect,
    isExtensionDisabledByBisect,
    disabledCount,
    suspectedCount,
    disableProblematicExtension,
    uninstallProblematicExtension,
  };

  return (
    <ExtensionBisectContext.Provider value={value}>
      {props.children}
    </ExtensionBisectContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useExtensionBisect(): ExtensionBisectContextValue {
  const context = useContext(ExtensionBisectContext);
  if (!context) {
    throw new Error("useExtensionBisect must be used within an ExtensionBisectProvider");
  }
  return context;
}

/**
 * Convenience hook for checking bisect status
 */
export function useBisectStatus() {
  const { state, phase, progress } = useExtensionBisect();
  
  return {
    isActive: () => state.active,
    phase,
    progress,
    step: () => state.step,
    totalSteps: () => state.totalSteps,
    foundExtension: () => state.foundExtension,
    isCompleted: () => state.completed,
  };
}
