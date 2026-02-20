import { createSignal, createEffect, For, Show, onMount, onCleanup, JSX, batch } from "solid-js";
import { useCommands } from "@/context/CommandContext";
import { useEditor } from "@/context/EditorContext";
import { useLSP, type Location } from "@/context/LSPContext";
import { Icon } from "./ui/Icon";
import { fsSearchContent, fsReadFile } from "../utils/tauri-api";
import { getProjectPath } from "../utils/workspace";

/**
 * Reference kinds based on LSP specification
 */
export type ReferenceKind = "read" | "write" | "declaration" | "unknown";

/**
 * Single reference entry
 */
export interface ReferenceEntry {
  id: string;
  uri: string;
  filePath: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
  kind: ReferenceKind;
}

/**
 * References grouped by file
 */
export interface FileReferences {
  filePath: string;
  displayPath: string;
  fileName: string;
  directory: string;
  references: ReferenceEntry[];
  expanded: boolean;
}

/**
 * Reference search result (for history)
 */
export interface ReferenceSearch {
  id: string;
  symbolName: string;
  timestamp: number;
  totalCount: number;
  fileCount: number;
  fileGroups: FileReferences[];
  sourceFile: string;
  sourceLine: number;
}

// Reference history storage
const MAX_HISTORY_ENTRIES = 20;
let referenceHistory: ReferenceSearch[] = [];

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Determine reference kind from context (simplified heuristic)
 */
function determineReferenceKind(lineContent: string, matchStart: number, matchEnd: number): ReferenceKind {
  const beforeMatch = lineContent.slice(0, matchStart).trim();
  const afterMatch = lineContent.slice(matchEnd).trim();

  // Check for declaration patterns
  const declarationPatterns = [
    /^(const|let|var|function|class|interface|type|enum)\s*$/,
    /^(pub\s+)?(fn|struct|enum|trait|impl|type|const|static|mod)\s*$/,
    /^(def|class|async\s+def)\s*$/,
    /^(func|type|var|const)\s*$/,
  ];

  for (const pattern of declarationPatterns) {
    if (pattern.test(beforeMatch)) {
      return "declaration";
    }
  }

  // Check for write patterns
  const writePatterns = [
    /=\s*$/,
    /^\s*=/,
    /\+=\s*$/,
    /-=\s*$/,
    /\*=\s*$/,
    /\/=\s*$/,
    /\+\+$/,
    /--$/,
    /^\s*\+\+/,
    /^\s*--/,
  ];

  if (beforeMatch.match(/=\s*$/) && !beforeMatch.match(/[=!<>]=\s*$/)) {
    return "write";
  }

  for (const pattern of writePatterns) {
    if (pattern.test(beforeMatch) || pattern.test(afterMatch)) {
      return "write";
    }
  }

  // Default to read
  return "read";
}

/**
 * Get icon for reference kind
 */
function getReferenceKindIcon(kind: ReferenceKind): JSX.Element {
  const iconProps = { class: "w-3 h-3 shrink-0" };

  switch (kind) {
    case "write":
      return <Icon name="pen-to-square" {...iconProps} style={{ color: "var(--cortex-warning)" }} />;
    case "declaration":
      return <Icon name="file" {...iconProps} style={{ color: "var(--cortex-success)" }} />;
    case "read":
      return <Icon name="eye" {...iconProps} style={{ color: "var(--cortex-info)" }} />;
    default:
      return <Icon name="eye" {...iconProps} style={{ color: "var(--text-weak)" }} />;
  }
}

/**
 * Highlight match in line content
 */
function highlightMatch(text: string, start: number, end: number): JSX.Element {
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeEnd = Math.max(safeStart, Math.min(end, text.length));

  return (
    <>
      <span>{text.slice(0, safeStart)}</span>
      <span
        style={{ 
          padding: "0 2px",
          "border-radius": "var(--cortex-radius-sm)",
          "font-weight": "500",
          background: "var(--accent-primary)", 
          color: "white" 
        }}
      >
        {text.slice(safeStart, safeEnd)}
      </span>
      <span>{text.slice(safeEnd)}</span>
    </>
  );
}

/**
 * Convert URI to file path
 */
function uriToPath(uri: string): string {
  if (uri.startsWith("file://")) {
    let path = uri.slice(7);
    // Handle Windows paths
    if (path.match(/^\/[A-Za-z]:/)) {
      path = path.slice(1);
    }
    return decodeURIComponent(path);
  }
  return uri;
}

