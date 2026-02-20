import {
  createContext,
  useContext,
  createSignal,
  JSX,
  onMount,
  onCleanup,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import {
  fsReadFile,
  fsWriteFile,
  fsCreateDirectory,
  fsDeleteFile,
  fsDeleteDirectory,
  fsMove,
  fsTrash,
  fsCopyFile,
  fsListDirectory,
  fsExists,
} from "../utils/tauri-api";
import { generateUniquePath, dirname, basename, extname, joinPath } from "../utils/fileUtils";

// ============================================================================
// Types
// ============================================================================

export interface FileOperationData {
  originalPath: string;
  newPath?: string;
  content?: string;
  isDirectory?: boolean;
}

export interface FileOperation {
  id: string;
  type: "delete" | "rename" | "move" | "create" | "copy";
  timestamp: number;
  data: FileOperationData;
}

interface FileOperationsContextValue {
  /** Get the current operation history */
  operationHistory: () => FileOperation[];
  
  /** Check if there are operations to undo */
  canUndo: () => boolean;
  
  /** Get the last operation (for display purposes) */
  lastOperation: () => FileOperation | undefined;
  
  /** Record a file operation for undo */
  recordOperation: (op: Omit<FileOperation, "id" | "timestamp">) => void;
  
  /** Undo the last file operation */
  undoLastOperation: () => Promise<boolean>;
  
  /** Clear all operation history */
  clearHistory: () => void;
  
  // High-level file operations with automatic undo recording
  /** Delete a file or directory with undo support */
  deleteWithUndo: (path: string, isDirectory?: boolean) => Promise<void>;
  
  /** Rename a file or directory with undo support */
  renameWithUndo: (oldPath: string, newPath: string) => Promise<void>;
  
  /** Move a file or directory with undo support */
  moveWithUndo: (sourcePath: string, destPath: string) => Promise<void>;
  
  /** Create a file with undo support */
  createFileWithUndo: (path: string, content?: string) => Promise<void>;
  
  /** Create a directory with undo support */
  createDirectoryWithUndo: (path: string) => Promise<void>;
  
  /** Copy a file with undo support (auto-generates unique name if destination exists) */
  copyWithUndo: (sourcePath: string, destPath: string) => Promise<string>;
  
  /** Duplicate a file or directory in place with undo support */
  duplicateWithUndo: (sourcePath: string, isDirectory?: boolean) => Promise<string>;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_HISTORY = 50;
const MAX_FILE_SIZE_FOR_UNDO = 10 * 1024 * 1024; // 10MB - don't store content for large files
const MAX_DUPLICATE_COUNTER = 1000;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a duplicate name with " copy" suffix.
 * For "file.txt" → "file copy.txt", "file copy (1).txt", etc.
 * For "folder" → "folder copy", "folder copy (1)", etc.
 */
async function generateDuplicatePath(sourcePath: string, isDirectory: boolean): Promise<string> {
  const dir = dirname(sourcePath);
  const ext = isDirectory ? "" : extname(sourcePath);
  const nameWithoutExt = basename(sourcePath, ext);
  
  // First try "name copy.ext" or "name copy"
  let copyName = `${nameWithoutExt} copy${ext}`;
  let copyPath = joinPath(dir, copyName);
  
  try {
    const exists = await fsExists(copyPath);
    if (!exists) {
      return copyPath;
    }
  } catch (err) {
    console.debug("[FileOperations] Existence check failed:", err);
    return copyPath;
  }
  
  // If that exists, try "name copy (1).ext", "name copy (2).ext", etc.
  let counter = 1;
  do {
    copyName = `${nameWithoutExt} copy (${counter})${ext}`;
    copyPath = joinPath(dir, copyName);
    counter++;
    
    try {
      const exists = await fsExists(copyPath);
      if (!exists) {
        return copyPath;
      }
    } catch (err) {
      console.debug("[FileOperations] Existence check failed:", err);
      return copyPath;
    }
  } while (counter < MAX_DUPLICATE_COUNTER);
  
  throw new Error(`Could not generate duplicate filename after ${MAX_DUPLICATE_COUNTER} attempts`);
}

/**
 * Recursively copy a directory and its contents
 */
async function copyDirectoryRecursive(sourcePath: string, destPath: string): Promise<void> {
  // Create the destination directory
  await fsCreateDirectory(destPath);
  
  // List contents of source directory
  const entries = await fsListDirectory(sourcePath);
  
  // Copy each entry
  for (const entry of entries) {
    const sourceEntryPath = entry.path;
    const destEntryPath = joinPath(destPath, entry.name);
    
    if (entry.isDirectory) {
      // Recursively copy subdirectory
      await copyDirectoryRecursive(sourceEntryPath, destEntryPath);
    } else {
      // Copy file
      await fsCopyFile(sourceEntryPath, destEntryPath);
    }
  }
}

// ============================================================================
// Context
// ============================================================================

const FileOperationsContext = createContext<FileOperationsContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function FileOperationsProvider(props: { children: JSX.Element }) {
  const [operationHistory, setOperationHistory] = createSignal<FileOperation[]>([]);

  // ============================================================================
  // Core Operations
  // ============================================================================

  const canUndo = () => operationHistory().length > 0;

  const lastOperation = () => {
    const history = operationHistory();
    return history.length > 0 ? history[history.length - 1] : undefined;
  };

  const recordOperation = (op: Omit<FileOperation, "id" | "timestamp">) => {
    const operation: FileOperation = {
      ...op,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    setOperationHistory((prev) => [...prev.slice(-MAX_HISTORY + 1), operation]);
  };

  const clearHistory = () => {
    setOperationHistory([]);
  };

  const undoLastOperation = async (): Promise<boolean> => {
    const history = operationHistory();
    if (history.length === 0) return false;

    const lastOp = history[history.length - 1];

    try {
      switch (lastOp.type) {
        case "delete": {
          // Restore deleted file/directory
          const { originalPath, content, isDirectory } = lastOp.data;
          if (isDirectory) {
            await fsCreateDirectory(originalPath);
          } else {
            // Create file with original content if available
            await invoke("fs_create_file", { path: originalPath });
            if (content) {
              await fsWriteFile(originalPath, content);
            }
          }
          break;
        }

        case "rename":
        case "move": {
          // Move back to original location
          const { originalPath, newPath } = lastOp.data;
          if (newPath) {
            await fsMove(newPath, originalPath);
          }
          break;
        }

        case "create": {
          // Delete the created file/directory
          const { originalPath, isDirectory } = lastOp.data;
          if (isDirectory) {
            await fsDeleteDirectory(originalPath, true);
          } else {
            await fsDeleteFile(originalPath);
          }
          break;
        }

        case "copy": {
          // Delete the copied file (the newPath is where the copy was created)
          const { newPath, isDirectory } = lastOp.data;
          if (newPath) {
            if (isDirectory) {
              await fsDeleteDirectory(newPath, true);
            } else {
              await fsDeleteFile(newPath);
            }
          }
          break;
        }

        default:
          console.warn(`Unknown operation type: ${(lastOp as FileOperation).type}`);
          return false;
      }

      // Remove the undone operation from history
      setOperationHistory((prev) => prev.slice(0, -1));

      // Emit event to refresh file explorer
      window.dispatchEvent(new CustomEvent("file-operation:undone", { detail: lastOp }));

      return true;
    } catch (error) {
      console.error("Failed to undo operation:", error);
      // Still remove from history since we can't undo it
      setOperationHistory((prev) => prev.slice(0, -1));
      throw error;
    }
  };

  // ============================================================================
  // High-level Operations with Undo Recording
  // ============================================================================

  const deleteWithUndo = async (path: string, isDirectory = false) => {
    let content: string | undefined;

    // Try to read file content for undo (only for files, not directories)
    if (!isDirectory) {
      try {
        // Check file size first to avoid reading huge files
        const metadata = await invoke<{ size: number }>("fs_get_metadata", { path });
        if (metadata.size <= MAX_FILE_SIZE_FOR_UNDO) {
          content = await fsReadFile(path);
        }
      } catch (e) {
        // File might be binary or unreadable, proceed without content
        console.warn("Could not read file content for undo:", e);
      }
    }

    // Record operation before deleting
    recordOperation({
      type: "delete",
      data: {
        originalPath: path,
        content,
        isDirectory,
      },
    });

    // Use trash if available (safer), fall back to permanent delete
    try {
      await fsTrash(path);
    } catch (e) {
      // If trash fails, try permanent delete
      if (isDirectory) {
        await fsDeleteDirectory(path, true);
      } else {
        await fsDeleteFile(path);
      }
    }
  };

  const renameWithUndo = async (oldPath: string, newPath: string) => {
    recordOperation({
      type: "rename",
      data: {
        originalPath: oldPath,
        newPath,
      },
    });

    await invoke("fs_rename", { oldPath, newPath });
  };

  const moveWithUndo = async (sourcePath: string, destPath: string) => {
    recordOperation({
      type: "move",
      data: {
        originalPath: sourcePath,
        newPath: destPath,
      },
    });

    await fsMove(sourcePath, destPath);
  };

  const createFileWithUndo = async (path: string, content = "") => {
    recordOperation({
      type: "create",
      data: {
        originalPath: path,
        isDirectory: false,
      },
    });

    await invoke("fs_create_file", { path });
    if (content) {
      await fsWriteFile(path, content);
    }
  };

  const createDirectoryWithUndo = async (path: string) => {
    recordOperation({
      type: "create",
      data: {
        originalPath: path,
        isDirectory: true,
      },
    });

    await fsCreateDirectory(path);
  };

  const copyWithUndo = async (sourcePath: string, destPath: string): Promise<string> => {
    // Generate unique path if destination exists
    const uniquePath = await generateUniquePath(destPath);
    
    recordOperation({
      type: "copy",
      data: {
        originalPath: sourcePath,
        newPath: uniquePath,
        isDirectory: false, // Currently only supports file copying
      },
    });

    await fsCopyFile(sourcePath, uniquePath);
    return uniquePath;
  };

  const duplicateWithUndo = async (sourcePath: string, isDirectory = false): Promise<string> => {
    // Generate a unique duplicate name with " copy" suffix
    const duplicatePath = await generateDuplicatePath(sourcePath, isDirectory);
    
    recordOperation({
      type: "copy",
      data: {
        originalPath: sourcePath,
        newPath: duplicatePath,
        isDirectory,
      },
    });

    if (isDirectory) {
      // Recursively copy the directory
      await copyDirectoryRecursive(sourcePath, duplicatePath);
    } else {
      // Copy the file
      await fsCopyFile(sourcePath, duplicatePath);
    }
    
    return duplicatePath;
  };

  // ============================================================================
  // Keyboard Shortcut Listener (Ctrl+Z for undo when not in editor)
  // ============================================================================

  onMount(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Check for Ctrl+Z (or Cmd+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        // Don't intercept if we're in an input, textarea, or editor
        const active = document.activeElement;
        const isEditable =
          active?.tagName === "INPUT" ||
          active?.tagName === "TEXTAREA" ||
          (active as HTMLElement)?.isContentEditable ||
          active?.closest(".cm-editor") || // CodeMirror editor
          active?.closest(".monaco-editor") || // Monaco editor
          active?.closest("[data-editor]"); // Generic editor marker

        if (isEditable) {
          return; // Let the editor handle undo
        }

        // Check if we have operations to undo
        if (canUndo()) {
          e.preventDefault();
          e.stopPropagation();

          try {
            const success = await undoLastOperation();
            if (success) {
              // Show a toast or notification
              window.dispatchEvent(
                new CustomEvent("toast:show", {
                  detail: {
                    message: "File operation undone",
                    variant: "success",
                  },
                })
              );
            }
          } catch (error) {
            window.dispatchEvent(
              new CustomEvent("toast:show", {
                detail: {
                  message: `Failed to undo: ${error}`,
                  variant: "error",
                },
              })
            );
          }
        }
      }
    };

    // Handle command palette undo event
    const handleUndoEvent = async () => {
      if (canUndo()) {
        try {
          const success = await undoLastOperation();
          if (success) {
            window.dispatchEvent(
              new CustomEvent("toast:show", {
                detail: {
                  message: "File operation undone",
                  variant: "success",
                },
              })
            );
          }
        } catch (error) {
          window.dispatchEvent(
            new CustomEvent("toast:show", {
              detail: {
                message: `Failed to undo: ${error}`,
                variant: "error",
              },
            })
          );
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("file-operation:undo", handleUndoEvent);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("file-operation:undo", handleUndoEvent);
    });
  });

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: FileOperationsContextValue = {
    operationHistory,
    canUndo,
    lastOperation,
    recordOperation,
    undoLastOperation,
    clearHistory,
    deleteWithUndo,
    renameWithUndo,
    moveWithUndo,
    createFileWithUndo,
    createDirectoryWithUndo,
    copyWithUndo,
    duplicateWithUndo,
  };

  return (
    <FileOperationsContext.Provider value={value}>
      {props.children}
    </FileOperationsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useFileOperations() {
  const context = useContext(FileOperationsContext);
  if (!context) {
    throw new Error("useFileOperations must be used within a FileOperationsProvider");
  }
  return context;
}
