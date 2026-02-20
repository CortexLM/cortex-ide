import type { Keystroke, Keybinding, KeyModifiers } from "./types";

// ============================================================================
// Storage Constants
// ============================================================================

export const STORAGE_KEY = "cortex_keybindings";
export const WHEN_STORAGE_KEY = "cortex_keybinding_when_clauses";

// ============================================================================
// Storage Functions
// ============================================================================

/** Load custom when clauses from localStorage */
export function loadCustomWhenClauses(): Record<string, string | null> {
  try {
    const stored = localStorage.getItem(WHEN_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("[KeymapContext] Failed to load custom when clauses:", e);
  }
  return {};
}

/** Save custom when clauses to localStorage */
export function saveCustomWhenClauses(whenClauses: Record<string, string | null>): void {
  try {
    localStorage.setItem(WHEN_STORAGE_KEY, JSON.stringify(whenClauses));
  } catch (e) {
    console.error("[KeymapContext] Failed to save custom when clauses:", e);
  }
}

/** Load custom bindings from localStorage */
export function loadCustomBindings(): Record<string, Keybinding | null> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("[KeymapContext] Failed to load custom bindings:", e);
  }
  return {};
}

/** Save custom bindings to localStorage */
export function saveCustomBindings(bindings: Record<string, Keybinding | null>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch (e) {
    console.error("[KeymapContext] Failed to save custom bindings:", e);
  }
}

// ============================================================================
// Formatting Functions
// ============================================================================

/** Format a single keystroke for display */
export function formatKeystroke(keystroke: Keystroke): string {
  const parts: string[] = [];
  if (keystroke.modifiers.ctrl) parts.push("Ctrl");
  if (keystroke.modifiers.alt) parts.push("Alt");
  if (keystroke.modifiers.shift) parts.push("Shift");
  if (keystroke.modifiers.meta) parts.push("Meta");
  let keyDisplay = keystroke.key;
  const keyMap: Record<string, string> = {
    "ArrowUp": "↑", "ArrowDown": "↓", "ArrowLeft": "←", "ArrowRight": "→",
    "Escape": "Esc", "Backspace": "⌫", "Delete": "Del", "Enter": "↵",
    "Tab": "⇥", " ": "Space",
  };
  if (keyMap[keystroke.key]) {
    keyDisplay = keyMap[keystroke.key];
  } else if (keystroke.key.length === 1) {
    keyDisplay = keystroke.key.toUpperCase();
  }
  parts.push(keyDisplay);
  return parts.join("+");
}

/** Format a complete keybinding for display */
export function formatKeybindingFn(keybinding: Keybinding | null): string {
  if (!keybinding || keybinding.keystrokes.length === 0) {
    return "";
  }
  return keybinding.keystrokes.map(formatKeystroke).join(" ");
}

// ============================================================================
// Comparison Functions
// ============================================================================

/** Compare two keystrokes for equality */
export function keystrokesEqual(a: Keystroke, b: Keystroke): boolean {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    a.modifiers.ctrl === b.modifiers.ctrl &&
    a.modifiers.alt === b.modifiers.alt &&
    a.modifiers.shift === b.modifiers.shift &&
    a.modifiers.meta === b.modifiers.meta
  );
}

/** Compare two keybindings for equality */
export function keybindingsEqual(a: Keybinding | null, b: Keybinding | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.keystrokes.length !== b.keystrokes.length) return false;
  return a.keystrokes.every((keystroke, index) =>
    keystrokesEqual(keystroke, b.keystrokes[index])
  );
}

// ============================================================================
// Keystroke Parsing Functions
// ============================================================================

/** Parse a keyboard event into a Keystroke */
export function keyboardEventToKeystroke(event: KeyboardEvent): Keystroke | null {
  if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) {
    return null;
  }
  return {
    key: event.key,
    modifiers: {
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey,
    },
  };
}

/** Parse a keybinding string like "Ctrl+Shift+P" into a Keybinding */
export function parseKeybindingStringFn(str: string): Keybinding | null {
  if (!str || str.trim() === "") return null;
  const chords = str.trim().split(/\s+/);
  const keystrokes: Keystroke[] = [];
  for (const chord of chords) {
    const parts = chord.split("+");
    const modifiers: KeyModifiers = { ctrl: false, alt: false, shift: false, meta: false };
    let key = "";
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (lower === "ctrl" || lower === "control") {
        modifiers.ctrl = true;
      } else if (lower === "alt") {
        modifiers.alt = true;
      } else if (lower === "shift") {
        modifiers.shift = true;
      } else if (lower === "meta" || lower === "cmd" || lower === "command") {
        modifiers.meta = true;
      } else {
        key = part;
      }
    }
    if (key) {
      keystrokes.push({ key, modifiers });
    }
  }
  return keystrokes.length > 0 ? { keystrokes } : null;
}

/** Chord mode timeout in milliseconds */
export const CHORD_TIMEOUT_MS = 1500;
