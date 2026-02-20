import { onMount, onCleanup } from "solid-js";
import type { SplitDirection } from "../../types";
import type { EditorState } from "./editorTypes";

interface EventOperations {
  splitEditorInGrid: (direction: "horizontal" | "vertical") => void;
  splitEditor: (direction: SplitDirection) => void;
  setActiveFile: (fileId: string) => void;
  openFile: (path: string, groupId?: string) => Promise<void>;
  saveFile: (fileId: string) => Promise<void>;
}

export function setupEventHandlers(
  state: EditorState,
  operations: EventOperations,
) {
  onMount(() => {
    const handleSplitRight = () => {
      if (state.useGridLayout) {
        operations.splitEditorInGrid("vertical");
      } else {
        operations.splitEditor("vertical");
      }
    };

    const handleSplitDown = () => {
      if (state.useGridLayout) {
        operations.splitEditorInGrid("horizontal");
      } else {
        operations.splitEditor("horizontal");
      }
    };

    const handleEditorSplit = (e: CustomEvent<{ direction: "vertical" | "horizontal" }>) => {
      if (state.useGridLayout) {
        operations.splitEditorInGrid(e.detail.direction);
      } else {
        operations.splitEditor(e.detail.direction);
      }
    };

    const handleNextTab = () => {
      const files = state.openFiles;
      if (files.length < 2) return;
      const currentIndex = files.findIndex(f => f.id === state.activeFileId);
      const nextIndex = (currentIndex + 1) % files.length;
      operations.setActiveFile(files[nextIndex].id);
    };

    const handlePrevTab = () => {
      const files = state.openFiles;
      if (files.length < 2) return;
      const currentIndex = files.findIndex(f => f.id === state.activeFileId);
      const prevIndex = currentIndex <= 0 ? files.length - 1 : currentIndex - 1;
      operations.setActiveFile(files[prevIndex].id);
    };

    const handleGetSelectionForTerminal = () => {
      window.dispatchEvent(new CustomEvent("monaco:get-selection-for-terminal"));
    };

    const handleGetActiveFileForTerminal = () => {
      const activeFile = state.openFiles.find(f => f.id === state.activeFileId);
      if (activeFile && activeFile.path && !activeFile.path.startsWith("virtual://")) {
        window.dispatchEvent(new CustomEvent("editor:active-file-for-terminal", {
          detail: { filePath: activeFile.path }
        }));
      } else {
        window.dispatchEvent(new CustomEvent("notification", {
          detail: {
            type: "warning",
            title: "No file to run",
            message: "Please open a file first to run it in the terminal.",
          }
        }));
      }
    };

    const handleTerminalRunActiveFile = () => {
      const activeFile = state.openFiles.find(f => f.id === state.activeFileId);
      if (activeFile && activeFile.path && !activeFile.path.startsWith("virtual://")) {
        window.dispatchEvent(new CustomEvent("terminal:run-active-file", {
          detail: { filePath: activeFile.path }
        }));
      } else {
        window.dispatchEvent(new CustomEvent("notification", {
          detail: {
            type: "warning",
            title: "No file to run",
            message: "Please open a file first to run it in the terminal.",
          }
        }));
      }
    };

    const handleEditorGoto = async (e: CustomEvent<{ file?: string; path?: string; line?: number; column?: number; focus?: boolean }>) => {
      const filePath = e.detail.file || e.detail.path;
      if (!filePath) return;
      await operations.openFile(filePath);
      if (e.detail.line) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("editor:goto-line", {
            detail: { line: e.detail.line, column: e.detail.column || 1 },
          }));
        }, 50);
      }
    };

    const handleEditorOpenFile = async (e: CustomEvent<{ path: string; line?: number; column?: number }>) => {
      if (!e.detail?.path) return;
      await operations.openFile(e.detail.path);
      if (e.detail.line) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("editor:goto-line", {
            detail: { line: e.detail.line, column: e.detail.column || 1 },
          }));
        }, 50);
      }
    };

    const handleFileSave = () => {
      const activeFile = state.openFiles.find(f => f.id === state.activeFileId);
      if (activeFile) {
        operations.saveFile(activeFile.id);
      }
    };

    const handleFileSaveAll = () => {
      const modifiedFiles = state.openFiles.filter(f => f.modified);
      for (const file of modifiedFiles) {
        operations.saveFile(file.id);
      }
    };

    window.addEventListener("editor-split", handleEditorSplit as EventListener);
    window.addEventListener("editor:split-right", handleSplitRight);
    window.addEventListener("editor:split-down", handleSplitDown);
    window.addEventListener("editor:next-tab", handleNextTab);
    window.addEventListener("editor:prev-tab", handlePrevTab);
    window.addEventListener("editor:get-selection-for-terminal", handleGetSelectionForTerminal);
    window.addEventListener("editor:get-active-file-for-terminal", handleGetActiveFileForTerminal);
    window.addEventListener("terminal:run-active-file", handleTerminalRunActiveFile);
    window.addEventListener("editor:goto", handleEditorGoto as unknown as EventListener);
    window.addEventListener("editor:open-file", handleEditorOpenFile as unknown as EventListener);
    window.addEventListener("file:save", handleFileSave);
    window.addEventListener("file:save-all", handleFileSaveAll);

    onCleanup(() => {
      window.removeEventListener("editor-split", handleEditorSplit as EventListener);
      window.removeEventListener("editor:split-right", handleSplitRight);
      window.removeEventListener("editor:split-down", handleSplitDown);
      window.removeEventListener("editor:next-tab", handleNextTab);
      window.removeEventListener("editor:prev-tab", handlePrevTab);
      window.removeEventListener("editor:get-selection-for-terminal", handleGetSelectionForTerminal);
      window.removeEventListener("editor:get-active-file-for-terminal", handleGetActiveFileForTerminal);
      window.removeEventListener("terminal:run-active-file", handleTerminalRunActiveFile);
      window.removeEventListener("editor:goto", handleEditorGoto as unknown as EventListener);
      window.removeEventListener("editor:open-file", handleEditorOpenFile as unknown as EventListener);
      window.removeEventListener("file:save", handleFileSave);
      window.removeEventListener("file:save-all", handleFileSaveAll);
    });
  });
}
