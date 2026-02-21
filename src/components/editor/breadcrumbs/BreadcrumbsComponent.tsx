import { createSignal, createEffect, onCleanup, createMemo, Show, For } from "solid-js";
import { Portal } from "solid-js/web";
import { invoke } from "@tauri-apps/api/core";
import { useEditor } from "@/context/EditorContext";
import { useSettings } from "@/context/SettingsContext";
import { useOutline } from "@/context/OutlineContext";
import { Icon } from "../../ui/Icon";
import { getProjectPath } from "@/utils/workspace";
import { useToast } from "@/context/ToastContext";
import "@/styles/tabs.css";
import { SYMBOL_ICONS, SYMBOL_COLORS, BREADCRUMB_CSS_VARS } from "./breadcrumbConstants";
import { copyBreadcrumbsPath, copyBreadcrumbsRelativePath, revealBreadcrumbsInExplorer, getFileIconPath, convertToSymbolInfo, findSymbolAtPosition, flattenSymbols, convertLspRawToSymbolInfo } from "./breadcrumbHelpers";
import { BreadcrumbsPicker } from "./BreadcrumbsPicker";
import { BreadcrumbContextMenu } from "./BreadcrumbContextMenu";
import type { BreadcrumbsProps, BreadcrumbsSettings, PathSegment, SymbolInfo, SiblingItem } from "./breadcrumbTypes";

