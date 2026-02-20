import { createSignal, createEffect, createMemo, For, Show, onMount, onCleanup, JSX } from "solid-js";
import { useCommands } from "@/context/CommandContext";
import { useOutline, type DocumentSymbol, type SymbolKind } from "@/context/OutlineContext";
import { Icon } from "@/components/ui/Icon";
import "@/styles/quickinput.css";

const symbolIcons: Record<SymbolKind, { icon: string; color: string }> = {
  file: { icon: "code", color: "var(--cortex-text-inactive)" },
  module: { icon: "m", color: "var(--cortex-warning)" },
  namespace: { icon: "n", color: "var(--cortex-info)" },
  package: { icon: "p", color: "var(--cortex-warning)" },
  class: { icon: "c", color: "var(--cortex-warning)" },
  method: { icon: "function", color: "var(--cortex-info)" },
  property: { icon: "box", color: "var(--cortex-info)" },
  field: { icon: "f", color: "var(--cortex-info)" },
  constructor: { icon: "lambda", color: "var(--cortex-info)" },
  enum: { icon: "e", color: "var(--cortex-warning)" },
  interface: { icon: "i", color: "var(--cortex-success)" },
  function: { icon: "function", color: "var(--cortex-info)" },
  variable: { icon: "v", color: "var(--cortex-info)" },
  constant: { icon: "k", color: "var(--cortex-info)" },
  string: { icon: "s", color: "var(--cortex-success)" },
  number: { icon: "hashtag", color: "var(--cortex-success)" },
  boolean: { icon: "toggle-on", color: "var(--cortex-success)" },
  array: { icon: "brackets-square", color: "var(--cortex-warning)" },
  object: { icon: "brackets-curly", color: "var(--cortex-warning)" },
  key: { icon: "k", color: "var(--cortex-info)" },
  null: { icon: "circle-dot", color: "var(--cortex-text-inactive)" },
  enumMember: { icon: "hashtag", color: "var(--cortex-info)" },
  struct: { icon: "s", color: "var(--cortex-warning)" },
  event: { icon: "circle-dot", color: "var(--cortex-error)" },
  operator: { icon: "o", color: "var(--cortex-text-inactive)" },
  typeParameter: { icon: "t", color: "var(--cortex-success)" },
};

const kindLabels: Record<SymbolKind, string> = {
  file: "File", module: "Module", namespace: "Namespace", package: "Package",
  class: "Class", method: "Method", property: "Property", field: "Field",
  constructor: "Constructor", enum: "Enum", interface: "Interface",
  function: "Function", variable: "Variable", constant: "Constant",
  string: "String", number: "Number", boolean: "Boolean", array: "Array",
  object: "Object", key: "Key", null: "Null", enumMember: "Enum Member",
  struct: "Struct", event: "Event", operator: "Operator", typeParameter: "Type Param",
};

interface FlatSymbol extends DocumentSymbol { containerName?: string }

function flattenSymbols(symbols: DocumentSymbol[], parent?: string): FlatSymbol[] {
  const result: FlatSymbol[] = [];
  for (const s of symbols) {
    result.push({ ...s, containerName: parent });
    if (s.children?.length) result.push(...flattenSymbols(s.children, s.name));
  }
  return result;
}

function fuzzyMatch(query: string, text: string): { score: number; matches: number[] } {
  if (!query) return { score: 0, matches: [] };
  const qL = query.toLowerCase(), tL = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) if (tL[ti] === qL[qi]) qi++;
  if (qi !== query.length) return { score: 0, matches: [] };
  const matches: number[] = [];
  let score = 0, lastIdx = -1, consec = 0;
  qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (tL[ti] === qL[qi]) {
      matches.push(ti);
      let s = 1;
      if (lastIdx === ti - 1) { consec++; s += consec * 5; } else consec = 0;
      if (ti === 0) s += 10;
      else { const p = text[ti - 1]; if ("_-. ".includes(p)) s += 8; else if (p === p.toLowerCase() && text[ti] !== text[ti].toLowerCase()) s += 6; }
      if (query[qi] === text[ti]) s += 2;
      if (lastIdx >= 0 && ti - lastIdx > 1) s -= Math.min(ti - lastIdx - 1, 3);
      score += s; lastIdx = ti; qi++;
    }
  }
  return { score: score * (1 + 10 / (text.length + 10)), matches };
}

