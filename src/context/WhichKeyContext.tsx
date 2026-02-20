import {
  createContext,
  useContext,
  createSignal,
  createMemo,
  createEffect,
  onMount,
  onCleanup,
  ParentProps,
} from "solid-js";
import {
  useKeymap,
  keyboardEventToKeystroke,
  type Keystroke,
  type Keybinding,
  type CommandBinding,
} from "./KeymapContext";

/** Settings for WhichKey behavior */
export interface WhichKeySettings {
  /** Whether WhichKey is enabled */
  enabled: boolean;
  /** Delay in milliseconds before showing the popup (default: 500) */
  delay: number;
  /** Maximum number of items to show per column */
  maxItemsPerColumn: number;
  /** Whether to show command descriptions */
  showDescriptions: boolean;
}

/** A pending key sequence waiting for continuation */
export interface PendingSequence {
  /** The keystrokes pressed so far */
  keystrokes: Keystroke[];
  /** Commands that can be completed from this sequence */
  continuations: ContinuationBinding[];
  /** Timestamp when the sequence started */
  startTime: number;
}

/** A possible continuation from a pending sequence */
export interface ContinuationBinding {
  /** The next keystroke needed */
  nextKeystroke: Keystroke;
  /** The full binding this would complete */
  binding: CommandBinding;
  /** Remaining keystrokes after the next one (for deeply nested sequences) */
  remainingKeystrokes: Keystroke[];
}

/** State for WhichKey tracking */
export interface WhichKeyState {
  /** Currently pending key sequence, if any */
  pendingSequence: PendingSequence | null;
  /** Whether the WhichKey popup is visible */
  isVisible: boolean;
  /** Current settings */
  settings: WhichKeySettings;
}

/** Context value interface */
export interface WhichKeyContextValue {
  /** Current state */
  state: WhichKeyState;
  /** Whether there's a pending sequence */
  hasPendingSequence: () => boolean;
  /** The pending sequence, if any */
  pendingSequence: () => PendingSequence | null;
  /** Whether the popup is visible */
  isVisible: () => boolean;
  /** Current settings */
  settings: () => WhichKeySettings;
  /** Available continuations grouped by category */
  continuationsByCategory: () => Map<string, ContinuationBinding[]>;
  /** Format a keystroke for display */
  formatKeystroke: (keystroke: Keystroke) => string;
  /** Update settings */
  updateSettings: (settings: Partial<WhichKeySettings>) => void;
  /** Cancel the current pending sequence */
  cancelSequence: () => void;
  /** Manually show WhichKey for a prefix */
  showForPrefix: (keystrokes: Keystroke[]) => void;
}

const STORAGE_KEY = "cortex_whichkey_settings";

/** Default settings */
const DEFAULT_SETTINGS: WhichKeySettings = {
  enabled: true,
  delay: 500,
  maxItemsPerColumn: 10,
  showDescriptions: true,
};

/** Load settings from localStorage */
function loadSettings(): WhichKeySettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error("[WhichKeyContext] Failed to load settings:", e);
  }
  return DEFAULT_SETTINGS;
}

/** Save settings to localStorage */
function saveSettings(settings: WhichKeySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("[WhichKeyContext] Failed to save settings:", e);
  }
}

/** Format a single keystroke for display */
function formatKeystrokeFn(keystroke: Keystroke): string {
  const parts: string[] = [];

  if (keystroke.modifiers.ctrl) parts.push("Ctrl");
  if (keystroke.modifiers.alt) parts.push("Alt");
  if (keystroke.modifiers.shift) parts.push("Shift");
  if (keystroke.modifiers.meta) parts.push("Meta");

  // Format special keys
  const keyMap: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Escape: "Esc",
    Backspace: "⌫",
    Delete: "Del",
    Enter: "↵",
    Tab: "⇥",
    " ": "Space",
  };

  let keyDisplay = keystroke.key;
  if (keyMap[keystroke.key]) {
    keyDisplay = keyMap[keystroke.key];
  } else if (keystroke.key.length === 1) {
    keyDisplay = keystroke.key.toUpperCase();
  }

  parts.push(keyDisplay);
  return parts.join("+");
}

/** Compare two keystrokes for equality */
function keystrokesEqual(a: Keystroke, b: Keystroke): boolean {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    a.modifiers.ctrl === b.modifiers.ctrl &&
    a.modifiers.alt === b.modifiers.alt &&
    a.modifiers.shift === b.modifiers.shift &&
    a.modifiers.meta === b.modifiers.meta
  );
}

/** Check if a keystroke matches the start of a keybinding sequence */
function matchesPrefix(
  keybinding: Keybinding,
  prefix: Keystroke[]
): { matches: boolean; remaining: Keystroke[] } {
  if (prefix.length === 0) {
    return { matches: false, remaining: [] };
  }

  if (keybinding.keystrokes.length <= prefix.length) {
    return { matches: false, remaining: [] };
  }

  for (let i = 0; i < prefix.length; i++) {
    if (!keystrokesEqual(keybinding.keystrokes[i], prefix[i])) {
      return { matches: false, remaining: [] };
    }
  }

  return {
    matches: true,
    remaining: keybinding.keystrokes.slice(prefix.length),
  };
}

/** Check if a keybinding is a multi-key chord */
function isChordBinding(keybinding: Keybinding | null): boolean {
  return keybinding !== null && keybinding.keystrokes.length > 1;
}

const WhichKeyContext = createContext<WhichKeyContextValue>();

