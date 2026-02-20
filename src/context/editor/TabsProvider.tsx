import {
  createContext,
  useContext,
  createSignal,
  createMemo,
  createEffect,
  onCleanup,
  batch,
  type ParentProps,
} from "solid-js";
import { generateId } from "@/context/editor/languageDetection";

// ============================================================================
// Types
// ============================================================================

export interface TabGroup {
  id: string;
  name?: string;
  tabIds: string[];
  activeTabId: string | null;
  isCollapsed: boolean;
}

export interface TabLRUEntry {
  tabId: string;
  lastAccessedAt: number;
}

export interface TabsState {
  groups: TabGroup[];
  activeGroupId: string;
  tabLimit: number;
  lruEntries: TabLRUEntry[];
  dragState: {
    sourceTabId: string | null;
    sourceGroupId: string | null;
    targetGroupId: string | null;
    dropPosition: "before" | "after" | null;
  };
}

export interface TabsContextValue {
  state: TabsState;
  groups: () => TabGroup[];
  activeGroupId: () => string;
  tabLimit: () => number;
  lruEntries: () => TabLRUEntry[];
  dragState: () => TabsState["dragState"];

  createGroup: (name?: string) => TabGroup;
  removeGroup: (groupId: string) => void;
  moveTabToGroup: (tabId: string, targetGroupId: string, position?: number) => void;
  setTabLimit: (limit: number) => void;
  evictLRUTab: () => string | null;
  touchTab: (tabId: string) => void;
  getGroupForTab: (tabId: string) => TabGroup | undefined;
  reorderTabInGroup: (tabId: string, targetTabId: string, groupId: string) => void;
  startDrag: (tabId: string, groupId: string) => void;
  endDrag: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_TAB_LIMIT = "cortex_tab_limit";
const STORAGE_KEY_TAB_GROUPS = "cortex_tab_groups";
const DEFAULT_GROUP_ID = "tabs-group-default";

const DEFAULT_DRAG_STATE: TabsState["dragState"] = {
  sourceTabId: null,
  sourceGroupId: null,
  targetGroupId: null,
  dropPosition: null,
};

// ============================================================================
// Persistence Helpers
// ============================================================================

function loadTabLimit(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_TAB_LIMIT);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("[TabsProvider] Failed to load tab limit:", e);
  }
  return 0;
}

function saveTabLimit(limit: number): void {
  try {
    localStorage.setItem(STORAGE_KEY_TAB_LIMIT, String(limit));
  } catch (e) {
    console.error("[TabsProvider] Failed to save tab limit:", e);
  }
}

function loadTabGroups(): TabGroup[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_TAB_GROUPS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every(isValidTabGroup)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("[TabsProvider] Failed to load tab groups:", e);
  }
  return [createDefaultGroup()];
}

function saveTabGroups(groups: TabGroup[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TAB_GROUPS, JSON.stringify(groups));
  } catch (e) {
    console.error("[TabsProvider] Failed to save tab groups:", e);
  }
}

function isValidTabGroup(obj: unknown): obj is TabGroup {
  if (typeof obj !== "object" || obj === null) return false;
  const g = obj as Record<string, unknown>;
  return (
    typeof g.id === "string" &&
    Array.isArray(g.tabIds) &&
    typeof g.isCollapsed === "boolean" &&
    (g.activeTabId === null || typeof g.activeTabId === "string")
  );
}

function createDefaultGroup(): TabGroup {
  return {
    id: DEFAULT_GROUP_ID,
    tabIds: [],
    activeTabId: null,
    isCollapsed: false,
  };
}

// ============================================================================
// Context
// ============================================================================

const TabsContext = createContext<TabsContextValue>();

// ============================================================================
// Provider
// ============================================================================

