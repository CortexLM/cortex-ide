/**
 * =============================================================================
 * WORKSPACE SYMBOLS PROVIDER - Quick Access Provider for '#' prefix
 * =============================================================================
 * 
 * Triggered by '#' prefix - searches symbols across the entire workspace
 * using LSP workspace/symbol request.
 * 
 * Features:
 * - Debounced search with configurable delay
 * - Minimum query length requirement (default 2 chars)
 * - Symbol kind icons and colors
 * - File path and container name display
 * - Fuzzy matching with highlights
 * - Navigate to symbol location on accept
 * 
 * @example
 * ```typescript
 * const provider = createWorkspaceSymbolsProvider({
 *   getLspContext: () => useLSP(),
 *   getProjectPath: () => getProjectPath(),
 *   openFile: (path) => editor.openFile(path),
 * });
 * ```
 */

import type { Component, JSX } from "solid-js";
import { Icon } from "../../components/ui/Icon";
import type { QuickAccessItem, QuickAccessProvider } from "./types";
import type { WorkspaceSymbolInfo, SymbolKind, Range } from "@/context/LSPContext";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for configuring the workspace symbols provider
 */
export interface WorkspaceSymbolsProviderOptions {
  /** Debounce delay in milliseconds (default: 200) */
  debounceMs?: number;
  /** Maximum number of results to return (default: 100) */
  maxResults?: number;
  /** Minimum query length before searching (default: 2) */
  minQueryLength?: number;
}

/**
 * Data associated with each workspace symbol item
 */
export interface WorkspaceSymbolData {
  /** File URI */
  uri: string;
  /** Symbol range in the file */
  range: Range;
  /** Symbol kind */
  kind: SymbolKind;
  /** Container name (e.g., class name for a method) */
  containerName?: string;
}

/**
 * Dependencies required by the provider
 */
export interface WorkspaceSymbolsProviderDependencies {
  /** Function to get workspace symbols from LSP */
  getWorkspaceSymbols: (projectPath: string, query: string) => Promise<{ symbols: WorkspaceSymbolInfo[] }>;
  /** Function to get the current project path */
  getProjectPath: () => string;
  /** Function to open a file at a specific location */
  openFileAtLocation: (uri: string, line: number, character: number) => void;
}

// =============================================================================
// Symbol Icons and Colors
// =============================================================================

/** Symbol icon configuration */
interface SymbolIconConfig {
  icon: Component<{ style?: JSX.CSSProperties }>;
  color: string;
}

/** Helper to create icon component */
const createIcon = (name: string): Component<{ style?: JSX.CSSProperties }> => {
  return (props: { style?: JSX.CSSProperties }) => Icon({ name, style: props.style });
};

/** Mapping from symbol kind to icon and color */
const SYMBOL_ICONS: Record<SymbolKind, SymbolIconConfig> = {
  file: { icon: createIcon("code"), color: "#71717a" },
  module: { icon: createIcon("m"), color: "#f59e0b" },
  namespace: { icon: createIcon("n"), color: "#8b5cf6" },
  package: { icon: createIcon("p"), color: "#f59e0b" },
  class: { icon: createIcon("c"), color: "#f59e0b" },
  method: { icon: createIcon("function"), color: "#a855f7" },
  property: { icon: createIcon("box"), color: "#06b6d4" },
  field: { icon: createIcon("f"), color: "#06b6d4" },
  constructor: { icon: createIcon("lambda"), color: "#a855f7" },
  enum: { icon: createIcon("e"), color: "#f59e0b" },
  interface: { icon: createIcon("i"), color: "#22c55e" },
  function: { icon: createIcon("function"), color: "#a855f7" },
  variable: { icon: createIcon("v"), color: "#3b82f6" },
  constant: { icon: createIcon("k"), color: "#3b82f6" },
  string: { icon: createIcon("s"), color: "#22c55e" },
  number: { icon: createIcon("hashtag"), color: "#22c55e" },
  boolean: { icon: createIcon("toggle-on"), color: "#22c55e" },
  array: { icon: createIcon("brackets-square"), color: "#f59e0b" },
  object: { icon: createIcon("brackets-curly"), color: "#f59e0b" },
  key: { icon: createIcon("k"), color: "#06b6d4" },
  null: { icon: createIcon("circle-dot"), color: "#71717a" },
  enumMember: { icon: createIcon("hashtag"), color: "#06b6d4" },
  struct: { icon: createIcon("s"), color: "#f59e0b" },
  event: { icon: createIcon("circle-dot"), color: "#ec4899" },
  operator: { icon: createIcon("o"), color: "#71717a" },
  typeParameter: { icon: createIcon("t"), color: "#22c55e" },
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert symbol kind to human-readable string
 */
export function symbolKindToString(kind: SymbolKind): string {
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
    typeParameter: "Type Parameter",
  };
  return labels[kind] || kind;
}

/**
 * Get icon component for a symbol kind
 */
export function symbolKindToIcon(kind: SymbolKind): Component<{ style?: JSX.CSSProperties }> {
  return SYMBOL_ICONS[kind]?.icon || createIcon("box");
}

/**
 * Get color for a symbol kind
 */
export function symbolKindToColor(kind: SymbolKind): string {
  return SYMBOL_ICONS[kind]?.color || "#71717a";
}

/**
 * Convert a file URI to a relative path
 */
