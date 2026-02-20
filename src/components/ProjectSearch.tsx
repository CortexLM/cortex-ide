import { createSignal, createEffect, For, Show, onMount, onCleanup, JSX, batch } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useCommands } from "@/context/CommandContext";
import { useEditor } from "@/context/EditorContext";
import { useSearchSettings } from "@/context/SettingsContext";
import { useSemanticSearch, SemanticSearchResult } from "@/context/SemanticSearchContext";
import { fsReadFile, fsWriteFile } from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";
import { Icon } from "./ui/Icon";
import { MultiLineSearchInput } from "./MultiLineSearchInput";

// Search history constants
const SEARCH_HISTORY_KEY = "cortex_search_history";
const INCLUDE_HISTORY_KEY = "cortex_include_history";
const EXCLUDE_HISTORY_KEY = "cortex_exclude_history";
const MAX_SEARCH_HISTORY = 20;
const MAX_PATTERN_HISTORY = 15;

// Search history helpers
function loadSearchHistory(): string[] {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_SEARCH_HISTORY);
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function saveSearchHistory(history: string[]): void {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_SEARCH_HISTORY)));
  } catch {
    // Ignore storage errors
  }
}

function addToSearchHistory(query: string, currentHistory: string[]): string[] {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return currentHistory;
  
  // Remove duplicates and add to front
  const filtered = currentHistory.filter(item => item !== trimmed);
  const newHistory = [trimmed, ...filtered].slice(0, MAX_SEARCH_HISTORY);
  saveSearchHistory(newHistory);
  return newHistory;
}

// Include/Exclude pattern history helpers
function loadPatternHistory(key: string): string[] {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_PATTERN_HISTORY);
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function savePatternHistory(key: string, history: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(history.slice(0, MAX_PATTERN_HISTORY)));
  } catch {
    // Ignore storage errors
  }
}

function addToPatternHistory(pattern: string, key: string, currentHistory: string[]): string[] {
  const trimmed = pattern.trim();
  if (!trimmed) return currentHistory;
  
  // Remove duplicates and add to front
  const filtered = currentHistory.filter(item => item !== trimmed);
  const newHistory = [trimmed, ...filtered].slice(0, MAX_PATTERN_HISTORY);
  savePatternHistory(key, newHistory);
  return newHistory;
}

