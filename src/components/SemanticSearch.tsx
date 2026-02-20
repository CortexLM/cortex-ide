import { createSignal, createEffect, For, Show, onMount, onCleanup, batch, JSX } from "solid-js";
import { useSemanticSearch, SemanticSearchResult } from "@/context/SemanticSearchContext";
import { useEditor } from "@/context/EditorContext";
import { Icon } from "./ui/Icon";
import { getProjectPath } from "../utils/workspace";

interface SemanticSearchProps {
  /** Whether to show as standalone panel (true) or inline mode (false) */
  standalone?: boolean;
  /** Callback when a result is selected */
  onResultSelect?: (result: SemanticSearchResult) => void;
  /** External control for visibility */
  visible?: boolean;
  /** Callback to close the panel */
  onClose?: () => void;
}

/**
 * Highlight matching terms in content
 */
function highlightContent(content: string, query: string): JSX.Element {
  if (!query.trim()) {
    return <span>{content}</span>;
  }
  
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (terms.length === 0) {
    return <span>{content}</span>;
  }
  
  // Find all match positions
  const lowerContent = content.toLowerCase();
  const matches: Array<{ start: number; end: number }> = [];
  
  for (const term of terms) {
    let pos = 0;
    while ((pos = lowerContent.indexOf(term, pos)) !== -1) {
      matches.push({ start: pos, end: pos + term.length });
      pos += 1;
    }
  }
  
  // Sort and merge overlapping matches
  matches.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  
  for (const match of matches) {
    if (merged.length === 0 || merged[merged.length - 1].end < match.start) {
      merged.push(match);
    } else {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, match.end);
    }
  }
  
  if (merged.length === 0) {
    return <span>{content}</span>;
  }
  
  // Build highlighted output
  const parts: JSX.Element[] = [];
  let lastEnd = 0;
  
  for (let i = 0; i < merged.length; i++) {
    const match = merged[i];
    if (match.start > lastEnd) {
      parts.push(<span>{content.slice(lastEnd, match.start)}</span>);
    }
    parts.push(
      <span
        class="px-0.5 rounded-sm font-medium"
        style={{ background: "var(--accent-primary)", color: "white" }}
      >
        {content.slice(match.start, match.end)}
      </span>
    );
    lastEnd = match.end;
  }
  
  if (lastEnd < content.length) {
    parts.push(<span>{content.slice(lastEnd)}</span>);
  }
  
  return <>{parts}</>;
}

/**
 * Format similarity score as percentage
 */
function formatSimilarity(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Get color class based on similarity score
 */
function getSimilarityColor(score: number): string {
  if (score >= 0.7) return "var(--status-success)";
  if (score >= 0.5) return "var(--status-warning)";
  return "var(--text-weak)";
}

/**
 * Get file name from path
 */
function getFileName(path: string): string {
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
}

/**
 * Get directory from path
 */
function getDirectory(path: string): string {
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return lastSlash > 0 ? path.slice(0, lastSlash) : "";
}

/**
 * Truncate content for preview
 */
function truncateContent(content: string, maxLength: number = 200): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + "...";
}

