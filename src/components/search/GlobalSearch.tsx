import { Component, For, Show, createSignal, JSX } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspace } from "@/context/WorkspaceContext";
import { SearchResultItem } from "@/components/search/SearchResultItem";

interface WorkspaceSearchMatch {
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
  beforeContext: Array<{ lineNumber: number; text: string }>;
  afterContext: Array<{ lineNumber: number; text: string }>;
}

interface WorkspaceSearchFileResult {
  file: string;
  root: string;
  matches: WorkspaceSearchMatch[];
}

interface WorkspaceSearchResponse {
  results: WorkspaceSearchFileResult[];
  totalMatches: number;
  filesSearched: number;
  rootsSearched: number;
}

const inputBase: JSX.CSSProperties = {
  width: "100%", background: "var(--cortex-bg-primary)",
  border: "1px solid var(--cortex-bg-hover)", "border-radius": "var(--cortex-radius-sm)",
  color: "var(--cortex-text-primary)", "font-size": "13px", outline: "none",
};

const ToggleButton: Component<{ active: boolean; onClick: () => void; title: string; children: JSX.Element }> = (props) => (
  <button onClick={props.onClick} title={props.title} style={{
    background: props.active ? "rgba(178,255,34,0.2)" : "transparent",
    border: props.active ? "1px solid var(--cortex-accent-primary)" : "1px solid transparent",
    color: props.active ? "var(--cortex-accent-primary)" : "var(--cortex-text-inactive)",
    cursor: "pointer", padding: "2px 4px", "border-radius": "var(--cortex-radius-sm)",
    "font-size": "11px", "font-family": "monospace",
  }}>{props.children}</button>
);

const getRelativePath = (filePath: string, root: string): string => {
  if (filePath.startsWith(root)) {
    const rel = filePath.slice(root.length);
    return rel.startsWith("/") || rel.startsWith("\\") ? rel.slice(1) : rel;
  }
  return filePath;
};

const getFilename = (filepath: string): string =>
  filepath.split("/").pop()?.split("\\").pop() ?? filepath;

