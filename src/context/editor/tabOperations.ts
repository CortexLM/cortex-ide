import { batch } from "solid-js";
import { produce, type SetStoreFunction } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import type { OpenFile } from "../../types";
import type { EditorState } from "./editorTypes";
import { detectLanguage, generateId } from "./languageDetection";

export function savePinnedTabs(pinnedTabs: string[]): void {
  try {
    localStorage.setItem("cortex_pinned_tabs", JSON.stringify(pinnedTabs));
  } catch (e) {
    console.error("[EditorContext] Failed to save pinned tabs:", e);
  }
}

export function loadPinnedTabs(): string[] {
  try {
    const stored = localStorage.getItem("cortex_pinned_tabs");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("[EditorContext] Failed to load pinned tabs:", e);
  }
  return [];
}

export function createTabOperations(
  state: EditorState,
  setState: SetStoreFunction<EditorState>,
) {
  const pinTab = (tabId: string) => {
    if (state.pinnedTabs.includes(tabId)) return;
    
    const newPinnedTabs = [...state.pinnedTabs, tabId];
    setState("pinnedTabs", newPinnedTabs);
    savePinnedTabs(newPinnedTabs);
  };

  const unpinTab = (tabId: string) => {
    if (!state.pinnedTabs.includes(tabId)) return;
    
    const newPinnedTabs = state.pinnedTabs.filter((id) => id !== tabId);
    setState("pinnedTabs", newPinnedTabs);
    savePinnedTabs(newPinnedTabs);
  };

  const togglePinTab = (tabId: string) => {
    if (state.pinnedTabs.includes(tabId)) {
      unpinTab(tabId);
    } else {
      pinTab(tabId);
    }
  };

  const isTabPinned = (tabId: string): boolean => {
    return state.pinnedTabs.includes(tabId);
  };

  const isPreviewTab = (tabId: string): boolean => {
    return state.previewTab === tabId;
  };

  const promotePreviewToPermanent = (fileId?: string) => {
    const targetId = fileId || state.previewTab;
    if (!targetId) return;
    
    if (state.previewTab === targetId) {
      setState("previewTab", null);
    }
  };

  const openPreview = async (path: string, groupId?: string) => {
    const targetGroupId = groupId || state.activeGroupId;
    
    const existing = state.openFiles.find((f) => f.path === path);
    if (existing) {
      batch(() => {
        setState("activeFileId", existing.id);
        setState("activeGroupId", targetGroupId);
        setState(
          "groups",
          (g) => g.id === targetGroupId,
          produce((group) => {
            if (!group.fileIds.includes(existing.id)) {
              group.fileIds.push(existing.id);
            }
            group.activeFileId = existing.id;
          })
        );
      });
      return;
    }

    setState("isOpening", true);
    try {
      const content = await invoke<string>("fs_read_file", { path });
      const name = path.split(/[/\\]/).pop() || path;
      
      if (state.previewTab) {
        const previewFileIndex = state.openFiles.findIndex((f) => f.id === state.previewTab);
        if (previewFileIndex !== -1) {
          const previewId = state.previewTab;
          batch(() => {
            setState("openFiles", previewFileIndex, {
              id: previewId,
              path,
              name,
              content,
              language: detectLanguage(name),
              modified: false,
              cursors: [{ line: 1, column: 1 }],
              selections: [],
            });
            setState("activeFileId", previewId);
            setState("activeGroupId", targetGroupId);
            setState(
              "groups",
              (g) => g.id === targetGroupId,
              produce((group) => {
                if (!group.fileIds.includes(previewId)) {
                  group.fileIds.push(previewId);
                }
                group.activeFileId = previewId;
              })
            );
          });
          return;
        }
      }

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
        setState("activeGroupId", targetGroupId);
        setState("previewTab", id);
        setState(
          "groups",
          (g) => g.id === targetGroupId,
          produce((group) => {
            group.fileIds.push(id);
            group.activeFileId = id;
          })
        );
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Failed to open preview file:", errorMessage);
      
      window.dispatchEvent(
        new CustomEvent("notification", {
          detail: {
            type: "error",
            title: "Failed to open file",
            message: `Could not open "${path.split("/").pop() || path.split("\\").pop() || path}": ${errorMessage}`,
          },
        })
      );
    } finally {
      setState("isOpening", false);
    }
  };

  const reorderTabs = (sourceFileId: string, targetFileId: string, groupId?: string) => {
    const sourceGroup = state.groups.find((g) => g.fileIds.includes(sourceFileId));
    if (!sourceGroup) return;
    
    const targetGroupId = groupId || sourceGroup.id;
    const targetGroup = state.groups.find((g) => g.id === targetGroupId);
    if (!targetGroup) return;
    
    const fileIds = [...targetGroup.fileIds];
    
    const sourceIndex = fileIds.indexOf(sourceFileId);
    const targetIndex = fileIds.indexOf(targetFileId);
    
    if (sourceIndex === -1 || targetIndex === -1) return;
    if (sourceIndex === targetIndex) return;
    
    fileIds.splice(sourceIndex, 1);
    fileIds.splice(targetIndex, 0, sourceFileId);
    
    setState(
      "groups",
      (g) => g.id === targetGroupId,
      "fileIds",
      fileIds
    );
  };

  return {
    pinTab,
    unpinTab,
    togglePinTab,
    isTabPinned,
    isPreviewTab,
    promotePreviewToPermanent,
    openPreview,
    reorderTabs,
  };
}
