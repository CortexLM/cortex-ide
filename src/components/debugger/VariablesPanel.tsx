import { Show, For, createSignal, createEffect } from "solid-js";
import { useDebug, type Variable, type Scope } from "@/context/DebugContext";
import { Icon } from "@/components/ui/Icon";
import { createLogger } from "@/utils/logger";

const variablesLogger = createLogger("Variables");

function getValueColor(variable: Variable): string {
  const type = variable.type?.toLowerCase() || "";
  const value = variable.value;
  if (type.includes("string") || value.startsWith('"') || value.startsWith("'"))
    return "var(--cortex-syntax-string)";
  if (type.includes("number") || type.includes("int") || type.includes("float") || /^-?\d+\.?\d*$/.test(value))
    return "var(--cortex-syntax-number)";
  if (value === "true" || value === "false" || type.includes("bool"))
    return "var(--cortex-syntax-keyword)";
  if (value === "null" || value === "undefined" || value === "nil" || value === "None")
    return "var(--cortex-text-inactive)";
  return "var(--text-base)";
}

function VariableTreeItem(props: { variable: Variable; depth: number; parentRef?: number }) {
  const debug = useDebug();
  const [expanded, setExpanded] = createSignal(false);
  const [children, setChildren] = createSignal<Variable[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal("");

  const hasChildren = () => props.variable.variablesReference > 0;
  const indent = () => `${(props.depth + 1) * 14}px`;

  const toggleExpand = async () => {
    if (!hasChildren()) return;
    if (expanded()) { setExpanded(false); return; }
    setLoading(true);
    try {
      const vars = await debug.expandVariable(props.variable.variablesReference);
      setChildren(vars);
      setExpanded(true);
    } catch (e) {
      variablesLogger.error("Failed to expand variable:", e);
      setChildren([]);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = () => {
    if (!debug.state.capabilities?.supportsSetVariable) return;
    setEditValue(props.variable.value);
    setEditing(true);
  };

  const commitEdit = async () => {
    const ref = props.parentRef ?? props.variable.variablesReference;
    if (!ref) { setEditing(false); return; }
    const val = editValue();
    if (val.length > 100_000) {
      variablesLogger.error("Value exceeds maximum length");
      setEditing(false);
      return;
    }
    try {
      await debug.setVariable(ref, props.variable.name, val);
    } catch (e) {
      variablesLogger.error("Failed to set variable:", e);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") setEditing(false);
  };

  const copyValue = async () => {
    try { await navigator.clipboard.writeText(props.variable.value); } catch (e) { variablesLogger.error("Clipboard write failed:", e); }
  };

  return (
    <>
      <div
        class="flex items-center gap-1 px-2 group hover:bg-[var(--surface-raised)]"
        style={{ height: "22px", "padding-left": indent(), "font-size": "12px", "font-family": "var(--monaco-monospace-font, monospace)" }}
        onClick={toggleExpand}
      >
        <Show when={hasChildren()}>
          <span class="w-3 shrink-0 text-center" style={{ color: "var(--text-weak)", cursor: "pointer" }}>
            <Show when={loading()} fallback={expanded() ? "▾" : "▸"}>
              <span class="animate-spin inline-block">⟳</span>
            </Show>
          </span>
        </Show>
        <Show when={!hasChildren()}>
          <span class="w-3 shrink-0" />
        </Show>
        <span class="shrink-0" style={{ color: "var(--cortex-syntax-variable, #9cdcfe)" }}>
          {props.variable.name}
        </span>
        <Show when={props.variable.type}>
          <span style={{ color: "var(--text-weak)", "font-size": "10px", "margin-left": "2px" }}>
            :{props.variable.type}
          </span>
        </Show>
        <span style={{ color: "var(--text-weak)", margin: "0 2px" }}>=</span>
        <Show when={!editing()}>
          <span
            class="truncate cursor-default"
            style={{ color: getValueColor(props.variable) }}
            onDblClick={(e) => { e.stopPropagation(); startEdit(); }}
            title={props.variable.value}
          >
            {props.variable.value}
          </span>
        </Show>
        <Show when={editing()}>
          <input
            type="text"
            value={editValue()}
            onInput={(e) => setEditValue(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => commitEdit()}
            autofocus
            maxLength={100_000}
            onClick={(e) => e.stopPropagation()}
            class="flex-1 min-w-0"
            style={{
              background: "var(--cortex-bg-primary)",
              color: "var(--text-base)",
              border: "1px solid var(--cortex-accent-primary)",
              "border-radius": "2px",
              padding: "0 4px",
              "font-size": "12px",
              "font-family": "var(--monaco-monospace-font, monospace)",
              height: "18px",
              outline: "none",
            }}
          />
        </Show>
        <div class="ml-auto shrink-0 opacity-0 group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); copyValue(); }}
            title="Copy Value"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", color: "var(--text-weak)" }}
          >
            <Icon name="copy" size={10} />
          </button>
        </div>
      </div>
      <Show when={expanded()}>
        <For each={children()}>
          {(child) => <VariableTreeItem variable={child} depth={props.depth + 1} parentRef={props.variable.variablesReference} />}
        </For>
      </Show>
    </>
  );
}

function ScopeSection(props: { scope: Scope }) {
  const debug = useDebug();
  const [expanded, setExpanded] = createSignal(!props.scope.expensive);
  const [variables, setVariables] = createSignal<Variable[]>([]);
  const [loaded, setLoaded] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  const loadVariables = async () => {
    if (loaded()) return;
    setLoading(true);
    try {
      const vars = await debug.getScopeVariables(props.scope.variablesReference);
      setVariables(vars);
      setLoaded(true);
    } catch (e) {
      variablesLogger.error("Failed to load scope variables:", e);
      setVariables([]);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (expanded() && !loaded()) {
      loadVariables();
    }
  });

  const toggle = () => {
    setExpanded(!expanded());
  };

  return (
    <div>
      <div
        class="flex items-center gap-1 px-2 cursor-pointer hover:bg-[var(--surface-raised)]"
        style={{ height: "24px", "font-size": "12px", "font-weight": "600" }}
        onClick={toggle}
      >
        <span style={{ color: "var(--text-weak)", width: "12px", "text-align": "center" }}>
          {expanded() ? "▾" : "▸"}
        </span>
        <span style={{ color: "var(--text-base)" }}>{props.scope.name}</span>
        <Show when={loading()}>
          <span class="animate-spin" style={{ color: "var(--text-weak)", "font-size": "10px" }}>⟳</span>
        </Show>
      </div>
      <Show when={expanded()}>
        <For each={variables()}>
          {(v) => <VariableTreeItem variable={v} depth={0} parentRef={props.scope.variablesReference} />}
        </For>
        <Show when={loaded() && variables().length === 0}>
          <div class="px-6 py-1" style={{ color: "var(--text-weak)", "font-size": "11px" }}>
            No variables
          </div>
        </Show>
      </Show>
    </div>
  );
}

export function VariablesPanel() {
  const debug = useDebug();
  const [scopes, setScopes] = createSignal<Scope[]>([]);

  createEffect(() => {
    if (debug.state.isPaused && debug.state.activeFrameId !== null) {
      debug.getScopes().then(setScopes).catch((e) => { variablesLogger.error("Failed to load scopes:", e); setScopes([]); });
    } else {
      setScopes([]);
    }
  });

  return (
    <div class="flex flex-col h-full" style={{ background: "var(--cortex-bg-primary)", color: "var(--text-base)" }}>
      <div class="flex items-center px-2 shrink-0" style={{ height: "28px", "border-bottom": "1px solid var(--surface-border)" }}>
        <span style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase" }}>Variables</span>
      </div>
      <div class="flex-1 overflow-y-auto">
        <Show when={debug.state.isPaused} fallback={
          <div class="flex items-center justify-center p-4" style={{ color: "var(--text-weak)", "font-size": "12px" }}>
            Not paused
          </div>
        }>
          <For each={scopes()}>
            {(scope) => <ScopeSection scope={scope} />}
          </For>
          <Show when={scopes().length === 0}>
            <div class="flex items-center justify-center p-4" style={{ color: "var(--text-weak)", "font-size": "12px" }}>
              No scopes available
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
