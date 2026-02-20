import { createSignal, createEffect, For, Show, onMount, onCleanup, JSX, createMemo } from "solid-js";
import { useCommands } from "@/context/CommandContext";
import { useEditor } from "@/context/EditorContext";
import { Icon } from "./ui/Icon";
import "@/styles/quickinput.css";
import { lspWorkspaceSymbols, type LspSymbol } from "../utils/tauri-api";
import { getProjectPath } from "../utils/workspace";

// Symbol kind filter prefixes (VS Code style)
// Use # to search all symbols, : to filter by kind
const SYMBOL_KIND_FILTERS: Record<string, SymbolKind[]> = {
  ":": ["class", "interface", "struct", "enum", "typeParameter"], // Types
  "@": ["function", "method", "constructor"], // Functions/Methods
  ".": ["property", "field"], // Properties
  "#": ["variable", "constant"], // Variables
};

// Symbol kind type matching LSP specification
type SymbolKind =
  | "file" | "module" | "namespace" | "package" | "class"
  | "method" | "property" | "field" | "constructor" | "enum"
  | "interface" | "function" | "variable" | "constant" | "string"
  | "number" | "boolean" | "array" | "object" | "key"
  | "null" | "enumMember" | "struct" | "event" | "operator"
  | "typeParameter";

// Symbol icons by kind with colors (same as OutlinePanel)
const symbolIcons: Record<SymbolKind, { icon: string; color: string }> = {
  file: { icon: "code", color: "var(--cortex-text-inactive)" },
  module: { icon: "m", color: "var(--cortex-warning)" },
  namespace: { icon: "n", color: "var(--cortex-info)" },
  package: { icon: "p", color: "var(--cortex-warning)" },
  class: { icon: "c", color: "var(--cortex-warning)" },
  method: { icon: "function", color: "var(--cortex-info)" },
  property: { icon: "box", color: "var(--cortex-info)" },
  field: { icon: "f", color: "var(--cortex-info)" },
  constructor: { icon: "lambda", color: "var(--cortex-info)" },
  enum: { icon: "e", color: "var(--cortex-warning)" },
  interface: { icon: "i", color: "var(--cortex-success)" },
  function: { icon: "function", color: "var(--cortex-info)" },
  variable: { icon: "v", color: "var(--cortex-info)" },
  constant: { icon: "k", color: "var(--cortex-info)" },
  string: { icon: "s", color: "var(--cortex-success)" },
  number: { icon: "hashtag", color: "var(--cortex-success)" },
  boolean: { icon: "toggle-on", color: "var(--cortex-success)" },
  array: { icon: "brackets-square", color: "var(--cortex-warning)" },
  object: { icon: "brackets-curly", color: "var(--cortex-warning)" },
  key: { icon: "k", color: "var(--cortex-info)" },
  null: { icon: "circle-dot", color: "var(--cortex-text-inactive)" },
  enumMember: { icon: "hashtag", color: "var(--cortex-info)" },
  struct: { icon: "s", color: "var(--cortex-warning)" },
  event: { icon: "circle-dot", color: "var(--cortex-error)" },
  operator: { icon: "o", color: "var(--cortex-text-inactive)" },
  typeParameter: { icon: "t", color: "var(--cortex-success)" },
};

// Map LSP symbol kind number to our SymbolKind type
function mapLspSymbolKind(kind: number): SymbolKind {
  const kindMap: Record<number, SymbolKind> = {
    1: "file",
    2: "module",
    3: "namespace",
    4: "package",
    5: "class",
    6: "method",
    7: "property",
    8: "field",
    9: "constructor",
    10: "enum",
    11: "interface",
    12: "function",
    13: "variable",
    14: "constant",
    15: "string",
    16: "number",
    17: "boolean",
    18: "array",
    19: "object",
    20: "key",
    21: "null",
    22: "enumMember",
    23: "struct",
    24: "event",
    25: "operator",
    26: "typeParameter",
  };
  return kindMap[kind] || "variable";
}

