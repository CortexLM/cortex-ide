import { createContext, useContext, ParentProps, createEffect, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useEditor } from "./EditorContext";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Outline Cache Implementation (LRU with TTL)
// ============================================================================

interface CachedOutline {
  symbols: DocumentSymbol[];
  version: number; // Content hash for cache invalidation
  timestamp: number;
}

const OUTLINE_CACHE_SIZE = 15;
const OUTLINE_CACHE_TTL = 60000; // 1 minute

/**
 * Simple hash function for content versioning.
 * Uses djb2 algorithm for fast, reasonable distribution.
 */
function hashContent(content: string): number {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) ^ content.charCodeAt(i);
  }
  return hash >>> 0; // Ensure unsigned 32-bit integer
}

/**
 * LRU cache for outline symbols with TTL-based expiration.
 * Caches parsed symbols per file to avoid re-fetching/re-parsing.
 */
class OutlineCache {
  private cache = new Map<string, CachedOutline>();
  private accessOrder: string[] = [];

  /**
   * Get cached symbols for a file if valid.
   * Returns null if not cached, version mismatch, or TTL expired.
   */
  get(filePath: string, version: number): DocumentSymbol[] | null {
    const entry = this.cache.get(filePath);
    if (!entry) return null;

    // Check version and TTL
    if (entry.version !== version || Date.now() - entry.timestamp > OUTLINE_CACHE_TTL) {
      this.cache.delete(filePath);
      this.accessOrder = this.accessOrder.filter(p => p !== filePath);
      return null;
    }

    // Update access order (LRU)
    this.accessOrder = this.accessOrder.filter(p => p !== filePath);
    this.accessOrder.push(filePath);

    return entry.symbols;
  }

  /**
   * Cache symbols for a file with the given version.
   * Evicts oldest entries if cache is full.
   */
  set(filePath: string, version: number, symbols: DocumentSymbol[]): void {
    // Remove existing entry if present (to update access order)
    if (this.cache.has(filePath)) {
      this.accessOrder = this.accessOrder.filter(p => p !== filePath);
    }

    // Evict oldest if full
    while (this.cache.size >= OUTLINE_CACHE_SIZE) {
      const oldest = this.accessOrder.shift();
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(filePath, {
      symbols,
      version,
      timestamp: Date.now(),
    });
    this.accessOrder.push(filePath);
  }

  /**
   * Invalidate cache entry for a specific file.
   * Called on file save to ensure fresh symbols.
   */
  invalidate(filePath: string): void {
    this.cache.delete(filePath);
    this.accessOrder = this.accessOrder.filter(p => p !== filePath);
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get current cache size (for debugging/metrics).
   */
  get size(): number {
    return this.cache.size;
  }
}

// Global outline cache instance
const outlineCache = new OutlineCache();

// ============================================================================
// LSP Symbol Types
// ============================================================================

// LSP Symbol Kinds (matching LSP specification)
export type SymbolKind =
  | "file"
  | "module"
  | "namespace"
  | "package"
  | "class"
  | "method"
  | "property"
  | "field"
  | "constructor"
  | "enum"
  | "interface"
  | "function"
  | "variable"
  | "constant"
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "key"
  | "null"
  | "enumMember"
  | "struct"
  | "event"
  | "operator"
  | "typeParameter";

export interface SymbolRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface DocumentSymbol {
  id: string;
  name: string;
  detail?: string;
  kind: SymbolKind;
  tags?: number[]; // LSP SymbolTag array (1 = Deprecated)
  range: SymbolRange;
  selectionRange: SymbolRange;
  children: DocumentSymbol[];
  depth: number;
  expanded: boolean;
}

// Primary symbol types for filtering (grouping similar kinds)
export type SymbolTypeFilter =
  | "class"
  | "function"
  | "variable"
  | "interface"
  | "enum"
  | "property"
  | "module"
  | "type"
  | "other";

// Mapping from SymbolKind to SymbolTypeFilter for grouping
const symbolKindToFilter: Record<SymbolKind, SymbolTypeFilter> = {
  file: "module",
  module: "module",
  namespace: "module",
  package: "module",
  class: "class",
  method: "function",
  property: "property",
  field: "property",
  constructor: "function",
  enum: "enum",
  interface: "interface",
  function: "function",
  variable: "variable",
  constant: "variable",
  string: "other",
  number: "other",
  boolean: "other",
  array: "other",
  object: "other",
  key: "property",
  null: "other",
  enumMember: "enum",
  struct: "class",
  event: "other",
  operator: "other",
  typeParameter: "type",
};

// Labels and colors for symbol type filters
export const symbolTypeFilterConfig: Record<SymbolTypeFilter, { label: string; color: string; kinds: SymbolKind[] }> = {
  class: { label: "Classes", color: "#f59e0b", kinds: ["class", "struct"] },
  function: { label: "Functions", color: "#a855f7", kinds: ["function", "method", "constructor"] },
  variable: { label: "Variables", color: "#3b82f6", kinds: ["variable", "constant"] },
  interface: { label: "Interfaces", color: "#22c55e", kinds: ["interface"] },
  enum: { label: "Enums", color: "#f59e0b", kinds: ["enum", "enumMember"] },
  property: { label: "Properties", color: "#06b6d4", kinds: ["property", "field", "key"] },
  module: { label: "Modules", color: "#f59e0b", kinds: ["file", "module", "namespace", "package"] },
  type: { label: "Types", color: "#22c55e", kinds: ["typeParameter"] },
  other: { label: "Other", color: "#71717a", kinds: ["string", "number", "boolean", "array", "object", "null", "event", "operator"] },
};

// All available filter types
export const allSymbolTypeFilters: SymbolTypeFilter[] = [
  "class",
  "function",
  "variable",
  "interface",
  "enum",
  "property",
  "module",
  "type",
  "other",
];

// Storage key for persisting filter settings
const SYMBOL_FILTER_STORAGE_KEY = "orion:outline:symbolTypeFilter";

// Load persisted filter settings
function loadPersistedSymbolFilter(): Set<SymbolTypeFilter> {
  try {
    const stored = localStorage.getItem(SYMBOL_FILTER_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as SymbolTypeFilter[];
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((t) => allSymbolTypeFilters.includes(t)));
      }
    }
  } catch (err) {
    console.debug("[Outline] Parse error loading filter:", err);
  }
  // Default: all types visible
  return new Set(allSymbolTypeFilters);
}

