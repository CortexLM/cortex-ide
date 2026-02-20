import { createSignal, For, Show, createEffect, onCleanup, onMount, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import {
  useOutline,
  type DocumentSymbol,
  type SymbolKind,
  type SymbolTypeFilter,
  allSymbolTypeFilters,
  symbolTypeFilterConfig,
} from "@/context/OutlineContext";
import { useEditor } from "@/context/EditorContext";
import { IconButton, Input, Badge, Text, EmptyState, ListItem } from "@/components/ui";
import { tokens } from "@/design-system/tokens";

// Sort order type for outline symbols
type SortOrder = "position" | "name" | "kind";

// LSP SymbolTag values
const SymbolTag = {
  Deprecated: 1,
} as const;

// Check if a symbol is deprecated
const isSymbolDeprecated = (symbol: DocumentSymbol): boolean => 
  symbol.tags?.includes(SymbolTag.Deprecated) ?? false;

// Symbol icons by kind with JetBrains-themed colors
const symbolIcons: Record<SymbolKind, { iconName: string; color: string }> = {
  file: { iconName: "code", color: tokens.colors.icon.default },
  module: { iconName: "m", color: "var(--cortex-syntax-orange)" },
  namespace: { iconName: "n", color: "var(--cortex-syntax-purple)" },
  package: { iconName: "p", color: "var(--cortex-syntax-orange)" },
  class: { iconName: "c", color: "var(--cortex-syntax-orange)" },
  method: { iconName: "function", color: "var(--cortex-syntax-purple)" },
  property: { iconName: "box", color: "var(--cortex-syntax-cyan)" },
  field: { iconName: "f", color: "var(--cortex-syntax-cyan)" },
  constructor: { iconName: "lambda", color: "var(--cortex-syntax-purple)" },
  enum: { iconName: "e", color: "var(--cortex-syntax-orange)" },
  interface: { iconName: "i", color: "var(--cortex-syntax-green)" },
  function: { iconName: "function", color: "var(--cortex-syntax-blue)" },
  variable: { iconName: "v", color: "var(--cortex-syntax-blue)" },
  constant: { iconName: "k", color: "var(--cortex-syntax-blue)" },
  string: { iconName: "s", color: "var(--cortex-syntax-green)" },
  number: { iconName: "hashtag", color: "var(--cortex-syntax-green)" },
  boolean: { iconName: "toggle-on", color: "var(--cortex-syntax-green)" },
  array: { iconName: "brackets-square", color: "var(--cortex-syntax-orange)" },
  object: { iconName: "brackets-curly", color: "var(--cortex-syntax-orange)" },
  key: { iconName: "k", color: "var(--cortex-syntax-cyan)" },
  null: { iconName: "circle-dot", color: tokens.colors.icon.default },
  enumMember: { iconName: "hashtag", color: "var(--cortex-syntax-cyan)" },
  struct: { iconName: "s", color: "var(--cortex-syntax-orange)" },
  event: { iconName: "circle-dot", color: "var(--cortex-syntax-purple)" },
  operator: { iconName: "o", color: tokens.colors.icon.default },
  typeParameter: { iconName: "t", color: "var(--cortex-syntax-green)" },
};

// Kind priority order for grouping by type (classes, interfaces, functions, variables, etc.)
const symbolKindOrder: Record<SymbolKind, number> = {
  class: 1,
  interface: 2,
  struct: 3,
  enum: 4,
  function: 5,
  method: 6,
  constructor: 7,
  property: 8,
  field: 9,
  variable: 10,
  constant: 11,
  enumMember: 12,
  module: 13,
  namespace: 14,
  package: 15,
  typeParameter: 16,
  file: 17,
  object: 18,
  array: 19,
  string: 20,
  number: 21,
  boolean: 22,
  key: 23,
  null: 24,
  event: 25,
  operator: 26,
};

// Sort symbols by position, name, or kind
function sortSymbols(symbols: DocumentSymbol[], order: SortOrder): DocumentSymbol[] {
  const sorted = [...symbols];
  switch (order) {
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "kind":
      sorted.sort((a, b) => {
        const kindA = symbolKindOrder[a.kind] ?? 99;
        const kindB = symbolKindOrder[b.kind] ?? 99;
        return kindA - kindB || a.name.localeCompare(b.name);
      });
      break;
    case "position":
    default:
      sorted.sort((a, b) => a.range.startLine - b.range.startLine);
  }
  // Recursively sort children
  return sorted.map(s => ({
    ...s,
    children: s.children ? sortSymbols(s.children, order) : []
  }));
}

// Virtualization constants
const ITEM_HEIGHT = 24;
const OVERSCAN = 10;

// Storage key for persisting follow cursor setting
const FOLLOW_CURSOR_STORAGE_KEY = "orion:outline:followCursor";

// Load persisted follow cursor setting
function loadFollowCursorSetting(): boolean {
  try {
    const stored = localStorage.getItem(FOLLOW_CURSOR_STORAGE_KEY);
    if (stored !== null) {
      return stored === "true";
    }
  } catch {
    // Ignore storage errors
  }
  return true; // Default: enabled
}

// Save follow cursor setting to localStorage
function persistFollowCursorSetting(enabled: boolean): void {
  try {
    localStorage.setItem(FOLLOW_CURSOR_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage errors
  }
}

// Find the most specific symbol containing the cursor position
// Returns the symbol and the chain of parent IDs to expand
function findSymbolAtPosition(
  symbols: DocumentSymbol[],
  line: number
): { symbol: DocumentSymbol | null; parentIds: string[] } {
  let result: DocumentSymbol | null = null;
  const parentIds: string[] = [];

  function search(syms: DocumentSymbol[], ancestors: string[]): boolean {
    for (const sym of syms) {
      // Line is 1-based from editor, symbol range is 0-based
      const cursorLine = line - 1;
      if (cursorLine >= sym.range.startLine && cursorLine <= sym.range.endLine) {
        // This symbol contains the cursor
        // Check children first for a more specific match
        if (sym.children && sym.children.length > 0) {
          const foundInChildren = search(sym.children, [...ancestors, sym.id]);
          if (foundInChildren) {
            return true;
          }
        }
        // No more specific child found, this is the best match
        result = sym;
        parentIds.push(...ancestors);
        return true;
      }
    }
    return false;
  }

  search(symbols, []);
  return { symbol: result, parentIds };
}

// Flattened symbol for virtualization
interface FlattenedSymbol {
  symbol: DocumentSymbol;
  depth: number;
  index: number;
}

// Virtualized symbol item (flat, no recursion)
interface VirtualizedSymbolItemProps {
  item: FlattenedSymbol;
  onSelect: (symbol: DocumentSymbol) => void;
  onToggle: (symbolId: string) => void;
  activeSymbolId: string | null;
  expandedIds: Set<string>;
  style?: Record<string, string>;
}

function VirtualizedSymbolItem(props: VirtualizedSymbolItemProps) {
  const symbol = () => props.item.symbol;
  const depth = () => props.item.depth;
  const isExpanded = () => props.expandedIds.has(symbol().id);
  const isActive = () => props.activeSymbolId === symbol().id;
  const hasChildren = () => symbol().children.length > 0;

  const iconConfig = () => symbolIcons[symbol().kind] || symbolIcons.variable;

  const handleClick = () => {
    props.onSelect(symbol());
  };

  const handleToggle = (e: MouseEvent) => {
    e.stopPropagation();
    props.onToggle(symbol().id);
  };

  const iconElement = () => (
    <span style={{ display: "flex", "align-items": "center", gap: "2px" }}>
      <Show when={hasChildren()}>
        <span
          onClick={handleToggle}
          style={{
            cursor: "pointer",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            width: "12px",
            height: "12px",
            transition: "transform var(--cortex-transition-fast)",
            transform: isExpanded() ? "rotate(90deg)" : "rotate(0deg)",
            color: tokens.colors.icon.default,
          }}
        >
          <Icon name="chevron-right" size={12} />
        </span>
      </Show>
      <Show when={!hasChildren()}>
        <span style={{ width: "12px", height: "12px" }} />
      </Show>
      <span
        style={{
          width: "var(--jb-icon-size)",
          height: "var(--jb-icon-size)",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          color: iconConfig().color,
        }}
      >
        <Icon name={iconConfig().iconName} size={16} />
      </span>
    </span>
  );

  const rightElement = () => (
    <span style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
      <Show when={symbol().detail}>
        <Text
          variant="muted"
          size="xs"
          truncate
          style={{ "max-width": "80px" }}

        >
          {symbol().detail}
        </Text>
      </Show>
      <Text variant="muted" size="xs">
        :{symbol().range.startLine + 1}
      </Text>
    </span>
  );

  return (
    <div
      style={{
        position: "absolute",
        top: "0",
        left: "0",
        right: "0",
        height: `${ITEM_HEIGHT}px`,
        ...props.style,
      }}
    >
      <ListItem
        icon={iconElement()}
        iconRight={rightElement()}
        label={symbol().name}
        selected={isActive()}
        onClick={handleClick}
        style={{
          height: `${ITEM_HEIGHT}px`,
          "padding-left": `${depth() * 12 + 4}px`,
          opacity: isSymbolDeprecated(symbol()) ? 0.6 : 1,
          "text-decoration": isSymbolDeprecated(symbol()) ? "line-through" : "none",
        }}
      />
    </div>
  );
}

// Symbol type filter icons mapping
const symbolTypeIconNames: Record<SymbolTypeFilter, string> = {
  class: "c",
  function: "function",
  variable: "v",
  interface: "i",
  enum: "e",
  property: "box",
  module: "m",
  type: "t",
  other: "circle-dot",
};

interface SymbolTypeFilterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

function SymbolTypeFilterDropdown(props: SymbolTypeFilterDropdownProps) {
  const outline = useOutline();
  let dropdownRef: HTMLDivElement | undefined;

  // Close dropdown when clicking outside
  createEffect(() => {
    if (!props.isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
        props.onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => {
      document.removeEventListener("mousedown", handleClickOutside);
    });
  });

  const allEnabled = () =>
    outline.state.symbolTypeFilter.size === allSymbolTypeFilters.length;
  const noneEnabled = () => outline.state.symbolTypeFilter.size === 0;

  const handleSelectAll = () => {
    outline.setAllSymbolTypes(true);
  };

  const handleSelectNone = () => {
    outline.setAllSymbolTypes(false);
  };

  return (
    <Show when={props.isOpen}>
      <div
        ref={dropdownRef}
        style={{
          position: "absolute",
          top: "100%",
          left: "0",
          "margin-top": tokens.spacing.sm,
          "z-index": "50",
          "border-radius": tokens.radius.md,
          "box-shadow": "var(--jb-shadow-popup)",
          border: `1px solid ${tokens.colors.border.divider}`,
          padding: `${tokens.spacing.sm} 0`,
          "min-width": "200px",
          background: tokens.colors.surface.popup,
        }}
      >
        {/* Select All / None buttons */}
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
            "border-bottom": `1px solid ${tokens.colors.border.divider}`,
            "margin-bottom": tokens.spacing.sm,
          }}
        >
          <button
            onClick={handleSelectAll}
            disabled={allEnabled()}
            style={{
              "font-size": "var(--jb-text-muted-size)",
              padding: `2px ${tokens.spacing.md}`,
              "border-radius": tokens.radius.sm,
              border: "none",
              background: "transparent",
              cursor: allEnabled() ? "not-allowed" : "pointer",
              color: allEnabled() ? tokens.colors.text.placeholder : tokens.colors.semantic.info,
            }}
          >
            All
          </button>
          <button
            onClick={handleSelectNone}
            disabled={noneEnabled()}
            style={{
              "font-size": "var(--jb-text-muted-size)",
              padding: `2px ${tokens.spacing.md}`,
              "border-radius": tokens.radius.sm,
              border: "none",
              background: "transparent",
              cursor: noneEnabled() ? "not-allowed" : "pointer",
              color: noneEnabled() ? tokens.colors.text.placeholder : tokens.colors.semantic.info,
            }}
          >
            None
          </button>
        </div>

        {/* Symbol type checkboxes */}
        <For each={allSymbolTypeFilters}>
          {(type) => {
            const config = symbolTypeFilterConfig[type];
            const isEnabled = () => outline.isSymbolTypeEnabled(type);
            const count = () => outline.state.symbolTypeCounts[type] || 0;

            return (
              <ListItem
                onClick={() => outline.toggleSymbolType(type)}
                icon={
                  <span
                    style={{
                      width: "16px",
                      height: "16px",
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "center",
                      "border-radius": tokens.radius.sm,
                      border: `1px solid ${isEnabled() ? config.color : tokens.colors.border.default}`,
                      background: isEnabled() ? config.color : "transparent",
                    }}
                  >
                    <Show when={isEnabled()}>
                      <Icon name="check" size={10} style={{ color: "white" }} />
                    </Show>
                  </span>
                }
                iconRight={
                  <Badge variant={count() > 0 ? "default" : "default"}>
                    {count()}
                  </Badge>
                }
                style={{ margin: "0" }}
              >
                <span style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md, flex: "1" }}>
                  <span
                    style={{
                      width: "var(--jb-icon-size)",
                      height: "var(--jb-icon-size)",
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "center",
                      color: config.color,
                    }}
                  >
                    <Icon name={symbolTypeIconNames[type]} size={14} />
                  </span>
                  <Text variant="body" size="sm">{config.label}</Text>
                </span>
              </ListItem>
            );
          }}
        </For>
      </div>
    </Show>
  );
}

