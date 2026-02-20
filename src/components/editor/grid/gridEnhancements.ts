/**
 * Grid enhancement operations: maximize, equalize, presets, locking, naming, recently closed.
 */

import { createSignal, batch } from "solid-js";
import type { GridCell, EditorGridState } from "./types";
import { cloneCell, findCell } from "./gridHelpers";

export type LayoutPreset = "2x2" | "3x2" | "3x1" | "1x3" | "2x1";

const MAX_RECENTLY_CLOSED = 20;
const RECENTLY_CLOSED_KEY = "cortex-recently-closed-editors";
const GROUP_NAMES_KEY = "cortex-grid-group-names";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeCell(type: GridCell["type"], overrides?: Partial<GridCell>): GridCell {
  return { id: generateId(), type, ...overrides };
}

function equalizeSizes(root: GridCell): GridCell {
  if (!root.children || root.children.length === 0) return root;
  const count = root.children.length;
  const equalSize = 1 / count;
  return {
    ...root,
    sizes: Array.from({ length: count }, () => equalSize),
    children: root.children.map(equalizeSizes),
  };
}

function loadPersistedMap(key: string): Map<string, string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string>;
      return new Map(Object.entries(parsed));
    }
  } catch {
    /* ignore corrupt data */
  }
  return new Map();
}

function persistMap(key: string, map: Map<string, string>): void {
  try {
    localStorage.setItem(key, JSON.stringify(Object.fromEntries(map)));
  } catch {
    /* storage full or unavailable */
  }
}

function loadRecentlyClosed(): Map<string, string[]> {
  try {
    const raw = localStorage.getItem(RECENTLY_CLOSED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string[]>;
      return new Map(Object.entries(parsed));
    }
  } catch {
    /* ignore */
  }
  return new Map();
}

function persistRecentlyClosed(map: Map<string, string[]>): void {
  try {
    localStorage.setItem(
      RECENTLY_CLOSED_KEY,
      JSON.stringify(Object.fromEntries(map)),
    );
  } catch {
    /* storage full or unavailable */
  }
}

function buildPresetRoot(preset: LayoutPreset): GridCell {
  switch (preset) {
    case "2x1":
      return makeCell("grid", {
        direction: "horizontal",
        sizes: [0.5, 0.5],
        children: [
          makeCell("group"),
          makeCell("group"),
        ],
      });
    case "3x1":
      return makeCell("grid", {
        direction: "horizontal",
        sizes: [1 / 3, 1 / 3, 1 / 3],
        children: [
          makeCell("group"),
          makeCell("group"),
          makeCell("group"),
        ],
      });
    case "1x3":
      return makeCell("grid", {
        direction: "vertical",
        sizes: [1 / 3, 1 / 3, 1 / 3],
        children: [
          makeCell("group"),
          makeCell("group"),
          makeCell("group"),
        ],
      });
    case "2x2":
      return makeCell("grid", {
        direction: "horizontal",
        sizes: [0.5, 0.5],
        children: [
          makeCell("grid", {
            direction: "vertical",
            sizes: [0.5, 0.5],
            children: [makeCell("group"), makeCell("group")],
          }),
          makeCell("grid", {
            direction: "vertical",
            sizes: [0.5, 0.5],
            children: [makeCell("group"), makeCell("group")],
          }),
        ],
      });
    case "3x2":
      return makeCell("grid", {
        direction: "horizontal",
        sizes: [1 / 3, 1 / 3, 1 / 3],
        children: [
          makeCell("grid", {
            direction: "vertical",
            sizes: [0.5, 0.5],
            children: [makeCell("group"), makeCell("group")],
          }),
          makeCell("grid", {
            direction: "vertical",
            sizes: [0.5, 0.5],
            children: [makeCell("group"), makeCell("group")],
          }),
          makeCell("grid", {
            direction: "vertical",
            sizes: [0.5, 0.5],
            children: [makeCell("group"), makeCell("group")],
          }),
        ],
      });
  }
}