interface SearchMatch {
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

interface SearchResult {
  file: string;
  matches: SearchMatch[];
}

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

interface ReplacePreview {
  file: string;
  changes: Array<{
    line: number;
    original: string;
    replacement: string;
  }>;
}

function highlightMatch(text: string, start: number, end: number): JSX.Element {
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeEnd = Math.max(safeStart, Math.min(end, text.length));
  
  return (
    <>
      <span style={{ color: "var(--text-base)" }}>{text.slice(0, safeStart)}</span>
      <span 
        style={{ 
          padding: "0 4px",
          "border-radius": "var(--cortex-radius-sm)",
          "font-weight": "600",
          background: "rgba(234, 179, 8, 0.4)",
          color: "var(--text-base)",
          "box-shadow": "0 0 0 1px rgba(234, 179, 8, 0.6)",
        }}
      >
        {text.slice(safeStart, safeEnd)}
      </span>
      <span style={{ color: "var(--text-base)" }}>{text.slice(safeEnd)}</span>
    </>
  );
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

// Persist state across open/close
let persistedQuery = "";
let persistedReplaceText = "";
let persistedIncludePattern = "";
let persistedExcludePattern = "node_modules, .git, dist, build";
let persistedCaseSensitive = false;
let persistedWholeWord = false;
let persistedUseRegex = false;
let persistedShowReplace = false;
let persistedAISearchEnabled = false;
let persistedPreserveCase = false;
let persistedSearchOpenEditorsOnly = false;
let persistedMultilineMode = false;

export function ProjectSearch() {
  const { showProjectSearch, setShowProjectSearch } = useCommands();
  const { openFile, updateFileContent, state: editorState } = useEditor();
  const { settings: searchSettings, update: updateSearchSetting } = useSearchSettings();
  const semanticSearch = useSemanticSearch();
  const [query, setQuery] = createSignal(persistedQuery);
  const [replaceText, setReplaceText] = createSignal(persistedReplaceText);
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [aiResults, setAIResults] = createSignal<SemanticSearchResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [caseSensitive, setCaseSensitive] = createSignal(persistedCaseSensitive);
  const [useRegex, setUseRegex] = createSignal(persistedUseRegex);
  const [wholeWord, setWholeWord] = createSignal(persistedWholeWord);
  const [includePattern, setIncludePattern] = createSignal(persistedIncludePattern);
  const [excludePattern, setExcludePattern] = createSignal(persistedExcludePattern);
  const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(new Set());
  const [isVisible, setIsVisible] = createSignal(false);
  const [showReplace, setShowReplace] = createSignal(persistedShowReplace);
  const [replacePreview, setReplacePreview] = createSignal<ReplacePreview[]>([]);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [, setSelectedResultIndex] = createSignal(0);
  const [aiSearchEnabled, setAISearchEnabled] = createSignal(persistedAISearchEnabled);
  const [preserveCase, setPreserveCase] = createSignal(persistedPreserveCase);
  const [searchOpenEditorsOnly, setSearchOpenEditorsOnly] = createSignal(persistedSearchOpenEditorsOnly);
  const [searchHistory, setSearchHistory] = createSignal<string[]>([]);
  const [showHistory, setShowHistory] = createSignal(false);
  const [historySelectedIndex, setHistorySelectedIndex] = createSignal(-1);
  
  // Include/Exclude pattern history state
  const [includeHistory, setIncludeHistory] = createSignal<string[]>([]);
  const [excludeHistory, setExcludeHistory] = createSignal<string[]>([]);
  const [showIncludeHistory, setShowIncludeHistory] = createSignal(false);
  const [showExcludeHistory, setShowExcludeHistory] = createSignal(false);
  const [includeHistoryIndex, setIncludeHistoryIndex] = createSignal(-1);
  const [excludeHistoryIndex, setExcludeHistoryIndex] = createSignal(-1);
  
  // Multi-line search state
  const [multilineMode, setMultilineMode] = createSignal(persistedMultilineMode);
  
  // Context lines - file content cache for displaying surrounding lines
  const [fileContentCache, setFileContentCache] = createSignal<Record<string, string[]>>({});
  const [showContextMenu, setShowContextMenu] = createSignal(false);
  
  // Filter autocomplete state
  const [showFilterSuggestions, setShowFilterSuggestions] = createSignal(false);
  const [filterSuggestionIndex, setFilterSuggestionIndex] = createSignal(0);
  
  let inputRef: HTMLInputElement | HTMLTextAreaElement | undefined;
  let replaceInputRef: HTMLInputElement | HTMLTextAreaElement | undefined;
  let includeInputRef: HTMLInputElement | undefined;
  let excludeInputRef: HTMLInputElement | undefined;
  let searchTimeout: number | undefined;
  let abortController: AbortController | null = null;

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

  // Persist state
  createEffect(() => {
    persistedQuery = query();
    persistedReplaceText = replaceText();
    persistedIncludePattern = includePattern();
    persistedExcludePattern = excludePattern();
    persistedCaseSensitive = caseSensitive();
    persistedWholeWord = wholeWord();
    persistedUseRegex = useRegex();
    persistedShowReplace = showReplace();
    persistedAISearchEnabled = aiSearchEnabled();
    persistedPreserveCase = preserveCase();
    persistedSearchOpenEditorsOnly = searchOpenEditorsOnly();
    persistedMultilineMode = multilineMode();
  });
  
  // Check if query contains newlines (for multi-line search indicator)
  const hasMultilineQuery = () => query().includes('\n');
  const queryLineCount = () => query().split('\n').length;

  // Handle visibility
  createEffect(() => {
    if (showProjectSearch()) {
      setIsVisible(true);
      setQuery(persistedQuery);
      setReplaceText(persistedReplaceText);
      setIncludePattern(persistedIncludePattern);
      setExcludePattern(persistedExcludePattern);
      setCaseSensitive(persistedCaseSensitive);
      setWholeWord(persistedWholeWord);
      setUseRegex(persistedUseRegex);
      setShowReplace(persistedShowReplace);
      setAISearchEnabled(persistedAISearchEnabled);
      setPreserveCase(persistedPreserveCase);
      setSearchOpenEditorsOnly(persistedSearchOpenEditorsOnly);
      setMultilineMode(persistedMultilineMode);
      // Load search history from localStorage
      setSearchHistory(loadSearchHistory());
      setIncludeHistory(loadPatternHistory(INCLUDE_HISTORY_KEY));
      setExcludeHistory(loadPatternHistory(EXCLUDE_HISTORY_KEY));
      setHistorySelectedIndex(-1);
      setIncludeHistoryIndex(-1);
      setExcludeHistoryIndex(-1);
      setTimeout(() => {
        inputRef?.focus();
        if (inputRef && 'select' in inputRef) {
          inputRef.select();
        }
      }, 10);
    } else {
      setIsVisible(false);
      setShowHistory(false);
      setShowIncludeHistory(false);
      setShowExcludeHistory(false);
      cancelSearch();
    }
  });

  // Show history when input is focused and empty
  const handleInputFocus = () => {
    if (query().length === 0 && searchHistory().length > 0) {
      setShowHistory(true);
      setHistorySelectedIndex(-1);
    }
  };

  const handleInputBlur = (e: FocusEvent) => {
    // Delay hiding history to allow click events on history items
    setTimeout(() => {
      // Only hide if focus didn't move to history dropdown
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      if (!relatedTarget?.closest("[data-search-history]")) {
        setShowHistory(false);
        setHistorySelectedIndex(-1);
      }
    }, 150);
  };

  const selectHistoryItem = (item: string) => {
    setQuery(item);
    setShowHistory(false);
    setHistorySelectedIndex(-1);
    inputRef?.focus();
    // Trigger search immediately
    performSearch(item);
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    saveSearchHistory([]);
    setShowHistory(false);
    setHistorySelectedIndex(-1);
  };

  // Debounced search
  createEffect(() => {
    const q = query();
    const cs = caseSensitive();
    const re = useRegex();
    const ww = wholeWord();
    const inc = includePattern();
    const exc = excludePattern();
    const aiEnabled = aiSearchEnabled();
    
    // Track all dependencies
    void q;
    void cs;
    void re;
    void ww;
    void inc;
    void exc;
    void aiEnabled;
    
    clearTimeout(searchTimeout);
    
    // Hide history when user starts typing
    if (q.length > 0) {
      setShowHistory(false);
      setHistorySelectedIndex(-1);
    }
    
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
    
    // Need at least 2 chars in actual query, or have filters
    if (actualQuery.length < 2 && !hasFilters) {
      batch(() => {
        setResults([]);
        setAIResults([]);
        setReplacePreview([]);
        setSearchError(null);
      });
      return;
    }
    
    searchTimeout = window.setTimeout(() => {
      performSearch(q);
    }, 300);
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
      
      // Run AI search in parallel if enabled (use actual query without filters)
      const aiSearchPromise = aiSearchEnabled() && actualQuery
        ? semanticSearch.search(actualQuery, 15).catch(() => [])
        : Promise.resolve([]);
      
      // Use Tauri invoke for content search instead of HTTP API
      const [searchResponse, aiSearchResults] = await Promise.all([
        invoke<{ results: SearchResult[]; totalMatches: number; filesSearched: number }>("fs_search_content", {
          path: projectPath,
          query: actualQuery || ".",  // Use "." as wildcard if only using filters
          caseSensitive: caseSensitive(),
          regex: actualQuery ? useRegex() : true,  // Force regex mode for wildcard
          wholeWord: actualQuery ? wholeWord() : false,
          include: includePattern() || undefined,
          exclude: excludePattern() || undefined,
          maxResults: 1000,
        }),
        aiSearchPromise,
      ]);
      
      // Update AI results
      setAIResults(aiSearchResults);
      
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
        // Auto-expand first 5 files
        const expanded = new Set<string>();
        searchResults.slice(0, 5).forEach((r: SearchResult) => expanded.add(r.file));
        setExpandedFiles(expanded);
        setSelectedResultIndex(0);
      });
      
      // Save to search history on successful search
      if (searchResults.length > 0 || aiSearchResults.length > 0) {
        setSearchHistory(prev => addToSearchHistory(searchQuery, prev));
        
        // Save include/exclude patterns to history
        const incPattern = includePattern();
        const excPattern = excludePattern();
        if (incPattern) {
          setIncludeHistory(prev => addToPatternHistory(incPattern, INCLUDE_HISTORY_KEY, prev));
        }
        if (excPattern) {
          setExcludeHistory(prev => addToPatternHistory(excPattern, EXCLUDE_HISTORY_KEY, prev));
        }
      }
      
      // Generate replace preview if replace is shown
      if (showReplace() && replaceText() !== undefined) {
        generateReplacePreview(searchResults);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Search was cancelled, ignore
        return;
      }
      console.error("Search failed:", err);
      setSearchError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const generateReplacePreview = (searchResults: SearchResult[]) => {
    const replace = replaceText();
    const previews: ReplacePreview[] = [];
    
    for (const result of searchResults.slice(0, 10)) { // Limit preview to 10 files
      const changes: ReplacePreview["changes"] = [];
      
      for (const match of result.matches.slice(0, 5)) { // Limit to 5 matches per file
        const original = match.text;
        let replacement: string;
        
        if (useRegex()) {
          try {
            let pattern = query();
            if (wholeWord()) pattern = `\\b${pattern}\\b`;
            const flags = caseSensitive() ? "g" : "gi";
            const regex = new RegExp(pattern, flags);
            replacement = original.replace(regex, (m) => {
              return preserveCase() ? applyPreserveCase(m, replace) : replace;
            });
          } catch {
            const matchedText = original.slice(match.matchStart, match.matchEnd);
            const finalReplace = preserveCase() ? applyPreserveCase(matchedText, replace) : replace;
            replacement = original.replace(matchedText, finalReplace);
          }
        } else {
          const matchedText = original.slice(match.matchStart, match.matchEnd);
          const finalReplace = preserveCase() ? applyPreserveCase(matchedText, replace) : replace;
          replacement = original.slice(0, match.matchStart) + finalReplace + original.slice(match.matchEnd);
        }
        
        changes.push({
          line: match.line,
          original,
          replacement,
        });
      }
      
      if (changes.length > 0) {
        previews.push({ file: result.file, changes });
      }
    }
    
    setReplacePreview(previews);
  };

  const replaceInFile = async (filePath: string) => {
    const projectPath = getProjectPath();
    const fullPath = projectPath ? `${projectPath}/${filePath}` : filePath;
    
    try {
      // Read file content via Tauri
      const content = await fsReadFile(fullPath);
      
      // Build search pattern
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
      
      // Write back via Tauri
      await fsWriteFile(fullPath, newContent);
      
      // Update in editor if open
      const openFile = editorState.openFiles.find(f => f.path === fullPath);
      if (openFile) {
        updateFileContent(openFile.id, newContent);
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
    
    // Re-run search to update results
    await performSearch(query());
    
    setLoading(false);
    
    // Show notification
    const message = failCount > 0 
      ? `Replaced in ${successCount} files, ${failCount} failed`
      : `Replaced in ${successCount} files`;
    window.dispatchEvent(new CustomEvent("notification", { 
      detail: { type: failCount > 0 ? "warning" : "success", message } 
    }));
  };

  const toggleFile = async (file: string) => {
    const expanded = new Set(expandedFiles());
    if (expanded.has(file)) {
      expanded.delete(file);
    } else {
      expanded.add(file);
      // Load file content for context lines if needed
      if (searchSettings().contextLines > 0 && !fileContentCache()[file]) {
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

  // Get context lines for a match
  const getContextLines = (file: string, matchLine: number): { before: string[]; after: string[] } => {
    const lines = fileContentCache()[file];
    const contextCount = searchSettings().contextLines;
    if (!lines || contextCount === 0) return { before: [], after: [] };
    
    const before: string[] = [];
    const after: string[] = [];
    
    // Lines before the match
    for (let i = Math.max(0, matchLine - 1 - contextCount); i < matchLine - 1; i++) {
      before.push(lines[i] || '');
    }
    
    // Lines after the match
    for (let i = matchLine; i < Math.min(lines.length, matchLine + contextCount); i++) {
      after.push(lines[i] || '');
    }
    
    return { before, after };
  };

  const openMatch = async (file: string, line: number, column: number) => {
    const projectPath = getProjectPath();
    // Check if file is already an absolute path (starts with drive letter on Windows or / on Unix)
    const isAbsolutePath = /^[a-zA-Z]:[\\/]/.test(file) || file.startsWith('/');
    const fullPath = isAbsolutePath ? file : (projectPath ? `${projectPath}/${file}` : file);
    
    // Close the search panel first so the editor is visible
    setShowProjectSearch(false);
    
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

  const totalMatches = () => {
    return results().reduce((sum, r) => sum + r.matches.length, 0);
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

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!showProjectSearch()) return;
    
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
    
    if (e.key === "Escape") {
      e.preventDefault();
      if (showHistory()) {
        setShowHistory(false);
        setHistorySelectedIndex(-1);
      } else if (loading()) {
        cancelSearch();
      } else {
        setShowProjectSearch(false);
      }
      return;
    }
    
    // Handle history navigation when history is shown
    if (showHistory() && searchHistory().length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHistorySelectedIndex(idx => Math.min(idx + 1, searchHistory().length - 1));
        return;
      }
      
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHistorySelectedIndex(idx => Math.max(idx - 1, -1));
        return;
      }
      
      if (e.key === "Enter" && historySelectedIndex() >= 0) {
        e.preventDefault();
        selectHistoryItem(searchHistory()[historySelectedIndex()]);
        return;
      }
    }
    
    if (e.key === "Enter" && !e.shiftKey && !loading()) {
      e.preventDefault();
      if (document.activeElement === inputRef) {
        performSearch(query());
      }
      return;
    }
    
    // Ctrl+Shift+Enter to replace all
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && e.shiftKey && showReplace()) {
      e.preventDefault();
      replaceInAllFiles();
      return;
    }
    
    // Arrow keys for result navigation (only when history is not shown)
    if (!showHistory()) {
      if (e.key === "ArrowDown" && results().length > 0) {
        e.preventDefault();
        const flatResults = getFlatResultsList();
        setSelectedResultIndex(idx => Math.min(idx + 1, flatResults.length - 1));
        return;
      }
      
      if (e.key === "ArrowUp" && results().length > 0) {
        e.preventDefault();
        setSelectedResultIndex(idx => Math.max(idx - 1, 0));
        return;
      }
    }
  };

  const getFlatResultsList = () => {
    const flat: Array<{ file: string; match?: SearchMatch }> = [];
    for (const result of results()) {
      flat.push({ file: result.file });
      if (expandedFiles().has(result.file)) {
        for (const match of result.matches) {
          flat.push({ file: result.file, match });
        }
      }
    }
    return flat;
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown, true);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown, true);
    cancelSearch();
    clearTimeout(searchTimeout);
  });

  const ToggleButton = (props: { 
    active: boolean; 
    onClick: () => void; 
    title: string; 
    children: string;
  }) => (
    <button
      style={{
        padding: "4px 8px",
        "font-size": "11px",
        "border-radius": "var(--cortex-radius-md)",
        transition: "all 0.15s ease",
        "font-weight": "500",
        border: "none",
        cursor: "pointer",
        background: props.active ? "var(--accent-primary)" : "var(--surface-active)",
        color: props.active ? "white" : "var(--text-weak)",
      }}
      onClick={props.onClick}
      title={props.title}
    >
      {props.children}
    </button>
  );

  const getFileDirectory = (path: string) => {
    const lastSlash = path.lastIndexOf("/");
    return lastSlash > 0 ? path.slice(0, lastSlash) : "";
  };

  const getFileName = (path: string) => {
    const lastSlash = path.lastIndexOf("/");
    return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
  };

  return (
    <Show when={showProjectSearch()}>
      <div 
        style={{ 
          position: "fixed",
          inset: "0",
          "z-index": "100",
          display: "flex",
          "animation-duration": "150ms",
          animation: isVisible() ? "fade-in 150ms ease-out forwards" : "none",
        }}
        onClick={() => setShowProjectSearch(false)}
      >
        {/* Backdrop */}
        <div style={{ position: "absolute", inset: "0", background: "rgba(0, 0, 0, 0.5)" }} />
        
        {/* Panel */}
        <div 
          style={{ 
            position: "relative",
            "margin-left": "auto",
            width: "100%",
            "max-width": "520px",
            height: "100%",
            display: "flex",
            "flex-direction": "column",
            background: "var(--surface-raised)",
            "animation-duration": "150ms",
            "box-shadow": "-10px 0 40px -10px rgba(0, 0, 0, 0.5)",
            animation: isVisible() ? "slide-in-right 150ms ease-out forwards" : "none",
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
              "flex-shrink": "0",
            }}
          >
            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
              <Icon name="magnifying-glass" style={{ width: "16px", height: "16px", color: "var(--text-weak)" }} />
              <span style={{ "font-size": "13px", "font-weight": "500", color: "var(--text-base)" }}>
                Search in Project
              </span>
            </div>
            <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
              <Show when={loading()}>
                <button 
                  style={{ 
                    display: "flex",
                    "align-items": "center",
                    gap: "6px",
                    padding: "4px 8px",
                    "font-size": "11px",
                    "border-radius": "var(--cortex-radius-md)",
                    transition: "all 0.15s ease",
                    background: "var(--status-error)", 
                    color: "white",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onClick={cancelSearch}
                  title="Cancel search"
                >
                  <Icon name="circle-stop" style={{ width: "12px", height: "12px" }} />
                  Cancel
                </button>
              </Show>
              <button 
                style={{ 
                  padding: "6px",
                  "border-radius": "var(--cortex-radius-md)",
                  transition: "background 0.15s ease",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
                onClick={() => setShowProjectSearch(false)}
                title="Close (Escape)"
              >
                <Icon name="xmark" style={{ width: "16px", height: "16px", color: "var(--text-weak)" }} />
              </button>
            </div>
          </div>

          {/* Search input */}
          <div style={{ padding: "12px", "border-bottom": "1px solid var(--border-weak)", "flex-shrink": "0", position: "relative" }}>
            <Show
              when={multilineMode()}
              fallback={
                <div 
                  style={{ 
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    padding: "0 12px",
                    height: "36px",
                    "border-radius": "var(--cortex-radius-md)",
                    background: "var(--background-base)",
                    border: searchError() ? "1px solid var(--status-error)" : "1px solid transparent",
                  }}
                >
                  <Icon name="magnifying-glass" style={{ width: "16px", height: "16px", "flex-shrink": "0", color: "var(--text-weak)" }} />
                  <input
                    ref={(el) => inputRef = el}
                    type="text"
                    placeholder="Search for text..."
                    style={{
                      flex: "1",
                      background: "transparent",
                      outline: "none",
                      border: "none",
                      "font-size": "13px",
                      "min-width": "0",
                      color: "var(--text-base)"
                    }}
                    value={query()}
                    onInput={(e) => setQuery(e.currentTarget.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                  />
                  {/* Newline indicator when query has newlines */}
                  <Show when={hasMultilineQuery()}>
                    <span 
                      style={{ 
                        "font-size": "10px",
                        padding: "2px 6px",
                        "border-radius": "var(--cortex-radius-sm)",
                        background: "var(--surface-active)", 
                        color: "var(--text-weak)",
                        "white-space": "nowrap",
                      }}
                      title="Multi-line search pattern"
                    >
                      {queryLineCount()} lines
                    </span>
                  </Show>
                  <Show when={loading()}>
                    <Icon name="spinner" style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite", color: "var(--text-weak)" }} />
                  </Show>
                </div>
              }
            >
              {/* Multi-line search input mode */}
              <div style={{ position: "relative" }}>
                <MultiLineSearchInput
                  ref={(el) => inputRef = el}
                  value={query()}
                  onChange={setQuery}
                  placeholder="Search for text... (Ctrl+Enter for newline)"
                  onSubmit={() => performSearch(query())}
                  error={!!searchError()}
                  icon={<Icon name="magnifying-glass" style={{ width: "16px", height: "16px" }} />}
                  containerStyle={{
                    background: "var(--background-base)",
                    border: searchError() ? "1px solid var(--status-error)" : "1px solid transparent",
                  }}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                />
                <Show when={loading()}>
                  <div style={{ position: "absolute", right: "12px", top: "10px" }}>
                    <Icon name="spinner" style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite", color: "var(--text-weak)" }} />
                  </div>
                </Show>
              </div>
            </Show>

            {/* Search History Dropdown */}
            <Show when={showHistory() && searchHistory().length > 0}>
              <div 
                data-search-history
                style={{ 
                  position: "absolute",
                  left: "12px",
                  right: "12px",
                  "margin-top": "4px",
                  "border-radius": "var(--cortex-radius-md)",
                  overflow: "hidden",
                  "box-shadow": "0 10px 25px rgba(0, 0, 0, 0.3)",
                  "z-index": "10",
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border-weak)",
                  "max-height": "240px",
                  "overflow-y": "auto",
                }}
              >
                <div 
                  style={{ 
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "space-between",
                    padding: "6px 12px",
                    "border-bottom": "1px solid var(--border-weak)" 
                  }}
                >
                  <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
                    <Icon name="clock" style={{ width: "12px", height: "12px", color: "var(--text-weak)" }} />
                    <span style={{ "font-size": "10px", "font-weight": "500", color: "var(--text-weak)" }}>
                      Recent Searches
                    </span>
                  </div>
                  <button
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "4px",
                      padding: "2px 6px",
                      "font-size": "10px",
                      "border-radius": "var(--cortex-radius-sm)",
                      transition: "background 0.15s ease",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: "var(--text-weak)"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      clearSearchHistory();
                    }}
                    title="Clear search history"
                  >
                    <Icon name="trash" style={{ width: "12px", height: "12px" }} />
                    Clear
                  </button>
                </div>
                <For each={searchHistory()}>
                  {(item, index) => (
                    <button
                      style={{ 
                        width: "100%",
                        display: "flex",
                        "align-items": "center",
                        gap: "8px",
                        padding: "8px 12px",
                        "text-align": "left",
                        transition: "background 0.15s ease",
                        border: "none",
                        cursor: "pointer",
                        background: historySelectedIndex() === index() ? "var(--surface-active)" : "transparent",
                      }}
                      onMouseEnter={() => setHistorySelectedIndex(index())}
                      onClick={(e) => {
                        e.preventDefault();
                        selectHistoryItem(item);
                      }}
                    >
                      <Icon name="magnifying-glass" style={{ width: "14px", height: "14px", "flex-shrink": "0", color: "var(--text-weaker)" }} />
                      <span 
                        style={{ 
                          "font-size": "12px",
                          overflow: "hidden",
                          "text-overflow": "ellipsis",
                          "white-space": "nowrap",
                          color: "var(--text-base)" 
                        }}
                      >
                        {item}
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            {/* Filter Suggestions Dropdown */}
            <Show when={showFilterSuggestions() && getFilteredSuggestions().length > 0}>
              <div 
                style={{ 
                  position: "absolute",
                  left: "12px",
                  right: "12px",
                  "margin-top": "4px",
                  "border-radius": "var(--cortex-radius-md)",
                  overflow: "hidden",
                  "box-shadow": "0 10px 25px rgba(0, 0, 0, 0.3)",
                  "z-index": "10",
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border-weak)",
                }}
              >
                <div 
                  style={{ 
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "space-between",
                    padding: "6px 12px",
                    "border-bottom": "1px solid var(--border-weak)" 
                  }}
                >
                  <span style={{ "font-size": "10px", "font-weight": "500", color: "var(--text-weak)" }}>
                    Search Filters
                  </span>
                </div>
                <For each={getFilteredSuggestions()}>
                  {(suggestion, index) => (
                    <button
                      style={{ 
                        width: "100%",
                        display: "flex",
                        "align-items": "center",
                        gap: "8px",
                        padding: "8px 12px",
                        "text-align": "left",
                        transition: "background 0.15s ease",
                        border: "none",
                        cursor: "pointer",
                        background: filterSuggestionIndex() === index() 
                          ? "var(--surface-active)" 
                          : "transparent",
                      }}
                      onMouseEnter={() => setFilterSuggestionIndex(index())}
                      onClick={() => insertFilterSuggestion(suggestion.filter)}
                    >
                      <span 
                        style={{ 
                          "font-size": "12px",
                          "font-family": "'JetBrains Mono', monospace",
                          "font-weight": "500",
                          color: "var(--accent-primary)" 
                        }}
                      >
                        {suggestion.filter}
                      </span>
                      <span 
                        style={{ 
                          "font-size": "11px",
                          overflow: "hidden",
                          "text-overflow": "ellipsis",
                          "white-space": "nowrap",
                          color: "var(--text-weak)" 
                        }}
                      >
                        {suggestion.description}
                      </span>
                    </button>
                  )}
                </For>
                <div 
                  style={{ 
                    padding: "6px 12px",
                    "font-size": "10px",
                    "border-top": "1px solid var(--border-weak)",
                    color: "var(--text-weaker)",
                    background: "var(--surface-base)",
                  }}
                >
                  Tab or Enter to select • Esc to dismiss
                </div>
              </div>
            </Show>

            {/* Replace input */}
            <Show when={showReplace()}>
              <div 
                style={{ 
                  display: "flex",
                  "align-items": "center",
                  gap: "8px",
                  padding: "0 12px",
                  height: "36px",
                  "border-radius": "var(--cortex-radius-md)",
                  "margin-top": "8px",
                  background: "var(--background-base)" 
                }}
              >
                <Icon name="rotate" style={{ width: "16px", height: "16px", "flex-shrink": "0", color: "var(--text-weak)" }} />
                <input
                  ref={(el) => replaceInputRef = el}
                  type="text"
                  placeholder="Replace with..."
                  style={{
                    flex: "1",
                    background: "transparent",
                    outline: "none",
                    border: "none",
                    "font-size": "13px",
                    "min-width": "0",
                    color: "var(--text-base)"
                  }}
                  value={replaceText()}
                  onInput={(e) => {
                    setReplaceText(e.currentTarget.value);
                    if (results().length > 0) {
                      generateReplacePreview(results());
                    }
                  }}
                />
              </div>
            </Show>

            {/* Options */}
            <div style={{ display: "flex", "align-items": "center", gap: "4px", "margin-top": "8px" }}>
              <ToggleButton
                active={caseSensitive()}
                onClick={() => setCaseSensitive(!caseSensitive())}
                title="Case Sensitive"
              >
                Aa
              </ToggleButton>
              <ToggleButton
                active={wholeWord()}
                onClick={() => setWholeWord(!wholeWord())}
                title="Whole Word"
              >
                W
              </ToggleButton>
              <ToggleButton
                active={useRegex()}
                onClick={() => setUseRegex(!useRegex())}
                title="Regular Expression"
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
              
              <div style={{ width: "1px", height: "16px", margin: "0 4px", background: "var(--border-weak)" }} />
              
              {/* Multi-line toggle */}
              <button
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  width: "28px",
                  height: "28px",
                  "border-radius": "var(--cortex-radius-md)",
                  transition: "all 0.15s ease",
                  border: "none",
                  cursor: "pointer",
                  background: multilineMode() ? "var(--accent-primary)" : "var(--surface-active)",
                  color: multilineMode() ? "white" : "var(--text-weak)",
                }}
                onClick={() => setMultilineMode(!multilineMode())}
                title="Multi-line search"
              >
                {multilineMode() 
                  ? <Icon name="minimize" style={{ width: "14px", height: "14px" }} />
                  : <Icon name="maximize" style={{ width: "14px", height: "14px" }} />
                }
              </button>
              
              {/* Context Lines Selector */}
              <div style={{ position: "relative" }}>
                <button
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "2px",
                    padding: "4px 8px",
                    "font-size": "11px",
                    "border-radius": "var(--cortex-radius-md)",
                    transition: "all 0.15s ease",
                    "font-weight": "500",
                    border: "none",
                    cursor: "pointer",
                    background: searchSettings().contextLines > 0 ? "var(--accent-primary)" : "var(--surface-active)",
                    color: searchSettings().contextLines > 0 ? "white" : "var(--text-weak)",
                  }}
                  onClick={() => setShowContextMenu(!showContextMenu())}
                  title={`Context Lines: ${searchSettings().contextLines}`}
                >
                  <Icon name="list" style={{ width: "12px", height: "12px" }} />
                  <span>{searchSettings().contextLines}</span>
                </button>
                <Show when={showContextMenu()}>
                  <div 
                    style={{ 
                      position: "absolute",
                      left: "0",
                      "margin-top": "4px",
                      "border-radius": "var(--cortex-radius-md)",
                      border: "1px solid var(--border-weak)",
                      "box-shadow": "0 10px 25px rgba(0, 0, 0, 0.3)",
                      "z-index": "20",
                      background: "var(--surface-raised)",
                    }}
                  >
                    <div style={{ padding: "4px 0" }}>
                      <For each={[0, 1, 2, 3, 4, 5]}>
                        {(num) => (
                          <button
                            style={{ 
                              width: "100%",
                              padding: "6px 12px",
                              "font-size": "11px",
                              "text-align": "left",
                              transition: "background 0.15s ease",
                              border: "none",
                              cursor: "pointer",
                              color: searchSettings().contextLines === num ? "var(--accent-primary)" : "var(--text-base)",
                              background: searchSettings().contextLines === num ? "var(--surface-active)" : "transparent",
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                            onMouseLeave={(e) => e.currentTarget.style.background = searchSettings().contextLines === num ? "var(--surface-active)" : "transparent"}
                            onClick={() => {
                              updateSearchSetting("contextLines", num);
                              setShowContextMenu(false);
                              // Clear file content cache when changing context lines
                              setFileContentCache({});
                            }}
                          >
                            {num === 0 ? "No context" : `${num} line${num > 1 ? 's' : ''}`}
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
              
              <button
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "6px",
                  padding: "4px 8px",
                  "font-size": "11px",
                  "border-radius": "var(--cortex-radius-md)",
                  transition: "all 0.15s ease",
                  "font-weight": "500",
                  border: "none",
                  cursor: "pointer",
                  background: aiSearchEnabled() ? "var(--accent-primary)" : "var(--surface-active)",
                  color: aiSearchEnabled() ? "white" : "var(--text-weak)",
                }}
                onClick={() => setAISearchEnabled(!aiSearchEnabled())}
                title={aiSearchEnabled() ? "Disable AI-powered semantic search" : "Enable AI-powered semantic search"}
              >
                <Icon name="bolt" style={{ width: "12px", height: "12px" }} />
                AI
              </button>
              
              <Show when={aiSearchEnabled() && !semanticSearch.state.indexReady}>
                <button
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "4px",
                    padding: "4px 8px",
                    "font-size": "10px",
                    "border-radius": "var(--cortex-radius-md)",
                    transition: "background 0.15s ease",
                    border: "none",
                    cursor: "pointer",
                    background: "transparent",
                    color: "var(--status-warning)",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  onClick={() => semanticSearch.indexWorkspace()}
                  title="Index workspace for AI search"
                >
                  <Icon name="database" style={{ width: "12px", height: "12px" }} />
                  Index
                </button>
              </Show>
              
              <button
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "6px",
                  padding: "6px",
                  "border-radius": "var(--cortex-radius-md)",
                  transition: "all 0.15s ease",
                  border: "none",
                  cursor: "pointer",
                  background: searchOpenEditorsOnly() ? "var(--accent-primary)" : "var(--surface-active)",
                  color: searchOpenEditorsOnly() ? "white" : "var(--text-weak)",
                }}
                onClick={() => {
                  setSearchOpenEditorsOnly(!searchOpenEditorsOnly());
                  // Re-trigger search if there's a query
                  if (query().length >= 2) {
                    performSearch(query());
                  }
                }}
                title="Search only in Open Editors"
              >
                <Icon name="file" style={{ width: "14px", height: "14px" }} />
              </button>
              
              <div style={{ flex: "1" }} />
              
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
                  background: showReplace() ? "var(--accent-primary)" : "var(--surface-active)",
                  color: showReplace() ? "white" : "var(--text-weak)",
                }}
                onClick={() => {
                  setShowReplace(!showReplace());
                  if (!showReplace()) {
                    setTimeout(() => replaceInputRef?.focus(), 10);
                  }
                }}
              >
                <Icon name="rotate" style={{ width: "12px", height: "12px" }} />
                Replace
              </button>
            </div>

