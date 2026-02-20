import { Show, For, createSignal } from "solid-js";
import { useDebug, WatchExpression, Variable } from "@/context/DebugContext";
import { Icon } from "../ui/Icon";

const MAX_HISTORY = 20;

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
    } catch { setChildren([]); }
    finally { setLoading(false); }
  };

  return (
    <>
      <div
        class="flex items-center gap-1 px-2 text-xs hover:bg-[var(--surface-raised)] cursor-pointer"
        style={{ height: "20px", "padding-left": indent() }}
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
        <span class="shrink-0" style={{ color: "var(--cortex-syntax-variable)" }}>
          {props.variable.name}
        </span>
        <span style={{ color: "var(--text-weak)" }}>=</span>
        <span class="truncate" style={{ color: getVariableValueColor(props.variable) }}>
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

function getVariableValueColor(v: Variable): string {
  const type = v.type?.toLowerCase() || "";
  const value = v.value;
  if (type.includes("string") || value.startsWith('"') || value.startsWith("'"))
    return "var(--cortex-syntax-string)";
  if (type.includes("number") || /^-?\d+\.?\d*$/.test(value))
    return "var(--cortex-syntax-number)";
  if (value === "true" || value === "false")
    return "var(--cortex-syntax-keyword)";
  if (value === "null" || value === "undefined")
    return "var(--cortex-text-inactive)";
  return "var(--text-base)";
}

async function copyToClipboard(text: string) {
  try { await navigator.clipboard.writeText(text); } catch { /* silent */ }
}

export function WatchView() {
  const debug = useDebug();
  const [newExpression, setNewExpression] = createSignal("");
  const [isAdding, setIsAdding] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editingValue, setEditingValue] = createSignal("");
  const [expandedWatches, setExpandedWatches] = createSignal<Set<string>>(new Set());
  const [expressionHistory, setExpressionHistory] = createSignal<string[]>([]);
  const [showHistory, setShowHistory] = createSignal(false);

  const addToHistory = (expr: string) => {
    setExpressionHistory((prev) => {
      const filtered = prev.filter((e) => e !== expr);
      const updated = [expr, ...filtered];
      return updated.slice(0, MAX_HISTORY);
    });
  };

  const handleAddExpression = () => {
    const expr = newExpression().trim();
    if (!expr) return;
    addToHistory(expr);
    debug.addWatchExpression(expr);
    setNewExpression("");
    setIsAdding(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleAddExpression();
    else if (e.key === "Escape") { setIsAdding(false); setNewExpression(""); }
  };

  const handleRefreshAll = async () => { await debug.refreshWatches(); };

  const handleStartEdit = (watch: WatchExpression) => {
    setEditingId(watch.id);
    setEditingValue(watch.expression);
  };

  const handleSaveEdit = () => {
    const id = editingId();
    const newExpr = editingValue().trim();
    if (id && newExpr) {
      addToHistory(newExpr);
      debug.removeWatchExpression(id);
      debug.addWatchExpression(newExpr);
    }
    setEditingId(null);
    setEditingValue("");
  };

  const handleCancelEdit = () => { setEditingId(null); setEditingValue(""); };
  const handleEditKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleSaveEdit();
    else if (e.key === "Escape") handleCancelEdit();
  };

  const toggleWatchExpand = (id: string) => {
    setExpandedWatches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getValueColor = (watch: WatchExpression) => {
    if (watch.error) return "var(--cortex-error)";
    if (!watch.result) return "var(--text-weak)";
    const type = watch.type?.toLowerCase() || "";
    const value = watch.result;
    if (type.includes("string") || value.startsWith('"') || value.startsWith("'"))
      return "var(--cortex-syntax-string)";
    if (type.includes("number") || /^-?\d+\.?\d*$/.test(value))
      return "var(--cortex-syntax-number)";
    if (value === "true" || value === "false") return "var(--cortex-syntax-keyword)";
    if (value === "null" || value === "undefined") return "var(--cortex-text-inactive)";
    return "var(--text-base)";
  };

  const useHistoryItem = (expr: string) => {
    setNewExpression(expr);
    setShowHistory(false);
  };

  return (
    <div class="py-1">
      <div class="flex items-center justify-between px-2 pb-1">
        <div class="flex items-center gap-1">
          <Show when={debug.state.watchExpressions.length > 0}>
            <button onClick={handleRefreshAll} class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]" style={{ color: "var(--text-weak)" }} title="Refresh all">
              <Icon name="rotate" size="xs" />
            </button>
          </Show>
          <Show when={expressionHistory().length > 0}>
            <button onClick={() => setShowHistory(!showHistory())} class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]" style={{ color: showHistory() ? "var(--accent)" : "var(--text-weak)" }} title="Expression history">
              <Icon name="clock-rotate-left" size="xs" />
            </button>
          </Show>
        </div>
        <button onClick={() => setIsAdding(true)} class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]" style={{ color: "var(--text-weak)" }} title="Add expression">
          <Icon name="plus" size="xs" />
        </button>
      </div>

      <Show when={showHistory()}>
        <div class="mx-2 mb-1 rounded border overflow-hidden" style={{ "border-color": "var(--border-weak)", background: "var(--surface-sunken)" }}>
          <For each={expressionHistory()}>
            {(expr) => (
              <button onClick={() => useHistoryItem(expr)} class="w-full text-left px-2 py-0.5 text-xs font-mono truncate hover:bg-[var(--surface-raised)] transition-colors" style={{ color: "var(--text-base)" }}>
                {expr}
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={isAdding()}>
        <div class="px-2 pb-2">
          <input type="text" value={newExpression()} onInput={(e) => setNewExpression(e.currentTarget.value)} onKeyDown={handleKeyDown} onBlur={() => { if (!newExpression().trim()) setIsAdding(false); }} placeholder="Enter expression to watch" class="w-full px-2 py-1 text-xs rounded outline-none" style={{ background: "var(--surface-sunken)", color: "var(--text-base)", border: "1px solid var(--border-weak)" }} autofocus />
        </div>
      </Show>

      <Show when={debug.state.watchExpressions.length > 0} fallback={
        <Show when={!isAdding()}>
          <div class="text-xs text-center py-4" style={{ color: "var(--text-weak)" }}>
            No watch expressions.<br />
            <button onClick={() => setIsAdding(true)} class="underline hover:no-underline">Add expression</button>
          </div>
        </Show>
      }>
        <For each={debug.state.watchExpressions}>
          {(watch) => (
            <div>
              <div class="group flex items-center gap-1 px-2 text-xs transition-colors hover:bg-[var(--surface-raised)]" style={{ height: "22px" }}>
                <Show when={editingId() === watch.id} fallback={
                  <div class="flex-1 min-w-0 flex items-center gap-1 cursor-text" onDblClick={() => handleStartEdit(watch)}>
                    <span class="shrink-0" style={{ color: "var(--cortex-syntax-variable)" }}>{watch.expression}</span>
                    <span class="shrink-0" style={{ color: "var(--text-weak)" }}>=</span>
                    <span class="truncate" style={{ color: getValueColor(watch) }}>
                      <Show when={!watch.error} fallback={
                        <span class="flex items-center gap-1" style={{ color: "var(--cortex-error)" }}>
                          <Icon name="circle-exclamation" size="xs" class="shrink-0" />
                          <span class="truncate">{watch.error}</span>
                        </span>
                      }>
                        <Show when={watch.result !== undefined} fallback="<not evaluated>">
                          {watch.type && <span class="opacity-60">[{watch.type}] </span>}
                          {watch.result}
                        </Show>
                      </Show>
                    </span>
                  </div>
                }>
                  <input type="text" value={editingValue()} onInput={(e) => setEditingValue(e.currentTarget.value)} onKeyDown={handleEditKeyDown} onBlur={handleSaveEdit} class="flex-1 px-1 py-0 text-xs rounded outline-none" style={{ background: "var(--surface-sunken)", color: "var(--text-base)", border: "1px solid var(--accent)", height: "18px", "line-height": "18px" }} autofocus />
                </Show>

                <Show when={watch.result !== undefined && !watch.error}>
                  <button onClick={() => copyToClipboard(watch.result || "")} class="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded transition-opacity hover:bg-[var(--surface-raised)]" style={{ color: "var(--text-weak)" }} title="Copy value">
                    <Icon name="copy" size="xs" />
                  </button>
                  <button onClick={() => toggleWatchExpand(watch.id)} class="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded transition-opacity hover:bg-[var(--surface-raised)]" style={{ color: expandedWatches().has(watch.id) ? "var(--accent)" : "var(--text-weak)" }} title="Expand value">
                    <Icon name={expandedWatches().has(watch.id) ? "chevron-down" : "chevron-right"} size="xs" />
                  </button>
                </Show>

                <button onClick={() => debug.evaluateWatch(watch.id)} class="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded transition-opacity hover:bg-[var(--surface-raised)]" style={{ color: "var(--text-weak)" }} title="Refresh">
                  <Icon name="rotate" size="xs" />
                </button>
                <button onClick={() => debug.removeWatchExpression(watch.id)} class="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded transition-opacity hover:bg-[var(--surface-raised)]" style={{ color: "var(--text-weak)" }} title="Remove">
                  <Icon name="xmark" size="xs" />
                </button>
              </div>

              <Show when={expandedWatches().has(watch.id) && watch.result !== undefined && !watch.error}>
                <WatchValueTree expression={watch.expression} type={watch.type} />
              </Show>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}

function WatchValueTree(props: { expression: string; type?: string }) {
  const debug = useDebug();
  const [children, setChildren] = createSignal<Variable[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const loadChildren = async () => {
    try {
      const result = await debug.evaluate(props.expression, "watch");
      if (result.variablesReference > 0) {
        const vars = await debug.expandVariable(result.variablesReference);
        setChildren(vars);
      }
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  loadChildren();

  return (
    <div class="ml-4 border-l" style={{ "border-color": "var(--border-weak)" }}>
      <Show when={!loading()} fallback={
        <div class="px-2 py-1 text-xs" style={{ color: "var(--text-weak)" }}>Loading...</div>
      }>
        <Show when={!error()} fallback={
          <div class="px-2 py-1 text-xs" style={{ color: "var(--cortex-error)" }}>{error()}</div>
        }>
          <For each={children()} fallback={
            <div class="px-2 py-1 text-xs" style={{ color: "var(--text-weak)" }}>No properties</div>
          }>
            {(child) => <WatchVariableTree variable={child} depth={0} />}
          </For>
        </Show>
      </Show>
    </div>
  );
}
