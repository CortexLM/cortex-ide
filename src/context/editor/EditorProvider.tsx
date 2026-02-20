import { createContext, useContext, ParentProps, createMemo, batch } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { loadGridState } from "../../utils/gridSerializer";
import type { OpenFile, EditorGroup, EditorSplit, SplitDirection } from "../../types";
import type {
  EditorState,
  EditorContextValue,
  MinimapSettings,
  BreadcrumbSymbolPath,
  RecentlyClosedEntry,
} from "./editorTypes";
import { generateId } from "./languageDetection";
import { createFileOperations } from "./fileOperations";
import { loadPinnedTabs, createTabOperations } from "./tabOperations";
import { loadUseGridLayout, createGridOperations } from "./gridOperations";
import { setupEventHandlers } from "./eventHandlers";
import { useSettings } from "@/context/SettingsContext";

const EditorContext = createContext<EditorContextValue>();

export function EditorProvider(props: ParentProps) {
  const defaultGroupId = "group-default";

  const [state, setState] = createStore<EditorState>({
    openFiles: [],
    activeFileId: null,
    activeGroupId: defaultGroupId,
    groups: [
      {
        id: defaultGroupId,
        fileIds: [],
        activeFileId: null,
        splitRatio: 1,
      },
    ],
    splits: [],
    cursorCount: 1,
    selectionCount: 0,
    isOpening: false,
    pinnedTabs: loadPinnedTabs(),
    previewTab: null,
    gridState: loadGridState(),
    useGridLayout: loadUseGridLayout(),
    minimapSettings: {
      enabled: true,
      side: "right",
      showSlider: "mouseover",
      renderCharacters: true,
      maxColumn: 80,
      scale: 1,
      sizeMode: "proportional",
    },
    breadcrumbSymbolPath: [],
    groupLockState: {},
    groupNames: {},
    recentlyClosedStack: [],
  });

  let savedSplitRatios: Record<string, number> | null = null;

  const selectors = {
    openFileCount: createMemo(() => state.openFiles.length),
    activeFile: createMemo(() => state.openFiles.find((f) => f.id === state.activeFileId)),
    hasModifiedFiles: createMemo(() => state.openFiles.some((f) => f.modified)),
    modifiedFileIds: createMemo(() => state.openFiles.filter((f) => f.modified).map((f) => f.id)),
    isSplit: createMemo(() => state.groups.length > 1),
    groupCount: createMemo(() => state.groups.length),
    pinnedTabIds: createMemo(() => state.pinnedTabs),
    previewTabId: createMemo(() => state.previewTab),
    gridState: createMemo(() => state.gridState),
    useGridLayout: createMemo(() => state.useGridLayout),
    minimapSettings: createMemo(() => state.minimapSettings),
    breadcrumbSymbolPath: createMemo(() => state.breadcrumbSymbolPath),
    isGroupLocked: (groupId: string) => !!state.groupLockState[groupId],
    groupName: (groupId: string) => state.groupNames[groupId],
    recentlyClosedStack: createMemo(() => state.recentlyClosedStack),
  };

  const fileOps = createFileOperations(state, setState);
  const tabOps = createTabOperations(state, setState);
  const gridOps = createGridOperations(state, setState);

  const splitEditor = (direction: SplitDirection) => {
    const activeGroup = state.groups.find((g) => g.id === state.activeGroupId);
    if (!activeGroup || activeGroup.fileIds.length === 0) return;

    const newGroupId = `group-${generateId()}`;
    const splitId = `split-${generateId()}`;
    
    const activeFileId = activeGroup.activeFileId;
    
    const newGroup: EditorGroup = {
      id: newGroupId,
      fileIds: activeFileId ? [activeFileId] : [],
      activeFileId: activeFileId,
      splitRatio: 0.5,
    };

    const newSplit: EditorSplit = {
      id: splitId,
      direction,
      firstGroupId: state.activeGroupId,
      secondGroupId: newGroupId,
      ratio: 0.5,
    };

    batch(() => {
      setState("groups", (groups) => [...groups, newGroup]);
      setState("splits", (splits) => [...splits, newSplit]);
      setState("activeGroupId", newGroupId);
    });
  };

  const closeGroup = (groupId: string) => {
    if (state.groups.length <= 1) return;
    
    const splitIndex = state.splits.findIndex(
      (s) => s.firstGroupId === groupId || s.secondGroupId === groupId
    );
    
    batch(() => {
      if (splitIndex !== -1) {
        setState("splits", (splits) => splits.filter((_, i) => i !== splitIndex));
      }
      
      setState("groups", (groups) => groups.filter((g) => g.id !== groupId));
      
      if (state.activeGroupId === groupId) {
        const remainingGroup = state.groups.find((g) => g.id !== groupId);
        if (remainingGroup) {
          setState("activeGroupId", remainingGroup.id);
          setState("activeFileId", remainingGroup.activeFileId);
        }
      }
    });
  };

  const setActiveGroup = (groupId: string) => {
    const group = state.groups.find((g) => g.id === groupId);
    
    batch(() => {
      setState("activeGroupId", groupId);
      if (group?.activeFileId) {
        setState("activeFileId", group.activeFileId);
      }
    });
  };

  const moveFileToGroup = (fileId: string, targetGroupId: string) => {
    const sourceGroup = state.groups.find((g) => g.fileIds.includes(fileId));
    if (!sourceGroup || sourceGroup.id === targetGroupId) return;

    batch(() => {
      setState(
        "groups",
        (g) => g.id === sourceGroup.id,
        produce((group) => {
          group.fileIds = group.fileIds.filter((id) => id !== fileId);
          if (group.activeFileId === fileId) {
            group.activeFileId = group.fileIds[0] || null;
          }
        })
      );

      setState(
        "groups",
        (g) => g.id === targetGroupId,
        produce((group) => {
          group.fileIds.push(fileId);
          group.activeFileId = fileId;
        })
      );

      setState("activeGroupId", targetGroupId);
      setState("activeFileId", fileId);
    });
  };

  const updateCursorInfo = (cursorCount: number, selectionCount: number) => {
    batch(() => {
      setState("cursorCount", cursorCount);
      setState("selectionCount", selectionCount);
    });
  };

  const getActiveGroup = () => {
    return state.groups.find((g) => g.id === state.activeGroupId);
  };

  const getGroupFiles = (groupId: string) => {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return [];
    return group.fileIds
      .map((id) => state.openFiles.find((f) => f.id === id))
      .filter((f): f is OpenFile => f !== undefined);
  };

  const unsplit = () => {
    if (state.groups.length <= 1) return;
    
    const defaultGroup = state.groups[0];
    const allFileIds = new Set<string>();
    
    state.groups.forEach((group) => {
      group.fileIds.forEach((id) => allFileIds.add(id));
    });
    
    batch(() => {
      setState("groups", [
        {
          ...defaultGroup,
          fileIds: Array.from(allFileIds),
          activeFileId: state.activeFileId,
        },
      ]);
      setState("splits", []);
      setState("activeGroupId", defaultGroup.id);
    });
  };

  const updateSplitRatio = (splitId: string, ratio: number) => {
    const clampedRatio = Math.max(0.15, Math.min(0.85, ratio));
    setState(
      "splits",
      (s) => s.id === splitId,
      "ratio",
      clampedRatio
    );
  };

  const maximizeGroup = (groupId: string) => {
    savedSplitRatios = {};
    for (const group of state.groups) {
      savedSplitRatios[group.id] = group.splitRatio;
    }

    batch(() => {
      setState("groups", (g) => g.id === groupId, "splitRatio", 1);
      setState("groups", (g) => g.id !== groupId, "splitRatio", 0);
    });
  };

  const restoreGroup = (_groupId: string) => {
    if (savedSplitRatios) {
      const ratios = savedSplitRatios;
      savedSplitRatios = null;
      batch(() => {
        for (const group of state.groups) {
          const ratio = ratios[group.id];
          if (ratio !== undefined) {
            setState("groups", (g) => g.id === group.id, "splitRatio", ratio);
          }
        }
      });
    } else {
      equalizeGroups();
    }
  };

  const equalizeGroups = () => {
    const ratio = 1 / state.groups.length;
    batch(() => {
      setState("groups", () => true, "splitRatio", ratio);
      setState("splits", () => true, "ratio", 0.5);
    });
  };

  const lockGroup = (groupId: string) => {
    setState(
      "groupLockState",
      produce((locks) => {
        locks[groupId] = true;
      })
    );
  };

  const unlockGroup = (groupId: string) => {
    setState(
      "groupLockState",
      produce((locks) => {
        locks[groupId] = false;
      })
    );
  };

  const isGroupLocked = (groupId: string): boolean => {
    return !!state.groupLockState[groupId];
  };

  const setGroupName = (groupId: string, name: string) => {
    setState(
      "groupNames",
      produce((names) => {
        names[groupId] = name;
      })
    );
  };

  const getGroupName = (groupId: string): string | undefined => {
    return state.groupNames[groupId];
  };

  const reopenLastClosed = async (groupId?: string): Promise<void> => {
    const stack = state.recentlyClosedStack;
    if (stack.length === 0) return;

    const entry = stack[stack.length - 1];
    setState("recentlyClosedStack", (s) => s.slice(0, -1));

    await fileOps.openFile(entry.path, groupId || entry.groupId);
  };

  const getRecentlyClosed = (): RecentlyClosedEntry[] => {
    return state.recentlyClosedStack;
  };

  const updateMinimapSettings = (settings: Partial<MinimapSettings>) => {
    setState(
      "minimapSettings",
      produce((current) => {
        const keys = Object.keys(settings) as Array<keyof MinimapSettings>;
        for (const key of keys) {
          const value = settings[key];
          if (value !== undefined) {
            (current as Record<keyof MinimapSettings, MinimapSettings[keyof MinimapSettings]>)[key] = value;
          }
        }
      })
    );
  };

  const updateBreadcrumbSymbolPath = (path: BreadcrumbSymbolPath[]) => {
    setState("breadcrumbSymbolPath", path);
  };

  const defaultEditorOptions: Record<string, unknown> = {
    wordWrap: "off", lineNumbers: "on", renderWhitespace: "none",
    cursorStyle: "line", fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 14, lineHeight: 22, tabSize: 2, smoothScrolling: true,
    scrollBeyondLastLine: true, renderControlCharacters: false,
    minimap: {
      enabled: state.minimapSettings.enabled,
      renderCharacters: state.minimapSettings.renderCharacters,
      side: state.minimapSettings.side,
      showSlider: state.minimapSettings.showSlider,
      maxColumn: state.minimapSettings.maxColumn,
      scale: state.minimapSettings.scale,
      size: state.minimapSettings.sizeMode,
    },
    guides: { indentation: true, bracketPairs: true },
    bracketPairColorization: { enabled: true }, cursorBlinking: "blink",
    formatOnPaste: false, formatOnType: false, linkedEditing: false,
    stickyScroll: { enabled: true },
    scrollbar: { verticalScrollbarSize: 12, horizontalScrollbarSize: 12 },
  };

  const getEditorOptions = (): Record<string, unknown> => {
    try {
      const s = useSettings().effectiveSettings().editor;
      return {
        wordWrap: s.wordWrap, lineNumbers: s.lineNumbers,
        renderWhitespace: s.renderWhitespace, cursorStyle: s.cursorStyle,
        fontFamily: s.fontFamily, fontSize: s.fontSize,
        lineHeight: s.lineHeight, tabSize: s.tabSize,
        smoothScrolling: s.smoothScrolling, scrollBeyondLastLine: s.scrollBeyondLastLine,
        renderControlCharacters: s.renderControlCharacters,
        minimap: {
          enabled: s.minimapEnabled ?? state.minimapSettings.enabled,
          renderCharacters: state.minimapSettings.renderCharacters,
          side: state.minimapSettings.side,
          showSlider: state.minimapSettings.showSlider,
          maxColumn: state.minimapSettings.maxColumn,
          scale: state.minimapSettings.scale,
          size: state.minimapSettings.sizeMode,
        },
        guides: { indentation: s.guidesIndentation, bracketPairs: s.guidesBracketPairs },
        bracketPairColorization: { enabled: s.bracketPairColorization },
        cursorBlinking: s.cursorBlink, formatOnPaste: s.formatOnPaste,
        formatOnType: s.formatOnType, linkedEditing: s.linkedEditing,
        stickyScroll: { enabled: s.stickyScrollEnabled },
        scrollbar: { verticalScrollbarSize: 12, horizontalScrollbarSize: 12 },
      };
    } catch {
      return { ...defaultEditorOptions };
    }
  };

  setupEventHandlers(state, {
    splitEditorInGrid: gridOps.splitEditorInGrid,
    splitEditor,
    setActiveFile: fileOps.setActiveFile,
    openFile: fileOps.openFile,
    saveFile: fileOps.saveFile,
  });

  return (
    <EditorContext.Provider
      value={{
        state,
        openFile: fileOps.openFile,
        openVirtualFile: fileOps.openVirtualFile,
        closeFile: fileOps.closeFile,
        setActiveFile: fileOps.setActiveFile,
        updateFileContent: fileOps.updateFileContent,
        saveFile: fileOps.saveFile,
        closeAllFiles: fileOps.closeAllFiles,
        splitEditor,
        closeGroup,
        setActiveGroup,
        moveFileToGroup,
        updateCursorInfo,
        getActiveGroup,
        getGroupFiles,
        unsplit,
        reorderTabs: tabOps.reorderTabs,
        updateSplitRatio,
        maximizeGroup,
        restoreGroup,
        equalizeGroups,
        lockGroup,
        unlockGroup,
        isGroupLocked,
        setGroupName,
        getGroupName,
        pinTab: tabOps.pinTab,
        unpinTab: tabOps.unpinTab,
        togglePinTab: tabOps.togglePinTab,
        isTabPinned: tabOps.isTabPinned,
        openPreview: tabOps.openPreview,
        promotePreviewToPermanent: tabOps.promotePreviewToPermanent,
        isPreviewTab: tabOps.isPreviewTab,
        reopenLastClosed,
        getRecentlyClosed,
        gridState: state.gridState,
        useGridLayout: state.useGridLayout,
        setUseGridLayout: gridOps.setUseGridLayout,
        splitEditorInGrid: gridOps.splitEditorInGrid,
        closeGridCell: gridOps.closeGridCellAction,
        moveEditorToGridCell: gridOps.moveEditorToGridCell,
        updateGridState: gridOps.updateGridState,
        updateMinimapSettings,
        updateBreadcrumbSymbolPath,
        selectors,
        getEditorOptions,
      }}
    >
      {props.children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditor must be used within EditorProvider");
  }
  return context;
}