// Quick filter buttons for common symbol types
function QuickFilterButtons() {
  const outline = useOutline();

  const quickFilters: SymbolTypeFilter[] = ["class", "function", "variable", "interface"];

  const isOnlyFilterEnabled = (type: SymbolTypeFilter) => {
    return outline.state.symbolTypeFilter.size === 1 && outline.isSymbolTypeEnabled(type);
  };

  const handleQuickFilter = (type: SymbolTypeFilter) => {
    if (isOnlyFilterEnabled(type)) {
      // If this is the only enabled filter, show all
      outline.setAllSymbolTypes(true);
    } else {
      // Otherwise, show only this type
      outline.setAllSymbolTypes(false);
      outline.toggleSymbolType(type);
    }
  };

  return (
    <div style={{ display: "flex", "align-items": "center", gap: "2px" }}>
      <For each={quickFilters}>
        {(type) => {
          const config = symbolTypeFilterConfig[type];
          const count = () => outline.state.symbolTypeCounts[type] || 0;
          const isActive = () => isOnlyFilterEnabled(type);
          const iconName = symbolTypeIconNames[type];

          return (
            <Show when={count() > 0}>
              <button
                onClick={() => handleQuickFilter(type)}
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "2px",
                  padding: `2px ${tokens.spacing.sm}`,
                  "border-radius": tokens.radius.sm,
                  "font-size": "var(--jb-text-muted-size)",
                  border: "none",
                  cursor: "pointer",
                  transition: "background var(--cortex-transition-fast)",
                  background: isActive() ? tokens.colors.interactive.selected : "transparent",
                  color: isActive() ? config.color : tokens.colors.text.muted,
                }}
                title={`Show only ${config.label.toLowerCase()} (${count()})`}
              >
                <Icon name={iconName} size={12} />
                <span style={{ "font-size": "10px" }}>{count()}</span>
              </button>
            </Show>
          );
        }}
      </For>
    </div>
  );
}

