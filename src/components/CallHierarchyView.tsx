import { createSignal, createEffect, For, Show, onCleanup, onMount, JSX } from "solid-js";
import { useEditor } from "@/context/EditorContext";
import { useLSP, type Position, type Range } from "@/context/LSPContext";
import { Icon } from "./ui/Icon";
import {
  fsReadFile,
  fsGetFileTree,
  lspPrepareCallHierarchy,
  lspIncomingCalls,
  lspOutgoingCalls,
  type LspCallHierarchyItem,
  type FileTreeNode,
} from "../utils/tauri-api";
import { getProjectPath } from "../utils/workspace";

// ============================================================================
// Types
// ============================================================================

/**
 * Symbol kind for call hierarchy items
 */
export type CallHierarchySymbolKind =
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

/**
 * A single item in the call hierarchy
 */
export interface CallHierarchyItem {
  id: string;
  name: string;
  kind: CallHierarchySymbolKind;
  detail?: string;
  uri: string;
  range: Range;
  selectionRange: Range;
  data?: unknown;
}

/**
 * Incoming call - who calls this function
 */
export interface CallHierarchyIncomingCall {
  from: CallHierarchyItem;
  fromRanges: Range[];
  callCount: number;
  children?: CallHierarchyIncomingCall[];
  expanded?: boolean;
  loading?: boolean;
}

/**
 * Outgoing call - what this function calls
 */
export interface CallHierarchyOutgoingCall {
  to: CallHierarchyItem;
  fromRanges: Range[];
  callCount: number;
  children?: CallHierarchyOutgoingCall[];
  expanded?: boolean;
  loading?: boolean;
}

/**
 * Direction of call hierarchy view
 */
export type CallHierarchyDirection = "incoming" | "outgoing";

/**
 * Props for the CallHierarchyView component
 */
export interface CallHierarchyViewProps {
  visible: boolean;
  onClose: () => void;
  initialUri?: string;
  initialPosition?: Position;
  initialDirection?: CallHierarchyDirection;
}

/**
 * State for preview pane
 */
