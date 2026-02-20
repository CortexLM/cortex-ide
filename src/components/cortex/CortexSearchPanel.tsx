import { Component, createSignal, Show, For, onMount, onCleanup, JSX } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspace } from "@/context/WorkspaceContext";

interface SearchMatch {
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

interface SearchFileResult {
  file: string;
  root: string;
  matches: SearchMatch[];
}

interface SearchResponse {
  results: SearchFileResult[];
  totalMatches: number;
  filesSearched: number;
  rootsSearched: number;
}

const inputStyle: JSX.CSSProperties = {
  width: "100%", background: "var(--cortex-bg-primary)",
  border: "1px solid var(--cortex-bg-hover)", "border-radius": "var(--cortex-radius-sm)",
  color: "var(--cortex-text-primary)", "font-size": "13px", outline: "none",
};

const chevron = (open: boolean): JSX.CSSProperties => ({
  transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s",
});

const sectionBtn: JSX.CSSProperties = {
  background: "transparent", border: "none", color: "var(--cortex-text-inactive)",
  cursor: "pointer", padding: "4px 0", "font-size": "12px",
  display: "flex", "align-items": "center", gap: "4px",
};

const getFilename = (p: string): string => p.split("/").pop()?.split("\\").pop() ?? p;
const getRelPath = (p: string, root: string): string => {
  if (p.startsWith(root)) {
    const r = p.slice(root.length);
    return r.startsWith("/") || r.startsWith("\\") ? r.slice(1) : r;
  }
  return p;
};

export const CortexSearchPanel: Component = () => {
  const workspace = useWorkspace();
  let searchRef: HTMLInputElement | undefined;

  const [query, setQuery] = createSignal("");
  const [replace, setReplace] = createSignal("");
  const [caseSensitive, setCaseSensitive] = createSignal(false);
  const [wholeWord, setWholeWord] = createSignal(false);
  const [useRegex, setUseRegex] = createSignal(false);
  const [showReplace, setShowReplace] = createSignal(false);
  const [showFilters, setShowFilters] = createSignal(false);
  const [include, setInclude] = createSignal("");
  const [exclude, setExclude] = createSignal("");
  const [results, setResults] = createSignal<SearchFileResult[]>([]);
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set());
  const [searching, setSearching] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const totalMatches = () => results().reduce((s, r) => s + r.matches.length, 0);