// Sort order dropdown component
interface SortOrderDropdownProps {
  sortOrder: SortOrder;
  onSelect: (order: SortOrder) => void;
  onClose: () => void;
}

function SortOrderDropdown(props: SortOrderDropdownProps) {
  let dropdownRef: HTMLDivElement | undefined;

  // Close dropdown when clicking outside
  createEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
        props.onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => {
      document.removeEventListener("mousedown", handleClickOutside);
    });
  });

  const sortOptions: { value: SortOrder; label: string }[] = [
    { value: "position", label: "Sort by Position" },
    { value: "name", label: "Sort by Name" },
    { value: "kind", label: "Sort by Kind" },
  ];

  return (
    <div
      ref={dropdownRef}
      style={{
        position: "absolute",
        top: "100%",
        right: "0",
        "margin-top": tokens.spacing.sm,
        "z-index": "50",
        "border-radius": tokens.radius.md,
        "box-shadow": "var(--jb-shadow-popup)",
        border: `1px solid ${tokens.colors.border.divider}`,
        padding: `${tokens.spacing.sm} 0`,
        "min-width": "140px",
        background: tokens.colors.surface.popup,
      }}
    >
      <For each={sortOptions}>
        {(option) => (
          <ListItem
            onClick={() => props.onSelect(option.value)}
            icon={
              <span
                style={{
                  width: "var(--jb-icon-size)",
                  height: "var(--jb-icon-size)",
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  color: props.sortOrder === option.value ? tokens.colors.semantic.info : "transparent",
                }}
              >
                <Icon name="check" size={12} />
              </span>
            }
            label={option.label}
            style={{ margin: "0" }}
          />
        )}
      </For>
    </div>
  );
}

