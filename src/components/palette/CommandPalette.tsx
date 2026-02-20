/**
 * Enhanced Command Palette — modal overlay with fuzzy search, categorized commands,
 * recently-used tracking, keyboard navigation, `>` prefix handling, and multi-step commands.
 */
import { createSignal, createEffect, createMemo, For, Show, onMount, onCleanup, JSX } from "solid-js";
import { useCommands, type Command } from "@/context/CommandContext";
import { fuzzyMatch, fuzzyHighlight, type FuzzyHighlightSegment } from "@/services/fuzzySearch";
import { Icon } from "@/components/ui/Icon";

const RECENT_KEY = "palette-recent-commands";
const MAX_RECENT = 8;
const MULTI_STEP_COMMANDS: Record<string, () => Array<{ id: string; label: string }>> = {
  "editor.changeLanguageMode": () => [
    { id: "lang-typescript", label: "TypeScript" }, { id: "lang-javascript", label: "JavaScript" },
    { id: "lang-rust", label: "Rust" }, { id: "lang-python", label: "Python" },
    { id: "lang-go", label: "Go" }, { id: "lang-json", label: "JSON" },
    { id: "lang-html", label: "HTML" }, { id: "lang-css", label: "CSS" },
    { id: "lang-markdown", label: "Markdown" }, { id: "lang-yaml", label: "YAML" },
    { id: "lang-toml", label: "TOML" }, { id: "lang-sql", label: "SQL" },
    { id: "lang-shell", label: "Shell" }, { id: "lang-plaintext", label: "Plain Text" },
  ],
};

function loadRecent(): string[] {
  try { const s = localStorage.getItem(RECENT_KEY); return s ? JSON.parse(s) : []; }
  catch { return []; }
}

function saveRecent(id: string): void {
  try {
    const ids = loadRecent().filter(x => x !== id);
    ids.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  } catch { /* noop */ }
}

function HighlightedText(props: { segments: FuzzyHighlightSegment[] }) {
  return (
    <><For each={props.segments}>{(seg) =>
      seg.highlighted
        ? <span style={{ "font-weight": "600", color: "var(--jb-text-body-color)" }}>{seg.text}</span>
        : <span>{seg.text}</span>
    }</For></>
  );
}

function KeybindingBadge(props: { shortcut: string }) {
  const keys = () => props.shortcut.split(/\s*\+\s*/).map(k => k.trim());
  return (
    <div class="flex items-center gap-0.5 ml-auto shrink-0" style={{ "font-size": "9px", "font-family": "'SF Mono', 'JetBrains Mono', monospace" }}>
      <For each={keys()}>{(key, idx) => (<>
        <Show when={idx() > 0}><span style={{ margin: "0 1px", color: "var(--jb-text-muted-color)" }}>+</span></Show>
        <span style={{ display: "inline-flex", "align-items": "center", "justify-content": "center", "min-width": "14px",
          padding: "1px 4px", "border-radius": "var(--cortex-radius-sm)", background: "rgba(255,255,255,0.06)",
          color: "var(--jb-text-muted-color)", border: "1px solid rgba(255,255,255,0.06)" }}>{key}</span>
      </>)}</For>
    </div>
  );
}

const hdrStyle: JSX.CSSProperties = {
  height: "18px", padding: "0 8px", "font-size": "9px", "font-weight": "500",
  "text-transform": "uppercase", "letter-spacing": "0.5px",
  color: "var(--jb-text-muted-color)", display: "flex", "align-items": "center",
};

interface ScoredCommand extends Command { score: number; matchSegments: FuzzyHighlightSegment[]; isRecent: boolean; }

