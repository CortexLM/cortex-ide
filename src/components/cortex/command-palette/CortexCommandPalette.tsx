import { createMemo, createEffect, For, Show, onMount, onCleanup, batch, JSX } from "solid-js";
import { useCommandPalette } from "@/context/CommandPaletteContext";
import { useCommands } from "@/context/CommandContext";
import { fuzzyMatch, fuzzyHighlight } from "@/services/fuzzySearch";
import type { FuzzyHighlightSegment } from "@/services/fuzzySearch";
import { CortexIcon } from "../primitives";
import { createLogger } from "@/utils/logger";

const logger = createLogger("CommandPalette");

const RECENT_KEY = "cortex-palette-recent";
const MAX_RECENT = 8;

function getRecentCommands(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch (e) { logger.warn("Failed to parse recent commands from localStorage", e); return []; }
}

function addRecentCommand(id: string): void {
  try {
    const recent = getRecentCommands().filter(r => r !== id);
    recent.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch (e) { logger.warn("Failed to save recent command to localStorage", e); }
}

interface ScoredCommand {
  id: string; label: string; shortcut?: string; category?: string;
  action: () => void; score: number; matches: number[];
}

interface GroupedSection { category: string; items: ScoredCommand[]; }

const parseShortcut = (s: string): string[] => s.split(/\s*\+\s*/).map(k => k.trim());

function HighlightedText(props: { text: string; matches: number[] }) {
  const segments = (): FuzzyHighlightSegment[] => fuzzyHighlight(props.text, props.matches);
  return (
    <For each={segments()}>
      {(seg) => seg.highlighted
        ? <span style={highlightStyle}>{seg.text}</span>
        : <span>{seg.text}</span>}
    </For>
  );
}

const backdropStyle: JSX.CSSProperties = {
  position: "fixed", inset: "0", "z-index": "2549", background: "transparent",
};

const popupStyle: JSX.CSSProperties = {
  position: "fixed", top: "44px", left: "50%", transform: "translateX(-50%)",
  width: "720px", "max-width": "calc(100vw - 48px)", "z-index": "2550",
  "border-radius": "var(--cortex-radius-md, 12px)", "font-size": "18px",
  background: "var(--cortex-bg-elevated, #1e1e1e)", color: "var(--cortex-text-primary, #e0e0e0)",
  border: "1px solid var(--cortex-border-default, rgba(255,255,255,0.08))",
  "box-shadow": "0 8px 32px rgba(0,0,0,0.4)", overflow: "hidden",
  "-webkit-app-region": "no-drag",
};

const headerStyle: JSX.CSSProperties = {
  display: "flex", "align-items": "center", padding: "12px 15px", gap: "12px",
  "border-bottom": "1px solid var(--cortex-border-default, rgba(255,255,255,0.06))",
};

const searchIconStyle: JSX.CSSProperties = { color: "var(--cortex-text-muted)", "flex-shrink": "0" };

const inputStyle: JSX.CSSProperties = {
  flex: "1", height: "33px", background: "transparent", border: "none", outline: "none",
  color: "var(--cortex-text-primary, #e0e0e0)", "font-size": "18px",
};

const listStyle: JSX.CSSProperties = {
  "max-height": "600px", overflow: "auto", "overscroll-behavior": "contain", padding: "6px 0",
};

const emptyStyle: JSX.CSSProperties = {
  padding: "24px", "text-align": "center", "font-size": "17px", color: "var(--cortex-text-muted, #888)",
};

const separatorStyle: JSX.CSSProperties = {
  height: "1px", margin: "6px 18px", background: "var(--cortex-border-default, rgba(255,255,255,0.06))",
};

const sectionHeaderStyle: JSX.CSSProperties = {
  padding: "6px 18px", "font-size": "15px", "font-weight": "500",
  "text-transform": "uppercase", "letter-spacing": "0.75px", color: "var(--cortex-text-muted, #888)",
};

const highlightStyle: JSX.CSSProperties = {
  "font-weight": "600", color: "var(--cortex-text-primary)",
};

const rowBaseStyle: JSX.CSSProperties = {
  display: "flex", "align-items": "center", gap: "12px", height: "42px", padding: "0 18px",
  margin: "2px 6px", "border-radius": "var(--cortex-radius-sm, 6px)",
  cursor: "pointer", "user-select": "none", "font-size": "18px", transition: "background 80ms ease",
};

const rowIconStyle: JSX.CSSProperties = { color: "var(--cortex-text-muted)", "flex-shrink": "0" };

const categoryStyle: JSX.CSSProperties = {
  "font-size": "15px", color: "var(--cortex-text-muted, #888)", "white-space": "nowrap",
};

const labelStyle: JSX.CSSProperties = {
  flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap",
};

const shortcutContainerStyle: JSX.CSSProperties = {
  display: "flex", "align-items": "center", "margin-left": "auto", gap: "3px",
  "font-size": "15px", "font-family": "'SF Mono', 'JetBrains Mono', monospace",
};

const shortcutSepStyle: JSX.CSSProperties = { color: "var(--cortex-text-muted)", margin: "0 2px" };

const shortcutKeyStyle: JSX.CSSProperties = {
  display: "inline-flex", "align-items": "center", "justify-content": "center",
  "min-width": "24px", padding: "2px 6px", "border-radius": "var(--cortex-radius-sm, 5px)",
  background: "rgba(255,255,255,0.06)", color: "var(--cortex-text-muted, #888)",
  border: "1px solid rgba(255,255,255,0.06)", "font-size": "14px",
};

export function CortexCommandPalette() {
  const palette = useCommandPalette();
  const { commands, executeCommand } = useCommands();
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  const recentIds = () => { palette.isOpen(); return getRecentCommands(); };

  const searchQuery = () => {
    const q = palette.query();
    return palette.detectMode(q) === "commands" && q.startsWith(">") ? q.slice(1).trim() : q.trim();
  };

  const scored = createMemo((): ScoredCommand[] => {
    const q = searchQuery();
    const cmds = commands();
    if (!q) return cmds.map(c => ({ ...c, score: 0, matches: [] as number[] }));
    return cmds
      .map(c => {
        const lr = fuzzyMatch(q, c.label);
        const cr = c.category ? fuzzyMatch(q, c.category) : { score: 0, matches: [] as number[] };
        return { ...c, score: Math.max(lr.score, cr.score), matches: lr.score >= cr.score ? lr.matches : [] as number[] };
      })
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score);
  });

  const recentSection = createMemo((): ScoredCommand[] => {
    if (searchQuery()) return [];
    const map = new Map(scored().map(c => [c.id, c]));
    return recentIds().map(id => map.get(id)).filter((c): c is ScoredCommand => c !== undefined);
  });

  const groupedSections = createMemo((): GroupedSection[] => {
    const recentIdSet = new Set(searchQuery() ? [] : recentIds());
    const groups = new Map<string, ScoredCommand[]>();
    for (const cmd of scored().filter(c => !recentIdSet.has(c.id))) {
      const cat = cmd.category || "General";
      const arr = groups.get(cat);
      if (arr) arr.push(cmd); else groups.set(cat, [cmd]);
    }
    return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
  });

  const flatList = createMemo((): ScoredCommand[] => {
    const result: ScoredCommand[] = [...recentSection()];
    for (const g of groupedSections()) result.push(...g.items);
    return result;
  });

  createEffect(() => { if (palette.isOpen()) setTimeout(() => inputRef?.focus(), 10); });

  createEffect(() => {
    const idx = palette.selectedIndex();
    const el = listRef?.querySelectorAll("[data-command-item]")[idx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); palette.selectNext(flatList().length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); palette.selectPrev(); }
    else if (e.key === "Enter") { e.preventDefault(); const c = flatList()[palette.selectedIndex()]; if (c) handleSelect(c.id); }
    else if (e.key === "Escape") { e.preventDefault(); palette.close(); }
  };

  const handleSelect = (id: string) => {
    addRecentCommand(id);
    batch(() => { palette.close(); });
    executeCommand(id);
  };

  const onEscape = (e: KeyboardEvent) => { if (e.key === "Escape" && palette.isOpen()) { e.preventDefault(); palette.close(); } };
  onMount(() => window.addEventListener("keydown", onEscape));
  onCleanup(() => window.removeEventListener("keydown", onEscape));

  const flatIndexMap = createMemo(() => {
    const map = new Map<string, number>();
    flatList().forEach((cmd, idx) => map.set(cmd.id, idx));
    return map;
  });

  return (
    <Show when={palette.isOpen()}>
      <div style={backdropStyle} onClick={() => palette.close()} />
      <div role="dialog" aria-label="Command Palette" onClick={(e) => e.stopPropagation()} style={popupStyle}>
        <div style={headerStyle}>
          <CortexIcon name="search" size={18} style={searchIconStyle} />
          <input ref={inputRef} type="text" placeholder="Type a command..." value={palette.query()}
            onInput={(e) => palette.setQuery(e.currentTarget.value)} onKeyDown={handleKeyDown}
            aria-haspopup="listbox" aria-autocomplete="list" aria-controls="cortex-palette-list" style={inputStyle} />
        </div>
        <div id="cortex-palette-list" role="listbox" ref={listRef} style={listStyle}>
          <Show when={flatList().length === 0}>
            <div style={emptyStyle}>No commands found</div>
          </Show>
          <Show when={recentSection().length > 0}>
            <div style={sectionHeaderStyle}>Recently Used</div>
            <For each={recentSection()}>{(cmd) => <CommandRow cmd={cmd} index={flatIndexMap().get(cmd.id) ?? 0} palette={palette} onSelect={handleSelect} />}</For>
            <Show when={groupedSections().length > 0}><div style={separatorStyle} /></Show>
          </Show>
          <For each={groupedSections()}>{(group) => (<>
            <div style={sectionHeaderStyle}>{group.category}</div>
            <For each={group.items}>{(cmd) => <CommandRow cmd={cmd} index={flatIndexMap().get(cmd.id) ?? 0} palette={palette} onSelect={handleSelect} />}</For>
          </>)}</For>
        </div>
      </div>
    </Show>
  );
}