export function Breadcrumbs(props: BreadcrumbsProps) {
  const { openFile } = useEditor();
  const toast = useToast();
  const outline = useOutline();
  const settingsContext = useSettings();
  const [segments, setSegments] = createSignal<PathSegment[]>([]);
  const [symbolPath, setSymbolPath] = createSignal<SymbolInfo[]>([]);
  const [allSymbols, setAllSymbols] = createSignal<SymbolInfo[]>([]);
  const [dropdownOpen, setDropdownOpen] = createSignal<number | "symbol" | null>(null);
  const [siblings, setSiblings] = createSignal<SiblingItem[]>([]);
  const [loadingSiblings, setLoadingSiblings] = createSignal(false);
  const [contextMenuPos, setContextMenuPos] = createSignal<{ x: number; y: number } | null>(null);
  const [pickerPosition, setPickerPosition] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFocused, setIsFocused] = createSignal(false);
  const [focusedIndex, setFocusedIndex] = createSignal<number>(-1);
  const [cursorPosition, setCursorPosition] = createSignal<{ line: number; column: number }>({ line: 1, column: 1 });
  let breadcrumbsRef: HTMLDivElement | undefined;
  let dropdownRef: HTMLDivElement | undefined;
  let contextMenuRef: HTMLDivElement | undefined;

  const breadcrumbsSettings = createMemo((): BreadcrumbsSettings => {
    const theme = settingsContext.effectiveSettings()?.theme;
    const bc = theme?.breadcrumbs;
    return { enabled: bc?.enabled ?? theme?.breadcrumbsEnabled ?? true, filePath: bc?.filePath ?? "on", symbolPath: bc?.symbolPath ?? "on", icons: bc?.icons ?? true };
  });
  const isEnabled = () => breadcrumbsSettings().enabled;

  createEffect(() => {
    const file = props.file;
    if (!file?.path) { setSegments([]); return; }
    const nfp = file.path.replace(/\\/g, "/");
    let wr = props.workspaceRoot?.replace(/\\/g, "/") || null;
    if (!wr) { const sp = getProjectPath(); if (sp) wr = sp.replace(/\\/g, "/"); }
    let rel = nfp;
    if (wr && nfp.toLowerCase().startsWith(wr.toLowerCase())) { rel = nfp.substring(wr.length); if (rel.startsWith("/")) rel = rel.substring(1); }
    if (/^[A-Za-z]:/.test(rel) || rel.startsWith("/")) { const p = nfp.split("/").filter(Boolean); rel = p.length > 2 ? p.slice(-2).join("/") : p.join("/"); }
    const parts = rel.split("/").filter(Boolean);
    const segs: PathSegment[] = [];
    let cur = wr || "";
    for (let i = 0; i < parts.length; i++) { cur = cur ? `${cur}/${parts[i]}` : parts[i]; segs.push({ name: parts[i], path: cur, isFile: i === parts.length - 1 }); }
    const s = breadcrumbsSettings();
    if (s.filePath === "off") setSegments([]); else if (s.filePath === "last" && segs.length > 0) setSegments([segs[segs.length - 1]]); else setSegments(segs);
  });

  const workspaceName = createMemo(() => {
    const wr = props.workspaceRoot?.replace(/\\/g, "/") || getProjectPath()?.replace(/\\/g, "/");
    if (!wr) return null;
    const parts = wr.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  });

  createEffect(() => { const syms = outline.state.symbols; setAllSymbols(syms?.length ? flattenSymbols(syms.map(s => convertToSymbolInfo(s))) : []); });

  createEffect(() => {
    const file = props.file;
    const syms = outline.state.symbols;
    if (syms?.length || !file?.path || !file.content) return;
    invoke<unknown[]>("lsp_document_symbols", { filePath: file.path, content: file.content, language: file.language }).then((raw) => {
      if (!Array.isArray(raw) || raw.length === 0) return;
      if (outline.state.symbols?.length) return;
      const converted = convertLspRawToSymbolInfo(raw as Parameters<typeof convertLspRawToSymbolInfo>[0]);
      setAllSymbols(flattenSymbols(converted));
      const pos = cursorPosition();
      const path = findSymbolAtPosition(converted, pos.line - 1, pos.column - 1);
      const s = breadcrumbsSettings();
      if (s.symbolPath === "off") setSymbolPath([]);
      else if (s.symbolPath === "last" && path.length > 0) setSymbolPath([path[path.length - 1]]);
      else setSymbolPath(path);
    }).catch(() => { /* LSP unavailable, outline context handles fallback */ });
  });

  createEffect(() => {
    const pos = cursorPosition(); const syms = outline.state.symbols;
    if (!syms?.length) { setSymbolPath([]); return; }
    const path = findSymbolAtPosition(syms.map(s => convertToSymbolInfo(s)), pos.line - 1, pos.column - 1);
    const s = breadcrumbsSettings();
    if (s.symbolPath === "off") setSymbolPath([]); else if (s.symbolPath === "last" && path.length > 0) setSymbolPath([path[path.length - 1]]); else setSymbolPath(path);
  });

  createEffect(() => {
    const h = (e: CustomEvent<{ line: number; column: number }>) => { if (e.detail) setCursorPosition({ line: e.detail.line ?? 1, column: e.detail.column ?? 1 }); };
    window.addEventListener("editor:cursor-change", h as EventListener);
    onCleanup(() => window.removeEventListener("editor:cursor-change", h as EventListener));
  });
  createEffect(() => {
    const h = (e: MouseEvent) => { if (dropdownRef && !dropdownRef.contains(e.target as Node) && breadcrumbsRef && !breadcrumbsRef.contains(e.target as Node)) setDropdownOpen(null); };
    if (dropdownOpen() !== null) document.addEventListener("mousedown", h);
    onCleanup(() => document.removeEventListener("mousedown", h));
  });
  createEffect(() => {
    const h = (e: MouseEvent) => { if (contextMenuRef && !contextMenuRef.contains(e.target as Node)) setContextMenuPos(null); };
    if (contextMenuPos() !== null) document.addEventListener("mousedown", h);
    onCleanup(() => document.removeEventListener("mousedown", h));
  });
  createEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === ".") { e.preventDefault(); setIsFocused(true); setFocusedIndex(0); breadcrumbsRef?.focus(); } };
    window.addEventListener("keydown", h); onCleanup(() => window.removeEventListener("keydown", h));
  });

  const handleBreadcrumbsKeyDown = (e: KeyboardEvent) => {
    if (!isFocused()) return;
    const total = segments().length + symbolPath().length; const ci = focusedIndex();
    switch (e.key) {
      case "ArrowLeft": e.preventDefault(); setFocusedIndex(Math.max(0, ci - 1)); break;
      case "ArrowRight": e.preventDefault(); setFocusedIndex(Math.min(total - 1, ci + 1)); break;
      case "Enter": case " ": { e.preventDefault(); const segs = segments(); if (ci < segs.length) handleSegmentClick(ci, segs[ci]); else { const si = ci - segs.length; if (symbolPath()[si]) handleSymbolClick(si); } break; }
      case "Escape": e.preventDefault(); setIsFocused(false); setDropdownOpen(null); break;
      case "ArrowDown": { e.preventDefault(); const segs = segments(); if (ci < segs.length) handleSegmentClick(ci, segs[ci]); else { const si = ci - segs.length; if (symbolPath()[si]) handleSymbolClick(si); } break; }
      case "ArrowUp": { e.preventDefault(); setDropdownOpen(null); break; }
      case "Home": e.preventDefault(); setFocusedIndex(0); break;
      case "End": e.preventDefault(); setFocusedIndex(total - 1); break;
    }
  };

  createEffect(() => {
    const cpCmd = async () => { const fp = props.file?.path; const ok = await copyBreadcrumbsPath(fp); if (ok) toast.success("Path copied to clipboard"); else if (!fp) toast.warning("No file open"); else toast.error("Failed to copy path"); };
    const crpCmd = async () => { const fp = props.file?.path; const ok = await copyBreadcrumbsRelativePath(fp); if (ok) toast.success("Relative path copied to clipboard"); else if (!fp) toast.warning("No file open"); else toast.error("Failed to copy path"); };
    const revCmd = async () => { const fp = props.file?.path; const ok = await revealBreadcrumbsInExplorer(fp); if (!ok) { if (!fp) toast.warning("No file open"); else toast.error("Failed to reveal in explorer"); } };
    const focCmd = () => { setIsFocused(true); setFocusedIndex(0); breadcrumbsRef?.focus(); };
    const togCmd = async () => { const c = breadcrumbsSettings().enabled; await settingsContext.updateThemeSetting("breadcrumbsEnabled", !c); toast.info(c ? "Breadcrumbs disabled" : "Breadcrumbs enabled"); };
    window.addEventListener("breadcrumbs:copy-path", cpCmd); window.addEventListener("breadcrumbs:copy-relative-path", crpCmd);
    window.addEventListener("breadcrumbs:reveal-in-explorer", revCmd); window.addEventListener("breadcrumbs:focus", focCmd); window.addEventListener("breadcrumbs:toggle", togCmd);
    onCleanup(() => { window.removeEventListener("breadcrumbs:copy-path", cpCmd); window.removeEventListener("breadcrumbs:copy-relative-path", crpCmd); window.removeEventListener("breadcrumbs:reveal-in-explorer", revCmd); window.removeEventListener("breadcrumbs:focus", focCmd); window.removeEventListener("breadcrumbs:toggle", togCmd); });
  });

  const handleContextMenu = (e: MouseEvent) => { e.preventDefault(); setContextMenuPos({ x: e.clientX, y: e.clientY }); setDropdownOpen(null); };
  const handleCopyPath = async () => { const ok = await copyBreadcrumbsPath(props.file?.path); toast[ok ? "success" : "error"](ok ? "Path copied to clipboard" : "Failed to copy path"); setContextMenuPos(null); };
  const handleCopyRelativePath = async () => { const ok = await copyBreadcrumbsRelativePath(props.file?.path); toast[ok ? "success" : "error"](ok ? "Relative path copied to clipboard" : "Failed to copy path"); setContextMenuPos(null); };
  const handleRevealInExplorer = async () => { const ok = await revealBreadcrumbsInExplorer(props.file?.path); if (!ok) toast.error("Failed to reveal in explorer"); setContextMenuPos(null); };

  const fetchSiblings = async (path: string) => {
    setLoadingSiblings(true);
    try {
      const pp = path.split("/").slice(0, -1).join("/") || path.split("\\").slice(0, -1).join("\\") || ".";
      const entries = await invoke<Array<{ name: string; path: string; is_directory: boolean }>>("fs_list_directory", { path: pp });
      const items: SiblingItem[] = entries.map(e => ({ name: e.name, path: e.path, isDirectory: e.is_directory }));
      items.sort((a, b) => a.isDirectory !== b.isDirectory ? (a.isDirectory ? -1 : 1) : a.name.localeCompare(b.name));
      setSiblings(items);
    } catch { setSiblings([]); } finally { setLoadingSiblings(false); }
  };

  const handleDragStart = (e: DragEvent, seg: PathSegment) => {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', seg.path);
    e.dataTransfer.setData('application/cortex-path', JSON.stringify({ path: seg.path, isFile: seg.isFile, name: seg.name }));
    e.dataTransfer.effectAllowed = 'copyMove';
    const g = document.createElement('div'); g.className = 'breadcrumb-drag-ghost'; g.textContent = seg.name;
    g.style.position = 'absolute'; g.style.top = '-1000px'; g.style.left = '-1000px';
    document.body.appendChild(g); e.dataTransfer.setDragImage(g, 0, 0); setTimeout(() => g.remove(), 0);
  };

  const handleSegmentClick = (idx: number, seg: PathSegment, e?: MouseEvent) => {
    if (e) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setPickerPosition({ x: r.left, y: r.bottom + 4 }); }
    if (dropdownOpen() === idx) setDropdownOpen(null); else { setDropdownOpen(idx); fetchSiblings(seg.path); }
  };
  const handleSymbolClick = (_si: number, e?: MouseEvent) => {
    if (e) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setPickerPosition({ x: r.left, y: r.bottom + 4 }); }
    if (dropdownOpen() === "symbol") setDropdownOpen(null); else setDropdownOpen("symbol");
  };
  const handleSiblingSelect = async (item: SiblingItem | SymbolInfo) => {
    if ("isDirectory" in item) { if (item.isDirectory) window.dispatchEvent(new CustomEvent("file-explorer:reveal", { detail: { path: item.path } })); else await openFile(item.path, props.groupId); }
    setDropdownOpen(null);
  };
  const handleSymbolSelect = (item: SiblingItem | SymbolInfo) => {
    if ("kind" in item) { outline.navigateToSymbol({ id: item.id, name: item.name, kind: item.kind, detail: item.detail, range: { startLine: item.range.startLine, startColumn: item.range.startColumn, endLine: item.range.endLine, endColumn: item.range.endColumn }, selectionRange: { startLine: item.range.startLine, startColumn: item.range.startColumn, endLine: item.range.endLine, endColumn: item.range.endColumn }, children: [], depth: item.depth, expanded: true }); }
    setDropdownOpen(null);
  };
  const truncateSegments = (segs: PathSegment[]): PathSegment[] => segs.length <= 6 ? segs : [...segs.slice(0, 2), { name: "...", path: "", isFile: false }, ...segs.slice(-3)];

  if (!isEnabled()) return null;

  return (
    <div ref={breadcrumbsRef} class="breadcrumbs-below-tabs breadcrumbs-control"
      style={{ display: "flex", "align-items": "center", height: "22px", "min-height": "22px", "line-height": "22px", padding: "0 8px", background: BREADCRUMB_CSS_VARS.background, "font-size": "12px", overflow: "hidden", cursor: "default", outline: isFocused() ? `1px solid ${BREADCRUMB_CSS_VARS.focusBorder}` : "none", "outline-offset": "-1px" }}
      tabIndex={0} onContextMenu={handleContextMenu} onKeyDown={handleBreadcrumbsKeyDown}
      onFocus={() => setIsFocused(true)} onBlur={() => { if (dropdownOpen() === null) setIsFocused(false); }}>
      <Show when={props.file} fallback={<span style={{ color: BREADCRUMB_CSS_VARS.foregroundMuted, "font-size": "12px" }}>No file open</span>}>
        <div style={{ display: "flex", "align-items": "center", overflow: "hidden" }}>
          <Show when={workspaceName()}>
            <div class="breadcrumb-item breadcrumb-workspace"
              style={{ display: "flex", "align-items": "center", gap: "4px", padding: "0 4px", height: "100%", cursor: "pointer", "border-radius": "var(--cortex-radius-sm)", "white-space": "nowrap", background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = BREADCRUMB_CSS_VARS.hoverBackground)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={() => window.dispatchEvent(new CustomEvent("file-explorer:reveal-root"))}
            >
              <Show when={breadcrumbsSettings().icons}>
                <Icon name="folder-open" style={{ width: "16px", height: "16px", "flex-shrink": "0", color: "var(--cortex-info)" }} />
              </Show>
              <span style={{ "font-size": "12px", color: BREADCRUMB_CSS_VARS.foreground, "font-weight": "500" }}>
                {workspaceName()}
              </span>
            </div>
            <span class="breadcrumb-separator" style={{ color: BREADCRUMB_CSS_VARS.separatorColor, margin: "0 2px", "user-select": "none" }}>/</span>
          </Show>
          <For each={truncateSegments(segments())}>{(segment, index) => (<>
            <Show when={index() > 0}><span class="breadcrumb-separator" style={{ color: BREADCRUMB_CSS_VARS.separatorColor, margin: "0 2px", "user-select": "none" }}>/</span></Show>
            <Show when={segment.name !== "..."} fallback={<span style={{ color: BREADCRUMB_CSS_VARS.foregroundMuted, padding: "0 4px", "font-size": "12px" }}>...</span>}>
              <div class="breadcrumb-item breadcrumb-segment"
                style={{ display: "flex", "align-items": "center", gap: "4px", padding: "0 4px", height: "100%", cursor: "pointer", "border-radius": "var(--cortex-radius-sm)", "white-space": "nowrap", background: (dropdownOpen() === index() || (isFocused() && focusedIndex() === index())) ? BREADCRUMB_CSS_VARS.activeBackground : "transparent" }}
                draggable={true} onDragStart={(e) => handleDragStart(e, segment)} onClick={(e) => handleSegmentClick(index(), segment, e)}
                onMouseEnter={(e) => (e.currentTarget.style.background = BREADCRUMB_CSS_VARS.hoverBackground)}
                onMouseLeave={(e) => { if (dropdownOpen() !== index() && !(isFocused() && focusedIndex() === index())) e.currentTarget.style.background = "transparent"; }}>
                <Show when={breadcrumbsSettings().icons}>
                  <Show when={segment.isFile} fallback={<Icon name="folder" style={{ width: "16px", height: "16px", "flex-shrink": "0", color: "var(--cortex-warning)" }} />}>
                    <img src={getFileIconPath(segment.name)} alt="" style={{ width: "16px", height: "16px", "flex-shrink": "0" }} />
                  </Show>
                </Show>
                <span style={{ "font-size": "12px", "max-width": "120px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", color: segment.isFile ? BREADCRUMB_CSS_VARS.foreground : BREADCRUMB_CSS_VARS.foregroundMuted, "font-weight": segment.isFile && props.file?.modified ? "600" : "normal" }}>{segment.name}</span>
                <Icon name="chevron-down" style={{ width: "12px", height: "12px", color: BREADCRUMB_CSS_VARS.foregroundMuted, transition: "transform 150ms ease", transform: dropdownOpen() === index() ? "rotate(180deg)" : "rotate(0deg)" }} />
              </div>
            </Show>
          </>)}</For>
        </div>
        <Show when={symbolPath().length > 0}>
          <For each={symbolPath()}>{(symbol, index) => {
            const gi = segments().length + index();
            return (<>
              <span class="breadcrumb-separator" style={{ color: BREADCRUMB_CSS_VARS.separatorColor, margin: "0 2px", "user-select": "none" }}><Icon name="chevron-right" style={{ width: "12px", height: "12px" }} /></span>
              <div class="breadcrumb-item breadcrumb-symbol"
                style={{ display: "flex", "align-items": "center", gap: "4px", padding: "0 4px", "padding-right": index() === symbolPath().length - 1 ? "8px" : "4px", height: "100%", cursor: "pointer", "border-radius": "var(--cortex-radius-sm)", "white-space": "nowrap", background: (dropdownOpen() === "symbol" && index() === symbolPath().length - 1) || (isFocused() && focusedIndex() === gi) ? BREADCRUMB_CSS_VARS.activeBackground : "transparent" }}
                onClick={(e) => handleSymbolClick(index(), e)}
                onMouseEnter={(e) => (e.currentTarget.style.background = BREADCRUMB_CSS_VARS.hoverBackground)}
                onMouseLeave={(e) => { if (!(dropdownOpen() === "symbol" && index() === symbolPath().length - 1) && !(isFocused() && focusedIndex() === gi)) e.currentTarget.style.background = "transparent"; }}>
                <Show when={breadcrumbsSettings().icons}>
                  <span style={{ width: "16px", height: "16px", "flex-shrink": "0", display: "flex", "align-items": "center", "justify-content": "center", "font-size": "10px", "font-weight": "600", "border-radius": "var(--cortex-radius-sm)", background: BREADCRUMB_CSS_VARS.background, color: SYMBOL_COLORS[symbol.kind] || BREADCRUMB_CSS_VARS.foregroundMuted }}>{SYMBOL_ICONS[symbol.kind] || "?"}</span>
                </Show>
                <span style={{ "font-size": "12px", "max-width": "150px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", color: SYMBOL_COLORS[symbol.kind] || BREADCRUMB_CSS_VARS.foreground, "font-weight": "500" }}>{symbol.name}</span>
                <Show when={index() === symbolPath().length - 1}>
                  <Icon name="chevron-down" style={{ width: "12px", height: "12px", color: BREADCRUMB_CSS_VARS.foregroundMuted, transition: "transform 150ms ease", transform: dropdownOpen() === "symbol" ? "rotate(180deg)" : "rotate(0deg)" }} />
                </Show>
              </div>
            </>);
          }}</For>
        </Show>
      </Show>
      <Show when={typeof dropdownOpen() === "number" && !loadingSiblings()}>
        <Portal><div ref={dropdownRef} style={{ position: "fixed", "z-index": "1000", left: "0", top: "0", width: "100%", height: "100%" }} onClick={() => setDropdownOpen(null)}><div onClick={(e) => e.stopPropagation()}><BreadcrumbsPicker type="folder" items={siblings()} currentPath={segments()[dropdownOpen() as number]?.path} position={pickerPosition()} onSelect={handleSiblingSelect} onClose={() => setDropdownOpen(null)} /></div></div></Portal>
      </Show>
      <Show when={dropdownOpen() === "symbol"}>
        <Portal><div ref={dropdownRef} style={{ position: "fixed", "z-index": "1000", left: "0", top: "0", width: "100%", height: "100%" }} onClick={() => setDropdownOpen(null)}><div onClick={(e) => e.stopPropagation()}><BreadcrumbsPicker type="symbol" items={allSymbols()} currentSymbolId={symbolPath()[symbolPath().length - 1]?.id} position={pickerPosition()} onSelect={handleSymbolSelect} onClose={() => setDropdownOpen(null)} /></div></div></Portal>
      </Show>
      <BreadcrumbContextMenu contextMenuPos={contextMenuPos()} setContextMenuRef={(el) => { contextMenuRef = el; }} onCopyPath={handleCopyPath} onCopyRelativePath={handleCopyRelativePath} onRevealInExplorer={handleRevealInExplorer} />
    </div>
  );
}

export default Breadcrumbs;
