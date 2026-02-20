/**
 * Quick Open — file picker with mode switching.
 *
 * Modes (triggered by prefix):
 *  (none) — fuzzy file search across workspace
 *  :      — go to line
 *  @      — go to symbol in editor (document symbols)
 *  #      — workspace symbol search
 *  >      — switch to command palette
 */

import { createSignal, createEffect, createMemo, For, Show, onCleanup, JSX } from "solid-js";
import { useCommands } from "@/context/CommandContext";
import { useEditor } from "@/context/EditorContext";
import { fuzzyMatch, fuzzyHighlight, type FuzzyHighlightSegment } from "@/services/fuzzySearch";
import { Icon } from "@/components/ui/Icon";
import { getFileIcon as getFileIconPath } from "@/utils/fileIcons";
import { fsGetFileTree, lspDocumentSymbols, type LspSymbol } from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";
import { workspaceSymbolsSearch, type WorkspaceSymbolEntry } from "@/sdk/workspace-symbols";

type QuickOpenMode = "files" | "goto-line" | "symbols" | "workspace-symbols" | "commands";

const RECENT_FILES_KEY = "cortex_recent_files";
const MAX_RECENT = 15;

function loadRecentFiles(): string[] {
  try { const s = localStorage.getItem(RECENT_FILES_KEY); return s ? JSON.parse(s) : []; }
  catch { return []; }
}

function addRecentFile(path: string) {
  const recent = loadRecentFiles().filter(p => p !== path);
  recent.unshift(path);
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recent.slice(0, 50)));
}

function mapSymbolKind(kind: number): string {
  const m: Record<number, string> = {
    1: "file", 2: "module", 5: "class", 6: "method", 11: "interface",
    12: "function", 13: "variable", 14: "constant", 10: "enum", 23: "struct",
  };
  return m[kind] || "variable";
}

function HL(props: { segments: FuzzyHighlightSegment[] }) {
  return (
    <>
      <For each={props.segments}>
        {(seg) => seg.highlighted
          ? <span style={{ "font-weight": "600", color: "var(--jb-border-focus)" }}>{seg.text}</span>
          : <span>{seg.text}</span>}
      </For>
    </>
  );
}

interface FileItem { name: string; path: string; score: number; segments: FuzzyHighlightSegment[] }
interface SymbolItem { name: string; kind: string; line: number; col: number; container?: string; score: number; segments: FuzzyHighlightSegment[] }
interface WsSymbolItem { name: string; kind: string; filePath: string; line: number; col: number; container?: string; score: number; segments: FuzzyHighlightSegment[] }

