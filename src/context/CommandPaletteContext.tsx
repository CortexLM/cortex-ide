/**
 * CommandPaletteContext — manages unified palette state.
 *
 * Tracks open/close, current mode, search query, and selected index.
 * Integrates with the existing CommandContext for visibility signals.
 */

import {
  createContext,
  useContext,
  createSignal,
  createMemo,
  JSX,
  batch,
} from "solid-js";
import { useCommands } from "@/context/CommandContext";

export type PaletteMode =
  | "commands"
  | "files"
  | "symbols"
  | "workspace-symbols"
  | "goto-line";

interface CommandPaletteContextValue {
  mode: () => PaletteMode;
  query: () => string;
  selectedIndex: () => number;
  isOpen: () => boolean;
  open: (mode?: PaletteMode) => void;
  close: () => void;
  setQuery: (q: string) => void;
  setSelectedIndex: (idx: number) => void;
  selectNext: (max: number) => void;
  selectPrev: () => void;
  detectMode: (raw: string) => PaletteMode;
}

const CommandPaletteCtx = createContext<CommandPaletteContextValue>();

export function CommandPaletteProvider(props: { children: JSX.Element }) {
  const {
    showCommandPalette,
    setShowCommandPalette,
    showFileFinder,
    setShowFileFinder,
    showDocumentSymbolPicker,
    setShowDocumentSymbolPicker,
    showWorkspaceSymbolPicker,
    setShowWorkspaceSymbolPicker,
    showGoToLine,
    setShowGoToLine,
  } = useCommands();

  const [mode, setMode] = createSignal<PaletteMode>("commands");
  const [query, setQueryRaw] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  const isOpen = createMemo(() => {
    return (
      showCommandPalette() ||
      showFileFinder() ||
      showDocumentSymbolPicker() ||
      showWorkspaceSymbolPicker() ||
      showGoToLine()
    );
  });

  const detectMode = (raw: string): PaletteMode => {
    if (raw.startsWith(">")) return "commands";
    if (raw.startsWith("@")) return "symbols";
    if (raw.startsWith("#")) return "workspace-symbols";
    if (raw.startsWith(":")) return "goto-line";
    return "files";
  };

  const setQuery = (q: string) => {
    setQueryRaw(q);
    setSelectedIndex(0);

    const detected = detectMode(q);
    if (detected !== mode()) {
      setMode(detected);
    }
  };

  const open = (m?: PaletteMode) => {
    const target = m ?? "commands";
    batch(() => {
      setMode(target);
      setQueryRaw("");
      setSelectedIndex(0);
      switch (target) {
        case "commands":
          setShowCommandPalette(true);
          break;
        case "files":
          setShowFileFinder(true);
          break;
        case "symbols":
          setShowDocumentSymbolPicker(true);
          break;
        case "workspace-symbols":
          setShowWorkspaceSymbolPicker(true);
          break;
        case "goto-line":
          setShowGoToLine(true);
          break;
      }
    });
  };

  const close = () => {
    batch(() => {
      setShowCommandPalette(false);
      setShowFileFinder(false);
      setShowDocumentSymbolPicker(false);
      setShowWorkspaceSymbolPicker(false);
      setShowGoToLine(false);
      setQueryRaw("");
      setSelectedIndex(0);
    });
  };

  const selectNext = (max: number) => {
    setSelectedIndex(i => Math.min(i + 1, max - 1));
  };

  const selectPrev = () => {
    setSelectedIndex(i => Math.max(i - 1, 0));
  };

  const value: CommandPaletteContextValue = {
    mode,
    query,
    selectedIndex,
    isOpen,
    open,
    close,
    setQuery,
    setSelectedIndex,
    selectNext,
    selectPrev,
    detectMode,
  };

  return (
    <CommandPaletteCtx.Provider value={value}>
      {props.children}
    </CommandPaletteCtx.Provider>
  );
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteCtx);
  if (!ctx) {
    throw new Error("useCommandPalette must be used within a CommandPaletteProvider");
  }
  return ctx;
}