interface OutlinePanelProps {
  onClose?: () => void;
}

export function OutlinePanel(props: OutlinePanelProps) {
  const outline = useOutline();
  const editor = useEditor();
  const [searchQuery, setSearchQuery] = createSignal("");
  const [filterDropdownOpen, setFilterDropdownOpen] = createSignal(false);
  const [sortOrder, setSortOrder] = createSignal<SortOrder>("position");
  const [sortDropdownOpen, setSortDropdownOpen] = createSignal(false);
  const [followCursor, setFollowCursor] = createSignal(loadFollowCursorSetting());
  
  // Virtualization state
  const [scrollTop, setScrollTop] = createSignal(0);
  const [containerHeight, setContainerHeight] = createSignal(300);
  
  let searchInputRef: HTMLInputElement | undefined;
  let contentRef: HTMLDivElement | undefined;

  // Toggle follow cursor and persist setting
  const toggleFollowCursor = () => {
    const newValue = !followCursor();
    setFollowCursor(newValue);
    persistFollowCursorSetting(newValue);
  };

  // Sync search query with context filter
  createEffect(() => {
    outline.setFilter(searchQuery());
  });

  // Listen to editor cursor changes for follow cursor feature
  onMount(() => {
    const handleCursorChange = (e: CustomEvent<{ line: number; column: number }>) => {
      if (!followCursor() || !e.detail) return;
      
      const { line } = e.detail;
      const symbols = outline.state.symbols;
      
      if (symbols.length === 0) return;
      
      // Find the symbol at the cursor position
      const { symbol, parentIds } = findSymbolAtPosition(symbols, line);
      
      if (symbol) {
        // Expand parent symbols to make the active symbol visible
        if (parentIds.length > 0) {
          parentIds.forEach(id => {
            if (!outline.state.expandedIds.has(id)) {
              outline.toggleExpanded(id);
            }
          });
        }
        
        // Set the active symbol
        outline.setActiveSymbol(symbol.id);
        
        // Scroll to the active symbol in the outline tree
        // Use a small delay to allow for DOM updates after expansion
        setTimeout(() => {
          if (contentRef) {
            const activeElement = contentRef.querySelector('.selected');
            if (activeElement) {
              activeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }
        }, 50);
      }
    };

    window.addEventListener("editor-cursor-change", handleCursorChange as EventListener);
    
    onCleanup(() => {
      window.removeEventListener("editor-cursor-change", handleCursorChange as EventListener);
    });
  });

  // Handle keyboard shortcut to focus search
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (searchQuery()) {
        setSearchQuery("");
        outline.setFilter("");
      } else {
        props.onClose?.();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      searchInputRef?.focus();
    }
  };

  createEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      document.removeEventListener("keydown", handleKeyDown);
    });
  });

  const handleSymbolSelect = (symbol: DocumentSymbol) => {
    outline.navigateToSymbol(symbol);
  };

  const handleRefresh = () => {
    const activeFile = editor.state.openFiles.find(
      (f) => f.id === editor.state.activeFileId
    );
    if (activeFile) {
      outline.fetchSymbols(activeFile.id, activeFile.content, activeFile.language);
    }
  };

