import { createSignal, createEffect, For, Show, JSX, onCleanup } from "solid-js";
import { useCommands } from "@/context/CommandContext";
import { useEditor } from "@/context/EditorContext";
import { type Position } from "@/context/LSPContext";
import { Icon } from "./ui/Icon";
import {
  fsReadFile,
  fsGetFileTree,
  lspWorkspaceSymbols,
  type FileTreeNode,
} from "../utils/tauri-api";
import { getProjectPath } from "../utils/workspace";

/**
 * Symbol types following LSP SymbolKind specification
 */
export type SymbolKind =
  | "file" | "module" | "namespace" | "package" | "class"
  | "method" | "property" | "field" | "constructor" | "enum"
  | "interface" | "function" | "variable" | "constant" | "string"
  | "number" | "boolean" | "array" | "object" | "key"
  | "null" | "enumMember" | "struct" | "event" | "operator"
  | "typeParameter";

export interface ProjectSymbol {
  name: string;
  kind: SymbolKind;
  containerName?: string;
  filePath: string;
  range: {
    start: Position;
    end: Position;
  };
  detail?: string;
}

interface CachedSymbols {
  symbols: ProjectSymbol[];
  timestamp: number;
  projectPath: string;
}

// Symbol cache with TTL of 30 seconds
const CACHE_TTL_MS = 30000;
let symbolCache: CachedSymbols | null = null;

/**
 * Fuzzy match scoring algorithm
 */
function fuzzyMatch(query: string, text: string): { score: number; matches: number[] } {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  let queryIndex = 0;
  let score = 0;
  const matches: number[] = [];
  let lastMatchIndex = -1;
  let consecutiveBonus = 0;
  
  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      matches.push(i);
      
      // Consecutive matches get increasing bonus
      if (lastMatchIndex === i - 1) {
        consecutiveBonus += 5;
        score += 10 + consecutiveBonus;
      } else {
        consecutiveBonus = 0;
        score += 1;
      }
      
      // Start of word bonus (camelCase, snake_case, PascalCase)
      if (i === 0) {
        score += 15;
      } else {
        const prevChar = text[i - 1];
        if (prevChar === "_" || prevChar === "-" || prevChar === "/" || prevChar === ".") {
          score += 10;
        } else if (prevChar.toLowerCase() === prevChar && text[i].toUpperCase() === text[i]) {
          score += 10; // CamelCase boundary
        }
      }
      
      // Exact case match bonus
      if (query[queryIndex] === text[i]) {
        score += 2;
      }
      
      lastMatchIndex = i;
      queryIndex++;
    }
  }
  
  // All query characters matched?
  if (queryIndex === query.length) {
    // Shorter names get bonus
    score += Math.max(0, 30 - text.length);
    // Early matches get bonus
    score += Math.max(0, 20 - (matches[0] || 0));
    return { score, matches };
  }
  
  return { score: 0, matches: [] };
}

/**
 * Get icon component for symbol kind
 */
function getSymbolIcon(kind: SymbolKind): JSX.Element {
  const iconProps = { class: "w-4 h-4 flex-shrink-0" };
  
  switch (kind) {
    case "file":
      return <Icon name="file" {...iconProps} style={{ color: "var(--text-weak)" }} />;
    case "module":
    case "namespace":
    case "package":
      return <Icon name="box" {...iconProps} style={{ color: "var(--cortex-warning)" }} />;
    case "class":
    case "struct":
      return <Icon name="cube" {...iconProps} style={{ color: "var(--cortex-warning)" }} />;
    case "method":
    case "constructor":
      return <Icon name="code" {...iconProps} style={{ color: "var(--cortex-info)" }} />;
    case "property":
    case "field":
      return <Icon name="key" {...iconProps} style={{ color: "var(--cortex-info)" }} />;
    case "enum":
    case "enumMember":
      return <Icon name="hashtag" {...iconProps} style={{ color: "var(--cortex-error)" }} />;
    case "interface":
      return <Icon name="circle-nodes" {...iconProps} style={{ color: "var(--cortex-success)" }} />;
    case "function":
      return <Icon name="bolt" {...iconProps} style={{ color: "var(--cortex-info)" }} />;
    case "variable":
      return <Icon name="anchor" {...iconProps} style={{ color: "var(--cortex-info)" }} />;
    case "constant":
      return <Icon name="database" {...iconProps} style={{ color: "var(--cortex-info)" }} />;
    case "typeParameter":
      return <Icon name="circle-nodes" {...iconProps} style={{ color: "var(--cortex-info)" }} />;
    default:
      return <Icon name="file" {...iconProps} style={{ color: "var(--text-weak)" }} />;
  }
}