// Save filter settings to localStorage
function persistSymbolFilter(filter: Set<SymbolTypeFilter>): void {
  try {
    localStorage.setItem(SYMBOL_FILTER_STORAGE_KEY, JSON.stringify([...filter]));
  } catch (err) {
    console.debug("[Outline] Storage save failed:", err);
  }
}

// Get the filter type for a symbol kind
export function getSymbolFilterType(kind: SymbolKind): SymbolTypeFilter {
  return symbolKindToFilter[kind] ?? "other";
}

interface SymbolTypeCounts {
  [key: string]: number;
}

interface OutlineState {
  symbols: DocumentSymbol[];
  flattenedSymbols: DocumentSymbol[];
  loading: boolean;
  error: string | null;
  filter: string;
  symbolTypeFilter: Set<SymbolTypeFilter>;
  activeSymbolId: string | null;
  expandedIds: Set<string>;
  currentFileId: string | null;
  symbolTypeCounts: SymbolTypeCounts;
}

interface OutlineContextValue {
  state: OutlineState;
  fetchSymbols: (fileId: string, content: string, language: string) => Promise<void>;
  setFilter: (filter: string) => void;
  toggleExpanded: (symbolId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  navigateToSymbol: (symbol: DocumentSymbol) => void;
  setActiveSymbol: (symbolId: string | null) => void;
  getFilteredSymbols: () => DocumentSymbol[];
  clear: () => void;
  toggleSymbolType: (type: SymbolTypeFilter) => void;
  setAllSymbolTypes: (enabled: boolean) => void;
  isSymbolTypeEnabled: (type: SymbolTypeFilter) => boolean;
}

const OutlineContext = createContext<OutlineContextValue>();

// Map numeric LSP SymbolKind to string
function mapSymbolKind(kind: number): SymbolKind {
  const kinds: SymbolKind[] = [
    "file",        // 1
    "module",      // 2
    "namespace",   // 3
    "package",     // 4
    "class",       // 5
    "method",      // 6
    "property",    // 7
    "field",       // 8
    "constructor", // 9
    "enum",        // 10
    "interface",   // 11
    "function",    // 12
    "variable",    // 13
    "constant",    // 14
    "string",      // 15
    "number",      // 16
    "boolean",     // 17
    "array",       // 18
    "object",      // 19
    "key",         // 20
    "null",        // 21
    "enumMember",  // 22
    "struct",      // 23
    "event",       // 24
    "operator",    // 25
    "typeParameter", // 26
  ];
  return kinds[kind - 1] ?? "variable";
}

// Generate unique ID for a symbol
function generateSymbolId(symbol: DocumentSymbol, parentId: string = ""): string {
  const baseId = `${parentId}_${symbol.name}_${symbol.kind}_${symbol.range.startLine}`;
  return baseId.replace(/[^a-zA-Z0-9_]/g, "_");
}

// Parse symbols from LSP response
function parseSymbols(
  rawSymbols: unknown[],
  depth: number = 0,
  parentId: string = "root"
): DocumentSymbol[] {
  if (!Array.isArray(rawSymbols)) return [];

  return rawSymbols.map((raw: unknown, index: number) => {
    const sym = raw as {
      name: string;
      detail?: string;
      kind: number;
      tags?: number[]; // LSP SymbolTag array (1 = Deprecated)
      range: { start: { line: number; character: number }; end: { line: number; character: number } };
      selectionRange: { start: { line: number; character: number }; end: { line: number; character: number } };
      children?: unknown[];
    };

    const symbol: DocumentSymbol = {
      id: "",
      name: sym.name,
      detail: sym.detail,
      kind: mapSymbolKind(sym.kind),
      tags: sym.tags,
      range: {
        startLine: sym.range.start.line,
        startColumn: sym.range.start.character,
        endLine: sym.range.end.line,
        endColumn: sym.range.end.character,
      },
      selectionRange: {
        startLine: sym.selectionRange.start.line,
        startColumn: sym.selectionRange.start.character,
        endLine: sym.selectionRange.end.line,
        endColumn: sym.selectionRange.end.character,
      },
      children: [],
      depth,
      expanded: depth < 2, // Auto-expand first 2 levels
    };

    symbol.id = generateSymbolId(symbol, `${parentId}_${index}`);

    if (sym.children && Array.isArray(sym.children)) {
      symbol.children = parseSymbols(sym.children, depth + 1, symbol.id);
    }

    return symbol;
  });
}

// Flatten symbols into a list for rendering
function flattenSymbols(symbols: DocumentSymbol[], expandedIds: Set<string>): DocumentSymbol[] {
  const result: DocumentSymbol[] = [];

  function flatten(syms: DocumentSymbol[]) {
    for (const sym of syms) {
      result.push(sym);
      if (sym.children.length > 0 && expandedIds.has(sym.id)) {
        flatten(sym.children);
      }
    }
  }

  flatten(symbols);
  return result;
}

// Collect all symbol IDs for expand/collapse all
function collectAllIds(symbols: DocumentSymbol[]): string[] {
  const ids: string[] = [];
  function collect(syms: DocumentSymbol[]) {
    for (const sym of syms) {
      if (sym.children.length > 0) {
        ids.push(sym.id);
        collect(sym.children);
      }
    }
  }
  collect(symbols);
  return ids;
}

// Filter symbols recursively by text and symbol type
function filterSymbols(
  symbols: DocumentSymbol[],
  textFilter: string,
  symbolTypeFilter: Set<SymbolTypeFilter>
): DocumentSymbol[] {
  const hasTextFilter = textFilter.trim().length > 0;
  const hasTypeFilter = symbolTypeFilter.size < allSymbolTypeFilters.length;
  
  if (!hasTextFilter && !hasTypeFilter) return symbols;

  const lowerFilter = textFilter.toLowerCase();

  function matchesText(sym: DocumentSymbol): boolean {
    if (!hasTextFilter) return true;
    if (sym.name.toLowerCase().includes(lowerFilter)) return true;
    if (sym.detail?.toLowerCase().includes(lowerFilter)) return true;
    return false;
  }

  function matchesType(sym: DocumentSymbol): boolean {
    if (!hasTypeFilter) return true;
    const filterType = getSymbolFilterType(sym.kind);
    return symbolTypeFilter.has(filterType);
  }

  function filterRecursive(syms: DocumentSymbol[]): DocumentSymbol[] {
    const filtered: DocumentSymbol[] = [];
    for (const sym of syms) {
      const filteredChildren = filterRecursive(sym.children);
      const symbolMatchesType = matchesType(sym);
      const symbolMatchesText = matchesText(sym);
      
      // Include if: matches both filters, or has children that match
      if ((symbolMatchesType && symbolMatchesText) || filteredChildren.length > 0) {
        filtered.push({
          ...sym,
          children: filteredChildren,
          expanded: hasTextFilter || hasTypeFilter, // Auto-expand when filtering
        });
      }
    }
    return filtered;
  }

  return filterRecursive(symbols);
}

// Count symbols by type recursively
function countSymbolsByType(symbols: DocumentSymbol[]): SymbolTypeCounts {
  const counts: SymbolTypeCounts = {};
  
  // Initialize counts for all types
  for (const type of allSymbolTypeFilters) {
    counts[type] = 0;
  }

  function countRecursive(syms: DocumentSymbol[]) {
    for (const sym of syms) {
      const filterType = getSymbolFilterType(sym.kind);
      counts[filterType] = (counts[filterType] || 0) + 1;
      countRecursive(sym.children);
    }
  }

  countRecursive(symbols);
  return counts;
}

// Parse symbols from a simple regex-based approach when LSP isn't available
function parseSymbolsFromContent(content: string, language: string): DocumentSymbol[] {
  const symbols: DocumentSymbol[] = [];
  const lines = content.split("\n");

  // Language-specific patterns
  const patterns: Record<string, { pattern: RegExp; kind: SymbolKind }[]> = {
    typescript: [
      { pattern: /^export\s+(default\s+)?class\s+(\w+)/m, kind: "class" },
      { pattern: /^(export\s+)?(default\s+)?class\s+(\w+)/m, kind: "class" },
      { pattern: /^(export\s+)?(async\s+)?function\s+(\w+)/m, kind: "function" },
      { pattern: /^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(/m, kind: "function" },
      { pattern: /^(export\s+)?const\s+(\w+)\s*=\s*\(/m, kind: "function" },
      { pattern: /^(export\s+)?interface\s+(\w+)/m, kind: "interface" },
      { pattern: /^(export\s+)?type\s+(\w+)/m, kind: "typeParameter" },
      { pattern: /^(export\s+)?enum\s+(\w+)/m, kind: "enum" },
      { pattern: /^\s+(public\s+|private\s+|protected\s+)?(static\s+)?(async\s+)?(\w+)\s*\(/m, kind: "method" },
      { pattern: /^\s+(public\s+|private\s+|protected\s+)?(static\s+)?(\w+)\s*:/m, kind: "property" },
    ],
    javascript: [
      { pattern: /^(export\s+)?(default\s+)?class\s+(\w+)/m, kind: "class" },
      { pattern: /^(export\s+)?(async\s+)?function\s+(\w+)/m, kind: "function" },
      { pattern: /^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(/m, kind: "function" },
      { pattern: /^(export\s+)?const\s+(\w+)\s*=\s*\(/m, kind: "function" },
    ],
    python: [
      { pattern: /^class\s+(\w+)/m, kind: "class" },
      { pattern: /^(async\s+)?def\s+(\w+)/m, kind: "function" },
      { pattern: /^\s+(async\s+)?def\s+(\w+)/m, kind: "method" },
    ],
    rust: [
      { pattern: /^(pub\s+)?struct\s+(\w+)/m, kind: "struct" },
      { pattern: /^(pub\s+)?enum\s+(\w+)/m, kind: "enum" },
      { pattern: /^(pub\s+)?trait\s+(\w+)/m, kind: "interface" },
      { pattern: /^(pub\s+)?(async\s+)?fn\s+(\w+)/m, kind: "function" },
      { pattern: /^\s+(pub\s+)?(async\s+)?fn\s+(\w+)/m, kind: "method" },
      { pattern: /^impl(\s+<[^>]+>)?\s+(\w+)/m, kind: "class" },
      { pattern: /^(pub\s+)?mod\s+(\w+)/m, kind: "module" },
    ],
    go: [
      { pattern: /^type\s+(\w+)\s+struct/m, kind: "struct" },
      { pattern: /^type\s+(\w+)\s+interface/m, kind: "interface" },
      { pattern: /^func\s+(\w+)/m, kind: "function" },
      { pattern: /^func\s+\([^)]+\)\s+(\w+)/m, kind: "method" },
      { pattern: /^package\s+(\w+)/m, kind: "package" },
    ],
  };

  const langPatterns = patterns[language] || patterns.typescript;

  lines.forEach((line, index) => {
    for (const { pattern, kind } of langPatterns) {
      const match = line.match(pattern);
      if (match) {
        // Find the actual symbol name (last capture group that's a word)
        let name = "";
        for (let i = match.length - 1; i >= 1; i--) {
          if (match[i] && /^\w+$/.test(match[i])) {
            name = match[i];
            break;
          }
        }
        if (!name) continue;

        const symbol: DocumentSymbol = {
          id: `${kind}_${name}_${index}`,
          name,
          kind,
          range: {
            startLine: index,
            startColumn: 0,
            endLine: index,
            endColumn: line.length,
          },
          selectionRange: {
            startLine: index,
            startColumn: line.indexOf(name),
            endLine: index,
            endColumn: line.indexOf(name) + name.length,
          },
          children: [],
          depth: 0,
          expanded: true,
        };
        symbols.push(symbol);
        break; // Only match once per line
      }
    }
  });

  return symbols;
}

export function OutlineProvider(props: ParentProps) {
  const editor = useEditor();

  const [state, setState] = createStore<OutlineState>({
    symbols: [],
    flattenedSymbols: [],
    loading: false,
    error: null,
    filter: "",
    symbolTypeFilter: loadPersistedSymbolFilter(),
    activeSymbolId: null,
    expandedIds: new Set(),
    currentFileId: null,
    symbolTypeCounts: {},
  });

  // Update flattened symbols when symbols, filter, or symbol type filter changes
  createEffect(() => {
    const filtered = filterSymbols(state.symbols, state.filter, state.symbolTypeFilter);
    const flattened = flattenSymbols(filtered, state.expandedIds);
    setState("flattenedSymbols", flattened);
  });

  // Invalidate outline cache on file save to ensure fresh symbols
  createEffect(() => {
    const handleFileSaved = (e: CustomEvent<{ path: string }>) => {
      outlineCache.invalidate(e.detail.path);
    };

    window.addEventListener("file:saved", handleFileSaved as EventListener);

    onCleanup(() => {
      window.removeEventListener("file:saved", handleFileSaved as EventListener);
    });
  });

  // Update symbol type counts when symbols change
  createEffect(() => {
    const counts = countSymbolsByType(state.symbols);
    setState("symbolTypeCounts", counts);
  });

  // Watch for active file changes
  createEffect(() => {
    const activeFile = editor.state.openFiles.find(
      (f) => f.id === editor.state.activeFileId
    );

    if (activeFile && activeFile.id !== state.currentFileId) {
      setState("currentFileId", activeFile.id);
      fetchSymbols(activeFile.id, activeFile.content, activeFile.language);
    } else if (!activeFile) {
      clear();
    }
  });

  const fetchSymbols = async (
    fileId: string,
    content: string,
    language: string
  ): Promise<void> => {
    // Compute content version hash for cache lookup
    const contentVersion = hashContent(content);
    
    // Check cache first
    const cachedSymbols = outlineCache.get(fileId, contentVersion);
    if (cachedSymbols) {
      // Cache hit - use cached symbols
      const allIds = collectAllIds(cachedSymbols);
      setState("symbols", cachedSymbols);
      setState("expandedIds", new Set(allIds.slice(0, 20)));
      setState("loading", false);
      setState("error", null);
      return;
    }

    // Cache miss - fetch symbols
    setState("loading", true);
    setState("error", null);

    try {
      // Try to use LSP documentSymbols if available
      let rawSymbols: unknown[] = [];
      
      try {
        rawSymbols = await invoke<unknown[]>("lsp_document_symbols", {
          content,
          language,
        });
      } catch (err) {
        console.debug("[Outline] LSP symbols fetch failed, using fallback:", err);
        // LSP not available, use fallback parser
        const parsedSymbols = parseSymbolsFromContent(content, language);
        rawSymbols = parsedSymbols as unknown[];
        
        if (parsedSymbols.length > 0) {
          const allIds = collectAllIds(parsedSymbols);
          setState("symbols", parsedSymbols);
          setState("expandedIds", new Set(allIds));
          setState("loading", false);
          // Cache the fallback result
          outlineCache.set(fileId, contentVersion, parsedSymbols);
          return;
        }
      }

      if (Array.isArray(rawSymbols) && rawSymbols.length > 0) {
        const symbols = parseSymbols(rawSymbols);
        const allIds = collectAllIds(symbols);
        setState("symbols", symbols);
        setState("expandedIds", new Set(allIds.slice(0, 20))); // Initially expand first 20
        // Cache the LSP result
        outlineCache.set(fileId, contentVersion, symbols);
      } else {
        // Fallback to regex-based parsing
        const symbols = parseSymbolsFromContent(content, language);
        const allIds = collectAllIds(symbols);
        setState("symbols", symbols);
        setState("expandedIds", new Set(allIds));
        // Cache the fallback result
        outlineCache.set(fileId, contentVersion, symbols);
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState("error", error);
      // Even on error, try fallback
      const symbols = parseSymbolsFromContent(content, language);
      const allIds = collectAllIds(symbols);
      setState("symbols", symbols);
      setState("expandedIds", new Set(allIds));
      // Cache even the error fallback to avoid repeated failures
      outlineCache.set(fileId, contentVersion, symbols);
    } finally {
      setState("loading", false);
    }
  };

  const setFilter = (filter: string): void => {
    setState("filter", filter);
  };

  const toggleExpanded = (symbolId: string): void => {
    setState(
      produce((s) => {
        if (s.expandedIds.has(symbolId)) {
          s.expandedIds.delete(symbolId);
        } else {
          s.expandedIds.add(symbolId);
        }
      })
    );
  };

  const expandAll = (): void => {
    const allIds = collectAllIds(state.symbols);
    setState("expandedIds", new Set(allIds));
  };

  const collapseAll = (): void => {
    setState("expandedIds", new Set());
  };

  const navigateToSymbol = (symbol: DocumentSymbol): void => {
    const activeFile = editor.state.openFiles.find(
      (f) => f.id === editor.state.activeFileId
    );
    
    if (!activeFile) return;

    // Emit a custom event for the editor to handle
    const event = new CustomEvent("outline:navigate", {
      detail: {
        fileId: activeFile.id,
        line: symbol.selectionRange.startLine + 1, // Monaco uses 1-based lines
        column: symbol.selectionRange.startColumn + 1,
      },
    });
    window.dispatchEvent(event);
    
    setState("activeSymbolId", symbol.id);
  };

  const setActiveSymbol = (symbolId: string | null): void => {
    setState("activeSymbolId", symbolId);
  };

  const getFilteredSymbols = (): DocumentSymbol[] => {
    return filterSymbols(state.symbols, state.filter, state.symbolTypeFilter);
  };

  const toggleSymbolType = (type: SymbolTypeFilter): void => {
    setState(
      produce((s) => {
        if (s.symbolTypeFilter.has(type)) {
          s.symbolTypeFilter.delete(type);
        } else {
          s.symbolTypeFilter.add(type);
        }
        persistSymbolFilter(s.symbolTypeFilter);
      })
    );
  };

  const setAllSymbolTypes = (enabled: boolean): void => {
    if (enabled) {
      setState("symbolTypeFilter", new Set(allSymbolTypeFilters));
      persistSymbolFilter(new Set(allSymbolTypeFilters));
    } else {
      setState("symbolTypeFilter", new Set());
      persistSymbolFilter(new Set());
    }
  };

  const isSymbolTypeEnabled = (type: SymbolTypeFilter): boolean => {
    return state.symbolTypeFilter.has(type);
  };

  const clear = (): void => {
    setState("symbols", []);
    setState("flattenedSymbols", []);
    setState("filter", "");
    setState("activeSymbolId", null);
    setState("expandedIds", new Set());
    setState("currentFileId", null);
    setState("error", null);
    setState("symbolTypeCounts", {});
    // Note: We intentionally don't clear the cache here to preserve
    // symbols for files that might be reopened soon
  };

  return (
    <OutlineContext.Provider
      value={{
        state,
        fetchSymbols,
        setFilter,
        toggleExpanded,
        expandAll,
        collapseAll,
        navigateToSymbol,
        setActiveSymbol,
        getFilteredSymbols,
        clear,
        toggleSymbolType,
        setAllSymbolTypes,
        isSymbolTypeEnabled,
      }}
    >
      {props.children}
    </OutlineContext.Provider>
  );
}

export function useOutline() {
  const context = useContext(OutlineContext);
  if (!context) {
    throw new Error("useOutline must be used within OutlineProvider");
  }
  return context;
}