const filteredSymbols = () => sortSymbols(outline.getFilteredSymbols(), sortOrder());
  const hasSymbols = () => filteredSymbols().length > 0;
  const activeFileName = () => {
    const activeFile = editor.state.openFiles.find(
      (f) => f.id === editor.state.activeFileId
    );
    return activeFile?.name || "No file";
  };

  // Flatten tree for virtualization (respecting expanded state)
  const flattenedSymbols = createMemo((): FlattenedSymbol[] => {
    const result: FlattenedSymbol[] = [];
    let index = 0;

    function flatten(symbols: DocumentSymbol[], depth: number) {
      for (const symbol of symbols) {
        result.push({ symbol, depth, index: index++ });
        // Only include children if parent is expanded
        if (symbol.children.length > 0 && outline.state.expandedIds.has(symbol.id)) {
          flatten(symbol.children, depth + 1);
        }
      }
    }

    flatten(filteredSymbols(), 0);
    return result;
  });

  // Calculate visible range based on scroll position
  const visibleRange = createMemo(() => {
    const items = flattenedSymbols();
    const start = Math.max(0, Math.floor(scrollTop() / ITEM_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(containerHeight() / ITEM_HEIGHT) + 2 * OVERSCAN;
    const end = Math.min(items.length, start + visibleCount);
    return { start, end };
  });

  // Get only visible symbols for rendering
  const visibleSymbols = createMemo(() => {
    const items = flattenedSymbols();
    const { start, end } = visibleRange();
    return items.slice(start, end);
  });

  // Total height for the scroll container
  const totalHeight = createMemo(() => flattenedSymbols().length * ITEM_HEIGHT);

  // Handle scroll events for virtualization
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  };

  // Update container height on mount and resize
  onMount(() => {
    if (contentRef) {
      setContainerHeight(contentRef.clientHeight);
      
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerHeight(entry.contentRect.height);
        }
      });
      
      resizeObserver.observe(contentRef);
      
      onCleanup(() => {
        resizeObserver.disconnect();
      });
    }
  });

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        background: tokens.colors.surface.panel,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: `6px ${tokens.spacing.md}`,
          "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          "flex-shrink": "0",
        }}
      >
        <Text variant="header">Outline</Text>
        <div style={{ display: "flex", "align-items": "center", gap: "2px" }}>
          {/* Filter dropdown button */}
          <div style={{ position: "relative" }}>
            <IconButton
              size="sm"
              onClick={() => setFilterDropdownOpen(!filterDropdownOpen())}
              active={outline.state.symbolTypeFilter.size < allSymbolTypeFilters.length}
              tooltip="Filter by symbol type"
            >
              <Icon name="filter" size={14} />
            </IconButton>
            <SymbolTypeFilterDropdown
              isOpen={filterDropdownOpen()}
              onClose={() => setFilterDropdownOpen(false)}
            />
          </div>
          {/* Sort dropdown button */}
          <div style={{ position: "relative" }}>
            <IconButton
              size="sm"
              onClick={() => setSortDropdownOpen(!sortDropdownOpen())}
              active={sortOrder() !== "position"}
              tooltip={`Sort by ${sortOrder()}`}
            >
              <Icon name="list" size={14} />
            </IconButton>
            <Show when={sortDropdownOpen()}>
              <SortOrderDropdown
                sortOrder={sortOrder()}
                onSelect={(order) => {
                  setSortOrder(order);
                  setSortDropdownOpen(false);
                }}
                onClose={() => setSortDropdownOpen(false)}
              />
            </Show>
          </div>
          {/* Follow cursor toggle button */}
          <IconButton
            size="sm"
            onClick={toggleFollowCursor}
            active={followCursor()}
            tooltip={followCursor() ? "Follow Cursor (on)" : "Follow Cursor (off)"}
          >
            <Icon name="crosshairs" size={14} />
          </IconButton>
          <IconButton
            size="sm"
            onClick={() => outline.expandAll()}
            tooltip="Expand All"
          >
            <Icon name="maximize" size={14} />
          </IconButton>
          <IconButton
            size="sm"
            onClick={() => outline.collapseAll()}
            tooltip="Collapse All"
          >
            <Icon name="minimize" size={14} />
          </IconButton>
          <IconButton
            size="sm"
            onClick={handleRefresh}
            tooltip="Refresh"
          >
            <Icon name="rotate" size={14} style={{ animation: outline.state.loading ? "spin 1s linear infinite" : "none" }} />
          </IconButton>
          <Show when={props.onClose}>
            <IconButton
              size="sm"
              onClick={props.onClose}
              tooltip="Close"
            >
              <Icon name="xmark" size={14} />
            </IconButton>
          </Show>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ padding: tokens.spacing.md, "flex-shrink": "0" }}>
        <Input
          ref={searchInputRef}
          type="text"
          placeholder="Filter symbols..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          icon={<Icon name="magnifying-glass" />}
          iconRight={
            searchQuery() ? (
              <span
                onClick={() => {
                  setSearchQuery("");
                  outline.setFilter("");
                }}
                style={{ cursor: "pointer", color: tokens.colors.icon.default }}
              >
                <Icon name="xmark" size={14} />
              </span>
            ) : undefined
          }
          style={{ height: "26px" }}
        />
      </div>

      {/* File indicator and quick filters */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          gap: tokens.spacing.md,
          padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
          "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          "flex-shrink": "0",
        }}
      >
        <span title={activeFileName()}>
          <Text variant="muted" truncate>
            {activeFileName()}
          </Text>
        </span>
        <QuickFilterButtons />
      </div>

