import {
  createContext,
  useContext,
  ParentProps,
  createMemo,
  Accessor,
  batch,
} from "solid-js";
import { createStore } from "solid-js/store";

// ============================================================================
// Types
// ============================================================================

export interface CursorInfo {
  line: number;
  column: number;
}

export interface SelectionInfo {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  text?: string;
}

// ============================================================================
// State
// ============================================================================

interface EditorCursorState {
  cursorCount: number;
  selectionCount: number;
  primaryCursor: CursorInfo | null;
  primarySelection: SelectionInfo | null;
  // For multi-cursor support
  cursors: CursorInfo[];
  selections: SelectionInfo[];
}

// ============================================================================
// Context Value
// ============================================================================

export interface EditorCursorContextValue {
  // State accessors (granular)
  cursorCount: Accessor<number>;
  selectionCount: Accessor<number>;
  primaryCursor: Accessor<CursorInfo | null>;
  primarySelection: Accessor<SelectionInfo | null>;
  cursors: Accessor<CursorInfo[]>;
  selections: Accessor<SelectionInfo[]>;
  hasMultipleCursors: Accessor<boolean>;
  hasSelection: Accessor<boolean>;

  // Cursor operations
  updateCursorInfo: (cursorCount: number, selectionCount: number) => void;
  setPrimaryCursor: (cursor: CursorInfo | null) => void;
  setPrimarySelection: (selection: SelectionInfo | null) => void;
  setCursors: (cursors: CursorInfo[]) => void;
  setSelections: (selections: SelectionInfo[]) => void;
  clearCursors: () => void;
  clearSelections: () => void;

  // Computed helpers
  getCursorPosition: () => string;
  getSelectionInfo: () => string;
}

// ============================================================================
// Context
// ============================================================================

const EditorCursorContext = createContext<EditorCursorContextValue>();

export function EditorCursorProvider(props: ParentProps) {
  const [state, setState] = createStore<EditorCursorState>({
    cursorCount: 1,
    selectionCount: 0,
    primaryCursor: null,
    primarySelection: null,
    cursors: [],
    selections: [],
  });

  // Granular selectors
  const cursorCount = createMemo(() => state.cursorCount);
  const selectionCount = createMemo(() => state.selectionCount);
  const primaryCursor = createMemo(() => state.primaryCursor);
  const primarySelection = createMemo(() => state.primarySelection);
  const cursors = createMemo(() => state.cursors);
  const selections = createMemo(() => state.selections);
  const hasMultipleCursors = createMemo(() => state.cursorCount > 1);
  const hasSelection = createMemo(() => state.selectionCount > 0);

  const updateCursorInfo = (newCursorCount: number, newSelectionCount: number) => {
    batch(() => {
      setState("cursorCount", newCursorCount);
      setState("selectionCount", newSelectionCount);
    });
  };

  const setPrimaryCursor = (cursor: CursorInfo | null) => {
    setState("primaryCursor", cursor);
  };

  const setPrimarySelection = (selection: SelectionInfo | null) => {
    setState("primarySelection", selection);
  };

  const setCursors = (newCursors: CursorInfo[]) => {
    batch(() => {
      setState("cursors", newCursors);
      setState("cursorCount", newCursors.length);
      if (newCursors.length > 0) {
        setState("primaryCursor", newCursors[0]);
      }
    });
  };

  const setSelections = (newSelections: SelectionInfo[]) => {
    batch(() => {
      setState("selections", newSelections);
      setState("selectionCount", newSelections.length);
      if (newSelections.length > 0) {
        setState("primarySelection", newSelections[0]);
      } else {
        setState("primarySelection", null);
      }
    });
  };

  const clearCursors = () => {
    batch(() => {
      setState("cursors", []);
      setState("cursorCount", 1);
      setState("primaryCursor", null);
    });
  };

  const clearSelections = () => {
    batch(() => {
      setState("selections", []);
      setState("selectionCount", 0);
      setState("primarySelection", null);
    });
  };

  // Computed display helpers
  const getCursorPosition = (): string => {
    const cursor = state.primaryCursor;
    if (!cursor) return "Ln 1, Col 1";
    return `Ln ${cursor.line}, Col ${cursor.column}`;
  };

  const getSelectionInfo = (): string => {
    if (state.selectionCount === 0) return "";
    if (state.selectionCount === 1 && state.primarySelection) {
      const sel = state.primarySelection;
      const lines = Math.abs(sel.endLine - sel.startLine) + 1;
      return `(${lines} line${lines > 1 ? "s" : ""} selected)`;
    }
    return `(${state.selectionCount} selection${state.selectionCount > 1 ? "s" : ""})`;
  };

  const value: EditorCursorContextValue = {
    cursorCount,
    selectionCount,
    primaryCursor,
    primarySelection,
    cursors,
    selections,
    hasMultipleCursors,
    hasSelection,
    updateCursorInfo,
    setPrimaryCursor,
    setPrimarySelection,
    setCursors,
    setSelections,
    clearCursors,
    clearSelections,
    getCursorPosition,
    getSelectionInfo,
  };

  return (
    <EditorCursorContext.Provider value={value}>
      {props.children}
    </EditorCursorContext.Provider>
  );
}

export function useEditorCursor() {
  const context = useContext(EditorCursorContext);
  if (!context) {
    throw new Error("useEditorCursor must be used within EditorCursorProvider");
  }
  return context;
}
