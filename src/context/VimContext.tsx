import { createContext, useContext, ParentProps, createSignal, createEffect } from "solid-js";

/** Vim modes supported by the editor */
export type VimMode = "normal" | "insert" | "visual" | "visual-line" | "command";

/** Pending operator state for operator-pending mode */
export interface PendingOperator {
  type: "d" | "c" | "y" | ">" | "<" | "g~" | "gu" | "gU";
  count?: number;
}

/** Visual selection range */
export interface VisualSelection {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

/** Vim register contents */
export interface VimRegister {
  content: string;
  type: "char" | "line" | "block";
}

/** Command history entry */
export interface CommandHistoryEntry {
  command: string;
  timestamp: number;
}

/** Last change for dot repeat command */
export interface LastChange {
  /** Type of change: 'x', 'dd', 'cw', 'r', 's', 'insert', 'cc', 'D', 'C', 'S', etc. */
  type: string;
  /** Operator used (d, c, y, etc.) for operator+motion changes */
  operator?: string;
  /** Motion used (w, e, $, etc.) for operator+motion changes */
  motion?: string;
  /** Text object info for text object operations */
  textObject?: { object: string; around: boolean };
  /** Text that was inserted (for insert operations) */
  insertedText?: string;
  /** Replacement character for 'r' command */
  replaceChar?: string;
  /** Count used for the operation */
  count: number;
}

/** Vim state structure */
export interface VimState {
  enabled: boolean;
  mode: VimMode;
  count: string;
  pendingOperator: PendingOperator | null;
  visualSelection: VisualSelection | null;
  commandBuffer: string;
  lastSearch: string;
  searchDirection: "forward" | "backward";
  registers: Record<string, VimRegister>;
  commandHistory: CommandHistoryEntry[];
  lastCommand: string;
  insertStartPosition: { line: number; column: number } | null;
  repeatCount: number;
  lastChange: LastChange | null;
}

/** Vim context value interface */
export interface VimContextValue {
  state: VimState;
  enabled: () => boolean;
  mode: () => VimMode;
  count: () => string;
  pendingOperator: () => PendingOperator | null;
  commandBuffer: () => string;
  
  // State setters
  setEnabled: (enabled: boolean) => void;
  setMode: (mode: VimMode) => void;
  setCount: (count: string) => void;
  appendCount: (digit: string) => void;
  clearCount: () => void;
  setPendingOperator: (op: PendingOperator | null) => void;
  setCommandBuffer: (buffer: string) => void;
  appendCommandBuffer: (char: string) => void;
  clearCommandBuffer: () => void;
  setVisualSelection: (selection: VisualSelection | null) => void;
  setLastSearch: (search: string, direction: "forward" | "backward") => void;
  setRegister: (name: string, content: string, type: "char" | "line" | "block") => void;
  getRegister: (name: string) => VimRegister | null;
  setInsertStartPosition: (pos: { line: number; column: number } | null) => void;
  setLastChange: (change: LastChange | null) => void;
  getLastChange: () => LastChange | null;
  
  // Utility functions
  getEffectiveCount: () => number;
  resetState: () => void;
  executeCommand: (command: string) => void;
  getModeDisplay: () => string;
}

const defaultState: VimState = {
  enabled: false,
  mode: "normal",
  count: "",
  pendingOperator: null,
  visualSelection: null,
  commandBuffer: "",
  lastSearch: "",
  searchDirection: "forward",
  registers: {
    '"': { content: "", type: "char" }, // Default register
    "0": { content: "", type: "char" }, // Yank register
    "-": { content: "", type: "char" }, // Small delete register
    "+": { content: "", type: "char" }, // System clipboard
    "*": { content: "", type: "char" }, // Primary selection
  },
  commandHistory: [],
  lastCommand: "",
  insertStartPosition: null,
  repeatCount: 1,
  lastChange: null,
};

const VimContext = createContext<VimContextValue>();

/** Storage key for persisting vim enabled state */
const VIM_ENABLED_KEY = "cortex-vim-enabled";

export function VimProvider(props: ParentProps) {
  // Load initial enabled state from localStorage
  const storedEnabled = typeof localStorage !== "undefined" 
    ? localStorage.getItem(VIM_ENABLED_KEY) === "true" 
    : false;

  const [enabled, setEnabledState] = createSignal(storedEnabled);
  const [mode, setModeState] = createSignal<VimMode>("normal");
  const [count, setCountState] = createSignal("");
  const [pendingOperator, setPendingOperatorState] = createSignal<PendingOperator | null>(null);
  const [commandBuffer, setCommandBufferState] = createSignal("");
  const [visualSelection, setVisualSelectionState] = createSignal<VisualSelection | null>(null);
  const [lastSearch, setLastSearchState] = createSignal("");
  const [searchDirection, setSearchDirectionState] = createSignal<"forward" | "backward">("forward");
  const [registers, setRegisters] = createSignal<Record<string, VimRegister>>(defaultState.registers);
  const [commandHistory, setCommandHistory] = createSignal<CommandHistoryEntry[]>([]);
  const [lastCommand, setLastCommand] = createSignal("");
  const [insertStartPosition, setInsertStartPositionState] = createSignal<{ line: number; column: number } | null>(null);
  const [lastChange, setLastChangeState] = createSignal<LastChange | null>(null);

  // Persist enabled state to localStorage
  createEffect(() => {
    const isEnabled = enabled();
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(VIM_ENABLED_KEY, String(isEnabled));
    }
  });