  const toggleFile = (f: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f); else n.add(f);
      return n;
    });
  };

  const handleSearch = async () => {
    const q = query().trim();
    if (!q) return;
    const folders = workspace.folders();
    if (!folders.length) { setError("No workspace folders open"); return; }

    setSearching(true);
    setError(null);
    setResults([]);

    try {
      const response = await invoke<SearchResponse>("search_workspace_ripgrep", {
        roots: folders.map(f => f.path),
        query: q,
        caseSensitive: caseSensitive(),
        regex: useRegex(),
        wholeWord: wholeWord(),
        includePatterns: include() ? include().split(",").map(s => s.trim()) : undefined,
        excludePatterns: exclude() ? exclude().split(",").map(s => s.trim()) : undefined,
        contextLines: 0,
        maxResults: 5000,
      });
      setResults(response.results);
      setExpanded(new Set(response.results.map(r => r.file)));
    } catch (err) { setError(String(err)); }
    finally { setSearching(false); }
  };

  const handleReplaceAll = async () => {
    const cur = results();
    if (!cur.length || !replace()) return;
    try {
      const replacements = cur.flatMap(fr =>
        fr.matches.map(m => ({
          file: fr.file, line: m.line, column: m.column,
          matchStart: m.matchStart, matchEnd: m.matchEnd,
          text: m.text, replaceWith: replace(),
        }))
      );
      await invoke("replace_in_files", { replacements, dryRun: false });
      setResults([]);
    } catch (err) { setError(`Replace failed: ${String(err)}`); }
  };

  const handleReplaceInFile = async (file: string) => {
    const fr = results().find(r => r.file === file);
    if (!fr) return;
    try {
      await invoke("search_replace_in_file", {
        uri: `file://${file}`,
        matches: fr.matches.map(m => ({
          id: `${file}:${m.line}:${m.column}`, line: m.line, column: m.column,
          length: m.matchEnd - m.matchStart, line_text: m.text, preview: m.text,
        })),
        replaceText: replace(), useRegex: useRegex(), preserveCase: caseSensitive(),
      });
      setResults(prev => prev.filter(r => r.file !== file));
    } catch (err) { setError(`Replace failed: ${String(err)}`); }
  };

  const openMatch = (file: string, line: number, column: number) => {
    window.dispatchEvent(new CustomEvent("editor:goto", { detail: { file, line, column } }));
  };

  const dismissFile = (file: string) => setResults(prev => prev.filter(r => r.file !== file));

  const onViewSearch = () => searchRef?.focus();
  onMount(() => window.addEventListener("view:search", onViewSearch));
  onCleanup(() => window.removeEventListener("view:search", onViewSearch));

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%", background: "var(--cortex-bg-secondary)", color: "var(--cortex-text-primary)", "font-family": "var(--cortex-font-sans)", "font-size": "13px" }}>
      <div style={{ padding: "12px 16px", "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
        <span style={{ "font-weight": "500" }}>Search</span>
      </div>

      <div style={{ padding: "12px 16px", "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
        <div style={{ position: "relative", "margin-bottom": "8px" }}>
          <input ref={searchRef} type="text" value={query()} onInput={e => setQuery(e.currentTarget.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()} placeholder="Search"
            style={{ ...inputStyle, padding: "8px 110px 8px 32px" }} />
          <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--cortex-text-inactive)" style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)" }}>
            <path d="M11.7 10.3c.9-1.2 1.4-2.6 1.4-4.2 0-3.9-3.1-7-7-7S-.1 2.2-.1 6.1s3.1 7 7 7c1.6 0 3.1-.5 4.2-1.4l3.8 3.8.7-.7-3.9-3.5zM6.9 12c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/>
          </svg>
          <div style={{ position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)", display: "flex", "align-items": "center", gap: "2px" }}>
            <Show when={totalMatches() > 0}>
              <span style={{ "font-size": "11px", color: "var(--cortex-text-inactive)", "margin-right": "4px", "white-space": "nowrap" }}>
                {totalMatches()} results
              </span>
            </Show>
            <ToggleBtn active={caseSensitive()} onClick={() => setCaseSensitive(!caseSensitive())} title="Match Case">Aa</ToggleBtn>
            <ToggleBtn active={wholeWord()} onClick={() => setWholeWord(!wholeWord())} title="Match Whole Word">ab</ToggleBtn>
            <ToggleBtn active={useRegex()} onClick={() => setUseRegex(!useRegex())} title="Use Regex">.*</ToggleBtn>
          </div>
        </div>

        <button onClick={() => setShowReplace(!showReplace())} style={sectionBtn}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={chevron(showReplace())}><path d="M6 4l4 4-4 4V4z"/></svg>
          Replace
        </button>
        <Show when={showReplace()}>
          <div style={{ display: "flex", "align-items": "center", gap: "6px", "margin-top": "8px" }}>
            <input type="text" value={replace()} onInput={e => setReplace(e.currentTarget.value)}
              placeholder="Replace" style={{ ...inputStyle, padding: "8px", flex: "1" }} />
            <button onClick={handleReplaceAll} title="Replace All" style={{ background: "var(--cortex-bg-hover)", border: "none", color: "var(--cortex-text-primary)", padding: "6px 10px", "border-radius": "var(--cortex-radius-sm)", cursor: "pointer", "font-size": "12px", "white-space": "nowrap" }}>
              Replace All
            </button>
          </div>
        </Show>

        <button onClick={() => setShowFilters(!showFilters())} style={{ ...sectionBtn, "margin-top": "4px" }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={chevron(showFilters())}><path d="M6 4l4 4-4 4V4z"/></svg>
          Filters
        </button>
        <Show when={showFilters()}>
          <div style={{ display: "flex", "flex-direction": "column", gap: "6px", "margin-top": "8px" }}>
            <input type="text" value={include()} onInput={e => setInclude(e.currentTarget.value)}
              placeholder="Files to include (e.g. *.ts, src/**)" style={{ ...inputStyle, padding: "6px 8px", "font-size": "12px" }} />
            <input type="text" value={exclude()} onInput={e => setExclude(e.currentTarget.value)}
              placeholder="Files to exclude (e.g. node_modules, dist)" style={{ ...inputStyle, padding: "6px 8px", "font-size": "12px" }} />
          </div>
        </Show>
      </div>

      <div style={{ flex: "1", overflow: "auto" }}>
        <Show when={searching()}>
          <div style={{ padding: "16px", color: "var(--cortex-text-inactive)", "text-align": "center" }}>Searching…</div>
        </Show>
        <Show when={error()}>
          <div style={{ padding: "16px", color: "var(--cortex-error)", "text-align": "center" }}>{error()}</div>
        </Show>
        <Show when={!searching() && results().length > 0}>
          <div style={{ padding: "8px 16px", color: "var(--cortex-text-inactive)", "font-size": "12px", "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
            {totalMatches()} results in {results().length} files
          </div>
          <For each={results()}>
            {(fr) => (
              <div style={{ "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
                <div class="sp-file-row" onClick={() => toggleFile(fr.file)} style={{ display: "flex", "align-items": "center", padding: "6px 16px", cursor: "pointer", gap: "8px" }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="var(--cortex-text-inactive)" style={{ ...chevron(expanded().has(fr.file)), "flex-shrink": "0" }}><path d="M6 4l4 4-4 4V4z"/></svg>
                  <span style={{ "font-weight": "500", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>{getFilename(fr.file)}</span>
                  <span style={{ color: "var(--cortex-text-inactive)", "font-size": "12px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", flex: "1", "min-width": "0" }}>{getRelPath(fr.file, fr.root)}</span>
                  <Show when={showReplace()}>
                    <div class="sp-file-actions" style={{ display: "flex", gap: "2px", opacity: "0", transition: "opacity 0.15s" }}>
                      <button onClick={(e) => { e.stopPropagation(); handleReplaceInFile(fr.file); }} style={{ background: "transparent", border: "none", color: "var(--cortex-text-inactive)", cursor: "pointer", padding: "2px 4px", "border-radius": "var(--cortex-radius-sm)", "font-size": "12px" }} title="Replace in file">↻</button>
                      <button onClick={(e) => { e.stopPropagation(); dismissFile(fr.file); }} style={{ background: "transparent", border: "none", color: "var(--cortex-text-inactive)", cursor: "pointer", padding: "2px 4px", "border-radius": "var(--cortex-radius-sm)", "font-size": "14px", "font-weight": "bold" }} title="Dismiss">×</button>
                    </div>
                  </Show>
                  <span style={{ color: "var(--cortex-accent-text)", background: "var(--cortex-accent-primary)", "border-radius": "var(--cortex-radius-sm)", padding: "1px 6px", "font-size": "11px", "font-weight": "500", "min-width": "18px", "text-align": "center", "flex-shrink": "0" }}>{fr.matches.length}</span>
                </div>
                <Show when={expanded().has(fr.file)}>
                  <For each={fr.matches}>
                    {(m) => (
                      <div class="sp-match-row" onClick={() => openMatch(fr.file, m.line, m.column)} style={{ padding: "4px 16px 4px 48px", cursor: "pointer", "font-family": "var(--cortex-font-mono)", "font-size": "12px", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>
                        <span style={{ color: "var(--cortex-text-inactive)", "margin-right": "8px", "user-select": "none" }}>{m.line}</span>
                        <span style={{ color: "var(--cortex-text-secondary)" }}>{m.text.slice(0, m.matchStart)}</span>
                        <span style={{ background: "var(--cortex-accent-primary)", color: "var(--cortex-accent-text)", "border-radius": "var(--cortex-radius-sm)", padding: "0 1px" }}>{m.text.slice(m.matchStart, m.matchEnd)}</span>
                        <span style={{ color: "var(--cortex-text-secondary)" }}>{m.text.slice(m.matchEnd)}</span>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            )}
          </For>
        </Show>
        <Show when={!searching() && results().length === 0 && query() && !error()}>
          <div style={{ padding: "16px", color: "var(--cortex-text-inactive)", "text-align": "center" }}>No results found</div>
        </Show>
      </div>

      <style>{`
        .sp-file-row:hover { background: var(--cortex-interactive-hover, rgba(255,255,255,0.05)); }
        .sp-file-row:hover .sp-file-actions { opacity: 1 !important; }
        .sp-match-row:hover { background: var(--cortex-interactive-hover, rgba(255,255,255,0.05)); }
      `}</style>
    </div>
  );
};

const ToggleBtn: Component<{ active: boolean; onClick: () => void; title: string; children: JSX.Element }> = (props) => (
  <button onClick={props.onClick} title={props.title} style={{
    background: props.active ? "var(--cortex-accent-muted)" : "transparent",
    border: props.active ? "1px solid var(--cortex-accent-primary)" : "1px solid transparent",
    color: props.active ? "var(--cortex-accent-primary)" : "var(--cortex-text-inactive)",
    cursor: "pointer", padding: "2px 4px", "border-radius": "var(--cortex-radius-sm)",
    "font-size": "11px", "font-family": "var(--cortex-font-mono)",
  }}>{props.children}</button>
);

export default CortexSearchPanel;
