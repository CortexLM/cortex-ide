import { createSignal, createEffect, For, Show, onMount, onCleanup, JSX, createMemo } from "solid-js";
import { useCommands } from "@/context/CommandContext";
import { useEditor } from "@/context/EditorContext";
import { Icon } from "./ui/Icon";
import "@/styles/quickinput.css";
import { fsGetFileTree, lspDocumentSymbols, type LspSymbol } from "../utils/tauri-api";
import { getProjectPath } from "../utils/workspace";

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  score?: number;
  matches?: number[];
}

// Symbol kind type matching LSP specification
type SymbolKind =
  | "file" | "module" | "namespace" | "package" | "class"
  | "method" | "property" | "field" | "constructor" | "enum"
  | "interface" | "function" | "variable" | "constant" | "string"
  | "number" | "boolean" | "array" | "object" | "key"
  | "null" | "enumMember" | "struct" | "event" | "operator"
  | "typeParameter";

// Symbol entry for display
interface SymbolEntry {
  name: string;
  kind: SymbolKind;
  line: number;
  character: number;
  containerName?: string;
  score?: number;
  matches?: number[];
}

// Symbol icons by kind with colors
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

// Parsed query with optional line and column for :line:column navigation
interface ParsedQuery {
  filename: string;
  line?: number;
  column?: number;
}

/**
 * Parse query for line/column navigation
 * Supports:
 * - ":10" - Go to line 10 in current file
 * - ":10:5" - Go to line 10, column 5 in current file
 * - "file.ts:10" - Open file and go to line 10
 * - "file.ts:10:5" - Open file and go to line 10, column 5
 */
function parseQuery(query: string): ParsedQuery {
  // Pattern: optional filename, then :line, then optional :column
  const match = query.match(/^(.+?)?:(\d+)(?::(\d+))?$/);
  if (match) {
    return {
      filename: match[1]?.trim() || '',
      line: parseInt(match[2], 10),
      column: match[3] ? parseInt(match[3], 10) : undefined,
    };
  }
  return { filename: query };
}

// Recent files storage - persisted in localStorage
const RECENT_FILES_KEY = "cortex_recent_files";
const MAX_RECENT_FILES = 50;

function getRecentFiles(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_FILES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentFile(path: string) {
  const recent = getRecentFiles().filter(p => p !== path);
  recent.unshift(path);
  if (recent.length > MAX_RECENT_FILES) {
    recent.length = MAX_RECENT_FILES;
  }
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recent));
}

