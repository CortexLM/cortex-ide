import type { OpenFile, EditorGroup, EditorSplit, SplitDirection } from "../../types";
import type { GridCell, EditorGridState } from "../../components/editor/EditorGrid";

export type { OpenFile, EditorGroup, EditorSplit, SplitDirection, GridCell, EditorGridState };

export interface MinimapSettings {
  enabled: boolean;
  side: "right" | "left";
  showSlider: "always" | "mouseover";
  renderCharacters: boolean;
  maxColumn: number;
  scale: number;
  sizeMode: "proportional" | "fill" | "fit";
}

export interface BreadcrumbSymbolPath {
  name: string;
  kind: string;
  detail?: string;
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

export interface RecentlyClosedEntry {
  fileId: string;
  path: string;
  groupId: string;
  closedAt: number;
}

export interface EditorState {
  openFiles: OpenFile[];
  activeFileId: string | null;
  activeGroupId: string;
  groups: EditorGroup[];
  splits: EditorSplit[];
  cursorCount: number;
  selectionCount: number;
  isOpening: boolean;
  pinnedTabs: string[];
  previewTab: string | null;
  gridState: EditorGridState | null;
  useGridLayout: boolean;
  minimapSettings: MinimapSettings;
  breadcrumbSymbolPath: BreadcrumbSymbolPath[];
  groupLockState: Record<string, boolean>;
  groupNames: Record<string, string>;
  recentlyClosedStack: RecentlyClosedEntry[];
}

export interface EditorContextValue {
  state: EditorState;
  openFile: (path: string, groupId?: string) => Promise<void>;
  openVirtualFile: (name: string, content: string, language?: string) => Promise<void>;
  closeFile: (fileId: string) => void;
  setActiveFile: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  saveFile: (fileId: string) => Promise<void>;
  closeAllFiles: (includePinned?: boolean) => void;
  splitEditor: (direction: SplitDirection) => void;
  closeGroup: (groupId: string) => void;
  setActiveGroup: (groupId: string) => void;
  moveFileToGroup: (fileId: string, targetGroupId: string) => void;
  updateCursorInfo: (cursorCount: number, selectionCount: number) => void;
  getActiveGroup: () => EditorGroup | undefined;
  getGroupFiles: (groupId: string) => OpenFile[];
  unsplit: () => void;
  reorderTabs: (sourceFileId: string, targetFileId: string, groupId?: string) => void;
  updateSplitRatio: (splitId: string, ratio: number) => void;

  maximizeGroup: (groupId: string) => void;
  restoreGroup: (groupId: string) => void;
  equalizeGroups: () => void;
  lockGroup: (groupId: string) => void;
  unlockGroup: (groupId: string) => void;
  isGroupLocked: (groupId: string) => boolean;
  setGroupName: (groupId: string, name: string) => void;
  getGroupName: (groupId: string) => string | undefined;

  pinTab: (tabId: string) => void;
  unpinTab: (tabId: string) => void;
  togglePinTab: (tabId: string) => void;
  isTabPinned: (tabId: string) => boolean;

  openPreview: (path: string, groupId?: string) => Promise<void>;
  promotePreviewToPermanent: (fileId?: string) => void;
  isPreviewTab: (tabId: string) => boolean;

  reopenLastClosed: (groupId?: string) => Promise<void>;
  getRecentlyClosed: () => RecentlyClosedEntry[];

  gridState: EditorGridState | null;
  useGridLayout: boolean;
  setUseGridLayout: (use: boolean) => void;
  splitEditorInGrid: (direction: "horizontal" | "vertical", fileId?: string) => void;
  closeGridCell: (cellId: string) => void;
  moveEditorToGridCell: (fileId: string, cellId: string) => void;
  updateGridState: (state: EditorGridState) => void;

  updateMinimapSettings: (settings: Partial<MinimapSettings>) => void;
  updateBreadcrumbSymbolPath: (path: BreadcrumbSymbolPath[]) => void;

  selectors: {
    openFileCount: () => number;
    activeFile: () => OpenFile | undefined;
    hasModifiedFiles: () => boolean;
    modifiedFileIds: () => string[];
    isSplit: () => boolean;
    groupCount: () => number;
    pinnedTabIds: () => string[];
    previewTabId: () => string | null;
    gridState: () => EditorGridState | null;
    useGridLayout: () => boolean;
    minimapSettings: () => MinimapSettings;
    breadcrumbSymbolPath: () => BreadcrumbSymbolPath[];
    isGroupLocked: (groupId: string) => boolean;
    groupName: (groupId: string) => string | undefined;
    recentlyClosedStack: () => RecentlyClosedEntry[];
  };

  getEditorOptions: () => Record<string, unknown>;
}
