/**
 * DebugHoverWidget - Debug Hover Tooltip for Cortex IDE
 *
 * Displays evaluated expression values during debugging when hovering over code.
 * Features:
 * - Expression and value display
 * - Expandable tree view for objects/arrays
 * - Lazy loading of children via variablesReference
 * - Safe triangle for mouse movement
 * - Actions: Copy Value, Copy Expression, Add to Watch
 * - Type icons based on variable type
 * - Loading state during evaluation
 * - Intelligent viewport positioning
 * - Theme-consistent debug styling
 */

import {
  Show,
  For,
  createSignal,
  createEffect,
  onCleanup,
  createMemo,
} from "solid-js";
import { Portal } from "solid-js/web";
import { useDebug, Variable } from "@/context/DebugContext";
import { Icon } from "../ui/Icon";
import {
  DebugHoverState,
  SafeTriangle,
  calculateSafeTriangle,
  isPointInTriangle,
  formatDebugValue,
  getVariableIcon,
  getValueForCopy,
  calculateHoverPosition,
  createHoverDebouncer,
  createInitialHoverState,
  buildTreePath,
} from "@/utils/debugHover";

// ============================================================================
// Types
// ============================================================================

export interface DebugHoverWidgetProps {
  /** The hover state containing expression, result, and position */
  state: DebugHoverState;
  /** Callback when the hover should close */
  onClose: () => void;
  /** Callback to toggle expanded state of a path */
  onToggleExpand: (path: string) => void;
  /** Callback to load children for a variablesReference */
  onLoadChildren: (variablesReference: number, path: string) => Promise<Variable[]>;
  /** Callback to add expression to watch panel */
  onAddToWatch?: (expression: string) => void;
  /** Viewport dimensions for positioning */
  viewportSize?: { width: number; height: number };
}