export function WhichKeyProvider(props: ParentProps) {
  const keymap = useKeymap();

  const [settings, setSettings] = createSignal<WhichKeySettings>(loadSettings());
  const [pendingSequence, setPendingSequence] = createSignal<PendingSequence | null>(null);
  const [isVisible, setIsVisible] = createSignal(false);

  let timeoutId: number | undefined;

  // Persist settings when they change
  createEffect(() => {
    saveSettings(settings());
  });

  // Find all continuations for a given prefix
  const findContinuations = (prefix: Keystroke[]): ContinuationBinding[] => {
    const bindings = keymap.bindings();
    const continuations: ContinuationBinding[] = [];

    for (const binding of bindings) {
      const effectiveBinding = binding.customKeybinding ?? binding.defaultKeybinding;
      if (!effectiveBinding || !isChordBinding(effectiveBinding)) continue;

      const { matches, remaining } = matchesPrefix(effectiveBinding, prefix);
      if (matches && remaining.length > 0) {
        continuations.push({
          nextKeystroke: remaining[0],
          binding,
          remainingKeystrokes: remaining.slice(1),
        });
      }
    }

    return continuations;
  };

  // Group continuations by category
  const continuationsByCategory = createMemo((): Map<string, ContinuationBinding[]> => {
    const sequence = pendingSequence();
    if (!sequence) return new Map();

    const byCategory = new Map<string, ContinuationBinding[]>();

    for (const continuation of sequence.continuations) {
      const category = continuation.binding.category || "General";
      const existing = byCategory.get(category) || [];
      existing.push(continuation);
      byCategory.set(category, existing);
    }

    // Sort each category's bindings by label
    for (const [category, bindings] of byCategory) {
      byCategory.set(
        category,
        bindings.sort((a, b) => a.binding.label.localeCompare(b.binding.label))
      );
    }

    return byCategory;
  });

  // Clear pending sequence and hide popup
  const cancelSequence = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    setPendingSequence(null);
    setIsVisible(false);
  };

  // Show WhichKey for a given prefix
  const showForPrefix = (keystrokes: Keystroke[]) => {
    const continuations = findContinuations(keystrokes);
    if (continuations.length === 0) {
      cancelSequence();
      return;
    }

    setPendingSequence({
      keystrokes,
      continuations,
      startTime: Date.now(),
    });

    // Show popup after delay
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => {
      if (pendingSequence()) {
        setIsVisible(true);
      }
    }, settings().delay);
  };

  // Update settings
  const updateSettings = (newSettings: Partial<WhichKeySettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  // Global keyboard handler
  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't intercept if WhichKey is disabled
      if (!settings().enabled) return;

      // Don't intercept if recording keybindings
      if (keymap.isRecording()) return;

      // Don't intercept if user is typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Escape cancels the pending sequence
      if (event.key === "Escape") {
        if (pendingSequence()) {
          event.preventDefault();
          event.stopPropagation();
          cancelSequence();
          return;
        }
        return;
      }

      const keystroke = keyboardEventToKeystroke(event);
      if (!keystroke) return;

      const currentSequence = pendingSequence();

      if (currentSequence) {
        // We have a pending sequence - check if this keystroke continues it
        const newPrefix = [...currentSequence.keystrokes, keystroke];

        // Check if this completes a binding
        const bindings = keymap.bindings();
        for (const binding of bindings) {
          const effectiveBinding = binding.customKeybinding ?? binding.defaultKeybinding;
          if (!effectiveBinding) continue;

          if (
            effectiveBinding.keystrokes.length === newPrefix.length &&
            effectiveBinding.keystrokes.every((ks, i) => keystrokesEqual(ks, newPrefix[i]))
          ) {
            // This completes the binding - let it through and cancel our state
            cancelSequence();
            return;
          }
        }

        // Check for further continuations
        const continuations = findContinuations(newPrefix);
        if (continuations.length > 0) {
          // Update pending sequence with new continuations
          event.preventDefault();
          event.stopPropagation();

          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          setPendingSequence({
            keystrokes: newPrefix,
            continuations,
            startTime: currentSequence.startTime,
          });

          // Show immediately since we're already in a sequence
          setIsVisible(true);
          return;
        }

        // No continuations - invalid sequence, cancel
        cancelSequence();
        return;
      }

      // No pending sequence - check if this keystroke starts a chord
      const prefix = [keystroke];
      const continuations = findContinuations(prefix);

      if (continuations.length > 0) {
        // This is the start of a chord sequence
        event.preventDefault();
        event.stopPropagation();
        showForPrefix(prefix);
      }
    };

    // Use capture phase to intercept before other handlers
    window.addEventListener("keydown", handleKeyDown, true);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown, true);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  });

  const state: WhichKeyState = {
    get pendingSequence() {
      return pendingSequence();
    },
    get isVisible() {
      return isVisible();
    },
    get settings() {
      return settings();
    },
  };

  const value: WhichKeyContextValue = {
    state,
    hasPendingSequence: () => pendingSequence() !== null,
    pendingSequence,
    isVisible,
    settings,
    continuationsByCategory,
    formatKeystroke: formatKeystrokeFn,
    updateSettings,
    cancelSequence,
    showForPrefix,
  };

  return (
    <WhichKeyContext.Provider value={value}>
      {props.children}
    </WhichKeyContext.Provider>
  );
}

export function useWhichKey() {
  const context = useContext(WhichKeyContext);
  if (!context) {
    throw new Error("useWhichKey must be used within WhichKeyProvider");
  }
  return context;
}