export const GlobalSearch: Component = () => {
  const workspace = useWorkspace();

  const [searchQuery, setSearchQuery] = createSignal("");
  const [replaceQuery, setReplaceQuery] = createSignal("");
  const [caseSensitive, setCaseSensitive] = createSignal(false);
  const [wholeWord, setWholeWord] = createSignal(false);
  const [useRegex, setUseRegex] = createSignal(false);
  const [showReplace, setShowReplace] = createSignal(false);
  const [includePattern, setIncludePattern] = createSignal("");
  const [excludePattern, setExcludePattern] = createSignal("");
  const [results, setResults] = createSignal<WorkspaceSearchFileResult[]>([]);
  const [isSearching, setIsSearching] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(new Set());
  const [showFilters, setShowFilters] = createSignal(false);

  const totalMatches = () => results().reduce((sum, r) => sum + r.matches.length, 0);

  const toggleFile = (file: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file); else next.add(file);
      return next;
    });
  };

  const handleSearch = async () => {
    const query = searchQuery().trim();
    if (!query) return;
    const folders = workspace.folders();
    if (!folders.length) { setSearchError("No workspace folders open"); return; }

    setIsSearching(true);
    setSearchError(null);
    setResults([]);

    try {
      const response = await invoke<WorkspaceSearchResponse>("search_workspace_ripgrep", {
        roots: folders.map(f => f.path),
        query: searchQuery(),
        caseSensitive: caseSensitive(),
        regex: useRegex(),
        wholeWord: wholeWord(),
        includePatterns: includePattern() ? includePattern().split(",").map(s => s.trim()) : undefined,
        excludePatterns: excludePattern() ? excludePattern().split(",").map(s => s.trim()) : undefined,
        contextLines: 2,
        maxResults: 5000,
      });
      setResults(response.results);
      setExpandedFiles(new Set(response.results.map(r => r.file)));
    } catch (err) { setSearchError(String(err)); }
    finally { setIsSearching(false); }
  };

  const handleReplaceAll = async () => {
    const current = results();
    if (!current.length || !replaceQuery()) return;
    try {
      const replacements = current.flatMap(fileResult =>
        fileResult.matches.map(m => ({
          file: fileResult.file, line: m.line, column: m.column,
          matchStart: m.matchStart, matchEnd: m.matchEnd,
          text: m.text, replaceWith: replaceQuery(),
        }))
      );
      await invoke("replace_in_files", { replacements, dryRun: false });
      setResults([]);
    } catch (err) { setSearchError(`Replace failed: ${String(err)}`); }
  };

  const handleMatchClick = (file: string, line: number, column: number) => {
    window.dispatchEvent(new CustomEvent("editor:goto", { detail: { file, line, column } }));
  };

  const dismissMatch = (file: string, line: number) => {
    setResults(prev =>
      prev.map(r => r.file !== file ? r : { ...r, matches: r.matches.filter(m => m.line !== line) })
        .filter(r => r.matches.length > 0)
    );
  };

  const chevronStyle = (open: boolean): JSX.CSSProperties => ({
    transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s",
  });

  const sectionToggleStyle: JSX.CSSProperties = {
    background: "transparent", border: "none", color: "var(--cortex-text-inactive)",
    cursor: "pointer", padding: "4px 0", "font-size": "12px",
    display: "flex", "align-items": "center", gap: "4px",
  };

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%", background: "var(--cortex-bg-secondary)", color: "var(--cortex-text-primary)", "font-family": "'SF Pro Text', -apple-system, sans-serif", "font-size": "13px" }}>
      <div style={{ padding: "12px 16px", "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
        <span style={{ "font-weight": "500" }}>Search</span>
      </div>

      <div style={{ padding: "12px 16px", "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
        <div style={{ position: "relative", "margin-bottom": "8px" }}>
          <input type="text" value={searchQuery()} onInput={e => setSearchQuery(e.currentTarget.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()} placeholder="Search"
            style={{ ...inputBase, padding: "8px 80px 8px 32px" }} />
          <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--cortex-text-inactive)" style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)" }}>
            <path d="M11.7 10.3c.9-1.2 1.4-2.6 1.4-4.2 0-3.9-3.1-7-7-7S-.1 2.2-.1 6.1s3.1 7 7 7c1.6 0 3.1-.5 4.2-1.4l3.8 3.8.7-.7-3.9-3.5zM6.9 12c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/>
          </svg>
          <div style={{ position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)", display: "flex", gap: "2px" }}>
            <ToggleButton active={caseSensitive()} onClick={() => setCaseSensitive(!caseSensitive())} title="Match Case">Aa</ToggleButton>
            <ToggleButton active={wholeWord()} onClick={() => setWholeWord(!wholeWord())} title="Match Whole Word">ab</ToggleButton>
            <ToggleButton active={useRegex()} onClick={() => setUseRegex(!useRegex())} title="Use Regex">.*</ToggleButton>
          </div>
        </div>

        <button onClick={() => setShowReplace(!showReplace())} style={sectionToggleStyle}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={chevronStyle(showReplace())}><path d="M6 4l4 4-4 4V4z"/></svg>
          Replace
        </button>
        <Show when={showReplace()}>
          <input type="text" value={replaceQuery()} onInput={e => setReplaceQuery(e.currentTarget.value)}
            placeholder="Replace" style={{ ...inputBase, padding: "8px", "margin-top": "8px" }} />
          <div style={{ display: "flex", gap: "8px", "margin-top": "8px" }}>
            <button style={{ flex: "1", background: "var(--cortex-bg-hover)", border: "none", color: "var(--cortex-text-primary)", padding: "6px", "border-radius": "var(--cortex-radius-sm)", cursor: "pointer", "font-size": "12px" }} onClick={handleReplaceAll}>Replace All</button>
          </div>
        </Show>

        <button onClick={() => setShowFilters(!showFilters())} style={{ ...sectionToggleStyle, "margin-top": "4px" }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={chevronStyle(showFilters())}><path d="M6 4l4 4-4 4V4z"/></svg>
          Filters
        </button>
        <Show when={showFilters()}>
          <div style={{ display: "flex", "flex-direction": "column", gap: "6px", "margin-top": "8px" }}>
            <input type="text" value={includePattern()} onInput={e => setIncludePattern(e.currentTarget.value)}
              placeholder="Files to include (e.g. *.ts, src/**)" style={{ ...inputBase, padding: "6px 8px", "font-size": "12px" }} />
            <input type="text" value={excludePattern()} onInput={e => setExcludePattern(e.currentTarget.value)}
              placeholder="Files to exclude (e.g. node_modules, dist)" style={{ ...inputBase, padding: "6px 8px", "font-size": "12px" }} />
          </div>
        </Show>
      </div>

      <div style={{ flex: "1", overflow: "auto" }}>
        <Show when={isSearching()}>
          <div style={{ padding: "16px", color: "var(--cortex-text-inactive)", "text-align": "center" }}>Searching...</div>
        </Show>
        <Show when={searchError()}>
          <div style={{ padding: "16px", color: "var(--cortex-error)", "text-align": "center" }}>{searchError()}</div>
        </Show>
        <Show when={!isSearching() && results().length > 0}>
          <div style={{ padding: "8px 16px", color: "var(--cortex-text-inactive)", "font-size": "12px", "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
            {totalMatches()} results in {results().length} files
          </div>
          <For each={results()}>
            {(fileResult) => (
              <FileGroup fileResult={fileResult} expanded={expandedFiles().has(fileResult.file)}
                onToggle={() => toggleFile(fileResult.file)} showReplace={showReplace()}
                replaceText={replaceQuery()} onMatchClick={handleMatchClick} onDismiss={dismissMatch} />
            )}
          </For>
        </Show>
        <Show when={!isSearching() && results().length === 0 && searchQuery() && !searchError()}>
          <div style={{ padding: "16px", color: "var(--cortex-text-inactive)", "text-align": "center" }}>No results found</div>
        </Show>
      </div>
    </div>
  );
};

const fileHeaderBaseStyle: JSX.CSSProperties = {
  display: "flex", "align-items": "center", padding: "6px 16px",
  cursor: "pointer", gap: "8px", transition: "background 0.1s",
};

const matchCountBadgeStyle: JSX.CSSProperties = {
  color: "var(--cortex-accent-text)", background: "var(--cortex-accent-primary)",
  "border-radius": "var(--cortex-radius-sm)", padding: "1px 6px",
  "font-size": "11px", "font-weight": "500", "min-width": "18px",
  "text-align": "center", "flex-shrink": "0",
};

const FileGroup: Component<{
  fileResult: WorkspaceSearchFileResult;
  expanded: boolean;
  onToggle: () => void;
  showReplace: boolean;
  replaceText: string;
  onMatchClick: (file: string, line: number, column: number) => void;
  onDismiss: (file: string, line: number) => void;
}> = (props) => {
  const [hovered, setHovered] = createSignal(false);
  const relativePath = () => getRelativePath(props.fileResult.file, props.fileResult.root);
  const filename = () => getFilename(props.fileResult.file);

  return (
    <div style={{ "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
      <div style={{ ...fileHeaderBaseStyle, background: hovered() ? "var(--cortex-bg-hover, rgba(255,255,255,0.05))" : "transparent" }}
        onClick={props.onToggle} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="var(--cortex-text-inactive)"
          style={{ transform: props.expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", "flex-shrink": "0" }}>
          <path d="M6 4l4 4-4 4V4z"/>
        </svg>
        <span style={{ "font-weight": "500", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
          {filename()}
        </span>
        <span style={{ color: "var(--cortex-text-inactive)", "font-size": "12px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", flex: "1", "min-width": "0" }}>
          {relativePath()}
        </span>
        <span style={matchCountBadgeStyle}>{props.fileResult.matches.length}</span>
      </div>
      <Show when={props.expanded}>
        <div style={{ "padding-left": "16px" }}>
          <For each={props.fileResult.matches}>
            {(match) => (
              <SearchResultItem file={props.fileResult.file} line={match.line} column={match.column}
                text={match.text} matchStart={match.matchStart} matchEnd={match.matchEnd}
                beforeContext={match.beforeContext} afterContext={match.afterContext}
                replaceText={props.replaceText} showReplace={props.showReplace}
                onMatchClick={props.onMatchClick} onDismiss={props.onDismiss} />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default GlobalSearch;
