/**
 * =============================================================================
 * USE TERMINAL SPLITS - Terminal split state management hook
 * =============================================================================
 *
 * Manages terminal split groups state including:
 * - Creating new splits (horizontal/vertical)
 * - Managing split ratios
 * - Focus navigation between splits
 * - Persisting split configuration
 * - Keyboard shortcuts for split operations
 *
 * Usage:
 *   const splits = useTerminalSplits({
 *     terminals: terminalsList,
 *     activeTerminalId: activeId,
 *     onActiveChange: setActiveId,
 *   });
 * =============================================================================
 */

import { createEffect, onMount, onCleanup, Accessor } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { TerminalInfo } from "@/types/terminal";
import type { SplitDirection, TerminalSplitGroup } from "./TerminalSplitView";
import { terminalLogger } from "../../utils/logger";

// =============================================================================
// TYPES
// =============================================================================

export interface TerminalSplitState {
  /** All split groups */
  groups: TerminalSplitGroup[];
  /** Currently focused split group ID */
  activeGroupId: string | null;
}

export interface UseTerminalSplitsOptions {
  /** All terminal instances */
  terminals: Accessor<TerminalInfo[]>;
  /** Currently active terminal ID */
  activeTerminalId: Accessor<string | null>;
  /** Callback when active terminal changes */
  onActiveChange: (id: string | null) => void;
  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean;
  /** Storage key for persistence */
  storageKey?: string;
}

