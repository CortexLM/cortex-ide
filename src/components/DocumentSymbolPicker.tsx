import { createSignal, createEffect, For, Show, onMount, onCleanup, createMemo, JSX } from "solid-js";
import { useCommands } from "@/context/CommandContext";
import { useOutline, type DocumentSymbol, type SymbolKind } from "@/context/OutlineContext";
import { Icon } from "./ui/Icon";
import "@/styles/quickinput.css";

// Symbol icons by kind with colors (matching OutlineContext patterns)
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

// Flattened symbol with parent context
interface FlatSymbol extends DocumentSymbol {
  containerName?: string;
}

// Check if a symbol is deprecated
const isSymbolDeprecated = (symbol: FlatSymbol): boolean => 
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

// Flatten nested DocumentSymbol tree into a flat list with parent context
function flattenSymbols(symbols: DocumentSymbol[], parentName?: string): FlatSymbol[] {
  const result: FlatSymbol[] = [];
  
  for (const symbol of symbols) {
    result.push({
      ...symbol,
      containerName: parentName,
    });
    
    if (symbol.children && symbol.children.length > 0) {
      result.push(...flattenSymbols(symbol.children, symbol.name));
    }
  }
  
  return result;
}

export function DocumentSymbolPicker() {
  const { showDocumentSymbolPicker, setShowDocumentSymbolPicker } = useCommands();
  const { state: outlineState, navigateToSymbol } = useOutline();
  
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [isVisible, setIsVisible] = createSignal(false);
  
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  // Flatten and filter symbols based on query
  const filteredSymbols = createMemo(() => {
    const symbols = outlineState.symbols;
    const flat = flattenSymbols(symbols);
    const q = query().trim();
    
    if (!q) {
      // Without query, return all symbols sorted by position
      return flat
        .sort((a, b) => a.range.startLine - b.range.startLine)
        .slice(0, 100)
        .map(s => ({ ...s, score: 0, matches: [] as number[] }));
    }
    
    // Score all symbols with fuzzy match
    const scored = flat
      .map((symbol) => {
        const nameResult = fuzzyMatch(q, symbol.name);
        const containerResult = symbol.containerName ? fuzzyMatch(q, symbol.containerName) : { score: 0, matches: [] };
        
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

  // Reset and focus when opened
  createEffect(() => {
    if (showDocumentSymbolPicker()) {
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
      const items = listRef.querySelectorAll("[data-symbol-item]");
      const selectedItem = items[index] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  });

  // Global keyboard handler for escape
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (!showDocumentSymbolPicker()) return;
    
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setShowDocumentSymbolPicker(false);
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
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, syms.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
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

  const handleSelect = (symbol: FlatSymbol) => {
    setShowDocumentSymbolPicker(false);
    
    // Use OutlineContext's navigateToSymbol which handles editor navigation
    navigateToSymbol(symbol);
  };

  const getIconConfig = (kind: SymbolKind): { icon: string; color: string } => {
    return symbolIcons[kind] || symbolIcons.variable;
  };

  return (
    <Show when={showDocumentSymbolPicker()}>
      {/* Backdrop */}
      <div 
        class="quick-input-backdrop"
        classList={{ "animate-in": isVisible() }}
        onClick={() => setShowDocumentSymbolPicker(false)}
      />
      
      {/* Quick Input Widget */}
      <div 
        class="quick-input-widget"
        classList={{ "quick-input-animate-in": isVisible() }}
        style={{ top: "12vh" }}
        role="dialog"
        aria-label="Go to Symbol in Editor"
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
                  placeholder="Go to Symbol in Editor (@)..."
                  value={query()}
                  onInput={(e) => setQuery(e.currentTarget.value)}
                  onKeyDown={handleInputKeyDown}
                  role="textbox"
                  aria-haspopup="menu"
                  aria-autocomplete="list"
                  aria-controls="document-symbol-list"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar placeholder (for consistent styling) */}
        <div class="quick-input-progress">
          <div class="progress-bit" />
        </div>

        {/* Results list */}
        <div 
          class="quick-input-list"
          id="document-symbol-list"
          role="listbox"
        >
          <div 
            ref={listRef}
            class="list-container"
            style={{ "max-height": "440px", overflow: "auto", "overscroll-behavior": "contain" }}
          >
            <Show when={outlineState.loading}>
              <div style={{ padding: "16px", "text-align": "center" }}>
                <p style={{ "font-size": "13px", color: "var(--jb-text-muted-color)" }}>
                  Loading symbols...
                </p>
              </div>
            </Show>

            <Show when={!outlineState.loading && filteredSymbols().length === 0}>
              <div style={{ padding: "16px", "text-align": "center" }}>
                <p style={{ "font-size": "13px", color: "var(--jb-text-muted-color)" }}>
                  {query() 
                    ? "No symbols found matching your search" 
                    : outlineState.symbols.length === 0
                      ? "No symbols found in this file"
                      : "Type to filter symbols"}
                </p>
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
                            
                            {/* Container name (parent symbol) */}
                            <Show when={symbol.containerName}>
                              <span 
                                class="quick-input-label-description"
                                style={{ 
                                  "font-size": "12px",
                                  color: "var(--jb-text-muted-color)",
                                }}
                              >
                                in {symbol.containerName}
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

                        {/* Line number */}
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
                          <span>:{symbol.range.startLine + 1}</span>
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
          <span>
            {filteredSymbols().length} symbol{filteredSymbols().length !== 1 ? "s" : ""} 
            {query() && ` matching "${query()}"`}
          </span>
        </div>
      </div>
    </Show>
  );
}