export function TabsProvider(props: ParentProps) {
  const initialGroups = loadTabGroups();
  const initialLimit = loadTabLimit();

  const [groups, setGroups] = createSignal<TabGroup[]>(initialGroups);
  const [activeGroupId, setActiveGroupId] = createSignal<string>(
    initialGroups.length > 0 ? initialGroups[0].id : DEFAULT_GROUP_ID,
  );
  const [tabLimit, setTabLimitSignal] = createSignal<number>(initialLimit);
  const [lruEntries, setLruEntries] = createSignal<TabLRUEntry[]>([]);
  const [dragState, setDragState] = createSignal<TabsState["dragState"]>({
    ...DEFAULT_DRAG_STATE,
  });

  const state = createMemo<TabsState>(() => ({
    groups: groups(),
    activeGroupId: activeGroupId(),
    tabLimit: tabLimit(),
    lruEntries: lruEntries(),
    dragState: dragState(),
  }));

  // --------------------------------------------------------------------------
  // Persistence Effects
  // --------------------------------------------------------------------------

  createEffect(() => {
    saveTabGroups(groups());
  });

  createEffect(() => {
    saveTabLimit(tabLimit());
  });

  // --------------------------------------------------------------------------
  // Methods
  // --------------------------------------------------------------------------

  const createGroup = (name?: string): TabGroup => {
    const newGroup: TabGroup = {
      id: `tabs-group-${generateId()}`,
      name,
      tabIds: [],
      activeTabId: null,
      isCollapsed: false,
    };

    setGroups((prev) => [...prev, newGroup]);

    window.dispatchEvent(
      new CustomEvent("tabs:group-created", {
        detail: { groupId: newGroup.id, name },
      }),
    );

    return newGroup;
  };

  const removeGroup = (groupId: string): void => {
    if (groupId === DEFAULT_GROUP_ID) return;

    const currentGroups = groups();
    const groupToRemove = currentGroups.find((g) => g.id === groupId);
    if (!groupToRemove) return;

    const defaultGroup = currentGroups.find((g) => g.id === DEFAULT_GROUP_ID);
    const tabsToMove = groupToRemove.tabIds;

    batch(() => {
      if (defaultGroup && tabsToMove.length > 0) {
        setGroups((prev) =>
          prev
            .map((g) => {
              if (g.id === DEFAULT_GROUP_ID) {
                return {
                  ...g,
                  tabIds: [...g.tabIds, ...tabsToMove],
                  activeTabId: g.activeTabId ?? tabsToMove[0] ?? null,
                };
              }
              return g;
            })
            .filter((g) => g.id !== groupId),
        );
      } else {
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
      }

      if (activeGroupId() === groupId) {
        setActiveGroupId(DEFAULT_GROUP_ID);
      }
    });

    window.dispatchEvent(
      new CustomEvent("tabs:group-removed", {
        detail: { groupId, movedTabIds: tabsToMove },
      }),
    );
  };

  const moveTabToGroup = (
    tabId: string,
    targetGroupId: string,
    position?: number,
  ): void => {
    const currentGroups = groups();
    const sourceGroup = currentGroups.find((g) => g.tabIds.includes(tabId));
    const targetGroup = currentGroups.find((g) => g.id === targetGroupId);

    if (!sourceGroup || !targetGroup) return;
    if (sourceGroup.id === targetGroupId) return;

    batch(() => {
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id === sourceGroup.id) {
            const newTabIds = g.tabIds.filter((id) => id !== tabId);
            return {
              ...g,
              tabIds: newTabIds,
              activeTabId:
                g.activeTabId === tabId ? (newTabIds[0] ?? null) : g.activeTabId,
            };
          }
          if (g.id === targetGroupId) {
            const newTabIds = [...g.tabIds];
            const insertAt =
              position !== undefined && position >= 0 && position <= newTabIds.length
                ? position
                : newTabIds.length;
            newTabIds.splice(insertAt, 0, tabId);
            return {
              ...g,
              tabIds: newTabIds,
              activeTabId: tabId,
            };
          }
          return g;
        }),
      );

      setActiveGroupId(targetGroupId);
    });

    window.dispatchEvent(
      new CustomEvent("tabs:tab-moved", {
        detail: {
          tabId,
          sourceGroupId: sourceGroup.id,
          targetGroupId,
          position,
        },
      }),
    );
  };

  const setTabLimit = (limit: number): void => {
    const clamped = Math.max(0, Math.floor(limit));
    setTabLimitSignal(clamped);
  };

  const evictLRUTab = (): string | null => {
    const entries = lruEntries();
    if (entries.length === 0) return null;

    const sorted = [...entries].sort(
      (a, b) => a.lastAccessedAt - b.lastAccessedAt,
    );

    const evictedEntry = sorted[0];
    const evictedTabId = evictedEntry.tabId;

    batch(() => {
      setLruEntries((prev) => prev.filter((e) => e.tabId !== evictedTabId));

      setGroups((prev) =>
        prev.map((g) => {
          if (!g.tabIds.includes(evictedTabId)) return g;
          const newTabIds = g.tabIds.filter((id) => id !== evictedTabId);
          return {
            ...g,
            tabIds: newTabIds,
            activeTabId:
              g.activeTabId === evictedTabId
                ? (newTabIds[0] ?? null)
                : g.activeTabId,
          };
        }),
      );
    });

    window.dispatchEvent(
      new CustomEvent("tabs:tab-evicted", {
        detail: { tabId: evictedTabId },
      }),
    );

    return evictedTabId;
  };

  const touchTab = (tabId: string): void => {
    const now = Date.now();
    setLruEntries((prev) => {
      const existing = prev.findIndex((e) => e.tabId === tabId);
      if (existing !== -1) {
        return prev.map((e) =>
          e.tabId === tabId ? { ...e, lastAccessedAt: now } : e,
        );
      }
      return [...prev, { tabId, lastAccessedAt: now }];
    });
  };

  const getGroupForTab = (tabId: string): TabGroup | undefined => {
    return groups().find((g) => g.tabIds.includes(tabId));
  };

  const reorderTabInGroup = (
    tabId: string,
    targetTabId: string,
    groupId: string,
  ): void => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;

        const tabIds = [...g.tabIds];
        const sourceIndex = tabIds.indexOf(tabId);
        const targetIndex = tabIds.indexOf(targetTabId);

        if (sourceIndex === -1 || targetIndex === -1) return g;
        if (sourceIndex === targetIndex) return g;

        tabIds.splice(sourceIndex, 1);
        tabIds.splice(targetIndex, 0, tabId);

        return { ...g, tabIds };
      }),
    );
  };

  const startDrag = (tabId: string, groupId: string): void => {
    setDragState({
      sourceTabId: tabId,
      sourceGroupId: groupId,
      targetGroupId: null,
      dropPosition: null,
    });
  };

  const endDrag = (): void => {
    setDragState({ ...DEFAULT_DRAG_STATE });
  };

  // --------------------------------------------------------------------------
  // Event Listeners
  // --------------------------------------------------------------------------

  const handleSetLimit = (e: Event) => {
    const detail = (e as CustomEvent<{ limit: number }>).detail;
    if (detail && typeof detail.limit === "number") {
      setTabLimit(detail.limit);
    }
  };

  const handleCreateGroup = (e: Event) => {
    const detail = (e as CustomEvent<{ name?: string }>).detail;
    createGroup(detail?.name);
  };

  window.addEventListener("tabs:set-limit", handleSetLimit);
  window.addEventListener("tabs:create-group", handleCreateGroup);

  onCleanup(() => {
    window.removeEventListener("tabs:set-limit", handleSetLimit);
    window.removeEventListener("tabs:create-group", handleCreateGroup);
  });

  // --------------------------------------------------------------------------
  // Context Value
  // --------------------------------------------------------------------------

  const contextValue: TabsContextValue = {
    get state() {
      return state();
    },
    groups,
    activeGroupId,
    tabLimit,
    lruEntries,
    dragState,
    createGroup,
    removeGroup,
    moveTabToGroup,
    setTabLimit,
    evictLRUTab,
    touchTab,
    getGroupForTab,
    reorderTabInGroup,
    startDrag,
    endDrag,
  };

  return (
    <TabsContext.Provider value={contextValue}>
      {props.children}
    </TabsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useTabs(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("useTabs must be used within TabsProvider");
  }
  return context;
}