export function PaletteCommandPalette() {
  const { commands, showCommandPalette, setShowCommandPalette, executeCommand } = useCommands();
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [recentIds, setRecentIds] = createSignal<string[]>([]);
  const [subMode, setSubMode] = createSignal<{ parentId: string; label: string; items: Array<{ id: string; label: string }> } | null>(null);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  onMount(() => setRecentIds(loadRecent()));

  const effectiveQuery = createMemo(() => {
    const q = query();
    return q.startsWith(">") ? q.slice(1).trim() : q.trim();
  });

  const grouped = createMemo(() => {
    const q = effectiveQuery();
    const cmds = commands();
    const recent = recentIds();
    if (!q) {
      const recentSet = new Set(recent);
      const recentCmds: ScoredCommand[] = recent.map(id => cmds.find(c => c.id === id))
        .filter((c): c is Command => !!c)
        .map(c => ({ ...c, score: 0, matchSegments: [{ text: c.label, highlighted: false }], isRecent: true }));
      const rest: ScoredCommand[] = cmds.filter(c => !recentSet.has(c.id))
        .map(c => ({ ...c, score: 0, matchSegments: [{ text: c.label, highlighted: false }], isRecent: false }));
      return { recent: recentCmds, rest };
    }
    const scored: ScoredCommand[] = cmds.map(c => {
      const lr = fuzzyMatch(q, c.label);
      const cr = c.category ? fuzzyMatch(q, c.category) : { score: 0, matches: [] as number[] };
      const best = lr.score >= cr.score ? lr : cr;
      return { ...c, score: best.score, matchSegments: best === lr ? fuzzyHighlight(c.label, lr.matches) : fuzzyHighlight(c.label, []), isRecent: false };
    }).filter(c => c.score > 0).sort((a, b) => b.score - a.score);
    return { recent: [] as ScoredCommand[], rest: scored };
  });

  const categorizedRest = createMemo(() => {
    const cats = new Map<string, ScoredCommand[]>();
    for (const cmd of grouped().rest) {
      const cat = cmd.category || "General";
      if (!cats.has(cat)) cats.set(cat, []);
      cats.get(cat)!.push(cmd);
    }
    return Array.from(cats.entries()).sort(([a], [b]) => a.localeCompare(b));
  });

  const flatList = createMemo((): ScoredCommand[] => {
    const sub = subMode();
    if (sub) {
      const q = effectiveQuery();
      const mk = (i: { id: string; label: string }, s: number, segs: FuzzyHighlightSegment[]): ScoredCommand =>
        ({ id: i.id, label: i.label, score: s, matchSegments: segs, isRecent: false, category: sub.label, action: () => {} });
      if (!q) return sub.items.map(i => mk(i, 0, [{ text: i.label, highlighted: false }]));
      return sub.items.map(i => { const r = fuzzyMatch(q, i.label); return mk(i, r.score, fuzzyHighlight(i.label, r.matches)); })
        .filter(i => i.score > 0).sort((a, b) => b.score - a.score);
    }
    const { recent, rest } = grouped();
    if (!effectiveQuery()) return [...recent, ...categorizedRest().flatMap(([, c]) => c)];
    return [...recent, ...rest];
  });

  createEffect(() => { if (showCommandPalette()) { setQuery(""); setSelectedIndex(0); setRecentIds(loadRecent()); setSubMode(null); setTimeout(() => inputRef?.focus(), 10); } });
  createEffect(() => { query(); setSelectedIndex(0); });
  createEffect(() => { const idx = selectedIndex(); if (listRef) { const items = listRef.querySelectorAll("[data-palette-item]"); (items[idx] as HTMLElement)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); } });

  const handleSelect = (id: string) => {
    const sub = subMode();
    if (sub) { saveRecent(sub.parentId); setSubMode(null); setShowCommandPalette(false); executeCommand(sub.parentId); return; }
    if (MULTI_STEP_COMMANDS[id]) {
      const cmd = commands().find(c => c.id === id);
      setSubMode({ parentId: id, label: cmd?.label || id, items: MULTI_STEP_COMMANDS[id]() });
      setQuery(""); setSelectedIndex(0); return;
    }
    saveRecent(id); setShowCommandPalette(false); executeCommand(id);
  };

  const exitSubMode = () => { setSubMode(null); setQuery(""); setSelectedIndex(0); };

  const handleKeyDown = (e: KeyboardEvent) => {
    const list = flatList();
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const c = list[selectedIndex()]; if (c) handleSelect(c.id); }
    else if (e.key === "Escape") { e.preventDefault(); if (subMode()) exitSubMode(); else setShowCommandPalette(false); }
    else if (e.key === "Backspace" && !query() && subMode()) { e.preventDefault(); exitSubMode(); }
  };

  const handleGlobalEsc = (e: KeyboardEvent) => { if (e.key === "Escape" && showCommandPalette()) { e.preventDefault(); setShowCommandPalette(false); } };
  onMount(() => window.addEventListener("keydown", handleGlobalEsc));
  onCleanup(() => window.removeEventListener("keydown", handleGlobalEsc));

  const itemStyle = (sel: boolean): JSX.CSSProperties => ({
    display: "flex", "align-items": "center", gap: "6px", height: "24px", padding: "0 8px", margin: "1px 4px",
    "border-radius": "var(--cortex-radius-sm)", background: sel ? "rgba(255,255,255,0.08)" : "transparent",
    color: "var(--jb-text-body-color)", cursor: "pointer", "user-select": "none", "font-size": "11px",
  });

  const renderItem = (cmd: ScoredCommand, flatIdx: () => number) => {
    const sel = () => flatIdx() === selectedIndex();
    return (
      <div data-palette-item style={itemStyle(sel())} role="option" aria-selected={sel()}
        onMouseEnter={() => setSelectedIndex(flatIdx())} onClick={() => handleSelect(cmd.id)}>
        <Icon name="command" size={10} style={{ color: "var(--jb-text-muted-color)", "flex-shrink": "0" }} />
        <Show when={!subMode()}>
          <span style={{ "font-size": "10px", color: "var(--jb-text-muted-color)", "white-space": "nowrap" }}>{cmd.category || "General"}</span>
        </Show>
        <span style={{ flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
          <HighlightedText segments={cmd.matchSegments} />
        </span>
        <Show when={cmd.shortcut}><KeybindingBadge shortcut={cmd.shortcut!} /></Show>
      </div>
    );
  };

  const renderCategorizedList = () => {
    let offset = grouped().recent.length;
    return (<For each={categorizedRest()}>{([category, cmds]) => {
      const base = offset; offset += cmds.length;
      return (<><div style={hdrStyle}>{category}</div>
        <For each={cmds}>{(cmd, idx) => renderItem(cmd, () => base + idx())}</For></>);
    }}</For>);
  };

  return (
    <Show when={showCommandPalette()}>
      <div style={{ position: "fixed", inset: "0", "z-index": "2549", background: "transparent" }} onClick={() => setShowCommandPalette(false)} />
      <div style={{ position: "fixed", top: "44px", width: "420px", "max-width": "calc(100vw - 32px)", "z-index": "2550", left: "50%", transform: "translateX(-50%)",
        "border-radius": "var(--cortex-radius-md)", "font-size": "11px", "-webkit-app-region": "no-drag", background: "var(--ui-panel-bg)",
        color: "var(--jb-text-body-color)", border: "1px solid rgba(255,255,255,0.08)", "box-shadow": "0 4px 16px rgba(0,0,0,0.3)", overflow: "hidden",
      }} role="dialog" aria-label="Command Palette" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", "align-items": "center", padding: "6px 8px", gap: "6px", "border-bottom": "1px solid rgba(255,255,255,0.06)" }}>
          <Show when={subMode()} fallback={<Icon name="magnifying-glass" size={10} style={{ color: "var(--jb-text-muted-color)", "flex-shrink": "0" }} />}>
            <span style={{ cursor: "pointer", color: "var(--jb-text-muted-color)", "flex-shrink": "0", "font-size": "10px" }} onClick={exitSubMode}>← {subMode()!.label}</span>
          </Show>
          <input ref={inputRef} type="text" placeholder={subMode() ? "Filter..." : "Type a command..."} value={query()}
            onInput={e => setQuery(e.currentTarget.value)} onKeyDown={handleKeyDown}
            style={{ flex: "1", height: "18px", background: "transparent", border: "none", outline: "none", color: "var(--jb-text-body-color)", "font-size": "11px" }} />
        </div>
        <div role="listbox" style={{ "line-height": "18px" }}>
          <div ref={listRef} style={{ "max-height": "280px", overflow: "auto", "overscroll-behavior": "contain", "padding-bottom": "3px" }}>
            <Show when={flatList().length === 0}>
              <div style={{ padding: "10px", "text-align": "center", "font-size": "10px", color: "var(--jb-text-muted-color)" }}>No commands found</div>
            </Show>
            <div style={{ padding: "0 6px" }}>
              <Show when={!subMode()}>
                <Show when={grouped().recent.length > 0}>
                  <div style={hdrStyle}>Recently Used</div>
                  <For each={grouped().recent}>{(cmd, idx) => renderItem(cmd, idx)}</For>
                  <Show when={grouped().rest.length > 0}><div style={{ height: "1px", margin: "4px 8px", background: "var(--jb-border-default)" }} /></Show>
                </Show>
                <Show when={!effectiveQuery()} fallback={
                  <For each={grouped().rest}>{(cmd, idx) => { const o = grouped().recent.length; return renderItem(cmd, () => o + idx()); }}</For>
                }>{renderCategorizedList()}</Show>
              </Show>
              <Show when={subMode()}>
                <For each={flatList()}>{(cmd, idx) => renderItem(cmd, idx)}</For>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
