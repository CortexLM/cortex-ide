import { createSignal, createEffect, For, Show, onMount, onCleanup, JSX } from "solid-js";
import { useCommands } from "@/context/CommandContext";
import { Icon } from "./ui/Icon";

// Local storage key for recent commands
const RECENT_COMMANDS_KEY = "command-palette-recent";
const MAX_RECENT_COMMANDS = 5;

// Get recent commands from localStorage
function getRecentCommands(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_COMMANDS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save recent commands to localStorage
function addRecentCommand(commandId: string): void {
  try {
    const recent = getRecentCommands().filter(id => id !== commandId);
    recent.unshift(commandId);
    localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_COMMANDS)));
  } catch {
    // Ignore localStorage errors
  }
}

// Fuzzy match with character indices for highlighting
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
        score += 10; // Consecutive bonus
      }
      if (i === 0 || /[\s_\-/]/.test(text[i - 1])) {
        score += 5; // Word boundary bonus
      }
      score += 1;
      lastMatchIndex = i;
      queryIndex++;
    }
  }
  
  if (queryIndex === query.length) {
    score += Math.max(0, 50 - text.length); // Shorter text bonus
    return { score, matches };
  }
  
  return { score: 0, matches: [] };
}

// Highlight matches with subtle styling
function highlightMatches(text: string, matches: number[]): JSX.Element {
  if (!matches || matches.length === 0) {
    return <>{text}</>;
  }
  
  const result: JSX.Element[] = [];
  let lastIndex = 0;
  
  for (const matchIndex of matches) {
    if (matchIndex > lastIndex) {
      result.push(<span>{text.slice(lastIndex, matchIndex)}</span>);
    }
    result.push(
      <span style={{
        "font-weight": "600",
        color: "var(--jb-text-body-color)",
      }}>{text[matchIndex]}</span>
    );
    lastIndex = matchIndex + 1;
  }
  
  if (lastIndex < text.length) {
    result.push(<span>{text.slice(lastIndex)}</span>);
  }
  
  return <>{result}</>;
}

