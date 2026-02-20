import type { Accessor, Setter } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import type { ContextKeys, Keybinding, Keystroke, CommandBinding } from "./types";
import { evaluateWhenClause } from "./types";
import {
  formatKeybindingFn,
  keystrokesEqual,
  keybindingsEqual,
  parseKeybindingStringFn,
} from "./keymapHelpers";
import { DEFAULT_BINDINGS } from "./defaultBindings";

// ============================================================================
// Keymap Actions Types
// ============================================================================

export interface KeymapActionsDeps {
  customBindings: Accessor<Record<string, Keybinding | null>>;
  setCustomBindings: Setter<Record<string, Keybinding | null>>;
  customWhenClauses: Accessor<Record<string, string | null>>;
  setCustomWhenClauses: Setter<Record<string, string | null>>;
  isRecording: Accessor<boolean>;
  setIsRecording: Setter<boolean>;
  recordingCommandId: Accessor<string | null>;
  setRecordingCommandId: Setter<string | null>;
  recordedKeystrokes: Accessor<Keystroke[]>;
  setRecordedKeystrokes: Setter<Keystroke[]>;
  contextKeys: ContextKeys;
  setContextKeysStore: SetStoreFunction<ContextKeys>;
  bindings: Accessor<CommandBinding[]>;
}

export interface KeymapActions {
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
  exportCustomBindings: () => string;
  importCustomBindings: (json: string) => boolean;
  getEffectiveBinding: (commandId: string) => Keybinding | null;
  getEffectiveWhen: (commandId: string) => string | undefined;
  getBindingForKeystroke: (keybinding: Keybinding) => CommandBinding[];
  matchesKeybinding: (binding: CommandBinding, keystroke: Keystroke | Keystroke[]) => boolean;
  setContextKey: <K extends keyof ContextKeys>(key: K, value: ContextKeys[K]) => void;
  setContextKeysBatch: (updates: Partial<ContextKeys>) => void;
  evaluateWhen: (when: string | undefined) => boolean;
  exportBindingsToFile: () => Promise<void>;
  importBindingsFromFile: () => Promise<boolean>;
  suggestAlternativeKeys: (commandId: string) => string[];
}

// ============================================================================
// Keymap Actions Factory
// ============================================================================

