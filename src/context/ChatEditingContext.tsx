import { createContext, useContext, ParentProps, batch } from "solid-js";
import { createStore } from "solid-js/store";
import { fsWriteFile } from "../utils/tauri-api";

export type ChangeStatus = "pending" | "accepted" | "rejected";

export interface FileChange {
  id: string;
  filePath: string;
  fileName: string;
  originalContent: string;
  proposedContent: string;
  patch: string;
  status: ChangeStatus;
  language: string;
  lineCount: number;
  addedLines: number;
  removedLines: number;
}

export interface EditingSession {
  id: string;
  startedAt: number;
  prompt: string;
  model: string;
  status: "generating" | "ready" | "applying" | "completed" | "cancelled";
  progress: number;
  currentFile?: string;
  error?: string;
}

interface ChatEditingState {
  isActive: boolean;
  session: EditingSession | null;
  pendingChanges: Map<string, FileChange>;
  workingSet: Set<string>;
  expandedFiles: Set<string>;
  selectedChangeId: string | null;
}

interface ChatEditingContextValue {
  state: ChatEditingState;
  startSession: (prompt: string, model: string) => string;
  endSession: () => void;
  cancelSession: () => void;
  addChange: (change: Omit<FileChange, "id" | "status">) => string;
  removeChange: (changeId: string) => void;
  acceptChange: (changeId: string) => void;
  rejectChange: (changeId: string) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  applyAccepted: () => Promise<void>;
  discardSession: () => void;
  updateProgress: (progress: number, currentFile?: string) => void;
  setSessionStatus: (status: EditingSession["status"]) => void;
  setSessionError: (error: string) => void;
  addToWorkingSet: (filePath: string) => void;
  removeFromWorkingSet: (filePath: string) => void;
  clearWorkingSet: () => void;
  toggleFileExpanded: (filePath: string) => void;
  setSelectedChange: (changeId: string | null) => void;
  getChangesByFile: (filePath: string) => FileChange[];
  getPendingCount: () => number;
  getAcceptedCount: () => number;
  getRejectedCount: () => number;
  getTotalStats: () => { files: number; added: number; removed: number };
}

const ChatEditingContext = createContext<ChatEditingContextValue>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

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
    css: "css",
    scss: "css",
    sass: "css",
    less: "css",
    json: "json",
    jsonc: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    py: "python",
    pyw: "python",
    rs: "rust",
    go: "go",
    java: "typescript",
    kt: "typescript",
    c: "rust",
    h: "rust",
    cpp: "rust",
    hpp: "rust",
    cs: "typescript",
    sh: "shell",
    bash: "shell",
    sql: "sql",
    md: "markdown",
    mdx: "markdown",
  };
  
  return langMap[ext] || "plaintext";
}

function countLines(content: string): number {
  if (!content) return 0;
  return content.split("\n").length;
}

function countDiffLines(patch: string): { added: number; removed: number } {
  const lines = patch.split("\n");
  let added = 0;
  let removed = 0;
  
  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      added++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      removed++;
    }
  }
  
  return { added, removed };
}