export function createGridEnhancements(
  state: () => EditorGridState,
  setState: (s: EditorGridState) => void,
) {
  const [maximizedGroupId, setMaximizedGroupId] = createSignal<string | null>(null);
  const [previousRoot, setPreviousRoot] = createSignal<GridCell | null>(null);
  const [lockedGroups, setLockedGroups] = createSignal<Set<string>>(new Set());
  const [groupNames, setGroupNames] = createSignal<Map<string, string>>(
    loadPersistedMap(GROUP_NAMES_KEY),
  );
  const [recentlyClosed, setRecentlyClosed] = createSignal<Map<string, string[]>>(
    loadRecentlyClosed(),
  );

  function maximizeGroup(groupId: string): void {
    const current = state();
    const cell = findCell(current.root, groupId);
    if (!cell) return;

    batch(() => {
      setPreviousRoot(cloneCell(current.root));
      setMaximizedGroupId(groupId);
      setState({
        root: { ...cloneCell(cell), id: cell.id },
        activeCell: groupId,
      });
    });
  }

  function restoreGroup(): void {
    const saved = previousRoot();
    if (!saved) return;

    batch(() => {
      const prevActive = maximizedGroupId() ?? state().activeCell;
      setMaximizedGroupId(null);
      setPreviousRoot(null);
      setState({ root: cloneCell(saved), activeCell: prevActive });
    });
  }

  function isGroupMaximized(): boolean {
    return maximizedGroupId() !== null;
  }

  function equalizeGroups(): void {
    const current = state();
    const newRoot = equalizeSizes(cloneCell(current.root));
    setState({ ...current, root: newRoot });
  }

  function applyLayoutPreset(preset: LayoutPreset): void {
    const newRoot = buildPresetRoot(preset);
    const firstChild = newRoot.children?.[0];
    const activeId = firstChild?.children?.[0]?.id ?? firstChild?.id ?? newRoot.id;
    setState({ root: newRoot, activeCell: activeId });
  }

  function lockGroup(groupId: string): void {
    const next = new Set(lockedGroups());
    next.add(groupId);
    setLockedGroups(next);
  }

  function unlockGroup(groupId: string): void {
    const next = new Set(lockedGroups());
    next.delete(groupId);
    setLockedGroups(next);
  }

  function isGroupLocked(groupId: string): boolean {
    return lockedGroups().has(groupId);
  }

  function nameGroup(groupId: string, name: string): void {
    const next = new Map<string, string>(groupNames());
    if (name.trim().length === 0) {
      next.delete(groupId);
    } else {
      next.set(groupId, name.trim());
    }
    setGroupNames(next);
    persistMap(GROUP_NAMES_KEY, next);
  }

  function getGroupName(groupId: string): string | undefined {
    return groupNames().get(groupId);
  }

  function addToRecentlyClosed(groupId: string, fileId: string): void {
    const next = new Map<string, string[]>(recentlyClosed());
    const list = [...(next.get(groupId) ?? [])];
    const existingIdx = list.indexOf(fileId);
    if (existingIdx !== -1) {
      list.splice(existingIdx, 1);
    }
    list.push(fileId);
    if (list.length > MAX_RECENTLY_CLOSED) {
      list.splice(0, list.length - MAX_RECENTLY_CLOSED);
    }
    next.set(groupId, list);
    setRecentlyClosed(next);
    persistRecentlyClosed(next);
  }

  function recentlyClosedEditors(groupId: string): string[] {
    return [...(recentlyClosed().get(groupId) ?? [])];
  }

  function reopenClosedEditor(groupId: string): string | undefined {
    const next = new Map<string, string[]>(recentlyClosed());
    const list = [...(next.get(groupId) ?? [])];
    if (list.length === 0) return undefined;
    const fileId = list.pop()!;
    next.set(groupId, list);
    setRecentlyClosed(next);
    persistRecentlyClosed(next);
    return fileId;
  }

  function closeGroupWithLockCheck(groupId: string): boolean {
    if (isGroupLocked(groupId)) return false;
    const current = state();
    const cell = findCell(current.root, groupId);
    if (!cell) return false;
    return true;
  }

  return {
    maximizeGroup,
    restoreGroup,
    isGroupMaximized,
    equalizeGroups,
    applyLayoutPreset,
    lockGroup,
    unlockGroup,
    isGroupLocked,
    closeGroupWithLockCheck,
    nameGroup,
    getGroupName,
    recentlyClosedEditors,
    reopenClosedEditor,
    addToRecentlyClosed,
  };
}
