import { Component, createSignal, createMemo, For, Show, Switch, Match, JSX } from "solid-js";
import { CortexButton } from "./primitives/CortexButton";
import { CortexIcon } from "./primitives/CortexIcon";
import { CortexIconButton } from "./primitives/CortexIconButton";
import { CortexTooltip } from "./primitives/CortexTooltip";
import { CortexDropdown } from "./primitives/CortexDropdown";
import { useDebug, type Variable, type Breakpoint, type StackFrame, type WatchExpression } from "@/context/DebugContext";

const DebugSection: Component<{
  title: string; expanded: boolean; onToggle: () => void; actions?: JSX.Element; children: JSX.Element;
}> = (props) => (
  <div style={{ "border-bottom": "1px solid var(--cortex-border-default)" }}>
    <div onClick={props.onToggle} style={{ display: "flex", "align-items": "center", padding: "8px 12px", cursor: "pointer", "user-select": "none" }}>
      <CortexIcon name="chevron-right" size={12} style={{ transform: props.expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", "margin-right": "8px" }} color="var(--cortex-text-secondary)" />
      <span style={{ flex: "1", "font-size": "16px", color: "var(--cortex-text-on-surface)" }}>{props.title}</span>
      <Show when={props.actions}><div onClick={(e: MouseEvent) => e.stopPropagation()} style={{ display: "flex", gap: "2px" }}>{props.actions}</div></Show>
    </div>
    <Show when={props.expanded}><div style={{ "padding-bottom": "4px" }}>{props.children}</div></Show>
  </div>
);

const VariableRow: Component<{
  v: Variable; depth: number; expanded: Set<string>; onToggle: (key: string, ref: number) => void; children_: Record<string, Variable[]>;
}> = (props) => {
  const key = () => `${props.depth}-${props.v.name}`;
  const hasChildren = () => props.v.variablesReference > 0;
  const isExpanded = () => props.expanded.has(key());
  const childVars = () => props.children_[key()] || [];
  const valueColor = () => props.v.type === "string" ? "var(--cortex-success)" : props.v.type === "number" ? "var(--cortex-info)" : "var(--cortex-text-on-surface)";
  return (
    <>
      <div onClick={() => hasChildren() && props.onToggle(key(), props.v.variablesReference)} class="dbg-row" style={{ display: "flex", "align-items": "center", padding: `4px 12px 4px ${12 + props.depth * 16}px`, cursor: hasChildren() ? "pointer" : "default", "font-family": "var(--cortex-font-mono)", "font-size": "14px" }}>
        <Show when={hasChildren()} fallback={<span style={{ width: "16px" }} />}>
          <CortexIcon name="chevron-right" size={12} style={{ transform: isExpanded() ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", "margin-right": "4px" }} color="var(--cortex-text-secondary)" />
        </Show>
        <span style={{ color: "var(--cortex-accent-purple)" }}>{props.v.name}</span>
        <span style={{ color: "var(--cortex-text-inactive)", margin: "0 4px" }}>:</span>
        <span style={{ color: valueColor(), flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>{props.v.value}</span>
        <Show when={props.v.type}><span style={{ color: "var(--cortex-text-inactive)", "margin-left": "8px", "font-size": "12px" }}>{props.v.type}</span></Show>
      </div>
      <Show when={isExpanded()}>
        <For each={childVars()}>{(child) => <VariableRow v={child} depth={props.depth + 1} expanded={props.expanded} onToggle={props.onToggle} children_={props.children_} />}</For>
      </Show>
    </>
  );
};

export const CortexDebugPanel: Component = () => {
  let debug: ReturnType<typeof useDebug> | null = null;
  try { debug = useDebug(); } catch { /* context not available */ }

  const [expandedSections, setExpandedSections] = createSignal<Set<string>>(new Set(["variables", "watch", "callstack", "breakpoints"]));
  const [expandedVars, setExpandedVars] = createSignal<Set<string>>(new Set());
  const [varChildren, setVarChildren] = createSignal<Record<string, Variable[]>>({});
  const [selectedConfig, setSelectedConfig] = createSignal("");
  const [newWatchExpr, setNewWatchExpr] = createSignal("");

  const isDebugging = () => debug?.state.isDebugging ?? false;
  const isPaused = () => debug?.state.isPaused ?? false;
  const savedConfigs = () => debug?.getSavedConfigurations() ?? [];
  const hasConfigs = createMemo(() => savedConfigs().length > 0);
  const allBreakpoints = createMemo(() => debug?.getAllBreakpointsFlat() ?? []);
  const configOptions = createMemo(() => savedConfigs().map((c) => ({ value: c.name, label: c.name })));

  const toggleSection = (s: string) => setExpandedSections((prev) => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n; });

  const toggleVar = async (key: string, ref: number) => {
    setExpandedVars((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
    if (!expandedVars().has(key) || varChildren()[key]) return;
    try {
      const children = await debug?.expandVariable(ref);
      if (children) setVarChildren((prev) => ({ ...prev, [key]: children }));
    } catch { /* expand failed */ }
  };

  const startSelected = async () => {
    const name = selectedConfig();
    const config = savedConfigs().find((c) => c.name === name);
    if (config && debug) await debug.startSession(config);
  };

  const addWatch = () => {
    const expr = newWatchExpr().trim();
    if (expr && debug) { debug.addWatchExpression(expr); setNewWatchExpr(""); }
  };

  const stateKey = createMemo(() => {
    if (isDebugging()) return "debugging";
    if (hasConfigs()) return "configured";
    return "empty";
  });

  const ControlBar: Component = () => (
    <div style={{ display: "flex", "align-items": "center", gap: "4px", padding: "8px 12px", "border-bottom": "1px solid var(--cortex-border-default)" }}>
      <Show when={isPaused()} fallback={
        <CortexTooltip content="Pause"><CortexIconButton icon="pause" size={28} onClick={() => debug?.pause()} style={{ color: "var(--cortex-warning)" }} /></CortexTooltip>
      }>
        <CortexTooltip content="Continue"><CortexIconButton icon="play" size={28} onClick={() => debug?.continue_()} style={{ color: "var(--cortex-success)" }} /></CortexTooltip>
      </Show>
      <CortexTooltip content="Step Over"><CortexIconButton icon="forward-step" size={28} onClick={() => debug?.stepOver()} /></CortexTooltip>
      <CortexTooltip content="Step Into"><CortexIconButton icon="arrow-down" size={28} onClick={() => debug?.stepInto()} /></CortexTooltip>
      <CortexTooltip content="Step Out"><CortexIconButton icon="arrow-up" size={28} onClick={() => debug?.stepOut()} /></CortexTooltip>
      <CortexTooltip content="Restart"><CortexIconButton icon="arrows-rotate" size={28} onClick={() => debug?.restartSession()} /></CortexTooltip>
      <CortexTooltip content="Stop"><CortexIconButton icon="stop" size={28} onClick={() => debug?.stopSession()} style={{ color: "var(--cortex-pause-color)" }} /></CortexTooltip>
    </div>
  );

  const VariablesContent: Component = () => (
    <Show when={isPaused()} fallback={<div style={{ padding: "8px 12px", color: "var(--cortex-text-inactive)", "font-size": "14px" }}>{isDebugging() ? "Running..." : "Not paused"}</div>}>
      <For each={debug?.state.variables ?? []}>{(v) => <VariableRow v={v} depth={0} expanded={expandedVars()} onToggle={toggleVar} children_={varChildren()} />}</For>
    </Show>
  );

  const WatchContent: Component = () => (
    <>
      <div style={{ display: "flex", padding: "4px 12px", gap: "4px" }}>
        <input value={newWatchExpr()} onInput={(e) => setNewWatchExpr(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && addWatch()} placeholder="Add expression..." style={{ flex: "1", background: "var(--cortex-bg-secondary)", border: "1px solid var(--cortex-border-default)", "border-radius": "8px", padding: "6px 10px", color: "var(--cortex-text-on-surface)", "font-size": "14px", outline: "none", "font-family": "var(--cortex-font-mono)" }} />
      </div>
      <For each={debug?.state.watchExpressions ?? []}>
        {(w: WatchExpression) => (
          <div class="dbg-row" style={{ display: "flex", "align-items": "center", padding: "4px 12px 4px 28px", "font-family": "var(--cortex-font-mono)", "font-size": "14px", gap: "4px" }}>
            <span style={{ color: "var(--cortex-accent-purple)", "min-width": "0", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>{w.expression}</span>
            <span style={{ color: "var(--cortex-text-inactive)", margin: "0 4px" }}>=</span>
            <span style={{ flex: "1", color: w.error ? "var(--cortex-pause-color)" : "var(--cortex-text-on-surface)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>{w.error ?? w.result ?? "..."}</span>
            <CortexIconButton icon="x-close" size={16} onClick={() => debug?.removeWatchExpression(w.id)} />
          </div>
        )}
      </For>
    </>
  );

  const CallStackContent: Component = () => (
    <Show when={isPaused()} fallback={<div style={{ padding: "8px 12px", color: "var(--cortex-text-inactive)", "font-size": "14px" }}>{isDebugging() ? "Running..." : "Not paused"}</div>}>
      <For each={debug?.state.stackFrames ?? []}>
        {(frame: StackFrame) => (
          <div class="dbg-row" onClick={() => debug?.selectFrame(frame.id)} style={{ display: "flex", "align-items": "center", padding: "4px 12px 4px 28px", cursor: "pointer", background: frame.id === debug?.state.activeFrameId ? "rgba(178,255,34,0.1)" : "transparent" }}>
            <span style={{ flex: "1", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", "font-size": "14px", color: "var(--cortex-text-on-surface)" }}>{frame.name}</span>
            <span style={{ color: "var(--cortex-text-inactive)", "font-size": "12px" }}>{frame.source?.name ?? "unknown"}:{frame.line}</span>
          </div>
        )}
      </For>
    </Show>
  );

  const BreakpointsContent: Component = () => (
    <>
      <For each={allBreakpoints()}>
        {(bp: Breakpoint) => {
          const fileName = () => (bp.path ?? "").split("/").pop() ?? bp.path;
          return (
            <div class="bp-row" style={{ display: "flex", "align-items": "center", padding: "4px 12px 4px 28px", gap: "8px", opacity: bp.enabled ? 1 : 0.5 }}>
              <input type="checkbox" checked={bp.enabled} onChange={() => debug?.enableBreakpoint(bp.path, bp.line, !bp.enabled, bp.column)} style={{ "accent-color": "var(--cortex-accent-primary)" }} />
              <CortexIcon name="circle" size={10} color={bp.enabled ? "var(--cortex-pause-color)" : "var(--cortex-text-inactive)"} />
              <span style={{ flex: "1", "font-size": "14px", color: "var(--cortex-text-on-surface)" }}>
                {fileName()}:{bp.line}
                <Show when={bp.condition}><span style={{ color: "var(--cortex-warning)", "margin-left": "8px", "font-size": "12px" }}>{bp.condition}</span></Show>
              </span>
              <button class="bp-remove" onClick={() => debug?.removeBreakpoint(bp.path, bp.line, bp.column)} style={{ background: "transparent", border: "none", color: "var(--cortex-text-inactive)", cursor: "pointer", padding: "2px", opacity: 0 }}>
                <CortexIcon name="x-close" size={14} />
              </button>
            </div>
          );
        }}
      </For>
      <Show when={allBreakpoints().length === 0}><div style={{ padding: "8px 12px", color: "var(--cortex-text-inactive)", "font-size": "14px" }}>No breakpoints</div></Show>
    </>
  );

  const Sections: Component = () => (
    <div style={{ flex: 1, overflow: "auto" }}>
      <DebugSection title="Variables" expanded={expandedSections().has("variables")} onToggle={() => toggleSection("variables")}><VariablesContent /></DebugSection>
      <DebugSection title="Watch" expanded={expandedSections().has("watch")} onToggle={() => toggleSection("watch")}
        actions={<CortexIconButton icon="arrows-rotate" size={16} onClick={() => debug?.refreshWatches()} />}>
        <WatchContent />
      </DebugSection>
      <DebugSection title="Call Stack" expanded={expandedSections().has("callstack")} onToggle={() => toggleSection("callstack")}><CallStackContent /></DebugSection>
      <DebugSection title="Breakpoints" expanded={expandedSections().has("breakpoints")} onToggle={() => toggleSection("breakpoints")}
        actions={<CortexIconButton icon="trash-03" size={16} onClick={() => debug?.removeAllBreakpoints()} />}>
        <BreakpointsContent />
      </DebugSection>
    </div>
  );

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%", background: "var(--cortex-bg-primary)", color: "var(--cortex-text-on-surface)", "font-family": "var(--cortex-font-sans)", "font-size": "14px" }}>
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", padding: "12px 12px", "border-bottom": "1px solid var(--cortex-border-default)" }}>
        <span style={{ "font-size": "16px", "font-weight": "500" }}>Run and Debug</span>
      </div>
      <Switch>
        <Match when={stateKey() === "empty"}>
          <div style={{ flex: 1, display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", gap: "16px", padding: "32px" }}>
            <CortexIcon name="play" size={48} color="var(--cortex-text-inactive)" />
            <span style={{ "font-size": "16px", "font-weight": "500" }}>Run and Debug</span>
            <span style={{ "text-align": "center", color: "var(--cortex-text-inactive)", "font-size": "14px" }}>
              To customize Run and Debug,{" "}
              <a onClick={() => window.dispatchEvent(new CustomEvent("editor:create-launch-json"))} style={{ color: "var(--cortex-accent-primary)", cursor: "pointer", "text-decoration": "none" }}>create a launch.json</a> file.
            </span>
            <CortexButton variant="primary" icon="play" onClick={() => window.dispatchEvent(new CustomEvent("debug:quick-start"))}>Run and Debug</CortexButton>
          </div>
        </Match>
        <Match when={stateKey() === "configured"}>
          <div style={{ display: "flex", "align-items": "center", gap: "8px", padding: "8px 12px", "border-bottom": "1px solid var(--cortex-border-default)" }}>
            <CortexDropdown options={configOptions()} value={selectedConfig()} onChange={setSelectedConfig} placeholder="Select configuration" fullWidth style={{ flex: "1" }} />
            <CortexTooltip content="Start Debugging">
              <CortexIconButton icon="play" size={28} onClick={startSelected} style={{ color: "var(--cortex-success)" }} disabled={!selectedConfig()} />
            </CortexTooltip>
          </div>
          <Sections />
        </Match>
        <Match when={stateKey() === "debugging"}>
          <ControlBar />
          <Sections />
        </Match>
      </Switch>
      <style>{`
        .dbg-row:hover { background: rgba(255,255,255,0.05); }
        .bp-row:hover { background: rgba(255,255,255,0.05); }
        .bp-row:hover .bp-remove { opacity: 1 !important; }
      `}</style>
    </div>
  );
};

export default CortexDebugPanel;