export interface UseTerminalSplitsReturn {
  /** Split state */
  state: TerminalSplitState;
  /** Get group containing a terminal */
  getGroupForTerminal: (terminalId: string) => TerminalSplitGroup | null;
  /** Check if terminal is in any split group */
  isTerminalInSplit: (terminalId: string) => boolean;
  /** Split a terminal */
  splitTerminal: (terminalId: string, direction: SplitDirection, newTerminalId: string) => void;
  /** Close a split pane (removes terminal from group) */
  closeSplitPane: (terminalId: string) => void;
  /** Update split ratio */
  updateSplitRatio: (groupId: string, index: number, ratio: number) => void;
  /** Change split direction */
  changeSplitDirection: (groupId: string, direction: SplitDirection) => void;
  /** Focus next terminal in split */
  focusNextInSplit: () => void;
  /** Focus previous terminal in split */
  focusPrevInSplit: () => void;
  /** Focus terminal in direction */
  focusInDirection: (direction: "left" | "right" | "up" | "down") => void;
  /** Reset all splits */
  resetSplits: () => void;
  /** Get ordered terminals for a group */
  getTerminalsInGroup: (groupId: string) => TerminalInfo[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY_PREFIX = "orion_terminal_splits_";
const DEFAULT_RATIO = 0.5;

// =============================================================================
// HELPERS
// =============================================================================

function generateGroupId(): string {
  return `split_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function loadFromStorage(key: string): TerminalSplitState | null {
  try {
    const data = localStorage.getItem(key);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    terminalLogger.warn("[TerminalSplits] Failed to load from storage:", e);
  }
  return null;
}

function saveToStorage(key: string, state: TerminalSplitState): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    terminalLogger.warn("[TerminalSplits] Failed to save to storage:", e);
  }
}

// =============================================================================
// HOOK
// =============================================================================

export function useTerminalSplits(options: UseTerminalSplitsOptions): UseTerminalSplitsReturn {
  const {
    terminals,
    activeTerminalId,
    onActiveChange,
    enableKeyboardShortcuts = true,
    storageKey = "default",
  } = options;

  const fullStorageKey = `${STORAGE_KEY_PREFIX}${storageKey}`;

  // Initialize state from storage or empty
  const initialState = loadFromStorage(fullStorageKey) || {
    groups: [],
    activeGroupId: null,
  };

  const [state, setState] = createStore<TerminalSplitState>(initialState);

  // Persist state changes
  createEffect(() => {
    saveToStorage(fullStorageKey, {
      groups: state.groups,
      activeGroupId: state.activeGroupId,
    });
  });

  // Clean up groups when terminals are removed
  createEffect(() => {
    const terminalIds = new Set(terminals().map((t) => t.id));

    setState(
      produce((s) => {
        // Remove terminals that no longer exist from groups
        for (const group of s.groups) {
          group.terminalIds = group.terminalIds.filter((id) => terminalIds.has(id));
          // Adjust ratios if needed
          while (group.ratios.length > group.terminalIds.length) {
            group.ratios.pop();
          }
          while (group.ratios.length < group.terminalIds.length) {
            group.ratios.push(1 / group.terminalIds.length);
          }
        }

        // Remove empty groups
        s.groups = s.groups.filter((g) => g.terminalIds.length > 0);

        // Clear active group if it no longer exists
        if (s.activeGroupId && !s.groups.find((g) => g.id === s.activeGroupId)) {
          s.activeGroupId = null;
        }
      })
    );
  });

  // Update active group based on active terminal
  createEffect(() => {
    const activeId = activeTerminalId();
    if (!activeId) {
      setState("activeGroupId", null);
      return;
    }

    const group = state.groups.find((g) => g.terminalIds.includes(activeId));
    if (group) {
      setState("activeGroupId", group.id);
    }
  });

  // Get group containing a terminal
  const getGroupForTerminal = (terminalId: string): TerminalSplitGroup | null => {
    return state.groups.find((g) => g.terminalIds.includes(terminalId)) || null;
  };

  // Check if terminal is in any split group
  const isTerminalInSplit = (terminalId: string): boolean => {
    return state.groups.some((g) => g.terminalIds.includes(terminalId));
  };

  // Split a terminal
  const splitTerminal = (
    terminalId: string,
    direction: SplitDirection,
    newTerminalId: string
  ): void => {
    setState(
      produce((s) => {
        // Check if terminal is already in a group
        const existingGroup = s.groups.find((g) => g.terminalIds.includes(terminalId));

        if (existingGroup) {
          // Add new terminal to existing group
          const index = existingGroup.terminalIds.indexOf(terminalId);
          existingGroup.terminalIds.splice(index + 1, 0, newTerminalId);

          // Redistribute ratios
          const newCount = existingGroup.terminalIds.length;
          existingGroup.ratios = Array(newCount).fill(1 / newCount);
        } else {
          // Create new group with both terminals
          const newGroup: TerminalSplitGroup = {
            id: generateGroupId(),
            terminalIds: [terminalId, newTerminalId],
            direction,
            ratios: [DEFAULT_RATIO, DEFAULT_RATIO],
          };
          s.groups.push(newGroup);
          s.activeGroupId = newGroup.id;
        }
      })
    );
  };

  // Close a split pane
  const closeSplitPane = (terminalId: string): void => {
    setState(
      produce((s) => {
        const groupIndex = s.groups.findIndex((g) => g.terminalIds.includes(terminalId));
        if (groupIndex === -1) return;

        const group = s.groups[groupIndex];
        const terminalIndex = group.terminalIds.indexOf(terminalId);

        // Remove terminal from group
        group.terminalIds.splice(terminalIndex, 1);
        group.ratios.splice(terminalIndex, 1);

        // Normalize remaining ratios
        if (group.ratios.length > 0) {
          const sum = group.ratios.reduce((a, b) => a + b, 0);
          group.ratios = group.ratios.map((r) => r / sum);
        }

        // Remove group if only one terminal left
        if (group.terminalIds.length <= 1) {
          s.groups.splice(groupIndex, 1);
          if (s.activeGroupId === group.id) {
            s.activeGroupId = null;
          }
        }
      })
    );
  };

  // Update split ratio
  const updateSplitRatio = (groupId: string, index: number, ratio: number): void => {
    setState(
      produce((s) => {
        const group = s.groups.find((g) => g.id === groupId);
        if (group && index >= 0 && index < group.ratios.length) {
          group.ratios[index] = Math.max(0, Math.min(1, ratio));
        }
      })
    );
  };

  // Change split direction
  const changeSplitDirection = (groupId: string, direction: SplitDirection): void => {
    setState(
      produce((s) => {
        const group = s.groups.find((g) => g.id === groupId);
        if (group) {
          group.direction = direction;
        }
      })
    );
  };

  // Focus next terminal in split
  const focusNextInSplit = (): void => {
    const activeId = activeTerminalId();
    if (!activeId) return;

    const group = getGroupForTerminal(activeId);
    if (!group) return;

    const currentIndex = group.terminalIds.indexOf(activeId);
    const nextIndex = (currentIndex + 1) % group.terminalIds.length;
    onActiveChange(group.terminalIds[nextIndex]);
  };

  // Focus previous terminal in split
  const focusPrevInSplit = (): void => {
    const activeId = activeTerminalId();
    if (!activeId) return;

    const group = getGroupForTerminal(activeId);
    if (!group) return;

    const currentIndex = group.terminalIds.indexOf(activeId);
    const prevIndex = currentIndex === 0 ? group.terminalIds.length - 1 : currentIndex - 1;
    onActiveChange(group.terminalIds[prevIndex]);
  };

  // Focus terminal in direction
  const focusInDirection = (direction: "left" | "right" | "up" | "down"): void => {
    const activeId = activeTerminalId();
    if (!activeId) return;

    const group = getGroupForTerminal(activeId);
    if (!group) return;

    const currentIndex = group.terminalIds.indexOf(activeId);
    const isHorizontal = group.direction === "horizontal";

    let targetIndex = currentIndex;

    if (isHorizontal) {
      if (direction === "left" && currentIndex > 0) {
        targetIndex = currentIndex - 1;
      } else if (direction === "right" && currentIndex < group.terminalIds.length - 1) {
        targetIndex = currentIndex + 1;
      }
    } else {
      if (direction === "up" && currentIndex > 0) {
        targetIndex = currentIndex - 1;
      } else if (direction === "down" && currentIndex < group.terminalIds.length - 1) {
        targetIndex = currentIndex + 1;
      }
    }

    if (targetIndex !== currentIndex) {
      onActiveChange(group.terminalIds[targetIndex]);
    }
  };

  // Reset all splits
  const resetSplits = (): void => {
    setState({
      groups: [],
      activeGroupId: null,
    });
  };

  // Get ordered terminals for a group
  const getTerminalsInGroup = (groupId: string): TerminalInfo[] => {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return [];

    const terminalsList = terminals();
    return group.terminalIds
      .map((id) => terminalsList.find((t) => t.id === id))
      .filter((t): t is TerminalInfo => t !== undefined);
  };

  // Keyboard shortcuts
  onMount(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const { key, ctrlKey, shiftKey, altKey } = e;

      // Ctrl+Shift+5: Split terminal (default horizontal)
      if (ctrlKey && shiftKey && key === "5") {
        e.preventDefault();
        const activeId = activeTerminalId();
        if (activeId) {
          // Dispatch event to create new terminal and split
          window.dispatchEvent(
            new CustomEvent("terminal:split", {
              detail: { terminalId: activeId, direction: "horizontal" },
            })
          );
        }
        return;
      }

      // Alt+Arrow: Navigate between splits
      if (altKey && !ctrlKey && !shiftKey) {
        const activeId = activeTerminalId();
        if (!activeId) return;

        const group = getGroupForTerminal(activeId);
        if (!group) return;

        switch (key) {
          case "ArrowLeft":
            e.preventDefault();
            focusInDirection("left");
            break;
          case "ArrowRight":
            e.preventDefault();
            focusInDirection("right");
            break;
          case "ArrowUp":
            e.preventDefault();
            focusInDirection("up");
            break;
          case "ArrowDown":
            e.preventDefault();
            focusInDirection("down");
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return {
    state,
    getGroupForTerminal,
    isTerminalInSplit,
    splitTerminal,
    closeSplitPane,
    updateSplitRatio,
    changeSplitDirection,
    focusNextInSplit,
    focusPrevInSplit,
    focusInDirection,
    resetSplits,
    getTerminalsInGroup,
  };
}

export default useTerminalSplits;
