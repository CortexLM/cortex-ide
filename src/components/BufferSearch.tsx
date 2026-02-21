import { createSignal, createEffect, createMemo, Show, onMount, onCleanup, batch } from "solid-js";
import { useCommands } from "@/context/CommandContext";
import { useEditor } from "@/context/EditorContext";
import { MultiLineSearchInput } from "./MultiLineSearchInput";
import { Icon } from "./ui/Icon";

// VS Code-style "Find in Selection" icon
const SelectionIcon = (props: { class?: string; style?: Record<string, string> }) => (
  <svg
    class={props.class}
    style={props.style}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Selection box outline */}
    <path d="M2 3h2v1H3v9h10V4h-1V3h2v12H2V3z" />
    {/* Top-left corner marker */}
    <path d="M3 2h3v1H3V2z" />
    <path d="M2 2h1v3H2V2z" />
    {/* Top-right corner marker */}
    <path d="M10 2h3v1h-3V2z" />
    <path d="M13 2h1v3h-1V2z" />
  </svg>
);

// Selection range interface for tracking captured selection
interface SelectionRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  startOffset: number;
  endOffset: number;
}

interface SearchMatch {
  start: number;
  end: number;
  line: number;
  column: number;
}

function applyPreserveCase(original: string, replacement: string): string {
  // Detect case pattern of original
  const isAllUpper = original === original.toUpperCase() && original !== original.toLowerCase();
  const isAllLower = original === original.toLowerCase() && original !== original.toUpperCase();
  const isCapitalized = original.length > 0 &&
                        original[0] === original[0].toUpperCase() && 
                        original.slice(1) === original.slice(1).toLowerCase();
  
  if (isAllUpper) return replacement.toUpperCase();
  if (isAllLower) return replacement.toLowerCase();
  if (isCapitalized) return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
  
  // Mixed case - try to match character by character
  return replacement.split('').map((char, i) => {
    if (i < original.length) {
      return original[i] === original[i].toUpperCase() ? char.toUpperCase() : char.toLowerCase();
    }
    return char;
  }).join('');
}

// Preserve search state across open/close
let persistedQuery = "";
let persistedReplaceText = "";
let persistedCaseSensitive = false;
let persistedWholeWord = false;
let persistedUseRegex = false;
let persistedShowReplace = false;
let persistedPreserveCase = false;
let persistedReplaceInSelection = false;
let persistedMultilineMode = false;

