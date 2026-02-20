// ============================================================================
// Context Keys - VS Code-style conditional context for keybindings
// ============================================================================

/** Context keys that can be used in "when" clauses for conditional keybindings */
export interface ContextKeys {
  editorTextFocus: boolean;
  editorHasSelection: boolean;
  editorHasMultipleSelections: boolean;
  editorReadonly: boolean;
  editorLangId: string;
  explorerResourceIsFile: boolean;
  explorerResourceIsFolder: boolean;
  terminalFocus: boolean;
  terminalProcessSupported: boolean;
  terminalIsOpen: boolean;
  searchInputFocus: boolean;
  inputFocus: boolean;
  listFocus: boolean;
  treeViewFocus: boolean;
  sidebarVisible: boolean;
  panelVisible: boolean;
  auxiliaryBarVisible: boolean;
  inQuickOpen: boolean;
  inCommandPalette: boolean;
  suggestWidgetVisible: boolean;
  workspaceFolderCount: number;
  gitRepoOpen: boolean;
  debuggingActive: boolean;
  inDebugMode: boolean;
  debugState: string;
  inSnippetMode: boolean;
  vimMode: string;
  isRecordingKeybinding: boolean;
  explorerFocus: boolean;
  debugFocus: boolean;
  searchFocus: boolean;
  inZenMode: boolean;
  /** Custom context keys (extensible) */
  [key: string]: boolean | string | number;
}

/** Default context key values */
export const DEFAULT_CONTEXT_KEYS: ContextKeys = {
  editorTextFocus: false,
  editorHasSelection: false,
  editorHasMultipleSelections: false,
  editorReadonly: false,
  editorLangId: "",
  explorerResourceIsFile: false,
  explorerResourceIsFolder: false,
  terminalFocus: false,
  terminalProcessSupported: true,
  terminalIsOpen: false,
  searchInputFocus: false,
  inputFocus: false,
  listFocus: false,
  treeViewFocus: false,
  sidebarVisible: true,
  panelVisible: false,
  auxiliaryBarVisible: false,
  inQuickOpen: false,
  inCommandPalette: false,
  suggestWidgetVisible: false,
  workspaceFolderCount: 0,
  gitRepoOpen: false,
  debuggingActive: false,
  inDebugMode: false,
  debugState: "inactive",
  inSnippetMode: false,
  vimMode: "normal",
  explorerFocus: false,
  debugFocus: false,
  searchFocus: false,
  isRecordingKeybinding: false,
  inZenMode: false,
};

// ============================================================================
// When Clause Evaluation
// ============================================================================

/**
 * Evaluate a single token in a when clause expression.
 * Supports simple key lookup, negation, string/numeric comparison, and "in" operator.
 */