export function SemanticSearch(props: SemanticSearchProps) {
  const semanticSearch = useSemanticSearch();
  const editor = useEditor();
  
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<SemanticSearchResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [expandedResults, setExpandedResults] = createSignal<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [showStats, setShowStats] = createSignal(false);
  
  let inputRef: HTMLInputElement | undefined;
  let searchTimeout: number | undefined;
  let resultsRef: HTMLDivElement | undefined;
  
  // Focus input on mount
  onMount(() => {
    if (props.visible !== false) {
      setTimeout(() => inputRef?.focus(), 50);
    }
  });
  
  // Debounced search
  createEffect(() => {
    const q = query();
    
    clearTimeout(searchTimeout);
    
    if (q.length < 2) {
      setResults([]);
      return;
    }
    
    searchTimeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const searchResults = await semanticSearch.search(q, 30);
        batch(() => {
          setResults(searchResults);
          setSelectedIndex(0);
          // Auto-expand first 3 results
          const expanded = new Set<string>();
          searchResults.slice(0, 3).forEach(r => expanded.add(r.chunkId));
          setExpandedResults(expanded);
        });
      } catch (e) {
        console.error("Semantic search failed:", e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  });
  
  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      props.onClose?.();
      return;
    }
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(idx => Math.min(idx + 1, results().length - 1));
      scrollToSelected();
      return;
    }
    
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(idx => Math.max(idx - 1, 0));
      scrollToSelected();
      return;
    }
    
    if (e.key === "Enter") {
      e.preventDefault();
      const currentResults = results();
      const idx = selectedIndex();
      if (currentResults.length > 0 && idx < currentResults.length) {
        handleResultClick(currentResults[idx]);
      }
      return;
    }
  };
  
  const scrollToSelected = () => {
    if (resultsRef) {
      const selected = resultsRef.querySelector(`[data-index="${selectedIndex()}"]`);
      selected?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };
  
  const handleResultClick = async (result: SemanticSearchResult) => {
    if (props.onResultSelect) {
      props.onResultSelect(result);
      return;
    }
    
    // Default behavior: open file at line
    const projectPath = getProjectPath();
    const fullPath = projectPath ? `${projectPath}/${result.file}` : result.file;
    
    await editor.openFile(fullPath);
    
    // Navigate to the line
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("goto-line", {
        detail: { line: result.startLine + 1, column: 1 },
      }));
    }, 100);
    
    props.onClose?.();
  };
  
  const toggleResultExpanded = (chunkId: string) => {
    const expanded = new Set(expandedResults());
    if (expanded.has(chunkId)) {
      expanded.delete(chunkId);
    } else {
      expanded.add(chunkId);
    }
    setExpandedResults(expanded);
  };
  
  const stats = () => semanticSearch.getIndexStats();
  
  onCleanup(() => {
    clearTimeout(searchTimeout);
  });
  
  // Indexing status indicator
  const IndexingIndicator = () => (
    <Show when={semanticSearch.state.indexingStatus === "indexing"}>
      <div 
        class="flex items-center gap-2 px-3 py-2 text-[11px] border-b"
        style={{ 
          "border-color": "var(--border-weak)",
          background: "var(--accent-primary-bg)",
        }}
      >
        <Icon name="spinner" class="w-3.5 h-3.5 animate-spin" style={{ color: "var(--accent-primary)" }} />
        <span style={{ color: "var(--text-base)" }}>
          Indexing: {semanticSearch.state.indexingProgress}%
        </span>
        <Show when={semanticSearch.state.indexingCurrentFile}>
          <span 
            class="truncate flex-1"
            style={{ color: "var(--text-weak)" }}
            title={semanticSearch.state.indexingCurrentFile || ""}
          >
            {getFileName(semanticSearch.state.indexingCurrentFile || "")}
          </span>
        </Show>
        <button
          class="px-2 py-0.5 text-[10px] rounded hover:bg-white/10 transition-colors"
          style={{ color: "var(--text-weak)" }}
          onClick={() => semanticSearch.cancelIndexing()}
        >
          Cancel
        </button>
      </div>
    </Show>
  );
  
  // Error indicator
  const ErrorIndicator = () => (
    <Show when={semanticSearch.state.lastError}>
      <div 
        class="flex items-center gap-2 px-3 py-2 text-[11px] border-b"
        style={{ 
          "border-color": "var(--border-weak)",
          background: "var(--status-error-bg)",
          color: "var(--status-error)",
        }}
      >
        <Icon name="circle-exclamation" class="w-3.5 h-3.5" />
        <span class="flex-1 truncate">{semanticSearch.state.lastError}</span>
      </div>
    </Show>
  );
  
  // Stats panel
  const StatsPanel = () => (
    <Show when={showStats()}>
      <div 
        class="px-3 py-2 text-[11px] border-b space-y-1"
        style={{ 
          "border-color": "var(--border-weak)",
          background: "var(--surface-active)",
        }}
      >
        <div class="flex justify-between">
          <span style={{ color: "var(--text-weak)" }}>Indexed Files:</span>
          <span style={{ color: "var(--text-base)" }}>{stats().totalFiles}</span>
        </div>
        <div class="flex justify-between">
          <span style={{ color: "var(--text-weak)" }}>Total Chunks:</span>
          <span style={{ color: "var(--text-base)" }}>{stats().totalChunks}</span>
        </div>
        <div class="flex justify-between">
          <span style={{ color: "var(--text-weak)" }}>Cache Size:</span>
          <span style={{ color: "var(--text-base)" }}>{(stats().cacheSize / 1024).toFixed(1)} KB</span>
        </div>
        <div class="flex justify-between">
          <span style={{ color: "var(--text-weak)" }}>Model:</span>
          <span style={{ color: "var(--text-base)" }}>{semanticSearch.state.modelId}</span>
        </div>
      </div>
    </Show>
  );
  
  // Action buttons
  const ActionButtons = () => (
    <div class="flex items-center gap-1">
      <button
        class="p-1.5 rounded-md hover:bg-white/10 transition-colors"
        style={{ color: "var(--text-weak)" }}
        onClick={() => setShowStats(!showStats())}
        title="Index Statistics"
      >
        <Icon name="database" class="w-3.5 h-3.5" />
      </button>
      <button
        class="p-1.5 rounded-md hover:bg-white/10 transition-colors"
        style={{ color: semanticSearch.state.indexingStatus === "indexing" ? "var(--accent-primary)" : "var(--text-weak)" }}
        onClick={() => {
          if (semanticSearch.state.indexingStatus === "indexing") {
            semanticSearch.cancelIndexing();
          } else {
            semanticSearch.indexWorkspace();
          }
        }}
        title={semanticSearch.state.indexingStatus === "indexing" ? "Cancel Indexing" : "Re-index Workspace"}
      >
        <Show 
          when={semanticSearch.state.indexingStatus === "indexing"}
          fallback={<Icon name="rotate" class="w-3.5 h-3.5" />}
        >
          <Icon name="spinner" class="w-3.5 h-3.5 animate-spin" />
        </Show>
      </button>
      <button
        class="p-1.5 rounded-md hover:bg-white/10 transition-colors"
        style={{ color: "var(--text-weak)" }}
        onClick={() => {
          if (confirm("Clear the entire semantic search index?")) {
            semanticSearch.clearIndex();
            setResults([]);
          }
        }}
        title="Clear Index"
      >
        <Icon name="trash" class="w-3.5 h-3.5" />
      </button>
    </div>
  );
  
  // No results message
  const NoResults = () => (
    <div class="px-4 py-8 text-center">
      <Show 
        when={semanticSearch.state.indexReady}
        fallback={
          <div class="space-y-3">
            <Icon name="database" class="w-8 h-8 mx-auto" style={{ color: "var(--text-weaker)" }} />
            <p class="text-[13px]" style={{ color: "var(--text-weak)" }}>
              No files indexed yet
            </p>
            <button
              class="px-3 py-1.5 text-[12px] rounded-md transition-colors"
              style={{ 
                background: "var(--accent-primary)",
                color: "white",
              }}
              onClick={() => semanticSearch.indexWorkspace()}
            >
              Index Workspace
            </button>
          </div>
        }
      >
        <Show when={query().length >= 2}>
          <p class="text-[13px]" style={{ color: "var(--text-weak)" }}>
            No results found for "{query()}"
          </p>
          <p class="text-[11px] mt-2" style={{ color: "var(--text-weaker)" }}>
            Try different search terms or re-index the workspace
          </p>
        </Show>
        <Show when={query().length < 2}>
          <div class="space-y-2">
            <Icon name="bolt" class="w-8 h-8 mx-auto" style={{ color: "var(--accent-primary)" }} />
            <p class="text-[13px]" style={{ color: "var(--text-weak)" }}>
              AI-powered semantic search
            </p>
            <p class="text-[11px]" style={{ color: "var(--text-weaker)" }}>
              Type at least 2 characters to search using natural language
            </p>
          </div>
        </Show>
      </Show>
    </div>
  );
  
  if (props.standalone !== false) {
    return (
      <Show when={props.visible !== false}>
        <div 
          class="flex flex-col h-full"
          style={{ background: "var(--surface-raised)" }}
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <div 
            class="flex items-center justify-between px-4 h-[48px] border-b shrink-0"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <div class="flex items-center gap-2">
              <Icon name="bolt" class="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
              <span class="text-[13px] font-medium" style={{ color: "var(--text-base)" }}>
                AI Search
              </span>
              <Show when={semanticSearch.state.indexedFilesCount > 0}>
                <span 
                  class="text-[10px] px-1.5 py-0.5 rounded-md"
                  style={{ background: "var(--surface-active)", color: "var(--text-weak)" }}
                >
                  {semanticSearch.state.indexedFilesCount} files
                </span>
              </Show>
            </div>
            <div class="flex items-center gap-2">
              <ActionButtons />
              <Show when={props.onClose}>
                <button 
                  class="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                  onClick={() => props.onClose?.()}
                  title="Close"
                >
                  <Icon name="xmark" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
                </button>
              </Show>
            </div>
          </div>
          
          {/* Indexing/Error indicators */}
          <IndexingIndicator />
          <ErrorIndicator />
          <StatsPanel />
          
          {/* Search input */}
          <div class="p-3 border-b shrink-0" style={{ "border-color": "var(--border-weak)" }}>
            <div 
              class="flex items-center gap-2 px-3 h-[36px] rounded-md"
              style={{ background: "var(--background-base)" }}
            >
              <Icon name="magnifying-glass" class="w-4 h-4 shrink-0" style={{ color: "var(--text-weak)" }} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search with natural language..."
                class="flex-1 bg-transparent outline-none text-[13px] min-w-0"
                style={{ color: "var(--text-base)" }}
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
              />
              <Show when={loading()}>
                <Icon name="spinner" class="w-4 h-4 animate-spin" style={{ color: "var(--text-weak)" }} />
              </Show>
            </div>
          </div>
          
          {/* Results count */}
          <Show when={results().length > 0}>
            <div 
              class="px-4 py-2 text-[11px] border-b shrink-0"
              style={{ 
                "border-color": "var(--border-weak)",
                color: "var(--text-weak)",
              }}
            >
              {results().length} result{results().length !== 1 ? "s" : ""} found
            </div>
          </Show>
          
          {/* Results */}
          <div ref={resultsRef} class="flex-1 overflow-y-auto overscroll-contain">
            <Show when={results().length > 0} fallback={<NoResults />}>
              <For each={results()}>
                {(result, index) => (
                  <div 
                    class="border-b transition-colors"
                    style={{ "border-color": "var(--border-weak)" }}
                    data-index={index()}
                    classList={{
                      "bg-white/5": selectedIndex() === index(),
                    }}
                  >
                    {/* Result header */}
                    <button
                      class="w-full flex items-center gap-2 px-4 h-[40px] text-left hover:bg-white/5 transition-colors"
                      onClick={() => toggleResultExpanded(result.chunkId)}
                    >
                      <span class="shrink-0" style={{ color: "var(--text-weak)" }}>
                        {expandedResults().has(result.chunkId)
                          ? <Icon name="chevron-down" class="w-3.5 h-3.5" />
                          : <Icon name="chevron-right" class="w-3.5 h-3.5" />
                        }
                      </span>
                      <Icon name="file" class="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-weak)" }} />
                      <span class="text-[12px] font-medium truncate" style={{ color: "var(--text-base)" }}>
                        {getFileName(result.file)}
                      </span>
                      <Show when={getDirectory(result.file)}>
                        <span class="text-[11px] truncate" style={{ color: "var(--text-weaker)" }}>
                          {getDirectory(result.file)}
                        </span>
                      </Show>
                      <div class="ml-auto flex items-center gap-2 shrink-0">
                        <span 
                          class="text-[10px] px-1.5 py-0.5 rounded-md font-mono"
                          style={{ color: getSimilarityColor(result.similarity) }}
                        >
                          {formatSimilarity(result.similarity)}
                        </span>
                        <span 
                          class="text-[10px] px-1.5 py-0.5 rounded-md font-mono"
                          style={{ background: "var(--surface-active)", color: "var(--text-weak)" }}
                        >
                          L{result.startLine + 1}
                        </span>
                      </div>
                    </button>
                    
                    {/* Expanded content */}
                    <Show when={expandedResults().has(result.chunkId)}>
                      <div 
                        class="px-4 py-2 cursor-pointer hover:bg-white/5 transition-colors"
                        onClick={() => handleResultClick(result)}
                      >
                        <pre 
                          class="text-[11px] font-mono whitespace-pre-wrap overflow-x-auto max-h-[200px] overflow-y-auto p-2 rounded"
                          style={{ 
                            background: "var(--background-base)",
                            color: "var(--text-weak)",
                          }}
                        >
                          {highlightContent(truncateContent(result.content, 500), query())}
                        </pre>
                        <div 
                          class="mt-2 text-[10px]"
                          style={{ color: "var(--text-weaker)" }}
                        >
                          Lines {result.startLine + 1}-{result.endLine + 1} • Click to open
                        </div>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </Show>
          </div>
          
          {/* Footer */}
          <div 
            class="flex items-center justify-between px-4 py-2 text-[10px] border-t shrink-0"
            style={{ 
              "border-color": "var(--border-weak)",
              background: "var(--background-base)",
              color: "var(--text-weaker)",
            }}
          >
            <span>
              <kbd class="font-mono">↑↓</kbd> navigate • <kbd class="font-mono">Enter</kbd> open
            </span>
            <span>
              <kbd class="font-mono">Esc</kbd> close
            </span>
          </div>
        </div>
      </Show>
    );
  }
  
  // Inline mode (simplified)
  return (
    <div 
      class="flex flex-col"
      style={{ background: "var(--surface-raised)" }}
      onKeyDown={handleKeyDown}
    >
      <IndexingIndicator />
      
      {/* Compact search input */}
      <div 
        class="flex items-center gap-2 px-3 h-[36px]"
        style={{ background: "var(--background-base)" }}
      >
        <Icon name="bolt" class="w-4 h-4 shrink-0" style={{ color: "var(--accent-primary)" }} />
        <input
          ref={inputRef}
          type="text"
          placeholder="AI Search..."
          class="flex-1 bg-transparent outline-none text-[12px] min-w-0"
          style={{ color: "var(--text-base)" }}
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <Show when={loading()}>
          <Icon name="spinner" class="w-3.5 h-3.5 animate-spin" style={{ color: "var(--text-weak)" }} />
        </Show>
      </div>
      
      {/* Inline results */}
      <Show when={results().length > 0}>
        <div class="max-h-[300px] overflow-y-auto">
          <For each={results().slice(0, 10)}>
            {(result, index) => (
              <button
                class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors border-t"
                style={{ "border-color": "var(--border-weak)" }}
                classList={{ "bg-white/5": selectedIndex() === index() }}
                onClick={() => handleResultClick(result)}
              >
                <Icon name="file" class="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-weak)" }} />
                <span class="text-[11px] truncate flex-1" style={{ color: "var(--text-base)" }}>
                  {getFileName(result.file)}:{result.startLine + 1}
                </span>
                <span 
                  class="text-[10px] font-mono"
                  style={{ color: getSimilarityColor(result.similarity) }}
                >
                  {formatSimilarity(result.similarity)}
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
