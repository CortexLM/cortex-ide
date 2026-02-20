/**
 * Search in Open Editors Component
 * 
 * VSCode-style search that only searches in currently open editor tabs.
 * Features:
 * - Same search options as BufferSearch (case sensitive, whole word, regex)
 * - Results grouped by file
 * - Quick navigation between matches
 * - Match count per file and total
 */

import { createSignal, createEffect, For, Show, onMount, onCleanup } from "solid-js";
import { useEditor } from "@/context/EditorContext";
import { Icon } from "../ui/Icon";

interface SearchMatch {
  fileId: string;
  filePath: string;
  fileName: string;
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

interface GroupedResult {
  fileId: string;
  filePath: string;
  fileName: string;
  matches: SearchMatch[];
  expanded: boolean;
}

// Persist state across open/close
let persistedQuery = "";
let persistedCaseSensitive = false;
let persistedWholeWord = false;
let persistedUseRegex = false;

export interface SearchInOpenEditorsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchInOpenEditors(props: SearchInOpenEditorsProps) {
  const { state: editorState, setActiveFile } = useEditor();
  
  const [query, setQuery] = createSignal(persistedQuery);
  const [caseSensitive, setCaseSensitive] = createSignal(persistedCaseSensitive);
  const [wholeWord, setWholeWord] = createSignal(persistedWholeWord);
  const [useRegex, setUseRegex] = createSignal(persistedUseRegex);
  const [results, setResults] = createSignal<GroupedResult[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = createSignal(0);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [isVisible, setIsVisible] = createSignal(false);
  
  let inputRef: HTMLInputElement | undefined;
  let abortController: AbortController | null = null;

  // Persist state when values change
  createEffect(() => {
    persistedQuery = query();
    persistedCaseSensitive = caseSensitive();
    persistedWholeWord = wholeWord();
    persistedUseRegex = useRegex();
  });

  // Handle visibility
  createEffect(() => {
    if (props.isOpen) {
      setIsVisible(true);
      setTimeout(() => {
        inputRef?.focus();
        inputRef?.select();
      }, 10);
      // Re-run search with current query
      if (query().length >= 1) {
        performSearch();
      }
    } else {
      setIsVisible(false);
      cancelSearch();
    }
  });

  // Re-search when options change
  createEffect(() => {
    const q = query();
    const cs = caseSensitive();
    const ww = wholeWord();
    const re = useRegex();
    
    // Track dependencies
    void q;
    void cs;
    void ww;
    void re;
    
    if (props.isOpen && q.length >= 1) {
      performSearch();
    }
  });

  const cancelSearch = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  };

  const buildSearchPattern = (searchQuery: string): RegExp | null => {
    if (!searchQuery) return null;
    
    try {
      let pattern = searchQuery;
      
      if (!useRegex()) {
        // Escape regex special characters for literal search
        pattern = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
      
      if (wholeWord()) {
        pattern = `\\b${pattern}\\b`;
      }
      
      const flags = caseSensitive() ? "g" : "gi";
      return new RegExp(pattern, flags);
    } catch (e) {
      return null;
    }
  };

  const performSearch = () => {
    cancelSearch();
    abortController = new AbortController();
    setSearchError(null);
    
    const searchQuery = query();
    if (!searchQuery || searchQuery.length < 1) {
      setResults([]);
      return;
    }

    try {
      const regex = buildSearchPattern(searchQuery);
      if (!regex) {
        if (useRegex()) {
          setSearchError("Invalid regex");
        }
        setResults([]);
        return;
      }

      const openFiles = editorState.openFiles.filter(f => !f.path.startsWith("virtual:///"));
      const groupedResults: GroupedResult[] = [];

      for (const file of openFiles) {
        const content = file.content;
        const lines = content.split("\n");
        const matches: SearchMatch[] = [];
        
        // Reset regex for each file
        regex.lastIndex = 0;
        
        let lineStart = 0;
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const lineContent = lines[lineNum];
          const lineEnd = lineStart + lineContent.length;
          
          // Reset regex for each line
          regex.lastIndex = 0;
          let match;
          
          while ((match = regex.exec(lineContent)) !== null) {
            matches.push({
              fileId: file.id,
              filePath: file.path,
              fileName: file.name,
              line: lineNum + 1,
              column: match.index + 1,
              text: lineContent,
              matchStart: match.index,
              matchEnd: match.index + match[0].length,
            });
            
            // Prevent infinite loop on zero-length matches
            if (match[0].length === 0) {
              regex.lastIndex++;
            }
          }
          
          lineStart = lineEnd + 1;
        }
        
        if (matches.length > 0) {
          groupedResults.push({
            fileId: file.id,
            filePath: file.path,
            fileName: file.name,
            matches,
            expanded: true,
          });
        }
      }

      setResults(groupedResults);
      setCurrentMatchIndex(0);
    } catch (e) {
      setSearchError(useRegex() ? "Invalid regex" : "Search error");
      setResults([]);
    }
  };