            {/* Include/Exclude patterns with history */}
            <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "8px", "margin-top": "8px" }}>
              {/* Include pattern with history dropdown */}
              <div style={{ position: "relative" }}>
                <div 
                  style={{ 
                    display: "flex",
                    "align-items": "center",
                    "border-radius": "var(--cortex-radius-md)",
                    background: "var(--background-base)",
                  }}
                >
                  <input
                    ref={includeInputRef}
                    type="text"
                    placeholder="Include: *.ts, src/**"
                    style={{ 
                      flex: "1",
                      padding: "6px 8px",
                      "border-radius": "6px 0 0 6px",
                      "font-size": "11px",
                      outline: "none",
                      border: "none",
                      background: "transparent",
                      color: "var(--text-base)",
                    }}
                    value={includePattern()}
                    onInput={(e) => setIncludePattern(e.currentTarget.value)}
                    onFocus={() => {
                      if (includeHistory().length > 0) {
                        setShowIncludeHistory(true);
                        setIncludeHistoryIndex(-1);
                      }
                    }}
                    onBlur={() => setTimeout(() => setShowIncludeHistory(false), 150)}
                    onKeyDown={(e) => {
                      if (showIncludeHistory() && includeHistory().length > 0) {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setIncludeHistoryIndex(i => Math.min(i + 1, includeHistory().length - 1));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setIncludeHistoryIndex(i => Math.max(i - 1, -1));
                        } else if (e.key === "Enter" && includeHistoryIndex() >= 0) {
                          e.preventDefault();
                          setIncludePattern(includeHistory()[includeHistoryIndex()]);
                          setShowIncludeHistory(false);
                        } else if (e.key === "Escape") {
                          setShowIncludeHistory(false);
                        }
                      }
                    }}
                  />
                  <Show when={includeHistory().length > 0}>
                    <button
                      type="button"
                      style={{
                        padding: "4px 6px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-weak)",
                        "border-radius": "0 6px 6px 0",
                      }}
                      onClick={() => {
                        setShowIncludeHistory(!showIncludeHistory());
                        setIncludeHistoryIndex(-1);
                        includeInputRef?.focus();
                      }}
                      title="Show include pattern history"
                    >
                      <Icon name="chevron-down" style={{ width: "12px", height: "12px" }} />
                    </button>
                  </Show>
                </div>
                
                {/* Include History Dropdown */}
                <Show when={showIncludeHistory() && includeHistory().length > 0}>
                  <div 
                    style={{ 
                      position: "absolute",
                      left: "0",
                      right: "0",
                      top: "100%",
                      "margin-top": "2px",
                      "border-radius": "var(--cortex-radius-md)",
                      overflow: "hidden",
                      "box-shadow": "0 10px 25px rgba(0, 0, 0, 0.3)",
                      "z-index": "20",
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border-weak)",
                      "max-height": "160px",
                      "overflow-y": "auto",
                    }}
                  >
                    <div 
                      style={{ 
                        display: "flex",
                        "align-items": "center",
                        "justify-content": "space-between",
                        padding: "4px 8px",
                        "border-bottom": "1px solid var(--border-weak)" 
                      }}
                    >
                      <span style={{ "font-size": "9px", "font-weight": "500", color: "var(--text-weaker)" }}>
                        Include History
                      </span>
                      <button
                        style={{
                          padding: "2px 4px",
                          "font-size": "9px",
                          "border-radius": "var(--cortex-radius-sm)",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: "var(--text-weak)"
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIncludeHistory([]);
                          savePatternHistory(INCLUDE_HISTORY_KEY, []);
                          setShowIncludeHistory(false);
                        }}
                        title="Clear history"
                      >
                        <Icon name="trash" style={{ width: "10px", height: "10px" }} />
                      </button>
                    </div>
                    <For each={includeHistory()}>
                      {(item, index) => (
                        <button
                          style={{ 
                            width: "100%",
                            padding: "6px 8px",
                            "font-size": "11px",
                            "text-align": "left",
                            border: "none",
                            cursor: "pointer",
                            background: includeHistoryIndex() === index() ? "var(--surface-active)" : "transparent",
                            color: "var(--text-base)",
                            overflow: "hidden",
                            "text-overflow": "ellipsis",
                            "white-space": "nowrap",
                          }}
                          onMouseEnter={() => setIncludeHistoryIndex(index())}
                          onClick={(e) => {
                            e.preventDefault();
                            setIncludePattern(item);
                            setShowIncludeHistory(false);
                            includeInputRef?.focus();
                          }}
                        >
                          {item}
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
              
              {/* Exclude pattern with history dropdown */}
              <div style={{ position: "relative" }}>
                <div 
                  style={{ 
                    display: "flex",
                    "align-items": "center",
                    "border-radius": "var(--cortex-radius-md)",
                    background: "var(--background-base)",
                  }}
                >
                  <input
                    ref={excludeInputRef}
                    type="text"
                    placeholder="Exclude: node_modules, dist"
                    style={{ 
                      flex: "1",
                      padding: "6px 8px",
                      "border-radius": "6px 0 0 6px",
                      "font-size": "11px",
                      outline: "none",
                      border: "none",
                      background: "transparent",
                      color: "var(--text-base)",
                    }}
                    value={excludePattern()}
                    onInput={(e) => setExcludePattern(e.currentTarget.value)}
                    onFocus={() => {
                      if (excludeHistory().length > 0) {
                        setShowExcludeHistory(true);
                        setExcludeHistoryIndex(-1);
                      }
                    }}
                    onBlur={() => setTimeout(() => setShowExcludeHistory(false), 150)}
                    onKeyDown={(e) => {
                      if (showExcludeHistory() && excludeHistory().length > 0) {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setExcludeHistoryIndex(i => Math.min(i + 1, excludeHistory().length - 1));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setExcludeHistoryIndex(i => Math.max(i - 1, -1));
                        } else if (e.key === "Enter" && excludeHistoryIndex() >= 0) {
                          e.preventDefault();
                          setExcludePattern(excludeHistory()[excludeHistoryIndex()]);
                          setShowExcludeHistory(false);
                        } else if (e.key === "Escape") {
                          setShowExcludeHistory(false);
                        }
                      }
                    }}
                  />
                  <Show when={excludeHistory().length > 0}>
                    <button
                      type="button"
                      style={{
                        padding: "4px 6px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-weak)",
                        "border-radius": "0 6px 6px 0",
                      }}
                      onClick={() => {
                        setShowExcludeHistory(!showExcludeHistory());
                        setExcludeHistoryIndex(-1);
                        excludeInputRef?.focus();
                      }}
                      title="Show exclude pattern history"
                    >
                      <Icon name="chevron-down" style={{ width: "12px", height: "12px" }} />
                    </button>
                  </Show>
                </div>
                
                {/* Exclude History Dropdown */}
                <Show when={showExcludeHistory() && excludeHistory().length > 0}>
                  <div 
                    style={{ 
                      position: "absolute",
                      left: "0",
                      right: "0",
                      top: "100%",
                      "margin-top": "2px",
                      "border-radius": "var(--cortex-radius-md)",
                      overflow: "hidden",
                      "box-shadow": "0 10px 25px rgba(0, 0, 0, 0.3)",
                      "z-index": "20",
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border-weak)",
                      "max-height": "160px",
                      "overflow-y": "auto",
                    }}
                  >
                    <div 
                      style={{ 
                        display: "flex",
                        "align-items": "center",
                        "justify-content": "space-between",
                        padding: "4px 8px",
                        "border-bottom": "1px solid var(--border-weak)" 
                      }}
                    >
                      <span style={{ "font-size": "9px", "font-weight": "500", color: "var(--text-weaker)" }}>
                        Exclude History
                      </span>
                      <button
                        style={{
                          padding: "2px 4px",
                          "font-size": "9px",
                          "border-radius": "var(--cortex-radius-sm)",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: "var(--text-weak)"
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setExcludeHistory([]);
                          savePatternHistory(EXCLUDE_HISTORY_KEY, []);
                          setShowExcludeHistory(false);
                        }}
                        title="Clear history"
                      >
                        <Icon name="trash" style={{ width: "10px", height: "10px" }} />
                      </button>
                    </div>
                    <For each={excludeHistory()}>
                      {(item, index) => (
                        <button
                          style={{ 
                            width: "100%",
                            padding: "6px 8px",
                            "font-size": "11px",
                            "text-align": "left",
                            border: "none",
                            cursor: "pointer",
                            background: excludeHistoryIndex() === index() ? "var(--surface-active)" : "transparent",
                            color: "var(--text-base)",
                            overflow: "hidden",
                            "text-overflow": "ellipsis",
                            "white-space": "nowrap",
                          }}
                          onMouseEnter={() => setExcludeHistoryIndex(index())}
                          onClick={(e) => {
                            e.preventDefault();
                            setExcludePattern(item);
                            setShowExcludeHistory(false);
                            excludeInputRef?.focus();
                          }}
                        >
                          {item}
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
          </div>

          {/* Error message */}
          <Show when={searchError()}>
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
              {searchError()}
            </div>
          </Show>

          {/* Indexing indicator */}
          <Show when={aiSearchEnabled() && semanticSearch.state.indexingStatus === "indexing"}>
            <div 
              style={{ 
                display: "flex",
                "align-items": "center",
                gap: "8px",
                padding: "8px 16px",
                "font-size": "11px",
                "border-bottom": "1px solid var(--border-weak)",
                "flex-shrink": "0",
                background: "var(--accent-primary-bg)",
              }}
            >
              <Icon name="spinner" style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite", color: "var(--accent-primary)" }} />
              <span style={{ color: "var(--text-base)" }}>
                Indexing for AI search: {semanticSearch.state.indexingProgress}%
              </span>
              <button
                style={{
                  "margin-left": "auto",
                  padding: "2px 8px",
                  "font-size": "10px",
                  "border-radius": "var(--cortex-radius-sm)",
                  transition: "background 0.15s ease",
                  border: "none",
                  cursor: "pointer",
                  background: "transparent",
                  color: "var(--text-weak)",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                onClick={() => semanticSearch.cancelIndexing()}
              >
                Cancel
              </button>
            </div>
          </Show>

          {/* Results count and replace all */}
          <Show when={results().length > 0 || aiResults().length > 0 || (query().length >= 2 && !loading())}>
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
                {results().length > 0 
                  ? `${totalMatches()} result${totalMatches() !== 1 ? "s" : ""} in ${results().length} file${results().length !== 1 ? "s" : ""}${aiSearchEnabled() && aiResults().length > 0 ? ` • ${aiResults().length} AI match${aiResults().length !== 1 ? "es" : ""}` : ""}${replacePreview().length > 0 ? ` (${replacePreview().length} preview${replacePreview().length !== 1 ? "s" : ""})` : ""}`
                  : aiResults().length > 0
                    ? `${aiResults().length} AI result${aiResults().length !== 1 ? "s" : ""}`
                    : "No results found"
                }
              </span>
              <Show when={showReplace() && results().length > 0}>
                <button
                  style={{ 
                    padding: "4px 8px",
                    "font-size": "11px",
                    "border-radius": "var(--cortex-radius-md)",
                    transition: "all 0.15s ease",
                    "font-weight": "500",
                    border: "none",
                    cursor: "pointer",
                    background: "var(--accent-primary)", 
                    color: "white",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "var(--accent-primary)"}
                  onClick={replaceInAllFiles}
                  disabled={loading()}
                  title="Replace in all files (Ctrl+Shift+Enter)"
                >
                  Replace All
                </button>
              </Show>
            </div>
          </Show>

          {/* Results */}
          <div style={{ flex: "1", "overflow-y": "auto", "overscroll-behavior": "contain" }}>
            <Show when={query().length < 2 && results().length === 0}>
              <div style={{ padding: "32px 16px", "text-align": "center" }}>
                <p style={{ "font-size": "13px", color: "var(--text-weak)" }}>
                  Type at least 2 characters to search
                </p>
              </div>
            </Show>

            <For each={results()}>
              {(result) => (
                <div style={{ "border-bottom": "1px solid var(--border-weak)" }}>
                  {/* File header - VS Code style: bold, collapsible */}
                  <button
                    style={{
                      width: "100%",
                      display: "flex",
                      "align-items": "center",
                      gap: "8px",
                      padding: "0 16px",
                      height: "32px",
                      "text-align": "left",
                      transition: "background 0.15s ease",
                      border: "none",
                      cursor: "pointer",
                      background: "var(--surface-active)",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "var(--surface-active)"}
                    onClick={() => toggleFile(result.file)}
                  >
                    <span style={{ "flex-shrink": "0", transition: "transform 0.15s ease", color: "var(--text-weak)" }}>
                      {expandedFiles().has(result.file) 
                        ? <Icon name="chevron-down" style={{ width: "16px", height: "16px" }} />
                        : <Icon name="chevron-right" style={{ width: "16px", height: "16px" }} />
                      }
                    </span>
                    <Icon name="file" style={{ width: "16px", height: "16px", "flex-shrink": "0", color: "var(--accent-primary)" }} />
                    <span style={{ "font-size": "13px", "font-weight": "bold", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", color: "var(--text-base)" }}>
                      {getFileName(result.file)}
                    </span>
                    <Show when={getFileDirectory(result.file)}>
                      <span style={{ "font-size": "11px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", "margin-left": "4px", color: "var(--text-weaker)" }}>
                        {getFileDirectory(result.file)}
                      </span>
                    </Show>
                    <div style={{ "margin-left": "auto", display: "flex", "align-items": "center", gap: "8px", "flex-shrink": "0" }}>
                      <Show when={showReplace()}>
                        <button
                          style={{
                            padding: "2px 6px",
                            "font-size": "10px",
                            "border-radius": "var(--cortex-radius-sm)",
                            transition: "background 0.15s ease",
                            border: "none",
                            cursor: "pointer",
                            background: "var(--surface-active)",
                            color: "var(--text-weak)",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "var(--surface-active)"}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const success = await replaceInFile(result.file);
                            if (success) {
                              window.dispatchEvent(new CustomEvent("notification", { 
                                detail: { type: "success", message: `Replaced in ${result.file}` } 
                              }));
                              // Refresh search results
                              await performSearch(query());
                            } else {
                              window.dispatchEvent(new CustomEvent("notification", { 
                                detail: { type: "error", message: `Failed to replace in ${result.file}` } 
                              }));
                            }
                          }}
                          disabled={loading()}
                          title="Replace in this file"
                        >
                          Replace
                        </button>
                      </Show>
                      <span 
                        style={{ "font-size": "10px", padding: "2px 6px", "border-radius": "var(--cortex-radius-md)", "font-family": "'JetBrains Mono', monospace", background: "var(--surface-active)", color: "var(--text-weak)" }}
                      >
                        {result.matches.length}
                      </span>
                    </div>
                  </button>

                  {/* Matches - VS Code style: 13px monospace, muted line numbers with right margin */}
                  <Show when={expandedFiles().has(result.file)}>
                    <div style={{ padding: "4px 0", background: "var(--background-base)" }}>
                      <For each={result.matches}>
                        {(match, matchIndex) => {
                          const contextLines = getContextLines(result.file, match.line);
                          const prevMatch = matchIndex() > 0 ? result.matches[matchIndex() - 1] : null;
                          const showBeforeContext = searchSettings().contextLines > 0 && contextLines.before.length > 0;
                          
                          return (
                            <>
                              {/* Context lines before - dimmed styling */}
                              <Show when={showBeforeContext}>
                                <For each={contextLines.before}>
                                  {(line, lineIdx) => {
                                    const lineNum = match.line - contextLines.before.length + lineIdx();
                                    // Skip if this line overlaps with previous match's after-context
                                    const skip = prevMatch && lineNum <= prevMatch.line + searchSettings().contextLines;
                                    return (
                                      <Show when={!skip}>
                                        <button
                                          style={{
                                            width: "100%",
                                            display: "flex",
                                            "align-items": "center",
                                            gap: "0",
                                            padding: "3px 16px 3px 24px",
                                            "text-align": "left",
                                            transition: "background 0.15s ease",
                                            border: "none",
                                            cursor: "pointer",
                                            background: "transparent",
                                            opacity: 0.5,
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"}
                                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                          onClick={() => openMatch(result.file, lineNum, 1)}
                                        >
                                          <Show when={searchSettings().showLineNumbers}>
                                            <span 
                                              style={{ 
                                                "flex-shrink": "0", 
                                                width: "40px", 
                                                "text-align": "right", 
                                                "font-size": "12px", 
                                                "font-family": "'JetBrains Mono', monospace", 
                                                "margin-right": "16px", 
                                                "user-select": "none",
                                                color: "var(--text-weaker)", 
                                                opacity: "0.7",
                                              }}
                                            >
                                              {lineNum}
                                            </span>
                                          </Show>
                                          <span 
                                            style={{ 
                                              "font-size": "13px", 
                                              "font-family": "'JetBrains Mono', monospace", 
                                              overflow: "hidden", 
                                              "text-overflow": "ellipsis", 
                                              "line-height": "1.4", 
                                              flex: "1", 
                                              "white-space": "pre",
                                              color: "var(--text-weaker)",
                                            }}
                                          >
                                            {line.trim()}
                                          </span>
                                        </button>
                                      </Show>
                                    );
                                  }}
                                </For>
                              </Show>
                              
                              {/* Match line */}
                              <button
                                style={{
                                  width: "100%",
                                  display: "flex",
                                  "align-items": "center",
                                  gap: "0",
                                  padding: "3px 16px 3px 24px",
                                  "text-align": "left",
                                  transition: "background 0.15s ease",
                                  border: "none",
                                  cursor: "pointer",
                                  background: "transparent",
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                onClick={() => openMatch(result.file, match.line, match.column)}
                              >
                                {/* Line number - VS Code style: muted, right margin */}
                                <Show when={searchSettings().showLineNumbers}>
                                  <span 
                                    style={{ 
                                      "flex-shrink": "0", 
                                      width: "40px", 
                                      "text-align": "right", 
                                      "font-size": "12px", 
                                      "font-family": "'JetBrains Mono', monospace", 
                                      "margin-right": "16px", 
                                      "user-select": "none",
                                      color: "var(--text-weaker)", 
                                      opacity: "0.7",
                                    }}
                                  >
                                    {match.line}
                                  </span>
                                </Show>
                                {/* Match line - VS Code style: 13px, monospace */}
                                <span 
                                  style={{ 
                                    "font-size": "13px", 
                                    "font-family": "'JetBrains Mono', monospace", 
                                    overflow: "hidden", 
                                    "text-overflow": "ellipsis", 
                                    "line-height": "1.4", 
                                    flex: "1", 
                                    "white-space": "pre",
                                    color: "var(--text-weak)",
                                  }}
                                >
                                  {highlightMatch(match.text.trim(), match.matchStart, match.matchEnd)}
                                </span>
                              </button>
                              
                              {/* Context lines after - dimmed styling */}
                              <Show when={searchSettings().contextLines > 0 && contextLines.after.length > 0}>
                                <For each={contextLines.after}>
                                  {(line, lineIdx) => {
                                    const lineNum = match.line + 1 + lineIdx();
                                    const nextMatch = matchIndex() < result.matches.length - 1 ? result.matches[matchIndex() + 1] : null;
                                    // Skip if this line will be shown as before-context of next match
                                    const skip = nextMatch && lineNum >= nextMatch.line - searchSettings().contextLines;
                                    return (
                                      <Show when={!skip}>
                                        <button
                                          style={{
                                            width: "100%",
                                            display: "flex",
                                            "align-items": "center",
                                            gap: "0",
                                            padding: "3px 16px 3px 24px",
                                            "text-align": "left",
                                            transition: "background 0.15s ease",
                                            border: "none",
                                            cursor: "pointer",
                                            background: "transparent",
                                            opacity: 0.5,
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"}
                                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                          onClick={() => openMatch(result.file, lineNum, 1)}
                                        >
                                          <Show when={searchSettings().showLineNumbers}>
                                            <span 
                                              style={{ 
                                                "flex-shrink": "0", 
                                                width: "40px", 
                                                "text-align": "right", 
                                                "font-size": "12px", 
                                                "font-family": "'JetBrains Mono', monospace", 
                                                "margin-right": "16px", 
                                                "user-select": "none",
                                                color: "var(--text-weaker)", 
                                                opacity: "0.7",
                                              }}
                                            >
                                              {lineNum}
                                            </span>
                                          </Show>
                                          <span 
                                            style={{ 
                                              "font-size": "13px", 
                                              "font-family": "'JetBrains Mono', monospace", 
                                              overflow: "hidden", 
                                              "text-overflow": "ellipsis", 
                                              "line-height": "1.4", 
                                              flex: "1", 
                                              "white-space": "pre",
                                              color: "var(--text-weaker)",
                                            }}
                                          >
                                            {line.trim()}
                                          </span>
                                        </button>
                                      </Show>
                                    );
                                  }}
                                </For>
                              </Show>
                            </>
                          );
                        }}
                      </For>
                    </div>
                  </Show>
                </div>
              )}
            </For>
            
            {/* AI Search Results Section */}
            <Show when={aiSearchEnabled() && aiResults().length > 0}>
              <div 
                style={{ "border-top": "1px solid var(--border-weak)", "padding-top": "8px", "margin-top": "8px" }}
              >
                <div 
                  style={{ 
                    display: "flex", 
                    "align-items": "center", 
                    gap: "8px", 
                    padding: "6px 16px",
                    background: "var(--surface-active)",
                  }}
                >
                  <Icon name="bolt" style={{ width: "14px", height: "14px", color: "var(--accent-primary)" }} />
                  <span style={{ "font-size": "11px", "font-weight": "500", color: "var(--text-base)" }}>
                    AI Semantic Matches
                  </span>
                  <span 
                    style={{ 
                      "font-size": "10px", 
                      padding: "2px 6px", 
                      "border-radius": "var(--cortex-radius-md)", 
                      "font-family": "'JetBrains Mono', monospace",
                      background: "var(--surface-raised)", 
                      color: "var(--text-weak)",
                    }}
                  >
                    {aiResults().length}
                  </span>
                </div>
                <For each={aiResults()}>
                  {(aiResult) => (
                    <button
                      style={{
                        width: "100%",
                        display: "flex",
                        "align-items": "center",
                        gap: "8px",
                        padding: "0 16px",
                        height: "40px",
                        "text-align": "left",
                        transition: "background 0.15s ease",
                        border: "none",
                        "border-bottom": "1px solid var(--border-weak)",
                        cursor: "pointer",
                        background: "transparent",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      onClick={async () => {
                        const projectPath = getProjectPath();
                        const fullPath = projectPath ? `${projectPath}/${aiResult.file}` : aiResult.file;
                        await openFile(fullPath);
                        setTimeout(() => {
                          window.dispatchEvent(new CustomEvent("goto-line", {
                            detail: { line: aiResult.startLine + 1, column: 1 },
                          }));
                        }, 100);
                      }}
                    >
                      <Icon name="file" style={{ width: "14px", height: "14px", "flex-shrink": "0", color: "var(--text-weak)" }} />
                      <span style={{ "font-size": "12px", "font-weight": "500", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", color: "var(--text-base)" }}>
                        {getFileName(aiResult.file)}
                      </span>
                      <Show when={getFileDirectory(aiResult.file)}>
                        <span style={{ "font-size": "11px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", color: "var(--text-weaker)" }}>
                          {getFileDirectory(aiResult.file)}
                        </span>
                      </Show>
                      <div style={{ "margin-left": "auto", display: "flex", "align-items": "center", gap: "8px", "flex-shrink": "0" }}>
                        <span 
                          style={{ 
                            "font-size": "10px", 
                            padding: "2px 6px", 
                            "border-radius": "var(--cortex-radius-md)", 
                            "font-family": "'JetBrains Mono', monospace",
                            background: aiResult.similarity >= 0.7 
                              ? "var(--status-success-bg)" 
                              : aiResult.similarity >= 0.5 
                                ? "var(--status-warning-bg)" 
                                : "var(--surface-active)",
                            color: aiResult.similarity >= 0.7 
                              ? "var(--status-success)" 
                              : aiResult.similarity >= 0.5 
                                ? "var(--status-warning)" 
                                : "var(--text-weak)",
                          }}
                          title="Semantic similarity score"
                        >
                          {Math.round(aiResult.similarity * 100)}%
                        </span>
                        <span 
                          style={{ 
                            "font-size": "10px", 
                            padding: "2px 6px", 
                            "border-radius": "var(--cortex-radius-md)", 
                            "font-family": "'JetBrains Mono', monospace",
                            background: "var(--surface-active)", 
                            color: "var(--text-weak)",
                          }}
                        >
                          L{aiResult.startLine + 1}
                        </span>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
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
              <kbd style={{ "font-family": "'JetBrains Mono', monospace" }}>Enter</kbd> search • <kbd style={{ "font-family": "'JetBrains Mono', monospace" }}>↑↓</kbd> navigate
            </span>
            <span>
              <Show when={showReplace()}>
                <kbd style={{ "font-family": "'JetBrains Mono', monospace" }}>Ctrl+Shift+Enter</kbd> replace all •{" "}
              </Show>
              <kbd style={{ "font-family": "'JetBrains Mono', monospace" }}>Esc</kbd> close
            </span>
          </div>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-in-right {
          from { 
            opacity: 0;
            transform: translateX(20px);
          }
          to { 
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 150ms ease-out forwards;
        }
        .animate-slide-in-right {
          animation: slide-in-right 150ms ease-out forwards;
        }
      `}</style>
    </Show>
  );
}

