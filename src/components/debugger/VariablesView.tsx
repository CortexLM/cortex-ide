import { Show, For, createSignal, createEffect, createMemo, JSX } from "solid-js";
import { useDebug, Variable } from "@/context/DebugContext";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";
import { useSettings } from "@/context/SettingsContext";
import {
  HexViewer,
  ImagePreview,
  JsonTreeView,
  ArrayVisualizer,
  DateTimeVisualizer,
  ColorVisualizer,
  UrlVisualizer,
  detectVisualizerType,
  isColorValue,
  isImageDataUrl,
  isUrlValue,
  VisualizerType,
} from "./VariableVisualizers";

/**
 * Variables View - VS Code Specification Compliant
 * 
 * Specs:
 * - Font: monospace (var(--monaco-monospace-font))
 * - Font size: 13px (Windows/Linux), 11px (macOS)
 * - Row height: 22px
 * - Value margin-left: 6px
 * - Value change animation: 1s with debugViewletValueChanged keyframes
 * - Expression display: flex, text-overflow: ellipsis
 */

/** Default page size for lazy loading variables */
const DEFAULT_PAGE_SIZE = 100;

/** Available visualizer options for context menu */
const VISUALIZER_OPTIONS: Array<{ type: VisualizerType; label: string }> = [
  { type: "default", label: "Default" },
  { type: "hex", label: "Hex View" },
  { type: "image", label: "Image Preview" },
  { type: "json", label: "JSON Tree" },
  { type: "array", label: "Array View" },
  { type: "datetime", label: "Date/Time" },
  { type: "color", label: "Color" },
  { type: "url", label: "URL" },
  { type: "map", label: "Map View" },
  { type: "set", label: "Set View" },
];

interface VariableItemProps {
  variable: Variable;
  depth?: number;
  previousValue?: string;
}

interface EditingState {
  name: string;
  variablesReference: number;
}

/** Paging state for lazy-loaded variable children */
interface PagingState {
  /** Currently loaded children */
  variables: Variable[];
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Next start index for paging */
  nextStart: number;
  /** Total indexed variables (if known from DAP) */
  totalIndexed?: number;
}

interface VisualizerSettings {
  enabled: boolean;
  hexBytesPerRow: number;
  arrayPageSize: number;
}

/** Gets visualizer settings from the settings context or returns defaults */
function useVisualizerSettings(): VisualizerSettings {
  try {
    const settings = useSettings();
    const debugSettings = settings.effectiveSettings().debug;
    return {
      enabled: (debugSettings as any)?.variableVisualizers?.enabled ?? true,
      hexBytesPerRow: (debugSettings as any)?.variableVisualizers?.hexBytesPerRow ?? 16,
      arrayPageSize: (debugSettings as any)?.variableVisualizers?.arrayPageSize ?? 50,
    };
  } catch {
    // Fallback if settings context is not available
    return {
      enabled: true,
      hexBytesPerRow: 16,
      arrayPageSize: 50,
    };
  }
}