function CommandRow(props: {
  cmd: ScoredCommand; index: number;
  palette: ReturnType<typeof useCommandPalette>; onSelect: (id: string) => void;
}) {
  const isSelected = () => props.palette.selectedIndex() === props.index;
  const bgStyle = (): JSX.CSSProperties => ({
    ...rowBaseStyle,
    background: isSelected() ? "var(--cortex-bg-primary, rgba(255,255,255,0.08))" : "transparent",
  });
  return (
    <div data-command-item role="option" aria-selected={isSelected()}
      onMouseEnter={() => props.palette.setSelectedIndex(props.index)}
      onClick={() => props.onSelect(props.cmd.id)} style={bgStyle()}>
      <CortexIcon name="command" size={18} style={rowIconStyle} />
      <Show when={props.cmd.category}>
        <span style={categoryStyle}>{props.cmd.category}</span>
      </Show>
      <span style={labelStyle}>
        <HighlightedText text={props.cmd.label} matches={props.cmd.matches} />
      </span>
      <Show when={props.cmd.shortcut}>
        <div style={shortcutContainerStyle}>
          <For each={parseShortcut(props.cmd.shortcut!)}>{(key, ki) => (<>
            <Show when={ki() > 0}><span style={shortcutSepStyle}>+</span></Show>
            <span style={shortcutKeyStyle}>{key}</span>
          </>)}</For>
        </div>
      </Show>
    </div>
  );
}

export default CortexCommandPalette;
