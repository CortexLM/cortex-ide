import {
  createContext,
  useContext,
  ParentProps,
  createMemo,
  onMount,
  onCleanup,
  Accessor,
  batch,
} from "solid-js";
import { createStore, produce } from "solid-js/store";

export type StatusBarAlignment = "left" | "center" | "right";
export type StatusBarPriority = number;

export interface StatusBarItemConfig {
  id: string;
  alignment: StatusBarAlignment;
  priority: StatusBarPriority;
  text?: string;
  icon?: string;
  tooltip?: string;
  command?: string;
  color?: string;
  backgroundColor?: string;
  visible?: boolean;
  accessibilityLabel?: string;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface Selection {
  lines: number;
  characters: number;
}

export interface EditorInfo {
  languageId: string;
  languageName: string;
  encoding: string;
  lineEnding: "LF" | "CRLF" | "CR";
  indentation: {
    type: "spaces" | "tabs";
    size: number;
  };
  cursorPosition: CursorPosition;
  selection: Selection | null;
}

export interface StatusBarState {
  items: Record<string, StatusBarItemConfig>;
  editorInfo: EditorInfo;
  notificationCount: number;
  isOnline: boolean;
  isSyncing: boolean;
  branchName: string | null;
  hasChanges: boolean;
}

export interface StatusBarContextValue {
  state: StatusBarState;
  items: Accessor<StatusBarItemConfig[]>;
  leftItems: Accessor<StatusBarItemConfig[]>;
  centerItems: Accessor<StatusBarItemConfig[]>;
  rightItems: Accessor<StatusBarItemConfig[]>;
  editorInfo: Accessor<EditorInfo>;
  cursorPosition: Accessor<CursorPosition>;
  selection: Accessor<Selection | null>;
  notificationCount: Accessor<number>;
  branchName: Accessor<string | null>;
  hasChanges: Accessor<boolean>;
  registerItem: (config: StatusBarItemConfig) => void;
  unregisterItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<StatusBarItemConfig>) => void;
  setItemVisibility: (id: string, visible: boolean) => void;
  updateEditorInfo: (info: Partial<EditorInfo>) => void;
  setCursorPosition: (position: CursorPosition) => void;
  setSelection: (selection: Selection | null) => void;
  setNotificationCount: (count: number) => void;
  incrementNotifications: () => void;
  clearNotifications: () => void;
  setBranchName: (name: string | null) => void;
  setHasChanges: (hasChanges: boolean) => void;
  executeCommand: (command: string) => void;
}

const StatusBarContext = createContext<StatusBarContextValue>();

const DEFAULT_EDITOR_INFO: EditorInfo = {
  languageId: "plaintext",
  languageName: "Plain Text",
  encoding: "UTF-8",
  lineEnding: "LF",
  indentation: {
    type: "spaces",
    size: 2,
  },
  cursorPosition: { line: 1, column: 1 },
  selection: null,
};