export function BufferSearch() {
  const { showBufferSearch, setShowBufferSearch } = useCommands();
  const { state, updateFileContent } = useEditor();
  const [query, setQuery] = createSignal(persistedQuery);
  const [replaceText, setReplaceText] = createSignal(persistedReplaceText);
  const [showReplace, setShowReplace] = createSignal(persistedShowReplace);
  const [caseSensitive, setCaseSensitive] = createSignal(persistedCaseSensitive);
  const [useRegex, setUseRegex] = createSignal(persistedUseRegex);
  const [wholeWord, setWholeWord] = createSignal(persistedWholeWord);
  const [preserveCase, setPreserveCase] = createSignal(persistedPreserveCase);
  const [replaceInSelection, setReplaceInSelection] = createSignal(persistedReplaceInSelection);
  const [selectionRange, setSelectionRange] = createSignal<SelectionRange | null>(null);
  const [matches, setMatches] = createSignal<SearchMatch[]>([]);
  const [currentMatch, setCurrentMatch] = createSignal(0);
  const [isVisible, setIsVisible] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [multilineMode, setMultilineMode] = createSignal(persistedMultilineMode);
  let inputRef: HTMLInputElement | HTMLTextAreaElement | undefined;
  let replaceInputRef: HTMLInputElement | HTMLTextAreaElement | undefined;

  // PERFORMANCE: Memoize to prevent recalculation
  const activeFile = createMemo(() => state.openFiles.find((f) => f.id === state.activeFileId));

  // Persist state when values change
  createEffect(() => {
    persistedQuery = query();
    persistedReplaceText = replaceText();
    persistedCaseSensitive = caseSensitive();
    persistedWholeWord = wholeWord();
    persistedUseRegex = useRegex();
    persistedShowReplace = showReplace();
    persistedPreserveCase = preserveCase();
    persistedReplaceInSelection = replaceInSelection();
    persistedMultilineMode = multilineMode();
  });

  // Check if query contains newlines (for multi-line search indicator)
  const hasMultilineQuery = () => query().includes('\n');
  const queryLineCount = () => query().split('\n').length;

  // Handle visibility and animation
  createEffect(() => {
    if (showBufferSearch()) {
      setIsVisible(true);
      // Restore persisted values
      setQuery(persistedQuery);
      setReplaceText(persistedReplaceText);
      setCaseSensitive(persistedCaseSensitive);
      setWholeWord(persistedWholeWord);
      setUseRegex(persistedUseRegex);
      setShowReplace(persistedShowReplace);
      setPreserveCase(persistedPreserveCase);
      setReplaceInSelection(persistedReplaceInSelection);
      setMultilineMode(persistedMultilineMode);
      
      // If replaceInSelection was active, try to capture current selection
      if (persistedReplaceInSelection) {
        captureEditorSelection();
      }
      
      setTimeout(() => {
        inputRef?.focus();
        if (inputRef && 'select' in inputRef) {
          inputRef.select();
        }
      }, 10);
      findMatches();
    } else {
      setIsVisible(false);
      clearHighlights();
    }
  });

  // Find matches when query or options change
  createEffect(() => {
    const q = query();
    const cs = caseSensitive();
    const re = useRegex();
    const ww = wholeWord();
    const ris = replaceInSelection();
    const sr = selectionRange();
    // Track dependencies
    void q;
    void cs;
    void re;
    void ww;
    void ris;
    void sr;
    findMatches();
  });

  // Re-find when active file changes or content changes
  createEffect(() => {
    const file = activeFile();
    if (file && showBufferSearch()) {
      // Track the content property to re-run search when file content changes
      const _content = file.content;
      void _content;
      findMatches();
    }
  });

  // Capture the current editor selection for "Replace in Selection" feature
  const captureEditorSelection = () => {
    const file = activeFile();
    if (!file) {
      setSelectionRange(null);
      return;
    }
    
    // Request selection from the editor via custom event
    const handleSelectionResponse = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      window.removeEventListener("buffer-search:selection-response", handleSelectionResponse);
      
      if (detail && detail.selection) {
        const { startLine, startColumn, endLine, endColumn } = detail.selection;
        
        // Calculate offsets from line/column positions
        const content = file.content;
        const lines = content.split("\n");
        
        let startOffset = 0;
        for (let i = 0; i < startLine - 1 && i < lines.length; i++) {
          startOffset += lines[i].length + 1; // +1 for newline
        }
        startOffset += startColumn - 1;
        
        let endOffset = 0;
        for (let i = 0; i < endLine - 1 && i < lines.length; i++) {
          endOffset += lines[i].length + 1;
        }
        endOffset += endColumn - 1;
        
        // Only set if there's an actual selection (not just cursor position)
        if (startOffset !== endOffset) {
          setSelectionRange({
            startLine,
            startColumn,
            endLine,
            endColumn,
            startOffset,
            endOffset,
          });
        } else {
          setSelectionRange(null);
        }
      } else {
        setSelectionRange(null);
      }
      
      // Re-run find after selection is captured
      findMatches();
    };
    
    window.addEventListener("buffer-search:selection-response", handleSelectionResponse);
    window.dispatchEvent(new CustomEvent("buffer-search:get-selection"));
    
    // Timeout fallback if no response
    setTimeout(() => {
      window.removeEventListener("buffer-search:selection-response", handleSelectionResponse);
    }, 100);
  };

  // Toggle replace in selection mode
  const toggleReplaceInSelection = () => {
    const newValue = !replaceInSelection();
    setReplaceInSelection(newValue);
    
    if (newValue) {
      // Capture current selection when enabling
      captureEditorSelection();
    } else {
      // Clear selection range when disabling
      setSelectionRange(null);
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

  const findMatches = () => {
    const file = activeFile();
    const q = query();
    
    setSearchError(null);
    
    if (!file || !q) {
      batch(() => {
        setMatches([]);
        setCurrentMatch(0);
      });
      clearHighlights();
      return;
    }

    try {
      const regex = buildSearchPattern(q);
      if (!regex) {
        if (useRegex()) {
          setSearchError("Invalid regex");
        }
        batch(() => {
          setMatches([]);
          setCurrentMatch(0);
        });
        clearHighlights();
        return;
      }
      
      const content = file.content;
      const found: SearchMatch[] = [];
      let match;
      
      // Calculate line and column for each match
      const lines = content.split("\n");
      let currentLineStart = 0;
      
      while ((match = regex.exec(content)) !== null) {
        // Find line number for this match
        let lineNum = 1;
        let lineStart = 0;
        for (let i = 0; i < lines.length; i++) {
          const lineEnd = lineStart + lines[i].length;
          if (match.index >= lineStart && match.index <= lineEnd) {
            lineNum = i + 1;
            currentLineStart = lineStart;
            break;
          }
          lineStart = lineEnd + 1; // +1 for newline
        }
        
        found.push({
          start: match.index,
          end: match.index + match[0].length,
          line: lineNum,
          column: match.index - currentLineStart + 1,
        });
        
        // Prevent infinite loop on zero-length matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
        
        // Limit to prevent performance issues
        if (found.length >= 10000) break;
      }
      
      // Filter matches to selection range if "Replace in Selection" is enabled
      let filteredMatches = found;
      const range = selectionRange();
      if (replaceInSelection() && range) {
        filteredMatches = found.filter((m) => 
          m.start >= range.startOffset && m.end <= range.endOffset
        );
      }
      
      batch(() => {
        setMatches(filteredMatches);
        if (filteredMatches.length > 0 && currentMatch() >= filteredMatches.length) {
          setCurrentMatch(0);
        }
      });
      
      // Update highlights in editor
      updateHighlights(filteredMatches, currentMatch());
      
    } catch (e) {
      setSearchError(useRegex() ? "Invalid regex" : "Search error");
      batch(() => {
        setMatches([]);
        setCurrentMatch(0);
      });
      clearHighlights();
    }
  };

  const updateHighlights = (allMatches: SearchMatch[], currentIdx: number) => {
    // Calculate end line/column for multi-line matches
    const file = activeFile();
    const content = file?.content || '';
    
    const decorations = allMatches.map((m, idx) => {
      // For multi-line search, we need to calculate the actual end position
      const matchText = content.slice(m.start, m.end);
      const matchLines = matchText.split('\n');
      const endLine = m.line + matchLines.length - 1;
      const endColumn = matchLines.length > 1 
        ? matchLines[matchLines.length - 1].length + 1 
        : m.column + (m.end - m.start);
      
      return {
        range: { 
          startLine: m.line, 
          startColumn: m.column, 
          endLine, 
          endColumn 
        },
        isCurrent: idx === currentIdx,
        matchIndex: idx,
        totalMatches: allMatches.length,
      };
    });
    
    window.dispatchEvent(new CustomEvent("buffer-search:highlights", {
      detail: { 
        decorations,
        totalMatches: allMatches.length,
        currentMatch: currentIdx,
        isMultiline: hasMultilineQuery(),
      }
    }));
  };

  const clearHighlights = () => {
    window.dispatchEvent(new CustomEvent("buffer-search:highlights", {
      detail: { decorations: [] }
    }));
  };

  const goToMatch = (index: number) => {
    const allMatches = matches();
    if (allMatches.length === 0) return;
    
    const safeIndex = ((index % allMatches.length) + allMatches.length) % allMatches.length;
    setCurrentMatch(safeIndex);
    
    const match = allMatches[safeIndex];
    if (match) {
      window.dispatchEvent(new CustomEvent("buffer-search:goto", { 
        detail: { 
          line: match.line, 
          column: match.column,
          start: match.start, 
          end: match.end,
          length: match.end - match.start
        }
      }));
      
      // Update highlights to show current match
      updateHighlights(allMatches, safeIndex);
    }
  };

  const nextMatch = () => goToMatch(currentMatch() + 1);
  const prevMatch = () => goToMatch(currentMatch() - 1);

  const replaceOne = () => {
    const file = activeFile();
    const allMatches = matches();
    if (!file || allMatches.length === 0) return;
    
    const match = allMatches[currentMatch()];
    if (!match) return;
    
    const content = file.content;
    const matchedText = content.slice(match.start, match.end);
    let replacement = replaceText();
    
    // Handle regex replacement groups if using regex
    if (useRegex()) {
      try {
        const regex = buildSearchPattern(query());
        if (regex) {
          replacement = matchedText.replace(regex, replaceText());
        }
      } catch {
        // Fall back to literal replacement
      }
    }
    
    // Apply preserve case if enabled
    if (preserveCase()) {
      replacement = applyPreserveCase(matchedText, replacement);
    }
    
    const newContent = 
      content.slice(0, match.start) + 
      replacement + 
      content.slice(match.end);
    
    updateFileContent(file.id, newContent);
    
    // Re-find matches after replacement and go to next
    setTimeout(() => {
      findMatches();
      const newMatches = matches();
      if (newMatches.length > 0) {
        const nextIdx = Math.min(currentMatch(), newMatches.length - 1);
        goToMatch(nextIdx);
      }
    }, 0);
  };

  const replaceAll = () => {
    const file = activeFile();
    const q = query();
    if (!file || !q) return;
    
    try {
      const regex = buildSearchPattern(q);
      if (!regex) return;
      
      const replacement = replaceText();
      const newContent = file.content.replace(regex, (match) => {
        return preserveCase() ? applyPreserveCase(match, replacement) : replacement;
      });
      updateFileContent(file.id, newContent);
      
      // Re-find matches after replacement
      setTimeout(findMatches, 0);
    } catch {
      // Invalid regex - ignore
    }
  };

  // Global keyboard handlers
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (!showBufferSearch()) return;
    
    // Escape to close
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setShowBufferSearch(false);
      return;
    }
    
    // F3 / Shift+F3 for next/prev
    if (e.key === "F3") {
      e.preventDefault();
      if (e.shiftKey) {
        prevMatch();
      } else {
        nextMatch();
      }
      return;
    }
    
    // Ctrl+H to toggle replace
    if ((e.ctrlKey || e.metaKey) && e.key === "h") {
      e.preventDefault();
      setShowReplace(!showReplace());
      if (!showReplace()) {
        setTimeout(() => replaceInputRef?.focus(), 10);
      }
      return;
    }
    
    // Alt+C for case sensitive
    if (e.altKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      setCaseSensitive(!caseSensitive());
      return;
    }
    
    // Alt+W for whole word
    if (e.altKey && e.key.toLowerCase() === "w") {
      e.preventDefault();
      setWholeWord(!wholeWord());
      return;
    }
    
    // Alt+R for regex
    if (e.altKey && e.key.toLowerCase() === "r") {
      e.preventDefault();
      setUseRegex(!useRegex());
      return;
    }
    
    // Alt+L for replace in selection (VS Code standard)
    if (e.altKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      toggleReplaceInSelection();
      return;
    }
    
    // Alt+M for multi-line mode toggle
    if (e.altKey && e.key.toLowerCase() === "m") {
      e.preventDefault();
      setMultilineMode(!multilineMode());
      return;
    }
  };

  // Handle event to show replace panel (from Ctrl+H shortcut)
  const handleShowReplace = () => {
    setShowReplace(true);
    persistedShowReplace = true;
    // Focus replace input when replace mode is opened
    setTimeout(() => replaceInputRef?.focus(), 50);
  };

  onMount(() => {
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    window.addEventListener("buffer-search:show-replace", handleShowReplace);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleGlobalKeyDown, true);
    window.removeEventListener("buffer-search:show-replace", handleShowReplace);
    clearHighlights();
  });

  const handleInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        prevMatch();
      } else {
        nextMatch();
      }
    } else if (e.key === "Tab" && showReplace()) {
      e.preventDefault();
      replaceInputRef?.focus();
    }
  };

  const handleReplaceKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey || (e.ctrlKey || e.metaKey)) {
        replaceAll();
      } else {
        replaceOne();
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      inputRef?.focus();
    }
  };

  const ToggleButton = (props: { 
    active: boolean; 
    onClick: () => void; 
    title: string; 
    children: string;
    shortcut?: string;
  }) => (
    <button
      class="px-2 py-1 text-[11px] rounded-md transition-colors font-medium"
      style={{
        background: props.active ? "var(--accent-primary)" : "transparent",
        color: props.active ? "white" : "var(--text-weak)",
      }}
      onClick={props.onClick}
      title={`${props.title}${props.shortcut ? ` (${props.shortcut})` : ""}`}
    >
      {props.children}
    </button>
  );

  const matchCountText = () => {
    const m = matches();
    if (searchError()) return searchError();
    if (!query()) return "";
    if (m.length === 0) return "No results";
    return `${currentMatch() + 1} of ${m.length}`;
  };

  return (
    <Show when={showBufferSearch() && activeFile()}>
      <div 
        class="find-widget"
        classList={{
          "visible": isVisible(),
          "with-replace": showReplace(),
        }}
        style={{ 
          /* VS Code specs: z-index 35, 419px width, 33px height, slide animation */
          position: "fixed",
          top: "56px", /* Below header */
          right: "16px",
          "z-index": "35",
          width: multilineMode() ? "480px" : "419px",
          height: showReplace() || multilineMode() ? "auto" : "auto",
          background: "var(--ui-panel-bg)",
          "border-radius": "var(--cortex-radius-md)",
          "box-shadow": "0 4px 16px rgba(0, 0, 0, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          overflow: "hidden",
          "line-height": "19px",
          "box-sizing": "border-box",
          transition: "transform 200ms linear, width 150ms ease",
          transform: isVisible() ? "translateY(0)" : "translateY(calc(-100% - 10px))",
        }}
      >
        {/* Search row */}
        <div class="flex items-center gap-2 py-2 border-b" style={{ "border-color": "var(--jb-border-default)", padding: "8px 12px", "padding-right": "32px" }}>
          <Show
            when={multilineMode()}
            fallback={
              <div 
                class="flex-1 flex items-center gap-2 px-3 h-[32px] rounded-md"
                style={{ 
                  background: "var(--jb-canvas)",
                  border: searchError() ? "1px solid var(--cortex-error)" : "1px solid transparent",
                }}
              >
                <Icon name="magnifying-glass" size={16} class="shrink-0" style={{ color: "var(--jb-text-muted-color)" }} />
                <input
                  ref={(el) => inputRef = el}
                  type="text"
                  placeholder="Find..."
                  class="flex-1 bg-transparent outline-none text-[13px] min-w-0"
                  style={{ color: "var(--jb-text-body-color)" }}
                  value={query()}
                  onInput={(e) => setQuery(e.currentTarget.value)}
                  onKeyDown={handleInputKeyDown}
                />
                {/* Newline indicator when query has newlines */}
                <Show when={hasMultilineQuery()}>
                  <span 
                    class="text-[10px] px-1 rounded"
                    style={{ 
                      background: "var(--surface-active)", 
                      color: "var(--text-weak)",
                      "white-space": "nowrap",
                    }}
                    title="Multi-line search pattern"
                  >
                    {queryLineCount()} lines
                  </span>
                </Show>
              </div>
            }
          >
            {/* Multi-line search input mode */}
            <MultiLineSearchInput
              ref={(el) => inputRef = el}
              value={query()}
              onChange={setQuery}
              placeholder="Find... (Ctrl+Enter for newline)"
              onSubmit={() => nextMatch()}
              error={!!searchError()}
              icon={<Icon name="magnifying-glass" size={16} />}
              containerStyle={{
                flex: "1",
                background: "var(--jb-canvas)",
              }}
            />
          </Show>
          
          {/* Match count - VS Code: max-width 69px */}
          <span 
            class="matches-count text-[11px] shrink-0 text-center font-mono"
            style={{ 
              "max-width": "69px",
              margin: "0 0 0 3px",
              padding: "2px 0 0 2px",
              "line-height": "23px",
              color: searchError() 
                ? "var(--cortex-error)" 
                : matches().length > 0 
                  ? "var(--jb-text-body-color)" 
                  : "var(--jb-text-muted-color)" 
            }}
          >
            {matchCountText()}
          </span>
          
          {/* Navigation - VS Code: 16x16px buttons, 3px padding, 5px border-radius */}
          <div class="flex items-center gap-0.5">
            <button 
              class="find-button button-previous"
              style={{
                width: "16px",
                height: "16px",
                padding: "3px",
                "border-radius": "var(--cortex-radius-md)",
                "margin-left": "3px",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                background: "transparent",
                border: "none",
                cursor: matches().length === 0 ? "default" : "pointer",
                opacity: matches().length === 0 ? "0.3" : "1",
              }}
              onClick={prevMatch}
              disabled={matches().length === 0}
              title="Previous match (Shift+Enter or F3)"
            >
              <Icon name="chevron-up" size={16} style={{ color: "var(--jb-text-muted-color)" }} />
            </button>
            <button 
              class="find-button button-next"
              style={{
                width: "16px",
                height: "16px",
                padding: "3px",
                "border-radius": "var(--cortex-radius-md)",
                "margin-left": "3px",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                background: "transparent",
                border: "none",
                cursor: matches().length === 0 ? "default" : "pointer",
                opacity: matches().length === 0 ? "0.3" : "1",
              }}
              onClick={nextMatch}
              disabled={matches().length === 0}
              title="Next match (Enter or F3)"
            >
              <Icon name="chevron-down" size={16} style={{ color: "var(--jb-text-muted-color)" }} />
            </button>
          </div>
          
          {/* Close - VS Code: position absolute, top: 5px, right: 4px */}
          <button 
            class="find-button button-close"
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              width: "20px",
              height: "20px",
              padding: "3px",
              "border-radius": "var(--cortex-radius-sm)",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => setShowBufferSearch(false)}
            title="Close (Escape)"
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <Icon name="xmark" size={16} style={{ color: "var(--jb-text-muted-color)" }} />
          </button>
        </div>

        {/* Options row */}
        <div class="flex items-center gap-1 py-2 border-b" style={{ "border-color": "var(--jb-border-default)", padding: "6px 12px" }}>
          <ToggleButton
            active={caseSensitive()}
            onClick={() => setCaseSensitive(!caseSensitive())}
            title="Case Sensitive"
            shortcut="Alt+C"
          >
            Aa
          </ToggleButton>
          <ToggleButton
            active={wholeWord()}
            onClick={() => setWholeWord(!wholeWord())}
            title="Whole Word"
            shortcut="Alt+W"
          >
            W
          </ToggleButton>
          <ToggleButton
            active={useRegex()}
            onClick={() => setUseRegex(!useRegex())}
            title="Regular Expression"
            shortcut="Alt+R"
          >
            .*
          </ToggleButton>
          <ToggleButton
            active={preserveCase()}
            onClick={() => setPreserveCase(!preserveCase())}
            title="Preserve Case"
          >
            AB
          </ToggleButton>
          
          {/* Separator */}
          <div style={{ width: "1px", height: "16px", background: "var(--border-weak)", margin: "0 4px" }} />
          
          {/* Multi-line toggle */}
          <button
            class="flex items-center justify-center w-[24px] h-[24px] rounded-md transition-colors"
            style={{
              background: multilineMode() ? "var(--accent-primary)" : "transparent",
              color: multilineMode() ? "white" : "var(--jb-text-muted-color)",
            }}
            onClick={() => setMultilineMode(!multilineMode())}
            title="Multi-line search (Alt+M)"
          >
            {multilineMode() ? <Icon name="minimize" size={14} /> : <Icon name="maximize" size={14} />}
          </button>
          
          <div class="flex-1" />
          
          <button
            class="flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-md transition-colors"
            style={{
              background: showReplace() ? "var(--surface-active)" : "transparent",
              color: "var(--jb-text-muted-color)",
            }}
            onClick={() => {
              setShowReplace(!showReplace());
              if (!showReplace()) {
                setTimeout(() => replaceInputRef?.focus(), 10);
              }
            }}
            title="Toggle Replace (Ctrl+H)"
          >
            <Icon name="rotate" size={12} />
            Replace
          </button>
        </div>

        {/* Replace row */}
        <Show when={showReplace()}>
          <div class="flex items-center gap-2 py-2 border-b" style={{ "border-color": "var(--jb-border-default)", padding: "8px 12px" }}>
            <Show
              when={multilineMode()}
              fallback={
                <div 
                  class="flex-1 flex items-center gap-2 px-3 h-[32px] rounded-md"
                  style={{ background: "var(--jb-canvas)" }}
                >
                  <input
                    ref={(el) => replaceInputRef = el}
                    type="text"
                    placeholder="Replace with..."
                    class="flex-1 bg-transparent outline-none text-[13px] min-w-0"
                    style={{ color: "var(--jb-text-body-color)" }}
                    value={replaceText()}
                    onInput={(e) => setReplaceText(e.currentTarget.value)}
                    onKeyDown={handleReplaceKeyDown}
                  />
                </div>
              }
            >
              {/* Multi-line replace input mode */}
              <MultiLineSearchInput
                ref={(el) => replaceInputRef = el}
                value={replaceText()}
                onChange={setReplaceText}
                placeholder="Replace with... (Ctrl+Enter for newline)"
                onSubmit={replaceOne}
                icon={<Icon name="rotate" size={16} style={{ color: "var(--jb-text-muted-color)" }} />}
                containerStyle={{
                  flex: "1",
                  background: "var(--jb-canvas)",
                }}
              />
            </Show>
            
            {/* Replace in Selection toggle */}
            <button
              class="flex items-center justify-center w-[28px] h-[28px] rounded-md transition-colors"
              style={{
                background: replaceInSelection() && selectionRange() 
                  ? "var(--jb-border-focus)" 
                  : "transparent",
                color: replaceInSelection() && selectionRange() 
                  ? "white" 
                  : "var(--jb-text-muted-color)",
                opacity: replaceInSelection() && !selectionRange() ? 0.5 : 1,
              }}
              onClick={toggleReplaceInSelection}
              title={`Find in Selection (Alt+L)${replaceInSelection() && selectionRange() ? ` - Lines ${selectionRange()!.startLine}-${selectionRange()!.endLine}` : ""}`}
            >
              <SelectionIcon 
                class="w-4 h-4"
                style={{ color: "currentColor" }}
              />
            </button>
            
            <button
              class="px-2.5 py-1.5 text-[11px] rounded-md transition-colors font-medium disabled:opacity-30 hover:bg-white/5"
              style={{ 
                background: "var(--surface-active)", 
                color: "var(--jb-text-body-color)",
              }}
              onClick={replaceOne}
              disabled={matches().length === 0}
              title="Replace current match (Enter)"
            >
              Replace
            </button>
            <button
              class="px-2.5 py-1.5 text-[11px] rounded-md transition-colors font-medium disabled:opacity-30 hover:bg-white/5"
              style={{ 
                background: "var(--surface-active)", 
                color: "var(--jb-text-body-color)",
              }}
              onClick={replaceAll}
              disabled={matches().length === 0}
              title="Replace all matches (Ctrl+Enter)"
            >
              All
            </button>
          </div>
        </Show>

        {/* Keyboard hints */}
        <div 
          class="flex items-center justify-between px-3 py-1.5 text-[10px]"
          style={{ 
            background: "var(--jb-canvas)",
            color: "var(--jb-text-muted-color)",
          }}
        >
          <span>
            <kbd class="font-mono">Enter</kbd> next • <kbd class="font-mono">Shift+Enter</kbd> prev • <kbd class="font-mono">F3</kbd>
          </span>
          <span>
            <kbd class="font-mono">Esc</kbd> close
          </span>
        </div>
      </div>

      {/* VS Code find widget animation handled via inline transform transition */}
    </Show>
  );
}

