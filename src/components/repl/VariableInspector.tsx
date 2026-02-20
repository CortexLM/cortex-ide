import { Show, For, createSignal, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { useREPL, type Variable, type TrackedVariable } from "@/context/REPLContext";

interface TreeNodeProps {
  variable: TrackedVariable;
  depth: number;
  onCopy: (variable: TrackedVariable) => void;
  onInspect: (variable: TrackedVariable) => void;
}

function TreeNode(props: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = createSignal(props.depth === 0);

  const hasChildren = () => {
    return props.variable.children && props.variable.children.length > 0;
  };

  const getIconName = () => {
    if (props.variable.isFunction) return "code";
    if (props.variable.isArray) return "list";
    if (props.variable.isObject) return "box";
    if (props.variable.valueType === "number" || props.variable.valueType.includes("int") || props.variable.valueType.includes("float")) return "hashtag";
    if (props.variable.valueType === "string") return "font";
    return "box";
  };

  const typeColor = () => {
    if (props.variable.isFunction) return "var(--cortex-info)";
    if (props.variable.isArray) return "var(--cortex-error)";
    if (props.variable.isObject) return "var(--cortex-warning)";
    if (props.variable.valueType === "string") return "var(--cortex-success)";
    if (props.variable.valueType === "number" || props.variable.valueType.includes("int") || props.variable.valueType.includes("float")) return "var(--cortex-info)";
    if (props.variable.valueType === "boolean") return "var(--cortex-info)";
    if (props.variable.valueType === "null" || props.variable.valueType === "undefined") return "var(--cortex-text-inactive)";
    return "var(--text-weak)";
  };

  const toggleExpand = (e: MouseEvent) => {
    e.stopPropagation();
    if (hasChildren()) {
      setIsExpanded(!isExpanded());
    }
  };

  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation();
    props.onCopy(props.variable);
  };

  const handleInspect = (e: MouseEvent) => {
    e.stopPropagation();
    props.onInspect(props.variable);
  };

  return (
    <div class="select-none">
      <div
        class="group flex items-center gap-1 px-2 py-1 hover:bg-[var(--surface-hover)] cursor-pointer rounded"
        style={{ "padding-left": `${props.depth * 16 + 8}px` }}
        onClick={toggleExpand}
      >
        {/* Expand/collapse icon */}
        <div class="w-4 h-4 flex items-center justify-center shrink-0">
          <Show when={hasChildren()}>
            <Show when={isExpanded()} fallback={
              <Icon name="chevron-right" class="w-3 h-3" style={{ color: "var(--text-weak)" }} />
            }>
              <Icon name="chevron-down" class="w-3 h-3" style={{ color: "var(--text-weak)" }} />
            </Show>
          </Show>
        </div>

        {/* Type icon */}
        <Icon name={getIconName()} class="w-3.5 h-3.5 shrink-0" style={{ color: typeColor() }} />

        {/* Name */}
        <span class="font-mono text-xs font-medium shrink-0" style={{ color: "var(--text-strong)" }}>
          {props.variable.name}
        </span>

        {/* Colon separator */}
        <span class="text-xs" style={{ color: "var(--text-muted)" }}>:</span>

        {/* Type badge */}
        <span
          class="text-[10px] px-1 py-0.5 rounded shrink-0"
          style={{ background: "var(--surface-raised)", color: typeColor() }}
        >
          {props.variable.valueType}
        </span>

        {/* Value preview (only if no children or collapsed) */}
        <Show when={!hasChildren() || !isExpanded()}>
          <span
            class="flex-1 truncate font-mono text-xs ml-1"
            style={{ color: "var(--text-weak)" }}
            title={props.variable.valueRepr}
          >
            {props.variable.valueRepr.length > 40
              ? props.variable.valueRepr.slice(0, 40) + "..."
              : props.variable.valueRepr}
          </span>
        </Show>

        {/* Action buttons (visible on hover) */}
        <div class="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            class="p-1 rounded hover:bg-[var(--surface-raised)]"
            title="Copy value"
          >
            <Icon name="copy" class="w-3 h-3" style={{ color: "var(--text-weak)" }} />
          </button>
          <button
            onClick={handleInspect}
            class="p-1 rounded hover:bg-[var(--surface-raised)]"
            title="Inspect in console"
          >
            <Icon name="eye" class="w-3 h-3" style={{ color: "var(--text-weak)" }} />
          </button>
        </div>
      </div>

      {/* Children */}
      <Show when={isExpanded() && hasChildren()}>
        <For each={props.variable.children}>
          {(child) => (
            <TreeNode
              variable={child}
              depth={props.depth + 1}
              onCopy={props.onCopy}
              onInspect={props.onInspect}
            />
          )}
        </For>
      </Show>
    </div>
  );
}