/**
 * Get relative path from project root
 */
function getRelativePath(fullPath: string, projectPath: string): string {
  const normalizedFull = fullPath.replace(/\\/g, "/");
  const normalizedProject = projectPath.replace(/\\/g, "/");

  if (normalizedFull.startsWith(normalizedProject)) {
    let relative = normalizedFull.slice(normalizedProject.length);
    if (relative.startsWith("/")) {
      relative = relative.slice(1);
    }
    return relative;
  }
  return fullPath;
}

/**
 * Extract filename from path
 */
function getFileName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : path;
}

/**
 * Extract directory from path
 */
function getDirectory(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash > 0 ? normalized.slice(0, lastSlash) : "";
}

/**
 * Get file extension
 */
function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

/**
 * File type filters
 */
const FILE_TYPE_FILTERS = [
  { label: "All", extensions: [] },
  { label: "TypeScript", extensions: ["ts", "tsx", "mts", "cts"] },
  { label: "JavaScript", extensions: ["js", "jsx", "mjs", "cjs"] },
  { label: "Rust", extensions: ["rs"] },
  { label: "Python", extensions: ["py", "pyw", "pyi"] },
  { label: "Go", extensions: ["go"] },
  { label: "C/C++", extensions: ["c", "cpp", "cc", "h", "hpp"] },
  { label: "JSON", extensions: ["json", "jsonc"] },
];

/**
 * ReferencesView component - Shows all references to a symbol
 */