// Get human-readable label for symbol kind
function getSymbolKindLabel(kind: SymbolKind): string {
  const labels: Record<SymbolKind, string> = {
    file: "File",
    module: "Module",
    namespace: "Namespace",
    package: "Package",
    class: "Class",
    method: "Method",
    property: "Property",
    field: "Field",
    constructor: "Constructor",
    enum: "Enum",
    interface: "Interface",
    function: "Function",
    variable: "Variable",
    constant: "Constant",
    string: "String",
    number: "Number",
    boolean: "Boolean",
    array: "Array",
    object: "Object",
    key: "Key",
    null: "Null",
    enumMember: "Enum Member",
    struct: "Struct",
    event: "Event",
    operator: "Operator",
    typeParameter: "Type Param",
  };
  return labels[kind] || kind;
}

// LSP SymbolTag values
const SymbolTag = {
  Deprecated: 1,
} as const;

interface WorkspaceSymbol {
  name: string;
  kind: SymbolKind;
  containerName?: string;
  filePath: string;
  line: number;
  character: number;
  tags?: number[]; // LSP SymbolTag array (1 = Deprecated)
  score?: number;
  matches?: number[];
}

// Check if a symbol is deprecated
const isSymbolDeprecated = (symbol: WorkspaceSymbol): boolean => 
  symbol.tags?.includes(SymbolTag.Deprecated) ?? false;

// Fuzzy match algorithm
interface FuzzyResult {
  score: number;
  matches: number[];
}

function fuzzyMatch(query: string, text: string): FuzzyResult {
  if (!query) return { score: 0, matches: [] };
  
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  // Quick check: all query chars must exist in text
  let qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (textLower[ti] === queryLower[qi]) qi++;
  }
  if (qi !== query.length) return { score: 0, matches: [] };
  
  // Full scoring algorithm
  const matches: number[] = [];
  let score = 0;
  let lastMatchIndex = -1;
  let consecutiveBonus = 0;
  
  qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (textLower[ti] === queryLower[qi]) {
      matches.push(ti);
      
      // Base score for match
      let charScore = 1;
      
      // Consecutive match bonus (exponential)
      if (lastMatchIndex === ti - 1) {
        consecutiveBonus++;
        charScore += consecutiveBonus * 5;
      } else {
        consecutiveBonus = 0;
      }
      
      // Word boundary bonus
      if (ti === 0) {
        charScore += 10; // Start of string
      } else {
        const prevChar = text[ti - 1];
        if (prevChar === "_" || prevChar === "-" || prevChar === "." || prevChar === " ") {
          charScore += 8; // Word separator
        } else if (prevChar.toLowerCase() === prevChar && text[ti].toLowerCase() !== text[ti]) {
          charScore += 6; // camelCase boundary
        }
      }
      
      // Exact case match bonus
      if (query[qi] === text[ti]) {
        charScore += 2;
      }
      
      // Penalty for distance from last match
      if (lastMatchIndex >= 0 && ti - lastMatchIndex > 1) {
        charScore -= Math.min(ti - lastMatchIndex - 1, 3);
      }
      
      score += charScore;
      lastMatchIndex = ti;
      qi++;
    }
  }
  
  // Length penalty - shorter names are better
  score = score * (1 + 10 / (text.length + 10));
  
  return { score, matches };
}

// Highlight matched characters in text
function highlightMatches(text: string, matches?: number[]): JSX.Element {
  if (!matches || matches.length === 0) {
    return <span>{text}</span>;
  }
  
  const result: JSX.Element[] = [];
  let lastIndex = 0;
  const matchSet = new Set(matches);
  
  for (let i = 0; i < text.length; i++) {
    if (matchSet.has(i)) {
      // Add text before this match
      if (i > lastIndex) {
        result.push(<span>{text.slice(lastIndex, i)}</span>);
      }
      // Add highlighted character
      result.push(
        <span class="quick-input-highlight">{text[i]}</span>
      );
      lastIndex = i + 1;
    }
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    result.push(<span>{text.slice(lastIndex)}</span>);
  }
  
  return <>{result}</>;
}

