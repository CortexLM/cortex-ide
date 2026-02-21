import {
  createContext,
  useContext,
  ParentProps,
  createMemo,
  Accessor,
  batch,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types - Re-exported from centralized types for backward compatibility
// ============================================================================

import type {
  CursorPosition,
  Selection,
  OpenFile,
} from "../../types";

// Re-export types for backward compatibility with existing imports
export type { CursorPosition, Selection, OpenFile };

// ============================================================================
// State
// ============================================================================

interface EditorFilesState {
  openFiles: OpenFile[];
  activeFileId: string | null;
}

// ============================================================================
// Context Value
// ============================================================================

export interface EditorFilesContextValue {
  // State accessors (granular for selective subscriptions)
  openFiles: Accessor<OpenFile[]>;
  activeFileId: Accessor<string | null>;
  activeFile: Accessor<OpenFile | undefined>;
  openFileCount: Accessor<number>;
  hasModifiedFiles: Accessor<boolean>;
  modifiedFileIds: Accessor<string[]>;

  // File operations
  openFile: (path: string) => Promise<OpenFile | null>;
  closeFile: (fileId: string) => void;
  setActiveFileId: (fileId: string | null) => void;
  updateFileContent: (fileId: string, content: string) => void;
  saveFile: (fileId: string) => Promise<void>;
  closeAllFiles: () => void;
  getFileById: (fileId: string) => OpenFile | undefined;
  getFileByPath: (path: string) => OpenFile | undefined;
  markFileClean: (fileId: string) => void;

  // Internal: for EditorContext composition
  _state: EditorFilesState;
  _setState: (fn: (state: EditorFilesState) => void) => void;
  _addFileToState: (file: OpenFile) => void;
  _removeFileFromState: (fileId: string) => void;
}

// ============================================================================
// Utilities
// ============================================================================

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const name = filename.toLowerCase();

  if (name === "dockerfile" || name.startsWith("dockerfile.")) return "dockerfile";
  if (name === "makefile" || name === "gnumakefile") return "shell";
  if (name === ".gitignore" || name === ".dockerignore") return "shell";
  if (name === ".env" || name.startsWith(".env.")) return "shell";

  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    mts: "typescript",
    cts: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    html: "html",
    htm: "html",
    xml: "html",
    svg: "html",
    css: "css",
    scss: "css",
    sass: "css",
    less: "css",
    json: "json",
    jsonc: "json",
    json5: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    ini: "toml",
    cfg: "toml",
    conf: "toml",
    py: "python",
    pyw: "python",
    pyi: "python",
    rs: "rust",
    go: "go",
    rb: "python",
    php: "javascript",
    java: "typescript",
    kt: "typescript",
    kts: "typescript",
    scala: "typescript",
    swift: "typescript",
    c: "rust",
    h: "rust",
    cpp: "rust",
    cc: "rust",
    cxx: "rust",
    hpp: "rust",
    cs: "typescript",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    ps1: "shell",
    psm1: "shell",
    bat: "shell",
    cmd: "shell",
    sql: "sql",
    mysql: "sql",
    pgsql: "sql",
    sqlite: "sql",
    md: "markdown",
    mdx: "markdown",
    markdown: "markdown",
    rst: "markdown",
    txt: "plaintext",
    lock: "json",
    editorconfig: "toml",
    gitattributes: "shell",
  };

  return langMap[ext] || "plaintext";
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Context
// ============================================================================

const EditorFilesContext = createContext<EditorFilesContextValue>();