interface TreeNodeProps {
  /** Variable data */
  variable: Variable;
  /** Full path to this node */
  path: string;
  /** Nesting depth */
  depth: number;
  /** Set of expanded paths */
  expandedPaths: Set<string>;
  /** Callback to toggle expansion */
  onToggleExpand: (path: string) => void;
  /** Callback to load children */
  onLoadChildren: (variablesReference: number, path: string) => Promise<Variable[]>;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_HOVER_WIDTH = 500;
const MAX_HOVER_HEIGHT = 400;
const TREE_INDENT = 16;
const ROW_HEIGHT = 22;

// Platform detection for font size
const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
const FONT_SIZE = isMac ? "11px" : "13px";

// ============================================================================
// Icon Component
// ============================================================================

function VariableTypeIcon(props: { type?: string; kind?: string }) {
  const iconName = createMemo(() => getVariableIcon(props.type, props.kind ? { kind: props.kind as any } : undefined));
  
  // Map icon names to simple representations
  const getIconColor = () => {
    const icon = iconName();
    switch (icon) {
      case "symbol-string":
        return "var(--debug-token-expression-string)";
      case "symbol-number":
        return "var(--debug-token-expression-number)";
      case "symbol-boolean":
        return "var(--cortex-syntax-keyword)";
      case "symbol-null":
        return "var(--text-muted)";
      case "symbol-array":
      case "symbol-object":
        return "var(--debug-token-expression-name)";
      case "symbol-function":
      case "symbol-method":
        return "var(--cortex-syntax-function)";
      case "symbol-class":
        return "var(--cortex-syntax-function)";
      case "symbol-interface":
        return "var(--cortex-syntax-function)";
      case "symbol-property":
        return "var(--debug-token-expression-name)";
      default:
        return "var(--text-weak)";
    }
  };

  const getIconChar = () => {
    const icon = iconName();
    switch (icon) {
      case "symbol-string":
        return "S";
      case "symbol-number":
        return "#";
      case "symbol-boolean":
        return "B";
      case "symbol-null":
        return "N";
      case "symbol-array":
        return "[]";
      case "symbol-object":
        return "{}";
      case "symbol-function":
      case "symbol-method":
        return "f";
      case "symbol-class":
        return "C";
      case "symbol-interface":
        return "I";
      case "symbol-property":
        return "P";
      case "symbol-variable":
        return "V";
      default:
        return "?";
    }
  };

  return (
    <span
      class="inline-flex items-center justify-center shrink-0"
      style={{
        width: "14px",
        height: "14px",
        "font-size": "9px",
        "font-weight": "600",
        color: getIconColor(),
        "font-family": "var(--monaco-monospace-font)",
      }}
      title={props.type || "unknown"}
    >
      {getIconChar()}
    </span>
  );
}

// ============================================================================
// Tree Node Component
// ============================================================================

function TreeNode(props: TreeNodeProps) {
  const [children, setChildren] = createSignal<Variable[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [loaded, setLoaded] = createSignal(false);

  const isExpanded = () => props.expandedPaths.has(props.path);
  const hasChildren = () => props.variable.variablesReference > 0;

  // Load children when first expanded
  createEffect(() => {
    if (isExpanded() && hasChildren() && !loaded()) {
      setLoading(true);
      props.onLoadChildren(props.variable.variablesReference, props.path)
        .then((vars) => {
          setChildren(vars);
          setLoaded(true);
        })
        .catch((e) => {
          console.error("Failed to load children:", e);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  });

  const handleToggle = (e: MouseEvent) => {
    e.stopPropagation();
    if (hasChildren()) {
      props.onToggleExpand(props.path);
    }
  };

  // Value color based on type
  const getValueColorClass = () => {
    const type = props.variable.type?.toLowerCase() || "";
    const value = props.variable.value;

    if (type.includes("string") || value.startsWith('"') || value.startsWith("'")) {
      return "var(--debug-token-expression-string)";
    }
    if (type.includes("number") || type.includes("int") || type.includes("float") || /^-?\d+\.?\d*$/.test(value)) {
      return "var(--debug-token-expression-number)";
    }
    if (value === "true" || value === "false" || type.includes("bool")) {
      return "var(--cortex-syntax-keyword)";
    }
    if (value === "null" || value === "undefined" || value === "None" || value === "nil") {
      return "var(--text-muted)";
    }
    return "var(--text-base)";
  };

  return (
    <div class="tree-node">
      {/* Node row */}
      <div
        class="flex items-center pr-2 cursor-pointer transition-colors hover:bg-[var(--surface-raised)]"
        style={{
          "padding-left": `${4 + props.depth * TREE_INDENT}px`,
          height: `${ROW_HEIGHT}px`,
          "line-height": `${ROW_HEIGHT}px`,
          "font-family": "var(--monaco-monospace-font)",
          "font-size": FONT_SIZE,
          overflow: "hidden",
          "text-overflow": "ellipsis",
          "white-space": "nowrap",
        }}
        onClick={handleToggle}
      >
        {/* Expand/collapse icon */}
        <Show
          when={hasChildren()}
          fallback={<div class="w-4 shrink-0" />}
        >
          <div
            class="w-4 h-4 flex items-center justify-center shrink-0"
            style={{ color: "var(--text-weak)" }}
          >
            <Show
              when={!loading()}
              fallback={
                <div
                  class="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin"
                  style={{
                    "border-color": "var(--text-weak)",
                    "border-top-color": "transparent",
                  }}
                />
              }
            >
              {isExpanded() ? (
                <Icon name="chevron-down" size="sm" />
              ) : (
                <Icon name="chevron-right" size="sm" />
              )}
            </Show>
          </div>
        </Show>

        {/* Type icon */}
        <VariableTypeIcon type={props.variable.type} />

        {/* Name */}
        <span
          class="ml-1 shrink-0"
          style={{ color: "var(--debug-token-expression-name)" }}
        >
          {props.variable.name}
        </span>

        {/* Separator */}
        <span class="mx-1" style={{ color: "var(--text-muted)" }}>:</span>

        {/* Value */}
        <span
          class="truncate"
          style={{
            color: getValueColorClass(),
            "max-width": "250px",
          }}
          title={props.variable.value}
        >
          {props.variable.value}
        </span>

        {/* Type badge */}
        <Show when={props.variable.type}>
          <span
            class="ml-2 opacity-60 text-xs shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            {props.variable.type}
          </span>
        </Show>
      </div>

      {/* Children */}
      <Show when={isExpanded() && loaded()}>
        <For each={children()}>
          {(child) => (
            <TreeNode
              variable={child}
              path={buildTreePath(props.path, child.name)}
              depth={props.depth + 1}
              expandedPaths={props.expandedPaths}
              onToggleExpand={props.onToggleExpand}
              onLoadChildren={props.onLoadChildren}
            />
          )}
        </For>
      </Show>
    </div>
  );
}

// ============================================================================
// Main Hover Widget Component
// ============================================================================

export function DebugHoverWidget(props: DebugHoverWidgetProps) {
  // Debug context available for future features (prefixed with underscore to avoid lint warnings)
  useDebug();
  let containerRef: HTMLDivElement | undefined;
  let safeTriangle: SafeTriangle | null = null;
  let closeTimeout: ReturnType<typeof setTimeout> | null = null;
  
  const [position, setPosition] = createSignal({ x: 0, y: 0 });
  const [rootChildren, setRootChildren] = createSignal<Variable[]>([]);
  const [rootLoading, setRootLoading] = createSignal(false);
  const [rootLoaded, setRootLoaded] = createSignal(false);
  const [copied, setCopied] = createSignal<"value" | "expression" | null>(null);

  // Calculate position when state changes
  createEffect(() => {
    if (props.state.visible && props.state.result) {
      const viewportSize = props.viewportSize || {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      // Estimate hover size (will adjust after render)
      const estimatedSize = {
        width: Math.min(MAX_HOVER_WIDTH, 350),
        height: Math.min(MAX_HOVER_HEIGHT, 150),
      };

      const pos = calculateHoverPosition(
        props.state.position,
        estimatedSize,
        viewportSize,
        0
      );

      setPosition({ x: pos.x, y: pos.y });

      // Update safe triangle
      if (containerRef) {
        const rect = containerRef.getBoundingClientRect();
        safeTriangle = calculateSafeTriangle(props.state.position, {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });
      }
    }
  });

  // Load root children if result is expandable
  createEffect(() => {
    const result = props.state.result;
    if (result && result.variablesReference > 0 && !rootLoaded()) {
      setRootLoading(true);
      props.onLoadChildren(result.variablesReference, props.state.expression)
        .then((vars) => {
          setRootChildren(vars);
          setRootLoaded(true);
        })
        .catch((e) => {
          console.error("Failed to load hover children:", e);
        })
        .finally(() => {
          setRootLoading(false);
        });
    }
  });

  // Handle mouse movement for safe triangle
  const handleMouseMove = (e: MouseEvent) => {
    if (!containerRef || !safeTriangle) return;

    const rect = containerRef.getBoundingClientRect();
    const isInWidget = (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );

    if (isInWidget) {
      // Mouse is in widget, cancel any pending close
      if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
      }
      return;
    }

    // Check if mouse is in safe triangle
    const isInSafeZone = isPointInTriangle(
      { x: e.clientX, y: e.clientY },
      safeTriangle
    );

    if (!isInSafeZone) {
      // Start close timer
      if (!closeTimeout) {
        closeTimeout = setTimeout(() => {
          props.onClose();
        }, 150);
      }
    } else if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = null;
    }
  };

  // Set up global mouse listener
  createEffect(() => {
    if (props.state.visible) {
      document.addEventListener("mousemove", handleMouseMove);
    }
  });

  onCleanup(() => {
    document.removeEventListener("mousemove", handleMouseMove);
    if (closeTimeout) {
      clearTimeout(closeTimeout);
    }
  });

  // Copy to clipboard
  const copyToClipboard = async (type: "value" | "expression") => {
    const result = props.state.result;
    if (!result) return;

    const text = type === "value"
      ? getValueForCopy({ ...result, expression: props.state.expression })
      : props.state.expression;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 1500);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  // Add to watch
  const handleAddToWatch = () => {
    if (props.onAddToWatch && props.state.expression) {
      props.onAddToWatch(props.state.expression);
    }
  };

  // Root expand toggle
  const handleRootToggle = () => {
    if (props.state.result?.variablesReference) {
      props.onToggleExpand(props.state.expression);
    }
  };

  const isRootExpanded = () => props.state.expandedPaths.has(props.state.expression);
  const hasRootChildren = () => (props.state.result?.variablesReference ?? 0) > 0;

  // Value color for root
  const getRootValueColor = () => {
    const result = props.state.result;
    if (!result) return "var(--text-base)";

    const type = result.type?.toLowerCase() || "";
    const value = result.value;

    if (type.includes("string") || value.startsWith('"') || value.startsWith("'")) {
      return "var(--debug-token-expression-string)";
    }
    if (type.includes("number") || type.includes("int") || type.includes("float") || /^-?\d+\.?\d*$/.test(value)) {
      return "var(--debug-token-expression-number)";
    }
    if (value === "true" || value === "false" || type.includes("bool")) {
      return "var(--cortex-syntax-keyword)";
    }
    if (value === "null" || value === "undefined" || value === "None" || value === "nil") {
      return "var(--text-muted)";
    }
    return "var(--text-base)";
  };

  return (
    <Show when={props.state.visible && props.state.result}>
      <Portal>
        <div
          ref={containerRef}
          class="debug-hover-widget fixed z-[9999] rounded shadow-lg overflow-hidden"
          style={{
            left: `${position().x}px`,
            top: `${position().y}px`,
            "max-width": `${MAX_HOVER_WIDTH}px`,
            "max-height": `${MAX_HOVER_HEIGHT}px`,
            "min-width": "200px",
            background: "var(--surface-popup)",
            border: "1px solid var(--border-weak)",
            "font-family": "var(--monaco-monospace-font)",
            "font-size": FONT_SIZE,
          }}
          onMouseEnter={() => {
            if (closeTimeout) {
              clearTimeout(closeTimeout);
              closeTimeout = null;
            }
          }}
        >
          {/* Header with expression and actions */}
          <div
            class="flex items-center justify-between px-2 py-1 border-b"
            style={{
              background: "var(--surface-raised)",
              "border-color": "var(--border-weak)",
            }}
          >
            {/* Expression */}
            <div class="flex items-center gap-1.5 min-w-0 flex-1">
              <VariableTypeIcon type={props.state.result?.type} />
              <span
                class="font-semibold truncate"
                style={{ color: "var(--debug-token-expression-name)" }}
                title={props.state.expression}
              >
                {props.state.expression}
              </span>
              <Show when={props.state.result?.type}>
                <span
                  class="text-xs opacity-60 shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  ({props.state.result?.type})
                </span>
              </Show>
            </div>

            {/* Actions */}
            <div class="flex items-center gap-0.5 shrink-0 ml-2">
              {/* Copy Value */}
              <button
                class="w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-[var(--surface-hover)]"
                style={{
                  color: copied() === "value" ? "var(--status-success)" : "var(--text-weak)",
                }}
                onClick={() => copyToClipboard("value")}
                title="Copy Value"
              >
                <Icon name="copy" size="sm" />
              </button>

              {/* Add to Watch */}
              <Show when={props.onAddToWatch}>
                <button
                  class="w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ color: "var(--text-weak)" }}
                  onClick={handleAddToWatch}
                  title="Add to Watch"
                >
                  <Icon name="eye" size="sm" />
                </button>
              </Show>

              {/* Close */}
              <button
                class="w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: "var(--text-weak)" }}
                onClick={props.onClose}
                title="Close"
              >
                <Icon name="xmark" size="sm" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div
            class="overflow-auto"
            style={{
              "max-height": `${MAX_HOVER_HEIGHT - 40}px`,
            }}
          >
            {/* Loading state */}
            <Show when={props.state.loading}>
              <div
                class="flex items-center justify-center py-4 gap-2"
                style={{ color: "var(--text-weak)" }}
              >
                <div
                  class="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                  style={{
                    "border-color": "var(--text-weak)",
                    "border-top-color": "transparent",
                  }}
                />
                <span>Evaluating...</span>
              </div>
            </Show>

            {/* Error state */}
            <Show when={props.state.error}>
              <div
                class="px-3 py-2"
                style={{ color: "var(--status-error)" }}
              >
                {props.state.error}
              </div>
            </Show>

            {/* Result */}
            <Show when={props.state.result && !props.state.loading}>
              {/* Root value row */}
              <div
                class="flex items-center pr-2 cursor-pointer transition-colors hover:bg-[var(--surface-raised)]"
                style={{
                  "padding-left": "4px",
                  height: `${ROW_HEIGHT}px`,
                  "line-height": `${ROW_HEIGHT}px`,
                }}
                onClick={handleRootToggle}
              >
                {/* Expand icon */}
                <Show
                  when={hasRootChildren()}
                  fallback={<div class="w-4 shrink-0" />}
                >
                  <div
                    class="w-4 h-4 flex items-center justify-center shrink-0"
                    style={{ color: "var(--text-weak)" }}
                  >
                    <Show
                      when={!rootLoading()}
                      fallback={
                        <div
                          class="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin"
                          style={{
                            "border-color": "var(--text-weak)",
                            "border-top-color": "transparent",
                          }}
                        />
                      }
                    >
                      {isRootExpanded() ? (
                        <Icon name="chevron-down" size="sm" />
                      ) : (
                        <Icon name="chevron-right" size="sm" />
                      )}
                    </Show>
                  </div>
                </Show>

                {/* Value */}
                <span
                  class="truncate"
                  style={{
                    color: getRootValueColor(),
                    "max-width": `${MAX_HOVER_WIDTH - 50}px`,
                  }}
                  title={props.state.result?.value}
                >
                  {formatDebugValue(
                    props.state.result?.value || "",
                    props.state.result?.type
                  )}
                </span>
              </div>

              {/* Children tree */}
              <Show when={isRootExpanded() && rootLoaded()}>
                <For each={rootChildren()}>
                  {(child) => (
                    <TreeNode
                      variable={child}
                      path={buildTreePath(props.state.expression, child.name)}
                      depth={1}
                      expandedPaths={props.state.expandedPaths}
                      onToggleExpand={props.onToggleExpand}
                      onLoadChildren={props.onLoadChildren}
                    />
                  )}
                </For>
              </Show>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

// ============================================================================
// Hook: useDebugHover
// ============================================================================

/**
 * Hook for managing debug hover state
 * Provides state management and handlers for the DebugHoverWidget
 */
export function useDebugHover() {
  const debug = useDebug();
  const [state, setState] = createSignal<DebugHoverState>(createInitialHoverState());
  const debouncer = createHoverDebouncer(300);

  // Show hover at position
  const showHover = async (
    expression: string,
    position: { x: number; y: number },
    evaluateFn?: () => Promise<{ result: string; type?: string; variablesReference: number } | null>
  ) => {
    // Cancel any pending evaluation
    debouncer.cancel();

    // Set loading state
    setState((prev) => ({
      ...prev,
      visible: true,
      position,
      expression,
      loading: true,
      error: undefined,
      result: undefined,
      expandedPaths: new Set<string>(),
    }));

    // Evaluate expression
    debouncer.schedule(async () => {
      try {
        let result: { result: string; type?: string; variablesReference: number } | null = null;

        if (evaluateFn) {
          result = await evaluateFn();
        } else if (debug.state.isPaused && debug.state.activeSessionId) {
          const evalResult = await debug.evaluate(expression, "hover");
          result = evalResult;
        }

        if (result) {
          setState((prev) => ({
            ...prev,
            loading: false,
            result: {
              expression,
              value: result!.result,
              type: result!.type,
              variablesReference: result!.variablesReference,
            },
          }));
        } else {
          setState((prev) => ({
            ...prev,
            visible: false,
            loading: false,
          }));
        }
      } catch (e) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: e instanceof Error ? e.message : "Evaluation failed",
        }));
      }
    });
  };

  // Hide hover
  const hideHover = () => {
    debouncer.cancel();
    setState(createInitialHoverState());
  };

  // Toggle expand
  const toggleExpand = (path: string) => {
    setState((prev) => {
      const newExpanded = new Set(prev.expandedPaths);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return { ...prev, expandedPaths: newExpanded };
    });
  };

  // Load children
  const loadChildren = async (variablesReference: number, _path: string): Promise<Variable[]> => {
    if (!debug.state.activeSessionId || variablesReference <= 0) {
      return [];
    }
    return debug.expandVariable(variablesReference);
  };

  // Add to watch
  const addToWatch = (expression: string) => {
    debug.addWatchExpression(expression);
  };

  return {
    state,
    showHover,
    hideHover,
    toggleExpand,
    loadChildren,
    addToWatch,
  };
}

export default DebugHoverWidget;

