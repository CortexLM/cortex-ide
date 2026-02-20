/**
 * FindReplaceWidget - Advanced Find & Replace Component for Cortex IDE
 * 
 * Features:
 * - Search with history navigation
 * - Replace with preview
 * - Toggles: Regex, Case Sensitive, Whole Word, Preserve Case, Search in Selection
 * - Navigation: Find Next/Previous, Replace, Replace All
 * - Match counter (X of Y)
 * - Keyboard shortcuts (Ctrl+F, Ctrl+H, Enter, Shift+Enter, Escape)
 * - Monaco integration for match decorations
 * - Smooth open/close animations
 */

import { 
  createSignal, 
  createEffect, 
  onMount, 
  onCleanup, 
  Show, 
  For,
  createMemo,
  JSX
} from "solid-js";
import type * as Monaco from "monaco-editor";
import {
  FindState,
  FindMatch,
  FindOptions,
  SearchHistory,
  createDefaultFindState,
  createDefaultSearchHistory,
  findAllMatches,
  findNextMatch,
  replaceMatch,
  replaceAllMatches,
  addToSearchHistory,
  getSearchHistory,
  validateRegex,
} from "../../utils/findReplace";

// ============================================================================
// Types
// ============================================================================

export interface FindReplaceWidgetProps {
  /** Monaco editor instance */
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  /** Monaco module reference */
  monaco: typeof Monaco | null;
  /** Initial visibility state */
  initialOpen?: boolean;
  /** Show replace section initially */
  initialShowReplace?: boolean;
  /** Callback when widget is closed */
  onClose?: () => void;
  /** Callback when matches change */
  onMatchesChange?: (count: number, current: number) => void;
}

interface ToggleButtonProps {
  active: boolean;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: JSX.Element;
}

// ============================================================================
// Constants
// ============================================================================

const DECORATION_MATCH = "find-match-decoration";
const DECORATION_CURRENT = "find-current-match-decoration";
const MAX_HISTORY_ITEMS = 20;

// ============================================================================
// Styles
// ============================================================================

const containerStyle = (isVisible: boolean, _showReplace: boolean): JSX.CSSProperties => ({
  position: "absolute",
  top: "0",
  right: "20px",
  width: "420px",
  background: "var(--jb-popup)",
  border: "1px solid var(--jb-border-default)",
  "border-radius": "0 0 var(--jb-radius-md) var(--jb-radius-md)",
  "box-shadow": "var(--jb-shadow-popup)",
  "z-index": "100",
  overflow: "hidden",
  transform: isVisible ? "translateY(0)" : "translateY(-100%)",
  opacity: isVisible ? "1" : "0",
  transition: "transform 150ms ease-out, opacity 150ms ease-out",
  "pointer-events": isVisible ? "auto" : "none",
});

// Reserved for future header styling
// @ts-expect-error Reserved for future use
const _headerStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  padding: "6px 8px",
  gap: "4px",
  "border-bottom": "1px solid var(--jb-border-divider)",
};

const rowStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  padding: "6px 8px",
  gap: "6px",
};

const inputContainerStyle: JSX.CSSProperties = {
  flex: "1",
  position: "relative",
  display: "flex",
  "align-items": "center",
};

const inputStyle = (hasError: boolean): JSX.CSSProperties => ({
  width: "100%",
  height: "26px",
  padding: "0 8px",
  "padding-right": "70px",
  background: "var(--jb-input-bg)",
  border: hasError ? "1px solid var(--jb-border-error)" : "1px solid var(--jb-border-default)",
  "border-radius": "var(--jb-radius-sm)",
  color: "var(--jb-input-color)",
  "font-family": "var(--jb-font-code)",
  "font-size": "12px",
  outline: "none",
  transition: "border-color var(--cortex-transition-fast)",
});

const inputFocusedStyle: JSX.CSSProperties = {
  "border-color": "var(--jb-border-focus)",
};