  const getAllMatches = (): SearchMatch[] => {
    const allMatches: SearchMatch[] = [];
    for (const group of results()) {
      if (group.expanded) {
        allMatches.push(...group.matches);
      }
    }
    return allMatches;
  };

  const totalMatches = () => {
    return results().reduce((sum, r) => sum + r.matches.length, 0);
  };

  const goToMatch = (match: SearchMatch) => {
    // Activate the file
    setActiveFile(match.fileId);
    
    // Navigate to line/column
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("goto-line", {
        detail: { line: match.line, column: match.column }
      }));
    }, 50);
  };

  const nextMatch = () => {
    const allMatches = getAllMatches();
    if (allMatches.length === 0) return;
    
    const newIndex = (currentMatchIndex() + 1) % allMatches.length;
    setCurrentMatchIndex(newIndex);
    goToMatch(allMatches[newIndex]);
  };

  const prevMatch = () => {
    const allMatches = getAllMatches();
    if (allMatches.length === 0) return;
    
    const newIndex = currentMatchIndex() <= 0 ? allMatches.length - 1 : currentMatchIndex() - 1;
    setCurrentMatchIndex(newIndex);
    goToMatch(allMatches[newIndex]);
  };

  const toggleFileExpanded = (fileId: string) => {
    setResults(results().map(r => 
      r.fileId === fileId ? { ...r, expanded: !r.expanded } : r
    ));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.isOpen) return;
    
    if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
      return;
    }
    
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        prevMatch();
      } else {
        nextMatch();
      }
      return;
    }
    
    if (e.key === "F3") {
      e.preventDefault();
      if (e.shiftKey) {
        prevMatch();
      } else {
        nextMatch();
      }
      return;
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown, true);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown, true);
    cancelSearch();
  });

  const highlightMatch = (text: string, start: number, end: number) => {
    const safeStart = Math.max(0, Math.min(start, text.length));
    const safeEnd = Math.max(safeStart, Math.min(end, text.length));
    
    return (
      <>
        <span style={{ color: "var(--text-weak)" }}>{text.slice(0, safeStart)}</span>
        <span 
          style={{ 
            padding: "0 2px",
            "border-radius": "var(--cortex-radius-sm)",
            "font-weight": "600",
            background: "rgba(234, 179, 8, 0.4)",
            color: "var(--text-base)",
            "box-shadow": "0 0 0 1px rgba(234, 179, 8, 0.6)",
          }}
        >
          {text.slice(safeStart, safeEnd)}
        </span>
        <span style={{ color: "var(--text-weak)" }}>{text.slice(safeEnd)}</span>
      </>
    );
  };

  const ToggleButton = (props: { 
    active: boolean; 
    onClick: () => void; 
    title: string; 
    children: string;
  }) => (
    <button
      style={{
        padding: "4px 8px",
        "font-size": "11px",
        "border-radius": "var(--cortex-radius-md)",
        transition: "all 0.15s ease",
        "font-weight": "500",
        border: "none",
        cursor: "pointer",
        background: props.active ? "var(--accent-primary)" : "var(--surface-active)",
        color: props.active ? "white" : "var(--text-weak)",
      }}
      onClick={props.onClick}
      title={props.title}
    >
      {props.children}
    </button>
  );

  return (
    <Show when={props.isOpen}>
      <div 
        style={{ 
          position: "fixed",
          inset: "0",
          "z-index": "100",
          display: "flex",
          animation: isVisible() ? "fade-in 150ms ease-out forwards" : "none",
        }}
        onClick={props.onClose}
      >
        {/* Backdrop */}
        <div style={{ position: "absolute", inset: "0", background: "rgba(0, 0, 0, 0.5)" }} />
        
        {/* Panel */}
        <div 
          style={{ 
            position: "relative",
            "margin-left": "auto",
            width: "100%",
            "max-width": "480px",
            height: "100%",
            display: "flex",
            "flex-direction": "column",
            background: "var(--surface-raised)",
            "box-shadow": "-10px 0 40px -10px rgba(0, 0, 0, 0.5)",
            animation: isVisible() ? "slide-in-right 150ms ease-out forwards" : "none",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div 
            style={{ 
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              padding: "0 16px",
              height: "48px",
              "border-bottom": "1px solid var(--border-weak)",
              "flex-shrink": "0",
            }}
          >
            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
              <Icon name="magnifying-glass" style={{ width: "16px", height: "16px", color: "var(--text-weak)" }} />
              <span style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-base)" }}>
                Search in Open Editors
              </span>
            </div>
            <button 
              style={{ 
                padding: "6px",
                "border-radius": "var(--cortex-radius-md)",
                transition: "background 0.15s ease",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
              onClick={props.onClose}
              title="Close (Escape)"
            >
              <Icon name="xmark" style={{ width: "16px", height: "16px", color: "var(--text-weak)" }} />
            </button>
          </div>

          {/* Search Input */}
          <div style={{ padding: "12px", "border-bottom": "1px solid var(--border-weak)", "flex-shrink": "0" }}>
            <div 
              style={{ 
                display: "flex",
                "align-items": "center",
                gap: "8px",
                padding: "0 12px",
                height: "36px",
                "border-radius": "var(--cortex-radius-md)",
                background: "var(--background-base)",
                border: searchError() ? "1px solid var(--status-error)" : "1px solid transparent",
              }}
            >
              <Icon name="magnifying-glass" style={{ width: "16px", height: "16px", "flex-shrink": "0", color: "var(--text-weak)" }} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search in open files..."
                style={{
                  flex: "1",
                  background: "transparent",
                  outline: "none",
                  border: "none",
                  "font-size": "13px",
                  "min-width": "0",
                  color: "var(--text-base)"
                }}
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
              />
            </div>

            {/* Options */}
            <div style={{ display: "flex", "align-items": "center", gap: "4px", "margin-top": "8px" }}>
              <ToggleButton
                active={caseSensitive()}
                onClick={() => setCaseSensitive(!caseSensitive())}
                title="Case Sensitive"
              >
                Aa
              </ToggleButton>
              <ToggleButton
                active={wholeWord()}
                onClick={() => setWholeWord(!wholeWord())}
                title="Whole Word"
              >
                W
              </ToggleButton>
              <ToggleButton
                active={useRegex()}
                onClick={() => setUseRegex(!useRegex())}
                title="Regular Expression"
              >
                .*
              </ToggleButton>
              
              <div style={{ flex: "1" }} />
              
              {/* Match navigation */}
              <Show when={totalMatches() > 0}>
                <span style={{ "font-size": "11px", color: "var(--text-weak)", "margin-right": "8px" }}>
                  {currentMatchIndex() + 1} / {totalMatches()}
                </span>
                <button
                  style={{
                    padding: "4px",
                    "border-radius": "var(--cortex-radius-sm)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    "align-items": "center",
                  }}
                  onClick={prevMatch}
                  title="Previous Match (Shift+Enter)"
                >
                  <Icon name="chevron-up" style={{ width: "16px", height: "16px", color: "var(--text-weak)" }} />
                </button>
                <button
                  style={{
                    padding: "4px",
                    "border-radius": "var(--cortex-radius-sm)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    "align-items": "center",
                  }}
                  onClick={nextMatch}
                  title="Next Match (Enter)"
                >
                  <Icon name="chevron-down" style={{ width: "16px", height: "16px", color: "var(--text-weak)" }} />
                </button>
              </Show>
            </div>
          </div>

          {/* Error message */}
          <Show when={searchError()}>
            <div 
              style={{ 
                padding: "8px 16px",
                "font-size": "12px",
                "border-bottom": "1px solid var(--border-weak)",
                "flex-shrink": "0",
                color: "var(--status-error)",
                background: "var(--status-error-bg)",
              }}
            >
              {searchError()}
            </div>
          </Show>

          {/* Results count */}
          <Show when={results().length > 0 || (query().length >= 1)}>
            <div 
              style={{ 
                padding: "8px 16px",
                "font-size": "11px",
                "border-bottom": "1px solid var(--border-weak)",
                "flex-shrink": "0",
                color: "var(--text-weak)",
              }}
            >
              {results().length > 0 
                ? `${totalMatches()} result${totalMatches() !== 1 ? "s" : ""} in ${results().length} file${results().length !== 1 ? "s" : ""}`
                : "No results found"
              }
            </div>
          </Show>

          {/* Results */}
          <div style={{ flex: "1", "overflow-y": "auto", "overscroll-behavior": "contain" }}>
            <Show when={query().length < 1 && results().length === 0}>
              <div style={{ padding: "32px 16px", "text-align": "center" }}>
                <p style={{ "font-size": "13px", color: "var(--text-weak)" }}>
                  Type to search in {editorState.openFiles.filter(f => !f.path.startsWith("virtual:///")).length} open file{editorState.openFiles.length !== 1 ? "s" : ""}
                </p>
              </div>
            </Show>

            <For each={results()}>
              {(group) => (
                <div style={{ "border-bottom": "1px solid var(--border-weak)" }}>
                  {/* File header */}
                  <button
                    style={{
                      width: "100%",
                      display: "flex",
                      "align-items": "center",
                      gap: "8px",
                      padding: "8px 16px",
                      "text-align": "left",
                      transition: "background 0.15s ease",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer"
                    }}
                    onClick={() => toggleFileExpanded(group.fileId)}
                  >
                    <span style={{ color: "var(--text-weak)", transition: "transform 0.15s ease", transform: group.expanded ? "rotate(90deg)" : "rotate(0)" }}>
                      <Icon name="chevron-right" style={{ width: "14px", height: "14px" }} />
                    </span>
                    <Icon name="file" style={{ width: "14px", height: "14px", "flex-shrink": "0", color: "var(--text-weak)" }} />
                    <span style={{ "font-size": "12px", "font-weight": "500", color: "var(--text-base)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                      {group.fileName}
                    </span>
                    <span style={{ "margin-left": "auto", "font-size": "10px", padding: "2px 6px", "border-radius": "var(--cortex-radius-md)", "font-family": "'JetBrains Mono', monospace", background: "var(--surface-active)", color: "var(--text-weak)" }}>
                      {group.matches.length}
                    </span>
                  </button>

                  {/* Matches */}
                  <Show when={group.expanded}>
                    <div style={{ "padding-bottom": "4px" }}>
                      <For each={group.matches}>
                        {(match, matchIndex) => {
                          // Calculate global index for this match
                          let globalIndex = 0;
                          for (const r of results()) {
                            if (r.fileId === group.fileId) break;
                            globalIndex += r.matches.length;
                          }
                          globalIndex += matchIndex();
                          
                          return (
                            <button
                              style={{
                                width: "100%",
                                display: "flex",
                                "align-items": "flex-start",
                                gap: "12px",
                                padding: "6px 16px 6px 38px",
                                "text-align": "left",
                                transition: "background 0.15s ease",
                                border: "none",
                                cursor: "pointer",
                                background: currentMatchIndex() === globalIndex 
                                  ? "rgba(255, 255, 255, 0.1)" 
                                  : "transparent"
                              }}
                              onClick={() => {
                                setCurrentMatchIndex(globalIndex);
                                goToMatch(match);
                              }}
                            >
                              <span
                                style={{
                                  "flex-shrink": "0",
                                  width: "32px",
                                  "text-align": "right",
                                  "font-size": "11px",
                                  "font-family": "'JetBrains Mono', monospace",
                                  color: "var(--text-weaker)"
                                }}
                              >
                                {match.line}
                              </span>
                              <span
                                style={{
                                  "font-size": "12px",
                                  "font-family": "'JetBrains Mono', monospace",
                                  overflow: "hidden",
                                  "text-overflow": "ellipsis",
                                  "white-space": "nowrap",
                                  "line-height": "1.5",
                                  flex: "1",
                                  color: "var(--text-weak)"
                                }}
                              >
                                {(() => {
                                                  // Calculate trimmed offset for correct highlighting
                                                  const leadingSpaces = match.text.length - match.text.trimStart().length;
                                                  const trimmedText = match.text.trim();
                                                  const adjustedStart = Math.max(0, match.matchStart - leadingSpaces);
                                                  const adjustedEnd = Math.max(adjustedStart, match.matchEnd - leadingSpaces);
                                                  return highlightMatch(trimmedText, adjustedStart, adjustedEnd);
                                                })()}
                              </span>
                            </button>
                          );
                        }}
                      </For>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>

          {/* Footer */}
          <div 
            style={{ 
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              padding: "8px 16px",
              "font-size": "10px",
              "border-top": "1px solid var(--border-weak)",
              "flex-shrink": "0",
              background: "var(--background-base)",
              color: "var(--text-weaker)",
            }}
          >
            <span>
              <kbd style={{ "font-family": "'JetBrains Mono', monospace" }}>Enter</kbd> next
              {" "}&bull;{" "}
              <kbd style={{ "font-family": "'JetBrains Mono', monospace" }}>Shift+Enter</kbd> prev
            </span>
            <span>
              <kbd style={{ "font-family": "'JetBrains Mono', monospace" }}>Esc</kbd> close
            </span>
          </div>
        </div>
      </div>
    </Show>
  );
}

// Hook for managing SearchInOpenEditors state
export function useSearchInOpenEditors() {
  const [isOpen, setIsOpen] = createSignal(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  // Listen for event to open
  onMount(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("search:in-open-editors", handleOpen);
    
    onCleanup(() => {
      window.removeEventListener("search:in-open-editors", handleOpen);
    });
  });

  return {
    isOpen,
    open,
    close,
    SearchInOpenEditorsComponent: () => (
      <SearchInOpenEditors isOpen={isOpen()} onClose={close} />
    ),
  };
}

export default SearchInOpenEditors;