function VariableItem(props: VariableItemProps & { parentRef?: number }) {
  const debug = useDebug();
  const visualizerSettings = useVisualizerSettings();
  
  const [expanded, setExpanded] = createSignal(false);
  const [pagingState, setPagingState] = createSignal<PagingState>({
    variables: [],
    hasMore: false,
    nextStart: 0,
    totalIndexed: undefined,
  });
  const [loading, setLoading] = createSignal(false);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [valueChanged, setValueChanged] = createSignal(false);
  const [editing, setEditing] = createSignal<EditingState | null>(null);
  const [editValue, setEditValue] = createSignal("");
  const [editError, setEditError] = createSignal<string | null>(null);
  
  // Visualizer state
  const [showVisualizer, setShowVisualizer] = createSignal(false);
  const [selectedVisualizer, setSelectedVisualizer] = createSignal<VisualizerType | null>(null);
  const [showVisualizerMenu, setShowVisualizerMenu] = createSignal(false);
  
  // Detect the appropriate visualizer type for this variable
  const detectedVisualizer = createMemo(() => 
    detectVisualizerType(props.variable.type, props.variable.value)
  );
  
  // Get the active visualizer (user selected or auto-detected)
  const activeVisualizer = createMemo(() => 
    selectedVisualizer() ?? detectedVisualizer()
  );
  
  // Check if this variable has a specialized visualizer available
  const hasSpecializedVisualizer = createMemo(() => 
    visualizerSettings.enabled && detectedVisualizer() !== "default"
  );

  const hasChildren = () => props.variable.variablesReference > 0;
  const depth = () => props.depth || 0;
  
  // Use parent's variablesReference for setVariable, or fallback to the variable's own reference
  const getContainerRef = () => props.parentRef ?? props.variable.variablesReference;

  // Get total indexed variables from the variable's metadata
  const getTotalIndexed = () => props.variable.indexedVariables;
  
  // Calculate remaining items to load
  const getRemainingCount = () => {
    const state = pagingState();
    const total = state.totalIndexed ?? getTotalIndexed();
    if (total === undefined) return undefined;
    return Math.max(0, total - state.variables.length);
  };

  // Track value changes for animation
  createEffect(() => {
    if (props.previousValue !== undefined && props.previousValue !== props.variable.value) {
      setValueChanged(true);
      // Reset after animation duration (1s)
      setTimeout(() => setValueChanged(false), 1000);
    }
  });

  const toggleExpand = async () => {
    if (!hasChildren()) return;

    if (expanded()) {
      setExpanded(false);
      return;
    }

    setLoading(true);
    try {
      // Use paged loading for variables with indexed children
      const totalIndexed = getTotalIndexed();
      const vars = await debug.expandVariablePaged(
        props.variable.variablesReference,
        0,
        DEFAULT_PAGE_SIZE
      );
      
      // Determine if there are more items to load
      const hasMore = totalIndexed !== undefined 
        ? vars.length < totalIndexed 
        : vars.length === DEFAULT_PAGE_SIZE;
      
      setPagingState({
        variables: vars,
        hasMore,
        nextStart: vars.length,
        totalIndexed,
      });
      setExpanded(true);
    } catch (e) {
      console.error("Failed to expand variable:", e);
    } finally {
      setLoading(false);
    }
  };

  // Load more children when paging
  const loadMore = async () => {
    const state = pagingState();
    if (!state.hasMore || loadingMore()) return;

    setLoadingMore(true);
    try {
      const vars = await debug.expandVariablePaged(
        props.variable.variablesReference,
        state.nextStart,
        DEFAULT_PAGE_SIZE
      );
      
      const totalIndexed = state.totalIndexed ?? getTotalIndexed();
      const newTotalLoaded = state.variables.length + vars.length;
      const hasMore = totalIndexed !== undefined
        ? newTotalLoaded < totalIndexed
        : vars.length === DEFAULT_PAGE_SIZE;
      
      setPagingState({
        variables: [...state.variables, ...vars],
        hasMore,
        nextStart: newTotalLoaded,
        totalIndexed,
      });
    } catch (e) {
      console.error("Failed to load more variables:", e);
    } finally {
      setLoadingMore(false);
    }
  };

  // Start editing a variable
  const startEditing = () => {
    const containerRef = getContainerRef();
    if (containerRef <= 0) {
      // Cannot edit variables without a valid container reference
      return;
    }
    setEditing({ name: props.variable.name, variablesReference: containerRef });
    setEditValue(props.variable.value);
    setEditError(null);
  };

  // Commit the edit
  const commitEdit = async () => {
    const currentEditing = editing();
    if (!currentEditing) return;

    const newValue = editValue().trim();
    if (newValue === props.variable.value) {
      // No change, just cancel
      cancelEdit();
      return;
    }

    try {
      await debug.setVariable(currentEditing.variablesReference, currentEditing.name, newValue);
      setEditing(null);
      setEditError(null);
    } catch (e) {
      console.error("Failed to set variable:", e);
      setEditError(e instanceof Error ? e.message : "Failed to set variable");
    }
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditing(null);
    setEditValue("");
    setEditError(null);
  };

  // Handle key down in edit input
  const handleEditKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  // Format display value with indexed count info (e.g., "Array[0..99 of 1000]")
  const getDisplayValue = () => {
    const value = props.variable.value;
    const totalIndexed = getTotalIndexed();
    const state = pagingState();
    
    // Only show indexed count for expanded variables with indexed children
    if (expanded() && totalIndexed !== undefined && totalIndexed > 0) {
      const loadedCount = state.variables.length;
      const endIndex = loadedCount > 0 ? loadedCount - 1 : 0;
      
      // Append the range info to the value
      if (loadedCount < totalIndexed) {
        return `${value} [0..${endIndex} of ${totalIndexed}]`;
      }
    }
    
    return value;
  };

  // VS Code token expression color classes
  const getValueColorClass = () => {
    const type = props.variable.type?.toLowerCase() || "";
    const value = props.variable.value;

    if (type.includes("string") || value.startsWith('"') || value.startsWith("'")) {
      return "debug-value-string"; // var(--debug-token-expression-string)
    }
    if (type.includes("number") || type.includes("int") || type.includes("float") || /^-?\d+\.?\d*$/.test(value)) {
      return "debug-value-number"; // var(--debug-token-expression-number)
    }
    if (value === "true" || value === "false" || type.includes("bool")) {
      return "debug-value-boolean"; // var(--debug-token-expression-boolean)
    }
    if (value === "null" || value === "undefined" || value === "None") {
      return "debug-value-null"; // var(--debug-token-expression-value)
    }
    if (type.includes("function") || type.includes("method")) {
      return "debug-value-function"; // var(--cortex-syntax-function)
    }
    return "";
  };

  // Detect platform for font size
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const fontSize = isMac ? "11px" : "13px";

  // Render the appropriate visualizer component
  const renderVisualizer = (): JSX.Element | null => {
    const viz = activeVisualizer();
    if (viz === "default" || !showVisualizer()) return null;
    
    const value = props.variable.value;
    const type = props.variable.type;
    
    switch (viz) {
      case "hex":
        // Parse hex data from the value (assumes format like "[0, 1, 2, ...]" or "Buffer<...>")
        try {
          const match = value.match(/\[([^\]]+)\]/);
          if (match) {
            const bytes = match[1].split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
            return <HexViewer data={bytes} bytesPerRow={visualizerSettings.hexBytesPerRow} />;
          }
          // Try to parse as a Buffer-like format
          const hexMatch = value.match(/(?:Buffer|Uint8Array|ArrayBuffer)\s*(?:<|{)\s*(.+?)\s*(?:>|})/i);
          if (hexMatch) {
            const bytes = hexMatch[1].split(/[,\s]+/).map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
            return <HexViewer data={bytes} bytesPerRow={visualizerSettings.hexBytesPerRow} />;
          }
        } catch {
          // Failed to parse, show nothing
        }
        return null;
        
      case "image":
        if (isImageDataUrl(value)) {
          return <ImagePreview dataUrl={value} maxWidth={200} maxHeight={150} />;
        }
        return null;
        
      case "json":
        try {
          const data = JSON.parse(value);
          return <JsonTreeView data={data} expandLevel={2} />;
        } catch {
          // Value is not valid JSON, try to display as raw object info
          return <JsonTreeView data={{ value, type }} expandLevel={2} />;
        }
        
      case "array":
        try {
          const items = JSON.parse(value);
          if (Array.isArray(items)) {
            return <ArrayVisualizer items={items} pageSize={visualizerSettings.arrayPageSize} />;
          }
        } catch {
          // Not valid JSON array
        }
        return null;
        
      case "datetime":
        // Try to parse as timestamp
        const timestamp = parseInt(value, 10);
        if (!isNaN(timestamp)) {
          return <DateTimeVisualizer timestamp={timestamp} />;
        }
        // Try to parse as date string
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return <DateTimeVisualizer timestamp={date.getTime()} />;
        }
        return null;
        
      case "color":
        if (isColorValue(value)) {
          return <ColorVisualizer color={value} />;
        }
        return null;
        
      case "url":
        if (isUrlValue(value)) {
          return <UrlVisualizer url={value} />;
        }
        return null;
        
      case "map":
        // Map visualization requires parsed entries
        try {
          const mapMatch = value.match(/Map\((\d+)\)/);
          if (mapMatch) {
            // For actual Map visualization, we'd need the children data
            // For now, show a placeholder
            return (
              <div class="p-2 text-xs" style={{ color: "var(--text-weak)" }}>
                Expand the Map to see its entries
              </div>
            );
          }
        } catch {
          // Not a Map
        }
        return null;
        
      case "set":
        // Set visualization requires parsed values
        try {
          const setMatch = value.match(/Set\((\d+)\)/);
          if (setMatch) {
            return (
              <div class="p-2 text-xs" style={{ color: "var(--text-weak)" }}>
                Expand the Set to see its values
              </div>
            );
          }
        } catch {
          // Not a Set
        }
        return null;
        
      default:
        return null;
    }
  };

  // Handle visualizer menu toggle
  const handleVisualizerMenuClick = (e: MouseEvent) => {
    e.stopPropagation();
    setShowVisualizerMenu(!showVisualizerMenu());
  };

  // Handle visualizer selection from menu
  const handleVisualizerSelect = (vizType: VisualizerType) => {
    setSelectedVisualizer(vizType === "default" ? null : vizType);
    setShowVisualizer(vizType !== "default");
    setShowVisualizerMenu(false);
  };

  // Toggle visualizer visibility
  const toggleVisualizer = (e: MouseEvent) => {
    e.stopPropagation();
    setShowVisualizer(!showVisualizer());
  };

  return (
    <div class="debug-variables">
      <div
        class="expression flex items-center pr-2 cursor-pointer transition-colors hover:bg-[var(--surface-raised)] group"
        style={{ 
          "padding-left": `${4 + depth() * 12}px`,
          height: "22px",
          "line-height": "22px",
          "font-family": "var(--monaco-monospace-font)",
          "font-size": fontSize,
          overflow: "hidden",
          "text-overflow": "ellipsis",
          "white-space": "pre",
        }}
        onClick={toggleExpand}
      >
        {/* Expand/collapse icon - VS Code style twistie */}
        <Show
          when={hasChildren()}
          fallback={<div class="w-4 shrink-0" />}
        >
          <div class="w-4 h-4 flex items-center justify-center shrink-0" style={{ color: "var(--text-weak)" }}>
            <Show when={loading()} fallback={
              expanded() ? <Icon name="chevron-down" size="sm" /> : <Icon name="chevron-right" size="sm" />
            }>
              <div class="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" 
                   style={{ "border-color": "var(--text-weak)", "border-top-color": "transparent" }} />
            </Show>
          </div>
        </Show>

        {/* Name - VS Code uses debug-token-expression-name color */}
        <span 
          class="name shrink-0" 
          style={{ color: "var(--debug-token-expression-name)" }}
        >
          {props.variable.name}
        </span>

        {/* Type (if available) - VS Code uses debug-token-expression-type */}
        <Show when={props.variable.type}>
          <span 
            class="debug-value-type shrink-0 opacity-60" 
            style={{ 
              color: "var(--debug-token-expression-type)",
              "margin-left": tokens.spacing.sm,
            }}
          >
            {props.variable.type}
          </span>
        </Show>

        {/* Value - VS Code spec: margin-left 6px, with change animation */}
        <Show
          when={editing()}
          fallback={
            <span
              class={`value flex-1 truncate ${getValueColorClass()} ${valueChanged() ? "changed" : ""}`}
              style={{ 
                "margin-left": "6px",
                height: "22px",
                overflow: "hidden",
                "white-space": "pre",
                "text-overflow": "ellipsis",
                "border-radius": valueChanged() ? tokens.spacing.sm : undefined,
                cursor: getContainerRef() > 0 ? "text" : "default",
              }}
              title={`${props.variable.value} (double-click to edit)`}
              onDblClick={(e) => {
                e.stopPropagation();
                startEditing();
              }}
            >
              {getDisplayValue()}
            </span>
          }
        >
          <input
            type="text"
            class="flex-1 bg-[var(--surface-input)] border border-[var(--border-strong)] rounded px-1 outline-none focus:border-[var(--accent-primary)]"
            style={{
              "margin-left": "6px",
              height: "18px",
              "font-family": "var(--monaco-monospace-font)",
              "font-size": "inherit",
              color: editError() ? "var(--status-error)" : "inherit",
            }}
            value={editValue()}
            onInput={(e) => setEditValue(e.currentTarget.value)}
            onBlur={() => commitEdit()}
            onKeyDown={handleEditKeyDown}
            onClick={(e) => e.stopPropagation()}
            ref={(el) => setTimeout(() => el.focus(), 0)}
          />
        </Show>
        
        {/* Visualizer toggle button - shows when specialized visualizer is available */}
        <Show when={visualizerSettings.enabled && (hasSpecializedVisualizer() || showVisualizer())}>
          <div class="flex items-center shrink-0 ml-1" style={{ position: "relative" }}>
            {/* Quick toggle button */}
            <button
              class="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded transition-all hover:bg-[var(--surface-hover)]"
              style={{ 
                color: showVisualizer() ? "var(--accent-primary)" : "var(--text-weak)",
              }}
              onClick={toggleVisualizer}
              title={showVisualizer() ? "Hide visualizer" : `View as ${detectedVisualizer()}`}
            >
              <Icon name="eye" size="sm" />
            </button>
            
            {/* Menu button for switching visualizers */}
            <button
              class="opacity-0 group-hover:opacity-100 w-4 h-5 flex items-center justify-center rounded transition-all hover:bg-[var(--surface-hover)]"
              style={{ color: "var(--text-weak)" }}
              onClick={handleVisualizerMenuClick}
              title="View as..."
            >
              <Icon name="ellipsis-vertical" size="xs" />
            </button>
            
            {/* Visualizer selection menu */}
            <Show when={showVisualizerMenu()}>
              <div
                class="absolute right-0 top-full mt-1 z-50 py-1 rounded shadow-lg"
                style={{
                  background: "var(--surface-popup)",
                  border: "1px solid var(--border-weak)",
                  "min-width": "120px",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <For each={VISUALIZER_OPTIONS}>
                  {(option) => (
                    <div
                      class="px-3 py-1 text-xs cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
                      style={{
                        color: activeVisualizer() === option.type ? "var(--accent-primary)" : "var(--text-base)",
                        background: activeVisualizer() === option.type ? "var(--surface-selected)" : undefined,
                      }}
                      onClick={() => handleVisualizerSelect(option.type)}
                    >
                      {option.label}
                      <Show when={option.type === detectedVisualizer() && option.type !== "default"}>
                        <span style={{ color: "var(--text-muted)", "margin-left": "4px" }}>(auto)</span>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </div>
      
      {/* Error message */}
      <Show when={editError()}>
        <div 
          class="text-xs px-2"
          style={{ 
            color: "var(--status-error)",
            "padding-left": `${4 + depth() * 12 + 16}px`,
          }}
        >
          {editError()}
        </div>
      </Show>
      
      {/* Visualizer content */}
      <Show when={showVisualizer() && visualizerSettings.enabled}>
        <div
          style={{
            "margin-left": `${4 + depth() * 12 + 16}px`,
            "margin-right": "8px",
            "margin-top": "4px",
            "margin-bottom": "4px",
          }}
        >
          {renderVisualizer()}
        </div>
      </Show>

      {/* Children */}
      <Show when={expanded() && pagingState().variables.length > 0}>
        <For each={pagingState().variables}>
          {(child) => (
            <VariableItem 
              variable={child} 
              depth={depth() + 1} 
              parentRef={props.variable.variablesReference}
            />
          )}
        </For>
        
        {/* Load More button for paging */}
        <Show when={pagingState().hasMore}>
          <div
            class="flex items-center cursor-pointer transition-colors hover:bg-[var(--surface-raised)]"
            style={{ 
              "padding-left": `${4 + (depth() + 1) * 12}px`,
              height: "22px",
              "line-height": "22px",
              "font-family": "var(--monaco-monospace-font)",
              "font-size": isMac ? "11px" : "13px",
            }}
            onClick={(e) => {
              e.stopPropagation();
              loadMore();
            }}
          >
            <Show 
              when={!loadingMore()} 
              fallback={
                <div class="flex items-center gap-2" style={{ color: "var(--text-weak)" }}>
                  <div class="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" 
                       style={{ "border-color": "var(--text-weak)", "border-top-color": "transparent" }} />
                  <span>Loading...</span>
                </div>
              }
            >
              <span style={{ color: "var(--accent-primary)" }}>
                Load more...
                <Show when={getRemainingCount() !== undefined}>
                  {" "}({getRemainingCount()} remaining)
                </Show>
              </span>
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  );
}

export function VariablesView() {
  const debug = useDebug();

  createEffect(() => {
    // Refresh variables when we hit a breakpoint
    if (debug.state.isPaused && debug.state.activeFrameId !== null) {
      debug.getVariables();
    }
  });

  // Detect platform for font size
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const fontSize = isMac ? "11px" : "13px";

  return (
    <div 
      class="debug-pane py-1"
      style={{
        "font-family": "var(--monaco-monospace-font)",
        "font-size": fontSize,
      }}
    >
      <Show
        when={debug.state.variables.length > 0}
        fallback={
          <div 
            class="text-center py-4" 
            style={{ 
              color: "var(--text-weak)",
              "font-size": fontSize,
            }}
          >
            <Show when={debug.state.isPaused} fallback="Run to a breakpoint to see variables">
              No variables available
            </Show>
          </div>
        }
      >
        <For each={debug.state.variables}>
          {(variable) => <VariableItem variable={variable} />}
        </For>
      </Show>
    </div>
  );
}