export function EditorFilesProvider(props: ParentProps) {
  const [state, setState] = createStore<EditorFilesState>({
    openFiles: [],
    activeFileId: null,
  });

  // Granular selectors using createMemo
  const openFiles = createMemo(() => state.openFiles);
  const activeFileId = createMemo(() => state.activeFileId);
  const activeFile = createMemo(() =>
    state.openFiles.find((f) => f.id === state.activeFileId)
  );
  const openFileCount = createMemo(() => state.openFiles.length);
  const hasModifiedFiles = createMemo(() =>
    state.openFiles.some((f) => f.modified)
  );
  const modifiedFileIds = createMemo(() =>
    state.openFiles.filter((f) => f.modified).map((f) => f.id)
  );

  const getFileById = (fileId: string): OpenFile | undefined => {
    return state.openFiles.find((f) => f.id === fileId);
  };

  const getFileByPath = (path: string): OpenFile | undefined => {
    return state.openFiles.find((f) => f.path === path);
  };

  const openFile = async (path: string): Promise<OpenFile | null> => {
    const existing = state.openFiles.find((f) => f.path === path);
    if (existing) {
      setState("activeFileId", existing.id);
      return existing;
    }

    try {
      const content = await invoke<string>("fs_read_file", { path });
      // Extract filename from path (handles both / and \ separators)
      const name = path.split(/[/\\]/).pop() || path;
      const id = `file-${generateId()}`;

      const newFile: OpenFile = {
        id,
        path,
        name,
        content,
        language: detectLanguage(name),
        modified: false,
        cursors: [{ line: 1, column: 1 }],
        selections: [],
      };

      batch(() => {
        setState("openFiles", (files) => [...files, newFile]);
        setState("activeFileId", id);
      });

      return newFile;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Failed to open file:", errorMessage);

      window.dispatchEvent(
        new CustomEvent("notification", {
          detail: {
            type: "error",
            title: "Failed to open file",
            message: `Could not open "${
              path.split("/").pop() || path.split("\\").pop() || path
            }": ${errorMessage}`,
          },
        })
      );
      return null;
    }
  };

  const closeFile = (fileId: string) => {
    const fileIndex = state.openFiles.findIndex((f) => f.id === fileId);
    if (fileIndex === -1) return;

    batch(() => {
      if (state.activeFileId === fileId) {
        const remaining = state.openFiles.filter((f) => f.id !== fileId);
        const newActiveId = remaining[Math.max(0, fileIndex - 1)]?.id || null;
        setState("activeFileId", newActiveId);
      }
      setState("openFiles", (files) => files.filter((f) => f.id !== fileId));
    });
  };

  const setActiveFileId = (fileId: string | null) => {
    setState("activeFileId", fileId);
  };

  const updateFileContent = (fileId: string, content: string) => {
    batch(() => {
      setState("openFiles", (f) => f.id === fileId, "content", content);
      setState("openFiles", (f) => f.id === fileId, "modified", true);
    });
  };

  const saveFile = async (fileId: string) => {
    const file = state.openFiles.find((f) => f.id === fileId);
    if (!file) return;

    try {
      await invoke("fs_write_file", { path: file.path, content: file.content });

      setState("openFiles", (f) => f.id === fileId, "modified", false);

      window.dispatchEvent(
        new CustomEvent("cortex:file-saved", {
          detail: { path: file.path, fileId: file.id },
        })
      );
    } catch (e) {
      console.error("Failed to save file:", e);
    }
  };

  const closeAllFiles = () => {
    batch(() => {
      setState("openFiles", []);
      setState("activeFileId", null);
    });
  };

  const markFileClean = (fileId: string) => {
    setState("openFiles", (f) => f.id === fileId, "modified", false);
  };

  // Internal methods for composition
  const _setState = (fn: (state: EditorFilesState) => void) => {
    setState(produce(fn));
  };

  const _addFileToState = (file: OpenFile) => {
    setState("openFiles", (files) => [...files, file]);
  };

  const _removeFileFromState = (fileId: string) => {
    setState("openFiles", (files) => files.filter((f) => f.id !== fileId));
  };

  const value: EditorFilesContextValue = {
    openFiles,
    activeFileId,
    activeFile,
    openFileCount,
    hasModifiedFiles,
    modifiedFileIds,
    openFile,
    closeFile,
    setActiveFileId,
    updateFileContent,
    saveFile,
    closeAllFiles,
    getFileById,
    getFileByPath,
    markFileClean,
    _state: state,
    _setState,
    _addFileToState,
    _removeFileFromState,
  };

  return (
    <EditorFilesContext.Provider value={value}>
      {props.children}
    </EditorFilesContext.Provider>
  );
}

export function useEditorFiles() {
  const context = useContext(EditorFilesContext);
  if (!context) {
    throw new Error("useEditorFiles must be used within EditorFilesProvider");
  }
  return context;
}
