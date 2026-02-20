import {
  createSignal,
  createEffect,
  createMemo,
  For,
  Show,
  onMount,
  onCleanup,
  batch,
} from "solid-js";
import { tokens } from "@/design-system/tokens";
import { useEditor } from "@/context/EditorContext";
import { useOutline, type DocumentSymbol, type SymbolKind } from "@/context/OutlineContext";
import { Icon } from "./ui/Icon";

/** Segment types for breadcrumbs */
type BreadcrumbSegmentType = "root" | "folder" | "file" | "symbol";

/** Represents a single segment in the breadcrumb trail */
interface BreadcrumbSegment {
  id: string;
  label: string;
  type: BreadcrumbSegmentType;
  path?: string;
  symbol?: DocumentSymbol;
  siblings?: BreadcrumbSegment[];
  depth: number;
}

/** Props for the dropdown picker component */
interface DropdownPickerProps {
  segments: BreadcrumbSegment[];
  selectedId: string;
  onSelect: (segment: BreadcrumbSegment) => void;
  onClose: () => void;
  anchorRect: DOMRect | null;
}

/** Icon mapping for symbol kinds */
const symbolKindIcons: Record<SymbolKind, string> = {
  file: "📄",
  module: "📦",
  namespace: "🏷️",
  package: "📦",
  class: "🔶",
  method: "🔷",
  property: "🔹",
  field: "🔹",
  constructor: "🔨",
  enum: "📊",
  interface: "🔷",
  function: "ƒ",
  variable: "𝑥",
  constant: "π",
  string: "\"",
  number: "#",
  boolean: "◐",
  array: "[]",
  object: "{}",
  key: "🔑",
  null: "∅",
  enumMember: "📊",
  struct: "🔶",
  event: "⚡",
  operator: "±",
  typeParameter: "𝑇",
};

/** Get color for symbol kind */
function getSymbolKindColor(kind: SymbolKind): string {
  const colors: Partial<Record<SymbolKind, string>> = {
    class: "var(--syntax-yellow)",
    struct: "var(--syntax-yellow)",
    interface: "var(--syntax-green)",
    enum: "var(--syntax-yellow)",
    function: "var(--syntax-purple)",
    method: "var(--syntax-purple)",
    constructor: "var(--syntax-purple)",
    property: "var(--syntax-blue)",
    field: "var(--syntax-blue)",
    variable: "var(--syntax-blue)",
    constant: "var(--syntax-cyan)",
    module: "var(--syntax-orange)",
    namespace: "var(--syntax-orange)",
    typeParameter: "var(--syntax-green)",
  };
  return colors[kind] || "var(--text-base)";
}

/** Parse file path into breadcrumb segments */
function parseFilePath(filePath: string): BreadcrumbSegment[] {
  if (!filePath) return [];

  const normalizedPath = filePath.replace(/\\/g, "/");
  const parts = normalizedPath.split("/").filter(Boolean);
  const segments: BreadcrumbSegment[] = [];

  let currentPath = "";
  parts.forEach((part, index) => {
    const isLast = index === parts.length - 1;
    currentPath = currentPath ? `${currentPath}/${part}` : part;

    segments.push({
      id: `path-${index}-${part}`,
      label: part,
      type: isLast ? "file" : index === 0 ? "root" : "folder",
      path: currentPath,
      depth: index,
    });
  });

  return segments;
}

/** Find symbols containing a given cursor position */
function findSymbolsAtCursor(
  symbols: DocumentSymbol[],
  line: number,
  _column: number
): DocumentSymbol[] {
  const result: DocumentSymbol[] = [];

  function traverse(syms: DocumentSymbol[], ancestors: DocumentSymbol[]) {
    for (const sym of syms) {
      const inRange =
        line >= sym.range.startLine && line <= sym.range.endLine;

      if (inRange) {
        result.push(...ancestors, sym);
        if (sym.children.length > 0) {
          traverse(sym.children, [...ancestors, sym]);
        }
        break;
      }
    }
  }

  traverse(symbols, []);
  return result;
}