function highlightMatches(text: string, matches?: number[]): JSX.Element {
  if (!matches?.length) return <span>{text}</span>;
  const parts: JSX.Element[] = [];
  let last = 0;
  const set = new Set(matches);
  for (let i = 0; i < text.length; i++) {
    if (set.has(i)) {
      if (i > last) parts.push(<span>{text.slice(last, i)}</span>);
      parts.push(<span class="quick-input-highlight">{text[i]}</span>);
      last = i + 1;
    }
  }
  if (last < text.length) parts.push(<span>{text.slice(last)}</span>);
  return <>{parts}</>;
}

export function GoToSymbolDialog() {
  const { showDocumentSymbolPicker, setShowDocumentSymbolPicker } = useCommands();
  const { state: outlineState, navigateToSymbol } = useOutline();
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  const filteredSymbols = createMemo(() => {
    const flat = flattenSymbols(outlineState.symbols);
    const q = query().replace(/^@/, "").trim();
    if (!q) return flat.sort((a, b) => a.range.startLine - b.range.startLine).slice(0, 100).map(s => ({ ...s, score: 0, matches: [] as number[] }));
    return flat.map(sym => {
      const r = fuzzyMatch(q, sym.name);
      const cr = sym.containerName ? fuzzyMatch(q, sym.containerName) : { score: 0 };
      return { ...sym, score: r.score * 2 + cr.score, matches: r.matches };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 100);
  });

  createEffect(() => { if (showDocumentSymbolPicker()) { setQuery(""); setSelectedIndex(0); setTimeout(() => inputRef?.focus(), 10); } });
  createEffect(() => { query(); setSelectedIndex(0); });
  createEffect(() => { const el = listRef?.querySelectorAll("[data-symbol-item]")[selectedIndex()] as HTMLElement; el?.scrollIntoView({ block: "nearest", behavior: "smooth" }); });

  const handleGlobalKeyDown = (e: KeyboardEvent) => { if (showDocumentSymbolPicker() && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setShowDocumentSymbolPicker(false); } };
  onMount(() => window.addEventListener("keydown", handleGlobalKeyDown, true));
  onCleanup(() => window.removeEventListener("keydown", handleGlobalKeyDown, true));

  const handleSelect = (symbol: FlatSymbol) => { setShowDocumentSymbolPicker(false); navigateToSymbol(symbol); };

  const handleInputKeyDown = (e: KeyboardEvent) => {
    const syms = filteredSymbols();
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, syms.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const sym = syms[selectedIndex()]; if (sym) handleSelect(sym); }
    else if (e.key === "Tab") { e.preventDefault(); setSelectedIndex(i => e.shiftKey ? Math.max(i - 1, 0) : Math.min(i + 1, syms.length - 1)); }
  };

  return (
    <Show when={showDocumentSymbolPicker()}>
      <div class="quick-input-backdrop" onClick={() => setShowDocumentSymbolPicker(false)} />
      <div class="quick-input-widget" style={{ top: "12vh" }} role="dialog" aria-label="Go to Symbol in Editor" onClick={(e) => e.stopPropagation()}>
        <div class="quick-input-header">
          <div class="quick-input-filter">
            <div class="quick-input-box">
              <div class="monaco-inputbox" style={{ "border-radius": "var(--cortex-radius-sm)", display: "flex", "align-items": "center", gap: "8px" }}>
                <Icon name="magnifying-glass" style={{ width: "16px", height: "16px", color: "var(--jb-text-muted-color)", "flex-shrink": "0" }} />
                <input ref={inputRef} type="text" class="quick-input-input" placeholder="Type @ to filter symbols..." value={query()} onInput={(e) => setQuery(e.currentTarget.value)} onKeyDown={handleInputKeyDown} role="textbox" aria-haspopup="menu" aria-autocomplete="list" aria-controls="symbol-picker-list" />
              </div>
            </div>
          </div>
        </div>
        <div class="quick-input-progress"><div class="progress-bit" /></div>
        <div class="quick-input-list" id="symbol-picker-list" role="listbox">
          <div ref={listRef} class="list-container" style={{ "max-height": "440px", overflow: "auto", "overscroll-behavior": "contain" }}>
            <Show when={outlineState.loading}>
              <div style={{ padding: "16px", "text-align": "center" }}>
                <p style={{ "font-size": "13px", color: "var(--jb-text-muted-color)" }}>Loading symbols...</p>
              </div>
            </Show>
            <Show when={!outlineState.loading && filteredSymbols().length === 0}>
              <div style={{ padding: "16px", "text-align": "center" }}>
                <p style={{ "font-size": "13px", color: "var(--jb-text-muted-color)" }}>
                  {query().replace(/^@/, "").trim() ? "No matching symbols" : outlineState.symbols.length === 0 ? "No symbols in this file" : "Type to filter symbols"}
                </p>
              </div>
            </Show>
            <div class="scrollable-element">
              <For each={filteredSymbols()}>
                {(symbol, index) => {
                  const ic = symbolIcons[symbol.kind] || symbolIcons.variable;
                  return (
                    <div data-symbol-item class="quick-input-list-row" classList={{ focused: index() === selectedIndex() }} style={{ height: "22px" }} role="option" aria-selected={index() === selectedIndex()} onMouseEnter={() => setSelectedIndex(index())} onClick={() => handleSelect(symbol)}>
                      <div class="quick-input-list-entry">
                        <div class="quick-input-list-icon" style={{ color: ic.color }}>
                          <Icon name={ic.icon} style={{ width: "14px", height: "14px" }} />
                        </div>
                        <div class="quick-input-list-rows">
                          <div class="quick-input-list-row-content" style={{ gap: "6px" }}>
                            <span class="quick-input-label-name" style={{ "font-size": "13px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                              {highlightMatches(symbol.name, symbol.matches)}
                            </span>
                            <Show when={symbol.containerName}>
                              <span class="quick-input-label-description" style={{ "font-size": "12px", color: "var(--jb-text-muted-color)" }}>in {symbol.containerName}</span>
                            </Show>
                          </div>
                        </div>
                        <span style={{ "font-size": "10px", color: "var(--jb-text-muted-color)", "margin-left": "auto", "padding-right": "4px", "white-space": "nowrap" }}>
                          {kindLabels[symbol.kind] || symbol.kind}
                        </span>
                        <span class="quick-input-label-description" style={{ display: "flex", "align-items": "center", "flex-shrink": "0", color: "var(--jb-text-muted-color)", "font-size": "11px" }}>
                          :{symbol.range.startLine + 1}
                        </span>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", padding: "4px 6px", "font-size": "11px", "border-top": "1px solid var(--jb-border-default)", color: "var(--jb-text-muted-color)", background: "var(--jb-canvas)" }}>
          <span style={{ display: "flex", gap: "8px" }}>
            <span><span class="quick-input-keybinding-key" style={{ padding: "2px 4px" }}>↑</span><span class="quick-input-keybinding-key" style={{ padding: "2px 4px" }}>↓</span> navigate</span>
            <span><span class="quick-input-keybinding-key" style={{ padding: "2px 4px" }}>Enter</span> go to symbol</span>
            <span><span class="quick-input-keybinding-key" style={{ padding: "2px 4px" }}>Esc</span> close</span>
          </span>
          <span>{filteredSymbols().length} symbol{filteredSymbols().length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </Show>
  );
}
