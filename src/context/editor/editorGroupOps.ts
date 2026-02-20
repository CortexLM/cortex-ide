import { batch } from "solid-js";
import { produce, type SetStoreFunction } from "solid-js/store";
import type { SplitDirection, EditorGroup, EditorSplit } from "../../types";
import type { EditorUIState } from "./EditorUIContext";
import { generateId } from "./languageDetection";

export function createGroupOps(
  state: EditorUIState,
  setState: SetStoreFunction<EditorUIState>,
) {
  const splitEditor = (
    direction: SplitDirection,
    activeFileId: string | null
  ): string => {
    const currentActiveGroup = state.groups.find((g) => g.id === state.activeGroupId);
    if (!currentActiveGroup || currentActiveGroup.fileIds.length === 0) {
      return state.activeGroupId;
    }

    const newGroupId = `group-${generateId()}`;
    const splitId = `split-${generateId()}`;

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

    return newGroupId;
  };

  const closeGroup = (groupId: string) => {
    if (state.groups.length <= 1) return;
    const target = state.groups.find((g) => g.id === groupId);
    if (target?.locked) return;

    batch(() => {
      const splitIndex = state.splits.findIndex(
        (s) => s.firstGroupId === groupId || s.secondGroupId === groupId
      );
      if (splitIndex !== -1) {
        setState("splits", (splits) => splits.filter((_, i) => i !== splitIndex));
      }

      setState("groups", (groups) => groups.filter((g) => g.id !== groupId));

      if (state.activeGroupId === groupId) {
        const remainingGroup = state.groups.find((g) => g.id !== groupId);
        if (remainingGroup) {
          setState("activeGroupId", remainingGroup.id);
        }
      }
    });
  };

  const unsplit = () => {
    if (state.groups.length <= 1) return;

    const defaultGroup = state.groups[0];
    const allFileIds = new Set<string>();

    state.groups.forEach((group) => {
      group.fileIds.forEach((id) => allFileIds.add(id));
    });

    const currentActiveGroup = state.groups.find((g) => g.id === state.activeGroupId);
    const preservedActiveFileId = currentActiveGroup?.activeFileId || null;

    batch(() => {
      setState("groups", [
        {
          ...defaultGroup,
          fileIds: Array.from(allFileIds),
          activeFileId: preservedActiveFileId,
        },
      ]);
      setState("splits", []);
      setState("activeGroupId", defaultGroup.id);
    });
  };

  const moveFileToGroup = (
    fileId: string,
    sourceGroupId: string,
    targetGroupId: string
  ) => {
    if (sourceGroupId === targetGroupId) return;

    batch(() => {
      setState(
        "groups",
        (g) => g.id === sourceGroupId,
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
    });
  };

  const lockGroup = (groupId: string) => {
    setState("groups", (g) => g.id === groupId, "locked", true);
  };
  const unlockGroup = (groupId: string) => {
    setState("groups", (g) => g.id === groupId, "locked", false);
  };
  const isGroupLocked = (groupId: string): boolean => {
    return !!state.groups.find((g) => g.id === groupId)?.locked;
  };

  const setGroupLabel = (groupId: string, label: string) => {
    setState("groups", (g) => g.id === groupId, "label", label);
  };
  const getGroupLabel = (groupId: string): string | undefined => {
    return state.groups.find((g) => g.id === groupId)?.label;
  };

  const addRecentlyClosed = (groupId: string, fileUri: string) => {
    setState("groups", (g) => g.id === groupId, produce((group) => {
      if (!group.recentlyClosed) group.recentlyClosed = [];
      group.recentlyClosed.push(fileUri);
    }));
  };
  const getRecentlyClosed = (groupId: string): string[] => {
    return state.groups.find((g) => g.id === groupId)?.recentlyClosed ?? [];
  };
  const reopenLastClosed = (groupId: string): string | undefined => {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group?.recentlyClosed?.length) return undefined;
    const last = group.recentlyClosed[group.recentlyClosed.length - 1];
    setState("groups", (g) => g.id === groupId, produce((group) => {
      group.recentlyClosed = group.recentlyClosed?.slice(0, -1);
    }));
    return last;
  };

  const focusGroup = (index: number) => {
    const target = state.groups[index];
    if (target) setState("activeGroupId", target.id);
  };

  const maximizeGroup = (groupId: string) => {
    setState("maximizedGroupId", groupId);
  };
  const restoreGroups = () => {
    setState("maximizedGroupId", null);
  };
  const isGroupMaximized = (): boolean => {
    return state.maximizedGroupId !== null;
  };

  const equalizeSplits = () => {
    const ratio = 1 / state.groups.length;
    batch(() => {
      setState("groups", {}, "splitRatio", ratio);
      setState("splits", {}, "ratio", 0.5);
    });
  };

  return {
    splitEditor,
    closeGroup,
    unsplit,
    moveFileToGroup,
    lockGroup,
    unlockGroup,
    isGroupLocked,
    setGroupLabel,
    getGroupLabel,
    addRecentlyClosed,
    getRecentlyClosed,
    reopenLastClosed,
    focusGroup,
    maximizeGroup,
    restoreGroups,
    isGroupMaximized,
    equalizeSplits,
  };
}