// Advanced fuzzy matching algorithm inspired by Zed's implementation
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
      
      // Word boundary bonus (after /, -, _, ., space)
      if (ti === 0) {
        charScore += 10; // Start of string
      } else {
        const prevChar = text[ti - 1];
        if (prevChar === "/" || prevChar === "\\") {
          charScore += 15; // Path separator - highest priority
        } else if (prevChar === "-" || prevChar === "_" || prevChar === "." || prevChar === " ") {
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
  
  // Length penalty - shorter paths are better
  score = score * (1 + 10 / (text.length + 10));
  
  // Filename match bonus
  const lastSlash = text.lastIndexOf("/");
  const filename = lastSlash >= 0 ? text.slice(lastSlash + 1) : text;
  const filenameLower = filename.toLowerCase();
  
  if (filenameLower.startsWith(queryLower)) {
    score += 50; // Filename starts with query
  } else if (filenameLower.includes(queryLower)) {
    score += 25; // Filename contains query
  }
  
  // Extension match for common patterns
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const queryExt = query.split(".").pop()?.toLowerCase() || "";
  if (queryExt.length > 0 && ext === queryExt) {
    score += 10;
  }
  
  return { score, matches };
}

// Highlight matched characters in text with VS Code styling (bold + theme color)
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
      // Add highlighted character - VS Code: bold with theme highlight color
      result.push(
        <span style={{
          color: "var(--jb-border-focus)",
          "font-weight": "600",
        }}>{text[i]}</span>
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

// File type icons with better coverage
const FILE_ICONS: Record<string, string> = {
  ts: "🔷",
  tsx: "⚛️",
  js: "🟨",
  jsx: "⚛️",
  mjs: "🟨",
  cjs: "🟨",
  rs: "🦀",
  py: "🐍",
  pyi: "🐍",
  go: "🐹",
  rb: "💎",
  php: "🐘",
  java: "☕",
  kt: "🅺",
  scala: "🔴",
  swift: "🍎",
  c: "🔵",
  cpp: "🔵",
  cc: "🔵",
  h: "📎",
  hpp: "📎",
  cs: "🟣",
  json: "📋",
  jsonc: "📋",
  json5: "📋",
  md: "📝",
  mdx: "📝",
  markdown: "📝",
  txt: "📄",
  css: "🎨",
  scss: "🎨",
  sass: "🎨",
  less: "🎨",
  html: "🌐",
  htm: "🌐",
  xml: "📰",
  toml: "⚙️",
  yaml: "⚙️",
  yml: "⚙️",
  ini: "⚙️",
  conf: "⚙️",
  config: "⚙️",
  lock: "🔒",
  svg: "🖼️",
  png: "🖼️",
  jpg: "🖼️",
  jpeg: "🖼️",
  gif: "🖼️",
  ico: "🖼️",
  webp: "🖼️",
  sql: "🗃️",
  sh: "💻",
  bash: "💻",
  zsh: "💻",
  fish: "💻",
  ps1: "💻",
  bat: "💻",
  cmd: "💻",
  dockerfile: "🐳",
  gitignore: "📁",
  gitattributes: "📁",
  env: "🔐",
  vue: "💚",
  svelte: "🔶",
  astro: "🚀",
};

function getFileIcon(name: string): string {
  const lowerName = name.toLowerCase();
  
  // Check for exact filename matches first
  if (lowerName === "dockerfile" || lowerName.startsWith("dockerfile.")) return "🐳";
  if (lowerName === "makefile" || lowerName === "gnumakefile") return "⚙️";
  if (lowerName === ".gitignore" || lowerName === ".dockerignore") return "📁";
  if (lowerName === ".env" || lowerName.startsWith(".env.")) return "🔐";
  if (lowerName === "package.json") return "📦";
  if (lowerName === "tsconfig.json") return "🔷";
  if (lowerName === "cargo.toml") return "🦀";
  if (lowerName === "go.mod" || lowerName === "go.sum") return "🐹";
  if (lowerName === "requirements.txt" || lowerName === "setup.py") return "🐍";
  if (lowerName === "gemfile") return "💎";
  if (lowerName === "readme.md" || lowerName === "readme") return "📖";
  if (lowerName === "license" || lowerName === "license.md") return "📜";
  
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return FILE_ICONS[ext] || "📄";
}

export function FileFinder() {
  const { showFileFinder, setShowFileFinder } = useCommands();
  const { openFile, state: editorState } = useEditor();
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [allFiles, setAllFiles] = createSignal<FileEntry[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(false);
  const [showRecent, setShowRecent] = createSignal(true);
  const [recentFiles, setRecentFiles] = createSignal<string[]>([]);
  
  // Symbol mode state
  const [symbols, setSymbols] = createSignal<SymbolEntry[]>([]);
  const [isLoadingSymbols, setIsLoadingSymbols] = createSignal(false);
  
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  // Parse query for line/column navigation
  const parsedQuery = createMemo(() => parseQuery(query().trim()));
  
  // Check if we're in "go to line" mode (query starts with : and has no filename)
  const isGoToLineMode = createMemo(() => {
    const parsed = parsedQuery();
    return query().startsWith(':') && parsed.line !== undefined && !parsed.filename;
  });
  
  // Check if we're in symbol mode (query starts with @)
  const isSymbolMode = createMemo(() => query().startsWith('@'));
  
  // Get the symbol search query (without @ prefix)
  const symbolQuery = createMemo(() => {
    if (isSymbolMode()) {
      return query().slice(1).trim();
    }
    return '';
  });
  
  // Get search query for file matching (without line/column suffix)
  const searchQuery = createMemo(() => parsedQuery().filename);
  
  // Get current file path for symbol search
  const currentFilePath = createMemo(() => {
    if (!editorState.activeFileId) return null;
    const activeFile = editorState.openFiles.find(f => f.id === editorState.activeFileId);
    return activeFile?.path || null;
  });

  // Load recent files
  onMount(() => {
    setRecentFiles(getRecentFiles());
  });
  
  // Fetch symbols when entering symbol mode (query starts with @)
  createEffect(() => {
    const q = query();
    if (q.startsWith('@')) {
      fetchSymbols();
    }
  });
  
  // Fetch document symbols for current file
  const fetchSymbols = async () => {
    const filePath = currentFilePath();
    if (!filePath) {
      setSymbols([]);
      return;
    }
    
    setIsLoadingSymbols(true);
    try {
      const lspSymbols = await lspDocumentSymbols(filePath);
      
      const mappedSymbols: SymbolEntry[] = (lspSymbols || []).map((sym: LspSymbol) => ({
        name: sym.name,
        kind: mapLspSymbolKind(sym.kind),
        line: sym.location?.range?.start?.line ?? 0,
        character: sym.location?.range?.start?.character ?? 0,
        containerName: sym.containerName,
      }));
      
      setSymbols(mappedSymbols);
    } catch (err) {
      console.error("Failed to fetch document symbols:", err);
      setSymbols([]);
    } finally {
      setIsLoadingSymbols(false);
    }
  };

  // Fetch all files when opened
  createEffect(() => {
    if (showFileFinder()) {
      setIsVisible(true);
      setQuery("");
      setSelectedIndex(0);
      setShowRecent(true);
      setRecentFiles(getRecentFiles());
      setSymbols([]);
      setTimeout(() => inputRef?.focus(), 10);
      fetchFiles();
    } else {
      setIsVisible(false);
    }
  });

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const projectPath = getProjectPath();
      if (!projectPath) {
        setAllFiles([]);
        setIsLoading(false);
        return;
      }
      
      const tree = await fsGetFileTree(projectPath, 15);
      const files = flattenFiles(tree.children || [], "");
      setAllFiles(files);
    } catch (err) {
      console.error("Failed to fetch files:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const flattenFiles = (entries: unknown[], parentPath: string): FileEntry[] => {
    const result: FileEntry[] = [];
    const entriesArray = entries as Array<{ name: string; isDirectory?: boolean; children?: unknown[] }>;
    
    for (const entry of entriesArray) {
      const fullPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      
      // Skip common non-code directories
      const lowerName = entry.name.toLowerCase();
      
      // Determine if it's a directory - check both isDirectory flag and presence of children
      const isDir = entry.isDirectory === true || (entry.children && entry.children.length > 0);
      
      if (isDir && (
        lowerName === "node_modules" ||
        lowerName === ".git" ||
        lowerName === "dist" ||
        lowerName === "build" ||
        lowerName === "__pycache__" ||
        lowerName === ".next" ||
        lowerName === ".nuxt" ||
        lowerName === "target" ||
        lowerName === "vendor" ||
        lowerName === ".venv" ||
        lowerName === "venv"
      )) {
        continue;
      }
      
      // Only add files (not directories) to the list
      // A file has no children and isDirectory is false/undefined
      if (!isDir && !entry.children) {
        result.push({
          name: entry.name,
          path: fullPath,
          isDirectory: false,
        });
      }
      
      // Recurse into children
      if (entry.children) {
        result.push(...flattenFiles(entry.children, fullPath));
      }
    }
    return result;
  };

  // Filtered and scored files
  const filteredFiles = createMemo(() => {
    const q = searchQuery(); // Use parsed filename without line/column
    const files = allFiles();
    const recent = recentFiles();
    const projectPath = getProjectPath();
    
    if (!q) {
      // Show recent files when no query
      if (showRecent() && recent.length > 0) {
        const recentEntries: FileEntry[] = [];
        for (const recentPath of recent.slice(0, 15)) {
          // Convert absolute path to relative for matching
          let relativePath = recentPath;
          if (projectPath && recentPath.startsWith(projectPath)) {
            relativePath = recentPath.slice(projectPath.length + 1);
          }
          
          const file = files.find(f => f.path === relativePath);
          if (file) {
            recentEntries.push({ ...file, score: 1000 - recentEntries.length }); // Higher score for more recent
          }
        }
        return recentEntries;
      }
      return files.slice(0, 100);
    }
    
    // Score all files
    const scored = files
      .map((file) => {
        const result = fuzzyMatch(q, file.path);
        return {
          ...file,
          score: result.score,
          matches: result.matches,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        // Boost recently opened files
        const aRecent = recent.indexOf(projectPath ? `${projectPath}/${a.path}` : a.path);
        const bRecent = recent.indexOf(projectPath ? `${projectPath}/${b.path}` : b.path);
        
        const aBoost = aRecent >= 0 ? 100 - aRecent : 0;
        const bBoost = bRecent >= 0 ? 100 - bRecent : 0;
        
        return (b.score + bBoost) - (a.score + aBoost);
      })
      .slice(0, 100);
    
    return scored;
  });
  
  // Filtered and scored symbols
  const filteredSymbols = createMemo(() => {
    const q = symbolQuery();
    const allSymbols = symbols();
    
    if (!q) {
      // Without query, sort by line number
      return allSymbols
        .sort((a, b) => a.line - b.line)
        .slice(0, 100);
    }
    
    // Score all symbols by name
    const scored = allSymbols
      .map((symbol) => {
        const result = fuzzyMatch(q, symbol.name);
        return {
          ...symbol,
          score: result.score,
          matches: result.matches,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);
    
    return scored;
  });
  
  // Get the current list items based on mode
  const currentItems = createMemo(() => {
    if (isSymbolMode()) {
      return filteredSymbols();
    }
    return filteredFiles();
  });

  // Reset selection when query changes
  createEffect(() => {
    query();
    setSelectedIndex(0);
    setShowRecent(!query().trim());
  });

  // Scroll selected item into view
  createEffect(() => {
    const index = selectedIndex();
    if (listRef) {
      const items = listRef.querySelectorAll("[data-file-item], [data-symbol-item]");
      const selectedItem = items[index] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  });

  // Global keyboard handler
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (!showFileFinder()) return;
    
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setShowFileFinder(false);
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
    const items = currentItems();
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Check if in go-to-line mode (just :line without filename)
      if (isGoToLineMode()) {
        handleGoToLine();
        return;
      }
      // Check if in symbol mode
      if (isSymbolMode()) {
        const symbol = filteredSymbols()[selectedIndex()];
        if (symbol) {
          handleSymbolSelect(symbol);
        }
        return;
      }
      const file = filteredFiles()[selectedIndex()];
      if (file) {
        handleSelect(file.path);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else {
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
      }
    }
  };

  const handleSelect = async (path: string) => {
    setShowFileFinder(false);
    const projectPath = getProjectPath();
    const fullPath = projectPath ? `${projectPath}/${path}` : path;
    const parsed = parsedQuery();
    
    // Add to recent files
    addRecentFile(fullPath);
    
    await openFile(fullPath);
    
    // Navigate to line/column if specified
    if (parsed.line) {
      // Small delay to ensure file is loaded and editor is ready
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("editor:goto-line", {
          detail: { line: parsed.line, column: parsed.column || 1 }
        }));
      }, 50);
    }
  };
  
  // Handle symbol selection - navigate to symbol location
  const handleSymbolSelect = (symbol: SymbolEntry) => {
    setShowFileFinder(false);
    
    // Navigate to the symbol location in the current file
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("editor:goto-line", {
          detail: {
            line: symbol.line + 1, // LSP uses 0-based line numbers
            column: symbol.character + 1,
          },
        })
      );
    }, 50);
  };
  
  // Handle go-to-line mode (just :line or :line:column, no filename)
  const handleGoToLine = () => {
    const parsed = parsedQuery();
    // Only proceed if there's a line to go to and an active file
    if (parsed.line && editorState.activeFileId) {
      setShowFileFinder(false);
      window.dispatchEvent(new CustomEvent("editor:goto-line", {
        detail: { line: parsed.line, column: parsed.column || 1 }
      }));
    }
  };

  const getFileDirectory = (path: string) => {
    const lastSlash = path.lastIndexOf("/");
    return lastSlash > 0 ? path.slice(0, lastSlash) : "";
  };
  
  // Get icon config for a symbol kind
  const getIconConfig = (kind: SymbolKind): { icon: string; color: string } => {
    return symbolIcons[kind] || symbolIcons.variable;
  };

  return (
    <Show when={showFileFinder()}>
      {/* Overlay backdrop - Design spec: bg rgba(0,0,0,0.5) */}
      <div 
        onClick={() => setShowFileFinder(false)}
        style={{
          position: "fixed",
          inset: "0",
          "z-index": "2549",
          background: "rgba(0, 0, 0, 0.5)",
          animation: isVisible() ? "file-finder-fade-in 150ms ease-out forwards" : "none",
        }}
      />
      
      {/* Modal container - Design specs: 600px max, panel-header bg, radius-lg, shadow */}
      <div 
        style={{
          position: "fixed",
          top: "12vh",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          "max-width": "calc(100vw - 32px)",
          "z-index": "2550",
          background: "var(--ui-panel-bg)",
          "border-radius": "var(--cortex-radius-md)",
          "box-shadow": "0 8px 32px rgba(0, 0, 0, 0.5)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          overflow: "hidden",
          "-webkit-app-region": "no-drag",
          animation: isVisible() ? "file-finder-scale-in 150ms ease-out forwards" : "none",
        }}
        role="dialog"
        aria-label="File Finder"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input container - Design specs: height 48px, input-bg, no border, 16px font */}
        <div 
          style={{
            display: "flex",
            "align-items": "center",
            gap: "12px",
            height: "48px",
            padding: "0 16px",
            background: "var(--jb-canvas)",
            "border-bottom": "1px solid var(--jb-border-default)",
          }}
        >
          <Icon name="magnifying-glass" style={{ 
            width: "18px", 
            height: "18px", 
            color: "var(--jb-text-muted-color)", 
            "flex-shrink": "0" 
          }} />
          <input
            ref={inputRef}
            type="text"
            placeholder={isSymbolMode() ? "Search symbols in current file..." : "Search files by name (@ for symbols)..."}
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={handleInputKeyDown}
            role="textbox"
            aria-haspopup="menu"
            aria-autocomplete="list"
            aria-controls="file-finder-list"
            style={{
              flex: "1",
              height: "100%",
              background: "transparent",
              border: "none",
              "font-size": "16px",
              color: "var(--jb-text-body-color)",
              outline: "none",
            }}
          />
          <Show when={isLoading() || isLoadingSymbols()}>
            <div 
              style={{ 
                width: "16px", 
                height: "16px", 
                border: "2px solid var(--jb-text-muted-color)",
                "border-top-color": "transparent",
                "border-radius": "var(--cortex-radius-full)",
                animation: "spin 1s linear infinite",
                "flex-shrink": "0",
              }} 
            />
          </Show>
        </div>

        {/* Progress bar indicator */}
        <Show when={isLoading() || isLoadingSymbols()}>
          <div style={{
            height: "2px",
            background: "var(--jb-border-focus)",
            animation: "file-finder-progress 2s ease-in-out infinite",
          }} />
        </Show>

        {/* Go to line mode hint */}
        <Show when={isGoToLineMode()}>
          <div 
            style={{ 
              display: "flex",
              "align-items": "center",
              gap: "8px",
              padding: "10px 16px",
              "border-bottom": "1px solid var(--jb-border-default)",
              background: "var(--jb-canvas)",
            }}
          >
            <span style={{ 
              color: "var(--jb-border-focus)", 
              "font-size": "14px",
              "font-weight": "500",
            }}>
              Go to line {parsedQuery().line}
              {parsedQuery().column && <span>, column {parsedQuery().column}</span>}
            </span>
            <Show when={editorState.activeFileId}>
              <span style={{ 
                color: "var(--jb-text-muted-color)", 
                "font-size": "12px",
              }}>
                in current file
              </span>
            </Show>
            <Show when={!editorState.activeFileId}>
              <span style={{ 
                color: "var(--cortex-warning)", 
                "font-size": "12px",
              }}>
                (no file open)
              </span>
            </Show>
          </div>
        </Show>
        
        {/* Symbol mode header */}
        <Show when={isSymbolMode()}>
          <div 
            style={{ 
              display: "flex",
              "align-items": "center",
              gap: "8px",
              padding: "8px 16px",
              "border-bottom": "1px solid var(--jb-border-default)",
              background: "var(--jb-canvas)",
            }}
          >
            <span style={{ 
              color: "var(--jb-border-focus)", 
              "font-size": "12px",
              "font-weight": "500",
            }}>
              @ Symbols in current file
            </span>
            <Show when={currentFilePath()}>
              <span style={{ 
                color: "var(--jb-text-muted-color)", 
                "font-size": "12px",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
              }}>
                {currentFilePath()?.split('/').pop() || currentFilePath()?.split('\\').pop()}
              </span>
            </Show>
            <Show when={!currentFilePath()}>
              <span style={{ 
                color: "var(--cortex-warning)", 
                "font-size": "12px",
              }}>
                (no file open)
              </span>
            </Show>
          </div>
        </Show>

        {/* Section header for recent files */}
        <Show when={!isSymbolMode() && showRecent() && !query().trim() && filteredFiles().length > 0}>
          <div 
            style={{ 
              display: "flex",
              "align-items": "center",
              gap: "8px",
              padding: "8px 16px",
              "border-bottom": "1px solid var(--jb-border-default)",
              background: "var(--jb-canvas)",
            }}
          >
            <Icon name="clock" style={{ width: "14px", height: "14px", color: "var(--jb-text-muted-color)" }} />
            <span style={{ 
              "font-size": "12px", 
              "font-weight": "500",
              color: "var(--jb-text-muted-color)",
              "text-transform": "uppercase",
              "letter-spacing": "0.05em",
            }}>
              Recent Files
            </span>
          </div>
        </Show>

        {/* Results list - Design specs: max-height 400px */}
        <div 
          id="file-finder-list"
          role="listbox"
          style={{
            "max-height": "400px",
            overflow: "auto",
            "overscroll-behavior": "contain",
          }}
        >
          <div ref={listRef}>
            {/* Empty state for files */}
            <Show when={!isSymbolMode() && filteredFiles().length === 0 && !isGoToLineMode()}>
              <div style={{ 
                padding: "24px 16px", 
                "text-align": "center" 
              }}>
                <p style={{ 
                  "font-size": "14px", 
                  color: "var(--jb-text-muted-color)",
                  margin: "0",
                }}>
                  {isLoading() 
                    ? "Loading files..." 
                    : searchQuery() 
                      ? "No files found" 
                      : "No files in project"}
                </p>
              </div>
            </Show>
            
            {/* Empty state for symbols */}
            <Show when={isSymbolMode() && filteredSymbols().length === 0}>
              <div style={{ 
                padding: "24px 16px", 
                "text-align": "center" 
              }}>
                <p style={{ 
                  "font-size": "14px", 
                  color: "var(--jb-text-muted-color)",
                  margin: "0",
                }}>
                  {isLoadingSymbols()
                    ? "Loading symbols..."
                    : !currentFilePath()
                      ? "No file open"
                      : symbolQuery()
                        ? "No symbols found"
                        : "No symbols in current file"}
                </p>
              </div>
            </Show>

            {/* File results - Design specs: Item padding 10px 16px, hover/selected states */}
            <Show when={!isSymbolMode()}>
              <For each={filteredFiles()}>
                {(file, index) => (
                  <div
                    data-file-item
                    role="option"
                    aria-selected={index() === selectedIndex()}
                    onMouseEnter={() => setSelectedIndex(index())}
                    onClick={() => handleSelect(file.path)}
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "12px",
                      padding: "10px 16px",
                      cursor: "pointer",
                      transition: "background-color 0.1s ease",
                      background: index() === selectedIndex() 
                        ? "rgba(59, 130, 246, 0.2)" 
                        : "transparent",
                      "border-left": index() === selectedIndex() 
                        ? "2px solid var(--jb-border-focus)" 
                        : "2px solid transparent",
                    }}
                  >
                    {/* File icon */}
                    <span style={{ 
                      "font-size": "16px", 
                      "line-height": "1",
                      "flex-shrink": "0",
                    }}>
                      {getFileIcon(file.name)}
                    </span>
                    
                    {/* File info - Design specs: name 14px text-primary, path 12px text-secondary */}
                    <div style={{ 
                      flex: "1", 
                      "min-width": "0",
                      display: "flex",
                      "flex-direction": "column",
                      gap: "2px",
                    }}>
                      {/* Filename - prominent per typography hierarchy */}
                      <span 
                        style={{ 
                          "font-size": "14px",
                          color: "var(--jb-text-body-color)",
                          overflow: "hidden",
                          "text-overflow": "ellipsis",
                          "white-space": "nowrap",
                        }}
                      >
                        {highlightMatches(file.name, file.matches?.filter(m => {
                          const nameStart = file.path.lastIndexOf("/") + 1;
                          return m >= nameStart;
                        }).map(m => m - (file.path.lastIndexOf("/") + 1)))}
                      </span>
                      {/* Directory path */}
                      <Show when={getFileDirectory(file.path)}>
                        <span 
                          style={{ 
                            display: "flex",
                            "align-items": "center",
                            gap: "4px",
                            "font-size": "12px",
                            color: "var(--jb-text-muted-color)",
                            overflow: "hidden",
                            "text-overflow": "ellipsis",
                            "white-space": "nowrap",
                          }}
                        >
                          <Icon name="folder" style={{ 
                            width: "12px", 
                            height: "12px", 
                            "flex-shrink": "0",
                            opacity: "0.7",
                          }} />
                          <span style={{ 
                            overflow: "hidden", 
                            "text-overflow": "ellipsis", 
                            "white-space": "nowrap" 
                          }}>
                            {highlightMatches(getFileDirectory(file.path), file.matches?.filter(m => {
                              const nameStart = file.path.lastIndexOf("/") + 1;
                              return m < nameStart;
                            }))}
                          </span>
                        </span>
                      </Show>
                    </div>
                    
                    {/* Recent indicator */}
                    <Show when={showRecent() && !query().trim()}>
                      <Icon name="clock" style={{ 
                        width: "14px", 
                        height: "14px", 
                        "flex-shrink": "0", 
                        color: "var(--jb-text-muted-color)" 
                      }} />
                    </Show>
                  </div>
                )}
              </For>
            </Show>
            
            {/* Symbol results */}
            <Show when={isSymbolMode()}>
              <For each={filteredSymbols()}>
                {(symbol, index) => {
                  const iconConfig = getIconConfig(symbol.kind);
                  return (
                    <div
                      data-symbol-item
                      role="option"
                      aria-selected={index() === selectedIndex()}
                      onMouseEnter={() => setSelectedIndex(index())}
                      onClick={() => handleSymbolSelect(symbol)}
                      style={{
                        display: "flex",
                        "align-items": "center",
                        gap: "12px",
                        padding: "10px 16px",
                        cursor: "pointer",
                        transition: "background-color 0.1s ease",
                        background: index() === selectedIndex() 
                          ? "rgba(59, 130, 246, 0.2)" 
                          : "transparent",
                        "border-left": index() === selectedIndex() 
                          ? "2px solid var(--jb-border-focus)" 
                          : "2px solid transparent",
                      }}
                    >
                      {/* Symbol icon */}
                      <div style={{ 
                        color: iconConfig.color,
                        "flex-shrink": "0",
                        display: "flex",
                        "align-items": "center",
                        "justify-content": "center",
                      }}>
                        <Icon name={iconConfig.icon} style={{ width: "16px", height: "16px" }} />
                      </div>
                      
                      {/* Symbol info */}
                      <div style={{ 
                        flex: "1", 
                        "min-width": "0",
                        display: "flex",
                        "flex-direction": "column",
                        gap: "2px",
                      }}>
                        {/* Symbol name */}
                        <span 
                          style={{ 
                            "font-size": "14px",
                            color: "var(--jb-text-body-color)",
                            overflow: "hidden",
                            "text-overflow": "ellipsis",
                            "white-space": "nowrap",
                          }}
                        >
                          {highlightMatches(symbol.name, symbol.matches)}
                        </span>
                        
                        {/* Container name if present */}
                        <Show when={symbol.containerName}>
                          <span 
                            style={{ 
                              "font-size": "12px",
                              color: "var(--jb-text-muted-color)",
                            }}
                          >
                            {symbol.containerName}
                          </span>
                        </Show>
                      </div>

                      {/* Symbol kind label */}
                      <span 
                        style={{ 
                          "font-size": "11px",
                          color: "var(--jb-text-muted-color)",
                          "white-space": "nowrap",
                          background: "var(--jb-canvas)",
                          padding: "2px 6px",
                          "border-radius": "var(--cortex-radius-sm)",
                        }}
                      >
                        {getSymbolKindLabel(symbol.kind)}
                      </span>

                      {/* Line number */}
                      <span 
                        style={{ 
                          "font-size": "12px",
                          color: "var(--jb-text-muted-color)",
                          "flex-shrink": "0",
                          "font-family": "var(--font-code)",
                        }}
                      >
                        :{symbol.line + 1}
                      </span>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>
        </div>

        {/* Footer with keyboard hints - Design specs: input-bg bg, radius-sm, 11px, text-secondary */}
        <div 
          style={{ 
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            padding: "8px 16px",
            "font-size": "11px",
            "border-top": "1px solid var(--jb-border-default)",
            color: "var(--jb-text-muted-color)",
            background: "var(--jb-canvas)",
          }}
        >
          <Show when={isGoToLineMode()}>
            <div style={{ display: "flex", gap: "12px", "align-items": "center" }}>
              <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                <kbd style={{ 
                  background: "var(--ui-panel-bg)", 
                  padding: "2px 6px", 
                  "border-radius": "var(--cortex-radius-sm)",
                  "font-size": "11px",
                  color: "var(--jb-text-muted-color)",
                  border: "1px solid var(--jb-border-default)",
                }}>Enter</kbd>
                <span>go to line</span>
              </span>
              <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                <kbd style={{ 
                  background: "var(--ui-panel-bg)", 
                  padding: "2px 6px", 
                  "border-radius": "var(--cortex-radius-sm)",
                  "font-size": "11px",
                  color: "var(--jb-text-muted-color)",
                  border: "1px solid var(--jb-border-default)",
                }}>Esc</kbd>
                <span>close</span>
              </span>
            </div>
            <span style={{ color: "var(--jb-text-muted-color)" }}>
              :line or :line:column
            </span>
          </Show>
          <Show when={isSymbolMode()}>
            <div style={{ display: "flex", gap: "12px", "align-items": "center" }}>
              <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                <kbd style={{ 
                  background: "var(--ui-panel-bg)", 
                  padding: "2px 6px", 
                  "border-radius": "var(--cortex-radius-sm)",
                  "font-size": "11px",
                  color: "var(--jb-text-muted-color)",
                  border: "1px solid var(--jb-border-default)",
                }}>↑</kbd>
                <kbd style={{ 
                  background: "var(--ui-panel-bg)", 
                  padding: "2px 6px", 
                  "border-radius": "var(--cortex-radius-sm)",
                  "font-size": "11px",
                  color: "var(--jb-text-muted-color)",
                  border: "1px solid var(--jb-border-default)",
                }}>↓</kbd>
                <span>navigate</span>
              </span>
              <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                <kbd style={{ 
                  background: "var(--ui-panel-bg)", 
                  padding: "2px 6px", 
                  "border-radius": "var(--cortex-radius-sm)",
                  "font-size": "11px",
                  color: "var(--jb-text-muted-color)",
                  border: "1px solid var(--jb-border-default)",
                }}>Enter</kbd>
                <span>go to symbol</span>
              </span>
              <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                <kbd style={{ 
                  background: "var(--ui-panel-bg)", 
                  padding: "2px 6px", 
                  "border-radius": "var(--cortex-radius-sm)",
                  "font-size": "11px",
                  color: "var(--jb-text-muted-color)",
                  border: "1px solid var(--jb-border-default)",
                }}>Esc</kbd>
                <span>close</span>
              </span>
            </div>
            <span>
              {filteredSymbols().length} symbol{filteredSymbols().length !== 1 ? "s" : ""} 
              {symbolQuery() && ` matching "${symbolQuery()}"`}
            </span>
          </Show>
          <Show when={!isGoToLineMode() && !isSymbolMode()}>
            <div style={{ display: "flex", gap: "12px", "align-items": "center" }}>
              <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                <kbd style={{ 
                  background: "var(--ui-panel-bg)", 
                  padding: "2px 6px", 
                  "border-radius": "var(--cortex-radius-sm)",
                  "font-size": "11px",
                  color: "var(--jb-text-muted-color)",
                  border: "1px solid var(--jb-border-default)",
                }}>↑</kbd>
                <kbd style={{ 
                  background: "var(--ui-panel-bg)", 
                  padding: "2px 6px", 
                  "border-radius": "var(--cortex-radius-sm)",
                  "font-size": "11px",
                  color: "var(--jb-text-muted-color)",
                  border: "1px solid var(--jb-border-default)",
                }}>↓</kbd>
                <span>navigate</span>
              </span>
              <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                <kbd style={{ 
                  background: "var(--ui-panel-bg)", 
                  padding: "2px 6px", 
                  "border-radius": "var(--cortex-radius-sm)",
                  "font-size": "11px",
                  color: "var(--jb-text-muted-color)",
                  border: "1px solid var(--jb-border-default)",
                }}>Enter</kbd>
                <span>open</span>
              </span>
              <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                <kbd style={{ 
                  background: "var(--ui-panel-bg)", 
                  padding: "2px 6px", 
                  "border-radius": "var(--cortex-radius-sm)",
                  "font-size": "11px",
                  color: "var(--jb-text-muted-color)",
                  border: "1px solid var(--jb-border-default)",
                }}>Esc</kbd>
                <span>close</span>
              </span>
            </div>
            <span>
              {filteredFiles().length} file{filteredFiles().length !== 1 ? "s" : ""} 
              {searchQuery() && ` matching "${searchQuery()}"`}
              {parsedQuery().line && <span style={{ color: "var(--jb-border-focus)" }}> → line {parsedQuery().line}{parsedQuery().column && `:${parsedQuery().column}`}</span>}
            </span>
          </Show>
        </div>
        
        {/* Hint for symbol search when not in symbol mode */}
        <Show when={!isSymbolMode() && !isGoToLineMode() && !query().trim()}>
          <div 
            style={{ 
              padding: "6px 16px",
              "font-size": "11px",
              "border-top": "1px solid var(--jb-border-default)",
              color: "var(--jb-text-muted-color)",
              background: "var(--jb-canvas)",
              "text-align": "center",
            }}
          >
            Type <span style={{ color: "var(--jb-border-focus)", "font-weight": "500" }}>@</span> to search symbols in current file
          </div>
        </Show>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @keyframes file-finder-progress {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 30%; margin-left: 35%; }
          100% { width: 0%; margin-left: 100%; }
        }
        
        @keyframes file-finder-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes file-finder-scale-in {
          from { 
            opacity: 0;
            transform: translateX(-50%) scale(0.95) translateY(-10px);
          }
          to { 
            opacity: 1;
            transform: translateX(-50%) scale(1) translateY(0);
          }
        }
      `}</style>
    </Show>
  );
}

