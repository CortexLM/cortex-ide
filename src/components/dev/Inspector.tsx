import {
  createSignal,
  createMemo,
  createEffect,
  For,
  Show,
  onCleanup,
} from "solid-js";
import { Icon } from "../ui/Icon";
import {
  useInspector,
  type ElementTreeNode,
  type ComputedStyle,
  type ElementProp,
  type ElementState,
  type PerformanceMetric,
} from "@/context/InspectorContext";
import { useTheme } from "@/context/ThemeContext";

// ============== Tree Node Component ==============

interface TreeNodeProps {
  node: ElementTreeNode;
  level: number;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  selectedId: string | null;
  hoveredId: string | null;
  searchHighlight: string[];
}

function TreeNode(props: TreeNodeProps) {
  const { isDark } = useTheme();
  const isSelected = () => props.selectedId === props.node.id;
  const isHovered = () => props.hoveredId === props.node.id;
  const isSearchHighlight = () => props.searchHighlight.includes(props.node.id);

  const displayName = () => {
    let name = props.node.tagName;
    if (props.node.componentName) {
      name = `<${props.node.componentName}>`;
    }
    return name;
  };

  const truncatedClass = () => {
    const cls = props.node.className;
    if (!cls) return "";
    const classes = cls.split(/\s+/).slice(0, 2).join(" ");
    return classes.length > 30 ? classes.slice(0, 30) + "..." : classes;
  };

  return (
    <div>
      <div
        class="flex items-center py-0.5 px-1 rounded cursor-pointer transition-colors group"
        style={{
          "padding-left": `${props.level * 12 + 4}px`,
          background: isSelected()
            ? isDark()
              ? "rgba(99, 102, 241, 0.2)"
              : "rgba(99, 102, 241, 0.15)"
            : isHovered()
            ? isDark()
              ? "rgba(34, 211, 238, 0.15)"
              : "rgba(34, 211, 238, 0.1)"
            : isSearchHighlight()
            ? isDark()
              ? "rgba(245, 158, 11, 0.15)"
              : "rgba(245, 158, 11, 0.1)"
            : "transparent",
          border: isSelected()
            ? "1px solid rgba(99, 102, 241, 0.3)"
            : "1px solid transparent",
        }}
        onClick={() => props.onSelect(props.node.id)}
      >
        <button
          class="p-0.5 mr-1 opacity-60 hover:opacity-100 transition-opacity"
          style={{ visibility: props.node.hasChildren ? "visible" : "hidden" }}
          onClick={(e) => {
            e.stopPropagation();
            props.onToggle(props.node.id);
          }}
        >
        <Show when={props.node.expanded} fallback={<Icon name="chevron-right" size={12} />}>
            <Icon name="chevron-down" size={12} />
          </Show>
        </button>

        <span
          class="text-xs font-mono"
          style={{
            color: props.node.componentName
              ? "var(--cortex-info)"
              : isDark()
              ? "var(--cortex-info)"
              : "var(--cortex-info)",
          }}
        >
          {displayName()}
        </span>

        <Show when={truncatedClass()}>
          <span
            class="ml-1 text-xs font-mono opacity-50 truncate"
            style={{ "max-width": "120px" }}
          >
            .{truncatedClass()}
          </span>
        </Show>
      </div>

      <Show when={props.node.expanded && props.node.children.length > 0}>
        <For each={props.node.children}>
          {(child) => (
            <TreeNode
              node={child}
              level={props.level + 1}
              onSelect={props.onSelect}
              onToggle={props.onToggle}
              selectedId={props.selectedId}
              hoveredId={props.hoveredId}
              searchHighlight={props.searchHighlight}
            />
          )}
        </For>
      </Show>
    </div>
  );
}

// ============== Editable Value Component ==============

interface EditableValueProps {
  value: string;
  onSave: (value: string) => void;
  type?: "string" | "number" | "boolean" | "color";
}