  // Dispatch custom event when mode changes for other components to listen
  createEffect(() => {
    const currentMode = mode();
    const event = new CustomEvent("vim:mode-change", { detail: { mode: currentMode, enabled: enabled() } });
    window.dispatchEvent(event);
  });

  const setEnabled = (value: boolean) => {
    setEnabledState(value);
    if (!value) {
      // Reset to normal mode when disabling vim
      setModeState("normal");
      clearState();
    }
  };

  const setMode = (newMode: VimMode) => {
    const currentMode = mode();
    
    // Handle mode transition logic
    if (newMode === "insert" && currentMode !== "insert") {
      // Entering insert mode - clear any pending state
      setPendingOperatorState(null);
      setCountState("");
    } else if (newMode === "normal") {
      // Entering normal mode - clear visual selection and command buffer
      setVisualSelectionState(null);
      setCommandBufferState("");
      setPendingOperatorState(null);
    } else if (newMode === "command") {
      // Entering command mode - initialize command buffer
      setCommandBufferState(":");
    } else if (newMode === "visual" || newMode === "visual-line") {
      // Entering visual mode - initialize selection
      setPendingOperatorState(null);
    }
    
    setModeState(newMode);
  };

  const appendCount = (digit: string) => {
    if (/^[0-9]$/.test(digit)) {
      // Don't allow leading zeros (except for the 0 motion)
      if (count() === "" && digit === "0") {
        return; // Let 0 be handled as a motion
      }
      setCountState(count() + digit);
    }
  };

  const clearCount = () => {
    setCountState("");
  };

  const appendCommandBuffer = (char: string) => {
    setCommandBufferState(commandBuffer() + char);
  };

  const clearCommandBuffer = () => {
    setCommandBufferState("");
  };

  const setLastSearch = (search: string, direction: "forward" | "backward") => {
    setLastSearchState(search);
    setSearchDirectionState(direction);
  };

  const setRegister = (name: string, content: string, type: "char" | "line" | "block") => {
    setRegisters((regs) => ({
      ...regs,
      [name]: { content, type },
      // Also update default register for most operations
      ...(name !== '"' ? { '"': { content, type } } : {}),
    }));
  };

  const getRegister = (name: string): VimRegister | null => {
    return registers()[name] || null;
  };

  const getEffectiveCount = (): number => {
    const c = count();
    if (c === "") return 1;
    const parsed = parseInt(c, 10);
    return isNaN(parsed) ? 1 : parsed;
  };

  const clearState = () => {
    setCountState("");
    setPendingOperatorState(null);
    setCommandBufferState("");
    setVisualSelectionState(null);
    setInsertStartPositionState(null);
  };

  const resetState = () => {
    clearState();
    setModeState("normal");
  };

  const executeCommand = (command: string) => {
    // Add to command history
    setCommandHistory((history) => [
      ...history,
      { command, timestamp: Date.now() },
    ]);
    setLastCommand(command);
    
    // Dispatch command execution event
    const event = new CustomEvent("vim:command-execute", { detail: { command } });
    window.dispatchEvent(event);
    
    // Return to normal mode after command execution
    setModeState("normal");
    setCommandBufferState("");
  };

  const getModeDisplay = (): string => {
    if (!enabled()) return "";
    
    const currentMode = mode();
    const op = pendingOperator();
    const c = count();
    
    let display = "";
    
    switch (currentMode) {
      case "normal":
        display = "NORMAL";
        break;
      case "insert":
        display = "INSERT";
        break;
      case "visual":
        display = "VISUAL";
        break;
      case "visual-line":
        display = "V-LINE";
        break;
      case "command":
        display = "COMMAND";
        break;
    }
    
    // Add pending operator info
    if (op) {
      display += ` (${c}${op.type})`;
    } else if (c) {
      display += ` (${c})`;
    }
    
    return display;
  };

  const state: VimState = {
    get enabled() { return enabled(); },
    get mode() { return mode(); },
    get count() { return count(); },
    get pendingOperator() { return pendingOperator(); },
    get visualSelection() { return visualSelection(); },
    get commandBuffer() { return commandBuffer(); },
    get lastSearch() { return lastSearch(); },
    get searchDirection() { return searchDirection(); },
    get registers() { return registers(); },
    get commandHistory() { return commandHistory(); },
    get lastCommand() { return lastCommand(); },
    get insertStartPosition() { return insertStartPosition(); },
    get repeatCount() { return getEffectiveCount(); },
    get lastChange() { return lastChange(); },
  };

  return (
    <VimContext.Provider
      value={{
        state,
        enabled,
        mode,
        count,
        pendingOperator,
        commandBuffer,
        setEnabled,
        setMode,
        setCount: setCountState,
        appendCount,
        clearCount,
        setPendingOperator: setPendingOperatorState,
        setCommandBuffer: setCommandBufferState,
        appendCommandBuffer,
        clearCommandBuffer,
        setVisualSelection: setVisualSelectionState,
        setLastSearch,
        setRegister,
        getRegister,
        setInsertStartPosition: setInsertStartPositionState,
        setLastChange: setLastChangeState,
        getLastChange: lastChange,
        getEffectiveCount,
        resetState,
        executeCommand,
        getModeDisplay,
      }}
    >
      {props.children}
    </VimContext.Provider>
  );
}

export function useVim() {
  const context = useContext(VimContext);
  if (!context) {
    throw new Error("useVim must be used within VimProvider");
  }
  return context;
}