export function createKeymapActions(deps: KeymapActionsDeps): KeymapActions {
  const {
    customBindings, setCustomBindings,
    customWhenClauses, setCustomWhenClauses,
    setIsRecording, recordingCommandId, setRecordingCommandId,
    recordedKeystrokes, setRecordedKeystrokes,
    contextKeys, setContextKeysStore, bindings,
  } = deps;

  const setCustomBinding = (commandId: string, keybinding: Keybinding | null): void => {
    setCustomBindings(prev => ({ ...prev, [commandId]: keybinding }));
  };

  const setCustomWhen = (commandId: string, when: string | null): void => {
    setCustomWhenClauses(prev => ({ ...prev, [commandId]: when }));
  };

  const removeCustomBinding = (commandId: string): void => {
    setCustomBindings(prev => {
      const next = { ...prev };
      delete next[commandId];
      return next;
    });
  };

  const resetToDefault = (commandId: string): void => {
    removeCustomBinding(commandId);
  };

  const resetAllToDefault = (): void => {
    setCustomBindings({});
  };

  const startRecording = (commandId: string): void => {
    setIsRecording(true);
    setRecordingCommandId(commandId);
    setRecordedKeystrokes([]);
  };

  const stopRecording = (): void => {
    setIsRecording(false);
    setRecordingCommandId(null);
  };

  const clearRecording = (): void => {
    setRecordedKeystrokes([]);
  };

  const addRecordedKeystroke = (keystroke: Keystroke): void => {
    setRecordedKeystrokes(prev => {
      if (prev.length >= 2) {
        return [keystroke];
      }
      return [...prev, keystroke];
    });
  };

  const saveRecordedBinding = (): void => {
    const cmdId = recordingCommandId();
    const keystrokes = recordedKeystrokes();
    if (cmdId && keystrokes.length > 0) {
      setCustomBinding(cmdId, { keystrokes });
    }
    stopRecording();
    clearRecording();
  };

  const exportCustomBindings = (): string => {
    return JSON.stringify(customBindings(), null, 2);
  };

  const importCustomBindings = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed === "object" && parsed !== null) {
        setCustomBindings(parsed);
        return true;
      }
    } catch (e) {
      console.error("[KeymapContext] Failed to import bindings:", e);
    }
    return false;
  };

  const getEffectiveBinding = (commandId: string): Keybinding | null => {
    const custom = customBindings();
    if (custom[commandId] !== undefined) {
      return custom[commandId];
    }
    const binding = DEFAULT_BINDINGS.find(b => b.commandId === commandId);
    return binding?.defaultKeybinding ?? null;
  };

  const getEffectiveWhen = (commandId: string): string | undefined => {
    const customWhen = customWhenClauses();
    if (customWhen[commandId] !== undefined) {
      return customWhen[commandId] ?? undefined;
    }
    const binding = DEFAULT_BINDINGS.find(b => b.commandId === commandId);
    return binding?.when;
  };

  const getBindingForKeystroke = (keybinding: Keybinding): CommandBinding[] => {
    return bindings().filter(binding => {
      const effective = binding.customKeybinding ?? binding.defaultKeybinding;
      return keybindingsEqual(effective, keybinding);
    });
  };

  const matchesKeybinding = (binding: CommandBinding, keystrokes: Keystroke | Keystroke[]): boolean => {
    const effective = binding.customKeybinding ?? binding.defaultKeybinding;
    if (!effective) return false;
    const keystrokesArray = Array.isArray(keystrokes) ? keystrokes : [keystrokes];
    if (effective.keystrokes.length !== keystrokesArray.length) return false;
    const keysMatch = effective.keystrokes.every((ks, index) =>
      keystrokesEqual(ks, keystrokesArray[index])
    );
    if (!keysMatch) return false;
    const effectiveWhen = binding.customWhen ?? binding.when;
    if (effectiveWhen && !evaluateWhenClause(effectiveWhen, contextKeys)) {
      return false;
    }
    return true;
  };

  const setContextKey = <K extends keyof ContextKeys>(key: K, value: ContextKeys[K]): void => {
    setContextKeysStore(key, value);
  };

  const setContextKeysBatch = (updates: Partial<ContextKeys>): void => {
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        setContextKeysStore(key as keyof ContextKeys, value);
      }
    }
  };

  const evaluateWhen = (when: string | undefined): boolean => {
    return evaluateWhenClause(when, contextKeys);
  };

  const exportBindingsToFile = async (): Promise<void> => {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const filePath = await save({
        defaultPath: "keybindings.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (filePath) {
        const json = exportCustomBindings();
        await writeTextFile(filePath, json);
      }
    } catch (e) {
      console.error("[KeymapActions] Failed to export bindings to file:", e);
      const json = exportCustomBindings();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "keybindings.json";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const importBindingsFromFile = async (): Promise<boolean> => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const filePath = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (filePath && typeof filePath === "string") {
        const json = await readTextFile(filePath);
        return importCustomBindings(json);
      }
    } catch (e) {
      console.error("[KeymapActions] Failed to import bindings from file:", e);
    }
    return false;
  };

  const suggestAlternativeKeys = (commandId: string): string[] => {
    const binding = bindings().find(b => b.commandId === commandId);
    if (!binding) return [];
    const effective = binding.customKeybinding ?? binding.defaultKeybinding;
    if (!effective || effective.keystrokes.length === 0) return [];
    const baseKey = effective.keystrokes[0].key;
    const usedKeys = new Set<string>();
    for (const b of bindings()) {
      const eff = b.customKeybinding ?? b.defaultKeybinding;
      if (eff) {
        usedKeys.add(formatKeybindingFn(eff));
      }
    }
    const suggestions: string[] = [];
    const modCombos = [
      { ctrl: true, alt: false, shift: false, meta: false },
      { ctrl: true, alt: false, shift: true, meta: false },
      { ctrl: true, alt: true, shift: false, meta: false },
      { ctrl: false, alt: true, shift: false, meta: false },
      { ctrl: false, alt: true, shift: true, meta: false },
    ];
    for (const mods of modCombos) {
      const kb: Keybinding = { keystrokes: [{ key: baseKey, modifiers: mods }] };
      const formatted = formatKeybindingFn(kb);
      if (formatted && !usedKeys.has(formatted)) {
        suggestions.push(formatted);
      }
      if (suggestions.length >= 5) break;
    }
    return suggestions;
  };

  return {
    setCustomBinding,
    setCustomWhen,
    removeCustomBinding,
    resetToDefault,
    resetAllToDefault,
    startRecording,
    stopRecording,
    clearRecording,
    addRecordedKeystroke,
    saveRecordedBinding,
    exportCustomBindings,
    importCustomBindings,
    getEffectiveBinding,
    getEffectiveWhen,
    getBindingForKeystroke,
    matchesKeybinding,
    setContextKey,
    setContextKeysBatch,
    evaluateWhen,
    exportBindingsToFile,
    importBindingsFromFile,
    suggestAlternativeKeys,
  };
}

// Re-export formatting helpers used by the provider
export { formatKeybindingFn, parseKeybindingStringFn };
