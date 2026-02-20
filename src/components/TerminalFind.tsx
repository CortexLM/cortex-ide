import { createSignal, createEffect, Show, onMount, onCleanup, batch, type JSX } from "solid-js";
import { Icon } from "./ui/Icon";
import type { SearchAddon } from "@xterm/addon-search";
import type { Terminal as XTerm } from "@xterm/xterm";
import { IconButton } from "@/components/ui";
import { tokens } from '@/design-system/tokens';

interface TerminalFindProps {
  searchAddon: SearchAddon | null;
  terminal: XTerm | null;
  isVisible: boolean;
  onClose: () => void;
}

// Persist search state across open/close cycles
let persistedQuery = "";
let persistedCaseSensitive = false;
let persistedWholeWord = false;
let persistedUseRegex = false;

export function TerminalFind(props: TerminalFindProps) {
  const [query, setQuery] = createSignal(persistedQuery);
  const [caseSensitive, setCaseSensitive] = createSignal(persistedCaseSensitive);
  const [wholeWord, setWholeWord] = createSignal(persistedWholeWord);
  const [useRegex, setUseRegex] = createSignal(persistedUseRegex);
  const [matchIndex, setMatchIndex] = createSignal(0);
  const [matchCount, setMatchCount] = createSignal(0);
  const [isAnimating, setIsAnimating] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  
  let inputRef: HTMLInputElement | undefined;
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  // Persist state when values change
  createEffect(() => {
    persistedQuery = query();
    persistedCaseSensitive = caseSensitive();
    persistedWholeWord = wholeWord();
    persistedUseRegex = useRegex();
  });

  // Handle visibility changes
  createEffect(() => {
    if (props.isVisible) {
      setIsAnimating(true);
      // Restore persisted values
      setQuery(persistedQuery);
      setCaseSensitive(persistedCaseSensitive);
      setWholeWord(persistedWholeWord);
      setUseRegex(persistedUseRegex);
      
      // Focus input and trigger search
      setTimeout(() => {
        inputRef?.focus();
        inputRef?.select();
        if (query()) {
          performSearch(query());
        }
      }, 50);
    } else {
      // Clear decorations when hiding
      clearSearch();
    }
  });

  // Search when query or options change
  createEffect(() => {
    const q = query();
    const cs = caseSensitive();
    const re = useRegex();
    const ww = wholeWord();
    
    // Track all dependencies
    void cs;
    void re;
    void ww;
    
    if (props.isVisible && props.searchAddon) {
      // Debounce search
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      searchTimeout = setTimeout(() => {
        performSearch(q);
      }, 100);
    }
  });

  const getSearchOptions = () => ({
    caseSensitive: caseSensitive(),
    wholeWord: wholeWord(),
    regex: useRegex(),
    incremental: true,
    decorations: {
      matchBackground: "var(--cortex-info)44",
      matchBorder: "var(--cortex-info)88",
      matchOverviewRuler: "var(--cortex-info)",
      activeMatchBackground: "var(--cortex-warning)66",
      activeMatchBorder: "var(--cortex-warning)",
      activeMatchColorOverviewRuler: "var(--cortex-warning)",
    },
  });

  const performSearch = (searchQuery: string) => {
    if (!props.searchAddon) return;
    
    setSearchError(null);
    
    if (!searchQuery) {
      batch(() => {
        setMatchCount(0);
        setMatchIndex(0);
      });
      props.searchAddon.clearDecorations();
      return;
    }

    try {
      // Validate regex if regex mode is enabled
      if (useRegex()) {
        try {
          new RegExp(searchQuery);
        } catch {
          setSearchError("Invalid regex");
          batch(() => {
            setMatchCount(0);
            setMatchIndex(0);
          });
          props.searchAddon.clearDecorations();
          return;
        }
      }

      // Perform search and get result
      const found = props.searchAddon.findNext(searchQuery, getSearchOptions());
      
      // Count total matches by searching through buffer
      if (props.terminal) {
        const count = countMatches(searchQuery);
        batch(() => {
          setMatchCount(count);
          if (found) {
            setMatchIndex(count > 0 ? 1 : 0);
          } else {
            setMatchIndex(0);
          }
        });
      }
    } catch (e) {
      console.error("Terminal search error:", e);
      setSearchError("Search error");
      batch(() => {
        setMatchCount(0);
        setMatchIndex(0);
      });
    }
  };

  const countMatches = (searchQuery: string): number => {
    if (!props.terminal || !searchQuery) return 0;
    
    try {
      const buffer = props.terminal.buffer.active;
      let count = 0;
      let pattern: RegExp;
      
      // Build search pattern
      if (useRegex()) {
        try {
          pattern = new RegExp(searchQuery, caseSensitive() ? "g" : "gi");
        } catch {
          return 0;
        }
      } else {
        // Escape special regex characters for literal search
        const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const finalPattern = wholeWord() ? `\\b${escaped}\\b` : escaped;
        pattern = new RegExp(finalPattern, caseSensitive() ? "g" : "gi");
      }
      
      // Search through all lines in buffer
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          const text = line.translateToString(true);
          const matches = text.match(pattern);
          if (matches) {
            count += matches.length;
          }
        }
      }
      
      // Limit count display
      return Math.min(count, 9999);
    } catch {
      return 0;
    }
  };

  const findNext = () => {
    if (!props.searchAddon || !query()) return;
    
    const found = props.searchAddon.findNext(query(), getSearchOptions());
    if (found && matchCount() > 0) {
      setMatchIndex((prev) => {
        const next = prev >= matchCount() ? 1 : prev + 1;
        return next;
      });
    }
  };

  const findPrevious = () => {
    if (!props.searchAddon || !query()) return;
    
    const found = props.searchAddon.findPrevious(query(), getSearchOptions());
    if (found && matchCount() > 0) {
      setMatchIndex((prev) => {
        const next = prev <= 1 ? matchCount() : prev - 1;
        return next;
      });
    }
  };

  const clearSearch = () => {
    if (props.searchAddon) {
      props.searchAddon.clearDecorations();
    }
    batch(() => {
      setMatchCount(0);
      setMatchIndex(0);
    });
  };

  const handleClose = () => {
    clearSearch();
    props.onClose();
    // Return focus to terminal
    props.terminal?.focus();
  };

  // Handle keyboard shortcuts within the find widget
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.isVisible) return;
    
    // Escape to close
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
      return;
    }
    
    // Enter for next match, Shift+Enter for previous
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        findPrevious();
      } else {
        findNext();
      }
      return;
    }
    
    // F3 / Shift+F3 for next/previous
    if (e.key === "F3") {
      e.preventDefault();
      if (e.shiftKey) {
        findPrevious();
      } else {
        findNext();
      }
      return;
    }
    
    // Alt+C for case sensitive toggle
    if (e.altKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      setCaseSensitive(!caseSensitive());
      return;
    }
    
    // Alt+W for whole word toggle
    if (e.altKey && e.key.toLowerCase() === "w") {
      e.preventDefault();
      setWholeWord(!wholeWord());
      return;
    }
    
    // Alt+R for regex toggle
    if (e.altKey && e.key.toLowerCase() === "r") {
      e.preventDefault();
      setUseRegex(!useRegex());
      return;
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown, true);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown, true);
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    clearSearch();
  });

  const handleInputKeyDown = (e: KeyboardEvent) => {
    // Prevent terminal from receiving key events while typing in search
    e.stopPropagation();
    
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        findPrevious();
      } else {
        findNext();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
    }
  };

  const matchCountText = () => {
    if (searchError()) return searchError();
    if (!query()) return "";
    if (matchCount() === 0) return "No results";
    return `${matchIndex()} of ${matchCount()}`;
  };

  // Styles using JSX.CSSProperties for JetBrains design tokens
  const containerStyle: JSX.CSSProperties = {
    position: "absolute",
    top: "0",
    right: "0",
    margin: tokens.spacing.md,
    width: "360px",
    "border-radius": "var(--jb-radius-lg)",
    "box-shadow": "var(--jb-shadow-popup)",
    overflow: "hidden",
    background: "var(--jb-popup)",
    "z-index": "33",
    animation: isAnimating() ? "slide-in 150ms ease-out forwards" : "none",
  };

  const searchRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.md,
    padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
    "border-bottom": `1px solid ${tokens.colors.border.divider}`,
  };

  const inputWrapperStyle: JSX.CSSProperties = {
    flex: "1",
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.md,
    padding: `0 ${tokens.spacing.lg}`,
    height: "32px",
    "border-radius": tokens.radius.sm,
    background: "var(--jb-input-bg)",
    border: searchError() ? `1px solid ${tokens.colors.semantic.error}` : "var(--jb-input-border)",
  };

  const inputStyle: JSX.CSSProperties = {
    flex: "1",
    background: "transparent",
    border: "none",
    outline: "none",
    "font-size": "var(--jb-text-body-size)",
    "font-family": "var(--jb-font-ui)",
    color: tokens.colors.text.primary,
    "min-width": "0",
  };

  const matchCountStyle: JSX.CSSProperties = {
    "font-size": "var(--jb-text-muted-size)",
    "flex-shrink": "0",
    "min-width": "70px",
    "text-align": "center",
    "font-family": "var(--jb-font-mono)",
    color: searchError()
      ? tokens.colors.semantic.error
      : matchCount() > 0
        ? tokens.colors.text.primary
        : tokens.colors.text.muted,
  };

  const navButtonsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "2px",
  };

  const optionsRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
    "border-bottom": `1px solid ${tokens.colors.border.divider}`,
  };

  const toggleButtonStyle = (active: boolean): JSX.CSSProperties => ({
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    "font-size": "var(--jb-text-muted-size)",
    "border-radius": tokens.radius.sm,
    "font-weight": "500",
    border: "none",
    cursor: "pointer",
    transition: "background var(--cortex-transition-fast), color var(--cortex-transition-fast)",
    background: active ? tokens.colors.semantic.primary : "transparent",
    color: active ? "var(--jb-btn-primary-color)" : tokens.colors.text.muted,
  });

  const hintsRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: `6px ${tokens.spacing.lg}`,
    "font-size": "10px",
    background: "var(--jb-app-root)",
    color: tokens.colors.text.muted,
  };

  const kbdStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-mono)",
    padding: `1px ${tokens.spacing.sm}`,
    "border-radius": tokens.radius.sm,
    background: tokens.colors.interactive.selected,
    "margin-right": "2px",
  };

  return (
    <Show when={props.isVisible}>
      <div
        style={containerStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search row */}
        <div style={searchRowStyle}>
          <div style={inputWrapperStyle}>
            <Icon
              name="magnifying-glass"
              style={{ 
                width: "16px", 
                height: "16px", 
                "flex-shrink": "0",
                color: tokens.colors.icon.default,
              }}
            />
            <input
              ref={inputRef}
              type="text"
              placeholder="Find in terminal..."
              style={inputStyle}
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={handleInputKeyDown}
            />
          </div>

          {/* Match count */}
          <span style={matchCountStyle}>
            {matchCountText()}
          </span>

          {/* Navigation */}
          <div style={navButtonsStyle}>
            <IconButton
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                findPrevious();
              }}
              disabled={matchCount() === 0}
              tooltip="Previous match (Shift+Enter or Shift+F3)"
            >
              <Icon name="chevron-up" />
            </IconButton>
            <IconButton
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                findNext();
              }}
              disabled={matchCount() === 0}
              tooltip="Next match (Enter or F3)"
            >
              <Icon name="chevron-down" />
            </IconButton>
          </div>

          {/* Close */}
          <IconButton
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            tooltip="Close (Escape)"
          >
            <Icon name="xmark" />
          </IconButton>
        </div>

        {/* Options row */}
        <div style={optionsRowStyle}>
          <button
            style={toggleButtonStyle(caseSensitive())}
            onClick={(e) => {
              e.stopPropagation();
              setCaseSensitive(!caseSensitive());
            }}
            title="Case Sensitive (Alt+C)"
          >
            Aa
          </button>
          <button
            style={toggleButtonStyle(wholeWord())}
            onClick={(e) => {
              e.stopPropagation();
              setWholeWord(!wholeWord());
            }}
            title="Whole Word (Alt+W)"
          >
            W
          </button>
          <button
            style={toggleButtonStyle(useRegex())}
            onClick={(e) => {
              e.stopPropagation();
              setUseRegex(!useRegex());
            }}
            title="Regular Expression (Alt+R)"
          >
            .*
          </button>
        </div>

        {/* Keyboard hints */}
        <div style={hintsRowStyle}>
          <span>
            <kbd style={kbdStyle}>Enter</kbd> next •{" "}
            <kbd style={kbdStyle}>Shift+Enter</kbd> prev •{" "}
            <kbd style={kbdStyle}>F3</kbd>
          </span>
          <span>
            <kbd style={kbdStyle}>Esc</kbd> close
          </span>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Show>
  );
}

/** Get the current persisted search query */
export function getPersistedSearchQuery(): string {
  return persistedQuery;
}

export default TerminalFind;

