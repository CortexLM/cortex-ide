import {
  createContext,
  useContext,
  ParentProps,
  createMemo,
  Accessor,
} from "solid-js";
import { createStore, produce } from "solid-js/store";

// ============================================================================
// Types - Re-exported from centralized types for backward compatibility
// ============================================================================

import type {
  SplitDirection,
  EditorGroup,
  EditorSplit,
  EditorLayout,
} from "../../types";

// Re-export types for backward compatibility with existing imports
export type { SplitDirection, EditorGroup, EditorSplit, EditorLayout };

// ============================================================================
// State
// ============================================================================

export interface EditorUIState {
  activeGroupId: string;
  groups: EditorGroup[];
  splits: EditorSplit[];
  maximizedGroupId: string | null;
}

const DEFAULT_GROUP_ID = "group-default";

// ============================================================================
// Context Value
// ============================================================================

export interface EditorUIContextValue {
  // State accessors (granular)
  activeGroupId: Accessor<string>;
  groups: Accessor<EditorGroup[]>;
  splits: Accessor<EditorSplit[]>;
  activeGroup: Accessor<EditorGroup | undefined>;
  groupCount: Accessor<number>;
  isSplit: Accessor<boolean>;

  // Group operations
  setActiveGroup: (groupId: string) => void;
  splitEditor: (direction: SplitDirection, activeFileId: string | null) => string;
  closeGroup: (groupId: string) => void;
  unsplit: () => void;

  // File-to-group operations
  addFileToGroup: (fileId: string, groupId: string) => void;
  removeFileFromGroup: (fileId: string, groupId: string) => void;
  moveFileToGroup: (fileId: string, sourceGroupId: string, targetGroupId: string) => void;
  setGroupActiveFile: (groupId: string, fileId: string | null) => void;
  reorderTabs: (sourceFileId: string, targetFileId: string, groupId: string) => void;
  getGroupFiles: (groupId: string) => string[];
  findGroupContainingFile: (fileId: string) => EditorGroup | undefined;

  // Group locking
  lockGroup: (groupId: string) => void;
  unlockGroup: (groupId: string) => void;
  isGroupLocked: (groupId: string) => boolean;

  // Group labeling
  setGroupLabel: (groupId: string, label: string) => void;
  getGroupLabel: (groupId: string) => string | undefined;

  // Recently closed editors
  addRecentlyClosed: (groupId: string, fileUri: string) => void;
  getRecentlyClosed: (groupId: string) => string[];
  reopenLastClosed: (groupId: string) => string | undefined;

  // Keyboard navigation
  focusGroup: (index: number) => void;

  // Maximize group
  maximizeGroup: (groupId: string) => void;
  restoreGroups: () => void;
  isGroupMaximized: () => boolean;
  maximizedGroupId: Accessor<string | null>;

  // Equalize splits
  equalizeSplits: () => void;

  // Grid layout presets
  createGridLayout: (preset: "2x2" | "3x2" | "2x1" | "3x1") => void;
  updateSplitRatio: (splitId: string, ratio: number) => void;

  // Internal for composition
  _state: EditorUIState;
  _setState: (fn: (state: EditorUIState) => void) => void;
}

// ============================================================================
// Extracted operations
// ============================================================================

import { createGroupOps } from "./editorGroupOps";
import { createGridLayoutOps } from "./editorGridLayout";

// ============================================================================
// Context
// ============================================================================

const EditorUIContext = createContext<EditorUIContextValue>();