function EditableValue(props: EditableValueProps) {
  const { isDark } = useTheme();
  const [isEditing, setIsEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal(props.value);

  const handleSave = () => {
    props.onSave(editValue());
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(props.value);
      setIsEditing(false);
    }
  };

  return (
    <Show
      when={isEditing()}
      fallback={
        <span
          class="cursor-pointer hover:bg-white hover:bg-opacity-10 px-1 rounded transition-colors"
          onClick={() => {
            setEditValue(props.value);
            setIsEditing(true);
          }}
          title="Click to edit"
        >
          {props.value}
        </span>
      }
    >
      <input
        type={props.type === "number" ? "number" : props.type === "color" ? "color" : "text"}
        value={editValue()}
        onInput={(e) => setEditValue(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        autofocus
        class="px-1 text-xs font-mono rounded outline-none"
        style={{
          background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
          border: `1px solid ${isDark() ? "var(--cortex-bg-hover)" : "var(--cortex-text-primary)"}`,
          color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)",
          width: props.type === "color" ? "60px" : "100px",
        }}
      />
    </Show>
  );
}

// ============== Styles Panel ==============

interface StylesPanelProps {
  styles: ComputedStyle[];
  onUpdate: (property: string, value: string) => void;
}

function StylesPanel(props: StylesPanelProps) {
  const { isDark } = useTheme();
  const [filter, setFilter] = createSignal("");

  const filteredStyles = createMemo(() => {
    const query = filter().toLowerCase();
    if (!query) return props.styles;
    return props.styles.filter(
      (s) => s.property.toLowerCase().includes(query) || s.value.toLowerCase().includes(query)
    );
  });

  return (
    <div class="space-y-2">
      <div
        class="flex items-center gap-2 px-2 py-1 rounded"
        style={{
          background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
          border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
        }}
      >
        <Icon name="magnifying-glass" size={12} style={{ color: "var(--cortex-text-inactive)" }} />
        <input
          type="text"
          placeholder="Filter styles..."
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
          class="flex-1 bg-transparent text-xs outline-none"
          style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
        />
      </div>

      <div class="space-y-0.5 max-h-[200px] overflow-y-auto">
        <For each={filteredStyles()}>
          {(style) => (
            <div
              class="flex items-center justify-between py-0.5 px-1 rounded text-xs font-mono hover:bg-white hover:bg-opacity-5"
            >
              <span style={{ color: "var(--cortex-info)" }}>{style.property}</span>
              <EditableValue
                value={style.value}
                onSave={(value) => props.onUpdate(style.property, value)}
                type={style.property.includes("color") ? "color" : "string"}
              />
            </div>
          )}
        </For>

        <Show when={filteredStyles().length === 0}>
          <div class="text-xs text-center py-2" style={{ color: "var(--cortex-text-inactive)" }}>
            No styles found
          </div>
        </Show>
      </div>
    </div>
  );
}

// ============== Props Panel ==============

interface PropsPanelProps {
  props: ElementProp[];
  onUpdate: (name: string, value: unknown) => void;
}

function PropsPanel(props: PropsPanelProps) {
  const { isDark } = useTheme();

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "null";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return (
    <div class="space-y-0.5 max-h-[200px] overflow-y-auto">
      <For each={props.props}>
        {(prop) => (
          <div
            class="flex items-center justify-between py-0.5 px-1 rounded text-xs font-mono hover:bg-white hover:bg-opacity-5"
          >
            <span style={{ color: "var(--cortex-success)" }}>{prop.name}</span>
            <div class="flex items-center gap-1">
              <Show when={prop.editable}>
                <EditableValue
                  value={formatValue(prop.value)}
                  onSave={(value) => props.onUpdate(prop.name, value)}
                  type={prop.type as "string" | "number" | "boolean"}
                />
              </Show>
              <Show when={!prop.editable}>
                <span style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}>
                  {formatValue(prop.value)}
                </span>
              </Show>
              <span class="opacity-40 text-[10px]">({prop.type})</span>
            </div>
          </div>
        )}
      </For>

      <Show when={props.props.length === 0}>
        <div class="text-xs text-center py-2" style={{ color: "var(--cortex-text-inactive)" }}>
          No props found
        </div>
      </Show>
    </div>
  );
}

// ============== State Panel ==============

interface StatePanelProps {
  state: ElementState[];
}

