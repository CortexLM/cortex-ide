import { createSignal, createEffect, For, Show, onMount, onCleanup, JSX } from "solid-js";
import { useCommands } from "@/context/CommandContext";
import { Icon } from "./ui/Icon";

// ============================================================================
// Types
// ============================================================================

interface ViewItem {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: "sidebar" | "panel" | "editor" | "other";
  shortcut?: string;
  action: () => void;
}

// ============================================================================
// Fuzzy Matching
// ============================================================================

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
      if (i === 0 || /[\s_\-/]/.test(text[i - 1])) {
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

function highlightMatches(text: string, matches: number[]): JSX.Element {
  if (!matches || matches.length === 0) {
    return <span>{text}</span>;
  }
  
  const result: JSX.Element[] = [];
  let lastIndex = 0;
  
  for (const matchIndex of matches) {
    if (matchIndex > lastIndex) {
      result.push(<span>{text.slice(lastIndex, matchIndex)}</span>);
    }
    result.push(
      <span class="text-accent-primary font-semibold">{text[matchIndex]}</span>
    );
    lastIndex = matchIndex + 1;
  }
  
  if (lastIndex < text.length) {
    result.push(<span>{text.slice(lastIndex)}</span>);
  }
  
  return <>{result}</>;
}

// ============================================================================
// View Definitions
// ============================================================================

function createViewItems(): ViewItem[] {
  return [
    // Sidebar Views
    {
      id: "view.explorer",
      label: "File Explorer",
      description: "Browse and manage project files",
      icon: "folder",
      category: "sidebar",
      shortcut: "Ctrl+Shift+E",
      action: () => {
        window.dispatchEvent(new CustomEvent("view:focus", { detail: { view: "files", type: "sidebar" } }));
      },
    },
    {
      id: "view.search",
      label: "Search",
      description: "Search across all files in the project",
      icon: "magnifying-glass",
      category: "sidebar",
      shortcut: "Ctrl+Shift+F",
      action: () => {
        window.dispatchEvent(new CustomEvent("view:focus", { detail: { view: "search", type: "sidebar" } }));
      },
    },
    {
      id: "view.sourceControl",
      label: "Source Control",
      description: "Git version control and changes",
      icon: "code-branch",
      category: "sidebar",
      shortcut: "Ctrl+Shift+G",
      action: () => {
        window.dispatchEvent(new CustomEvent("view:focus", { detail: { view: "git", type: "sidebar" } }));
      },
    },
    {
      id: "view.debug",
      label: "Run and Debug",
      description: "Debug configurations and controls",
      icon: "play",
      category: "sidebar",
      shortcut: "Ctrl+Shift+D",
      action: () => {
        window.dispatchEvent(new CustomEvent("view:focus", { detail: { view: "debug", type: "sidebar" } }));
      },
    },
    {
      id: "view.extensions",
      label: "Extensions",
      description: "Manage installed extensions",
      icon: "box",
      category: "sidebar",
      shortcut: "Ctrl+Shift+X",
      action: () => {
        window.dispatchEvent(new CustomEvent("view:focus", { detail: { view: "extensions", type: "sidebar" } }));
      },
    },
    {
      id: "view.outline",
      label: "Outline",
      description: "Document symbols and structure",
      icon: "list",
      category: "sidebar",
      shortcut: "Ctrl+Shift+O",
      action: () => {
        window.dispatchEvent(new CustomEvent("view:focus", { detail: { view: "outline", type: "sidebar" } }));
      },
    },

    // Bottom Panel Views
    {
      id: "view.terminal",
      label: "Terminal",
      description: "Integrated terminal for command execution",
      icon: "terminal",
      category: "panel",
      shortcut: "Ctrl+`",
      action: () => {
        window.dispatchEvent(new CustomEvent("view:focus", { detail: { view: "terminal", type: "panel" } }));
      },
    },
    {
      id: "view.debugConsole",
      label: "Debug Console",
      description: "Debug output and REPL",
      icon: "code",
      category: "panel",
      action: () => {
        window.dispatchEvent(new CustomEvent("view:focus", { detail: { view: "debug-console", type: "panel" } }));
      },
    },
    {
      id: "view.preview",
      label: "Preview",
      description: "Web preview for development servers",
      icon: "globe",
      category: "panel",
      action: () => {
        window.dispatchEvent(new CustomEvent("view:focus", { detail: { view: "preview", type: "panel" } }));
      },
    },

    // Editor Views
    {
      id: "view.chat",
      label: "Chat",
      description: "AI assistant chat panel",
      icon: "comment",
      category: "editor",
      shortcut: "Ctrl+Shift+C",
      action: () => {
        window.dispatchEvent(new CustomEvent("view:toggle-chat"));
      },
    },

    // Other Views
    {
      id: "view.settings",
      label: "Settings",
      description: "Open application settings",
      icon: "gear",
      category: "other",
      shortcut: "Ctrl+,",
      action: () => {
        window.dispatchEvent(new CustomEvent("settings:open-tab"));
      },
    },
    {
      id: "view.layout.reset",
      label: "Reset Layout",
      description: "Reset window layout to default",
      icon: "table-columns",
      category: "other",
      action: () => {
        window.dispatchEvent(new CustomEvent("layout:reset"));
      },
    },
    {
      id: "view.recentProjects",
      label: "Recent Projects",
      description: "Open a recent project",
      icon: "database",
      category: "other",
      shortcut: "Ctrl+Shift+E",
      action: () => {
        window.dispatchEvent(new CustomEvent("recent-projects:open"));
      },
    },
  ];
}

// ============================================================================
// Category Labels
// ============================================================================

const categoryLabels: Record<ViewItem["category"], string> = {
  sidebar: "Sidebar",
  panel: "Panel",
  editor: "Editor",
  other: "Other",
};

// ============================================================================
// ViewQuickAccess Component
// ============================================================================

export function ViewQuickAccess() {
  const { showViewQuickAccess, setShowViewQuickAccess } = useCommands();
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [isVisible, setIsVisible] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  const viewItems = createViewItems();

  const filteredViews = () => {
    const q = query().trim();
    
    if (!q) {
      return viewItems.map(view => ({ ...view, matches: [] as number[] }));
    }
    
    return viewItems
      .map((view) => {
        const labelMatch = fuzzyMatch(q, view.label);
        const descMatch = fuzzyMatch(q, view.description);
        const bestScore = Math.max(labelMatch.score, descMatch.score);
        return {
          ...view,
          score: bestScore,
          matches: labelMatch.score >= descMatch.score ? labelMatch.matches : [],
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
  };

  const groupedViews = () => {
    const views = filteredViews();
    const groups: Record<string, typeof views> = {};
    
    for (const view of views) {
      const category = view.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(view);
    }
    
    return groups;
  };

  const flattenedViews = () => {
    const groups = groupedViews();
    const result: typeof viewItems & { matches?: number[] }[] = [];
    
    for (const category of ["sidebar", "panel", "editor", "other"]) {
      if (groups[category]) {
        result.push(...groups[category]);
      }
    }
    
    return result;
  };

  createEffect(() => {
    if (showViewQuickAccess()) {
      setIsVisible(true);
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef?.focus(), 10);
    } else {
      setIsVisible(false);
    }
  });

  createEffect(() => {
    query();
    setSelectedIndex(0);
  });

  createEffect(() => {
    const index = selectedIndex();
    if (listRef) {
      const items = listRef.querySelectorAll("[data-view-item]");
      const selectedItem = items[index] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  });

  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && showViewQuickAccess()) {
      e.preventDefault();
      setShowViewQuickAccess(false);
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleGlobalKeyDown);
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    const views = flattenedViews();
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, views.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const view = views[selectedIndex()];
      if (view) {
        setShowViewQuickAccess(false);
        view.action();
      }
    }
  };

  const handleSelect = (view: ViewItem) => {
    setShowViewQuickAccess(false);
    view.action();
  };

  const getGroupHeader = (category: ViewItem["category"], index: number): string | null => {
    const views = flattenedViews();
    if (index === 0 || views[index - 1]?.category !== category) {
      return categoryLabels[category];
    }
    return null;
  };

  return (
    <Show when={showViewQuickAccess()}>
      <div 
        class="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
        classList={{
          "animate-fade-in": isVisible(),
          "animate-fade-out": !isVisible(),
        }}
        style={{ "animation-duration": "150ms" }}
        onClick={() => setShowViewQuickAccess(false)}
      >
        {/* Backdrop */}
        <div class="absolute inset-0 bg-black/50" />
        
        {/* Modal */}
        <div 
          class="relative w-full max-w-[560px] mx-4 rounded-lg shadow-2xl overflow-hidden"
          classList={{
            "animate-scale-in": isVisible(),
          }}
          style={{ 
            background: "var(--surface-raised)",
            "animation-duration": "150ms",
            "box-shadow": "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div 
            class="flex items-center gap-3 px-4 h-[52px] border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <Icon name="eye" class="w-5 h-5 shrink-0" style={{ color: "var(--text-weak)" }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Type to search views..."
              class="flex-1 bg-transparent outline-none h-[40px] text-[14px]"
              style={{ color: "var(--text-base)" }}
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
            />
            <kbd 
              class="text-[11px] px-1.5 py-0.5 rounded font-mono"
              style={{ 
                background: "var(--background-base)",
                color: "var(--text-weaker)",
              }}
            >
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div 
            ref={listRef}
            class="max-h-[400px] overflow-y-auto overscroll-contain"
          >
            <Show when={flattenedViews().length === 0}>
              <div class="px-4 py-8 text-center">
                <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                  No views found
                </p>
              </div>
            </Show>

            <div class="py-1">
              <For each={flattenedViews()}>
                {(view, index) => {
                  const groupHeader = getGroupHeader(view.category, index());
                  
                  return (
                    <>
                      <Show when={groupHeader}>
                        <div 
                          class="px-4 py-2 text-[11px] font-medium uppercase tracking-wide"
                          style={{ color: "var(--text-weaker)" }}
                        >
                          {groupHeader}
                        </div>
                      </Show>
                      <button
                        data-view-item
                        class="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors duration-75"
                        style={{
                          background: index() === selectedIndex() 
                            ? "var(--surface-active)" 
                            : "transparent",
                          color: "var(--text-base)",
                        }}
                        onMouseEnter={() => setSelectedIndex(index())}
                        onClick={() => handleSelect(view)}
                      >
                        <Icon 
                          name={view.icon}
                          class="w-4 h-4 shrink-0" 
                          style={{ color: "var(--text-weak)" }} 
                        />
                        <div class="flex-1 min-w-0">
                          <div class="text-[13px] truncate">
                            {highlightMatches(view.label, view.matches || [])}
                          </div>
                          <div 
                            class="text-[11px] truncate mt-0.5"
                            style={{ color: "var(--text-weaker)" }}
                          >
                            {view.description}
                          </div>
                        </div>
                        <Show when={view.shortcut}>
                          <kbd 
                            class="text-[11px] px-1.5 py-0.5 rounded font-mono shrink-0"
                            style={{ 
                              background: "var(--background-base)",
                              color: "var(--text-weaker)",
                            }}
                          >
                            {view.shortcut}
                          </kbd>
                        </Show>
                      </button>
                    </>
                  );
                }}
              </For>
            </div>
          </div>

          {/* Footer hint */}
          <div 
            class="px-4 py-2 text-[11px] border-t flex items-center gap-4"
            style={{ 
              "border-color": "var(--border-weak)",
              color: "var(--text-weaker)",
            }}
          >
            <span class="flex items-center gap-1">
              <kbd class="px-1 py-0.5 rounded" style={{ background: "var(--background-base)" }}>↑</kbd>
              <kbd class="px-1 py-0.5 rounded" style={{ background: "var(--background-base)" }}>↓</kbd>
              <span>Navigate</span>
            </span>
            <span class="flex items-center gap-1">
              <kbd class="px-1 py-0.5 rounded" style={{ background: "var(--background-base)" }}>Enter</kbd>
              <span>Select</span>
            </span>
          </div>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fade-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes scale-in {
          from { 
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to { 
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 150ms ease-out forwards;
        }
        .animate-fade-out {
          animation: fade-out 150ms ease-in forwards;
        }
        .animate-scale-in {
          animation: scale-in 150ms ease-out forwards;
        }
        .text-accent-primary {
          color: var(--accent-primary);
        }
      `}</style>
    </Show>
  );
}