/**
 * Get human-readable label for symbol kind
 */
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

/**
 * Map LSP symbol kind number to our SymbolKind type
 */
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

/**
 * Fetch symbols from the backend
 */
async function fetchProjectSymbols(projectPath: string, query: string): Promise<ProjectSymbol[]> {
  try {
    // Check cache first
    if (
      symbolCache &&
      symbolCache.projectPath === projectPath &&
      Date.now() - symbolCache.timestamp < CACHE_TTL_MS &&
      symbolCache.symbols.length > 0
    ) {
      return symbolCache.symbols;
    }

    // Try to fetch workspace symbols via Tauri invoke
    const lspSymbols = await lspWorkspaceSymbols(projectPath, query);

    if (lspSymbols && lspSymbols.length > 0) {
      const symbols: ProjectSymbol[] = lspSymbols.map((sym) => ({
        name: sym.name,
        kind: mapLspSymbolKind(sym.kind),
        containerName: sym.containerName,
        filePath: sym.location?.uri?.replace("file://", "") || "",
        range: sym.location?.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      }));

      // Cache the results
      symbolCache = {
        symbols,
        timestamp: Date.now(),
        projectPath,
      };

      return symbols;
    }
  } catch (err) {
    console.debug("LSP workspace symbols not available, falling back to tree-sitter parsing");
  }

  // Fallback: Parse files using tree-sitter endpoint or simple regex extraction
  return await extractSymbolsFromProject(projectPath);
}

/**
 * Extract symbols from project files using backend parsing or file analysis
 */
async function extractSymbolsFromProject(projectPath: string): Promise<ProjectSymbol[]> {
  // Check cache
  if (
    symbolCache &&
    symbolCache.projectPath === projectPath &&
    Date.now() - symbolCache.timestamp < CACHE_TTL_MS &&
    symbolCache.symbols.length > 0
  ) {
    return symbolCache.symbols;
  }

  const symbols: ProjectSymbol[] = [];

  try {
    // First get file tree via Tauri
    const treeData = await fsGetFileTree(projectPath, 10);
    const files = collectCodeFiles(treeData.children || [], "");

    // Parse each file for symbols (limit to avoid performance issues)
    const filesToParse = files.slice(0, 200);
    
    await Promise.all(
      filesToParse.map(async (file) => {
        try {
          const fileSymbols = await extractSymbolsFromFile(projectPath, file.path);
          symbols.push(...fileSymbols);
        } catch (e) {
          // Skip files that fail to parse
        }
      })
    );

    // Cache the results
    symbolCache = {
      symbols,
      timestamp: Date.now(),
      projectPath,
    };
  } catch (err) {
    console.error("Failed to extract symbols:", err);
  }

  return symbols;
}

/**
 * Collect code files from tree structure
 */