interface PreviewState {
  uri: string;
  range: Range;
  content: string[];
  loading: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique ID for call hierarchy items
 */
function generateId(): string {
  return `ch-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Extract file name from URI
 */
function getFileName(uri: string): string {
  const path = uri.replace(/^file:\/\//, "").replace(/\\/g, "/");
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

/**
 * Extract relative path from URI based on project path
 */
function getRelativePath(uri: string): string {
  const projectPath = getProjectPath();
  const path = uri.replace(/^file:\/\//, "").replace(/\\/g, "/");
  
  if (projectPath) {
    const normalizedProjectPath = projectPath.replace(/\\/g, "/");
    if (path.startsWith(normalizedProjectPath)) {
      return path.substring(normalizedProjectPath.length + 1);
    }
  }
  
  return path;
}

/**
 * Map LSP symbol kind number to our CallHierarchySymbolKind
 */
function mapSymbolKind(kind: number): CallHierarchySymbolKind {
  const kindMap: Record<number, CallHierarchySymbolKind> = {
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
  return kindMap[kind] || "function";
}

/**
 * Get icon for symbol kind
 */
function getSymbolIcon(kind: CallHierarchySymbolKind): JSX.Element {
  switch (kind) {
    case "file":
      return <Icon name="file" size={16} class="flex-shrink-0" style={{ color: "var(--text-weak)" }} />;
    case "module":
    case "namespace":
    case "package":
      return <Icon name="box" size={16} class="flex-shrink-0" style={{ color: "var(--cortex-warning)" }} />;
    case "class":
    case "struct":
      return <Icon name="box" size={16} class="flex-shrink-0" style={{ color: "var(--cortex-warning)" }} />;
    case "method":
    case "constructor":
      return <Icon name="code" size={16} class="flex-shrink-0" style={{ color: "var(--cortex-info)" }} />;
    case "property":
    case "field":
      return <Icon name="key" size={16} class="flex-shrink-0" style={{ color: "var(--cortex-info)" }} />;
    case "enum":
    case "enumMember":
      return <Icon name="hashtag" size={16} class="flex-shrink-0" style={{ color: "var(--cortex-error)" }} />;
    case "interface":
      return <Icon name="font" size={16} class="flex-shrink-0" style={{ color: "var(--cortex-success)" }} />;
    case "function":
      return <Icon name="bolt" size={16} class="flex-shrink-0" style={{ color: "var(--cortex-info)" }} />;
    case "variable":
      return <Icon name="anchor" size={16} class="flex-shrink-0" style={{ color: "var(--cortex-info)" }} />;
    case "constant":
      return <Icon name="database" size={16} class="flex-shrink-0" style={{ color: "var(--cortex-info)" }} />;
    case "typeParameter":
      return <Icon name="font" size={16} class="flex-shrink-0" style={{ color: "var(--cortex-info)" }} />;
    case "event":
      return <Icon name="code-merge" size={16} class="flex-shrink-0" style={{ color: "var(--cortex-warning)" }} />;
    default:
      return <Icon name="code" size={16} class="flex-shrink-0" style={{ color: "var(--text-weak)" }} />;
  }
}

// ============================================================================
// AST-Based Call Extraction (Fallback)
// ============================================================================

interface FunctionCallInfo {
  name: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

interface FunctionDefinitionInfo {
  name: string;
  kind: CallHierarchySymbolKind;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  calls: FunctionCallInfo[];
}

/**
 * Parse function definitions and calls from source code using regex patterns
 * This is a fallback when LSP callHierarchy is not available
 */
function parseSourceForCallHierarchy(
  content: string,
  fileExtension: string
): FunctionDefinitionInfo[] {
  const lines = content.split("\n");
  const functions: FunctionDefinitionInfo[] = [];

  // Patterns for different languages
  const patterns = getLanguagePatterns(fileExtension);

  // First pass: Find all function definitions
  lines.forEach((line, lineIndex) => {
    for (const pattern of patterns.definitions) {
      const match = line.match(pattern.regex);
      if (match) {
        const name = match[pattern.nameGroup || 1];
        if (name && name.length > 1 && !name.startsWith("_")) {
          // Find the end of the function by tracking braces
          const endLine = findFunctionEnd(lines, lineIndex, fileExtension);
          
          functions.push({
            name,
            kind: pattern.kind,
            startLine: lineIndex,
            startColumn: match.index || 0,
            endLine,
            endColumn: lines[endLine]?.length || 0,
            calls: [],
          });
        }
      }
    }
  });

  // Second pass: Find all function calls within each function
  functions.forEach((func) => {
    for (let i = func.startLine; i <= func.endLine && i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of patterns.calls) {
        let match: RegExpExecArray | null;
        const regex = new RegExp(pattern.regex.source, "g");
        while ((match = regex.exec(line)) !== null) {
          const callName = match[pattern.nameGroup || 1];
          if (callName && callName !== func.name && !isBuiltIn(callName, fileExtension)) {
            func.calls.push({
              name: callName,
              line: i,
              column: match.index,
              endLine: i,
              endColumn: match.index + match[0].length,
            });
          }
        }
      }
    }
  });

  return functions;
}

interface LanguagePattern {
  regex: RegExp;
  kind: CallHierarchySymbolKind;
  nameGroup?: number;
}

interface LanguagePatternSet {
  definitions: LanguagePattern[];
  calls: LanguagePattern[];
}

/**
 * Get regex patterns for different languages
 */
function getLanguagePatterns(ext: string): LanguagePatternSet {
  switch (ext.toLowerCase()) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "mts":
    case "cts":
    case "mjs":
    case "cjs":
      return {
        definitions: [
          { regex: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/, kind: "function" },
          { regex: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/, kind: "function" },
          { regex: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?function/, kind: "function" },
          { regex: /^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[\w<>[\]|&\s]+)?\s*\{/, kind: "method" },
          { regex: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/, kind: "class" },
        ],
        calls: [
          { regex: /(?<!function\s)(?<!const\s)(?<![.])(\b[a-zA-Z_]\w*)\s*\(/, kind: "function", nameGroup: 1 },
          { regex: /\.(\w+)\s*\(/, kind: "method", nameGroup: 1 },
        ],
      };
    case "py":
      return {
        definitions: [
          { regex: /^(?:async\s+)?def\s+(\w+)/, kind: "function" },
          { regex: /^class\s+(\w+)/, kind: "class" },
        ],
        calls: [
          { regex: /(?<!def\s)(\b[a-zA-Z_]\w*)\s*\(/, kind: "function", nameGroup: 1 },
        ],
      };
    case "rs":
      return {
        definitions: [
          { regex: /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/, kind: "function" },
          { regex: /^(?:pub\s+)?struct\s+(\w+)/, kind: "struct" },
          { regex: /^(?:pub\s+)?impl(?:<[^>]+>)?\s+(\w+)/, kind: "class" },
        ],
        calls: [
          { regex: /(?<!fn\s)(\b[a-zA-Z_]\w*)\s*\(/, kind: "function", nameGroup: 1 },
          { regex: /::(\w+)\s*\(/, kind: "function", nameGroup: 1 },
        ],
      };
    case "go":
      return {
        definitions: [
          { regex: /^func\s+(\w+)/, kind: "function" },
          { regex: /^func\s+\([^)]+\)\s+(\w+)/, kind: "method" },
          { regex: /^type\s+(\w+)\s+struct/, kind: "struct" },
        ],
        calls: [
          { regex: /(?<!func\s)(\b[a-zA-Z_]\w*)\s*\(/, kind: "function", nameGroup: 1 },
        ],
      };
    default:
      return {
        definitions: [
          { regex: /function\s+(\w+)/, kind: "function" },
          { regex: /def\s+(\w+)/, kind: "function" },
          { regex: /class\s+(\w+)/, kind: "class" },
        ],
        calls: [
          { regex: /(\b[a-zA-Z_]\w*)\s*\(/, kind: "function", nameGroup: 1 },
        ],
      };
  }
}

/**
 * Find the end of a function by tracking braces/indentation
 */
function findFunctionEnd(lines: string[], startLine: number, ext: string): number {
  const isPythonLike = ext === "py";
  
  if (isPythonLike) {
    // Python uses indentation
    const startIndent = lines[startLine].search(/\S/);
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === "") continue;
      const currentIndent = line.search(/\S/);
      if (currentIndent <= startIndent && line.trim() !== "") {
        return i - 1;
      }
    }
    return lines.length - 1;
  }
  
  // Brace-based languages
  let braceCount = 0;
  let foundFirstBrace = false;
  
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (const char of line) {
      if (char === "{") {
        braceCount++;
        foundFirstBrace = true;
      } else if (char === "}") {
        braceCount--;
        if (foundFirstBrace && braceCount === 0) {
          return i;
        }
      }
    }
  }
  
  return Math.min(startLine + 50, lines.length - 1);
}

/**
 * Check if a function name is a built-in
 */
function isBuiltIn(name: string, ext: string): boolean {
  const commonBuiltIns = new Set([
    "if", "else", "for", "while", "switch", "case", "return", "break", "continue",
    "new", "delete", "typeof", "instanceof", "void", "throw", "try", "catch", "finally",
    "import", "export", "from", "as", "default", "class", "extends", "super", "this",
    "null", "undefined", "true", "false", "NaN", "Infinity",
  ]);
  
  const jsBuiltIns = new Set([
    "console", "Math", "JSON", "Object", "Array", "String", "Number", "Boolean",
    "Date", "RegExp", "Error", "Promise", "Map", "Set", "WeakMap", "WeakSet",
    "Symbol", "Proxy", "Reflect", "parseInt", "parseFloat", "isNaN", "isFinite",
    "encodeURI", "decodeURI", "encodeURIComponent", "decodeURIComponent",
    "setTimeout", "setInterval", "clearTimeout", "clearInterval",
    "fetch", "require", "module", "exports", "process", "Buffer",
    "log", "warn", "error", "info", "debug", "trace",
  ]);
  
  const pyBuiltIns = new Set([
    "print", "len", "range", "str", "int", "float", "list", "dict", "set", "tuple",
    "bool", "type", "isinstance", "hasattr", "getattr", "setattr", "delattr",
    "open", "close", "read", "write", "input", "super", "self", "cls",
  ]);
  
  const rsBuiltIns = new Set([
    "println", "print", "format", "vec", "Box", "Rc", "Arc", "RefCell", "Cell",
    "Some", "None", "Ok", "Err", "Result", "Option", "Vec", "String", "str",
    "match", "if", "else", "loop", "while", "for", "in", "return", "break", "continue",
  ]);

  if (commonBuiltIns.has(name)) return true;
  
  switch (ext.toLowerCase()) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "mts":
    case "cts":
      return jsBuiltIns.has(name);
    case "py":
      return pyBuiltIns.has(name);
    case "rs":
      return rsBuiltIns.has(name);
    default:
      return jsBuiltIns.has(name);
  }
}

// ============================================================================
// Call Hierarchy Tree Node Component
// ============================================================================

interface CallHierarchyNodeProps {
  item: CallHierarchyIncomingCall | CallHierarchyOutgoingCall;
  direction: CallHierarchyDirection;
  depth: number;
  selectedId: string | null;
  onSelect: (item: CallHierarchyIncomingCall | CallHierarchyOutgoingCall) => void;
  onToggleExpand: (item: CallHierarchyIncomingCall | CallHierarchyOutgoingCall) => void;
  onNavigate: (item: CallHierarchyIncomingCall | CallHierarchyOutgoingCall, rangeIndex?: number) => void;
  onPreview: (item: CallHierarchyIncomingCall | CallHierarchyOutgoingCall) => void;
}

function CallHierarchyNode(props: CallHierarchyNodeProps) {
  const hierarchyItem = () => {
    return props.direction === "incoming"
      ? (props.item as CallHierarchyIncomingCall).from
      : (props.item as CallHierarchyOutgoingCall).to;
  };

  const isSelected = () => props.selectedId === hierarchyItem().id;
  const hasChildren = () => (props.item.children?.length ?? 0) > 0 || !props.item.expanded;
  const isExpanded = () => props.item.expanded ?? false;
  const isLoading = () => props.item.loading ?? false;

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    props.onSelect(props.item);
    props.onPreview(props.item);
  };

  const handleDoubleClick = (e: MouseEvent) => {
    e.stopPropagation();
    props.onNavigate(props.item);
  };

  const handleChevronClick = (e: MouseEvent) => {
    e.stopPropagation();
    props.onToggleExpand(props.item);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      props.onNavigate(props.item);
    } else if (e.key === " ") {
      e.preventDefault();
      props.onToggleExpand(props.item);
    } else if (e.key === "ArrowRight" && !isExpanded()) {
      e.preventDefault();
      props.onToggleExpand(props.item);
    } else if (e.key === "ArrowLeft" && isExpanded()) {
      e.preventDefault();
      props.onToggleExpand(props.item);
    }
  };

  return (
    <div class="call-hierarchy-node">
      {/* Node row */}
      <div
        class="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded transition-colors"
        classList={{
          "bg-[var(--surface-active)]": isSelected(),
          "hover:bg-[var(--surface-hover)]": !isSelected(),
        }}
        style={{ "padding-left": `${props.depth * 16 + 8}px` }}
        onClick={handleClick}
        onDblClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => props.onPreview(props.item)}
        tabIndex={0}
        role="treeitem"
        aria-expanded={hasChildren() ? isExpanded() : undefined}
        aria-selected={isSelected()}
      >
        {/* Expand/collapse chevron */}
        <button
          class="w-4 h-4 flex items-center justify-center flex-shrink-0 transition-transform"
          classList={{ "rotate-90": isExpanded() }}
          onClick={handleChevronClick}
          aria-label={isExpanded() ? "Collapse" : "Expand"}
        >
<Show when={hasChildren() && !isLoading()}>
            <Icon name="chevron-right" size={12} style={{ color: "var(--text-weak)" }} />
          </Show>
          <Show when={isLoading()}>
            <div class="w-3 h-3 border border-t-transparent border-[var(--text-weak)] rounded-full animate-spin" />
          </Show>
        </button>

        {/* Symbol icon */}
        {getSymbolIcon(hierarchyItem().kind)}

        {/* Function name */}
        <span
          class="text-sm font-medium truncate"
          style={{ color: "var(--text-base)" }}
        >
          {hierarchyItem().name}
        </span>

        {/* Call count badge */}
        <Show when={props.item.callCount > 1}>
          <span
            class="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
            style={{
              background: "var(--accent-primary-muted, rgba(59, 130, 246, 0.2))",
              color: "var(--accent-primary)",
            }}
          >
            ×{props.item.callCount}
          </span>
        </Show>

        {/* File info */}
        <span
          class="text-xs truncate ml-auto flex-shrink-0"
          style={{ color: "var(--text-weak)" }}
        >
          {getFileName(hierarchyItem().uri)}:{hierarchyItem().selectionRange.start.line + 1}
        </span>
      </div>

      {/* Call site ranges (when expanded and has multiple call sites) */}
      <Show when={isExpanded() && props.item.fromRanges.length > 1}>
        <div class="ml-4" style={{ "padding-left": `${props.depth * 16 + 24}px` }}>
          <For each={props.item.fromRanges}>
            {(range, index) => (
              <button
                class="flex items-center gap-2 px-2 py-1 text-xs rounded transition-colors w-full text-left hover:bg-[var(--surface-hover)]"
                onClick={() => props.onNavigate(props.item, index())}
              >
                <Icon name="phone" size={12} style={{ color: "var(--text-weak)" }} />
                <span style={{ color: "var(--text-weak)" }}>
                  Call at line {range.start.line + 1}, col {range.start.character + 1}
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Children */}
      <Show when={isExpanded() && props.item.children}>
        <div role="group">
          <For each={props.item.children}>
            {(child) => (
              <CallHierarchyNode
                item={child}
                direction={props.direction}
                depth={props.depth + 1}
                selectedId={props.selectedId}
                onSelect={props.onSelect}
                onToggleExpand={props.onToggleExpand}
                onNavigate={props.onNavigate}
                onPreview={props.onPreview}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Main CallHierarchyView Component
// ============================================================================

export function CallHierarchyView(props: CallHierarchyViewProps) {
  const { openFile } = useEditor();
  const lsp = useLSP();

  // State
  const [direction, setDirection] = createSignal<CallHierarchyDirection>("incoming");
  const [rootItem, setRootItem] = createSignal<CallHierarchyItem | null>(null);
  const [incomingCalls, setIncomingCalls] = createSignal<CallHierarchyIncomingCall[]>([]);
  const [outgoingCalls, setOutgoingCalls] = createSignal<CallHierarchyOutgoingCall[]>([]);
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [preview, setPreview] = createSignal<PreviewState | null>(null);
  const [allExpanded, setAllExpanded] = createSignal(false);

  // Cached parsed data for fallback mode (setter used to store parsed functions)
  const [, setParsedFunctions] = createSignal<Map<string, FunctionDefinitionInfo[]>>(new Map());

  let containerRef: HTMLDivElement | undefined;

  // Initialize when visible and has initial position
  createEffect(() => {
    if (props.visible && props.initialUri && props.initialPosition) {
      // Set initial direction if provided
      if (props.initialDirection) {
        setDirection(props.initialDirection);
      }
      initializeCallHierarchy(props.initialUri, props.initialPosition);
    }
  });

  // Register keyboard shortcut globally
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shift+Alt+H to show call hierarchy
      if (e.shiftKey && e.altKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("call-hierarchy:show"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  // Close on Escape
  createEffect(() => {
    if (!props.visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  /**
   * Initialize call hierarchy for a symbol at the given position
   */
  async function initializeCallHierarchy(uri: string, position: Position): Promise<void> {
    setLoading(true);
    setError(null);
    setIncomingCalls([]);
    setOutgoingCalls([]);
    setRootItem(null);

    try {
      // Try LSP first
      const lspResult = await tryLSPCallHierarchy(uri, position);
      
      if (lspResult) {
        setRootItem(lspResult);
        await loadCalls(lspResult, direction());
      } else {
        // Fallback to AST parsing
        await initializeFallbackCallHierarchy(uri, position);
      }
    } catch (e) {
      console.error("Failed to initialize call hierarchy:", e);
      setError(e instanceof Error ? e.message : "Failed to load call hierarchy");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Try to get call hierarchy item from LSP
   */
  async function tryLSPCallHierarchy(uri: string, position: Position): Promise<CallHierarchyItem | null> {
    try {
      // Get the server for this file
      const filePath = uri.replace(/^file:\/\//, "");
      const server = lsp.getServerForFile(filePath);
      
      if (!server || server.status !== "running") {
        return null;
      }

      // Try to prepare call hierarchy via Tauri invoke
      const items = await lspPrepareCallHierarchy(filePath, position.line, position.character);

      if (!items || items.length === 0) {
        return null;
      }

      const item = items[0];
      return {
        id: generateId(),
        name: item.name,
        kind: mapSymbolKind(item.kind),
        uri: item.uri,
        range: item.range,
        selectionRange: item.selectionRange,
      };
    } catch (e) {
      console.debug("LSP call hierarchy not available:", e);
      return null;
    }
  }

  /**
   * Initialize fallback call hierarchy using AST parsing
   */
  async function initializeFallbackCallHierarchy(uri: string, position: Position): Promise<void> {
    const filePath = uri.replace(/^file:\/\//, "");
    const projectPath = getProjectPath();

    try {
      // Fetch file content via Tauri
      const content = await fsReadFile(filePath);
      const ext = filePath.split(".").pop() || "js";

      // Parse the file
      const functions = parseSourceForCallHierarchy(content, ext);
      setParsedFunctions((prev) => new Map(prev).set(filePath, functions));

      // Find the function at the given position
      const targetFunc = functions.find(
        (f) =>
          position.line >= f.startLine &&
          position.line <= f.endLine
      );

      if (!targetFunc) {
        throw new Error("No function found at cursor position");
      }

      // Create root item
      const rootHierarchyItem: CallHierarchyItem = {
        id: generateId(),
        name: targetFunc.name,
        kind: targetFunc.kind,
        uri,
        range: {
          start: { line: targetFunc.startLine, character: targetFunc.startColumn },
          end: { line: targetFunc.endLine, character: targetFunc.endColumn },
        },
        selectionRange: {
          start: { line: targetFunc.startLine, character: targetFunc.startColumn },
          end: { line: targetFunc.startLine, character: targetFunc.startColumn + targetFunc.name.length },
        },
      };

      setRootItem(rootHierarchyItem);

      // Build incoming/outgoing calls from parsed data
      await buildFallbackCalls(rootHierarchyItem, functions, projectPath, ext);
    } catch (e) {
      throw e;
    }
  }

  /**
   * Build incoming and outgoing calls from parsed function data
   */
  async function buildFallbackCalls(
    root: CallHierarchyItem,
    functions: FunctionDefinitionInfo[],
    projectPath: string,
    ext: string
  ): Promise<void> {
    const incoming: CallHierarchyIncomingCall[] = [];
    const outgoing: CallHierarchyOutgoingCall[] = [];

    // Find incoming calls (functions that call this function)
    for (const func of functions) {
      const callsToRoot = func.calls.filter((c) => c.name === root.name);
      if (callsToRoot.length > 0 && func.name !== root.name) {
        incoming.push({
          from: {
            id: generateId(),
            name: func.name,
            kind: func.kind,
            uri: root.uri,
            range: {
              start: { line: func.startLine, character: func.startColumn },
              end: { line: func.endLine, character: func.endColumn },
            },
            selectionRange: {
              start: { line: func.startLine, character: func.startColumn },
              end: { line: func.startLine, character: func.startColumn + func.name.length },
            },
          },
          fromRanges: callsToRoot.map((c) => ({
            start: { line: c.line, character: c.column },
            end: { line: c.endLine, character: c.endColumn },
          })),
          callCount: callsToRoot.length,
          expanded: false,
        });
      }
    }

    // Find outgoing calls (functions that this function calls)
    const rootFunc = functions.find((f) => f.name === root.name);
    if (rootFunc) {
      // Group calls by function name
      const callGroups = new Map<string, FunctionCallInfo[]>();
      for (const call of rootFunc.calls) {
        const existing = callGroups.get(call.name) || [];
        existing.push(call);
        callGroups.set(call.name, existing);
      }

      for (const [callName, calls] of callGroups) {
        // Try to find the definition of the called function
        const calledFunc = functions.find((f) => f.name === callName);
        
        outgoing.push({
          to: {
            id: generateId(),
            name: callName,
            kind: calledFunc?.kind || "function",
            uri: root.uri,
            range: calledFunc
              ? {
                  start: { line: calledFunc.startLine, character: calledFunc.startColumn },
                  end: { line: calledFunc.endLine, character: calledFunc.endColumn },
                }
              : calls[0]
              ? {
                  start: { line: calls[0].line, character: calls[0].column },
                  end: { line: calls[0].endLine, character: calls[0].endColumn },
                }
              : { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
            selectionRange: calledFunc
              ? {
                  start: { line: calledFunc.startLine, character: calledFunc.startColumn },
                  end: { line: calledFunc.startLine, character: calledFunc.startColumn + callName.length },
                }
              : {
                  start: { line: calls[0].line, character: calls[0].column },
                  end: { line: calls[0].line, character: calls[0].column + callName.length },
                },
          },
          fromRanges: calls.map((c) => ({
            start: { line: c.line, character: c.column },
            end: { line: c.endLine, character: c.endColumn },
          })),
          callCount: calls.length,
          expanded: false,
        });
      }
    }

    // Also search other files in the project for incoming calls
    await searchProjectForIncomingCalls(root, incoming, projectPath, ext);

    setIncomingCalls(incoming);
    setOutgoingCalls(outgoing);
  }

  /**
   * Search project files for incoming calls to the root function
   */
  async function searchProjectForIncomingCalls(
    root: CallHierarchyItem,
    incoming: CallHierarchyIncomingCall[],
    projectPath: string,
    ext: string
  ): Promise<void> {
    try {
      // Get file tree to find relevant files via Tauri
      const treeData = await fsGetFileTree(projectPath, 5);
      const files = collectCodeFiles(treeData.children || [], "", ext);
      const rootFilePath = root.uri.replace(/^file:\/\//, "");

      // Limit to avoid performance issues
      const filesToSearch = files.slice(0, 50);

      for (const file of filesToSearch) {
        const fullPath = `${projectPath}/${file.path}`;
        if (fullPath === rootFilePath) continue; // Skip the root file

        try {
          const content = await fsReadFile(fullPath);
          const functions = parseSourceForCallHierarchy(content, ext);

          for (const func of functions) {
            const callsToRoot = func.calls.filter((c) => c.name === root.name);
            if (callsToRoot.length > 0) {
              incoming.push({
                from: {
                  id: generateId(),
                  name: func.name,
                  kind: func.kind,
                  uri: `file://${fullPath}`,
                  range: {
                    start: { line: func.startLine, character: func.startColumn },
                    end: { line: func.endLine, character: func.endColumn },
                  },
                  selectionRange: {
                    start: { line: func.startLine, character: func.startColumn },
                    end: { line: func.startLine, character: func.startColumn + func.name.length },
                  },
                },
                fromRanges: callsToRoot.map((c) => ({
                  start: { line: c.line, character: c.column },
                  end: { line: c.endLine, character: c.endColumn },
                })),
                callCount: callsToRoot.length,
                expanded: false,
              });
            }
          }
        } catch (e) {
          // Skip files that fail
        }
      }
    } catch (e) {
      console.debug("Failed to search project for incoming calls:", e);
    }
  }

  /**
   * Collect code files from tree structure
   */
  function collectCodeFiles(
    entries: FileTreeNode[] | undefined,
    parentPath: string,
    targetExt: string
  ): Array<{ name: string; path: string }> {
    const result: Array<{ name: string; path: string }> = [];
    if (!entries) return result;

    const codeExtensions = new Set([targetExt, "ts", "tsx", "js", "jsx", "py", "rs", "go"]);

    for (const entry of entries) {
      const fullPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

      if (entry.isFile) {
        const ext = entry.name.split(".").pop()?.toLowerCase();
        if (ext && codeExtensions.has(ext)) {
          result.push({ name: entry.name, path: fullPath });
        }
      }

      if (entry.isDirectory && entry.children) {
        result.push(
          ...collectCodeFiles(entry.children, fullPath, targetExt)
        );
      }
    }

    return result;
  }

  /**
   * Load calls (incoming or outgoing) for a hierarchy item
   */
  async function loadCalls(item: CallHierarchyItem, dir: CallHierarchyDirection): Promise<void> {
    try {
      if (dir === "incoming") {
        const calls = await fetchIncomingCalls(item);
        setIncomingCalls(calls);
      } else {
        const calls = await fetchOutgoingCalls(item);
        setOutgoingCalls(calls);
      }
    } catch (e) {
      console.error("Failed to load calls:", e);
    }
  }

  /**
   * Fetch incoming calls via LSP
   */
  async function fetchIncomingCalls(item: CallHierarchyItem): Promise<CallHierarchyIncomingCall[]> {
    try {
      // Convert to LspCallHierarchyItem format
      const lspItem: LspCallHierarchyItem = {
        name: item.name,
        kind: getSymbolKindNumber(item.kind),
        uri: item.uri,
        range: item.range,
        selectionRange: item.selectionRange,
      };

      const calls = await lspIncomingCalls(lspItem);

      return (calls || []).map((call: LspCallHierarchyItem) => ({
        from: {
          id: generateId(),
          name: call.name,
          kind: mapSymbolKind(call.kind),
          uri: call.uri,
          range: call.range,
          selectionRange: call.selectionRange,
        },
        fromRanges: [call.selectionRange], // Use selectionRange as fromRange
        callCount: 1,
        expanded: false,
      }));
    } catch (e) {
      console.debug("Failed to fetch incoming calls:", e);
      return [];
    }
  }

  /**
   * Convert CallHierarchySymbolKind to LSP kind number
   */
  function getSymbolKindNumber(kind: CallHierarchySymbolKind): number {
    const kindMap: Record<CallHierarchySymbolKind, number> = {
      file: 1,
      module: 2,
      namespace: 3,
      package: 4,
      class: 5,
      method: 6,
      property: 7,
      field: 8,
      constructor: 9,
      enum: 10,
      interface: 11,
      function: 12,
      variable: 13,
      constant: 14,
      string: 15,
      number: 16,
      boolean: 17,
      array: 18,
      object: 19,
      key: 20,
      null: 21,
      enumMember: 22,
      struct: 23,
      event: 24,
      operator: 25,
      typeParameter: 26,
    };
    return kindMap[kind] || 12; // Default to function
  }

  /**
   * Fetch outgoing calls via LSP
   */
  async function fetchOutgoingCalls(item: CallHierarchyItem): Promise<CallHierarchyOutgoingCall[]> {
    try {
      // Convert to LspCallHierarchyItem format
      const lspItem: LspCallHierarchyItem = {
        name: item.name,
        kind: getSymbolKindNumber(item.kind),
        uri: item.uri,
        range: item.range,
        selectionRange: item.selectionRange,
      };

      const calls = await lspOutgoingCalls(lspItem);

      return (calls || []).map((call: LspCallHierarchyItem) => ({
        to: {
          id: generateId(),
          name: call.name,
          kind: mapSymbolKind(call.kind),
          uri: call.uri,
          range: call.range,
          selectionRange: call.selectionRange,
        },
        fromRanges: [call.selectionRange], // Use selectionRange as fromRange
        callCount: 1,
        expanded: false,
      }));
    } catch (e) {
      console.debug("Failed to fetch outgoing calls:", e);
      return [];
    }
  }

  /**
   * Handle direction change
   */
  function handleDirectionChange(newDirection: CallHierarchyDirection): void {
    if (newDirection === direction()) return;
    setDirection(newDirection);
    const root = rootItem();
    if (root) {
      loadCalls(root, newDirection);
    }
  }

  /**
   * Handle refresh
   */
  async function handleRefresh(): Promise<void> {
    if (props.initialUri && props.initialPosition) {
      await initializeCallHierarchy(props.initialUri, props.initialPosition);
    }
  }

  /**
   * Handle expand/collapse all
   */
  function handleExpandCollapseAll(): void {
    const newExpanded = !allExpanded();
    setAllExpanded(newExpanded);

    const updateExpanded = <T extends { expanded?: boolean; children?: T[] }>(items: T[]): T[] => {
      return items.map((item) => ({
        ...item,
        expanded: newExpanded,
        children: item.children ? updateExpanded(item.children) : undefined,
      }));
    };

    if (direction() === "incoming") {
      setIncomingCalls(updateExpanded(incomingCalls()));
    } else {
      setOutgoingCalls(updateExpanded(outgoingCalls()));
    }
  }

  /**
   * Handle item selection
   */
  function handleSelect(item: CallHierarchyIncomingCall | CallHierarchyOutgoingCall): void {
    const hierarchyItem = direction() === "incoming"
      ? (item as CallHierarchyIncomingCall).from
      : (item as CallHierarchyOutgoingCall).to;
    setSelectedId(hierarchyItem.id);
  }

  /**
   * Handle toggle expand for an item
   */
  async function handleToggleExpand(item: CallHierarchyIncomingCall | CallHierarchyOutgoingCall): Promise<void> {
    const hierarchyItem = direction() === "incoming"
      ? (item as CallHierarchyIncomingCall).from
      : (item as CallHierarchyOutgoingCall).to;

    const updateItem = <T extends { expanded?: boolean; loading?: boolean; children?: T[] }>(
      items: T[],
      targetId: string,
      updater: (item: T) => T
    ): T[] => {
      return items.map((i) => {
        const iHierarchyItem = direction() === "incoming"
          ? (i as unknown as CallHierarchyIncomingCall).from
          : (i as unknown as CallHierarchyOutgoingCall).to;

        if (iHierarchyItem.id === targetId) {
          return updater(i);
        }
        if (i.children) {
          return { ...i, children: updateItem(i.children, targetId, updater) };
        }
        return i;
      });
    };

    // If already expanded, just collapse
    if (item.expanded) {
      if (direction() === "incoming") {
        setIncomingCalls(updateItem(incomingCalls(), hierarchyItem.id, (i) => ({ ...i, expanded: false })));
      } else {
        setOutgoingCalls(updateItem(outgoingCalls(), hierarchyItem.id, (i) => ({ ...i, expanded: false })));
      }
      return;
    }

    // Set loading state
    if (direction() === "incoming") {
      setIncomingCalls(updateItem(incomingCalls(), hierarchyItem.id, (i) => ({ ...i, loading: true })));
    } else {
      setOutgoingCalls(updateItem(outgoingCalls(), hierarchyItem.id, (i) => ({ ...i, loading: true })));
    }

    // Load children
    try {
      let children: (CallHierarchyIncomingCall | CallHierarchyOutgoingCall)[] = [];

      if (direction() === "incoming") {
        children = await fetchIncomingCalls(hierarchyItem);
      } else {
        children = await fetchOutgoingCalls(hierarchyItem);
      }

      // Update with children and expanded state
      if (direction() === "incoming") {
        setIncomingCalls(
          updateItem(incomingCalls(), hierarchyItem.id, (i) => ({
            ...i,
            expanded: true,
            loading: false,
            children: children as CallHierarchyIncomingCall[],
          }))
        );
      } else {
        setOutgoingCalls(
          updateItem(outgoingCalls(), hierarchyItem.id, (i) => ({
            ...i,
            expanded: true,
            loading: false,
            children: children as CallHierarchyOutgoingCall[],
          }))
        );
      }
    } catch (e) {
      // Clear loading state on error
      if (direction() === "incoming") {
        setIncomingCalls(updateItem(incomingCalls(), hierarchyItem.id, (i) => ({ ...i, loading: false, expanded: true })));
      } else {
        setOutgoingCalls(updateItem(outgoingCalls(), hierarchyItem.id, (i) => ({ ...i, loading: false, expanded: true })));
      }
    }
  }

  /**
   * Handle navigation to a call site
   */
  async function handleNavigate(
    item: CallHierarchyIncomingCall | CallHierarchyOutgoingCall,
    rangeIndex?: number
  ): Promise<void> {
    const hierarchyItem = direction() === "incoming"
      ? (item as CallHierarchyIncomingCall).from
      : (item as CallHierarchyOutgoingCall).to;

    const range = rangeIndex !== undefined
      ? item.fromRanges[rangeIndex]
      : hierarchyItem.selectionRange;

    const filePath = hierarchyItem.uri.replace(/^file:\/\//, "");

    // Open file
    await openFile(filePath);

    // Navigate to position
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("editor:goto-line", {
          detail: {
            line: range.start.line + 1,
            column: range.start.character + 1,
          },
        })
      );
    }, 100);
  }

  /**
   * Handle preview on hover
   */
  async function handlePreview(item: CallHierarchyIncomingCall | CallHierarchyOutgoingCall): Promise<void> {
    const hierarchyItem = direction() === "incoming"
      ? (item as CallHierarchyIncomingCall).from
      : (item as CallHierarchyOutgoingCall).to;

    const filePath = hierarchyItem.uri.replace(/^file:\/\//, "");

    setPreview({
      uri: hierarchyItem.uri,
      range: hierarchyItem.selectionRange,
      content: [],
      loading: true,
    });

    try {
      const content = await fsReadFile(filePath);
      const lines = content.split("\n");
      const startLine = Math.max(0, hierarchyItem.selectionRange.start.line - 3);
      const endLine = Math.min(lines.length, hierarchyItem.selectionRange.start.line + 12);

      setPreview({
        uri: hierarchyItem.uri,
        range: hierarchyItem.selectionRange,
        content: lines.slice(startLine, endLine).map((line, i) => ({
          lineNumber: startLine + i + 1,
          content: line,
          isHighlighted: startLine + i === hierarchyItem.selectionRange.start.line,
        })) as unknown as string[],
        loading: false,
      });
    } catch (e) {
      setPreview((prev) => (prev ? { ...prev, loading: false } : null));
    }
  }

  // Get current calls based on direction
  const currentCalls = () => (direction() === "incoming" ? incomingCalls() : outgoingCalls());

  return (
    <Show when={props.visible}>
      <div
        ref={containerRef}
        class="fixed inset-0 z-[100] flex items-center justify-center"
        onClick={() => props.onClose()}
      >
        {/* Backdrop */}
        <div class="absolute inset-0 bg-black/50" />

        {/* Modal */}
        <div
          class="relative w-[900px] max-h-[70vh] rounded-lg shadow-2xl overflow-hidden flex flex-col"
          style={{ background: "var(--surface-raised)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            class="flex items-center gap-3 px-4 py-3 border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            {/* Direction toggle */}
            <div class="flex rounded-md overflow-hidden" style={{ background: "var(--surface-base)" }}>
              <button
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
                classList={{
                  "bg-[var(--accent-primary)] text-white": direction() === "incoming",
                  "text-[var(--text-weak)] hover:text-[var(--text-base)]": direction() !== "incoming",
                }}
                onClick={() => handleDirectionChange("incoming")}
              >
                <Icon name="phone-arrow-down-left" size={16} />
                <span>Incoming</span>
              </button>
              <button
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
                classList={{
                  "bg-[var(--accent-primary)] text-white": direction() === "outgoing",
                  "text-[var(--text-weak)] hover:text-[var(--text-base)]": direction() !== "outgoing",
                }}
                onClick={() => handleDirectionChange("outgoing")}
              >
                <Icon name="phone-arrow-up-right" size={16} />
                <span>Outgoing</span>
              </button>
            </div>

            {/* Root function info */}
            <Show when={rootItem()}>
              <div class="flex items-center gap-2 flex-1 min-w-0">
                {getSymbolIcon(rootItem()!.kind)}
                <span class="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>
                  {rootItem()!.name}
                </span>
                <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                  {getRelativePath(rootItem()!.uri)}:{rootItem()!.selectionRange.start.line + 1}
                </span>
              </div>
            </Show>

            {/* Actions */}
            <div class="flex items-center gap-1">
              <button
                class="p-1.5 rounded transition-colors hover:bg-[var(--surface-hover)]"
                onClick={handleExpandCollapseAll}
                title={allExpanded() ? "Collapse All" : "Expand All"}
              >
<Show when={allExpanded()} fallback={<Icon name="maximize" size={16} style={{ color: "var(--text-weak)" }} />}>
                  <Icon name="minimize" size={16} style={{ color: "var(--text-weak)" }} />
                </Show>
              </button>
              <button
                class="p-1.5 rounded transition-colors hover:bg-[var(--surface-hover)]"
                onClick={handleRefresh}
                title="Refresh"
              >
<Icon
                  name="rotate"
                  size={16}
                  class={loading() ? "animate-spin" : ""}
                  style={{ color: "var(--text-weak)" }}
                />
              </button>
              <button
                class="p-1.5 rounded transition-colors hover:bg-[var(--surface-hover)]"
                onClick={() => props.onClose()}
                title="Close (Esc)"
              >
                <Icon name="xmark" size={16} style={{ color: "var(--text-weak)" }} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div class="flex flex-1 overflow-hidden">
            {/* Tree view */}
            <div
              class="flex-1 overflow-auto min-w-0"
              style={{ "max-width": "55%", "border-right": "1px solid var(--border-weak)" }}
            >
              <Show when={loading()}>
                <div class="flex items-center justify-center py-12">
                  <div class="flex items-center gap-3">
                    <div class="w-5 h-5 border-2 border-t-transparent border-[var(--accent-primary)] rounded-full animate-spin" />
                    <span class="text-sm" style={{ color: "var(--text-weak)" }}>
                      Loading call hierarchy...
                    </span>
                  </div>
                </div>
              </Show>

              <Show when={error()}>
                <div class="flex flex-col items-center justify-center py-12 gap-2">
                  <span class="text-sm" style={{ color: "var(--text-error, var(--cortex-error))" }}>
                    {error()}
                  </span>
                  <button
                    class="text-sm px-3 py-1.5 rounded transition-colors hover:bg-[var(--surface-hover)]"
                    style={{ color: "var(--accent-primary)" }}
                    onClick={handleRefresh}
                  >
                    Try Again
                  </button>
                </div>
              </Show>

              <Show when={!loading() && !error() && currentCalls().length === 0}>
                <div class="flex items-center justify-center py-12">
                  <span class="text-sm" style={{ color: "var(--text-weak)" }}>
                    {direction() === "incoming"
                      ? "No incoming calls found"
                      : "No outgoing calls found"}
                  </span>
                </div>
              </Show>

              <Show when={!loading() && !error() && currentCalls().length > 0}>
                <div class="py-2" role="tree" aria-label="Call hierarchy">
                  <For each={currentCalls()}>
                    {(item) => (
                      <CallHierarchyNode
                        item={item}
                        direction={direction()}
                        depth={0}
                        selectedId={selectedId()}
                        onSelect={handleSelect}
                        onToggleExpand={handleToggleExpand}
                        onNavigate={handleNavigate}
                        onPreview={handlePreview}
                      />
                    )}
                  </For>
                </div>
              </Show>
            </div>

            {/* Preview pane */}
            <div
              class="flex-1 flex flex-col overflow-hidden"
              style={{ "max-width": "45%", background: "var(--background-base)" }}
            >
              <div
                class="px-3 py-2 border-b flex items-center justify-between"
                style={{ "border-color": "var(--border-weak)" }}
              >
                <span class="text-xs font-medium" style={{ color: "var(--text-weak)" }}>
                  Preview
                </span>
                <Show when={preview()}>
                  <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                    {getFileName(preview()!.uri)}:{preview()!.range.start.line + 1}
                  </span>
                </Show>
              </div>

              <div class="flex-1 overflow-auto p-2">
                <Show when={preview()?.loading}>
                  <div class="flex items-center justify-center h-full">
                    <div class="w-4 h-4 border-2 border-t-transparent border-[var(--text-weak)] rounded-full animate-spin" />
                  </div>
                </Show>

                <Show when={preview() && !preview()!.loading && preview()!.content.length > 0}>
                  <pre
                    class="text-xs font-mono leading-relaxed"
                    style={{ color: "var(--text-base)" }}
                  >
                    <For each={preview()!.content as unknown as Array<{ lineNumber: number; content: string; isHighlighted: boolean }>}>
                      {(line) => (
                        <div
                          class="px-2 py-0.5"
                          style={{
                            background: line.isHighlighted
                              ? "var(--accent-primary-muted, rgba(59, 130, 246, 0.15))"
                              : "transparent",
                            "border-left": line.isHighlighted
                              ? "2px solid var(--accent-primary)"
                              : "2px solid transparent",
                          }}
                        >
                          <span
                            class="inline-block w-8 text-right mr-3 select-none"
                            style={{ color: "var(--text-weak)" }}
                          >
                            {line.lineNumber}
                          </span>
                          <span>{line.content}</span>
                        </div>
                      )}
                    </For>
                  </pre>
                </Show>

                <Show when={!preview()}>
                  <div class="flex items-center justify-center h-full">
                    <span class="text-sm" style={{ color: "var(--text-weak)" }}>
                      Hover over an item to preview
                    </span>
                  </div>
                </Show>
              </div>
            </div>
          </div>

          {/* Footer with keyboard hints */}
          <div
            class="flex items-center justify-between px-4 py-2 border-t text-xs"
            style={{ "border-color": "var(--border-weak)", color: "var(--text-weak)" }}
          >
            <div class="flex items-center gap-4">
              <span>
                <kbd class="px-1.5 py-0.5 rounded" style={{ background: "var(--surface-base)" }}>Enter</kbd>
                {" "}Navigate
              </span>
              <span>
                <kbd class="px-1.5 py-0.5 rounded" style={{ background: "var(--surface-base)" }}>Space</kbd>
                {" "}Expand/Collapse
              </span>
              <span>
                <kbd class="px-1.5 py-0.5 rounded" style={{ background: "var(--surface-base)" }}>Esc</kbd>
                {" "}Close
              </span>
            </div>
            <div>
              <span>
                {currentCalls().length} {direction() === "incoming" ? "caller(s)" : "callee(s)"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Hook for using Call Hierarchy
// ============================================================================

/**
 * Hook to manage call hierarchy state and visibility
 */
export function useCallHierarchy() {
  const [visible, setVisible] = createSignal(false);
  const [uri, setUri] = createSignal<string | undefined>();
  const [position, setPosition] = createSignal<Position | undefined>();
  const [initialDirection, setInitialDirection] = createSignal<CallHierarchyDirection | undefined>();

  const show = (fileUri: string, pos: Position, direction?: CallHierarchyDirection) => {
    setUri(fileUri);
    setPosition(pos);
    setInitialDirection(direction);
    setVisible(true);
  };

  const hide = () => {
    setVisible(false);
  };

  // Listen for global events
  onMount(() => {
    const handleShow = (e: CustomEvent<{ uri: string; position: Position; direction?: CallHierarchyDirection }>) => {
      show(e.detail.uri, e.detail.position, e.detail.direction);
    };

    window.addEventListener("call-hierarchy:show-at" as keyof WindowEventMap, handleShow as EventListener);
    onCleanup(() => window.removeEventListener("call-hierarchy:show-at" as keyof WindowEventMap, handleShow as EventListener));
  });

  return {
    visible,
    uri,
    position,
    initialDirection,
    show,
    hide,
  };
}

/**
 * Utility function to show call hierarchy from anywhere
 * @param uri - File URI
 * @param position - Cursor position in the file
 * @param direction - Optional initial direction ("incoming" or "outgoing")
 */
export function showCallHierarchy(uri: string, position: Position, direction?: CallHierarchyDirection): void {
  window.dispatchEvent(
    new CustomEvent("call-hierarchy:show-at", {
      detail: { uri, position, direction },
    })
  );
}

/**
 * Utility function to show incoming calls hierarchy
 */
export function showIncomingCalls(uri: string, position: Position): void {
  showCallHierarchy(uri, position, "incoming");
}

/**
 * Utility function to show outgoing calls hierarchy
 */
export function showOutgoingCalls(uri: string, position: Position): void {
  showCallHierarchy(uri, position, "outgoing");
}

// ============================================================================
// Standalone Call Hierarchy Panel (self-managed visibility)
// ============================================================================

/**
 * CallHierarchyPanel - A self-contained call hierarchy view that manages its own visibility.
 * Just render this component once in your app and it will respond to events.
 * 
 * Listens for:
 * - `call-hierarchy:show` - Show call hierarchy for current cursor position
 * - `call-hierarchy:show-at` - Show call hierarchy for specific URI/position/direction
 * 
 * Usage: Simply add <CallHierarchyPanel /> to your app once.
 */
export function CallHierarchyPanel() {
  const { state: editorState } = useEditor();
  const [visible, setVisible] = createSignal(false);
  const [uri, setUri] = createSignal<string | undefined>();
  const [position, setPosition] = createSignal<Position | undefined>();
  const [initialDirection, setInitialDirection] = createSignal<CallHierarchyDirection | undefined>();

  // Listen for show events
  onMount(() => {
    // Handler for `call-hierarchy:show` - uses current editor position
    const handleShow = (e: CustomEvent<{ direction?: CallHierarchyDirection }>) => {
      const activeFile = editorState.openFiles.find(f => f.id === editorState.activeFileId);
      if (!activeFile) return;

      // Get cursor position from Monaco editor
      const monacoEditor = (window as any).__monacoEditorInstance;
      if (!monacoEditor) return;

      const cursorPosition = monacoEditor.getPosition();
      if (!cursorPosition) return;

      const fileUri = `file://${activeFile.path.replace(/\\/g, "/")}`;
      setUri(fileUri);
      setPosition({
        line: cursorPosition.lineNumber - 1,
        character: cursorPosition.column - 1,
      });
      setInitialDirection(e.detail?.direction);
      setVisible(true);
    };

    // Handler for `call-hierarchy:show-at` - uses specified position
    const handleShowAt = (e: CustomEvent<{ uri: string; position: Position; direction?: CallHierarchyDirection }>) => {
      setUri(e.detail.uri);
      setPosition(e.detail.position);
      setInitialDirection(e.detail.direction);
      setVisible(true);
    };

    window.addEventListener("call-hierarchy:show" as keyof WindowEventMap, handleShow as EventListener);
    window.addEventListener("call-hierarchy:show-at" as keyof WindowEventMap, handleShowAt as EventListener);

    onCleanup(() => {
      window.removeEventListener("call-hierarchy:show" as keyof WindowEventMap, handleShow as EventListener);
      window.removeEventListener("call-hierarchy:show-at" as keyof WindowEventMap, handleShowAt as EventListener);
    });
  });

  const handleClose = () => {
    setVisible(false);
    setUri(undefined);
    setPosition(undefined);
    setInitialDirection(undefined);
  };

  return (
    <CallHierarchyView
      visible={visible()}
      onClose={handleClose}
      initialUri={uri()}
      initialPosition={position()}
      initialDirection={initialDirection()}
    />
  );
}

export default CallHierarchyView;

