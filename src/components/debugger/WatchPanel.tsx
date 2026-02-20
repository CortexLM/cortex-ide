import { Show, For, createSignal } from "solid-js";
import { useDebug, type WatchExpression, type Variable } from "@/context/DebugContext";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui";
import { createLogger } from "@/utils/logger";

const watchLogger = createLogger("Watch");

const MAX_EXPRESSION_LENGTH = 10_000;

function getValueColor(value: string): string {
  if (value.startsWith('"') || value.startsWith("'")) return "var(--cortex-syntax-string)";
  if (/^-?\d+\.?\d*$/.test(value)) return "var(--cortex-syntax-number)";
  if (value === "true" || value === "false") return "var(--cortex-syntax-keyword)";
  if (value === "null" || value === "undefined") return "var(--cortex-text-inactive)";
  return "var(--text-base)";
}

function WatchVariableTree(props: { variable: Variable; depth: number }) {
  const debug = useDebug();
  const [expanded, setExpanded] = createSignal(false);
  const [children, setChildren] = createSignal<Variable[]>([]);
  const [loading, setLoading] = createSignal(false);

  const hasChildren = () => props.variable.variablesReference > 0;
  const indent = () => `${(props.depth + 1) * 12}px`;

  const toggleExpand = async () => {
    if (!hasChildren()) return;
    if (expanded()) { setExpanded(false); return; }
    setLoading(true);
    try {
      const vars = await debug.expandVariable(props.variable.variablesReference);
      setChildren(vars);
      setExpanded(true);
    } catch (e) {
      watchLogger.error("Failed to expand variable:", e);
      setChildren([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        class="flex items-center gap-1 px-2 hover:bg-[var(--surface-raised)] cursor-pointer"
        style={{ height: "20px", "padding-left": indent(), "font-size": "12px", "font-family": "var(--monaco-monospace-font, monospace)" }}
        onClick={toggleExpand}
      >
        <Show when={hasChildren()}>
          <span class="w-3 shrink-0 text-center" style={{ color: "var(--text-weak)" }}>
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
        <span style={{ color: "var(--text-weak)" }}>=</span>
        <span class="truncate" style={{ color: getValueColor(props.variable.value) }}>
          {props.variable.value}
        </span>
      </div>
      <Show when={expanded()}>
        <For each={children()}>
          {(child) => <WatchVariableTree variable={child} depth={props.depth + 1} />}
        </For>
      </Show>
    </>
  );
}

function WatchExpressionRow(props: { watch: WatchExpression }) {
  const debug = useDebug();
  const [editing, setEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal(props.watch.expression);
  const [expanded, setExpanded] = createSignal(false);
  const [resultChildren, setResultChildren] = createSignal<Variable[]>([]);

  const hasResult = () => props.watch.result !== undefined;
  const hasError = () => !!props.watch.error;

  const startEdit = () => {
    setEditValue(props.watch.expression);
    setEditing(true);
  };

  const commitEdit = () => {
    const val = editValue().trim();
    if (!val || val.length > MAX_EXPRESSION_LENGTH) {
      setEditing(false);
      return;
    }
    if (val !== props.watch.expression) {
      debug.updateWatchExpression(props.watch.id, val);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") setEditing(false);
  };

  const handleRemove = () => {
    debug.removeWatchExpression(props.watch.id);
  };

  const handleRefresh = () => {
    debug.evaluateWatch(props.watch.id);
  };

  const toggleExpand = async () => {
    if (expanded()) {
      setExpanded(false);
      return;
    }
    try {
      const result = await debug.evaluate(props.watch.expression, "watch");
      if (result.variablesReference > 0) {
        const vars = await debug.expandVariable(result.variablesReference);
        setResultChildren(vars);
      }
      setExpanded(true);
    } catch (e) {
      watchLogger.error("Failed to evaluate watch expression:", e);
      setExpanded(false);
    }
  };

  return (
    <div>
      <div
        class="flex items-center gap-1 px-2 group hover:bg-[var(--surface-raised)]"
        style={{ height: "22px", "font-size": "12px" }}
        onClick={() => { if (hasResult() && !hasError()) toggleExpand(); }}
      >
        <Show when={!editing()}>
          <span
            class="shrink-0 cursor-pointer"
            style={{ color: "var(--cortex-syntax-variable, #9cdcfe)", "font-family": "var(--monaco-monospace-font, monospace)" }}
            onDblClick={startEdit}
          >
            {props.watch.expression}
          </span>
          <Show when={hasResult() && !hasError()}>
            <span style={{ color: "var(--text-weak)", margin: "0 2px" }}>=</span>
            <span class="truncate" style={{ color: getValueColor(props.watch.result!), "font-family": "var(--monaco-monospace-font, monospace)" }}>
              {props.watch.result}
            </span>
          </Show>
          <Show when={hasError()}>
            <span style={{ color: "var(--text-weak)", margin: "0 2px" }}>=</span>
            <span class="truncate" style={{ color: "var(--cortex-error)", "font-style": "italic" }}>
              {props.watch.error}
            </span>
          </Show>
          <Show when={!hasResult() && !hasError()}>
            <span style={{ color: "var(--text-weak)", "font-style": "italic", "margin-left": "4px" }}>
              not available
            </span>
          </Show>
        </Show>
        <Show when={editing()}>
          <input
            type="text"
            value={editValue()}
            onInput={(e) => setEditValue(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitEdit}
            autofocus
            maxLength={MAX_EXPRESSION_LENGTH}
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
        <div class="ml-auto shrink-0 opacity-0 group-hover:opacity-100 flex gap-0.5">
          <IconButton size="sm" variant="ghost" onClick={handleRefresh} title="Refresh">
            <Icon name="arrows-rotate" size={10} />
          </IconButton>
          <IconButton size="sm" variant="ghost" onClick={handleRemove} title="Remove">
            <Icon name="xmark" size={10} />
          </IconButton>
        </div>
      </div>
      <Show when={expanded()}>
        <For each={resultChildren()}>
          {(child) => <WatchVariableTree variable={child} depth={1} />}
        </For>
      </Show>
    </div>
  );
}

export function WatchPanel() {
  const debug = useDebug();
  const [newExpression, setNewExpression] = createSignal("");

  const handleAdd = () => {
    const expr = newExpression().trim();
    if (!expr) return;
    if (expr.length > MAX_EXPRESSION_LENGTH) return;
    debug.addWatchExpression(expr);
    setNewExpression("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  return (
    <div class="flex flex-col h-full" style={{ background: "var(--cortex-bg-primary)", color: "var(--text-base)" }}>
      <div class="flex items-center justify-between px-2 shrink-0" style={{ height: "28px", "border-bottom": "1px solid var(--surface-border)" }}>
        <span style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase" }}>Watch</span>
        <div class="flex gap-0.5">
          <IconButton size="sm" variant="ghost" onClick={() => debug.refreshWatches()} title="Refresh All">
            <Icon name="arrows-rotate" size={12} />
          </IconButton>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto">
        <For each={debug.state.watchExpressions}>
          {(watch) => <WatchExpressionRow watch={watch} />}
        </For>
        <Show when={debug.state.watchExpressions.length === 0}>
          <div class="px-2 py-2" style={{ color: "var(--text-weak)", "font-size": "11px" }}>
            Add expressions to watch during debugging
          </div>
        </Show>
      </div>
      <div class="shrink-0 px-2 py-1" style={{ "border-top": "1px solid var(--surface-border)" }}>
        <div class="flex items-center gap-1">
          <input
            type="text"
            value={newExpression()}
            onInput={(e) => setNewExpression(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add expression..."
            maxLength={MAX_EXPRESSION_LENGTH}
            style={{
              flex: "1",
              background: "var(--cortex-bg-primary)",
              color: "var(--text-base)",
              border: "1px solid var(--surface-border)",
              "border-radius": "3px",
              padding: "2px 6px",
              "font-size": "12px",
              "font-family": "var(--monaco-monospace-font, monospace)",
              height: "22px",
              outline: "none",
            }}
          />
          <IconButton size="sm" variant="ghost" onClick={handleAdd} title="Add Watch Expression">
            <Icon name="plus" size={12} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