function collectCodeFiles(
  entries: FileTreeNode[] | undefined,
  parentPath: string
): Array<{ name: string; path: string }> {
  const result: Array<{ name: string; path: string }> = [];
  if (!entries) return result;

  const codeExtensions = new Set([
    "ts", "tsx", "js", "jsx", "mts", "cts",
    "rs", "py", "go", "rb", "java", "kt",
    "c", "cpp", "h", "hpp", "cs", "swift",
  ]);

  for (const entry of entries) {
    const fullPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    
    if (entry.isFile) {
      const ext = entry.name.split(".").pop()?.toLowerCase();
      if (ext && codeExtensions.has(ext)) {
        result.push({ name: entry.name, path: fullPath });
      }
    }
    
    if (entry.isDirectory && entry.children) {
      result.push(...collectCodeFiles(entry.children, fullPath));
    }
  }

  return result;
}

/**
 * Extract symbols from a single file using regex patterns
 */
async function extractSymbolsFromFile(
  projectPath: string,
  relativePath: string
): Promise<ProjectSymbol[]> {
  const symbols: ProjectSymbol[] = [];
  const fullPath = `${projectPath}/${relativePath}`;

  try {
    const content = await fsReadFile(fullPath);
    const lines = content.split("\n");
    const ext = relativePath.split(".").pop()?.toLowerCase();

    // Define patterns for different languages
    const patterns = getLanguagePatterns(ext || "");

    lines.forEach((line, lineIndex) => {
      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match) {
          const name = match[pattern.nameGroup || 1];
          if (name && name.length > 1 && !name.startsWith("_")) {
            symbols.push({
              name,
              kind: pattern.kind,
              filePath: relativePath,
              range: {
                start: { line: lineIndex, character: match.index || 0 },
                end: { line: lineIndex, character: (match.index || 0) + match[0].length },
              },
              containerName: pattern.containerExtractor?.(lines, lineIndex),
            });
          }
        }
      }
    });
  } catch (e) {
    // Skip files that fail to read
  }

  return symbols;
}

interface LanguagePattern {
  regex: RegExp;
  kind: SymbolKind;
  nameGroup?: number;
  containerExtractor?: (lines: string[], lineIndex: number) => string | undefined;
}

/**
 * Get regex patterns for extracting symbols from different languages
 */
function getLanguagePatterns(ext: string): LanguagePattern[] {
  const findContainerClass = (lines: string[], lineIndex: number): string | undefined => {
    for (let i = lineIndex - 1; i >= 0; i--) {
      const match = lines[i].match(/class\s+(\w+)/);
      if (match) return match[1];
    }
    return undefined;
  };

  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "mts":
    case "cts":
      return [
        { regex: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/, kind: "class" },
        { regex: /^(?:export\s+)?interface\s+(\w+)/, kind: "interface" },
        { regex: /^(?:export\s+)?type\s+(\w+)/, kind: "typeParameter" },
        { regex: /^(?:export\s+)?enum\s+(\w+)/, kind: "enum" },
        { regex: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/, kind: "function" },
        { regex: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/, kind: "function" },
        { regex: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?function/, kind: "function" },
        { regex: /^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/, kind: "method", containerExtractor: findContainerClass },
        { regex: /^(?:export\s+)?const\s+(\w+)\s*(?::\s*[\w<>[\]|&\s]+)?\s*=\s*(?!(?:async\s+)?\(|function)/, kind: "constant" },
        { regex: /^(?:export\s+)?let\s+(\w+)/, kind: "variable" },
      ];
    case "rs":
      return [
        { regex: /^(?:pub\s+)?struct\s+(\w+)/, kind: "struct" },
        { regex: /^(?:pub\s+)?enum\s+(\w+)/, kind: "enum" },
        { regex: /^(?:pub\s+)?trait\s+(\w+)/, kind: "interface" },
        { regex: /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/, kind: "function" },
        { regex: /^\s+(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/, kind: "method" },
        { regex: /^(?:pub\s+)?const\s+(\w+)/, kind: "constant" },
        { regex: /^(?:pub\s+)?static\s+(\w+)/, kind: "constant" },
        { regex: /^(?:pub\s+)?mod\s+(\w+)/, kind: "module" },
        { regex: /^(?:pub\s+)?type\s+(\w+)/, kind: "typeParameter" },
      ];
    case "py":
      return [
        { regex: /^class\s+(\w+)/, kind: "class" },
        { regex: /^(?:async\s+)?def\s+(\w+)/, kind: "function" },
        { regex: /^\s+(?:async\s+)?def\s+(\w+)/, kind: "method", containerExtractor: (lines, i) => {
          for (let j = i - 1; j >= 0; j--) {
            const m = lines[j].match(/^class\s+(\w+)/);
            if (m) return m[1];
          }
          return undefined;
        }},
        { regex: /^(\w+)\s*=\s*/, kind: "variable" },
      ];
    case "go":
      return [
        { regex: /^type\s+(\w+)\s+struct/, kind: "struct" },
        { regex: /^type\s+(\w+)\s+interface/, kind: "interface" },
        { regex: /^func\s+(\w+)/, kind: "function" },
        { regex: /^func\s+\([^)]+\)\s+(\w+)/, kind: "method" },
        { regex: /^const\s+(\w+)/, kind: "constant" },
        { regex: /^var\s+(\w+)/, kind: "variable" },
      ];
    default:
      return [
        { regex: /class\s+(\w+)/, kind: "class" },
        { regex: /function\s+(\w+)/, kind: "function" },
        { regex: /def\s+(\w+)/, kind: "function" },
        { regex: /const\s+(\w+)/, kind: "constant" },
      ];
  }
}