/** Dropdown picker for selecting sibling items */
function DropdownPicker(props: DropdownPickerProps) {
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [filter, setFilter] = createSignal("");
  let containerRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  const filteredSegments = createMemo(() => {
    const query = filter().toLowerCase();
    if (!query) return props.segments;
    return props.segments.filter((seg) =>
      seg.label.toLowerCase().includes(query)
    );
  });

  createEffect(() => {
    const idx = filteredSegments().findIndex((s) => s.id === props.selectedId);
    if (idx >= 0) setSelectedIndex(idx);
  });

  createEffect(() => {
    filter();
    setSelectedIndex(0);
  });

  onMount(() => {
    inputRef?.focus();
    document.addEventListener("mousedown", handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const segments = filteredSegments();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, segments.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (segments[selectedIndex()]) {
          props.onSelect(segments[selectedIndex()]);
        }
        break;
      case "Escape":
        e.preventDefault();
        props.onClose();
        break;
      case "Tab":
        e.preventDefault();
        props.onClose();
        break;
    }
  };

  createEffect(() => {
    const index = selectedIndex();
    const container = containerRef?.querySelector(".dropdown-list");
    if (container) {
      const items = container.querySelectorAll("[data-dropdown-item]");
      const selectedItem = items[index] as HTMLElement;
      selectedItem?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  const dropdownStyle = createMemo(() => {
    const rect = props.anchorRect;
    if (!rect) return {};

    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const maxHeight = 280;

    const showAbove = spaceBelow < maxHeight && spaceAbove > spaceBelow;

    return {
      position: "fixed" as const,
      left: `${rect.left}px`,
      top: showAbove ? undefined : `${rect.bottom + 2}px`,
      bottom: showAbove ? `${viewportHeight - rect.top + 2}px` : undefined,
      "min-width": "200px",
      "max-width": "320px",
      "max-height": `${Math.min(maxHeight, showAbove ? spaceAbove - 10 : spaceBelow - 10)}px`,
      "z-index": "200",
    };
  });

  return (
    <div
      ref={containerRef}
      class="rounded-md shadow-lg overflow-hidden"
      style={{
        ...dropdownStyle(),
        background: tokens.colors.surface.panel,
        border: `1px solid ${tokens.colors.border.default}`,
        "box-shadow": "0 4px 16px rgba(0, 0, 0, 0.3)",
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        class="p-1.5 border-b"
        style={{ "border-color": tokens.colors.border.default }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Filter..."
          class="w-full px-2 py-1 text-xs rounded outline-none"
          style={{
            background: tokens.colors.surface.canvas,
            color: tokens.colors.text.primary,
            border: `1px solid ${tokens.colors.border.default}`,
          }}
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
        />
      </div>

      <div
        class="dropdown-list overflow-y-auto"
        style={{ "max-height": "220px" }}
      >
        <Show
          when={filteredSegments().length > 0}
          fallback={
            <div
              class="px-3 py-4 text-center text-xs"
              style={{ color: tokens.colors.text.muted }}
            >
              No matches
            </div>
          }
        >
          <For each={filteredSegments()}>
            {(segment, index) => (
              <button
                data-dropdown-item
                class="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left transition-colors"
                style={{
                  background:
                    index() === selectedIndex()
                      ? tokens.colors.interactive.selected
                      : "transparent",
                  color:
                    segment.id === props.selectedId
                      ? tokens.colors.semantic.primary
                      : tokens.colors.text.primary,
                }}
                onMouseEnter={() => setSelectedIndex(index())}
                onClick={() => props.onSelect(segment)}
              >
<Show when={segment.type === "folder"}>
                  <Icon
                    name="folder"
                    size={14}
                    class="shrink-0"
                    style={{ color: "var(--syntax-yellow)" }}
                  />
                </Show>
                <Show when={segment.type === "file"}>
                  <Icon
                    name="file"
                    size={14}
                    class="shrink-0"
                    style={{ color: tokens.colors.text.muted }}
                  />
                </Show>
                <Show when={segment.type === "symbol" && segment.symbol}>
                  <span
                    class="w-3.5 h-3.5 flex items-center justify-center text-[10px] shrink-0"
                    style={{ color: getSymbolKindColor(segment.symbol!.kind) }}
                  >
                    {symbolKindIcons[segment.symbol!.kind]}
                  </span>
                </Show>
                <span class="truncate">{segment.label}</span>
                <Show when={segment.id === props.selectedId}>
                  <span
                    class="ml-auto text-[10px]"
                    style={{ color: tokens.colors.text.muted }}
                  >
                    current
                  </span>
                </Show>
              </button>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}

/** Individual breadcrumb segment button */
interface SegmentButtonProps {
  segment: BreadcrumbSegment;
  isActive: boolean;
  isLast: boolean;
  onClick: (e: MouseEvent) => void;
  onFocus: () => void;
  focused: boolean;
}

function SegmentButton(props: SegmentButtonProps) {
  let buttonRef: HTMLButtonElement | undefined;

  createEffect(() => {
    if (props.focused && buttonRef) {
      buttonRef.focus();
    }
  });

const getIcon = () => {
    const { segment } = props;
    if (segment.type === "root" || segment.type === "folder") {
      return (
        <Icon
          name="folder"
          size={14}
          class="shrink-0"
          style={{ color: "var(--syntax-yellow)" }}
        />
      );
    }
    if (segment.type === "file") {
      return (
        <Icon
          name="file"
          size={14}
          class="shrink-0"
          style={{ color: "var(--text-weak)" }}
        />
      );
    }
    if (segment.type === "symbol" && segment.symbol) {
      return (
        <span
          class="w-3.5 flex items-center justify-center text-xs shrink-0"
          style={{ color: getSymbolKindColor(segment.symbol.kind) }}
        >
          {symbolKindIcons[segment.symbol.kind]}
        </span>
      );
    }
    return <Icon name="code" size={14} class="shrink-0" />;
  };

  return (
    <button
      ref={buttonRef}
      class="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors outline-none"
      style={{
        background: props.isActive
          ? tokens.colors.interactive.selected
          : props.focused
            ? tokens.colors.interactive.hover
            : "transparent",
        color: props.isLast ? tokens.colors.text.primary : tokens.colors.text.muted,
        "border": props.focused ? `1px solid ${tokens.colors.semantic.primary}` : "1px solid transparent",
      }}
      onClick={props.onClick}
      onFocus={props.onFocus}
      tabIndex={0}
    >
      {getIcon()}
      <span class="truncate max-w-[120px] text-xs">{props.segment.label}</span>
<Icon
        name="chevron-down"
        size={12}
        class="shrink-0 opacity-50"
        style={{ color: tokens.colors.text.muted }}
      />
    </button>
  );
}

/** Props for the Breadcrumbs component */
export interface BreadcrumbsProps {
  class?: string;
}

/** Main Breadcrumbs navigation component */
export function Breadcrumbs(props: BreadcrumbsProps) {
  const editor = useEditor();
  const outline = useOutline();
  const { openFile } = editor;

  const [focusedIndex, setFocusedIndex] = createSignal(-1);
  const [activeDropdownId, setActiveDropdownId] = createSignal<string | null>(null);
  const [dropdownAnchor, setDropdownAnchor] = createSignal<DOMRect | null>(null);
  const [cursorLine, setCursorLine] = createSignal(1);
  const [cursorColumn, setCursorColumn] = createSignal(1);

  let containerRef: HTMLDivElement | undefined;

  const activeFile = createMemo(() =>
    editor.state.openFiles.find((f) => f.id === editor.state.activeFileId)
  );

  const pathSegments = createMemo<BreadcrumbSegment[]>(() => {
    const file = activeFile();
    if (!file) return [];
    return parseFilePath(file.path);
  });

  const symbolChain = createMemo<DocumentSymbol[]>(() => {
    const symbols = outline.state.symbols;
    if (symbols.length === 0) return [];
    return findSymbolsAtCursor(symbols, cursorLine(), cursorColumn());
  });

  const symbolSegments = createMemo<BreadcrumbSegment[]>(() => {
    const chain = symbolChain();
    return chain.map((sym, index) => ({
      id: `symbol-${sym.id}`,
      label: sym.name,
      type: "symbol" as const,
      symbol: sym,
      depth: index,
    }));
  });

  const allSegments = createMemo<BreadcrumbSegment[]>(() => {
    return [...pathSegments(), ...symbolSegments()];
  });

  const getSiblings = (segment: BreadcrumbSegment): BreadcrumbSegment[] => {
    if (segment.type === "symbol" && segment.symbol) {
      const chain = symbolChain();
      const parentIndex = chain.indexOf(segment.symbol) - 1;
      
      let siblings: DocumentSymbol[];
      if (parentIndex < 0) {
        siblings = outline.state.symbols;
      } else {
        siblings = chain[parentIndex].children;
      }

      return siblings.map((sym) => ({
        id: `symbol-${sym.id}`,
        label: sym.name,
        type: "symbol" as const,
        symbol: sym,
        depth: segment.depth,
      }));
    }

    if (segment.type === "folder" || segment.type === "file") {
      return [{
        ...segment,
        siblings: [],
      }];
    }

    return [segment];
  };

  onMount(() => {
    const handleCursorChange = (e: CustomEvent) => {
      batch(() => {
        setCursorLine(e.detail.line || 1);
        setCursorColumn(e.detail.column || 1);
      });
    };

    window.addEventListener("editor-cursor-change", handleCursorChange as EventListener);
    onCleanup(() => {
      window.removeEventListener("editor-cursor-change", handleCursorChange as EventListener);
    });
  });

  const handleSegmentClick = (segment: BreadcrumbSegment, e: MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    if (activeDropdownId() === segment.id) {
      setActiveDropdownId(null);
      setDropdownAnchor(null);
    } else {
      setActiveDropdownId(segment.id);
      setDropdownAnchor(rect);
    }
  };

  const handleDropdownSelect = (segment: BreadcrumbSegment) => {
    setActiveDropdownId(null);
    setDropdownAnchor(null);

    if (segment.type === "symbol" && segment.symbol) {
      outline.navigateToSymbol(segment.symbol);
    } else if (segment.path) {
      if (segment.type === "file") {
        const file = activeFile();
        if (file && file.path === segment.path) {
          return;
        }
        openFile(segment.path);
      } else if (segment.type === "folder" || segment.type === "root") {
        window.dispatchEvent(
          new CustomEvent("file-explorer:reveal", {
            detail: { path: segment.path },
          })
        );
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const segments = allSegments();
    const currentIndex = focusedIndex();

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        if (currentIndex > 0) {
          setFocusedIndex(currentIndex - 1);
        }
        break;

      case "ArrowRight":
        e.preventDefault();
        if (currentIndex < segments.length - 1) {
          setFocusedIndex(currentIndex + 1);
        }
        break;

      case "ArrowDown":
      case "Enter":
      case " ":
        e.preventDefault();
        if (currentIndex >= 0 && currentIndex < segments.length) {
          const segment = segments[currentIndex];
          const buttons = containerRef?.querySelectorAll("[data-breadcrumb-segment]");
          const button = buttons?.[currentIndex] as HTMLElement;
          if (button) {
            const rect = button.getBoundingClientRect();
            setActiveDropdownId(segment.id);
            setDropdownAnchor(rect);
          }
        }
        break;

      case "Escape":
        e.preventDefault();
        setActiveDropdownId(null);
        setDropdownAnchor(null);
        setFocusedIndex(-1);
        break;

      case "Home":
        e.preventDefault();
        if (segments.length > 0) {
          setFocusedIndex(0);
        }
        break;

      case "End":
        e.preventDefault();
        if (segments.length > 0) {
          setFocusedIndex(segments.length - 1);
        }
        break;
    }
  };

  const handleContainerFocus = () => {
    if (focusedIndex() < 0 && allSegments().length > 0) {
      setFocusedIndex(allSegments().length - 1);
    }
  };

  const handleSegmentFocus = (index: number) => {
    setFocusedIndex(index);
  };

  return (
    <Show when={activeFile()}>
      <div
        ref={containerRef}
        class={`flex items-center gap-0.5 px-2 select-none overflow-x-auto ${props.class || ""}`}
        style={{
          position: "relative",  // Ensure proper stacking within parent - NOT fixed or absolute
          height: "26px",
          "min-height": "26px",
          "flex-shrink": "0",  // Prevent breadcrumbs from shrinking
          background: `${tokens.colors.surface.canvas}`,  // Solid fallback
          "background-color": `${tokens.colors.surface.canvas}`,  // Force solid
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
          "z-index": "1",  // Lower than header but above editor content
        }}
        onKeyDown={handleKeyDown}
        onFocus={handleContainerFocus}
        role="navigation"
        aria-label="Breadcrumbs"
      >
        <For each={allSegments()}>
          {(segment, index) => (
            <>
<Show when={index() > 0}>
                <Icon
                  name="chevron-right"
                  size={12}
                  class="shrink-0"
                  style={{ color: tokens.colors.text.muted }}
                />
              </Show>
              <div data-breadcrumb-segment>
                <SegmentButton
                  segment={segment}
                  isActive={activeDropdownId() === segment.id}
                  isLast={index() === allSegments().length - 1}
                  onClick={(e) => handleSegmentClick(segment, e)}
                  onFocus={() => handleSegmentFocus(index())}
                  focused={focusedIndex() === index()}
                />
              </div>
            </>
          )}
        </For>

        <Show when={activeDropdownId()}>
          {(dropdownId) => {
            const segment = allSegments().find((s) => s.id === dropdownId());
            const siblings = segment ? getSiblings(segment) : [];
            return (
              <DropdownPicker
                segments={siblings}
                selectedId={dropdownId()}
                onSelect={handleDropdownSelect}
                onClose={() => {
                  setActiveDropdownId(null);
                  setDropdownAnchor(null);
                }}
                anchorRect={dropdownAnchor()}
              />
            );
          }}
        </Show>
      </div>

      <style>{`
        .breadcrumbs-container::-webkit-scrollbar {
          height: 4px;
        }
        .breadcrumbs-container::-webkit-scrollbar-track {
          background: transparent;
        }
        .breadcrumbs-container::-webkit-scrollbar-thumb {
          background: var(--border-weak);
          border-radius: var(--cortex-radius-sm);
        }
      `}</style>
    </Show>
  );
}

export default Breadcrumbs;