export function PaletteQuickOpen() {
  const { showFileFinder, setShowFileFinder, setShowCommandPalette } = useCommands();
  const { openFile, state: editorState } = useEditor();
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [allFiles, setAllFiles] = createSignal<{ name: string; path: string }[]>([]);
  const [docSymbols, setDocSymbols] = createSignal<SymbolItem[]>([]);
  const [wsSymbols, setWsSymbols] = createSignal<WsSymbolItem[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const mode = createMemo<QuickOpenMode>(() => {
    const q = query();
    if (q.startsWith(">")) return "commands";
    if (q.startsWith("@")) return "symbols";
    if (q.startsWith("#")) return "workspace-symbols";
    if (q.startsWith(":")) return "goto-line";
    return "files";
  });

  const strippedQuery = createMemo(() => {
    const q = query();
    const m = mode();
    if (m === "files") return q;
    return q.slice(1).trim();
  });

  const currentFilePath = createMemo(() => {
    if (!editorState.activeFileId) return null;
    return editorState.openFiles.find(f => f.id === editorState.activeFileId)?.path || null;
  });

  const filteredFiles = createMemo((): FileItem[] => {
    const q = strippedQuery();
    const files = allFiles();
    const recent = loadRecentFiles();
    const pp = getProjectPath();

    if (!q) {
      if (recent.length > 0) {
        return recent.slice(0, MAX_RECENT)
          .map(rp => { let rel = rp; if (pp && rp.startsWith(pp)) rel = rp.slice(pp.length + 1); return files.find(f => f.path === rel); })
          .filter((f): f is { name: string; path: string } => !!f)
          .map((f, i) => ({ ...f, score: 1000 - i, segments: [{ text: f.name, highlighted: false }] }));
      }
      return files.slice(0, 100).map(f => ({ ...f, score: 0, segments: [{ text: f.name, highlighted: false }] }));
    }

    return files
      .map(f => { const r = fuzzyMatch(q, f.path); return { ...f, score: r.score, segments: fuzzyHighlight(f.name, r.matches.filter(i => i >= f.path.length - f.name.length).map(i => i - (f.path.length - f.name.length))) }; })
      .filter(f => f.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);
  });

  const filteredDocSymbols = createMemo((): SymbolItem[] => {
    const q = strippedQuery();
    const syms = docSymbols();
    if (!q) return syms.slice(0, 100);
    return syms
      .map(s => { const r = fuzzyMatch(q, s.name); return { ...s, score: r.score, segments: fuzzyHighlight(s.name, r.matches) }; })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);
  });

  const filteredWsSymbols = createMemo((): WsSymbolItem[] => wsSymbols());

  const itemCount = createMemo(() => {
    const m = mode();
    if (m === "files") return filteredFiles().length;
    if (m === "symbols") return filteredDocSymbols().length;
    if (m === "workspace-symbols") return filteredWsSymbols().length;
    return 0;
  });

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const pp = getProjectPath();
      if (!pp) { setAllFiles([]); return; }
      const tree = await fsGetFileTree(pp, 15);
      const flat: { name: string; path: string }[] = [];
      const walk = (nodes: unknown[], parent: string) => {
        for (const n of nodes as Array<{ name: string; isDirectory?: boolean; children?: unknown[] }>) {
          const fp = parent ? `${parent}/${n.name}` : n.name;
          const isDir = n.isDirectory || (n.children && n.children.length > 0);
          if (isDir && ["node_modules", ".git", "dist", "build", "target", "__pycache__"].includes(n.name.toLowerCase())) continue;
          if (!isDir && !n.children) flat.push({ name: n.name, path: fp });
          if (n.children) walk(n.children, fp);
        }
      };
      walk(tree.children || [], "");
      setAllFiles(flat);
    } catch (err) { console.error("QuickOpen: failed to fetch files", err); }
    finally { setIsLoading(false); }
  };

  const fetchDocSymbols = async () => {
    const fp = currentFilePath();
    if (!fp) { setDocSymbols([]); return; }
    try {
      const syms = await lspDocumentSymbols(fp);
      setDocSymbols((syms || []).map((s: LspSymbol) => ({
        name: s.name, kind: mapSymbolKind(s.kind),
        line: s.location?.range?.start?.line ?? 0, col: s.location?.range?.start?.character ?? 0,
        container: s.containerName, score: 0, segments: [{ text: s.name, highlighted: false }],
      })));
    } catch { setDocSymbols([]); }
  };

  const fetchWsSymbols = async (q: string) => {
    const pp = getProjectPath();
    if (!pp) { setWsSymbols([]); return; }
    try {
      const syms = await workspaceSymbolsSearch(pp, q, 100);
      setWsSymbols(syms.map((s: WorkspaceSymbolEntry) => ({
        name: s.name, kind: s.kind, filePath: s.filePath, line: s.line, col: s.column,
        container: s.containerName ?? undefined, score: 0,
        segments: [{ text: s.name, highlighted: false }],
      })));
    } catch { setWsSymbols([]); }
  };

  createEffect(() => {
    if (showFileFinder()) {
      setQuery(""); setSelectedIndex(0);
      setTimeout(() => inputRef?.focus(), 10);
      fetchFiles();
    }
  });

  createEffect(() => {
    const m = mode();
    if (m === "symbols" && showFileFinder()) fetchDocSymbols();
  });

  createEffect(() => {
    const m = mode();
    const q = strippedQuery();
    if (m === "workspace-symbols" && showFileFinder()) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchWsSymbols(q), 200);
    }
  });

  createEffect(() => {
    const m = mode();
    if (m === "commands" && showFileFinder()) {
      setShowFileFinder(false);
      setShowCommandPalette(true);
    }
  });

  createEffect(() => { query(); setSelectedIndex(0); });

  createEffect(() => {
    const idx = selectedIndex();
    if (listRef) {
      const items = listRef.querySelectorAll("[data-qo-item]");
      (items[idx] as HTMLElement)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  const handleSelect = async (path: string) => {
    setShowFileFinder(false);
    const pp = getProjectPath();
    const full = pp ? `${pp}/${path}` : path;
    addRecentFile(full);
    await openFile(full);
  };

  const handleSymbolSelect = (line: number, col: number) => {
    setShowFileFinder(false);
    setTimeout(() => window.dispatchEvent(new CustomEvent("editor:goto-line", { detail: { line: line + 1, column: col + 1 } })), 50);
  };

  const handleWsSymbolSelect = async (s: WsSymbolItem) => {
    setShowFileFinder(false);
    const pp = getProjectPath();
    const full = pp ? `${pp}/${s.filePath}` : s.filePath;
    await openFile(full);
    setTimeout(() => window.dispatchEvent(new CustomEvent("editor:goto-line", { detail: { line: s.line + 1, column: s.col + 1 } })), 100);
  };

  const handleGoToLine = () => {
    const match = strippedQuery().match(/^(\d+)(?::(\d+))?$/);
    if (match && editorState.activeFileId) {
      setShowFileFinder(false);
      const line = parseInt(match[1], 10);
      const col = match[2] ? parseInt(match[2], 10) : 1;
      window.dispatchEvent(new CustomEvent("editor:goto-line", { detail: { line, column: col } }));
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const count = itemCount();
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, count - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const m = mode();
      if (m === "goto-line") { handleGoToLine(); return; }
      if (m === "files") { const f = filteredFiles()[selectedIndex()]; if (f) handleSelect(f.path); }
      if (m === "symbols") { const s = filteredDocSymbols()[selectedIndex()]; if (s) handleSymbolSelect(s.line, s.col); }
      if (m === "workspace-symbols") { const s = filteredWsSymbols()[selectedIndex()]; if (s) handleWsSymbolSelect(s); }
    }
    else if (e.key === "Escape") { e.preventDefault(); setShowFileFinder(false); }
  };

  onCleanup(() => { if (debounceTimer) clearTimeout(debounceTimer); });

  const placeholder = createMemo(() => {
    const m = mode();
    if (m === "symbols") return "Go to symbol in editor...";
    if (m === "workspace-symbols") return "Search workspace symbols...";
    if (m === "goto-line") return "Type a line number...";
    return "Search files by name (@ symbols, # workspace, : line, > commands)";
  });

  const itemStyle = (sel: boolean): JSX.CSSProperties => ({
    display: "flex", "align-items": "center", gap: "6px", height: "26px",
    padding: "0 8px", margin: "1px 4px", "border-radius": "var(--cortex-radius-sm)",
    background: sel ? "rgba(255,255,255,0.08)" : "transparent",
    cursor: "pointer", "user-select": "none", "font-size": "12px",
    color: "var(--jb-text-body-color)",
  });

  return (
    <Show when={showFileFinder()}>
      <div style={{ position: "fixed", inset: "0", "z-index": "2549", background: "transparent" }} onClick={() => setShowFileFinder(false)} />
      <div
        style={{
          position: "fixed", top: "44px", width: "520px", "max-width": "calc(100vw - 32px)",
          "z-index": "2550", left: "50%", transform: "translateX(-50%)",
          "border-radius": "var(--cortex-radius-md)", "font-size": "12px",
          "-webkit-app-region": "no-drag", background: "var(--ui-panel-bg)",
          color: "var(--jb-text-body-color)", border: "1px solid rgba(255,255,255,0.08)",
          "box-shadow": "0 4px 16px rgba(0,0,0,0.3)", overflow: "hidden",
        }}
        role="dialog" aria-label="Quick Open"
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", "align-items": "center", padding: "6px 8px", gap: "6px", "border-bottom": "1px solid rgba(255,255,255,0.06)" }}>
          <Icon name="magnifying-glass" size={12} style={{ color: "var(--jb-text-muted-color)", "flex-shrink": "0" }} />
          <input
            ref={inputRef} type="text" placeholder={placeholder()} value={query()}
            onInput={e => setQuery(e.currentTarget.value)} onKeyDown={handleKeyDown}
            style={{ flex: "1", height: "20px", background: "transparent", border: "none", outline: "none", color: "var(--jb-text-body-color)", "font-size": "12px" }}
          />
          <Show when={isLoading()}>
            <span style={{ "font-size": "10px", color: "var(--jb-text-muted-color)" }}>Loading...</span>
          </Show>
          <Show when={!isLoading() && mode() === "files" && allFiles().length > 0}>
            <span style={{ "font-size": "10px", color: "var(--jb-text-muted-color)", "white-space": "nowrap" }}>
              {filteredFiles().length} of {allFiles().length}
            </span>
          </Show>
        </div>
        <div ref={listRef} style={{ "max-height": "340px", overflow: "auto", "overscroll-behavior": "contain", "padding-bottom": "3px" }}>
          <Show when={mode() === "files"}>
            <Show when={filteredFiles().length === 0}>
              <div style={{ padding: "12px", "text-align": "center", "font-size": "11px", color: "var(--jb-text-muted-color)" }}>No files found</div>
            </Show>
            <Show when={!strippedQuery() && loadRecentFiles().length > 0}>
              <div style={{ height: "20px", padding: "0 8px", "font-size": "9px", "font-weight": "500", "text-transform": "uppercase", "letter-spacing": "0.5px", color: "var(--jb-text-muted-color)", display: "flex", "align-items": "center" }}>
                Recently Opened
              </div>
            </Show>
            <For each={filteredFiles()}>
              {(file, idx) => (
                <div data-qo-item style={itemStyle(idx() === selectedIndex())} onMouseEnter={() => setSelectedIndex(idx())} onClick={() => handleSelect(file.path)}>
                  <img src={getFileIconPath(file.name, false)} alt="" style={{ width: "16px", height: "16px", "flex-shrink": "0" }} draggable={false} />
                  <span style={{ flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}><HL segments={file.segments} /></span>
                  <Show when={file.path.includes("/")}>
                    <span style={{ display: "flex", "align-items": "center", gap: "3px", "font-size": "10px", color: "var(--jb-text-muted-color)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", "max-width": "220px" }}>
                      <Icon name="folder" size={10} style={{ "flex-shrink": "0", opacity: "0.7" }} />
                      {file.path.slice(0, file.path.lastIndexOf("/"))}
                    </span>
                  </Show>
                </div>
              )}
            </For>
          </Show>
          <Show when={mode() === "symbols"}>
            <Show when={filteredDocSymbols().length === 0}>
              <div style={{ padding: "12px", "text-align": "center", "font-size": "11px", color: "var(--jb-text-muted-color)" }}>No symbols found</div>
            </Show>
            <For each={filteredDocSymbols()}>
              {(sym, idx) => (
                <div data-qo-item style={itemStyle(idx() === selectedIndex())} onMouseEnter={() => setSelectedIndex(idx())} onClick={() => handleSymbolSelect(sym.line, sym.col)}>
                  <span style={{ "font-size": "10px", color: "var(--cortex-info)", "flex-shrink": "0", "min-width": "16px", "text-align": "center" }}>{sym.kind.charAt(0).toUpperCase()}</span>
                  <span style={{ flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}><HL segments={sym.segments} /></span>
                  <span style={{ "font-size": "10px", color: "var(--jb-text-muted-color)" }}>:{sym.line + 1}</span>
                </div>
              )}
            </For>
          </Show>
          <Show when={mode() === "workspace-symbols"}>
            <Show when={filteredWsSymbols().length === 0}>
              <div style={{ padding: "12px", "text-align": "center", "font-size": "11px", color: "var(--jb-text-muted-color)" }}>
                {isLoading() ? "Searching..." : "No workspace symbols found"}
              </div>
            </Show>
            <For each={filteredWsSymbols()}>
              {(sym, idx) => (
                <div data-qo-item style={itemStyle(idx() === selectedIndex())} onMouseEnter={() => setSelectedIndex(idx())} onClick={() => handleWsSymbolSelect(sym)}>
                  <span style={{ "font-size": "10px", color: "var(--cortex-warning)", "flex-shrink": "0", "min-width": "16px", "text-align": "center" }}>{sym.kind.charAt(0).toUpperCase()}</span>
                  <span style={{ flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}><HL segments={sym.segments} /></span>
                  <span style={{ "font-size": "10px", color: "var(--jb-text-muted-color)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", "max-width": "180px" }}>{sym.filePath}</span>
                </div>
              )}
            </For>
          </Show>
          <Show when={mode() === "goto-line"}>
            <div style={{ padding: "12px", "text-align": "center", "font-size": "11px", color: "var(--jb-text-muted-color)" }}>
              Type a line number and press Enter{editorState.activeFileId ? "" : " (no file open)"}
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