interface VariableRowProps {
  variable: Variable;
  onCopy: (variable: Variable) => void;
  onInspect: (variable: Variable) => void;
}

function VariableRow(props: VariableRowProps) {
  const [isExpanded, setIsExpanded] = createSignal(false);

  const getIconName = () => {
    if (props.variable.is_function) return "code";
    if (props.variable.is_module) return "box";
    if (props.variable.value_type.includes("int") || props.variable.value_type.includes("float")) return "hashtag";
    if (props.variable.value_type.includes("list") || props.variable.value_type.includes("dict")) return "list";
    return "box";
  };

  const typeColor = () => {
    if (props.variable.is_function) return "var(--cortex-info)";
    if (props.variable.is_module) return "var(--cortex-warning)";
    if (props.variable.value_type.includes("str")) return "var(--cortex-success)";
    if (props.variable.value_type.includes("int") || props.variable.value_type.includes("float")) return "var(--cortex-info)";
    if (props.variable.value_type.includes("list") || props.variable.value_type.includes("dict")) return "var(--cortex-error)";
    return "var(--text-weak)";
  };

  const canExpand = () => {
    return (
      props.variable.value_repr.length > 50 ||
      props.variable.value_type.includes("list") ||
      props.variable.value_type.includes("dict") ||
      props.variable.value_type.includes("object")
    );
  };

  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation();
    props.onCopy(props.variable);
  };

  const handleInspect = (e: MouseEvent) => {
    e.stopPropagation();
    props.onInspect(props.variable);
  };

  return (
    <div class="border-b" style={{ "border-color": "var(--border-base)" }}>
      <div
        class="group flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-hover)] cursor-pointer"
        onClick={() => canExpand() && setIsExpanded(!isExpanded())}
      >
        {/* Expand icon */}
        <Show when={canExpand()}>
          <Show
            when={isExpanded()}
            fallback={<Icon name="chevron-right" class="w-3 h-3 shrink-0" style={{ color: "var(--text-weak)" }} />}
          >
            <Icon name="chevron-down" class="w-3 h-3 shrink-0" style={{ color: "var(--text-weak)" }} />
          </Show>
        </Show>
        <Show when={!canExpand()}>
          <div class="w-3 h-3 shrink-0" />
        </Show>

        <Icon name={getIconName()} class="w-4 h-4 shrink-0" style={{ color: typeColor() }} />

        <span class="font-mono text-sm font-medium" style={{ color: "var(--text-strong)" }}>
          {props.variable.name}
        </span>

        <span
          class="text-xs px-1.5 py-0.5 rounded"
          style={{ background: "var(--surface-raised)", color: typeColor() }}
        >
          {props.variable.value_type}
        </span>

        <Show when={!isExpanded()}>
          <span class="flex-1 truncate font-mono text-xs" style={{ color: "var(--text-weak)" }}>
            {props.variable.value_repr.length > 50
              ? props.variable.value_repr.slice(0, 50) + "..."
              : props.variable.value_repr}
          </span>
        </Show>

        {/* Action buttons */}
        <div class="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            class="p-1 rounded hover:bg-[var(--surface-raised)]"
            title="Copy value"
          >
            <Icon name="copy" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
          </button>
          <button
            onClick={handleInspect}
            class="p-1 rounded hover:bg-[var(--surface-raised)]"
            title="Inspect in console"
          >
            <Icon name="eye" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
          </button>
        </div>
      </div>

      <Show when={isExpanded()}>
        <div
          class="px-3 py-2 font-mono text-xs"
          style={{
            background: "var(--surface-sunken)",
            color: "var(--text-base)",
            "white-space": "pre-wrap",
            "word-break": "break-all",
          }}
        >
          {props.variable.value_repr}
        </div>
      </Show>
    </div>
  );
}

