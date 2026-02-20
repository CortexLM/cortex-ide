import { createContext, useContext, createSignal, createMemo, ParentProps, onMount, onCleanup, createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import type {
  ContextKeys,
  KeymapContextValue,
  KeymapState,
  Keystroke,
  Keybinding,
  KeybindingConflict,
  CommandBinding,
} from "./types";
import { DEFAULT_CONTEXT_KEYS } from "./types";
import { DEFAULT_BINDINGS } from "./defaultBindings";
import {
  loadCustomBindings,
  saveCustomBindings,
  loadCustomWhenClauses,
  saveCustomWhenClauses,
  keyboardEventToKeystroke,
} from "./keymapHelpers";
import { createChordHandlers } from "./chordHandling";
import { createKeymapActions, formatKeybindingFn, parseKeybindingStringFn } from "./keymapActions";
import { invoke } from "@tauri-apps/api/core";

const KeymapContext = createContext<KeymapContextValue>();

export function KeymapProvider(props: ParentProps) {
  const [customBindings, setCustomBindings] = createSignal<Record<string, Keybinding | null>>(loadCustomBindings());
  const [customWhenClauses, setCustomWhenClauses] = createSignal<Record<string, string | null>>(loadCustomWhenClauses());
  const [isRecording, setIsRecording] = createSignal(false);
  const [recordingCommandId, setRecordingCommandId] = createSignal<string | null>(null);
  const [recordedKeystrokes, setRecordedKeystrokes] = createSignal<Keystroke[]>([]);
  const [contextKeys, setContextKeysStore] = createStore<ContextKeys>({ ...DEFAULT_CONTEXT_KEYS });

  // Chord mode signals
  const [chordModeActive, setChordModeActive] = createSignal(false);
  const [pendingChordKeystrokes, setPendingChordKeystrokes] = createSignal<Keystroke[]>([]);
  const chordTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null };
  const [chordTimeout, setChordTimeout] = createSignal(1500);

  // Plugin bindings
  const [pluginBindings, setPluginBindings] = createSignal<CommandBinding[]>([]);

  const [recordingTimeout, setRecordingTimeout] = createSignal(3000);

  // Persist custom bindings when they change
  createEffect(() => { saveCustomBindings(customBindings()); });
  createEffect(() => { saveCustomWhenClauses(customWhenClauses()); });
  createEffect(() => { setContextKeysStore("isRecordingKeybinding", isRecording()); });

  createEffect(() => {
    if (!isRecording()) return;
    const timeout = setTimeout(() => {
      if (isRecording()) {
        actions.stopRecording();
      }
    }, recordingTimeout());
    onCleanup(() => clearTimeout(timeout));
  });

  // Compute merged bindings
  const bindings = createMemo((): CommandBinding[] => {
    const custom = customBindings();
    const customWhen = customWhenClauses();
    const applyCustomOverrides = (binding: Omit<CommandBinding, "customKeybinding">): CommandBinding => ({
      ...binding,
      customKeybinding: custom[binding.commandId] !== undefined ? custom[binding.commandId] : null,
      customWhen: customWhen[binding.commandId] !== undefined
        ? customWhen[binding.commandId] ?? undefined
        : undefined,
    });
    const defaults = DEFAULT_BINDINGS.map(applyCustomOverrides);
    const plugins = pluginBindings().map(b => applyCustomOverrides(b));
    return [...defaults, ...plugins];
  });

  // Compute conflicts
  const conflicts = createMemo((): KeybindingConflict[] => {
    const allBindings = bindings();
    const keybindingMap = new Map<string, string[]>();
    for (const binding of allBindings) {
      const effectiveBinding = binding.customKeybinding ?? binding.defaultKeybinding;
      if (!effectiveBinding) continue;
      const key = formatKeybindingFn(effectiveBinding);
      if (!key) continue;
      const existing = keybindingMap.get(key) || [];
      existing.push(binding.commandId);
      keybindingMap.set(key, existing);
    }
    const result: KeybindingConflict[] = [];
    for (const [key, commands] of keybindingMap) {
      if (commands.length > 1) {
        const binding = parseKeybindingStringFn(key);
        if (binding) {
          result.push({ keybinding: binding, commands });
        }
      }
    }
    return result;
  });

  const registerPluginBindings = (incoming: Omit<CommandBinding, "customKeybinding">[]): void => {
    const full: CommandBinding[] = incoming.map(b => ({
      ...b,
      customKeybinding: null,
    }));
    setPluginBindings(prev => [...prev, ...full]);
  };

  // ============================================================================
  // Create extracted handlers
  // ============================================================================

  const chordHandlers = createChordHandlers({
    chordModeActive, setChordModeActive,
    pendingChordKeystrokes, setPendingChordKeystrokes,
    chordTimeoutRef, isRecording, bindings, contextKeys,
    chordTimeout: chordTimeout(),
  });

  const actions = createKeymapActions({
    customBindings, setCustomBindings,
    customWhenClauses, setCustomWhenClauses,
    isRecording, setIsRecording,
    recordingCommandId, setRecordingCommandId,
    recordedKeystrokes, setRecordedKeystrokes,
    contextKeys, setContextKeysStore, bindings,
  });

  // ============================================================================
  // Global keyboard and focus handlers
  // ============================================================================

  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && chordHandlers.isChordModeActive()) {
        event.preventDefault();
        event.stopPropagation();
        chordHandlers.cancelChordMode();
        return;
      }
      if (!isRecording()) return;
      const keystroke = keyboardEventToKeystroke(event);
      if (keystroke) {
        event.preventDefault();
        event.stopPropagation();
        actions.addRecordedKeystroke(keystroke);
      }
    };

    const updateFocusContext = () => {
      const activeEl = document.activeElement;
      const editorEl = activeEl?.closest(".monaco-editor");
      const editorHasFocus = editorEl !== null;
      setContextKeysStore("editorTextFocus", editorHasFocus);

      if (editorEl) {
        const hasSelection = editorEl.querySelector(".selected-text") !== null;
        setContextKeysStore("editorHasSelection", hasSelection);
        const cursorElements = editorEl.querySelectorAll(".cursor");
        setContextKeysStore("editorHasMultipleSelections", cursorElements.length > 1);
        const isReadonly = editorEl.getAttribute("aria-readonly") === "true" ||
                           editorEl.classList.contains("readonly");
        setContextKeysStore("editorReadonly", isReadonly);
        const langId = editorEl.getAttribute("data-mode-id") ?? "";
        setContextKeysStore("editorLangId", langId);
      } else {
        setContextKeysStore("editorHasSelection", false);
        setContextKeysStore("editorHasMultipleSelections", false);
        setContextKeysStore("editorReadonly", false);
        setContextKeysStore("editorLangId", "");
      }

      const terminalHasFocus = activeEl?.closest(".xterm") !== null ||
                               activeEl?.closest("[data-terminal]") !== null;
      setContextKeysStore("terminalFocus", terminalHasFocus);

      const isInputFocused = activeEl?.tagName === "INPUT" ||
                             activeEl?.tagName === "TEXTAREA" ||
                             (activeEl as HTMLElement)?.isContentEditable === true;
      setContextKeysStore("inputFocus", isInputFocused);

      const isSearchFocused = activeEl?.closest("[data-search-input]") !== null ||
                              activeEl?.closest(".search-input") !== null;
      setContextKeysStore("searchInputFocus", isSearchFocused);

      const isListFocused = activeEl?.closest("[role='listbox']") !== null ||
                            activeEl?.closest("[role='tree']") !== null;
      setContextKeysStore("listFocus", isListFocused);
      setContextKeysStore("treeViewFocus", activeEl?.closest("[role='tree']") !== null);

      const explorerItem = activeEl?.closest("[data-explorer-item]");
      setContextKeysStore("explorerResourceIsFile",
        explorerItem?.getAttribute("data-explorer-type") === "file");
      setContextKeysStore("explorerResourceIsFolder",
        explorerItem?.getAttribute("data-explorer-type") === "folder");

      setContextKeysStore("terminalProcessSupported", true);
    };

    updateFocusContext();
    document.addEventListener("focusin", updateFocusContext);
    document.addEventListener("focusout", updateFocusContext);
    window.addEventListener("keydown", handleKeyDown, true);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", updateFocusContext);
      document.removeEventListener("focusout", updateFocusContext);
      chordHandlers.clearChordTimeout();
    });
  });

  createEffect(() => {
    const active = chordHandlers.isChordModeActive();
    const indicator = chordHandlers.chordIndicator();
    window.dispatchEvent(new CustomEvent("chord-mode:changed", {
      detail: { active, indicator },
    }));
  });

  const loadKeybindingsFromBackend = async (): Promise<boolean> => {
    try {
      const entries = await invoke<any[]>("load_keybindings_file");
      if (entries && entries.length > 0) {
        const imported: Record<string, Keybinding | null> = {};
        for (const entry of entries) {
          if (entry.command && entry.key) {
            const parsed = parseKeybindingStringFn(entry.key);
            imported[entry.command] = parsed;
          }
        }
        setCustomBindings(prev => ({ ...prev, ...imported }));
        return true;
      }
      return false;
    } catch (e) {
      console.error("[KeymapProvider] Failed to load keybindings from backend:", e);
      return false;
    }
  };

  const saveKeybindingsToBackend = async (): Promise<boolean> => {
    try {
      const custom = customBindings();
      const entries = Object.entries(custom)
        .filter(([_, kb]) => kb !== undefined)
        .map(([command, kb]) => ({
          command,
          key: kb ? formatKeybindingFn(kb) : "",
          when: null,
          source: "user",
        }));
      await invoke("save_keybindings_file", { bindings: entries });
      return true;
    } catch (e) {
      console.error("[KeymapProvider] Failed to save keybindings to backend:", e);
      return false;
    }
  };

  const detectBackendConflicts = async (): Promise<any[]> => {
    try {
      const custom = customBindings();
      const entries = Object.entries(custom)
        .filter(([_, kb]) => kb !== undefined)
        .map(([command, kb]) => ({
          command,
          key: kb ? formatKeybindingFn(kb) : "",
          when: null,
          source: "user",
        }));
      return await invoke<any[]>("detect_conflicts", { bindings: entries });
    } catch (e) {
      console.error("[KeymapProvider] Failed to detect conflicts:", e);
      return [];
    }
  };

  // ============================================================================
  // Context value assembly
  // ============================================================================

  const state: KeymapState = {
    get bindings() { return bindings(); },
    get customBindings() { return customBindings(); },
    get conflicts() { return conflicts(); },
    get isRecording() { return isRecording(); },
    get recordingCommandId() { return recordingCommandId(); },
    get recordedKeystrokes() { return recordedKeystrokes(); },
  };

  const value: KeymapContextValue = {
    state,
    bindings,
    customBindings,
    conflicts,
    isRecording,
    recordingCommandId,
    recordedKeystrokes,
    chordState: chordHandlers.chordState,
    isChordModeActive: chordHandlers.isChordModeActive,
    chordIndicator: chordHandlers.chordIndicator,
    cancelChordMode: chordHandlers.cancelChordMode,
    contextKeys,
    setContextKey: actions.setContextKey,
    setContextKeys: actions.setContextKeysBatch,
    evaluateWhen: actions.evaluateWhen,
    setCustomBinding: actions.setCustomBinding,
    setCustomWhen: actions.setCustomWhen,
    removeCustomBinding: actions.removeCustomBinding,
    resetToDefault: actions.resetToDefault,
    resetAllToDefault: actions.resetAllToDefault,
    startRecording: actions.startRecording,
    stopRecording: actions.stopRecording,
    clearRecording: actions.clearRecording,
    addRecordedKeystroke: actions.addRecordedKeystroke,
    saveRecordedBinding: actions.saveRecordedBinding,
    getEffectiveBinding: actions.getEffectiveBinding,
    getEffectiveWhen: actions.getEffectiveWhen,
    getBindingForKeystroke: actions.getBindingForKeystroke,
    matchesKeybinding: actions.matchesKeybinding,
    formatKeybinding: formatKeybindingFn,
    parseKeybindingString: parseKeybindingStringFn,
    exportCustomBindings: actions.exportCustomBindings,
    importCustomBindings: actions.importCustomBindings,
    exportBindingsToFile: actions.exportBindingsToFile,
    importBindingsFromFile: actions.importBindingsFromFile,
    suggestAlternativeKeys: actions.suggestAlternativeKeys,
    handleKeystrokeForChord: chordHandlers.handleKeystrokeForChord,
    getChordPrefixCommands: chordHandlers.getChordPrefixCommands,
    registerPluginBindings,
    chordTimeout,
    setChordTimeout,
    loadKeybindingsFromBackend,
    saveKeybindingsToBackend,
    detectBackendConflicts,
    recordingTimeout,
    setRecordingTimeout,
  };

  return (
    <KeymapContext.Provider value={value}>
      {props.children}
    </KeymapContext.Provider>
  );
}

export function useKeymap() {
  const context = useContext(KeymapContext);
  if (!context) {
    throw new Error("useKeymap must be used within KeymapProvider");
  }
  return context;
}