{/* Content */}
      <div
        ref={contentRef}
        onScroll={handleScroll}
        style={{
          flex: "1",
          "overflow-y": "auto",
          "overflow-x": "hidden",
          position: "relative",
        }}
      >
        {/* Loading state */}
        <Show when={outline.state.loading}>
          <EmptyState
            description="Loading symbols..."
            style={{ padding: "16px" }}
          />
        </Show>

        {/* Error state */}
        <Show when={outline.state.error && !outline.state.loading}>
          <EmptyState
            title="Error"
            description={outline.state.error ?? undefined}
            style={{ padding: "16px" }}
          />
        </Show>

        {/* Empty state - no file open */}
        <Show when={!editor.state.activeFileId && !outline.state.loading}>
          <EmptyState
            icon={<Icon name="code" size={24} />}
            description="No file open"
            style={{ padding: "16px" }}
          />
        </Show>

        {/* Empty state - no symbols */}
        <Show
          when={
            editor.state.activeFileId &&
            !hasSymbols() &&
            !outline.state.loading &&
            !outline.state.error
          }
        >
          <EmptyState
            icon={<Icon name="magnifying-glass" size={24} />}
            description={searchQuery() ? "No matching symbols" : "No symbols found"}
            style={{ padding: "16px" }}
          />
        </Show>

        {/* Virtualized symbol list */}
        <Show when={hasSymbols() && !outline.state.loading}>
          <div
            style={{
              height: `${totalHeight()}px`,
              position: "relative",
              width: "100%",
            }}
          >
            <For each={visibleSymbols()}>
              {(item) => (
                <VirtualizedSymbolItem
                  item={item}
                  onSelect={handleSymbolSelect}
                  onToggle={(id) => outline.toggleExpanded(id)}
                  activeSymbolId={outline.state.activeSymbolId}
                  expandedIds={outline.state.expandedIds}
                  style={{
                    transform: `translateY(${item.index * ITEM_HEIGHT}px)`,
                  }}
                />
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Footer - Symbol count */}
      <Show when={hasSymbols() || outline.state.symbols.length > 0}>
        <div
          style={{
            padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
            "border-top": `1px solid ${tokens.colors.border.divider}`,
            "flex-shrink": "0",
          }}
        >
          <Text variant="muted" size="xs">
            {(() => {
              const displayedCount = outline.state.flattenedSymbols.length;
              const totalCount = countAllSymbols(outline.state.symbols);
              const hasTextFilter = searchQuery().length > 0;
              const hasTypeFilter = outline.state.symbolTypeFilter.size < allSymbolTypeFilters.length;
              const isFiltered = hasTextFilter || hasTypeFilter;

              if (isFiltered && displayedCount !== totalCount) {
                return `${displayedCount} of ${totalCount} symbols`;
              }
              return `${displayedCount} symbol${displayedCount !== 1 ? "s" : ""}`;
            })()}
            <Show when={outline.state.symbolTypeFilter.size < allSymbolTypeFilters.length}>
              <span style={{ color: tokens.colors.semantic.info }}>
                {" "}• {outline.state.symbolTypeFilter.size} type{outline.state.symbolTypeFilter.size !== 1 ? "s" : ""} shown
              </span>
            </Show>
          </Text>
        </div>
      </Show>
    </div>
  );
}

// Helper to count all symbols recursively
function countAllSymbols(symbols: DocumentSymbol[]): number {
  let count = 0;
  function countRecursive(syms: DocumentSymbol[]) {
    for (const sym of syms) {
      count++;
      countRecursive(sym.children);
    }
  }
  countRecursive(symbols);
  return count;
}

// Sidebar version with compact styling
export function OutlinePanelSidebar() {
  return (
    <div style={{ height: "100%" }}>
      <OutlinePanel />
    </div>
  );
}