function StatePanel(props: StatePanelProps) {
  const { isDark } = useTheme();

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "null";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <div class="space-y-0.5 max-h-[200px] overflow-y-auto">
      <For each={props.state}>
        {(item) => (
          <div
            class="flex items-center justify-between py-0.5 px-1 rounded text-xs font-mono hover:bg-white hover:bg-opacity-5"
          >
            <span style={{ color: "var(--cortex-warning)" }}>{item.name}</span>
            <div class="flex items-center gap-1">
              <span style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}>
                {formatValue(item.value)}
              </span>
              <span class="opacity-40 text-[10px]">({item.type})</span>
            </div>
          </div>
        )}
      </For>

      <Show when={props.state.length === 0}>
        <div class="text-xs text-center py-2" style={{ color: "var(--cortex-text-inactive)" }}>
          No state found
        </div>
      </Show>
    </div>
  );
}

// ============== Performance Panel ==============

interface PerformancePanelProps {
  metrics: PerformanceMetric[];
}

function PerformancePanel(props: PerformancePanelProps) {
  const { isDark } = useTheme();

  return (
    <div class="space-y-1 max-h-[200px] overflow-y-auto">
      <For each={props.metrics}>
        {(metric) => (
          <div
            class="flex items-center justify-between py-1 px-2 rounded text-xs"
            style={{
              background: metric.warning
                ? isDark()
                  ? "rgba(239, 68, 68, 0.1)"
                  : "rgba(239, 68, 68, 0.05)"
                : "transparent",
              border: metric.warning ? "1px solid rgba(239, 68, 68, 0.3)" : "none",
            }}
          >
            <div class="flex items-center gap-2">
              <Show when={metric.warning}>
                <Icon name="triangle-exclamation" size={12} style={{ color: "var(--cortex-error)" }} />
              </Show>
              <span style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}>{metric.name}</span>
            </div>
            <span
              class="font-mono"
              style={{
                color: metric.warning ? "var(--cortex-error)" : isDark() ? "var(--cortex-text-inactive)" : "var(--cortex-text-inactive)",
              }}
            >
              {metric.value} {metric.unit}
            </span>
          </div>
        )}
      </For>

      <Show when={props.metrics.length === 0}>
        <div class="text-xs text-center py-2" style={{ color: "var(--cortex-text-inactive)" }}>
          No metrics available
        </div>
      </Show>
    </div>
  );
}

// ============== Collapsible Section ==============

interface CollapsibleSectionProps {
  title: string;
  icon: any;
  defaultOpen?: boolean;
  badge?: number;
  children: any;
}

function CollapsibleSection(props: CollapsibleSectionProps) {
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = createSignal(props.defaultOpen ?? true);

  return (
    <div
      class="rounded-lg overflow-hidden"
      style={{
        background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
        border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
      }}
    >
      <button
        class="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-white hover:bg-opacity-5"
        onClick={() => setIsOpen(!isOpen())}
        style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
      >
        <props.icon size={14} style={{ color: "var(--cortex-info)" }} />
        <span class="flex-1 text-left">{props.title}</span>
        <Show when={props.badge !== undefined}>
          <span
            class="px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{
              background: isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)",
              color: isDark() ? "var(--cortex-text-inactive)" : "var(--cortex-text-inactive)",
            }}
          >
            {props.badge}
          </span>
        </Show>
        <Show when={isOpen()} fallback={<Icon name="chevron-right" size={14} />}>
          <Icon name="chevron-down" size={14} />
        </Show>
      </button>

      <Show when={isOpen()}>
        <div class="px-3 pb-3">{props.children}</div>
      </Show>
    </div>
  );
}

// ============== Main Inspector Component ==============