export function evaluateToken(token: string, contextKeys: ContextKeys): boolean {
  const trimmed = token.trim();

  if (trimmed.startsWith("!")) {
    const key = trimmed.slice(1).trim();
    const value = contextKeys[key];
    return !value;
  }

  if (trimmed.includes("==") || trimmed.includes("!=")) {
    const isNotEqual = trimmed.includes("!=");
    const [keyPart, valuePart] = trimmed.split(isNotEqual ? "!=" : "==").map(s => s.trim());
    const actualValue = contextKeys[keyPart];
    let expectedValue: string | number | boolean = valuePart;
    if ((valuePart.startsWith("'") && valuePart.endsWith("'")) ||
        (valuePart.startsWith('"') && valuePart.endsWith('"'))) {
      expectedValue = valuePart.slice(1, -1);
    } else if (valuePart === "true") {
      expectedValue = true;
    } else if (valuePart === "false") {
      expectedValue = false;
    } else if (!isNaN(Number(valuePart))) {
      expectedValue = Number(valuePart);
    }
    const result = actualValue === expectedValue;
    return isNotEqual ? !result : result;
  }

  const numericMatch = trimmed.match(/^(\w+)\s*(>=|<=|>|<)\s*(\d+)$/);
  if (numericMatch) {
    const [, key, operator, valueStr] = numericMatch;
    const actualValue = Number(contextKeys[key]) || 0;
    const compareValue = Number(valueStr);
    switch (operator) {
      case ">": return actualValue > compareValue;
      case "<": return actualValue < compareValue;
      case ">=": return actualValue >= compareValue;
      case "<=": return actualValue <= compareValue;
    }
  }

  if (trimmed.includes(" in ")) {
    const [keyPart, listPart] = trimmed.split(" in ").map(s => s.trim());
    const actualValue = String(contextKeys[keyPart] || "");
    const list = listPart.replace(/['"]/g, "").split(",").map(s => s.trim());
    return list.includes(actualValue);
  }

  const value = contextKeys[trimmed];
  return !!value;
}

/**
 * Evaluate a when clause expression.
 * Supports: key, !key, key && key, key || key, and parentheses for grouping.
 */
export function evaluateWhenClause(when: string | undefined, contextKeys: ContextKeys): boolean {
  if (!when || when.trim() === "") {
    return true;
  }

  let expression = when.trim();

  while (expression.includes("(")) {
    expression = expression.replace(/\(([^()]+)\)/g, (_, inner) => {
      return evaluateWhenClause(inner, contextKeys) ? "true" : "false";
    });
  }

  if (expression.includes("||")) {
    const parts = expression.split("||").map(s => s.trim());
    return parts.some(part => evaluateWhenClause(part, contextKeys));
  }

  if (expression.includes("&&")) {
    const parts = expression.split("&&").map(s => s.trim());
    return parts.every(part => evaluateWhenClause(part, contextKeys));
  }

  return evaluateToken(expression, contextKeys);
}

// ============================================================================
// Keybinding Types
// ============================================================================

/** Modifier keys for keybindings */
export interface KeyModifiers {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

/** Represents a single keystroke in a keybinding */
export interface Keystroke {
  key: string;
  modifiers: KeyModifiers;
}

/** A complete keybinding (can be a chord sequence) */
export interface Keybinding {
  keystrokes: Keystroke[];
}

/** A command with its keybinding */
export interface CommandBinding {
  commandId: string;
  label: string;
  category: string;
  defaultKeybinding: Keybinding | null;
  customKeybinding: Keybinding | null;
  /** VS Code-style "when" clause for conditional keybinding activation */
  when?: string;
  /** Custom when clause override (set by user) */
  customWhen?: string;
  /** @deprecated Use "when" instead */
  context?: string;
}

/** Conflict information when two commands share the same keybinding */
export interface KeybindingConflict {
  keybinding: Keybinding;
  commands: string[];
}

/** State for the keymap editor */
export interface KeymapState {
  bindings: CommandBinding[];
  customBindings: Record<string, Keybinding | null>;
  conflicts: KeybindingConflict[];
  isRecording: boolean;
  recordingCommandId: string | null;
  recordedKeystrokes: Keystroke[];
}

/** Chord mode state for multi-key chord sequences */
export interface ChordState {
  active: boolean;
  pendingKeystrokes: Keystroke[];
  indicator: string;
}

/** Configuration for chord timeout behavior */
export interface ChordTimeoutConfig {
  min: number;
  max: number;
  defaultValue: number;
  current: number;
}

/** Export format for keybinding configurations */
export interface KeybindingExportFormat {
  version: number;
  bindings: Record<string, Keybinding | null>;
  whenClauses?: Record<string, string | null>;
  metadata: {
    exportedAt: string;
    bindingCount: number;
    appVersion?: string;
  };
}

/** Suggestion for resolving a keybinding conflict */
export interface ConflictSuggestion {
  commandId: string;
  suggestedBinding: Keybinding;
  reason: string;
}

/** Context value interface */
export interface KeymapContextValue {
  state: KeymapState;
  bindings: () => CommandBinding[];
  customBindings: () => Record<string, Keybinding | null>;
  conflicts: () => KeybindingConflict[];
  isRecording: () => boolean;
  recordingCommandId: () => string | null;
  recordedKeystrokes: () => Keystroke[];
  chordState: () => ChordState;
  isChordModeActive: () => boolean;
  chordIndicator: () => string;
  cancelChordMode: () => void;
  contextKeys: ContextKeys;
  setContextKey: <K extends keyof ContextKeys>(key: K, value: ContextKeys[K]) => void;
  setContextKeys: (updates: Partial<ContextKeys>) => void;
  evaluateWhen: (when: string | undefined) => boolean;
  setCustomBinding: (commandId: string, keybinding: Keybinding | null) => void;
  setCustomWhen: (commandId: string, when: string | null) => void;
  removeCustomBinding: (commandId: string) => void;
  resetToDefault: (commandId: string) => void;
  resetAllToDefault: () => void;
  startRecording: (commandId: string) => void;
  stopRecording: () => void;
  clearRecording: () => void;
  addRecordedKeystroke: (keystroke: Keystroke) => void;
  saveRecordedBinding: () => void;
  getEffectiveBinding: (commandId: string) => Keybinding | null;
  getEffectiveWhen: (commandId: string) => string | undefined;
  getBindingForKeystroke: (keybinding: Keybinding) => CommandBinding[];
  matchesKeybinding: (binding: CommandBinding, keystroke: Keystroke | Keystroke[]) => boolean;
  formatKeybinding: (keybinding: Keybinding | null) => string;
  parseKeybindingString: (str: string) => Keybinding | null;
  exportCustomBindings: () => string;
  importCustomBindings: (json: string) => boolean;
  exportBindingsToFile: () => Promise<void>;
  importBindingsFromFile: () => Promise<boolean>;
  suggestAlternativeKeys: (commandId: string) => string[];
  handleKeystrokeForChord: (keystroke: Keystroke) => { handled: boolean; commandId: string | null };
  getChordPrefixCommands: (keystroke: Keystroke) => CommandBinding[];
  registerPluginBindings: (bindings: Omit<CommandBinding, "customKeybinding">[]) => void;
  chordTimeout: () => number;
  setChordTimeout: (ms: number) => void;
  loadKeybindingsFromBackend: () => Promise<boolean>;
  saveKeybindingsToBackend: () => Promise<boolean>;
  detectBackendConflicts: () => Promise<any[]>;
  recordingTimeout: () => number;
  setRecordingTimeout: (ms: number) => void;
}