// Extract file name from path
function getFileName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || filePath;
}

// Make path relative to project
function makeRelativePath(filePath: string, projectPath: string): string {
  // Normalize paths
  const normalizedFile = filePath.replace(/\\/g, "/").replace("file://", "");
  const normalizedProject = projectPath.replace(/\\/g, "/");
  
  if (normalizedFile.startsWith(normalizedProject)) {
    return normalizedFile.slice(normalizedProject.length + 1);
  }
  return normalizedFile;
}

// Parse query to extract filter prefix and search term
function parseQuery(query: string): { filter: SymbolKind[] | null; searchTerm: string } {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return { filter: null, searchTerm: "" };
  }
  
  const firstChar = trimmed[0];
  if (SYMBOL_KIND_FILTERS[firstChar]) {
    return {
      filter: SYMBOL_KIND_FILTERS[firstChar],
      searchTerm: trimmed.slice(1).trim(),
    };
  }
  
  return { filter: null, searchTerm: trimmed };
}

export function WorkspaceSymbolPicker() {
  const { showWorkspaceSymbolPicker, setShowWorkspaceSymbolPicker } = useCommands();
  const { openFile } = useEditor();
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [symbols, setSymbols] = createSignal<WorkspaceSymbol[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [noProjectOpen, setNoProjectOpen] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let abortController: AbortController | null = null;

  // Fetch symbols when query changes
  const fetchSymbols = async (searchQuery: string) => {
    const projectPath = getProjectPath();
    if (!projectPath) {
      setSymbols([]);
      setIsLoading(false);
      setNoProjectOpen(true);
      return;
    }
    
    setNoProjectOpen(false);
    setError(null);
    
    // Cancel previous request
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();
    
    // Extract search term (without filter prefix) for LSP query
    const { searchTerm } = parseQuery(searchQuery);
    
    setIsLoading(true);
    try {
      const lspSymbols = await lspWorkspaceSymbols(projectPath, searchTerm);
      
      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }
      
      const mappedSymbols: WorkspaceSymbol[] = (lspSymbols || []).map((sym: LspSymbol) => ({
        name: sym.name,
        kind: mapLspSymbolKind(sym.kind),
        containerName: sym.containerName,
        filePath: makeRelativePath(sym.location?.uri || "", projectPath),
        line: sym.location?.range?.start?.line || 0,
        character: sym.location?.range?.start?.character || 0,
        tags: sym.tags,
      }));
      
      setSymbols(mappedSymbols);
    } catch (err) {
      if (abortController?.signal.aborted) {
        return;
      }
      console.error("Failed to fetch workspace symbols:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch symbols");
      setSymbols([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      fetchSymbols(newQuery);
    }, 150);
  };

  // Reset and focus when opened
  createEffect(() => {
    if (showWorkspaceSymbolPicker()) {
      setIsVisible(true);
      setQuery("");
      setSelectedIndex(0);
      setSymbols([]);
      setTimeout(() => inputRef?.focus(), 10);
      // Fetch initial symbols with empty query
      fetchSymbols("");
    } else {
      setIsVisible(false);
    }
  });

  onCleanup(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (abortController) {
      abortController.abort();
    }
  });

  // Filtered and scored symbols with kind filtering support
  const filteredSymbols = createMemo(() => {
    const q = query().trim();
    const allSymbols = symbols();
    const { filter, searchTerm } = parseQuery(q);
    
    // Apply kind filter if present
    let filtered = allSymbols;
    if (filter) {
      filtered = allSymbols.filter((s) => filter.includes(s.kind));
    }
    
    if (!searchTerm) {
      // Without search term, sort by name and limit
      return filtered
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 100);
    }
    
    // Score all symbols with fuzzy matching
    const scored = filtered
      .map((symbol) => {
        const nameResult = fuzzyMatch(searchTerm, symbol.name);
        const containerResult = symbol.containerName ? fuzzyMatch(searchTerm, symbol.containerName) : { score: 0, matches: [] };
        
        return {
          ...symbol,
          score: nameResult.score * 2 + containerResult.score,
          matches: nameResult.matches,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);
    
    return scored;
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
      const items = listRef.querySelectorAll("[data-symbol-item]");
      const selectedItem = items[index] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  });

  // Global keyboard handler
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (!showWorkspaceSymbolPicker()) return;
    
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setShowWorkspaceSymbolPicker(false);
      return;
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleGlobalKeyDown, true);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleGlobalKeyDown, true);
  });

  const handleInputKeyDown = (e: KeyboardEvent) => {
    const syms = filteredSymbols();
    const pageSize = 10; // Number of items to skip with Page Up/Down
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, syms.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "PageDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + pageSize, syms.length - 1));
    } else if (e.key === "PageUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - pageSize, 0));
    } else if (e.key === "Home" && e.ctrlKey) {
      e.preventDefault();
      setSelectedIndex(0);
    } else if (e.key === "End" && e.ctrlKey) {
      e.preventDefault();
      setSelectedIndex(Math.max(0, syms.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const symbol = syms[selectedIndex()];
      if (symbol) {
        handleSelect(symbol);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else {
        setSelectedIndex((i) => Math.min(i + 1, syms.length - 1));
      }
    }
  };

  const handleSelect = async (symbol: WorkspaceSymbol) => {
    setShowWorkspaceSymbolPicker(false);
    const projectPath = getProjectPath();
    const fullPath = projectPath ? `${projectPath}/${symbol.filePath}` : symbol.filePath;
    
    // Open file
    await openFile(fullPath);
    
    // Navigate to the symbol location after file is opened
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("editor:goto-line", {
          detail: {
            line: symbol.line + 1,
            column: symbol.character + 1,
          },
        })
      );
    }, 100);
  };

  const getIconConfig = (kind: SymbolKind): { icon: string; color: string } => {
    return symbolIcons[kind] || symbolIcons.variable;
  };

  return (
    <Show when={showWorkspaceSymbolPicker()}>
      {/* Backdrop */}
      <div 
        class="quick-input-backdrop"
        classList={{ "animate-in": isVisible() }}
        onClick={() => setShowWorkspaceSymbolPicker(false)}
      />
      
      {/* Quick Input Widget */}
      <div 
        class="quick-input-widget"
        classList={{ "quick-input-animate-in": isVisible() }}
        style={{ 
          top: "12vh",
          background: "var(--ui-panel-bg)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          "border-radius": "var(--cortex-radius-md)",
          "box-shadow": "0 8px 32px rgba(0, 0, 0, 0.5)",
        }}
        role="dialog"
        aria-label="Go to Symbol in Workspace"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with input */}
        <div class="quick-input-header">
          <div class="quick-input-filter">
            <div class="quick-input-box">
              <div class="monaco-inputbox" style={{ "border-radius": "var(--cortex-radius-sm)", display: "flex", "align-items": "center", gap: "8px" }}>
                <Icon name="magnifying-glass" style={{ width: "16px", height: "16px", color: "var(--jb-text-muted-color)", "flex-shrink": "0" }} />
                <input
                  ref={inputRef}
                  type="text"
                  class="quick-input-input"
                  placeholder="Type to search for symbols across all files..."
                  value={query()}
                  onInput={(e) => handleQueryChange(e.currentTarget.value)}
                  onKeyDown={handleInputKeyDown}
                  role="textbox"
                  aria-haspopup="menu"
                  aria-autocomplete="list"
                  aria-controls="workspace-symbol-list"
                />
                <Show when={isLoading()}>
                  <div 
                    style={{ 
                      width: "14px", 
                      height: "14px", 
                      border: "2px solid var(--jb-text-muted-color)",
                      "border-top-color": "transparent",
                      "border-radius": "var(--cortex-radius-full)",
                      animation: "spin 1s linear infinite",
                      "flex-shrink": "0",
                    }} 
                  />
                </Show>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div 
          class="quick-input-progress"
          classList={{ 
            active: isLoading(),
            infinite: isLoading(),
            delayed: isLoading(),
          }}
        >
          <div class="progress-bit" />
        </div>

        {/* Results list */}
        <div 
          class="quick-input-list"
          id="workspace-symbol-list"
          role="listbox"
        >
          <div 
            ref={listRef}
            class="list-container"
            style={{ "max-height": "440px", overflow: "auto", "overscroll-behavior": "contain" }}
          >
            {/* Error state */}
            <Show when={error()}>
              <div style={{ padding: "16px", "text-align": "center" }}>
                <Icon name="circle-exclamation" style={{ width: "24px", height: "24px", color: "var(--jb-error)", "margin-bottom": "8px" }} />
                <p style={{ "font-size": "13px", color: "var(--jb-error)" }}>
                  {error()}
                </p>
                <p style={{ "font-size": "12px", color: "var(--jb-text-muted-color)", "margin-top": "4px" }}>
                  Make sure a language server is running for your project.
                </p>
              </div>
            </Show>

            {/* No project open */}
            <Show when={noProjectOpen() && !error()}>
              <div style={{ padding: "16px", "text-align": "center" }}>
                <p style={{ "font-size": "13px", color: "var(--jb-text-muted-color)" }}>
                  No project folder is open.
                </p>
                <p style={{ "font-size": "12px", color: "var(--jb-text-muted-color)", "margin-top": "4px" }}>
                  Open a folder to search for symbols.
                </p>
              </div>
            </Show>

            {/* Empty results */}
            <Show when={!error() && !noProjectOpen() && filteredSymbols().length === 0}>
              <div style={{ padding: "16px", "text-align": "center" }}>
                <p style={{ "font-size": "13px", color: "var(--jb-text-muted-color)" }}>
                  {isLoading() 
                    ? "Searching symbols..." 
                    : query() 
                      ? `No symbols found matching "${parseQuery(query()).searchTerm || query()}"` 
                      : "Start typing to search for symbols across your workspace"}
                </p>
                <Show when={!isLoading() && !query()}>
                  <div style={{ "margin-top": "12px", "font-size": "11px", color: "var(--jb-text-muted-color)" }}>
                    <p style={{ "margin-bottom": "4px" }}>Filter by type:</p>
                    <p><code style={{ background: "var(--jb-surface-hover)", padding: "2px 4px", "border-radius": "var(--cortex-radius-sm)" }}>:</code> Classes/Types</p>
                    <p><code style={{ background: "var(--jb-surface-hover)", padding: "2px 4px", "border-radius": "var(--cortex-radius-sm)" }}>@</code> Functions/Methods</p>
                    <p><code style={{ background: "var(--jb-surface-hover)", padding: "2px 4px", "border-radius": "var(--cortex-radius-sm)" }}>#</code> Variables/Constants</p>
                  </div>
                </Show>
              </div>
            </Show>

            <div class="scrollable-element">
              <For each={filteredSymbols()}>
                {(symbol, index) => {
                  const iconConfig = getIconConfig(symbol.kind);
                  return (
                    <div
                      data-symbol-item
                      class="quick-input-list-row"
                      classList={{ 
                        focused: index() === selectedIndex(),
                        "symbol-deprecated": isSymbolDeprecated(symbol),
                      }}
                      style={{ height: "22px" }}
                      role="option"
                      aria-selected={index() === selectedIndex()}
                      onMouseEnter={() => setSelectedIndex(index())}
                      onClick={() => handleSelect(symbol)}
                    >
                      <div class="quick-input-list-entry">
                        {/* Symbol icon */}
                        <div class="quick-input-list-icon" style={{ color: iconConfig.color }}>
                          <Icon name={iconConfig.icon} style={{ width: "14px", height: "14px" }} />
                        </div>
                        
                        {/* Label rows */}
                        <div class="quick-input-list-rows">
                          <div class="quick-input-list-row-content" style={{ gap: "6px" }}>
                            {/* Symbol name with highlight */}
                            <span 
                              class="quick-input-label-name"
                              style={{ 
                                "font-size": "13px",
                                overflow: "hidden",
                                "text-overflow": "ellipsis",
                                "white-space": "nowrap",
                              }}
                            >
                              {highlightMatches(symbol.name, symbol.matches)}
                            </span>
                            
                            {/* Container name */}
                            <Show when={symbol.containerName}>
                              <span 
                                class="quick-input-label-description"
                                style={{ 
                                  "font-size": "12px",
                                  color: "var(--jb-text-muted-color)",
                                }}
                              >
                                {symbol.containerName}
                              </span>
                            </Show>
                          </div>
                        </div>

                        {/* Symbol kind label */}
                        <span 
                          style={{ 
                            "font-size": "10px",
                            color: "var(--jb-text-muted-color)",
                            "margin-left": "auto",
                            "padding-right": "4px",
                            "white-space": "nowrap",
                          }}
                        >
                          {getSymbolKindLabel(symbol.kind)}
                        </span>

                        {/* File path and line */}
                        <span 
                          class="quick-input-label-description"
                          style={{ 
                            display: "flex",
                            "align-items": "center",
                            gap: "4px",
                            "flex-shrink": "0",
                            color: "var(--jb-text-muted-color)",
                            "font-size": "11px",
                          }}
                        >
                          <Icon name="file" style={{ width: "12px", height: "12px", "flex-shrink": "0" }} />
                          <span style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", "max-width": "180px" }}>
                            {getFileName(symbol.filePath)}:{symbol.line + 1}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </div>

        {/* Footer with keyboard hints */}
        <div 
          style={{ 
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            padding: "4px 6px",
            "font-size": "11px",
            "border-top": "1px solid var(--jb-border-default)",
            color: "var(--jb-text-muted-color)",
            background: "var(--jb-canvas)",
          }}
        >
          <span style={{ display: "flex", gap: "8px" }}>
            <span><span class="quick-input-keybinding-key" style={{ padding: "2px 4px" }}>↑</span><span class="quick-input-keybinding-key" style={{ padding: "2px 4px" }}>↓</span> navigate</span>
            <span><span class="quick-input-keybinding-key" style={{ padding: "2px 4px" }}>Enter</span> go to symbol</span>
            <span><span class="quick-input-keybinding-key" style={{ padding: "2px 4px" }}>Esc</span> close</span>
          </span>
          <span style={{ display: "flex", "align-items": "center", gap: "6px" }}>
            <Show when={parseQuery(query()).filter}>
              <span 
                style={{ 
                  background: "var(--jb-surface-selected)", 
                  padding: "1px 6px", 
                  "border-radius": "var(--cortex-radius-sm)",
                  "font-size": "10px",
                }}
              >
                {parseQuery(query()).filter?.includes("class") ? "Types" : 
                 parseQuery(query()).filter?.includes("function") ? "Functions" :
                 parseQuery(query()).filter?.includes("variable") ? "Variables" :
                 parseQuery(query()).filter?.includes("property") ? "Properties" : "Filtered"}
              </span>
            </Show>
            <span>
              {filteredSymbols().length} symbol{filteredSymbols().length !== 1 ? "s" : ""} 
              {parseQuery(query()).searchTerm && ` matching "${parseQuery(query()).searchTerm}"`}
            </span>
          </span>
        </div>
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Show>
  );
}