export function ChatEditingProvider(props: ParentProps) {
  const [state, setState] = createStore<ChatEditingState>({
    isActive: false,
    session: null,
    pendingChanges: new Map(),
    workingSet: new Set(),
    expandedFiles: new Set(),
    selectedChangeId: null,
  });

  const startSession = (prompt: string, model: string): string => {
    const sessionId = generateId();
    const session: EditingSession = {
      id: sessionId,
      startedAt: Date.now(),
      prompt,
      model,
      status: "generating",
      progress: 0,
    };
    
    batch(() => {
      setState("isActive", true);
      setState("session", session);
      setState("pendingChanges", new Map());
      setState("expandedFiles", new Set());
      setState("selectedChangeId", null);
    });
    
    window.dispatchEvent(
      new CustomEvent("chat-editing:session-started", {
        detail: { sessionId, prompt, model },
      })
    );
    
    return sessionId;
  };

  const endSession = () => {
    const sessionId = state.session?.id;
    
    batch(() => {
      setState("isActive", false);
      setState("session", null);
      setState("pendingChanges", new Map());
      setState("workingSet", new Set());
      setState("expandedFiles", new Set());
      setState("selectedChangeId", null);
    });
    
    if (sessionId) {
      window.dispatchEvent(
        new CustomEvent("chat-editing:session-ended", {
          detail: { sessionId },
        })
      );
    }
  };

  const cancelSession = () => {
    if (!state.session) return;
    
    setState("session", "status", "cancelled");
    
    window.dispatchEvent(
      new CustomEvent("chat-editing:session-cancelled", {
        detail: { sessionId: state.session.id },
      })
    );
  };

  const addChange = (change: Omit<FileChange, "id" | "status">): string => {
    const changeId = generateId();
    const fileName = change.filePath.split("/").pop() || change.filePath.split("\\").pop() || change.filePath;
    const { added, removed } = countDiffLines(change.patch);
    
    const fullChange: FileChange = {
      ...change,
      id: changeId,
      fileName,
      status: "pending",
      language: change.language || detectLanguage(fileName),
      lineCount: countLines(change.proposedContent),
      addedLines: added,
      removedLines: removed,
    };
    
    setState("pendingChanges", (prev) => {
      const next = new Map(prev);
      next.set(changeId, fullChange);
      return next;
    });
    
    setState("workingSet", (prev) => {
      const next = new Set(prev);
      next.add(change.filePath);
      return next;
    });
    
    setState("expandedFiles", (prev) => {
      const next = new Set(prev);
      next.add(change.filePath);
      return next;
    });
    
    window.dispatchEvent(
      new CustomEvent("chat-editing:change-added", {
        detail: { changeId, filePath: change.filePath },
      })
    );
    
    return changeId;
  };

  const removeChange = (changeId: string) => {
    const change = state.pendingChanges.get(changeId);
    if (!change) return;
    
    setState("pendingChanges", (prev) => {
      const next = new Map(prev);
      next.delete(changeId);
      return next;
    });
    
    const remainingChangesForFile = Array.from(state.pendingChanges.values()).filter(
      (c) => c.filePath === change.filePath && c.id !== changeId
    );
    
    if (remainingChangesForFile.length === 0) {
      setState("workingSet", (prev) => {
        const next = new Set(prev);
        next.delete(change.filePath);
        return next;
      });
    }
    
    if (state.selectedChangeId === changeId) {
      setState("selectedChangeId", null);
    }
  };

  const acceptChange = (changeId: string) => {
    const change = state.pendingChanges.get(changeId);
    if (!change) return;
    
    setState("pendingChanges", (prev) => {
      const next = new Map(prev);
      next.set(changeId, { ...change, status: "accepted" });
      return next;
    });
    
    window.dispatchEvent(
      new CustomEvent("chat-editing:change-accepted", {
        detail: { changeId, filePath: change.filePath },
      })
    );
  };

  const rejectChange = (changeId: string) => {
    const change = state.pendingChanges.get(changeId);
    if (!change) return;
    
    setState("pendingChanges", (prev) => {
      const next = new Map(prev);
      next.set(changeId, { ...change, status: "rejected" });
      return next;
    });
    
    window.dispatchEvent(
      new CustomEvent("chat-editing:change-rejected", {
        detail: { changeId, filePath: change.filePath },
      })
    );
  };

  const acceptAll = () => {
    setState("pendingChanges", (prev) => {
      const next = new Map(prev);
      for (const [id, change] of next) {
        if (change.status === "pending") {
          next.set(id, { ...change, status: "accepted" });
        }
      }
      return next;
    });
    
    window.dispatchEvent(
      new CustomEvent("chat-editing:all-accepted", {
        detail: { sessionId: state.session?.id },
      })
    );
  };

  const rejectAll = () => {
    setState("pendingChanges", (prev) => {
      const next = new Map(prev);
      for (const [id, change] of next) {
        if (change.status === "pending") {
          next.set(id, { ...change, status: "rejected" });
        }
      }
      return next;
    });
    
    window.dispatchEvent(
      new CustomEvent("chat-editing:all-rejected", {
        detail: { sessionId: state.session?.id },
      })
    );
  };

  const applyAccepted = async (): Promise<void> => {
    if (!state.session) return;
    
    setState("session", "status", "applying");
    
    const acceptedChanges = Array.from(state.pendingChanges.values()).filter(
      (change) => change.status === "accepted"
    );
    
    if (acceptedChanges.length === 0) {
      setState("session", "status", "completed");
      return;
    }
    
    const errors: string[] = [];
    
    for (let i = 0; i < acceptedChanges.length; i++) {
      const change = acceptedChanges[i];
      setState("session", "progress", ((i + 1) / acceptedChanges.length) * 100);
      setState("session", "currentFile", change.fileName);
      
      try {
        await fsWriteFile(change.filePath, change.proposedContent);
        
        window.dispatchEvent(
          new CustomEvent("chat-editing:change-applied", {
            detail: { changeId: change.id, filePath: change.filePath },
          })
        );
        
        window.dispatchEvent(
          new CustomEvent("cortex:file_saved", {
            detail: { path: change.filePath },
          })
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${change.fileName}: ${message}`);
      }
    }
    
    if (errors.length > 0) {
      setState("session", "error", `Failed to apply some changes:\n${errors.join("\n")}`);
      setState("session", "status", "ready");
    } else {
      setState("session", "status", "completed");
      
      window.dispatchEvent(
        new CustomEvent("chat-editing:session-completed", {
          detail: { sessionId: state.session.id, appliedCount: acceptedChanges.length },
        })
      );
    }
  };

  const discardSession = () => {
    if (!state.session) return;
    
    const sessionId = state.session.id;
    
    batch(() => {
      setState("isActive", false);
      setState("session", null);
      setState("pendingChanges", new Map());
      setState("expandedFiles", new Set());
      setState("selectedChangeId", null);
    });
    
    window.dispatchEvent(
      new CustomEvent("chat-editing:session-discarded", {
        detail: { sessionId },
      })
    );
  };

  const updateProgress = (progress: number, currentFile?: string) => {
    if (!state.session) return;
    
    batch(() => {
      setState("session", "progress", Math.min(100, Math.max(0, progress)));
      if (currentFile !== undefined) {
        setState("session", "currentFile", currentFile);
      }
    });
  };

  const setSessionStatus = (status: EditingSession["status"]) => {
    if (!state.session) return;
    setState("session", "status", status);
  };

  const setSessionError = (error: string) => {
    if (!state.session) return;
    batch(() => {
      setState("session", "error", error);
      setState("session", "status", "ready");
    });
  };

  const addToWorkingSet = (filePath: string) => {
    setState("workingSet", (prev) => {
      const next = new Set(prev);
      next.add(filePath);
      return next;
    });
  };

  const removeFromWorkingSet = (filePath: string) => {
    setState("workingSet", (prev) => {
      const next = new Set(prev);
      next.delete(filePath);
      return next;
    });
  };

  const clearWorkingSet = () => {
    setState("workingSet", new Set());
  };

  const toggleFileExpanded = (filePath: string) => {
    setState("expandedFiles", (prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const setSelectedChange = (changeId: string | null) => {
    setState("selectedChangeId", changeId);
  };

  const getChangesByFile = (filePath: string): FileChange[] => {
    return Array.from(state.pendingChanges.values()).filter(
      (change) => change.filePath === filePath
    );
  };

  const getPendingCount = (): number => {
    return Array.from(state.pendingChanges.values()).filter(
      (change) => change.status === "pending"
    ).length;
  };

  const getAcceptedCount = (): number => {
    return Array.from(state.pendingChanges.values()).filter(
      (change) => change.status === "accepted"
    ).length;
  };

  const getRejectedCount = (): number => {
    return Array.from(state.pendingChanges.values()).filter(
      (change) => change.status === "rejected"
    ).length;
  };

  const getTotalStats = (): { files: number; added: number; removed: number } => {
    const changes = Array.from(state.pendingChanges.values());
    const files = new Set(changes.map((c) => c.filePath)).size;
    const added = changes.reduce((sum, c) => sum + c.addedLines, 0);
    const removed = changes.reduce((sum, c) => sum + c.removedLines, 0);
    return { files, added, removed };
  };

  const contextValue: ChatEditingContextValue = {
    state,
    startSession,
    endSession,
    cancelSession,
    addChange,
    removeChange,
    acceptChange,
    rejectChange,
    acceptAll,
    rejectAll,
    applyAccepted,
    discardSession,
    updateProgress,
    setSessionStatus,
    setSessionError,
    addToWorkingSet,
    removeFromWorkingSet,
    clearWorkingSet,
    toggleFileExpanded,
    setSelectedChange,
    getChangesByFile,
    getPendingCount,
    getAcceptedCount,
    getRejectedCount,
    getTotalStats,
  };

  return (
    <ChatEditingContext.Provider value={contextValue}>
      {props.children}
    </ChatEditingContext.Provider>
  );
}

export function useChatEditing(): ChatEditingContextValue {
  const context = useContext(ChatEditingContext);
  if (!context) {
    throw new Error("useChatEditing must be used within ChatEditingProvider");
  }
  return context;
}
