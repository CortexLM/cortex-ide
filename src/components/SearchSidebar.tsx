import { createSignal, createEffect, createMemo, For, Show, onMount, onCleanup, JSX, batch } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useEditor } from "@/context/EditorContext";
import { useSearchSettings, useZenModeSettings } from "@/context/SettingsContext";
import { fsReadFile, fsWriteFile } from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";
import { Icon } from "@/components/ui/Icon";
import {
  type SearchResult,
  type SearchMatch,
  type SearchResultsViewMode,
  type TreeNode,
  buildSimpleTree,
  flattenTree,
  copyMatchText,
  copyFilePath,
  copyLine,
  copyFileMatches,
  copyAllResults,
  serializeToCodeSearch,
  generateCodeSearchFilename,
} from "@/utils/searchUtils";

// UI Kit imports
import { 
  SidebarHeader, 
  Input, 
  IconButton, 
  Badge, 
  Text, 
  EmptyState,
  LoadingSpinner,
  Button,
} from "@/components/ui";
import { ui, mergeStyles } from "@/lib/ui-kit";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Types
// ============================================================================

interface ParsedSearch {
  query: string;
  filters: {
    modified?: boolean;
    extensions?: string[];
    tags?: string[];
  };
}

// Filter autocomplete suggestions
const FILTER_SUGGESTIONS = [
  { filter: "@modified", description: "Show only modified/dirty files" },
  { filter: "@ext:", description: "Filter by file extension (e.g., @ext:ts,js)" },
  { filter: "@tag:", description: "Filter by symbol tags (e.g., @tag:deprecated)" },
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parses search query to extract special filters (@modified, @ext:, @tag:)
 */
function parseSearchQuery(input: string): ParsedSearch {
  const filters: ParsedSearch['filters'] = {};
  let query = input;
  
  // @modified - show only modified/dirty files
  if (query.includes('@modified')) {
    filters.modified = true;
    query = query.replace(/@modified/g, '').trim();
  }
  
  // @ext:ts,js - filter by file extension
  const extMatch = query.match(/@ext:(\S+)/);
  if (extMatch) {
    filters.extensions = extMatch[1].split(',').map(ext => ext.trim().toLowerCase());
    query = query.replace(extMatch[0], '').trim();
  }
  
  // @tag:deprecated,experimental - filter by symbol tags
  const tagMatch = query.match(/@tag:(\S+)/);
  if (tagMatch) {
    filters.tags = tagMatch[1].split(',').map(tag => tag.trim().toLowerCase());
    query = query.replace(tagMatch[0], '').trim();
  }
  
  // Clean up multiple spaces
  query = query.replace(/\s+/g, ' ').trim();
  
  return { query, filters };
}

function highlightMatch(text: string, start: number, end: number): JSX.Element {
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeEnd = Math.max(safeStart, Math.min(end, text.length));
  
  return (
    <>
      <span style={{ color: tokens.colors.text.primary }}>{text.slice(0, safeStart)}</span>
      <span 
        style={{ 
          background: "var(--cortex-search-match)",
          "border-radius": tokens.radius.sm,
          color: tokens.colors.text.primary,
          "font-weight": "500",
          padding: "0 2px",
        }}
      >
        {text.slice(safeStart, safeEnd)}
      </span>
      <span style={{ color: tokens.colors.text.primary }}>{text.slice(safeEnd)}</span>
    </>
  );
}

function getFileDirectory(path: string): string {
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return lastSlash > 0 ? path.slice(0, lastSlash) : "";
}

function getFileName(path: string): string {
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
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

// ============================================================================
// Toggle Button Component
// ============================================================================

function ToggleButton(props: { 
  active: boolean; 
  onClick: () => void; 
  title: string; 
  children: string;
}) {
  return (
    <IconButton
      active={props.active}
      onClick={props.onClick}
      tooltip={props.title}
      size="sm"
    >
      <span style={{ 
        "font-size": "var(--jb-text-muted-size)", 
        "font-weight": "500" 
      }}>
        {props.children}
      </span>
    </IconButton>
  );
}

// ============================================================================
// Search Sidebar Component
// ============================================================================

export function SearchSidebar() {
  const { openFile, updateFileContent, state: editorState } = useEditor();
  const { settings: searchSettings } = useSearchSettings();
  const { settings: zenModeSettings } = useZenModeSettings();
  
  // Helper to check if line numbers should be shown (default: true)
  const showLineNumbers = () => zenModeSettings()?.showLineNumbers ?? true;
  
  // Search state
  const [query, setQuery] = createSignal("");
  const [replaceText, setReplaceText] = createSignal("");
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  
  // Search options
  const [caseSensitive, setCaseSensitive] = createSignal(false);
  const [wholeWord, setWholeWord] = createSignal(false);
  const [useRegex, setUseRegex] = createSignal(false);
  const [preserveCase, setPreserveCase] = createSignal(false);
  const [searchOpenEditorsOnly, setSearchOpenEditorsOnly] = createSignal(false);
  
  // Context lines - file content cache for displaying surrounding lines
  const [fileContentCache, setFileContentCache] = createSignal<Record<string, string[]>>({});
  
  // Filter autocomplete state
  const [showFilterSuggestions, setShowFilterSuggestions] = createSignal(false);
  const [filterSuggestionIndex, setFilterSuggestionIndex] = createSignal(0);
  
  // Get filtered suggestions based on current input
  const getFilteredSuggestions = () => {
    const q = query();
    const atIndex = q.lastIndexOf('@');
    if (atIndex === -1) return [];
    
    const filterText = q.slice(atIndex).toLowerCase();
    return FILTER_SUGGESTIONS.filter(s => 
      s.filter.toLowerCase().startsWith(filterText) && s.filter.toLowerCase() !== filterText
    );
  };
  
  // Helper to check if a file is dirty/modified
  const isDirtyFile = (relativePath: string): boolean => {
    const projectPath = getProjectPath();
    if (!projectPath) return false;
    
    const normalizedProjectPath = projectPath.replace(/\\/g, "/").replace(/\/$/, "");
    const normalizedRelativePath = relativePath.replace(/\\/g, "/");
    const fullPath = `${normalizedProjectPath}/${normalizedRelativePath}`;
    
    return editorState.openFiles.some(f => {
      const normalizedFilePath = f.path.replace(/\\/g, "/");
      return normalizedFilePath === fullPath && f.modified;
    });
  };
  
  // Helper to get relative paths of open files
  const getOpenFileRelativePaths = () => {
    const projectPath = getProjectPath();
    if (!projectPath) return new Set<string>();
    
    const normalizedProjectPath = projectPath.replace(/\\/g, "/").replace(/\/$/, "");
    return new Set(
      editorState.openFiles
        .filter(f => !f.path.startsWith("virtual:///"))
        .map(f => {
          const normalizedPath = f.path.replace(/\\/g, "/");
          if (normalizedPath.startsWith(normalizedProjectPath + "/")) {
            return normalizedPath.slice(normalizedProjectPath.length + 1);
          }
          return normalizedPath;
        })
    );
  };
  
  // Filter patterns
  const [includePattern, setIncludePattern] = createSignal("");
  const [excludePattern, setExcludePattern] = createSignal("node_modules, .git, dist, build");
  const [showFilters, setShowFilters] = createSignal(false);
  
  // UI state
  const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(new Set());
  const [showReplace, setShowReplace] = createSignal(true);
  const [viewMode, setViewMode] = createSignal<SearchResultsViewMode>('list');
  const [expandedTreePaths, setExpandedTreePaths] = createSignal<Set<string>>(new Set());
  const [showCopyMenu, setShowCopyMenu] = createSignal(false);
  const [contextMenu, setContextMenu] = createSignal<{
    visible: boolean;
    x: number;
    y: number;
    file: string | null;
    match: SearchMatch | null;
  }>({ visible: false, x: 0, y: 0, file: null, match: null });
  
  // Virtual scrolling state
  const [scrollTop, setScrollTop] = createSignal(0);
  const [containerHeight, setContainerHeight] = createSignal(400);
  const ITEM_HEIGHT = 24; // Height of each search result row
  const BUFFER_SIZE = 10; // Extra items to render above/below viewport
  
  // Flatten all results for virtual list (file headers + matches + context lines)
  type FlatItem = 
    | { type: 'file'; file: string; matchCount: number } 
    | { type: 'match'; match: SearchMatch; file: string }
    | { type: 'context'; line: number; text: string; file: string };
  
  const flatResults = createMemo((): FlatItem[] => {
    const items: FlatItem[] = [];
    const expanded = expandedFiles();
    const contextCount = searchSettings()?.contextLines ?? 2;
    const cache = fileContentCache();
    
    results().forEach((result) => {
      items.push({ type: 'file', file: result.file, matchCount: result.matches.length });
      if (expanded.has(result.file)) {
        const fileLines = cache[result.file];
        
        result.matches.forEach((match, matchIndex) => {
          // Add context lines before (if enabled and file content loaded)
          if (contextCount > 0 && fileLines) {
            const startLine = Math.max(0, match.line - 1 - contextCount);
            // Avoid duplicating lines from previous match's after-context
            const prevMatch = matchIndex > 0 ? result.matches[matchIndex - 1] : null;
            const prevEnd = prevMatch ? Math.min(fileLines.length - 1, prevMatch.line - 1 + contextCount) : -1;
            
            for (let i = startLine; i < match.line - 1; i++) {
              if (i > prevEnd) { // Only add if not already shown as after-context of previous match
                items.push({ type: 'context', line: i + 1, text: fileLines[i] || '', file: result.file });
              }
            }
          }
          
          // Add the match itself
          items.push({ type: 'match', match, file: result.file });
          
          // Add context lines after (if enabled and file content loaded)
          if (contextCount > 0 && fileLines) {
            const endLine = Math.min(fileLines.length - 1, match.line - 1 + contextCount);
            // Don't add lines that will be before-context of next match
            const nextMatch = matchIndex < result.matches.length - 1 ? result.matches[matchIndex + 1] : null;
            const nextStart = nextMatch ? Math.max(0, nextMatch.line - 1 - contextCount) : fileLines.length;
            
            for (let i = match.line; i <= endLine; i++) {
              if (i < nextStart - 1) { // Only add if not going to be shown as before-context of next match
                items.push({ type: 'context', line: i + 1, text: fileLines[i] || '', file: result.file });
              }
            }
          }
        });
      }
    });
    return items;
  });
  
  // Build tree view from results
  const resultsTree = createMemo(() => {
    if (viewMode() === 'list') return [];
    return buildSimpleTree(results());
  });
  
  // Flatten tree for rendering
  const flatTreeItems = createMemo(() => {
    if (viewMode() === 'list') return [];
    return flattenTree(resultsTree(), expandedTreePaths());
  });
  
  // Calculate visible range
  const visibleRange = createMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop() / ITEM_HEIGHT) - BUFFER_SIZE);
    const visibleCount = Math.ceil(containerHeight() / ITEM_HEIGHT) + BUFFER_SIZE * 2;
    const end = Math.min(flatResults()?.length ?? 0, start + visibleCount);
    return { start, end };
  });
  
  // Get visible items only
  const visibleItems = createMemo(() => {
    const { start, end } = visibleRange();
    return flatResults().slice(start, end);
  });
  
  // Total height for scroll container
  const totalHeight = createMemo(() => (flatResults()?.length ?? 0) * ITEM_HEIGHT);
  
  // Scroll handler
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement;
    setScrollTop(target.scrollTop);
  };
  
  let inputRef: HTMLInputElement | undefined;
  let resultsContainerRef: HTMLDivElement | undefined;
  let searchTimeout: number | undefined;
  let abortController: AbortController | null = null;

  // Focus input on mount and setup ResizeObserver for virtual scrolling
  onMount(() => {
    setTimeout(() => inputRef?.focus(), 100);
    
    // ResizeObserver for container height (for virtual scrolling)
    if (resultsContainerRef) {
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          setContainerHeight(entry.contentRect.height);
        }
      });
      observer.observe(resultsContainerRef);
      onCleanup(() => observer.disconnect());
    }
  });

  // Debounced search
  createEffect(() => {
    const q = query();
    const cs = caseSensitive();
    const re = useRegex();
    const ww = wholeWord();
    const inc = includePattern();
    const exc = excludePattern();
    
    // Track all dependencies
    void q; void cs; void re; void ww; void inc; void exc;
    
    clearTimeout(searchTimeout);
    
    // Show filter suggestions when typing @
    const suggestions = getFilteredSuggestions();
    if (q.includes('@') && suggestions.length > 0) {
      setShowFilterSuggestions(true);
      setFilterSuggestionIndex(0);
    } else {
      setShowFilterSuggestions(false);
    }
    
    // Parse query to check minimum length requirement
    const { query: actualQuery, filters } = parseSearchQuery(q);
    const hasFilters = filters.modified || filters.extensions?.length || filters.tags?.length;
    
    // Need at least 1 char in actual query, or have filters
    if (actualQuery.length < 1 && !hasFilters) {
      batch(() => {
        setResults([]);
        setSearchError(null);
      });
      return;
    }
    
    searchTimeout = window.setTimeout(() => {
      performSearch(q);
    }, 300);
  });

  onCleanup(() => {
    cancelSearch();
    clearTimeout(searchTimeout);
  });

  const cancelSearch = () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    setLoading(false);
  };

  const performSearch = async (searchQuery: string) => {
    cancelSearch();
    abortController = new AbortController();
    
    setLoading(true);
    setSearchError(null);
    
    // Hide filter suggestions when searching
    setShowFilterSuggestions(false);
    
    try {
      const projectPath = getProjectPath();
      
      if (!projectPath) {
        setSearchError("No project open");
        setLoading(false);
        return;
      }
      
      // Parse query to extract special filters
      const { query: actualQuery, filters } = parseSearchQuery(searchQuery);
      
      // If only filters with no actual query, require at least @modified to proceed
      if (!actualQuery && !filters.modified && !filters.extensions?.length) {
        setSearchError("Enter a search query or use @modified filter");
        setLoading(false);
        return;
      }
      
      const searchResponse = await invoke<{ results: SearchResult[]; totalMatches: number; filesSearched: number }>("fs_search_content", {
        path: projectPath,
        query: actualQuery || ".",  // Use "." as wildcard if only using filters
        caseSensitive: caseSensitive(),
        regex: actualQuery ? useRegex() : true,  // Force regex mode for wildcard
        wholeWord: actualQuery ? wholeWord() : false,
        include: includePattern() || undefined,
        exclude: excludePattern() || undefined,
        maxResults: 20000,
      });
      
      // Check if search was aborted while waiting for results
      if (abortController?.signal.aborted) {
        return;
      }
      
      let searchResults = searchResponse.results || [];
      
      // Apply @modified filter - show only dirty/modified files
      if (filters.modified) {
        searchResults = searchResults.filter(r => isDirtyFile(r.file));
      }
      
      // Apply @ext: filter - filter by file extension
      if (filters.extensions && filters.extensions.length > 0) {
        searchResults = searchResults.filter(r => {
          const fileName = r.file.toLowerCase();
          return filters.extensions!.some(ext => fileName.endsWith(`.${ext}`));
        });
      }
      
      // Apply @tag: filter - filter by symbol tags (searches for tag in file content)
      // Note: This is a simplified implementation that looks for tag patterns in matches
      if (filters.tags && filters.tags.length > 0) {
        searchResults = searchResults.filter(r => {
          // Check if any match contains a tag pattern like @deprecated, @experimental, etc.
          return r.matches.some(m => 
            filters.tags!.some(tag => 
              m.text.toLowerCase().includes(`@${tag}`) || 
              m.text.toLowerCase().includes(`${tag}:`) ||
              m.text.toLowerCase().includes(`[${tag}]`)
            )
          );
        });
      }
      
      // Filter by open editors if enabled
      if (searchOpenEditorsOnly()) {
        const openFilePaths = getOpenFileRelativePaths();
        searchResults = searchResults.filter(r => {
          // Normalize the result path for comparison
          const normalizedResultPath = r.file.replace(/\\/g, "/");
          return openFilePaths.has(normalizedResultPath);
        });
      }
      
      batch(() => {
        setResults(searchResults);
        // Auto-expand first 3 files for sidebar (narrower space)
        const expanded = new Set<string>();
        searchResults.slice(0, 3).forEach((r: SearchResult) => expanded.add(r.file));
        setExpandedFiles(expanded);
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      console.error("Search failed:", err);
      setSearchError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleFile = async (file: string) => {
    const expanded = new Set(expandedFiles());
    if (expanded.has(file)) {
      expanded.delete(file);
    } else {
      expanded.add(file);
      // Load file content for context lines if needed
      if ((searchSettings()?.contextLines ?? 2) > 0 && !fileContentCache()[file]) {
        await loadFileContent(file);
      }
    }
    setExpandedFiles(expanded);
  };

  // Load file content for context lines display
  const loadFileContent = async (relativePath: string) => {
    const projectPath = getProjectPath();
    if (!projectPath) return;
    
    const fullPath = `${projectPath}/${relativePath}`;
    try {
      const content = await fsReadFile(fullPath);
      const lines = content.split('\n');
      setFileContentCache(prev => ({ ...prev, [relativePath]: lines }));
    } catch (err) {
      console.error(`Failed to load file content for context: ${relativePath}`, err);
    }
  };

  const collapseAll = () => {
    setExpandedFiles(new Set<string>());
  };

  const expandAll = () => {
    const expanded = new Set<string>();
    results().forEach(r => expanded.add(r.file));
    setExpandedFiles(expanded);
  };
  
  // Tree view toggle functions
  const toggleViewMode = () => {
    setViewMode(v => v === 'list' ? 'tree' : 'list');
  };
  
  const toggleTreeNode = (path: string) => {
    const expanded = new Set(expandedTreePaths());
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }
    setExpandedTreePaths(expanded);
  };
  
  const expandAllTree = () => {
    const expanded = new Set<string>();
    const addPaths = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'folder' || node.type === 'file') {
          expanded.add(node.path);
        }
        if (node.children) {
          addPaths(node.children);
        }
      }
    };
    addPaths(resultsTree());
    setExpandedTreePaths(expanded);
  };
  
  const collapseAllTree = () => {
    setExpandedTreePaths(new Set<string>());
  };
  
  // Context menu handlers
  const handleContextMenu = (e: MouseEvent, file: string | null, match: SearchMatch | null) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      file,
      match,
    });
  };
  
  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  };
  
  // Copy handlers
  const handleCopyMatch = async () => {
    const ctx = contextMenu();
    if (ctx.match) {
      await copyMatchText(ctx.match);
      showNotification("success", "Copied match text");
    }
    closeContextMenu();
  };
  
  const handleCopyLine = async () => {
    const ctx = contextMenu();
    if (ctx.match) {
      await copyLine(ctx.match);
      showNotification("success", "Copied full line");
    }
    closeContextMenu();
  };
  
  const handleCopyFilePath = async () => {
    const ctx = contextMenu();
    if (ctx.file) {
      const projectPath = getProjectPath();
      const fullPath = projectPath ? `${projectPath}/${ctx.file}` : ctx.file;
      await copyFilePath(fullPath);
      showNotification("success", "Copied file path");
    }
    closeContextMenu();
  };
  
  const handleCopyRelativePath = async () => {
    const ctx = contextMenu();
    if (ctx.file) {
      await copyFilePath(ctx.file);
      showNotification("success", "Copied relative path");
    }
    closeContextMenu();
  };
  
  const handleCopyFileMatches = async () => {
    const ctx = contextMenu();
    if (ctx.file) {
      const result = results().find(r => r.file === ctx.file);
      if (result) {
        await copyFileMatches(ctx.file, result.matches, {
          includeLineNumbers: true,
          includeFilePaths: true,
          format: 'plain',
        });
        showNotification("success", "Copied file matches");
      }
    }
    closeContextMenu();
  };
  
  const handleCopyAllResults = async (format: 'plain' | 'markdown' | 'json') => {
    await copyAllResults(results(), {
      includeLineNumbers: true,
      includeFilePaths: true,
      format,
    });
    showNotification("success", `Copied all results as ${format}`);
    setShowCopyMenu(false);
  };
  
  // Save results as .code-search file
  const handleSaveResults = async () => {
    const content = serializeToCodeSearch({
      query: query(),
      isRegex: useRegex(),
      isCaseSensitive: caseSensitive(),
      isWholeWord: wholeWord(),
      includePattern: includePattern(),
      excludePattern: excludePattern(),
      contextLines: searchSettings()?.contextLines ?? 2,
      results: results(),
    });
    
    const filename = generateCodeSearchFilename(query());
    const projectPath = getProjectPath();
    if (projectPath) {
      try {
        await fsWriteFile(`${projectPath}/${filename}`, content);
        showNotification("success", `Saved search results to ${filename}`);
      } catch (err) {
        console.error("Failed to save search results:", err);
        showNotification("error", "Failed to save search results");
      }
    }
  };
  
  const showNotification = (type: "success" | "error" | "warning", message: string) => {
    window.dispatchEvent(new CustomEvent("notification", { 
      detail: { type, message } 
    }));
  };
  
  // Close context menu on click outside
  onMount(() => {
    const handleClick = () => closeContextMenu();
    window.addEventListener("click", handleClick);
    onCleanup(() => window.removeEventListener("click", handleClick));
  });

  const openMatch = async (file: string, line: number, column: number) => {
    const projectPath = getProjectPath();
    // Check if file is already an absolute path (starts with drive letter on Windows or / on Unix)
    const isAbsolutePath = /^[a-zA-Z]:[\\/]/.test(file) || file.startsWith('/');
    const fullPath = isAbsolutePath ? file : (projectPath ? `${projectPath}/${file}` : file);
    
    // Check if the file is already open and active
    const normalizedFullPath = fullPath.replace(/\\/g, '/');
    const activeFile = editorState.openFiles.find(f => f.id === editorState.activeFileId);
    const isAlreadyActive = activeFile && activeFile.path.replace(/\\/g, '/') === normalizedFullPath;
    
    if (isAlreadyActive) {
      // File is already active, just navigate to line
      window.dispatchEvent(new CustomEvent("goto-line", { 
        detail: { line, column }
      }));
      return;
    }
    
    // Listen for editor:file-ready event before navigating to line
    let handled = false;
    const handleEditorReady = (e: CustomEvent<{ filePath: string }>) => {
      if (handled) return;
      // Normalize paths for comparison (handle both / and \ separators)
      const eventPath = e.detail.filePath.replace(/\\/g, '/');
      if (eventPath === normalizedFullPath) {
        handled = true;
        window.removeEventListener("editor:file-ready", handleEditorReady as EventListener);
        window.dispatchEvent(new CustomEvent("goto-line", { 
          detail: { line, column }
        }));
      }
    };
    
    window.addEventListener("editor:file-ready", handleEditorReady as EventListener);
    
    await openFile(fullPath);
    
    // Fallback timeout in case the event doesn't fire
    setTimeout(() => {
      if (!handled) {
        handled = true;
        window.removeEventListener("editor:file-ready", handleEditorReady as EventListener);
        window.dispatchEvent(new CustomEvent("goto-line", { 
          detail: { line, column }
        }));
      }
    }, 300);
  };

  const replaceInFile = async (filePath: string) => {
    const projectPath = getProjectPath();
    const fullPath = projectPath ? `${projectPath}/${filePath}` : filePath;
    
    try {
      const content = await fsReadFile(fullPath);
      
      let pattern = query();
      if (!useRegex()) {
        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
      if (wholeWord()) {
        pattern = `\\b${pattern}\\b`;
      }
      
      const flags = caseSensitive() ? "g" : "gi";
      const regex = new RegExp(pattern, flags);
      const replacement = replaceText();
      const newContent = content.replace(regex, (match) => {
        return preserveCase() ? applyPreserveCase(match, replacement) : replacement;
      });
      
      await fsWriteFile(fullPath, newContent);
      
      const openFileEntry = editorState.openFiles.find(f => f.path === fullPath);
      if (openFileEntry) {
        updateFileContent(openFileEntry.id, newContent);
      }
      
      return true;
    } catch (err) {
      console.error(`Failed to replace in ${filePath}:`, err);
      return false;
    }
  };

  const replaceInAllFiles = async () => {
    const allResults = results();
    if (allResults.length === 0) return;
    
    setLoading(true);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const result of allResults) {
      const success = await replaceInFile(result.file);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }
    
    await performSearch(query());
    
    setLoading(false);
    
    const message = failCount > 0 
      ? `Replaced in ${successCount} files, ${failCount} failed`
      : `Replaced in ${successCount} files`;
    window.dispatchEvent(new CustomEvent("notification", { 
      detail: { type: failCount > 0 ? "warning" : "success", message } 
    }));
  };

  const totalMatches = () => {
    return results().reduce((sum, r) => sum + r.matches.length, 0);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setSearchError(null);
    setShowFilterSuggestions(false);
    inputRef?.focus();
  };

  // Insert filter suggestion into query
  const insertFilterSuggestion = (filter: string) => {
    const q = query();
    const atIndex = q.lastIndexOf('@');
    if (atIndex >= 0) {
      const newQuery = q.slice(0, atIndex) + filter + (filter.endsWith(':') ? '' : ' ');
      setQuery(newQuery);
    } else {
      setQuery(q + filter + (filter.endsWith(':') ? '' : ' '));
    }
    setShowFilterSuggestions(false);
    inputRef?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Handle filter suggestions navigation
    if (showFilterSuggestions()) {
      const suggestions = getFilteredSuggestions();
      if (suggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setFilterSuggestionIndex(i => Math.min(i + 1, suggestions.length - 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setFilterSuggestionIndex(i => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          insertFilterSuggestion(suggestions[filterSuggestionIndex()].filter);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowFilterSuggestions(false);
          return;
        }
      }
    }
    
    if (e.key === "Enter" && !e.shiftKey && !loading()) {
      e.preventDefault();
      performSearch(query());
    }
    if (e.key === "Escape") {
      if (query()) {
        clearSearch();
      }
    }
  };

  // Styles using ui presets
  const inputRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    padding: tokens.spacing.sm,
    background: tokens.colors.surface.panel,
    border: `1px solid ${tokens.colors.border.default}`,
    "border-radius": tokens.radius.sm,
  };

  const inputInnerStyle: JSX.CSSProperties = {
    flex: "1",
    "min-width": "0",
    background: "transparent",
    border: "none",
    outline: "none",
    "font-size": "var(--jb-text-body-size)",
    color: tokens.colors.text.primary,
  };

  const fileRowStyle = (isExpanded: boolean): JSX.CSSProperties => ({
    width: "100%",
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    "text-align": "left",
    cursor: "pointer",
    border: "none",
    height: `${ITEM_HEIGHT}px`,
    "font-weight": "600",
    background: isExpanded ? tokens.colors.interactive.selected : "transparent",
    transition: "background var(--cortex-transition-fast)",
  });

  const matchRowStyle: JSX.CSSProperties = {
    width: "100%",
    display: "flex",
    "align-items": "flex-start",
    padding: `2px ${tokens.spacing.md} 2px 24px`,
    "text-align": "left",
    cursor: "pointer",
    background: "transparent",
    border: "none",
    height: `${ITEM_HEIGHT}px`,
    "font-size": "var(--jb-text-muted-size)",
    transition: "background var(--cortex-transition-fast)",
  };

  const contextRowStyle: JSX.CSSProperties = {
    ...matchRowStyle,
    opacity: "0.5",
  };

  const contextMenuItemStyle: JSX.CSSProperties = {
    width: "100%",
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.md,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    "text-align": "left",
    border: "none",
    cursor: "pointer",
    background: "transparent",
    "font-size": "var(--jb-text-muted-size)",
    color: tokens.colors.text.primary,
    transition: "background var(--cortex-transition-fast)",
  };

  const treeNodeStyle = (depth: number, isExpanded: boolean): JSX.CSSProperties => ({
    width: "100%",
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    "padding-left": `${8 + depth * 16}px`,
    "text-align": "left",
    cursor: "pointer",
    border: "none",
    height: `${ITEM_HEIGHT}px`,
    background: isExpanded ? tokens.colors.interactive.selected : "transparent",
    transition: "background var(--cortex-transition-fast)",
  });

  const lineNumberStyle: JSX.CSSProperties = {
    "flex-shrink": "0",
    width: "32px",
    "text-align": "right",
    "font-size": "10px",
    "font-family": "var(--jb-font-mono)",
    "margin-right": tokens.spacing.md,
    "user-select": "none",
    "line-height": "20px",
    color: tokens.colors.text.muted,
  };

  const matchTextStyle: JSX.CSSProperties = {
    "font-size": "var(--jb-text-muted-size)",
    "font-family": "var(--jb-font-mono)",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
    "line-height": "20px",
    flex: "1",
    color: tokens.colors.text.muted,
  };

  return (
    <div style={ui.panel}>
      {/* Header */}
      <SidebarHeader
        title="Search"
        actions={
          <>
            <IconButton
              tooltip="Refresh"
              size="sm"
              onClick={() => performSearch(query())}
            >
              <Icon name="rotate" style={ui.icon} />
            </IconButton>
            <IconButton
              tooltip="Clear Search Results"
              size="sm"
              onClick={clearSearch}
            >
              <Icon name="xmark" style={ui.icon} />
            </IconButton>
            {/* Copy Results Dropdown */}
            <div style={{ position: "relative" }}>
              <IconButton
                tooltip="Copy Results"
                size="sm"
                onClick={() => setShowCopyMenu(!showCopyMenu())}
                disabled={(results()?.length ?? 0) === 0}
              >
                <Icon name="copy" style={ui.icon} />
              </IconButton>
              <Show when={showCopyMenu()}>
                <div 
                  style={mergeStyles(ui.popup, {
                    position: "absolute",
                    top: "100%",
                    right: "0",
                    "margin-top": "4px",
                    "min-width": "160px",
                    "z-index": "100",
                  })}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    style={contextMenuItemStyle}
                    onClick={() => handleCopyAllResults('plain')}
                    onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    Copy as Plain Text
                  </button>
                  <button
                    style={contextMenuItemStyle}
                    onClick={() => handleCopyAllResults('markdown')}
                    onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    Copy as Markdown
                  </button>
                  <button
                    style={contextMenuItemStyle}
                    onClick={() => handleCopyAllResults('json')}
                    onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    Copy as JSON
                  </button>
                </div>
              </Show>
            </div>
            <IconButton
              tooltip="Save Search Results"
              size="sm"
              onClick={handleSaveResults}
              disabled={(results()?.length ?? 0) === 0}
            >
              <Icon name="floppy-disk" style={ui.icon} />
            </IconButton>
            <IconButton
              tooltip="Open New Search Editor"
              size="sm"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("open-search-editor", {
                  detail: { query: query(), results: results() }
                }));
              }}
            >
              <Icon name="pen-to-square" style={ui.icon} />
            </IconButton>
            <IconButton
              tooltip={viewMode() === 'list' ? "View as Tree" : "View as List"}
              size="sm"
              active={viewMode() === 'tree'}
              onClick={toggleViewMode}
            >
              {viewMode() === 'list' ? <Icon name="folder-tree" style={ui.icon} /> : <Icon name="list" style={ui.icon} />}
            </IconButton>
            <IconButton
              tooltip="Expand All"
              size="sm"
              onClick={viewMode() === 'list' ? expandAll : expandAllTree}
            >
              <Icon name="square-plus" style={ui.icon} />
            </IconButton>
            <IconButton
              tooltip="Collapse All"
              size="sm"
              onClick={viewMode() === 'list' ? collapseAll : collapseAllTree}
            >
              <Icon name="square-minus" style={ui.icon} />
            </IconButton>
          </>
        }
      />

      {/* Search Input Section */}
      <div style={{ padding: "8px 12px", display: "flex", "flex-direction": "column", gap: "4px" }}>
        {/* Main Search Row */}
        <div style={{ display: "flex", "align-items": "flex-start", gap: "2px" }}>
          {/* Replace Toggle Chevron - smaller and closer to inputs */}
          <button
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "14px",
              height: "14px",
              "margin-top": "7px",
              padding: "0",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: tokens.colors.text.muted,
              "border-radius": "var(--cortex-radius-sm)",
              "flex-shrink": "0",
            }}
            title={showReplace() ? "Hide Replace" : "Show Replace"}
            onClick={() => setShowReplace(!showReplace())}
            onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <Icon name={showReplace() ? "chevron-down" : "chevron-right"} style={{ width: "8px", height: "8px" }} />
          </button>
          
          {/* Input Group */}
          <div style={{ flex: "1", display: "flex", "flex-direction": "column", gap: "1px" }}>
            {/* Search Input Row */}
            <div style={{
              ...inputRowStyle,
              "border-bottom": showReplace() ? "none" : undefined,
              "border-radius": showReplace() ? `${tokens.radius.sm} ${tokens.radius.sm} 0 0` : tokens.radius.sm,
            }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search"
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                style={inputInnerStyle}
              />
              <Show when={loading()}>
                <LoadingSpinner size="sm" style={{ "margin-right": "4px" }} />
              </Show>
            </div>

            {/* Replace Input Row */}
            <Show when={showReplace()}>
              <div style={{
                ...inputRowStyle,
                "border-radius": `0 0 ${tokens.radius.sm} ${tokens.radius.sm}`,
              }}>
                <input
                  type="text"
                  placeholder="Replace"
                  value={replaceText()}
                  onInput={(e) => setReplaceText(e.currentTarget.value)}
                  style={inputInnerStyle}
                />
              </div>
            </Show>
          </div>
        </div>
        
        {/* Filter Suggestions Dropdown */}
        <Show when={showFilterSuggestions() && (getFilteredSuggestions()?.length ?? 0) > 0}>
          <div style={mergeStyles(ui.popup, { "margin-top": "4px" })}>
            <div style={{
              padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
              "font-size": "9px",
              "border-bottom": `1px solid ${tokens.colors.border.divider}`,
              color: tokens.colors.text.muted,
              background: tokens.colors.interactive.selected,
            }}>
              Search Filters
            </div>
            <For each={getFilteredSuggestions()}>
              {(suggestion, index) => (
                <button
                  style={{
                    width: "100%",
                    display: "flex",
                    "align-items": "center",
                    gap: tokens.spacing.md,
                    padding: `6px ${tokens.spacing.md}`,
                    "text-align": "left",
                    border: "none",
                    cursor: "pointer",
                    background: filterSuggestionIndex() === index() 
                      ? tokens.colors.interactive.selected 
                      : "transparent",
                    transition: "background var(--cortex-transition-fast)",
                  }}
                  onMouseEnter={() => setFilterSuggestionIndex(index())}
                  onClick={() => insertFilterSuggestion(suggestion.filter)}
                >
                  <Text variant="muted" color="primary" weight="medium" style={{ "font-family": "var(--jb-font-mono)" }}>
                    {suggestion.filter}
                  </Text>
                  <Text variant="muted" size="xs" truncate>
                    {suggestion.description}
                  </Text>
                </button>
              )}
            </For>
            <div style={{
              padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
              "font-size": "9px",
              "border-top": `1px solid ${tokens.colors.border.divider}`,
              color: tokens.colors.text.muted,
              background: tokens.colors.surface.canvas,
            }}>
              Tab or Enter to select • Esc to dismiss
            </div>
          </div>
        </Show>
        
        {/* Search Options Row - Toggle buttons moved here for better responsiveness */}
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm, "padding-left": "16px", "flex-wrap": "wrap" }}>
          {/* Case Sensitive */}
          <ToggleButton
            active={caseSensitive()}
            onClick={() => setCaseSensitive(!caseSensitive())}
            title="Match Case (Alt+C)"
          >
            Aa
          </ToggleButton>
          {/* Whole Word */}
          <ToggleButton
            active={wholeWord()}
            onClick={() => setWholeWord(!wholeWord())}
            title="Match Whole Word (Alt+W)"
          >
            Ab
          </ToggleButton>
          {/* Regex */}
          <ToggleButton
            active={useRegex()}
            onClick={() => setUseRegex(!useRegex())}
            title="Use Regular Expression (Alt+R)"
          >
            .*
          </ToggleButton>
          {/* Preserve Case - only when replace is shown */}
          <Show when={showReplace()}>
            <ToggleButton
              active={preserveCase()}
              onClick={() => setPreserveCase(!preserveCase())}
              title="Preserve Case"
            >
              AB
            </ToggleButton>
          </Show>
          
          <div style={{ width: "1px", height: "16px", background: tokens.colors.border.divider, margin: `0 ${tokens.spacing.xs}` }} />
          
          {/* Search in Open Editors */}
          <IconButton
            active={searchOpenEditorsOnly()}
            tooltip="Search only in Open Editors"
            size="sm"
            onClick={() => {
              setSearchOpenEditorsOnly(!searchOpenEditorsOnly());
              if (query().length >= 1) {
                performSearch(query());
              }
            }}
          >
            <Icon name="file" style={ui.icon} />
          </IconButton>
          
          {/* Toggle Filters */}
          <IconButton
            active={showFilters()}
            tooltip="Toggle Include/Exclude Filters"
            size="sm"
            onClick={() => setShowFilters(!showFilters())}
          >
            <span style={{ "font-size": "var(--jb-text-muted-size)", "font-weight": "600" }}>...</span>
          </IconButton>
        </div>

        {/* Include/Exclude Filters */}
        <Show when={showFilters()}>
          <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.sm, "padding-left": "16px" }}>
            <Input
              placeholder="files to include (e.g., *.ts, src/**)"
              value={includePattern()}
              onInput={(e) => setIncludePattern(e.currentTarget.value)}
              style={{ height: "24px", "font-size": "var(--jb-text-body-size)" }}
            />
            <Input
              placeholder="files to exclude"
              value={excludePattern()}
              onInput={(e) => setExcludePattern(e.currentTarget.value)}
              style={{ height: "24px", "font-size": "var(--jb-text-body-size)" }}
            />
          </div>
        </Show>
      </div>

      {/* Results Header / Search Stats */}
      <Show when={(results()?.length ?? 0) > 0 || ((query()?.length ?? 0) >= 1 && !loading())}>
        <div style={mergeStyles(ui.spaceBetween, {
          "font-size": "var(--jb-text-muted-size)",
          color: tokens.colors.text.muted,
          padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
          background: tokens.colors.surface.canvas,
        })}>
          <Text variant="muted" size="sm">
            {(results()?.length ?? 0) > 0 
              ? `${totalMatches()} results in ${results()?.length ?? 0} files`
              : "No results"
            }
          </Text>
          <Show when={(results()?.length ?? 0) > 0}>
            <div style={ui.row}>
              <IconButton
                tooltip="Collapse All"
                size="sm"
                onClick={collapseAll}
              >
                <Icon name="chevron-right" style={ui.icon} />
              </IconButton>
              <IconButton
                tooltip="Expand All"
                size="sm"
                onClick={expandAll}
              >
                <Icon name="chevron-down" style={ui.icon} />
              </IconButton>
            </div>
          </Show>
        </div>
      </Show>

      {/* Replace All Button */}
      <Show when={showReplace() && (results()?.length ?? 0) > 0}>
        <div style={{ padding: `${tokens.spacing.md} ${tokens.spacing.lg}`, "border-bottom": `1px solid ${tokens.colors.border.divider}` }}>
          <Button
            variant="primary"
            size="sm"
            onClick={replaceInAllFiles}
            disabled={loading()}
            style={{ width: "100%" }}
          >
            Replace All ({totalMatches()} occurrences)
          </Button>
        </div>
      </Show>

      {/* Error Message */}
      <Show when={searchError()}>
        <div style={{
          padding: `6px ${tokens.spacing.lg}`,
          "font-size": "var(--jb-text-muted-size)",
          color: tokens.colors.semantic.error,
          background: "rgba(247, 84, 100, 0.1)",
        }}>
          <Text variant="muted" color="error">{searchError()}</Text>
        </div>
      </Show>

      {/* Virtualized Results List */}
      <div 
        ref={resultsContainerRef}
        style={ui.scrollY}
        onScroll={handleScroll}
      >
        <Show when={(query()?.length ?? 0) < 1 && (results()?.length ?? 0) === 0}>
          <EmptyState
            icon={<Icon name="magnifying-glass" />}
            description="Type to search in files"
          />
        </Show>

        {/* List View */}
        <Show when={viewMode() === 'list' && (flatResults()?.length ?? 0) > 0}>
          {/* Virtual scroll container with total height for proper scrollbar */}
          <div style={{ height: `${totalHeight()}px`, position: "relative" }}>
            {/* Positioned container for visible items */}
            <div style={{ 
              position: "absolute", 
              top: `${visibleRange().start * ITEM_HEIGHT}px`,
              width: "100%"
            }}>
              <For each={visibleItems()}>
                {(item) => (
                  <Show 
                    when={item.type === 'file'} 
                    fallback={
                      <Show 
                        when={item.type === 'match'}
                        fallback={
                          /* Context Line Row - dimmed styling */
                          <button
                            style={contextRowStyle}
                            onClick={() => {
                              if (item.type === 'context') {
                                openMatch(item.file, item.line, 1);
                              }
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            <Show when={showLineNumbers()}>
                              <span style={lineNumberStyle}>
                                {item.type === 'context' ? item.line : ''}
                              </span>
                            </Show>
                            <span style={matchTextStyle}>
                              {item.type === 'context' ? item.text.trim() : ''}
                            </span>
                          </button>
                        }
                      >
                        {/* Match Row */}
                        <button
                          style={matchRowStyle}
                          onClick={() => {
                            if (item.type === 'match') {
                              openMatch(item.file, item.match.line, item.match.column);
                            }
                          }}
                          onContextMenu={(e) => {
                            if (item.type === 'match') {
                              handleContextMenu(e, item.file, item.match);
                            }
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >
                          <Show when={showLineNumbers()}>
                            <span style={lineNumberStyle}>
                              {item.type === 'match' ? item.match.line : ''}
                            </span>
                          </Show>
                          <span style={matchTextStyle}>
                            {item.type === 'match' && highlightMatch(item.match.text.trim(), item.match.matchStart, item.match.matchEnd)}
                          </span>
                        </button>
                      </Show>
                    }
                  >
                    {/* File Header Row */}
                    <button
                      style={fileRowStyle(expandedFiles().has((item as { type: 'file'; file: string }).file))}
                      onClick={() => toggleFile((item as { type: 'file'; file: string }).file)}
                      onContextMenu={(e) => handleContextMenu(e, (item as { type: 'file'; file: string }).file, null)}
                      onMouseEnter={(e) => {
                        if (!expandedFiles().has((item as { type: 'file'; file: string }).file)) {
                          e.currentTarget.style.background = tokens.colors.interactive.hover;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!expandedFiles().has((item as { type: 'file'; file: string }).file)) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      <span style={{ "flex-shrink": "0", color: tokens.colors.icon.default }}>
                        {expandedFiles().has((item as { type: 'file'; file: string }).file) 
                          ? <Icon name="chevron-down" style={{ width: "14px", height: "14px" }} />
                          : <Icon name="chevron-right" style={{ width: "14px", height: "14px" }} />
                        }
                      </span>
                      <Icon name="file" style={{ 
                        width: "14px", 
                        height: "14px", 
                        "flex-shrink": "0", 
                        color: tokens.colors.semantic.primary 
                      }} />
                      <span style={{ 
                        "font-size": "var(--jb-text-muted-size)",
                        "font-weight": "600",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                        color: tokens.colors.text.primary,
                      }}>
                        {getFileName((item as { type: 'file'; file: string }).file)}
                      </span>
                      <Show when={getFileDirectory((item as { type: 'file'; file: string }).file)}>
                        <span style={{ 
                          "font-size": "10px",
                          overflow: "hidden",
                          "text-overflow": "ellipsis",
                          "white-space": "nowrap",
                          opacity: "0.6",
                          color: tokens.colors.text.muted,
                        }}>
                          {getFileDirectory((item as { type: 'file'; file: string }).file)}
                        </span>
                      </Show>
                      <Badge style={{ "margin-left": "auto" }}>
                        {(item as { type: 'file'; file: string; matchCount: number }).matchCount}
                      </Badge>
                      <Show when={showReplace()}>
                        <button
                          style={{ 
                            opacity: "0",
                            padding: "2px 6px",
                            "font-size": "10px",
                            "border-radius": tokens.radius.sm,
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            color: tokens.colors.text.muted,
                            transition: "opacity var(--cortex-transition-fast)",
                          }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const success = await replaceInFile((item as { type: 'file'; file: string }).file);
                            if (success) {
                              window.dispatchEvent(new CustomEvent("notification", { 
                                detail: { type: "success", message: `Replaced in ${getFileName((item as { type: 'file'; file: string }).file)}` } 
                              }));
                              await performSearch(query());
                            }
                          }}
                          title="Replace in file"
                          onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >
                          Replace
                        </button>
                      </Show>
                    </button>
                  </Show>
                )}
              </For>
            </div>
          </div>
        </Show>
        
        {/* Tree View */}
        <Show when={viewMode() === 'tree' && (flatTreeItems()?.length ?? 0) > 0}>
          <div>
            <For each={flatTreeItems()}>
              {({ node, depth }) => (
                <Show when={node.type === 'folder'}>
                  {/* Folder Row */}
                  <button
                    style={treeNodeStyle(depth, expandedTreePaths().has(node.path))}
                    onClick={() => toggleTreeNode(node.path)}
                    onMouseEnter={(e) => {
                      if (!expandedTreePaths().has(node.path)) {
                        e.currentTarget.style.background = tokens.colors.interactive.hover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!expandedTreePaths().has(node.path)) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <span style={{ "flex-shrink": "0", color: tokens.colors.icon.default }}>
                      {expandedTreePaths().has(node.path) 
                        ? <Icon name="chevron-down" style={{ width: "14px", height: "14px" }} />
                        : <Icon name="chevron-right" style={{ width: "14px", height: "14px" }} />
                      }
                    </span>
                    <Icon name="folder" style={{ 
                      width: "14px", 
                      height: "14px", 
                      "flex-shrink": "0", 
                      color: tokens.colors.semantic.warning 
                    }} />
                    <span style={{ 
                      "font-size": "var(--jb-text-muted-size)",
                      "font-weight": "600",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                      "white-space": "nowrap",
                      color: tokens.colors.text.primary,
                    }}>
                      {node.name}
                    </span>
                    <Badge style={{ "margin-left": "auto" }}>
                      {node.matchCount} in {node.fileCount} files
                    </Badge>
                  </button>
                </Show>
              )}
            </For>
            <For each={flatTreeItems()}>
              {({ node, depth }) => (
                <Show when={node.type === 'file'}>
                  {/* File Row in Tree */}
                  <button
                    style={treeNodeStyle(depth, expandedTreePaths().has(node.path))}
                    onClick={() => toggleTreeNode(node.path)}
                    onContextMenu={(e) => handleContextMenu(e, node.path, null)}
                    onMouseEnter={(e) => {
                      if (!expandedTreePaths().has(node.path)) {
                        e.currentTarget.style.background = tokens.colors.interactive.hover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!expandedTreePaths().has(node.path)) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <span style={{ "flex-shrink": "0", color: tokens.colors.icon.default }}>
                      {expandedTreePaths().has(node.path) 
                        ? <Icon name="chevron-down" style={{ width: "14px", height: "14px" }} />
                        : <Icon name="chevron-right" style={{ width: "14px", height: "14px" }} />
                      }
                    </span>
                    <Icon name="file" style={{ 
                      width: "14px", 
                      height: "14px", 
                      "flex-shrink": "0", 
                      color: tokens.colors.semantic.primary 
                    }} />
                    <span style={{ 
                      "font-size": "var(--jb-text-muted-size)",
                      "font-weight": "600",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                      "white-space": "nowrap",
                      color: tokens.colors.text.primary,
                    }}>
                      {node.name}
                    </span>
                    <Badge style={{ "margin-left": "auto" }}>
                      {node.matchCount}
                    </Badge>
                  </button>
                </Show>
              )}
            </For>
            <For each={flatTreeItems()}>
              {({ node, depth }) => (
                <Show when={node.type === 'match' && node.match}>
                  {/* Match Row in Tree */}
                  <button
                    style={{
                      ...matchRowStyle,
                      "padding-left": `${8 + (depth + 1) * 16}px`,
                    }}
                    onClick={() => {
                      if (node.match) {
                        openMatch(node.path, node.match.line, node.match.column);
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, node.path, node.match || null)}
                    onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <Show when={showLineNumbers()}>
                      <span style={lineNumberStyle}>
                        {node.match?.line}
                      </span>
                    </Show>
                    <span style={matchTextStyle}>
                      {node.match && highlightMatch(node.match.text.trim(), node.match.matchStart, node.match.matchEnd)}
                    </span>
                  </button>
                </Show>
              )}
            </For>
          </div>
        </Show>
      </div>
      
      {/* Context Menu */}
      <Show when={contextMenu().visible}>
        <div 
          style={{
            position: "fixed",
            left: `${contextMenu().x}px`,
            top: `${contextMenu().y}px`,
            "z-index": "1000",
            "min-width": "180px",
            ...ui.popup,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Show when={contextMenu().match}>
            <button
              style={contextMenuItemStyle}
              onClick={handleCopyMatch}
              onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <Icon name="copy" style={{ width: "12px", height: "12px" }} />
              Copy Match
            </button>
            <button
              style={contextMenuItemStyle}
              onClick={handleCopyLine}
              onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <Icon name="copy" style={{ width: "12px", height: "12px" }} />
              Copy Line
            </button>
            <div style={{ height: "1px", background: tokens.colors.border.divider, margin: `${tokens.spacing.sm} 0` }} />
          </Show>
          <Show when={contextMenu().file}>
            <button
              style={contextMenuItemStyle}
              onClick={handleCopyFilePath}
              onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <Icon name="copy" style={{ width: "12px", height: "12px" }} />
              Copy Path
            </button>
            <button
              style={contextMenuItemStyle}
              onClick={handleCopyRelativePath}
              onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <Icon name="copy" style={{ width: "12px", height: "12px" }} />
              Copy Relative Path
            </button>
            <button
              style={contextMenuItemStyle}
              onClick={handleCopyFileMatches}
              onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <Icon name="copy" style={{ width: "12px", height: "12px" }} />
              Copy All Matches in File
            </button>
          </Show>
        </div>
      </Show>

      {/* Footer */}
      <Show when={(results()?.length ?? 0) > 0}>
        <div style={{
          padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
          "font-size": "9px",
          color: tokens.colors.text.muted,
        }}>
          <Text variant="muted" size="xs">Click result to open file • Press Enter to search</Text>
        </div>
      </Show>
    </div>
  );
}