export function EditorUIProvider(props: ParentProps) {
  const [state, setState] = createStore<EditorUIState>({
    activeGroupId: DEFAULT_GROUP_ID,
    groups: [
      {
        id: DEFAULT_GROUP_ID,
        fileIds: [],
        activeFileId: null,
        splitRatio: 1,
      },
    ],
    splits: [],
    maximizedGroupId: null,
  });

  // Granular selectors
  const activeGroupId = createMemo(() => state.activeGroupId);
  const groups = createMemo(() => state.groups);
  const splits = createMemo(() => state.splits);
  const activeGroup = createMemo(() =>
    state.groups.find((g) => g.id === state.activeGroupId)
  );
  const groupCount = createMemo(() => state.groups.length);
  const isSplit = createMemo(() => state.groups.length > 1);
  const maximizedGroupId = createMemo(() => state.maximizedGroupId);

  const setActiveGroup = (groupId: string) => {
    setState("activeGroupId", groupId);
  };

  const groupOps = createGroupOps(state, setState);
  const gridLayoutOps = createGridLayoutOps(state, setState);

  const addFileToGroup = (fileId: string, groupId: string) => {
    setState(
      "groups",
      (g) => g.id === groupId,
      produce((group) => {
        if (!group.fileIds.includes(fileId)) {
          group.fileIds.push(fileId);
        }
        group.activeFileId = fileId;
      })
    );
  };

  const removeFileFromGroup = (fileId: string, groupId: string) => {
    setState(
      "groups",
      (g) => g.id === groupId,
      produce((group) => {
        const fileIdIndex = group.fileIds.indexOf(fileId);
        if (fileIdIndex === -1) return;

        if (!group.recentlyClosed) group.recentlyClosed = [];
        group.recentlyClosed.push(fileId);

        group.fileIds = group.fileIds.filter((id) => id !== fileId);
        if (group.activeFileId === fileId) {
          group.activeFileId = group.fileIds[Math.max(0, fileIdIndex - 1)] || null;
        }
      })
    );
  };

  const setGroupActiveFile = (groupId: string, fileId: string | null) => {
    setState("groups", (g) => g.id === groupId, "activeFileId", fileId);
  };

  const reorderTabs = (
    sourceFileId: string,
    targetFileId: string,
    groupId: string
  ) => {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return;

    const fileIds = [...group.fileIds];
    const sourceIndex = fileIds.indexOf(sourceFileId);
    const targetIndex = fileIds.indexOf(targetFileId);

    if (sourceIndex === -1 || targetIndex === -1) return;
    if (sourceIndex === targetIndex) return;

    fileIds.splice(sourceIndex, 1);
    fileIds.splice(targetIndex, 0, sourceFileId);

    setState("groups", (g) => g.id === groupId, "fileIds", fileIds);
  };

  const getGroupFiles = (groupId: string): string[] => {
    const group = state.groups.find((g) => g.id === groupId);
    return group?.fileIds || [];
  };

  const findGroupContainingFile = (fileId: string): EditorGroup | undefined => {
    return state.groups.find((g) => g.fileIds.includes(fileId));
  };

  // Internal methods for composition
  const _setState = (fn: (state: EditorUIState) => void) => {
    setState(produce(fn));
  };

  const value: EditorUIContextValue = {
    activeGroupId,
    groups,
    splits,
    activeGroup,
    groupCount,
    isSplit,
    setActiveGroup,
    splitEditor: groupOps.splitEditor,
    closeGroup: groupOps.closeGroup,
    unsplit: groupOps.unsplit,
    addFileToGroup,
    removeFileFromGroup,
    moveFileToGroup: groupOps.moveFileToGroup,
    setGroupActiveFile,
    reorderTabs,
    getGroupFiles,
    findGroupContainingFile,
    lockGroup: groupOps.lockGroup,
    unlockGroup: groupOps.unlockGroup,
    isGroupLocked: groupOps.isGroupLocked,
    setGroupLabel: groupOps.setGroupLabel,
    getGroupLabel: groupOps.getGroupLabel,
    addRecentlyClosed: groupOps.addRecentlyClosed,
    getRecentlyClosed: groupOps.getRecentlyClosed,
    reopenLastClosed: groupOps.reopenLastClosed,
    focusGroup: groupOps.focusGroup,
    maximizeGroup: groupOps.maximizeGroup,
    restoreGroups: groupOps.restoreGroups,
    isGroupMaximized: groupOps.isGroupMaximized,
    maximizedGroupId,
    equalizeSplits: groupOps.equalizeSplits,
    createGridLayout: gridLayoutOps.createGridLayout,
    updateSplitRatio: gridLayoutOps.updateSplitRatio,
    _state: state,
    _setState,
  };

  return (
    <EditorUIContext.Provider value={value}>
      {props.children}
    </EditorUIContext.Provider>
  );
}

export function useEditorUI() {
  const context = useContext(EditorUIContext);
  if (!context) {
    throw new Error("useEditorUI must be used within EditorUIProvider");
  }
  return context;
}