export function CommandPalette() {
  const { commands, showCommandPalette, setShowCommandPalette, executeCommand } = useCommands();
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [_isVisible, setIsVisible] = createSignal(false);
  const [recentCommandIds, setRecentCommandIds] = createSignal<string[]>([]);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  // Load recent commands on mount
  onMount(() => {
    setRecentCommandIds(getRecentCommands());
  });

  // Get recent commands with full data
  const recentCommands = () => {
    const cmds = commands();
    const recentIds = recentCommandIds();
    return recentIds
      .map(id => cmds.find(cmd => cmd.id === id))
      .filter((cmd): cmd is NonNullable<typeof cmd> => cmd !== undefined)
      .map(cmd => ({ ...cmd, matches: [] as number[], isRecent: true }));
  };

  const filteredCommands = () => {
    const q = query().trim();
    const cmds = commands();
    const recentIds = recentCommandIds();
    
    if (!q) {
      // When no query, show recent commands at top, then rest (excluding duplicates)
      const recent = recentCommands();
      const recentIdSet = new Set(recentIds);
      const rest = cmds
        .filter(cmd => !recentIdSet.has(cmd.id))
        .map(cmd => ({ ...cmd, matches: [] as number[], isRecent: false }));
      return { recent, rest };
    }
    
    // When searching, just return filtered results
    const results = cmds
      .map((cmd) => {
        const labelMatch = fuzzyMatch(q, cmd.label);
        const categoryMatch = cmd.category ? fuzzyMatch(q, cmd.category) : { score: 0, matches: [] };
        const bestScore = Math.max(labelMatch.score, categoryMatch.score);
        return {
          ...cmd,
          score: bestScore,
          matches: labelMatch.score >= categoryMatch.score ? labelMatch.matches : [],
          isRecent: false,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
    
    return { recent: [], rest: results };
  };

  // Get all commands as a flat list for keyboard navigation
  const allCommandsList = () => {
    const { recent, rest } = filteredCommands();
    return [...recent, ...rest];
  };

  // Handle animation states
  createEffect(() => {
    if (showCommandPalette()) {
      setIsVisible(true);
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef?.focus(), 10);
    } else {
      setIsVisible(false);
    }
  });

  // Reset selection when query changes
  createEffect(() => {
    query();
    setSelectedIndex(0);
  });

  // Scroll selected item into view
  createEffect(() => {
    const index = selectedIndex();
    if (listRef) {
      const items = listRef.querySelectorAll("[data-command-item]");
      const selectedItem = items[index] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  });

  // Global escape handler
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && showCommandPalette()) {
      e.preventDefault();
      setShowCommandPalette(false);
    }
  };
  
  // Handle toggle event from Monaco editor
  const handleToggleEvent = () => {
    setShowCommandPalette(!showCommandPalette());
  };

  onMount(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("command-palette:toggle", handleToggleEvent);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleGlobalKeyDown);
    window.removeEventListener("command-palette:toggle", handleToggleEvent);
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    const cmds = allCommandsList();
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, cmds.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = cmds[selectedIndex()];
      if (cmd) {
        handleSelect(cmd.id);
      }
    }
  };

  const handleSelect = (id: string) => {
    addRecentCommand(id);
    setRecentCommandIds(getRecentCommands());
    setShowCommandPalette(false);
    executeCommand(id);
  };

  // Parse shortcut into keybinding keys for VS Code styling
  const parseShortcut = (shortcut: string): string[] => {
    return shortcut.split(/\s*\+\s*/).map(key => key.trim());
  };

  // JetBrains styled popup container
  const popupStyle: JSX.CSSProperties = {
    position: "fixed",
    top: "44px",
    width: "420px",
    "max-width": "calc(100vw - 32px)",
    "z-index": "2550",
    left: "50%",
    transform: "translateX(-50%)",
    "border-radius": "var(--cortex-radius-md)",
    "font-size": "11px",
    "-webkit-app-region": "no-drag",
    background: "var(--ui-panel-bg)",
    color: "var(--jb-text-body-color)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    "box-shadow": "0 4px 16px rgba(0, 0, 0, 0.3)",
    overflow: "hidden",
  };

  // Backdrop style
  const backdropStyle: JSX.CSSProperties = {
    position: "fixed",
    inset: "0",
    "z-index": "2549",
    background: "transparent",
  };

  // List item base style
  const listItemBaseStyle = (isSelected: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "6px",
    height: "24px",
    padding: "0 8px",
    margin: "1px 4px",
    "border-radius": "var(--cortex-radius-sm)",
    background: isSelected ? "rgba(255, 255, 255, 0.08)" : "transparent",
    color: "var(--jb-text-body-color)",
    cursor: "pointer",
    transition: "background 80ms ease",
    "user-select": "none",
    "font-size": "11px",
  });

  // Keybinding container style
  const keybindingStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "line-height": "10px",
    "margin-left": "auto",
    "font-size": "9px",
    color: "var(--jb-text-muted-color)",
    "font-family": "'SF Mono', 'JetBrains Mono', monospace",
  };

  // Keybinding key style
  const keybindingKeyStyle: JSX.CSSProperties = {
    display: "inline-flex",
    "align-items": "center",
    "border-radius": "var(--cortex-radius-sm)",
    "justify-content": "center",
    "min-width": "14px",
    "font-size": "9px",
    padding: "1px 4px",
    margin: "0 1px",
    "font-family": "inherit",
    background: "rgba(255, 255, 255, 0.06)",
    color: "var(--jb-text-muted-color)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
  };

  // Section header style
  const sectionHeaderStyle: JSX.CSSProperties = {
    height: "18px",
    padding: "0 8px",
    "font-size": "9px",
    "font-weight": "500",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: "var(--jb-text-muted-color)",
    display: "flex",
    "align-items": "center",
  };

  // Separator style
  const separatorStyle: JSX.CSSProperties = {
    height: "1px",
    margin: "4px 8px",
    background: "var(--jb-border-default)",
  };

  return (
    <Show when={showCommandPalette()}>
      {/* Backdrop */}
      <div 
        style={backdropStyle}
        onClick={() => setShowCommandPalette(false)}
      />
      
      {/* Command Palette Popup */}
      <div 
        style={popupStyle}
        role="dialog"
        aria-label="Command Palette"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with input */}
        <div style={{ 
          display: "flex", 
          "align-items": "center",
          padding: "6px 8px",
          gap: "6px",
          "border-bottom": "1px solid rgba(255, 255, 255, 0.06)",
        }}>
