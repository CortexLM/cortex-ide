import { createContext, useContext, createSignal, ParentProps, onMount, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";

export interface TabHistoryEntry {
  fileId: string;
  path: string;
  name: string;
  timestamp: number;
}

interface TabSwitcherState {
  history: TabHistoryEntry[];
  isOpen: boolean;
  selectedIndex: number;
  query: string;
  direction: "forward" | "backward";
}

interface TabSwitcherContextValue {
  state: TabSwitcherState;
  open: (direction?: "forward" | "backward") => void;
  close: () => void;
  confirm: () => void;
  selectNext: () => void;
  selectPrevious: () => void;
  selectIndex: (index: number) => void;
  setQuery: (query: string) => void;
  recordTabAccess: (fileId: string, path: string, name: string) => void;
  removeFromHistory: (fileId: string) => void;
  getFilteredHistory: () => TabHistoryEntry[];
}

const TabSwitcherContext = createContext<TabSwitcherContextValue>();

const HISTORY_LIMIT = 50;
const STORAGE_KEY = "cortex_tab_history";

function fuzzyMatch(query: string, text: string): { score: number; matches: number[] } {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  let queryIndex = 0;
  let score = 0;
  const matches: number[] = [];
  let lastMatchIndex = -1;

  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      matches.push(i);
      if (lastMatchIndex === i - 1) {
        score += 10;
      }
      if (i === 0 || text[i - 1] === "/" || text[i - 1] === "\\" || text[i - 1] === "_" || text[i - 1] === "-") {
        score += 5;
      }
      score += 1;
      lastMatchIndex = i;
      queryIndex++;
    }
  }

  if (queryIndex === query.length) {
    score += Math.max(0, 50 - text.length);
    return { score, matches };
  }

  return { score: 0, matches: [] };
}

export function TabSwitcherProvider(props: ParentProps) {
  const [state, setState] = createStore<TabSwitcherState>({
    history: [],
    isOpen: false,
    selectedIndex: 0,
    query: "",
    direction: "forward",
  });

  const [ctrlHeld, setCtrlHeld] = createSignal(false);

  const loadHistory = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TabHistoryEntry[];
        setState("history", parsed);
      }
    } catch (e) {
      console.error("Failed to load tab history:", e);
    }
  };

  const saveHistory = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
    } catch (e) {
      console.error("Failed to save tab history:", e);
    }
  };

  onMount(() => {
    loadHistory();
  });

  const recordTabAccess = (fileId: string, path: string, name: string) => {
    setState(
      produce((s) => {
        const existingIndex = s.history.findIndex((h) => h.fileId === fileId);
        if (existingIndex !== -1) {
          s.history.splice(existingIndex, 1);
        }

        s.history.unshift({
          fileId,
          path,
          name,
          timestamp: Date.now(),
        });

        if (s.history.length > HISTORY_LIMIT) {
          s.history = s.history.slice(0, HISTORY_LIMIT);
        }
      })
    );
    saveHistory();
  };

  const removeFromHistory = (fileId: string) => {
    setState(
      produce((s) => {
        s.history = s.history.filter((h) => h.fileId !== fileId);
      })
    );
    saveHistory();
  };

  const getFilteredHistory = (): TabHistoryEntry[] => {
    const q = state.query.trim();
    if (!q) {
      return state.history;
    }

    return state.history
      .map((entry) => ({
        entry,
        ...fuzzyMatch(q, entry.name),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.entry);
  };

  const open = (direction: "forward" | "backward" = "forward") => {
    const filtered = getFilteredHistory();
    const initialIndex = direction === "forward" ? Math.min(1, filtered.length - 1) : filtered.length - 1;

    setState({
      isOpen: true,
      selectedIndex: Math.max(0, initialIndex),
      query: "",
      direction,
    });
    setCtrlHeld(true);
  };

  const close = () => {
    setState({
      isOpen: false,
      selectedIndex: 0,
      query: "",
    });
    setCtrlHeld(false);
  };

  const confirm = () => {
    const filtered = getFilteredHistory();
    const selected = filtered[state.selectedIndex];
    if (selected) {
      window.dispatchEvent(
        new CustomEvent("tab-switcher:select", {
          detail: { fileId: selected.fileId, path: selected.path },
        })
      );
    }
    close();
  };

  const selectNext = () => {
    const filtered = getFilteredHistory();
    setState("selectedIndex", (i) => Math.min(i + 1, filtered.length - 1));
  };

  const selectPrevious = () => {
    setState("selectedIndex", (i) => Math.max(i - 1, 0));
  };

  const selectIndex = (index: number) => {
    setState("selectedIndex", index);
  };

  const setQuery = (query: string) => {
    setState("query", query);
    setState("selectedIndex", 0);
  };

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab" && e.ctrlKey) {
        e.preventDefault();

        if (!state.isOpen) {
          if (e.shiftKey) {
            open("backward");
          } else {
            open("forward");
          }
        } else {
          if (e.shiftKey) {
            selectPrevious();
          } else {
            selectNext();
          }
        }
        return;
      }

      if (state.isOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();
          confirm();
          return;
        }

        if (e.key === "ArrowDown") {
          e.preventDefault();
          selectNext();
          return;
        }

        if (e.key === "ArrowUp") {
          e.preventDefault();
          selectPrevious();
          return;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" && state.isOpen && ctrlHeld()) {
        confirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp);
    });
  });

  const value: TabSwitcherContextValue = {
    state,
    open,
    close,
    confirm,
    selectNext,
    selectPrevious,
    selectIndex,
    setQuery,
    recordTabAccess,
    removeFromHistory,
    getFilteredHistory,
  };

  return (
    <TabSwitcherContext.Provider value={value}>
      {props.children}
    </TabSwitcherContext.Provider>
  );
}

export function useTabSwitcher() {
  const context = useContext(TabSwitcherContext);
  if (!context) {
    throw new Error("useTabSwitcher must be used within TabSwitcherProvider");
  }
  return context;
}