export function StatusBarProvider(props: ParentProps) {
  const [state, setState] = createStore<StatusBarState>({
    items: {},
    editorInfo: { ...DEFAULT_EDITOR_INFO },
    notificationCount: 0,
    isOnline: true,
    isSyncing: false,
    branchName: null,
    hasChanges: false,
  });

  const items = createMemo(() => {
    return Object.values(state.items)
      .filter((item) => item.visible !== false)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  });

  const leftItems = createMemo(() =>
    items().filter((item) => item.alignment === "left")
  );

  const centerItems = createMemo(() =>
    items().filter((item) => item.alignment === "center")
  );

  const rightItems = createMemo(() =>
    items().filter((item) => item.alignment === "right")
  );

  const editorInfo = createMemo(() => state.editorInfo);
  const cursorPosition = createMemo(() => state.editorInfo.cursorPosition);
  const selection = createMemo(() => state.editorInfo.selection);
  const notificationCount = createMemo(() => state.notificationCount);
  const branchName = createMemo(() => state.branchName);
  const hasChanges = createMemo(() => state.hasChanges);

  const registerItem = (config: StatusBarItemConfig) => {
    setState("items", config.id, { ...config, visible: config.visible ?? true });
  };

  const unregisterItem = (id: string) => {
    setState(
      produce((s) => {
        delete s.items[id];
      })
    );
  };

  const updateItem = (id: string, updates: Partial<StatusBarItemConfig>) => {
    setState("items", id, (prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const setItemVisibility = (id: string, visible: boolean) => {
    setState("items", id, "visible", visible);
  };

  const updateEditorInfo = (info: Partial<EditorInfo>) => {
    setState("editorInfo", (prev) => ({ ...prev, ...info }));
  };

  const setCursorPosition = (position: CursorPosition) => {
    setState("editorInfo", "cursorPosition", position);
  };

  const setSelection = (selection: Selection | null) => {
    setState("editorInfo", "selection", selection);
  };

  const setNotificationCount = (count: number) => {
    setState("notificationCount", count);
  };

  const incrementNotifications = () => {
    setState("notificationCount", (prev) => prev + 1);
  };

  const clearNotifications = () => {
    setState("notificationCount", 0);
  };

  const setBranchName = (name: string | null) => {
    setState("branchName", name);
  };

  const setHasChanges = (hasChanges: boolean) => {
    setState("hasChanges", hasChanges);
  };

  const executeCommand = (command: string) => {
    window.dispatchEvent(
      new CustomEvent("command:execute", { detail: { command } })
    );
  };

  const handleCursorChange = (e: Event) => {
    const detail = (e as CustomEvent<{ line: number; column: number }>).detail;
    if (detail) {
      setCursorPosition({ line: detail.line, column: detail.column });
    }
  };

  const handleSelectionChange = (e: Event) => {
    const detail = (e as CustomEvent<{ lines: number; characters: number } | null>).detail;
    setSelection(detail);
  };

  const handleLanguageChange = (e: Event) => {
    const detail = (e as CustomEvent<{ languageId: string; languageName: string }>).detail;
    if (detail) {
      updateEditorInfo({
        languageId: detail.languageId,
        languageName: detail.languageName,
      });
    }
  };

  const handleEncodingChange = (e: Event) => {
    const detail = (e as CustomEvent<{ encoding: string }>).detail;
    if (detail) {
      updateEditorInfo({ encoding: detail.encoding });
    }
  };

  const handleIndentationChange = (e: Event) => {
    const detail = (e as CustomEvent<{ type: "spaces" | "tabs"; size: number }>).detail;
    if (detail) {
      updateEditorInfo({ indentation: detail });
    }
  };

  const handleLineEndingChange = (e: Event) => {
    const detail = (e as CustomEvent<{ lineEnding: "LF" | "CRLF" | "CR" }>).detail;
    if (detail) {
      updateEditorInfo({ lineEnding: detail.lineEnding });
    }
  };

  const handleGitBranchChange = (e: Event) => {
    const detail = (e as CustomEvent<{ branch: string | null; hasChanges?: boolean }>).detail;
    if (detail) {
      batch(() => {
        setBranchName(detail.branch);
        if (detail.hasChanges !== undefined) {
          setHasChanges(detail.hasChanges);
        }
      });
    }
  };

  const handleNotification = () => {
    incrementNotifications();
  };

  onMount(() => {
    window.addEventListener("editor:cursor-change", handleCursorChange);
    window.addEventListener("editor:selection-change", handleSelectionChange);
    window.addEventListener("editor:language-change", handleLanguageChange);
    window.addEventListener("editor:encoding-change", handleEncodingChange);
    window.addEventListener("editor:indentation-change", handleIndentationChange);
    window.addEventListener("editor:line-ending-change", handleLineEndingChange);
    window.addEventListener("git:branch-change", handleGitBranchChange);
    window.addEventListener("notification:new", handleNotification);
  });

  onCleanup(() => {
    window.removeEventListener("editor:cursor-change", handleCursorChange);
    window.removeEventListener("editor:selection-change", handleSelectionChange);
    window.removeEventListener("editor:language-change", handleLanguageChange);
    window.removeEventListener("editor:encoding-change", handleEncodingChange);
    window.removeEventListener("editor:indentation-change", handleIndentationChange);
    window.removeEventListener("editor:line-ending-change", handleLineEndingChange);
    window.removeEventListener("git:branch-change", handleGitBranchChange);
    window.removeEventListener("notification:new", handleNotification);
  });

  const contextValue: StatusBarContextValue = {
    state,
    items,
    leftItems,
    centerItems,
    rightItems,
    editorInfo,
    cursorPosition,
    selection,
    notificationCount,
    branchName,
    hasChanges,
    registerItem,
    unregisterItem,
    updateItem,
    setItemVisibility,
    updateEditorInfo,
    setCursorPosition,
    setSelection,
    setNotificationCount,
    incrementNotifications,
    clearNotifications,
    setBranchName,
    setHasChanges,
    executeCommand,
  };

  return (
    <StatusBarContext.Provider value={contextValue}>
      {props.children}
    </StatusBarContext.Provider>
  );
}

export function useStatusBar(): StatusBarContextValue {
  const ctx = useContext(StatusBarContext);
  if (!ctx) {
    throw new Error("useStatusBar must be used within StatusBarProvider");
  }
  return ctx;
}

export function useCursorPosition(): Accessor<CursorPosition> {
  const { cursorPosition } = useStatusBar();
  return cursorPosition;
}

export function useEditorInfo(): Accessor<EditorInfo> {
  const { editorInfo } = useStatusBar();
  return editorInfo;
}