/**
 * Invalidate the symbol cache (call when project changes)
 */
export function invalidateSymbolCache(): void {
  symbolCache = null;
}

/**
 * Filter types for symbol filtering
 */
const SYMBOL_TYPE_FILTERS: Array<{ label: string; kinds: SymbolKind[] }> = [
  { label: "All", kinds: [] },
  { label: "Classes", kinds: ["class", "struct"] },
  { label: "Functions", kinds: ["function", "method", "constructor"] },
  { label: "Interfaces", kinds: ["interface"] },
  { label: "Variables", kinds: ["variable", "constant", "field", "property"] },
  { label: "Types", kinds: ["typeParameter", "enum", "enumMember"] },
  { label: "Modules", kinds: ["module", "namespace", "package"] },
];

/**
 * ProjectSymbols component for searching symbols across the project
 */
export function ProjectSymbols() {
  const { showProjectSymbols, setShowProjectSymbols } = useCommands();
  const { openFile } = useEditor();
  
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [symbols, setSymbols] = createSignal<ProjectSymbol[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [activeFilter, setActiveFilter] = createSignal(0);
  const [previewSymbol, setPreviewSymbol] = createSignal<ProjectSymbol | null>(null);
  const [previewContent, setPreviewContent] = createSignal<string[]>([]);
  
  let inputRef: HTMLInputElement | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // Fetch symbols when dialog opens
  createEffect(() => {
    if (showProjectSymbols()) {
      setQuery("");
      setSelectedIndex(0);
      setActiveFilter(0);
      setPreviewSymbol(null);
      setPreviewContent([]);
      setTimeout(() => inputRef?.focus(), 10);
      loadSymbols();
    }
  });

  onCleanup(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  });

  const loadSymbols = async () => {
    setLoading(true);
    try {
      const projectPath = getProjectPath();
      const fetchedSymbols = await fetchProjectSymbols(projectPath, query());
      setSymbols(fetchedSymbols);
    } catch (err) {
      console.error("Failed to load symbols:", err);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      loadSymbols();
    }, 150);
  };

  // Filter and sort symbols based on query and type filter
  const filteredSymbols = () => {
    const q = query().trim();
    const allSymbols = symbols();
    const filter = SYMBOL_TYPE_FILTERS[activeFilter()];
    
    // Apply type filter
    let filtered = filter.kinds.length > 0
      ? allSymbols.filter((s) => filter.kinds.includes(s.kind))
      : allSymbols;

    if (!q) {
      // Without query, sort alphabetically and limit
      return filtered
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 100);
    }

    // Apply fuzzy matching
    const scored = filtered
      .map((symbol) => ({
        symbol,
        ...fuzzyMatch(q, symbol.name),
        pathMatch: fuzzyMatch(q, symbol.filePath),
      }))
      .filter((item) => item.score > 0 || item.pathMatch.score > 0)
      .map((item) => ({
        ...item,
        totalScore: item.score * 2 + item.pathMatch.score,
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 100);

    return scored.map((item) => ({
      ...item.symbol,
      matches: item.matches,
    }));
  };

  // Reset selection when query or filter changes
  createEffect(() => {
    query();
    activeFilter();
    setSelectedIndex(0);
  });

  // Update preview when selection changes
  createEffect(() => {
    const filtered = filteredSymbols();
    const selected = filtered[selectedIndex()];
    if (selected && selected !== previewSymbol()) {
      setPreviewSymbol(selected);
      loadPreview(selected);
    }
  });

  const loadPreview = async (symbol: ProjectSymbol) => {
    try {
      const projectPath = getProjectPath();
      const fullPath = `${projectPath}/${symbol.filePath}`;
      
      const content = await fsReadFile(fullPath);
      const lines = content.split("\n");
      
      // Get lines around the symbol (5 before, 10 after)
      const startLine = Math.max(0, symbol.range.start.line - 5);
      const endLine = Math.min(lines.length, symbol.range.start.line + 10);
      
      setPreviewContent(lines.slice(startLine, endLine).map((line, i) => ({
        lineNumber: startLine + i + 1,
        content: line,
        isSymbolLine: startLine + i === symbol.range.start.line,
      })) as unknown as string[]);
    } catch (e) {
      setPreviewContent([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const filtered = filteredSymbols();

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      scrollSelectedIntoView();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      scrollSelectedIntoView();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const symbol = filtered[selectedIndex()];
      if (symbol) {
        handleSelect(symbol);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      // Cycle through filters
      setActiveFilter((i) => (i + 1) % SYMBOL_TYPE_FILTERS.length);
    }
  };

  const scrollSelectedIntoView = () => {
    setTimeout(() => {
      const selected = document.querySelector("[data-selected='true']");
      selected?.scrollIntoView({ block: "nearest" });
    }, 0);
  };

  const handleSelect = async (symbol: ProjectSymbol) => {
    setShowProjectSymbols(false);
    const projectPath = getProjectPath();
    const fullPath = `${projectPath}/${symbol.filePath}`;
    
    // Open file and navigate to line
    await openFile(fullPath);
    
    // Dispatch event to navigate to the symbol location
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("editor:goto-line", {
          detail: {
            line: symbol.range.start.line + 1,
            column: symbol.range.start.character + 1,
          },
        })
      );
    }, 100);
  };

  const highlightMatches = (text: string, matches?: number[]) => {
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
        <span style={{ color: "var(--accent-primary)", "font-weight": "600" }}>
          {text[matchIndex]}
        </span>
      );
      lastIndex = matchIndex + 1;
    }

    if (lastIndex < text.length) {
      result.push(<span>{text.slice(lastIndex)}</span>);
    }

    return <>{result}</>;
  };

  return (
    <Show when={showProjectSymbols()}>
      <div
        style={{
          position: "fixed",
          inset: "0",
          "z-index": "100",
          display: "flex",
          "align-items": "flex-start",
          "justify-content": "center",
          "padding-top": "10vh",
        }}
        onClick={() => setShowProjectSymbols(false)}
      >
        {/* Backdrop */}
        <div style={{ position: "absolute", inset: "0", background: "rgba(0, 0, 0, 0.5)" }} />

        {/* Modal */}
        <div
          style={{ 
            position: "relative",
            width: "800px",
            "max-height": "600px",
            "border-radius": "var(--cortex-radius-md)",
            "box-shadow": "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            overflow: "hidden",
            display: "flex",
            background: "var(--surface-raised)" 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left panel - Search and results */}
          <div style={{ flex: "1", display: "flex", "flex-direction": "column", "min-width": "0", "max-width": "55%" }}>
            {/* Search input */}
            <div
              style={{ 
                display: "flex",
                "align-items": "center",
                gap: "12px",
                padding: "12px 16px",
                "border-bottom": "1px solid var(--border-weak)" 
              }}
            >
              <Icon name="magnifying-glass" style={{ width: "20px", height: "20px", "flex-shrink": "0", color: "var(--text-weak)" }} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search project symbols..."
                style={{ 
                  flex: "1", 
                  background: "transparent", 
                  outline: "none", 
                  border: "none",
                  "font-size": "14px",
                  color: "var(--text-base)" 
                }}
                value={query()}
                onInput={(e) => handleQueryChange(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
              />
              <kbd
                style={{
                  "font-size": "12px",
                  padding: "2px 6px",
                  "border-radius": "var(--cortex-radius-sm)",
                  background: "var(--background-base)",
                  color: "var(--text-weak)",
                }}
              >
                esc
              </kbd>
            </div>

            {/* Type filters */}
            <div
              style={{ 
                display: "flex",
                gap: "4px",
                padding: "8px 12px",
                "border-bottom": "1px solid var(--border-weak)",
                "overflow-x": "auto" 
              }}
            >
              <For each={SYMBOL_TYPE_FILTERS}>
                {(filter, index) => (
                  <button
                    style={{
                      padding: "4px 8px",
                      "font-size": "12px",
                      "border-radius": "var(--cortex-radius-md)",
                      "white-space": "nowrap",
                      transition: "all 0.15s ease",
                      border: "none",
                      cursor: "pointer",
                      background: index() === activeFilter() 
                        ? "var(--accent-primary)" 
                        : "var(--surface-base)",
                      color: index() === activeFilter() 
                        ? "white" 
                        : "var(--text-weak)",
                    }}
                    onClick={() => setActiveFilter(index())}
                  >
                    {filter.label}
                  </button>
                )}
              </For>
              <span
                style={{ 
                  "margin-left": "auto",
                  "font-size": "12px",
                  padding: "4px 8px",
                  color: "var(--text-weak)" 
                }}
              >
                Tab to filter
              </span>
            </div>

            {/* Results */}
            <div style={{ flex: "1", "overflow-y": "auto" }}>
              <Show when={loading()}>
                <div style={{ padding: "32px 16px", "text-align": "center" }}>
                  <p style={{ "font-size": "14px", color: "var(--text-weak)" }}>
                    Loading symbols...
                  </p>
                </div>
              </Show>

              <Show when={!loading() && filteredSymbols().length === 0}>
                <div style={{ padding: "32px 16px", "text-align": "center" }}>
                  <p style={{ "font-size": "14px", color: "var(--text-weak)" }}>
                    {query() ? "No symbols found" : "No symbols in project"}
                  </p>
                </div>
              </Show>

              <For each={filteredSymbols()}>
                {(symbol, index) => (
                  <button
                    style={{
                      width: "100%",
                      display: "flex",
                      "align-items": "center",
                      gap: "12px",
                      padding: "8px 16px",
                      "text-align": "left",
                      transition: "background 0.15s ease",
                      border: "none",
                      cursor: "pointer",
                      background: index() === selectedIndex()
                        ? "var(--surface-active)"
                        : "transparent",
                      color: "var(--text-base)",
                    }}
                    data-selected={index() === selectedIndex()}
                    onMouseEnter={() => setSelectedIndex(index())}
                    onClick={() => handleSelect(symbol)}
                  >
                    {getSymbolIcon(symbol.kind)}
                    <div style={{ flex: "1", "min-width": "0" }}>
                      <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                        <span style={{ "font-size": "14px", "font-weight": "500", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                          {highlightMatches(symbol.name, (symbol as ProjectSymbol & { matches?: number[] }).matches)}
                        </span>
                        <Show when={symbol.containerName}>
                          <span
                            style={{ 
                              "font-size": "12px",
                              overflow: "hidden",
                              "text-overflow": "ellipsis",
                              "white-space": "nowrap",
                              color: "var(--text-weak)" 
                            }}
                          >
                            in {symbol.containerName}
                          </span>
                        </Show>
                      </div>
                      <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                        <span
                          style={{ "font-size": "12px", color: "var(--text-weak)" }}
                        >
                          {symbol.filePath}:{symbol.range.start.line + 1}
                        </span>
                      </div>
                    </div>
                    <span
                      style={{
                        "font-size": "12px",
                        padding: "2px 6px",
                        "border-radius": "var(--cortex-radius-sm)",
                        "flex-shrink": "0",
                        background: "var(--surface-base)",
                        color: "var(--text-weak)",
                      }}
                    >
                      {getSymbolKindLabel(symbol.kind)}
                    </span>
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Right panel - Preview */}
          <div
            style={{
              flex: "1",
              display: "flex",
              "flex-direction": "column",
              "border-left": "1px solid var(--border-weak)",
              overflow: "hidden",
              background: "var(--background-base)",
              "max-width": "45%",
            }}
          >
            <div
              style={{ 
                padding: "8px 12px",
                "border-bottom": "1px solid var(--border-weak)",
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between" 
              }}
            >
              <span style={{ "font-size": "12px", "font-weight": "500", color: "var(--text-weak)" }}>
                Preview
              </span>
              <Show when={previewSymbol()}>
                <span style={{ "font-size": "12px", color: "var(--text-weak)" }}>
                  Line {(previewSymbol()?.range.start.line || 0) + 1}
                </span>
              </Show>
            </div>
            <div style={{ flex: "1", overflow: "auto", padding: "8px" }}>
              <Show when={previewContent().length > 0}>
                <pre
                  style={{ 
                    "font-size": "12px",
                    "font-family": "'JetBrains Mono', monospace",
                    "line-height": "1.5",
                    margin: "0",
                    color: "var(--text-base)" 
                  }}
                >
                  <For each={previewContent() as unknown as Array<{ lineNumber: number; content: string; isSymbolLine: boolean }>}>
                    {(line) => (
                      <div
                        style={{
                          padding: "2px 8px",
                          background: line.isSymbolLine
                            ? "var(--accent-primary-muted, rgba(59, 130, 246, 0.15))"
                            : "transparent",
                          "border-left": line.isSymbolLine
                            ? "2px solid var(--accent-primary)"
                            : "2px solid transparent",
                        }}
                      >
                        <span
                          style={{ 
                            display: "inline-block",
                            width: "32px",
                            "text-align": "right",
                            "margin-right": "12px",
                            "user-select": "none",
                            color: "var(--text-weak)" 
                          }}
                        >
                          {line.lineNumber}
                        </span>
                        <span>{line.content}</span>
                      </div>
                    )}
                  </For>
                </pre>
              </Show>
              <Show when={previewContent().length === 0 && previewSymbol()}>
                <div style={{ display: "flex", "align-items": "center", "justify-content": "center", height: "100%" }}>
                  <p style={{ "font-size": "14px", color: "var(--text-weak)" }}>
                    Loading preview...
                  </p>
                </div>
              </Show>
              <Show when={!previewSymbol()}>
                <div style={{ display: "flex", "align-items": "center", "justify-content": "center", height: "100%" }}>
                  <p style={{ "font-size": "14px", color: "var(--text-weak)" }}>
                    Select a symbol to preview
                  </p>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