type ViewMode = "kernel" | "tracked" | "all";

export function VariableInspector() {
  const { state, clearVariables, copyVariableToClipboard, inspectVariable } = useREPL();
  const [filter, setFilter] = createSignal("");
  const [viewMode, setViewMode] = createSignal<ViewMode>("all");
  const [copyFeedback, setCopyFeedback] = createSignal<string | null>(null);

  const filteredKernelVariables = createMemo(() => {
    const search = filter().toLowerCase();
    if (!search) return state.variables;
    return state.variables.filter(
      (v) => v.name.toLowerCase().includes(search) || v.value_type.toLowerCase().includes(search)
    );
  });

  const filteredTrackedVariables = createMemo(() => {
    const search = filter().toLowerCase();
    if (!search) return state.trackedVariables;
    return state.trackedVariables.filter(
      (v) => v.name.toLowerCase().includes(search) || v.valueType.toLowerCase().includes(search)
    );
  });

  const totalVariableCount = () => state.variables.length + state.trackedVariables.length;
  const filteredCount = () => filteredKernelVariables().length + filteredTrackedVariables().length;

  const handleCopyVariable = async (variable: Variable | TrackedVariable) => {
    await copyVariableToClipboard(variable);
    setCopyFeedback(variable.name);
    setTimeout(() => setCopyFeedback(null), 1500);
  };

  const handleCopyTracked = async (variable: TrackedVariable) => {
    await copyVariableToClipboard(variable);
    setCopyFeedback(variable.name);
    setTimeout(() => setCopyFeedback(null), 1500);
  };

  const handleInspectVariable = (variable: Variable | TrackedVariable) => {
    inspectVariable(variable);
  };

  const handleClearAll = () => {
    clearVariables();
  };

  const showKernelVars = () => viewMode() === "kernel" || viewMode() === "all";
  const showTrackedVars = () => viewMode() === "tracked" || viewMode() === "all";

  return (
    <div
      class="w-80 shrink-0 flex flex-col overflow-hidden"
      style={{
        "border-left": "1px solid var(--border-base)",
        background: "var(--surface-base)",
      }}
    >
      {/* Header */}
      <div class="px-3 py-2 shrink-0" style={{ "border-bottom": "1px solid var(--border-base)" }}>
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
            Variables
          </h3>
          <button
            onClick={handleClearAll}
            disabled={totalVariableCount() === 0}
            class="p-1 rounded hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear all variables"
          >
            <Icon name="trash" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          </button>
        </div>

        {/* View mode tabs */}
        <div class="flex gap-1 mb-2">
          <button
            onClick={() => setViewMode("all")}
            class="flex-1 text-xs py-1 px-2 rounded transition-colors"
            style={{
              background: viewMode() === "all" ? "var(--surface-raised)" : "transparent",
              color: viewMode() === "all" ? "var(--text-strong)" : "var(--text-weak)",
            }}
          >
            All
          </button>
          <button
            onClick={() => setViewMode("kernel")}
            class="flex-1 text-xs py-1 px-2 rounded transition-colors"
            style={{
              background: viewMode() === "kernel" ? "var(--surface-raised)" : "transparent",
              color: viewMode() === "kernel" ? "var(--text-strong)" : "var(--text-weak)",
            }}
          >
            Kernel ({state.variables.length})
          </button>
          <button
            onClick={() => setViewMode("tracked")}
            class="flex-1 text-xs py-1 px-2 rounded transition-colors"
            style={{
              background: viewMode() === "tracked" ? "var(--surface-raised)" : "transparent",
              color: viewMode() === "tracked" ? "var(--text-strong)" : "var(--text-weak)",
            }}
          >
            Local ({state.trackedVariables.length})
          </button>
        </div>

        {/* Filter input */}
        <input
          type="text"
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
          placeholder="Filter variables..."
          class="w-full px-2 py-1 text-sm rounded outline-none"
          style={{
            background: "var(--surface-sunken)",
            border: "1px solid var(--border-base)",
            color: "var(--text-base)",
          }}
        />
      </div>

      {/* Copy feedback toast */}
      <Show when={copyFeedback()}>
        <div
          class="mx-3 mt-2 px-2 py-1 text-xs rounded text-center"
          style={{ background: "var(--cortex-success)20", color: "var(--cortex-success)" }}
        >
          Copied "{copyFeedback()}" to clipboard
        </div>
      </Show>

      {/* Variables list */}
      <div class="flex-1 overflow-auto">
        <Show
          when={filteredCount() > 0}
          fallback={
            <div class="flex flex-col items-center justify-center h-full p-4 text-center">
              <Icon name="box" class="w-8 h-8 mb-2" style={{ color: "var(--text-muted)" }} />
              <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                <Show when={totalVariableCount() === 0} fallback="No matching variables">
                  No variables yet
                </Show>
              </p>
              <p class="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                <Show when={totalVariableCount() === 0}>Execute code to see variables</Show>
              </p>
            </div>
          }
        >
          {/* Kernel variables section */}
          <Show when={showKernelVars() && filteredKernelVariables().length > 0}>
            <Show when={viewMode() === "all"}>
              <div
                class="px-3 py-1.5 text-xs font-medium sticky top-0"
                style={{
                  background: "var(--surface-base)",
                  color: "var(--text-muted)",
                  "border-bottom": "1px solid var(--border-base)",
                }}
              >
                Kernel Variables
              </div>
            </Show>
            <For each={filteredKernelVariables()}>
              {(variable) => (
                <VariableRow
                  variable={variable}
                  onCopy={handleCopyVariable}
                  onInspect={handleInspectVariable}
                />
              )}
            </For>
          </Show>

          {/* Tracked variables section */}
          <Show when={showTrackedVars() && filteredTrackedVariables().length > 0}>
            <Show when={viewMode() === "all"}>
              <div
                class="px-3 py-1.5 text-xs font-medium sticky top-0"
                style={{
                  background: "var(--surface-base)",
                  color: "var(--text-muted)",
                  "border-bottom": "1px solid var(--border-base)",
                }}
              >
                Locally Tracked Variables
              </div>
            </Show>
            <div class="py-1">
              <For each={filteredTrackedVariables()}>
                {(variable) => (
                  <TreeNode
                    variable={variable}
                    depth={0}
                    onCopy={handleCopyTracked}
                    onInspect={handleInspectVariable}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>

      {/* Footer with count */}
      <div
        class="px-3 py-2 text-xs shrink-0 flex items-center justify-between"
        style={{
          "border-top": "1px solid var(--border-base)",
          color: "var(--text-muted)",
        }}
      >
        <span>
          {totalVariableCount()} variable{totalVariableCount() !== 1 ? "s" : ""}
          <Show when={filter()}>
            {" "}
            ({filteredCount()} shown)
          </Show>
        </span>
        <span class="text-[10px]" style={{ color: "var(--text-muted)" }}>
          Max: 50 tracked
        </span>
      </div>
    </div>
  );
}

