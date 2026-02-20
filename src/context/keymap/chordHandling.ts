import { createMemo, type Accessor, type Setter } from "solid-js";
import type { ChordState, CommandBinding, ContextKeys, Keystroke } from "./types";
import { evaluateWhenClause } from "./types";
import { formatKeystroke, keystrokesEqual, CHORD_TIMEOUT_MS } from "./keymapHelpers";

// ============================================================================
// Chord Handling Types
// ============================================================================

export interface ChordHandlingDeps {
  chordModeActive: Accessor<boolean>;
  setChordModeActive: Setter<boolean>;
  pendingChordKeystrokes: Accessor<Keystroke[]>;
  setPendingChordKeystrokes: Setter<Keystroke[]>;
  chordTimeoutRef: { current: ReturnType<typeof setTimeout> | null };
  isRecording: Accessor<boolean>;
  bindings: Accessor<CommandBinding[]>;
  contextKeys: ContextKeys;
  chordTimeout?: number;
}

export interface ChordHandlers {
  clearChordTimeout: () => void;
  cancelChordMode: () => void;
  startChordMode: (keystroke: Keystroke) => void;
  chordState: Accessor<ChordState>;
  isChordModeActive: () => boolean;
  chordIndicator: () => string;
  chordIndicatorText: () => string;
  getChordPrefixCommands: (keystroke: Keystroke) => CommandBinding[];
  getSingleKeyCommands: (keystroke: Keystroke) => CommandBinding[];
  handleKeystrokeForChord: (keystroke: Keystroke) => { handled: boolean; commandId: string | null };
}

// ============================================================================
// Chord Handling Factory
// ============================================================================

export function createChordHandlers(deps: ChordHandlingDeps): ChordHandlers {
  const {
    chordModeActive, setChordModeActive,
    pendingChordKeystrokes, setPendingChordKeystrokes,
    chordTimeoutRef, isRecording, bindings, contextKeys,
  } = deps;

  const timeoutMs = deps.chordTimeout ?? CHORD_TIMEOUT_MS;

  const clearChordTimeout = (): void => {
    if (chordTimeoutRef.current !== null) {
      clearTimeout(chordTimeoutRef.current);
      chordTimeoutRef.current = null;
    }
  };

  const cancelChordMode = (): void => {
    clearChordTimeout();
    setChordModeActive(false);
    setPendingChordKeystrokes([]);
  };

  const startChordTimeout = (): void => {
    clearChordTimeout();
    chordTimeoutRef.current = setTimeout(() => {
      cancelChordMode();
    }, timeoutMs);
  };

  const startChordMode = (keystroke: Keystroke): void => {
    clearChordTimeout();
    setChordModeActive(true);
    setPendingChordKeystrokes([keystroke]);
    startChordTimeout();
  };

  const continueChordMode = (keystrokes: Keystroke[]): void => {
    setPendingChordKeystrokes(keystrokes);
    startChordTimeout();
  };

  const formatPendingKeystrokes = (keystrokes: Keystroke[]): string => {
    return keystrokes.map(formatKeystroke).join(" ");
  };

  const chordState = createMemo((): ChordState => {
    const pending = pendingChordKeystrokes();
    return {
      active: chordModeActive(),
      pendingKeystrokes: pending,
      indicator: pending.length > 0
        ? `(${formatPendingKeystrokes(pending)}) waiting for next key...`
        : "",
    };
  });

  const isChordModeActive = (): boolean => chordModeActive();

  const chordIndicator = (): string => {
    const pending = pendingChordKeystrokes();
    return pending.length > 0 ? `(${formatPendingKeystrokes(pending)})` : "";
  };

  const chordIndicatorText = (): string => {
    const pending = pendingChordKeystrokes();
    return pending.length > 0 ? formatPendingKeystrokes(pending) : "";
  };

  const matchesWhen = (binding: CommandBinding): boolean => {
    const effectiveWhen = binding.customWhen ?? binding.when;
    if (effectiveWhen && !evaluateWhenClause(effectiveWhen, contextKeys)) {
      return false;
    }
    return true;
  };

  const prefixMatchesKeystrokes = (
    bindingKeystrokes: Keystroke[],
    prefix: Keystroke[],
  ): boolean => {
    if (bindingKeystrokes.length <= prefix.length) return false;
    return prefix.every((ks, i) => keystrokesEqual(bindingKeystrokes[i], ks));
  };

  const exactMatchesKeystrokes = (
    bindingKeystrokes: Keystroke[],
    target: Keystroke[],
  ): boolean => {
    if (bindingKeystrokes.length !== target.length) return false;
    return target.every((ks, i) => keystrokesEqual(bindingKeystrokes[i], ks));
  };

  const getChordPrefixCommands = (keystroke: Keystroke): CommandBinding[] => {
    const pending = pendingChordKeystrokes();
    const prefix = [...pending, keystroke];
    return bindings().filter(binding => {
      const effective = binding.customKeybinding ?? binding.defaultKeybinding;
      if (!effective || effective.keystrokes.length < 2) return false;
      if (!prefixMatchesKeystrokes(effective.keystrokes, prefix)) return false;
      return matchesWhen(binding);
    });
  };

  const getSingleKeyCommands = (keystroke: Keystroke): CommandBinding[] => {
    return bindings().filter(binding => {
      const effective = binding.customKeybinding ?? binding.defaultKeybinding;
      if (!effective || effective.keystrokes.length !== 1) return false;
      if (!keystrokesEqual(effective.keystrokes[0], keystroke)) return false;
      return matchesWhen(binding);
    });
  };

  const handleKeystrokeForChord = (keystroke: Keystroke): { handled: boolean; commandId: string | null } => {
    if (isRecording()) {
      return { handled: false, commandId: null };
    }

    const pending = pendingChordKeystrokes();

    if (chordModeActive() && pending.length > 0) {
      clearChordTimeout();
      const allKeys = [...pending, keystroke];

      const exactMatches = bindings().filter(binding => {
        const effective = binding.customKeybinding ?? binding.defaultKeybinding;
        if (!effective) return false;
        if (!exactMatchesKeystrokes(effective.keystrokes, allKeys)) return false;
        return matchesWhen(binding);
      });

      if (exactMatches.length > 0) {
        cancelChordMode();
        return { handled: true, commandId: exactMatches[0].commandId };
      }

      const prefixMatches = bindings().filter(binding => {
        const effective = binding.customKeybinding ?? binding.defaultKeybinding;
        if (!effective) return false;
        if (!prefixMatchesKeystrokes(effective.keystrokes, allKeys)) return false;
        return matchesWhen(binding);
      });

      if (prefixMatches.length > 0) {
        continueChordMode(allKeys);
        return { handled: true, commandId: null };
      }

      cancelChordMode();
      return { handled: true, commandId: null };
    }

    const chordPrefixCommands = getChordPrefixCommands(keystroke);
    const singleKeyCommands = getSingleKeyCommands(keystroke);

    if (chordPrefixCommands.length > 0) {
      startChordMode(keystroke);
      return { handled: true, commandId: null };
    }

    if (singleKeyCommands.length > 0) {
      return { handled: true, commandId: singleKeyCommands[0].commandId };
    }

    return { handled: false, commandId: null };
  };

  return {
    clearChordTimeout,
    cancelChordMode,
    startChordMode,
    chordState,
    isChordModeActive,
    chordIndicator,
    chordIndicatorText,
    getChordPrefixCommands,
    getSingleKeyCommands,
    handleKeystrokeForChord,
  };
}