export function Inspector() {
  const { isDark } = useTheme();
  const inspector = useInspector();

  const [copiedPath, setCopiedPath] = createSignal(false);

  const copyElementPath = async () => {
    const path = inspector.state.selectedElement?.id;
    if (!path) return;

    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const selectedElement = () => inspector.state.selectedElement;
  const elementTree = () => inspector.state.elementTree;

  // Refresh tree periodically when inspector is open
  createEffect(() => {
    if (!inspector.state.isOpen) return;

    const interval = setInterval(() => {
      if (inspector.state.isOpen && !inspector.state.isPicking) {
        // Lightweight tree refresh - only structure, not full inspection
      }
    }, 2000);

    onCleanup(() => clearInterval(interval));
  });

  return (
    <Show when={inspector.state.isOpen}>
      {/* Backdrop for panel */}
      <div
        data-inspector-ui="true"
        class="fixed inset-0 z-[9998] pointer-events-none"
      />

      {/* Inspector Panel */}
      <div
        data-inspector-ui="true"
        class="fixed z-[9999] flex flex-col shadow-2xl"
        style={{
          background: isDark() ? "var(--cortex-bg-secondary)" : "var(--cortex-text-primary)",
          border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
          "border-radius": "var(--cortex-radius-lg)",
          ...(inspector.state.panelPosition === "right"
            ? {
                right: "16px",
                top: "16px",
                bottom: "16px",
                width: `${inspector.state.panelWidth}px`,
              }
            : inspector.state.panelPosition === "left"
            ? {
                left: "16px",
                top: "16px",
                bottom: "16px",
                width: `${inspector.state.panelWidth}px`,
              }
            : {
                left: "16px",
                right: "16px",
                bottom: "16px",
                height: `${inspector.state.panelHeight}px`,
              }),
        }}
      >
        {/* Header */}
        <div
          class="flex items-center justify-between px-4 h-12 border-b shrink-0"
          style={{ "border-color": isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)" }}
        >
          <div class="flex items-center gap-2">
            <Icon name="layer-group" size={16} style={{ color: "var(--cortex-info)" }} />
            <span
              class="font-semibold text-sm"
              style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
            >
              Element Inspector
            </span>
          </div>

          <div class="flex items-center gap-1">
            {/* Picker toggle */}
            <button
              class="p-1.5 rounded transition-colors"
              style={{
                background: inspector.state.isPicking
                  ? "rgba(99, 102, 241, 0.2)"
                  : "transparent",
                color: inspector.state.isPicking ? "var(--cortex-info)" : "var(--cortex-text-inactive)",
              }}
              onClick={() =>
                inspector.state.isPicking ? inspector.stopPicking() : inspector.startPicking()
              }
              title={inspector.state.isPicking ? "Stop picking (Esc)" : "Pick element"}
            >
              <Icon name="crosshairs" size={16} />
            </button>

            {/* Refresh */}
            <button
              class="p-1.5 rounded transition-colors hover:bg-white hover:bg-opacity-10"
              style={{ color: "var(--cortex-text-inactive)" }}
              onClick={() => inspector.selectElement(inspector.state.selectedElement?.element || null)}
              title="Refresh"
            >
              <Icon name="rotate" size={16} />
            </button>

            {/* Close */}
            <button
              class="p-1.5 rounded transition-colors hover:bg-white hover:bg-opacity-10"
              style={{ color: "var(--cortex-text-inactive)" }}
              onClick={() => inspector.close()}
              title="Close (Esc)"
            >
              <Icon name="xmark" size={16} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div
          class="px-3 py-2 border-b shrink-0"
          style={{ "border-color": isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)" }}
        >
          <div
            class="flex items-center gap-2 px-2 py-1.5 rounded-lg"
            style={{
              background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
              border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
            }}
          >
            <Icon name="magnifying-glass" size={14} style={{ color: "var(--cortex-text-inactive)" }} />
            <input
              type="text"
              placeholder="Search by tag, class, or ID..."
              value={inspector.state.searchQuery}
              onInput={(e) => inspector.setSearchQuery(e.currentTarget.value)}
              class="flex-1 bg-transparent text-sm outline-none"
              style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
            />
            <Show when={inspector.state.searchResults.length > 0}>
              <div class="flex items-center gap-1 text-xs" style={{ color: "var(--cortex-text-inactive)" }}>
                <span>
                  {inspector.state.highlightedSearchResult + 1}/{inspector.state.searchResults.length}
                </span>
                <button
                  class="p-0.5 hover:bg-white hover:bg-opacity-10 rounded"
                  onClick={() => inspector.prevSearchResult()}
                >
                  <Icon name="chevron-up" size={12} />
                </button>
                <button
                  class="p-0.5 hover:bg-white hover:bg-opacity-10 rounded"
                  onClick={() => inspector.nextSearchResult()}
                >
                  <Icon name="chevron-down" size={12} />
                </button>
              </div>
            </Show>
          </div>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-hidden flex flex-col">
          {/* Element Tree */}
          <div
            class="h-1/3 min-h-[120px] overflow-y-auto border-b"
            style={{ "border-color": isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)" }}
          >
            <div class="p-2">
              <div class="flex items-center justify-between mb-2 px-1">
                <span
                  class="text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--cortex-text-inactive)" }}
                >
                  Element Tree
                </span>
                <div class="flex items-center gap-1">
                  <button
                    class="px-1.5 py-0.5 text-[10px] rounded hover:bg-white hover:bg-opacity-10"
                    style={{ color: "var(--cortex-text-inactive)" }}
                    onClick={() => inspector.expandAll()}
                  >
                    Expand All
                  </button>
                  <button
                    class="px-1.5 py-0.5 text-[10px] rounded hover:bg-white hover:bg-opacity-10"
                    style={{ color: "var(--cortex-text-inactive)" }}
                    onClick={() => inspector.collapseAll()}
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              <For each={elementTree()}>
                {(node) => (
                  <TreeNode
                    node={node}
                    level={0}
                    onSelect={(id) => inspector.selectElementById(id)}
                    onToggle={(id) => inspector.toggleNodeExpanded(id)}
                    selectedId={inspector.state.selectedElementId}
                    hoveredId={inspector.state.hoveredElementId}
                    searchHighlight={inspector.state.searchResults}
                  />
                )}
              </For>

              <Show when={elementTree().length === 0}>
                <div class="text-xs text-center py-4" style={{ color: "var(--cortex-text-inactive)" }}>
                  <Icon name="box" size={24} class="mx-auto mb-2 opacity-30" />
                  <div>No elements to display</div>
                  <div class="mt-1 opacity-60">Click the picker to select an element</div>
                </div>
              </Show>
            </div>
          </div>

          {/* Element Details */}
          <div class="flex-1 overflow-y-auto p-3 space-y-3">
            <Show
              when={selectedElement()}
              fallback={
                <div class="h-full flex flex-col items-center justify-center" style={{ color: "var(--cortex-text-inactive)" }}>
                  <Icon name="crosshairs" size={32} class="opacity-30 mb-3" />
                  <div class="text-sm font-medium">No element selected</div>
                  <div class="text-xs mt-1 text-center">
                    Use the picker or select from the tree
                    <br />
                    <span class="opacity-60">Ctrl+Shift+I to toggle</span>
                  </div>
                </div>
              }
            >
              {(element) => (
                <>
                  {/* Selected Element Header */}
                  <div
                    class="p-3 rounded-lg"
                    style={{
                      background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
                      border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
                    }}
                  >
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <span
                          class="text-sm font-mono font-medium"
                          style={{ color: "var(--cortex-info)" }}
                        >
                          &lt;{element().tagName}&gt;
                        </span>
                        <Show when={element().componentName}>
                          <span
                            class="px-1.5 py-0.5 text-[10px] rounded font-medium"
                            style={{
                              background: "rgba(167, 139, 250, 0.15)",
                              color: "var(--cortex-info)",
                            }}
                          >
                            {element().componentName}
                          </span>
                        </Show>
                      </div>
                      <button
                        class="p-1 rounded hover:bg-white hover:bg-opacity-10 transition-colors"
                        onClick={copyElementPath}
                        title="Copy selector path"
                      >
                        <Show when={copiedPath()} fallback={<Icon name="copy" size={12} />}>
                          <Icon name="check" size={12} style={{ color: "var(--cortex-success)" }} />
                        </Show>
                      </button>
                    </div>

                    <Show when={element().className}>
                      <div class="text-xs font-mono truncate" style={{ color: "var(--cortex-text-inactive)" }}>
                        .{element().className.split(/\s+/).slice(0, 3).join(" .")}
                      </div>
                    </Show>

                    {/* Bounds */}
                    <div class="flex items-center gap-3 mt-2 text-[10px]" style={{ color: "var(--cortex-text-inactive)" }}>
                      <span>
                        {Math.round(element().bounds.width)} × {Math.round(element().bounds.height)}
                      </span>
                      <span>
                        ({Math.round(element().bounds.x)}, {Math.round(element().bounds.y)})
                      </span>
                    </div>
                  </div>

                  {/* Styles Section */}
                  <CollapsibleSection
                    title="Computed Styles"
                    icon={(props: any) => <Icon name="code" {...props} />}
                    defaultOpen={inspector.state.showStyles}
                    badge={element().computedStyles.length}
                  >
                    <StylesPanel
                      styles={element().computedStyles}
                      onUpdate={(prop, value) => inspector.updateElementStyle(prop, value)}
                    />
                  </CollapsibleSection>

                  {/* Props Section */}
                  <CollapsibleSection
                    title="Attributes & Props"
                    icon={(props: any) => <Icon name="box" {...props} />}
                    defaultOpen={inspector.state.showProps}
                    badge={element().props.length}
                  >
                    <PropsPanel
                      props={element().props}
                      onUpdate={(name, value) => inspector.updateElementProp(name, value)}
                    />
                  </CollapsibleSection>

                  {/* State Section */}
                  <Show when={element().state.length > 0}>
                    <CollapsibleSection
                      title="Component State"
                      icon={(props: any) => <Icon name="gear" {...props} />}
                      defaultOpen={inspector.state.showState}
                      badge={element().state.length}
                    >
                      <StatePanel state={element().state} />
                    </CollapsibleSection>
                  </Show>

                  {/* Performance Section */}
                  <CollapsibleSection
                    title="Performance Metrics"
                    icon={(props: any) => <Icon name="wave-pulse" {...props} />}
                    defaultOpen={inspector.state.showPerformance}
                    badge={element().performanceMetrics.filter((m) => m.warning).length || undefined}
                  >
                    <PerformancePanel metrics={element().performanceMetrics} />
                  </CollapsibleSection>
                </>
              )}
            </Show>
          </div>
        </div>

        {/* Footer */}
        <div
          class="flex items-center justify-between px-3 py-2 border-t text-[10px] shrink-0"
          style={{
            "border-color": isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)",
            color: "var(--cortex-text-inactive)",
          }}
        >
          <div class="flex items-center gap-2">
            <Show when={inspector.state.isPicking}>
              <span
                class="px-1.5 py-0.5 rounded"
                style={{ background: "rgba(99, 102, 241, 0.2)", color: "var(--cortex-info)" }}
              >
                Picking...
              </span>
            </Show>
            <span>Ctrl+Shift+I to toggle</span>
          </div>
          <div class="flex items-center gap-2">
            {/* Position buttons */}
            <button
              class="px-1.5 py-0.5 rounded hover:bg-white hover:bg-opacity-10"
              style={{
                background: inspector.state.panelPosition === "left" ? "rgba(99, 102, 241, 0.2)" : "transparent",
              }}
              onClick={() => inspector.setPanelPosition("left")}
              title="Dock left"
            >
              ←
            </button>
            <button
              class="px-1.5 py-0.5 rounded hover:bg-white hover:bg-opacity-10"
              style={{
                background: inspector.state.panelPosition === "bottom" ? "rgba(99, 102, 241, 0.2)" : "transparent",
              }}
              onClick={() => inspector.setPanelPosition("bottom")}
              title="Dock bottom"
            >
              ↓
            </button>
            <button
              class="px-1.5 py-0.5 rounded hover:bg-white hover:bg-opacity-10"
              style={{
                background: inspector.state.panelPosition === "right" ? "rgba(99, 102, 241, 0.2)" : "transparent",
              }}
              onClick={() => inspector.setPanelPosition("right")}
              title="Dock right"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

// Export utility to open inspector
export function openInspector(): void {
  window.dispatchEvent(new CustomEvent("inspector:open"));
}

// Export utility to toggle inspector
export function toggleInspector(): void {
  window.dispatchEvent(new CustomEvent("inspector:toggle"));
}