<Icon name="magnifying-glass" size={10} style={{ 
            color: "var(--jb-text-muted-color)",
            "flex-shrink": "0",
          }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command..."
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            aria-haspopup="menu"
            aria-autocomplete="list"
            aria-controls="quick-input-list"
            style={{
              flex: "1",
              height: "18px",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--jb-text-body-color)",
              "font-size": "11px",
            }}
          />
        </div>

        {/* Results list */}
        <div 
          id="quick-input-list"
          role="listbox"
          style={{ "line-height": "18px" }}
        >
          <div 
            ref={listRef}
            style={{ 
              "max-height": "280px", 
              overflow: "auto", 
              "overscroll-behavior": "contain",
              "padding-bottom": "3px",
            }}
          >
            <Show when={allCommandsList().length === 0}>
              <div style={{ padding: "10px", "text-align": "center", "font-size": "10px", color: "var(--jb-text-muted-color)" }}>
                No commands found
              </div>
            </Show>

            <div style={{ padding: "0 6px" }}>
              {/* Recent Commands Section */}
              <Show when={filteredCommands().recent.length > 0}>
                <div style={sectionHeaderStyle}>Recently Used</div>
                <For each={filteredCommands().recent}>
                  {(cmd, idx) => {
                    const flatIndex = () => idx();
                    const isSelected = () => flatIndex() === selectedIndex();
                    return (
                      <div
                        data-command-item
                        style={listItemBaseStyle(isSelected())}
                        role="option"
                        aria-selected={isSelected()}
                        onMouseEnter={(e) => {
                          setSelectedIndex(flatIndex());
                          (e.currentTarget as HTMLElement).style.background = "rgba(255, 255, 255, 0.08)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected()) {
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                          }
                        }}
                        onClick={() => handleSelect(cmd.id)}
                      >
<Icon name="command" size={10} style={{ 
                        color: "var(--jb-text-muted-color)",
                        "flex-shrink": "0",
                      }} />
                        <span style={{ 
                          "font-size": "10px", 
                          color: "var(--jb-text-muted-color)",
                          "white-space": "nowrap",
                        }}>
                          {cmd.category || "General"}
                        </span>
                        <span style={{ 
                          flex: "1",
                          overflow: "hidden",
                          "text-overflow": "ellipsis",
                          "white-space": "nowrap",
                        }}>
                          {highlightMatches(cmd.label, cmd.matches || [])}
                        </span>
                        <Show when={cmd.shortcut}>
                          <div style={keybindingStyle}>
                            <For each={parseShortcut(cmd.shortcut!)}>
                              {(key, keyIndex) => (
                                <>
                                  <Show when={keyIndex() > 0}>
                                    <span style={{ margin: "0 2px" }}>+</span>
                                  </Show>
                                  <span style={keybindingKeyStyle}>{key}</span>
                                </>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    );
                  }}
                </For>
                {/* Separator between recent and all commands */}
                <Show when={filteredCommands().rest.length > 0}>
                  <div style={separatorStyle} />
                </Show>
              </Show>

              {/* All Commands Section */}
              <For each={filteredCommands().rest}>
                {(cmd, idx) => {
                  const flatIndex = () => (filteredCommands().recent?.length ?? 0) + idx();
                  const isSelected = () => flatIndex() === selectedIndex();
                  return (
                    <div
                      data-command-item
                      style={listItemBaseStyle(isSelected())}
                      role="option"
                      aria-selected={isSelected()}
                      onMouseEnter={(e) => {
                        setSelectedIndex(flatIndex());
                        (e.currentTarget as HTMLElement).style.background = "rgba(255, 255, 255, 0.08)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected()) {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                        }
                      }}
                      onClick={() => handleSelect(cmd.id)}
                    >
<Icon name="command" size={10} style={{ 
                        color: "var(--jb-text-muted-color)",
                        "flex-shrink": "0",
                      }} />
                      <span style={{ 
                        "font-size": "10px", 
                        color: "var(--jb-text-muted-color)",
                        "white-space": "nowrap",
                      }}>
                        {cmd.category || "General"}
                      </span>
                      <span style={{ 
                        flex: "1",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                      }}>
                        {highlightMatches(cmd.label, cmd.matches || [])}
                      </span>
                      <Show when={cmd.shortcut}>
                        <div style={keybindingStyle}>
                          <For each={parseShortcut(cmd.shortcut!)}>
                            {(key, keyIndex) => (
                              <>
                                <Show when={keyIndex() > 0}>
                                  <span style={{ margin: "0 2px" }}>+</span>
                                </Show>
                                <span style={keybindingKeyStyle}>{key}</span>
                              </>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