const togglesContainerStyle: JSX.CSSProperties = {
  position: "absolute",
  right: "4px",
  display: "flex",
  gap: "2px",
};

const toggleButtonStyle = (active: boolean, disabled: boolean): JSX.CSSProperties => ({
  width: "20px",
  height: "20px",
  padding: "0",
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  background: active ? "var(--jb-btn-primary-bg)" : "transparent",
  border: "none",
  "border-radius": "var(--jb-radius-sm)",
  color: active ? "var(--jb-btn-primary-color)" : "var(--jb-icon-color-default)",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? "0.5" : "1",
  transition: "background var(--cortex-transition-fast), color var(--cortex-transition-fast)",
});

const actionButtonStyle = (variant: "primary" | "secondary" | "ghost"): JSX.CSSProperties => ({
  height: "24px",
  padding: "0 8px",
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  gap: "4px",
  background: variant === "primary" 
    ? "var(--jb-btn-primary-bg)" 
    : variant === "secondary" 
      ? "var(--jb-surface-hover)" 
      : "transparent",
  border: variant === "secondary" ? "1px solid var(--jb-border-default)" : "none",
  "border-radius": "var(--jb-radius-sm)",
  color: variant === "primary" ? "var(--jb-btn-primary-color)" : "var(--jb-text-body-color)",
  "font-family": "var(--jb-font-ui)",
  "font-size": "11px",
  cursor: "pointer",
  transition: "background var(--cortex-transition-fast)",
  "white-space": "nowrap",
});

const counterStyle: JSX.CSSProperties = {
  "min-width": "60px",
  "text-align": "center",
  "font-family": "var(--jb-font-code)",
  "font-size": "11px",
  color: "var(--jb-text-muted-color)",
  "flex-shrink": "0",
};

const expandButtonStyle: JSX.CSSProperties = {
  width: "20px",
  height: "20px",
  padding: "0",
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  background: "transparent",
  border: "none",
  "border-radius": "var(--jb-radius-sm)",
  color: "var(--jb-icon-color-default)",
  cursor: "pointer",
  transition: "background var(--cortex-transition-fast), transform 150ms ease",
};

const closeButtonStyle: JSX.CSSProperties = {
  width: "20px",
  height: "20px",
  padding: "0",
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  background: "transparent",
  border: "none",
  "border-radius": "var(--jb-radius-sm)",
  color: "var(--jb-icon-color-default)",
  cursor: "pointer",
  transition: "background var(--cortex-transition-fast)",
  "margin-left": "auto",
};

const historyDropdownStyle: JSX.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: "0",
  right: "0",
  "max-height": "200px",
  overflow: "auto",
  background: "var(--jb-popup)",
  border: "1px solid var(--jb-border-default)",
  "border-radius": "var(--jb-radius-sm)",
  "box-shadow": "var(--jb-shadow-popup)",
  "z-index": "10",
  "margin-top": "2px",
};

const historyItemStyle = (isSelected: boolean): JSX.CSSProperties => ({
  padding: "6px 8px",
  background: isSelected ? "var(--jb-surface-selected)" : "transparent",
  color: "var(--jb-text-body-color)",
  "font-family": "var(--jb-font-code)",
  "font-size": "12px",
  cursor: "pointer",
  "white-space": "nowrap",
  overflow: "hidden",
  "text-overflow": "ellipsis",
});

const errorMessageStyle: JSX.CSSProperties = {
  padding: "4px 8px",
  "font-size": "11px",
  color: "var(--jb-border-error)",
  background: "rgba(241, 76, 76, 0.1)",
  "border-radius": "var(--jb-radius-sm)",
};

// ============================================================================
// Icons (SVG)
// ============================================================================

const ChevronDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const RegexIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <text x="3" y="18" font-size="14" font-family="monospace" fill="currentColor" stroke="none">.*</text>
  </svg>
);

const CaseSensitiveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <text x="2" y="17" font-size="12" font-family="sans-serif" fill="currentColor" stroke="none">Aa</text>
  </svg>
);

const WholeWordIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <text x="1" y="16" font-size="10" font-family="sans-serif" fill="currentColor" stroke="none">ab</text>
    <line x1="1" y1="19" x2="7" y2="19" stroke="currentColor" stroke-width="1.5" />
    <line x1="17" y1="19" x2="23" y2="19" stroke="currentColor" stroke-width="1.5" />
  </svg>
);

const SelectionIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <rect x="6" y="9" width="12" height="2" fill="currentColor" stroke="none" />
    <rect x="6" y="13" width="8" height="2" fill="currentColor" stroke="none" />
  </svg>
);

const PreserveCaseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <text x="2" y="17" font-size="12" font-family="sans-serif" fill="currentColor" stroke="none">AB</text>
  </svg>
);

const ArrowUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const ArrowDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// Reserved for future history dropdown feature
// @ts-expect-error Reserved for future use
const _HistoryIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// ============================================================================
// Sub-components
// ============================================================================

function ToggleButton(props: ToggleButtonProps) {
  const [hovered, setHovered] = createSignal(false);

  const style = (): JSX.CSSProperties => {
    const base = toggleButtonStyle(props.active, props.disabled || false);
    if (hovered() && !props.disabled && !props.active) {
      return { ...base, background: "var(--jb-surface-hover)" };
    }
    return base;
  };

  return (
    <button
      type="button"
      title={props.title}
      disabled={props.disabled}
      style={style()}
      onClick={props.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {props.children}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FindReplaceWidget(props: FindReplaceWidgetProps) {
  // State
  const [isVisible, setIsVisible] = createSignal(props.initialOpen ?? false);
  const [showReplace, setShowReplace] = createSignal(props.initialShowReplace ?? false);
  const [findState, setFindState] = createSignal<FindState>(createDefaultFindState());
  const [searchHistory, setSearchHistory] = createSignal<SearchHistory>(createDefaultSearchHistory(MAX_HISTORY_ITEMS));
  const [matches, setMatches] = createSignal<FindMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = createSignal(-1);
  const [regexError, setRegexError] = createSignal<string | null>(null);
  const [showSearchHistory, setShowSearchHistory] = createSignal(false);
  const [showReplaceHistory, setShowReplaceHistory] = createSignal(false);
  const [historySelectedIndex, setHistorySelectedIndex] = createSignal(0);
  const [searchInputFocused, setSearchInputFocused] = createSignal(false);
  const [replaceInputFocused, setReplaceInputFocused] = createSignal(false);
  
  // Refs
  let searchInputRef: HTMLInputElement | undefined;
  let replaceInputRef: HTMLInputElement | undefined;
  let decorationIds: string[] = [];
  let containerRef: HTMLDivElement | undefined;

  // Memos
  const matchCount = createMemo(() => matches().length);
  const currentMatchNumber = createMemo(() => {
    const idx = currentMatchIndex();
    return idx >= 0 ? idx + 1 : 0;
  });

  const counterText = createMemo(() => {
    const count = matchCount();
    const current = currentMatchNumber();
    if (count === 0) {
      return findState().searchString ? "No results" : "";
    }
    return `${current} of ${count}`;
  });

  // Load history from localStorage
  const loadHistory = () => {
    try {
      const stored = localStorage.getItem("cortex_find_replace_history");
      if (stored) {
        const parsed = JSON.parse(stored);
        setSearchHistory({
          searches: parsed.searches || [],
          replaces: parsed.replaces || [],
          maxItems: MAX_HISTORY_ITEMS,
        });
      }
    } catch (e) {
      console.debug("[FindReplace] Failed to load history:", e);
    }
  };

  // Save history to localStorage
  const saveHistory = () => {
    try {
      const history = searchHistory();
      localStorage.setItem("cortex_find_replace_history", JSON.stringify({
        searches: history.searches,
        replaces: history.replaces,
      }));
    } catch (e) {
      console.debug("[FindReplace] Failed to save history:", e);
    }
  };

  // Update decorations in Monaco
  const updateDecorations = () => {
    const editor = props.editor;
    const monaco = props.monaco;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    const allMatches = matches();
    const currentIdx = currentMatchIndex();
    const decorations: Monaco.editor.IModelDeltaDecoration[] = [];

    allMatches.forEach((match, idx) => {
      const isCurrentMatch = idx === currentIdx;
      decorations.push({
        range: new monaco.Range(
          match.range.startLine + 1,
          match.range.startColumn + 1,
          match.range.endLine + 1,
          match.range.endColumn + 1
        ),
        options: {
          className: isCurrentMatch ? DECORATION_CURRENT : DECORATION_MATCH,
          inlineClassName: isCurrentMatch ? "find-current-inline" : "find-match-inline",
          overviewRuler: {
            color: isCurrentMatch ? "var(--cortex-warning)" : "var(--cortex-warning)",
            position: monaco.editor.OverviewRulerLane.Center,
          },
          minimap: {
            color: isCurrentMatch ? "var(--cortex-warning)" : "var(--cortex-warning)",
            position: monaco.editor.MinimapPosition.Inline,
          },
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    });

    decorationIds = editor.deltaDecorations(decorationIds, decorations);
  };

  // Clear all decorations
  const clearDecorations = () => {
    const editor = props.editor;
    if (editor) {
      decorationIds = editor.deltaDecorations(decorationIds, []);
    }
  };

  // Perform search
  const performSearch = () => {
    const editor = props.editor;
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    const state = findState();
    const searchString = state.searchString;

    // Clear if empty search
    if (!searchString) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      setRegexError(null);
      clearDecorations();
      return;
    }

    // Validate regex if enabled
    if (state.isRegex) {
      const validation = validateRegex(searchString);
      if (!validation.valid) {
        setRegexError(validation.error || "Invalid regex");
        setMatches([]);
        setCurrentMatchIndex(-1);
        clearDecorations();
        return;
      }
    }
    setRegexError(null);

    // Get selection range if searching in selection
    let selectionRange: FindOptions["selectionRange"];
    if (state.searchInSelection) {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        selectionRange = {
          startLine: selection.startLineNumber - 1,
          startColumn: selection.startColumn - 1,
          endLine: selection.endLineNumber - 1,
          endColumn: selection.endColumn - 1,
        };
      }
    }

    // Find all matches
    const text = model.getValue();
    const foundMatches = findAllMatches(text, searchString, {
      isRegex: state.isRegex,
      isCaseSensitive: state.isCaseSensitive,
      isWholeWord: state.isWholeWord,
      searchInSelection: state.searchInSelection,
      selectionRange,
    });

    setMatches(foundMatches);

    // Set current match index
    if (foundMatches.length > 0) {
      const position = editor.getPosition();
      if (position) {
        const result = findNextMatch(foundMatches, {
          line: position.lineNumber - 1,
          column: position.column - 1,
        }, true);
        setCurrentMatchIndex(result ? result.index : 0);
      } else {
        setCurrentMatchIndex(0);
      }
    } else {
      setCurrentMatchIndex(-1);
    }
  };

  // Navigate to current match
  const navigateToCurrentMatch = () => {
    const editor = props.editor;
    const monaco = props.monaco;
    if (!editor || !monaco) return;

    const allMatches = matches();
    const idx = currentMatchIndex();
    if (idx < 0 || idx >= allMatches.length) return;

    const match = allMatches[idx];
    const range = new monaco.Range(
      match.range.startLine + 1,
      match.range.startColumn + 1,
      match.range.endLine + 1,
      match.range.endColumn + 1
    );

    editor.setSelection(range);
    editor.revealRangeInCenter(range);
  };

  // Find next match
  const findNext = () => {
    const allMatches = matches();
    if (allMatches.length === 0) return;

    const nextIdx = (currentMatchIndex() + 1) % allMatches.length;
    setCurrentMatchIndex(nextIdx);
    navigateToCurrentMatch();
  };

  // Find previous match
  const findPrevious = () => {
    const allMatches = matches();
    if (allMatches.length === 0) return;

    const prevIdx = (currentMatchIndex() - 1 + allMatches.length) % allMatches.length;
    setCurrentMatchIndex(prevIdx);
    navigateToCurrentMatch();
  };

  // Replace current match
  const replaceCurrent = () => {
    const editor = props.editor;
    const monaco = props.monaco;
    if (!editor || !monaco) return;

    const allMatches = matches();
    const idx = currentMatchIndex();
    if (idx < 0 || idx >= allMatches.length) return;

    const model = editor.getModel();
    if (!model) return;

    const state = findState();
    const match = allMatches[idx];

    // Perform replacement (we use executeEdits below, so just call for validation)
    const text = model.getValue();
    replaceMatch(text, match, state.replaceString, {
      isRegex: state.isRegex,
      preserveCase: state.preserveCase,
    });

    // Apply edit
    editor.executeEdits("find-replace", [{
      range: new monaco.Range(
        match.range.startLine + 1,
        match.range.startColumn + 1,
        match.range.endLine + 1,
        match.range.endColumn + 1
      ),
      text: state.replaceString,
    }]);

    // Re-search and update
    performSearch();

    // Add to history
    if (state.replaceString) {
      const newHistory = addToSearchHistory(searchHistory(), "replace", state.replaceString);
      setSearchHistory(newHistory);
      saveHistory();
    }
  };

  // Replace all matches
  const replaceAll = () => {
    const editor = props.editor;
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    const state = findState();
    if (!state.searchString) return;

    // Get selection range if searching in selection
    let selectionRange: FindOptions["selectionRange"];
    if (state.searchInSelection) {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        selectionRange = {
          startLine: selection.startLineNumber - 1,
          startColumn: selection.startColumn - 1,
          endLine: selection.endLineNumber - 1,
          endColumn: selection.endColumn - 1,
        };
      }
    }

    const text = model.getValue();
    const { newText, replacements } = replaceAllMatches(
      text,
      state.searchString,
      state.replaceString,
      {
        isRegex: state.isRegex,
        isCaseSensitive: state.isCaseSensitive,
        isWholeWord: state.isWholeWord,
        searchInSelection: state.searchInSelection,
        selectionRange,
        preserveCase: state.preserveCase,
      }
    );

    if (replacements > 0) {
      // Apply full text replacement
      editor.setValue(newText);

      // Add to history
      if (state.replaceString) {
        const newHistory = addToSearchHistory(searchHistory(), "replace", state.replaceString);
        setSearchHistory(newHistory);
        saveHistory();
      }
    }

    // Re-search
    performSearch();
  };

  // Open widget
  const open = (withReplace: boolean = false) => {
    setIsVisible(true);
    setShowReplace(withReplace);
    
    // Focus search input and select text
    setTimeout(() => {
      if (searchInputRef) {
        searchInputRef.focus();
        searchInputRef.select();
      }
    }, 50);

    // Get selection from editor as initial search
    const editor = props.editor;
    if (editor) {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const model = editor.getModel();
        if (model) {
          const selectedText = model.getValueInRange(selection);
          // Only use single-line selections
          if (!selectedText.includes("\n") && selectedText.length < 200) {
            setFindState(prev => ({ ...prev, searchString: selectedText }));
          }
        }
      }
    }
  };

  // Close widget
  const close = () => {
    setIsVisible(false);
    clearDecorations();
    setMatches([]);
    setCurrentMatchIndex(-1);
    setShowSearchHistory(false);
    setShowReplaceHistory(false);
    props.onClose?.();

    // Return focus to editor
    props.editor?.focus();
  };

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setFindState(prev => ({ ...prev, searchString: value }));
    setShowSearchHistory(false);
  };

  // Handle replace input change
  const handleReplaceChange = (value: string) => {
    setFindState(prev => ({ ...prev, replaceString: value }));
    setShowReplaceHistory(false);
  };

  // Handle toggle changes
  const toggleOption = (option: keyof Pick<FindState, "isRegex" | "isCaseSensitive" | "isWholeWord" | "searchInSelection" | "preserveCase">) => {
    setFindState(prev => ({ ...prev, [option]: !prev[option] }));
  };

  // Handle keyboard events
  const handleKeyDown = (e: KeyboardEvent) => {
    // Global shortcuts (when widget is visible)
    if (!isVisible()) return;

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }

    // Navigation in history dropdown
    if (showSearchHistory() || showReplaceHistory()) {
      const isSearch = showSearchHistory();
      const history = isSearch 
        ? getSearchHistory(searchHistory(), "search")
        : getSearchHistory(searchHistory(), "replace");

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHistorySelectedIndex(prev => Math.min(prev + 1, history.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHistorySelectedIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const selected = history[historySelectedIndex()];
        if (selected) {
          if (isSearch) {
            setFindState(prev => ({ ...prev, searchString: selected }));
            setShowSearchHistory(false);
          } else {
            setFindState(prev => ({ ...prev, replaceString: selected }));
            setShowReplaceHistory(false);
          }
        }
        return;
      }
    }

    // Enter for find next, Shift+Enter for find previous
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (e.shiftKey) {
        findPrevious();
      } else {
        // Add to search history
        const searchString = findState().searchString;
        if (searchString) {
          const newHistory = addToSearchHistory(searchHistory(), "search", searchString);
          setSearchHistory(newHistory);
          saveHistory();
        }
        findNext();
      }
      return;
    }

    // Ctrl+Shift+1 for replace current (common alternative)
    if (e.key === "1" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault();
      replaceCurrent();
      return;
    }

    // Ctrl+Alt+Enter for replace all
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && e.altKey) {
      e.preventDefault();
      replaceAll();
      return;
    }
  };

  // Global keyboard handler for opening widget
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    // Ctrl+F or Cmd+F: Open find
    if ((e.ctrlKey || e.metaKey) && e.key === "f" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      open(false);
      return;
    }

    // Ctrl+H or Cmd+Option+F: Open find and replace
    if (((e.ctrlKey || e.metaKey) && e.key === "h") || 
        ((e.metaKey) && e.altKey && e.key === "f")) {
      e.preventDefault();
      open(true);
      return;
    }

    // F3 or Cmd+G: Find next
    if (e.key === "F3" || ((e.metaKey) && e.key === "g" && !e.shiftKey)) {
      e.preventDefault();
      if (isVisible()) {
        findNext();
      }
      return;
    }

    // Shift+F3 or Cmd+Shift+G: Find previous
    if ((e.key === "F3" && e.shiftKey) || ((e.metaKey) && e.key === "g" && e.shiftKey)) {
      e.preventDefault();
      if (isVisible()) {
        findPrevious();
      }
      return;
    }
  };

  // Effects
  createEffect(() => {
    // Re-search when options change (access state to create reactive dependency)
    void findState();
    performSearch();
  });

  createEffect(() => {
    // Update decorations when matches or current index change
    matches();
    currentMatchIndex();
    updateDecorations();
  });

  createEffect(() => {
    // Navigate to match when current index changes
    if (currentMatchIndex() >= 0) {
      navigateToCurrentMatch();
    }
  });

  createEffect(() => {
    // Notify parent of match changes
    props.onMatchesChange?.(matchCount(), currentMatchNumber());
  });

  // Lifecycle
  onMount(() => {
    loadHistory();
    
    // Add global keyboard listener
    window.addEventListener("keydown", handleGlobalKeyDown);

    // Listen for custom events to open widget
    const handleOpenFind = () => open(false);
    const handleOpenReplace = () => open(true);
    
    window.addEventListener("editor:open-find", handleOpenFind);
    window.addEventListener("editor:open-replace", handleOpenReplace);

    // Cleanup
    onCleanup(() => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("editor:open-find", handleOpenFind);
      window.removeEventListener("editor:open-replace", handleOpenReplace);
      clearDecorations();
    });
  });

  // Click outside to close history
  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setShowSearchHistory(false);
      setShowReplaceHistory(false);
    }
  };

  createEffect(() => {
    if (showSearchHistory() || showReplaceHistory()) {
      document.addEventListener("click", handleClickOutside);
    } else {
      document.removeEventListener("click", handleClickOutside);
    }
  });

  return (
    <div
      ref={containerRef}
      style={containerStyle(isVisible(), showReplace())}
      onKeyDown={handleKeyDown}
    >
      {/* Search Row */}
      <div style={rowStyle}>
        {/* Expand/Collapse Button */}
        <button
          type="button"
          title={showReplace() ? "Hide Replace" : "Show Replace"}
          style={{
            ...expandButtonStyle,
            transform: showReplace() ? "rotate(180deg)" : "rotate(0deg)",
          }}
          onClick={() => setShowReplace(!showReplace())}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--jb-surface-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <ChevronDownIcon />
        </button>

        {/* Search Input */}
        <div style={inputContainerStyle}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search"
            value={findState().searchString}
            style={{
              ...inputStyle(!!regexError()),
              ...(searchInputFocused() ? inputFocusedStyle : {}),
            }}
            onInput={(e) => handleSearchChange(e.currentTarget.value)}
            onFocus={() => setSearchInputFocused(true)}
            onBlur={() => {
              setSearchInputFocused(false);
              // Delay hiding history to allow clicks
              setTimeout(() => setShowSearchHistory(false), 150);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && !showSearchHistory()) {
                const history = getSearchHistory(searchHistory(), "search");
                if (history.length > 0) {
                  setShowSearchHistory(true);
                  setHistorySelectedIndex(0);
                }
              }
            }}
          />
          
          {/* Toggle Buttons inside input */}
          <div style={togglesContainerStyle}>
            <ToggleButton
              active={findState().isRegex}
              title="Use Regular Expression (Alt+R)"
              onClick={() => toggleOption("isRegex")}
            >
              <RegexIcon />
            </ToggleButton>
            <ToggleButton
              active={findState().isCaseSensitive}
              title="Match Case (Alt+C)"
              onClick={() => toggleOption("isCaseSensitive")}
            >
              <CaseSensitiveIcon />
            </ToggleButton>
            <ToggleButton
              active={findState().isWholeWord}
              title="Match Whole Word (Alt+W)"
              onClick={() => toggleOption("isWholeWord")}
            >
              <WholeWordIcon />
            </ToggleButton>
          </div>

          {/* Search History Dropdown */}
          <Show when={showSearchHistory()}>
            <div style={historyDropdownStyle}>
              <For each={getSearchHistory(searchHistory(), "search")}>
                {(item, index) => (
                  <div
                    style={historyItemStyle(index() === historySelectedIndex())}
                    onClick={() => {
                      setFindState(prev => ({ ...prev, searchString: item }));
                      setShowSearchHistory(false);
                    }}
                    onMouseEnter={() => setHistorySelectedIndex(index())}
                  >
                    {item}
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Match Counter */}
        <span style={counterStyle}>{counterText()}</span>

        {/* Navigation Buttons */}
        <button
          type="button"
          title="Previous Match (Shift+Enter)"
          style={actionButtonStyle("ghost")}
          onClick={findPrevious}
          disabled={matchCount() === 0}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--jb-surface-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <ArrowUpIcon />
        </button>
        <button
          type="button"
          title="Next Match (Enter)"
          style={actionButtonStyle("ghost")}
          onClick={findNext}
          disabled={matchCount() === 0}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--jb-surface-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <ArrowDownIcon />
        </button>

        {/* Selection Toggle */}
        <ToggleButton
          active={findState().searchInSelection}
          title="Find in Selection (Alt+L)"
          onClick={() => toggleOption("searchInSelection")}
        >
          <SelectionIcon />
        </ToggleButton>

        {/* Close Button */}
        <button
          type="button"
          title="Close (Escape)"
          style={closeButtonStyle}
          onClick={close}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--jb-surface-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Regex Error Message */}
      <Show when={regexError()}>
        <div style={{ padding: "0 8px 6px 8px" }}>
          <div style={errorMessageStyle}>{regexError()}</div>
        </div>
      </Show>

      {/* Replace Row */}
      <Show when={showReplace()}>
        <div style={rowStyle}>
          {/* Spacer for alignment */}
          <div style={{ width: "20px", "flex-shrink": "0" }} />

          {/* Replace Input */}
          <div style={inputContainerStyle}>
            <input
              ref={replaceInputRef}
              type="text"
              placeholder="Replace"
              value={findState().replaceString}
              style={{
                ...inputStyle(false),
                "padding-right": "28px",
                ...(replaceInputFocused() ? inputFocusedStyle : {}),
              }}
              onInput={(e) => handleReplaceChange(e.currentTarget.value)}
              onFocus={() => setReplaceInputFocused(true)}
              onBlur={() => {
                setReplaceInputFocused(false);
                setTimeout(() => setShowReplaceHistory(false), 150);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && !showReplaceHistory()) {
                  const history = getSearchHistory(searchHistory(), "replace");
                  if (history.length > 0) {
                    setShowReplaceHistory(true);
                    setHistorySelectedIndex(0);
                  }
                }
              }}
            />

            {/* Preserve Case Toggle */}
            <div style={{ ...togglesContainerStyle, right: "4px" }}>
              <ToggleButton
                active={findState().preserveCase}
                title="Preserve Case (Alt+P)"
                onClick={() => toggleOption("preserveCase")}
              >
                <PreserveCaseIcon />
              </ToggleButton>
            </div>

            {/* Replace History Dropdown */}
            <Show when={showReplaceHistory()}>
              <div style={historyDropdownStyle}>
                <For each={getSearchHistory(searchHistory(), "replace")}>
                  {(item, index) => (
                    <div
                      style={historyItemStyle(index() === historySelectedIndex())}
                      onClick={() => {
                        setFindState(prev => ({ ...prev, replaceString: item }));
                        setShowReplaceHistory(false);
                      }}
                      onMouseEnter={() => setHistorySelectedIndex(index())}
                    >
                      {item}
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Replace Buttons */}
          <button
            type="button"
            title="Replace (Ctrl+Shift+1)"
            style={actionButtonStyle("secondary")}
            onClick={replaceCurrent}
            disabled={matchCount() === 0}
            onMouseEnter={(e) => {
              if (matchCount() > 0) {
                (e.currentTarget as HTMLElement).style.background = "var(--jb-surface-active)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--jb-surface-hover)";
            }}
          >
            Replace
          </button>
          <button
            type="button"
            title="Replace All (Ctrl+Alt+Enter)"
            style={actionButtonStyle("secondary")}
            onClick={replaceAll}
            disabled={matchCount() === 0}
            onMouseEnter={(e) => {
              if (matchCount() > 0) {
                (e.currentTarget as HTMLElement).style.background = "var(--jb-surface-active)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--jb-surface-hover)";
            }}
          >
            Replace All
          </button>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// CSS Styles (to be added to global CSS)
// ============================================================================

/**
 * Add these styles to your global CSS file:
 * 
 * .find-match-decoration {
 *   background-color: rgba(255, 215, 0, 0.3);
 * }
 * 
 * .find-current-match-decoration {
 *   background-color: rgba(249, 230, 79, 0.5);
 * }
 * 
 * .find-match-inline {
 *   border: 1px solid rgba(255, 215, 0, 0.5);
 *   border-radius: var(--cortex-radius-sm);
 * }
 * 
 * .find-current-inline {
 *   border: 2px solid var(--cortex-warning);
 *   border-radius: var(--cortex-radius-sm);
 *   box-shadow: 0 0 4px rgba(249, 230, 79, 0.5);
 * }
 */

export default FindReplaceWidget;