export function ReferencesView() {
  const commands = useCommands();
  const { openFile } = useEditor();
  const lsp = useLSP();

  // Panel visibility signal - controlled via events since CommandContext doesn't have it yet
  const [showReferencesView, setShowReferencesView] = createSignal(false);

  // Current search state
  const [currentSearch, setCurrentSearch] = createSignal<ReferenceSearch | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // History view
  const [showHistory, setShowHistory] = createSignal(false);
  const [history, setHistory] = createSignal<ReferenceSearch[]>(referenceHistory);

  // Filters
  const [searchQuery, setSearchQuery] = createSignal("");
  const [activeTypeFilter, setActiveTypeFilter] = createSignal(0);
  const [showReadRefs, setShowReadRefs] = createSignal(true);
  const [showWriteRefs, setShowWriteRefs] = createSignal(true);
  const [showDeclarations, setShowDeclarations] = createSignal(true);

  // UI state
  const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  let inputRef: HTMLInputElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  /**
   * Find references at cursor position
   */
  const findReferences = async (
    filePath: string,
    line: number,
    column: number,
    symbolName?: string
  ) => {
    setLoading(true);
    setError(null);
    setShowHistory(false);

    try {
      const projectPath = getProjectPath();

      // First try using LSP provider
      const server = lsp.getServerForFile(filePath);
      let locations: Location[] = [];

      if (server && server.status === "running") {
        try {
          const uri = `file://${filePath.replace(/\\/g, "/")}`;
          const result = await lsp.getReferences(server.id, uri, {
            line: line - 1,
            character: column - 1,
          });
          locations = result.locations || [];
        } catch (lspError) {
          console.debug("LSP references failed, falling back to text search:", lspError);
        }
      }

      // Fallback: If LSP failed or no LSP available, use text-based search
      if (locations.length === 0 && symbolName) {
        const searchResults = await searchTextReferences(projectPath, symbolName);
        locations = searchResults;
      }

      // Convert locations to reference entries
      const entries = await Promise.all(
        locations.map(async (loc) => {
          const fullPath = uriToPath(loc.uri);
          const relativePath = getRelativePath(fullPath, projectPath);
          const lineContent = await getLineContent(fullPath, loc.range.start.line);
          const matchStart = loc.range.start.character;
          const matchEnd = loc.range.end.character;

          return {
            id: generateId(),
            uri: loc.uri,
            filePath: relativePath,
            line: loc.range.start.line + 1,
            column: loc.range.start.character + 1,
            endLine: loc.range.end.line + 1,
            endColumn: loc.range.end.character + 1,
            lineContent: lineContent.trim(),
            matchStart: Math.max(0, matchStart - (lineContent.length - lineContent.trimStart().length)),
            matchEnd: Math.max(0, matchEnd - (lineContent.length - lineContent.trimStart().length)),
            kind: determineReferenceKind(lineContent, matchStart, matchEnd),
          } as ReferenceEntry;
        })
      );

      // Group by file
      const fileMap = new Map<string, ReferenceEntry[]>();
      for (const entry of entries) {
        const existing = fileMap.get(entry.filePath) || [];
        existing.push(entry);
        fileMap.set(entry.filePath, existing);
      }

      const fileGroups: FileReferences[] = Array.from(fileMap.entries()).map(
        ([filePath, refs]) => ({
          filePath,
          displayPath: filePath,
          fileName: getFileName(filePath),
          directory: getDirectory(filePath),
          references: refs.sort((a, b) => a.line - b.line),
          expanded: true,
        })
      );

      // Sort file groups by reference count (descending)
      fileGroups.sort((a, b) => b.references.length - a.references.length);

      // Create search result
      const searchResult: ReferenceSearch = {
        id: generateId(),
        symbolName: symbolName || "unknown",
        timestamp: Date.now(),
        totalCount: entries.length,
        fileCount: fileGroups.length,
        fileGroups,
        sourceFile: getRelativePath(filePath, projectPath),
        sourceLine: line,
      };

      // Add to history
      addToHistory(searchResult);

      // Update state
      batch(() => {
        setCurrentSearch(searchResult);
        setExpandedFiles(new Set(fileGroups.slice(0, 5).map((f) => f.filePath)));
        setSelectedIndex(0);
      });
    } catch (err) {
      console.error("Failed to find references:", err);
      setError(err instanceof Error ? err.message : "Failed to find references");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Search for text references using backend search
   */
  const searchTextReferences = async (
    projectPath: string,
    query: string
  ): Promise<Location[]> => {
    try {
      const response = await fsSearchContent({
        path: projectPath,
        pattern: `\\b${query}\\b`,
        regex: true,
        caseSensitive: true,
      });

      const locations: Location[] = [];
      for (const result of response.results) {
        for (const match of result.matches) {
          const matchEnd = match.column + query.length;
          locations.push({
            uri: `file://${result.file.replace(/\\/g, "/")}`,
            range: {
              start: { line: match.line - 1, character: match.column },
              end: { line: match.line - 1, character: matchEnd },
            },
          });
        }
      }

      return locations;
    } catch (err) {
      console.error("Text search failed:", err);
      return [];
    }
  };

  /**
   * Get line content from file
   */
  const getLineContent = async (filePath: string, line: number): Promise<string> => {
    try {
      const content = await fsReadFile(filePath);
      const lines = content.split("\n");
      return lines[line] || "";
    } catch {
      return "";
    }
  };

  /**
   * Add search to history
   */
  const addToHistory = (search: ReferenceSearch) => {
    referenceHistory = [
      search,
      ...referenceHistory.filter((s) => s.id !== search.id),
    ].slice(0, MAX_HISTORY_ENTRIES);
    setHistory([...referenceHistory]);
  };

  /**
   * Load search from history
   */
  const loadFromHistory = (search: ReferenceSearch) => {
    setCurrentSearch(search);
    setShowHistory(false);
    setExpandedFiles(new Set(search.fileGroups.slice(0, 5).map((f) => f.filePath)));
    setSelectedIndex(0);
  };

  /**
   * Remove single reference
   */
  const removeReference = (fileIndex: number, refIndex: number) => {
    const search = currentSearch();
    if (!search) return;

    const newFileGroups = [...search.fileGroups];
    const newRefs = [...newFileGroups[fileIndex].references];
    newRefs.splice(refIndex, 1);

    if (newRefs.length === 0) {
      newFileGroups.splice(fileIndex, 1);
    } else {
      newFileGroups[fileIndex] = {
        ...newFileGroups[fileIndex],
        references: newRefs,
      };
    }

    const newTotalCount = newFileGroups.reduce(
      (sum, fg) => sum + fg.references.length,
      0
    );

    setCurrentSearch({
      ...search,
      fileGroups: newFileGroups,
      totalCount: newTotalCount,
      fileCount: newFileGroups.length,
    });
  };

  /**
   * Clear all results
   */
  const clearResults = () => {
    setCurrentSearch(null);
    setSearchQuery("");
    setSelectedIndex(0);
  };

  /**
   * Toggle file expansion
   */
  const toggleFile = (filePath: string) => {
    const expanded = new Set(expandedFiles());
    if (expanded.has(filePath)) {
      expanded.delete(filePath);
    } else {
      expanded.add(filePath);
    }
    setExpandedFiles(expanded);
  };

  /**
   * Navigate to reference
   */
  const goToReference = async (ref: ReferenceEntry) => {
    const projectPath = getProjectPath();
    const fullPath = `${projectPath}/${ref.filePath}`;

    await openFile(fullPath);

    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("editor:goto-line", {
          detail: { line: ref.line, column: ref.column },
        })
      );
      // Also dispatch goto-line for compatibility
      window.dispatchEvent(
        new CustomEvent("goto-line", {
          detail: { line: ref.line, column: ref.column },
        })
      );
    }, 100);
  };

  /**
   * Filter references based on current filters
   */
  const getFilteredFileGroups = (): FileReferences[] => {
    const search = currentSearch();
    if (!search) return [];

    const query = searchQuery().toLowerCase();
    const typeFilter = FILE_TYPE_FILTERS[activeTypeFilter()];

    return search.fileGroups
      .map((fg) => {
        // Filter by file type
        if (typeFilter.extensions.length > 0) {
          const ext = getFileExtension(fg.fileName);
          if (!typeFilter.extensions.includes(ext)) {
            return null;
          }
        }

        // Filter references
        const filteredRefs = fg.references.filter((ref) => {
          // Filter by reference kind
          if (ref.kind === "read" && !showReadRefs()) return false;
          if (ref.kind === "write" && !showWriteRefs()) return false;
          if (ref.kind === "declaration" && !showDeclarations()) return false;

          // Filter by search query
          if (query) {
            const searchable = `${fg.filePath} ${ref.lineContent}`.toLowerCase();
            if (!searchable.includes(query)) return false;
          }

          return true;
        });

        if (filteredRefs.length === 0) return null;

        return {
          ...fg,
          references: filteredRefs,
        };
      })
      .filter((fg): fg is FileReferences => fg !== null);
  };

  /**
   * Get total filtered count
   */
  const getFilteredTotalCount = (): number => {
    return getFilteredFileGroups().reduce(
      (sum, fg) => sum + fg.references.length,
      0
    );
  };

  /**
   * Keyboard handler
   */
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!showReferencesView()) return;

    if (e.key === "Escape") {
      e.preventDefault();
      if (showHistory()) {
        setShowHistory(false);
      } else {
        setShowReferencesView(false);
      }
      return;
    }

    // Arrow navigation
    const fileGroups = getFilteredFileGroups();
    const flatRefs = fileGroups.flatMap((fg) =>
      expandedFiles().has(fg.filePath)
        ? fg.references.map((r) => ({ ...r, filePath: fg.filePath }))
        : []
    );

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatRefs.length - 1));
      scrollSelectedIntoView();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      scrollSelectedIntoView();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const ref = flatRefs[selectedIndex()];
      if (ref) {
        goToReference(ref);
      }
      return;
    }
  };

  const scrollSelectedIntoView = () => {
    setTimeout(() => {
      const selected = containerRef?.querySelector("[data-selected='true']");
      selected?.scrollIntoView({ block: "nearest" });
    }, 0);
  };

  // Event handlers defined at component level for proper cleanup
  const handleFindReferences = (e: CustomEvent) => {
    const { filePath, line, column, symbolName } = e.detail as {
      filePath: string;
      line: number;
      column: number;
      symbolName?: string;
    };
    setShowReferencesView(true);
    findReferences(filePath, line, column, symbolName);
  };

  const handleKeyboardShortcut = (e: KeyboardEvent) => {
    if (e.key === "F12" && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      // Request current editor position
      window.dispatchEvent(new CustomEvent("editor:request-find-references"));
    }
  };

  const handleToggle = () => {
    setShowReferencesView((v) => !v);
  };

  // Event listeners
  onMount(() => {
    // Register command
    commands.registerCommand({
      id: "find-all-references",
      label: "Find All References",
      shortcut: "Shift+F12",
      category: "Navigation",
      action: () => {
        window.dispatchEvent(new CustomEvent("editor:request-find-references"));
      },
    });

    window.addEventListener("references:find" as keyof WindowEventMap, handleFindReferences as EventListener);
    window.addEventListener("references:toggle" as keyof WindowEventMap, handleToggle);
    window.addEventListener("keydown", handleKeyboardShortcut);
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    commands.unregisterCommand("find-all-references");
    window.removeEventListener("references:find" as keyof WindowEventMap, handleFindReferences as EventListener);
    window.removeEventListener("references:toggle" as keyof WindowEventMap, handleToggle);
    window.removeEventListener("keydown", handleKeyboardShortcut);
    window.removeEventListener("keydown", handleKeyDown);
  });

  // Focus input when visible
  createEffect(() => {
    if (showReferencesView()) {
      setTimeout(() => inputRef?.focus(), 10);
    }
  });

  /**
   * Render toggle button for reference kind filter
   */
  const KindToggle = (props: {
    active: boolean;
    onClick: () => void;
    icon: JSX.Element;
    label: string;
    count: number;
  }) => (
    <button
      style={{
        display: "flex",
        "align-items": "center",
        gap: "6px",
        padding: "4px 8px",
        "font-size": "11px",
        "border-radius": "var(--cortex-radius-md)",
        transition: "all 0.15s ease",
        border: "none",
        cursor: "pointer",
        background: props.active ? "var(--surface-active)" : "transparent",
        color: props.active ? "var(--text-base)" : "var(--text-weak)",
        opacity: props.active ? 1 : 0.6,
      }}
      onClick={props.onClick}
      title={props.label}
    >
      {props.icon}
      <span style={{ display: "none" }}>{props.label}</span>
      <span
        style={{ 
          "font-size": "10px",
          padding: "0 4px",
          "border-radius": "var(--cortex-radius-sm)",
          background: "var(--background-base)" 
        }}
      >
        {props.count}
      </span>
    </button>
  );

  return (
    <Show when={showReferencesView()}>
      <div
        style={{
          position: "fixed",
          inset: "0",
          "z-index": "100",
          display: "flex",
          "animation-duration": "150ms"
        }}
        onClick={() => setShowReferencesView(false)}
      >
        {/* Backdrop */}
        <div style={{ position: "absolute", inset: "0", background: "rgba(0, 0, 0, 0.5)" }} />

        {/* Panel */}
        <div
          ref={containerRef}
          style={{
            position: "relative",
            "margin-left": "auto",
            width: "100%",
            "max-width": "560px",
            height: "100%",
            display: "flex",
            "flex-direction": "column",
            "box-shadow": "-10px 0 40px -10px rgba(0, 0, 0, 0.5)",
            background: "var(--surface-raised)",
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
              "flex-shrink": "0"
            }}
          >
            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
              <Show when={showHistory()}>
                <button
                  style={{
                    padding: "4px",
                    "border-radius": "var(--cortex-radius-sm)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    transition: "background 0.15s ease"
                  }}
                  onClick={() => setShowHistory(false)}
                  title="Back to results"
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <Icon name="arrow-left" style={{ width: "16px", height: "16px", color: "var(--text-weak)" }} />
                </button>
              </Show>
              <Icon name="magnifying-glass" style={{ width: "16px", height: "16px", color: "var(--text-weak)" }} />
              <span style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-base)" }}>
                {showHistory()
                  ? "Reference History"
                  : currentSearch()
                    ? `References: ${currentSearch()!.symbolName}`
                    : "Find All References"}
              </span>
            </div>
            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
              <Show when={!showHistory() && history().length > 0}>
                <button
                  style={{
                    padding: "6px",
                    "border-radius": "var(--cortex-radius-md)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    transition: "background 0.15s ease"
                  }}
                  onClick={() => setShowHistory(true)}
                  title="Show history"
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <Icon name="clock" style={{ width: "16px", height: "16px", color: "var(--text-weak)" }} />
                </button>
              </Show>
              <Show when={currentSearch() && !showHistory()}>
                <button
                  style={{
                    padding: "6px",
                    "border-radius": "var(--cortex-radius-md)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    transition: "background 0.15s ease"
                  }}
                  onClick={clearResults}
                  title="Clear results"
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <Icon name="trash" style={{ width: "16px", height: "16px", color: "var(--text-weak)" }} />
                </button>
              </Show>
              <button
                style={{
                  padding: "6px",
                  "border-radius": "var(--cortex-radius-md)",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  transition: "background 0.15s ease"
                }}
                onClick={() => setShowReferencesView(false)}
                title="Close (Escape)"
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <Icon name="xmark" style={{ width: "16px", height: "16px", color: "var(--text-weak)" }} />
              </button>
            </div>
          </div>

          {/* History View */}
          <Show when={showHistory()}>
            <div style={{ flex: "1", "overflow-y": "auto" }}>
              <Show when={history().length === 0}>
                <div style={{ padding: "32px 16px", "text-align": "center" }}>
                  <p style={{ "font-size": "13px", color: "var(--text-weak)" }}>
                    No reference searches in history
                  </p>
                </div>
              </Show>
              <For each={history()}>
                {(search) => (
                  <button
                    style={{
                      width: "100%",
                      display: "flex",
                      "align-items": "center",
                      gap: "12px",
                      padding: "12px 16px",
                      "text-align": "left",
                      transition: "background 0.15s ease",
                      "border-bottom": "1px solid var(--border-weak)",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer"
                    }}
                    onClick={() => loadFromHistory(search)}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <Icon name="magnifying-glass" style={{ width: "16px", height: "16px", "flex-shrink": "0", color: "var(--text-weak)" }} />
                    <div style={{ flex: "1", "min-width": "0" }}>
                      <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                        <span
                          style={{
                            "font-size": "13px",
                            "font-weight": "500",
                            overflow: "hidden",
                            "text-overflow": "ellipsis",
                            "white-space": "nowrap",
                            color: "var(--text-base)"
                          }}
                        >
                          {search.symbolName}
                        </span>
                        <span
                          style={{
                            "font-size": "11px",
                            padding: "2px 6px",
                            "border-radius": "var(--cortex-radius-md)",
                            background: "var(--surface-active)",
                            color: "var(--text-weak)",
                          }}
                        >
                          {search.totalCount} refs
                        </span>
                      </div>
                      <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-top": "2px" }}>
                        <span style={{ "font-size": "11px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", color: "var(--text-weak)" }}>
                          {search.sourceFile}:{search.sourceLine}
                        </span>
                        <span style={{ "font-size": "10px", color: "var(--text-weaker)" }}>
                          {new Date(search.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>

          {/* Results View */}
          <Show when={!showHistory()}>
            {/* Search and filters */}
            <div style={{ padding: "12px", "border-bottom": "1px solid var(--border-weak)", "flex-shrink": "0" }}>
              {/* Search input */}
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "8px",
                  padding: "0 12px",
                  height: "36px",
                  "border-radius": "var(--cortex-radius-md)",
                  background: "var(--background-base)"
                }}
              >
                <Icon name="filter" style={{ width: "16px", height: "16px", "flex-shrink": "0", color: "var(--text-weak)" }} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Filter results..."
                  style={{
                    flex: "1",
                    background: "transparent",
                    outline: "none",
                    border: "none",
                    "font-size": "13px",
                    "min-width": "0",
                    color: "var(--text-base)"
                  }}
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                />
                <Show when={loading()}>
                  <Icon name="spinner" style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite", color: "var(--text-weak)" }} />
                </Show>
              </div>

              {/* File type filter */}
              <div style={{ display: "flex", "align-items": "center", gap: "4px", "margin-top": "8px", "overflow-x": "auto" }}>
                <For each={FILE_TYPE_FILTERS}>
                  {(filter, index) => (
                    <button
                      style={{
                        padding: "4px 8px",
                        "font-size": "11px",
                        "border-radius": "var(--cortex-radius-md)",
                        "white-space": "nowrap",
                        transition: "all 0.15s ease",
                        border: "none",
                        cursor: "pointer",
                        background:
                          index() === activeTypeFilter()
                            ? "var(--accent-primary)"
                            : "var(--surface-active)",
                        color:
                          index() === activeTypeFilter() ? "white" : "var(--text-weak)",
                      }}
                      onClick={() => setActiveTypeFilter(index())}
                    >
                      {filter.label}
                    </button>
                  )}
                </For>
              </div>

              {/* Kind filters */}
              <Show when={currentSearch()}>
                <div style={{ display: "flex", "align-items": "center", gap: "4px", "margin-top": "8px" }}>
                  <KindToggle
                    active={showReadRefs()}
                    onClick={() => setShowReadRefs(!showReadRefs())}
                    icon={<Icon name="eye" style={{ width: "12px", height: "12px", color: "var(--cortex-info)" }} />}
                    label="Read"
                    count={
                      currentSearch()!.fileGroups.reduce(
                        (sum, fg) =>
                          sum + fg.references.filter((r) => r.kind === "read").length,
                        0
                      )
                    }
                  />
                  <KindToggle
                    active={showWriteRefs()}
                    onClick={() => setShowWriteRefs(!showWriteRefs())}
                    icon={<Icon name="pen-to-square" style={{ width: "12px", height: "12px", color: "var(--cortex-warning)" }} />}
                    label="Write"
                    count={
                      currentSearch()!.fileGroups.reduce(
                        (sum, fg) =>
                          sum + fg.references.filter((r) => r.kind === "write").length,
                        0
                      )
                    }
                  />
                  <KindToggle
                    active={showDeclarations()}
                    onClick={() => setShowDeclarations(!showDeclarations())}
                    icon={<Icon name="file" style={{ width: "12px", height: "12px", color: "var(--cortex-success)" }} />}
                    label="Declaration"
                    count={
                      currentSearch()!.fileGroups.reduce(
                        (sum, fg) =>
                          sum + fg.references.filter((r) => r.kind === "declaration").length,
                        0
                      )
                    }
                  />
                </div>
              </Show>
            </div>

            {/* Error message */}
            <Show when={error()}>
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
                {error()}
              </div>
            </Show>

            {/* Results count */}
            <Show when={currentSearch()}>
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "space-between",
                  padding: "8px 16px",
                  "font-size": "11px",
                  "border-bottom": "1px solid var(--border-weak)",
                  "flex-shrink": "0",
                  color: "var(--text-weak)",
                }}
              >
                <span>
                  {getFilteredTotalCount()} result
                  {getFilteredTotalCount() !== 1 ? "s" : ""} in{" "}
                  {getFilteredFileGroups().length} file
                  {getFilteredFileGroups().length !== 1 ? "s" : ""}
                </span>
                <span style={{ "font-size": "10px", color: "var(--text-weaker)" }}>
                  from {currentSearch()!.sourceFile}:{currentSearch()!.sourceLine}
                </span>
              </div>
            </Show>

            {/* Results list */}
            <div style={{ flex: "1", "overflow-y": "auto", "overscroll-behavior": "contain" }}>
              <Show when={!currentSearch() && !loading()}>
                <div style={{ padding: "32px 16px", "text-align": "center" }}>
                  <p style={{ "font-size": "13px", color: "var(--text-weak)" }}>
                    Place cursor on a symbol and press{" "}
                    <kbd
                      style={{
                        padding: "2px 6px",
                        "border-radius": "var(--cortex-radius-sm)",
                        "font-size": "11px",
                        "font-family": "'JetBrains Mono', monospace",
                        background: "var(--surface-active)"
                      }}
                    >
                      Shift+F12
                    </kbd>{" "}
                    to find all references
                  </p>
                </div>
              </Show>

              <Show when={loading()}>
                <div style={{ padding: "32px 16px", "text-align": "center" }}>
                  <Icon name="spinner"
                    style={{ 
                      width: "24px",
                      height: "24px",
                      animation: "spin 1s linear infinite",
                      margin: "0 auto 8px",
                      color: "var(--text-weak)" 
                    }}
                  />
                  <p style={{ "font-size": "13px", color: "var(--text-weak)" }}>
                    Finding references...
                  </p>
                </div>
              </Show>

              <Show when={currentSearch() && getFilteredFileGroups().length === 0 && !loading()}>
                <div style={{ padding: "32px 16px", "text-align": "center" }}>
                  <p style={{ "font-size": "13px", color: "var(--text-weak)" }}>
                    No references found matching filters
                  </p>
                </div>
              </Show>

              <For each={getFilteredFileGroups()}>
                {(fileGroup, fileIndex) => {
                  let flatIndex = 0;
                  for (let i = 0; i < fileIndex(); i++) {
                    const fg = getFilteredFileGroups()[i];
                    if (expandedFiles().has(fg.filePath)) {
                      flatIndex += fg.references.length;
                    }
                  }

                  return (
                    <div style={{ "border-bottom": "1px solid var(--border-weak)" }}>
                      {/* File header */}
                      <button
                        style={{
                          width: "100%",
                          display: "flex",
                          "align-items": "center",
                          gap: "8px",
                          padding: "0 16px",
                          height: "36px",
                          "text-align": "left",
                          transition: "background 0.15s ease",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer"
                        }}
                        onClick={() => toggleFile(fileGroup.filePath)}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <span style={{ "flex-shrink": "0", color: "var(--text-weak)" }}>
                          {expandedFiles().has(fileGroup.filePath) ? (
                            <Icon name="chevron-down" style={{ width: "14px", height: "14px" }} />
                          ) : (
                            <Icon name="chevron-right" style={{ width: "14px", height: "14px" }} />
                          )}
                        </span>
                        <Icon name="file"
                          style={{ width: "14px", height: "14px", "flex-shrink": "0", color: "var(--text-weak)" }}
                        />
                        <span
                          style={{
                            "font-size": "12px",
                            "font-weight": "500",
                            overflow: "hidden",
                            "text-overflow": "ellipsis",
                            "white-space": "nowrap",
                            color: "var(--text-base)"
                          }}
                        >
                          {fileGroup.fileName}
                        </span>
                        <Show when={fileGroup.directory}>
                          <span
                            style={{
                              "font-size": "11px",
                              overflow: "hidden",
                              "text-overflow": "ellipsis",
                              "white-space": "nowrap",
                              color: "var(--text-weaker)"
                            }}
                          >
                            {fileGroup.directory}
                          </span>
                        </Show>
                        <span
                          style={{
                            "margin-left": "auto",
                            "font-size": "10px",
                            padding: "2px 6px",
                            "border-radius": "var(--cortex-radius-md)",
                            "font-family": "'JetBrains Mono', monospace",
                            "flex-shrink": "0",
                            background: "var(--surface-active)",
                            color: "var(--text-weak)",
                          }}
                        >
                          {fileGroup.references.length}
                        </span>
                      </button>

                      {/* References */}
                      <Show when={expandedFiles().has(fileGroup.filePath)}>
                        <div style={{ "padding-bottom": "4px" }}>
                          <For each={fileGroup.references}>
                            {(ref, refIndex) => {
                              const currentFlatIndex = flatIndex + refIndex();
                              const isSelected = currentFlatIndex === selectedIndex();

                              return (
                                <div
                                  style={{
                                    display: "flex",
                                    "align-items": "flex-start",
                                    gap: "8px",
                                    padding: "6px 16px",
                                    "text-align": "left",
                                    transition: "background 0.15s ease",
                                    background: isSelected
                                      ? "var(--surface-active)"
                                      : "transparent",
                                  }}
                                  data-selected={isSelected}
                                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"; }}
                                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                                >
                                  <button
                                    style={{
                                      flex: "1",
                                      display: "flex",
                                      "align-items": "flex-start",
                                      gap: "8px",
                                      "text-align": "left",
                                      "min-width": "0",
                                      border: "none",
                                      background: "transparent",
                                      cursor: "pointer"
                                    }}
                                    onClick={() => goToReference(ref)}
                                  >
                                    {getReferenceKindIcon(ref.kind)}
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
                                      {ref.line}
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
                                      {highlightMatch(
                                        ref.lineContent,
                                        ref.matchStart,
                                        ref.matchEnd
                                      )}
                                    </span>
                                  </button>
                                  <button
                                    style={{
                                      "flex-shrink": "0",
                                      padding: "4px",
                                      "border-radius": "var(--cortex-radius-sm)",
                                      opacity: "0",
                                      transition: "all 0.15s ease",
                                      border: "none",
                                      background: "transparent",
                                      cursor: "pointer"
                                    }}
                                    onClick={() => removeReference(fileIndex(), refIndex())}
                                    title="Remove from results"
                                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "0"; e.currentTarget.style.background = "transparent"; }}
                                  >
                                    <Icon name="xmark"
                                      style={{ width: "12px", height: "12px", color: "var(--text-weak)" }}
                                    />
                                  </button>
                                </div>
                              );
                            }}
                          </For>
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>

            {/* Footer hints */}
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
                <kbd style={{ "font-family": "'JetBrains Mono', monospace" }}>↑↓</kbd> navigate •{" "}
                <kbd style={{ "font-family": "'JetBrains Mono', monospace" }}>Enter</kbd> go to
              </span>
              <span>
                <kbd style={{ "font-family": "'JetBrains Mono', monospace" }}>Shift+F12</kbd> find refs •{" "}
                <kbd style={{ "font-family": "'JetBrains Mono', monospace" }}>Esc</kbd> close
              </span>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}

/**
 * Trigger find references from external component
 */
export function triggerFindReferences(
  filePath: string,
  line: number,
  column: number,
  symbolName?: string
) {
  window.dispatchEvent(
    new CustomEvent("references:find", {
      detail: { filePath, line, column, symbolName },
    })
  );
}

/**
 * Toggle references view visibility
 */
export function toggleReferencesView() {
  window.dispatchEvent(new CustomEvent("references:toggle"));
}