export function getRelativePath(uri: string, projectPath?: string): string {
  // Remove file:// prefix
  let path = uri.replace(/^file:\/\/\/?/, "");
  
  // Normalize path separators
  path = path.replace(/\\/g, "/");
  
  // Handle Windows paths with drive letter (e.g., /C:/...)
  if (/^\/[A-Za-z]:/.test(path)) {
    path = path.slice(1);
  }
  
  // Make relative to project path if provided
  if (projectPath) {
    const normalizedProject = projectPath.replace(/\\/g, "/");
    if (path.toLowerCase().startsWith(normalizedProject.toLowerCase())) {
      path = path.slice(normalizedProject.length);
      if (path.startsWith("/")) {
        path = path.slice(1);
      }
    }
  }
  
  return path;
}

// =============================================================================
// Provider Implementation
// =============================================================================

/**
 * Create a workspace symbols provider for the Quick Access system
 */
export function createWorkspaceSymbolsProvider(
  dependencies: WorkspaceSymbolsProviderDependencies,
  options: WorkspaceSymbolsProviderOptions = {}
): QuickAccessProvider<WorkspaceSymbolData> {
  const {
    debounceMs = 200,
    maxResults = 100,
    minQueryLength = 2,
  } = options;

  const { getWorkspaceSymbols, getProjectPath, openFileAtLocation } = dependencies;

  // Debounce state
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let abortController: AbortController | null = null;
  let lastQuery = "";
  let cachedResults: QuickAccessItem<WorkspaceSymbolData>[] = [];

  /**
   * Provide items for the given query
   */
  const provideItems = async (query: string): Promise<QuickAccessItem<WorkspaceSymbolData>[]> => {
    // Clear previous debounce
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Cancel previous request
    if (abortController) {
      abortController.abort();
    }

    // Check minimum query length
    if (query.length < minQueryLength) {
      return [{
        id: "hint",
        label: `Type at least ${minQueryLength} characters to search...`,
        disabled: true,
        alwaysShow: true,
      }];
    }

    // Get project path
    const projectPath = getProjectPath();
    if (!projectPath) {
      return [{
        id: "no-project",
        label: "No project folder is open",
        description: "Open a folder to search for symbols",
        disabled: true,
        alwaysShow: true,
      }];
    }

    // Return cached results for same query while debouncing
    if (query === lastQuery && cachedResults.length > 0) {
      return cachedResults;
    }

    // Create new abort controller
    abortController = new AbortController();
    const signal = abortController.signal;

    // Debounce the actual request
    return new Promise((resolve) => {
      debounceTimer = setTimeout(async () => {
        try {
          const result = await getWorkspaceSymbols(projectPath, query);

          // Check if request was aborted
          if (signal.aborted) {
            resolve([]);
            return;
          }

          const symbols = result.symbols || [];
          
          // Transform to QuickAccessItems
          const items: QuickAccessItem<WorkspaceSymbolData>[] = symbols
            .slice(0, maxResults)
            .map((symbol, index) => {
              const relativePath = getRelativePath(symbol.location.uri, projectPath);
              
              return {
                id: `symbol-${index}-${symbol.name}`,
                label: symbol.name,
                description: symbolKindToString(symbol.kind),
                detail: symbol.containerName 
                  ? `${symbol.containerName} \u2022 ${relativePath}`
                  : relativePath,
                icon: symbolKindToIcon(symbol.kind),
                iconColor: symbolKindToColor(symbol.kind),
                data: {
                  uri: symbol.location.uri,
                  range: symbol.location.range,
                  kind: symbol.kind,
                  containerName: symbol.containerName,
                },
              };
            });

          // Handle empty results
          if (items.length === 0) {
            resolve([{
              id: "no-results",
              label: `No symbols found matching "${query}"`,
              description: "Try a different search term",
              disabled: true,
              alwaysShow: true,
            }]);
            return;
          }

          lastQuery = query;
          cachedResults = items;
          resolve(items);
        } catch (error) {
          if (signal.aborted) {
            resolve([]);
            return;
          }

          console.error("Workspace symbols provider error:", error);
          resolve([{
            id: "error",
            label: "Failed to fetch symbols",
            description: error instanceof Error ? error.message : "Unknown error",
            disabled: true,
            alwaysShow: true,
          }]);
        }
      }, debounceMs);
    });
  };

  /**
   * Handle item selection - navigate to symbol location
   */
  const onSelect = (item: QuickAccessItem<WorkspaceSymbolData>): void => {
    if (!item.data) {
      return;
    }

    const { uri, range } = item.data;
    const line = range.start.line;
    const character = range.start.character;

    openFileAtLocation(uri, line, character);
  };

  /**
   * Cleanup function to cancel pending operations
   */
  const cleanup = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    lastQuery = "";
    cachedResults = [];
  };

  return {
    id: "workspace-symbols",
    prefix: "#",
    name: "Go to Symbol in Workspace",
    description: "Search for symbols across all files in the workspace",
    placeholder: "Search workspace symbols...",
    provideItems,
    onSelect,
    // Expose cleanup for manual invocation if needed
    cleanup,
  } as QuickAccessProvider<WorkspaceSymbolData> & { cleanup: () => void };
}

// =============================================================================
// Default Export
// =============================================================================

export type { WorkspaceSymbolInfo };
export default createWorkspaceSymbolsProvider;
