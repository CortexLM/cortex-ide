import { Show, For, createSignal } from "solid-js";
import { useDebug, type Breakpoint, type ExceptionBreakpoint } from "@/context/DebugContext";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui";

interface GroupedBreakpoints {
  file: string;
  fileName: string;
  breakpoints: Breakpoint[];
}

function groupByFile(breakpoints: Record<string, Breakpoint[]>): GroupedBreakpoints[] {
  return Object.entries(breakpoints)
    .filter(([, bps]) => bps.length > 0)
    .map(([file, bps]) => ({
      file,
      fileName: file.split("/").pop() || file,
      breakpoints: bps,
    }))
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

function BreakpointRow(props: { bp: Breakpoint; onNavigate: (path: string, line: number) => void }) {
  const debug = useDebug();
  const [editing, setEditing] = createSignal<"condition" | "hitCount" | "logMessage" | null>(null);
  const [editValue, setEditValue] = createSignal("");

  const handleToggle = () => {
    debug.enableBreakpoint(props.bp.path, props.bp.line, !props.bp.enabled, props.bp.column);
  };

  const handleRemove = () => {
    debug.removeBreakpoint(props.bp.path, props.bp.line, props.bp.column);
  };

  const startEdit = (field: "condition" | "hitCount" | "logMessage") => {
    const current = field === "condition" ? props.bp.condition
      : field === "hitCount" ? props.bp.hitCondition
      : props.bp.logMessage;
    setEditValue(current || "");
    setEditing(field);
  };

  const commitEdit = () => {
    const field = editing();
    if (!field) return;
    const val = editValue().trim();
    if (field === "condition") {
      debug.setBreakpointCondition(props.bp.path, props.bp.line, val, props.bp.column);
    } else if (field === "hitCount") {
      debug.setBreakpointHitCondition(props.bp.path, props.bp.line, val, props.bp.column);
    } else if (field === "logMessage") {
      debug.setLogpointMessage(props.bp.path, props.bp.line, val);
    }
    setEditing(null);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") setEditing(null);
  };

  const iconColor = () => {
    if (!props.bp.enabled) return "var(--text-weak)";
    if (props.bp.logMessage || props.bp.isLogpoint) return "var(--cortex-info)";
    if (props.bp.condition || props.bp.hitCondition) return "var(--cortex-warning)";
    return "var(--debug-icon-breakpoint-foreground, #e51400)";
  };

  return (
    <div class="flex items-center gap-1 px-2 group hover:bg-[var(--surface-raised)]" style={{ height: "22px", "font-size": "12px" }}>
      <input
        type="checkbox"
        checked={props.bp.enabled}
        onChange={handleToggle}
        class="shrink-0"
        style={{ width: "14px", height: "14px", "accent-color": "var(--cortex-accent-primary)" }}
      />
      <svg width="14" height="14" viewBox="0 0 16 16" fill={iconColor()} class="shrink-0">
        <circle cx="8" cy="8" r="6" />
      </svg>
      <span
        class="truncate cursor-pointer"
        style={{ color: props.bp.verified ? "var(--text-base)" : "var(--text-weak)" }}
        onClick={() => props.onNavigate(props.bp.path, props.bp.line)}
      >
        Line {props.bp.line}
      </span>
      <Show when={props.bp.condition && !editing()}>
        <span
          class="truncate cursor-pointer"
          style={{ color: "var(--text-weak)", "margin-left": "4px", "font-style": "italic" }}
          onDblClick={() => startEdit("condition")}
          title={`Condition: ${props.bp.condition}`}
        >
          {props.bp.condition}
        </span>
      </Show>
      <Show when={props.bp.logMessage && !editing()}>
        <span
          class="truncate cursor-pointer"
          style={{ color: "var(--cortex-info)", "margin-left": "4px" }}
          onDblClick={() => startEdit("logMessage")}
          title={`Log: ${props.bp.logMessage}`}
        >
          📝 {props.bp.logMessage}
        </span>
      </Show>
      <Show when={editing()}>
        <input
          type="text"
          value={editValue()}
          onInput={(e) => setEditValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitEdit}
          autofocus
          class="flex-1 min-w-0"
          style={{
            background: "var(--cortex-bg-primary)",
            color: "var(--text-base)",
            border: "1px solid var(--cortex-accent-primary)",
            "border-radius": "2px",
            padding: "0 4px",
            "font-size": "11px",
            height: "18px",
            outline: "none",
          }}
          placeholder={editing() === "condition" ? "Condition..." : editing() === "hitCount" ? "Hit count..." : "Log message..."}
        />
      </Show>
      <div class="ml-auto shrink-0 opacity-0 group-hover:opacity-100 flex gap-0.5">
        <Show when={!props.bp.condition}>
          <IconButton size="sm" variant="ghost" onClick={() => startEdit("condition")} title="Add Condition">
            <Icon name="question" size={10} />
          </IconButton>
        </Show>
        <IconButton size="sm" variant="ghost" onClick={handleRemove} title="Remove Breakpoint">
          <Icon name="xmark" size={10} />
        </IconButton>
      </div>
    </div>
  );
}

function ExceptionBreakpointRow(props: { eb: ExceptionBreakpoint }) {
  const debug = useDebug();
  const [showCondition, setShowCondition] = createSignal(false);
  const [conditionValue, setConditionValue] = createSignal(props.eb.condition || "");

  const handleToggle = () => {
    debug.setExceptionBreakpoint(props.eb.filter, !props.eb.enabled, props.eb.condition);
  };

  const commitCondition = () => {
    debug.setExceptionBreakpointCondition(props.eb.filter, conditionValue().trim());
    setShowCondition(false);
  };

  return (
    <div>
      <div class="flex items-center gap-1 px-2 hover:bg-[var(--surface-raised)]" style={{ height: "22px", "font-size": "12px" }}>
        <input
          type="checkbox"
          checked={props.eb.enabled}
          onChange={handleToggle}
          style={{ width: "14px", height: "14px", "accent-color": "var(--cortex-accent-primary)" }}
        />
        <span class="truncate" style={{ color: "var(--text-base)" }}>{props.eb.label}</span>
        <Show when={props.eb.description}>
          <span class="truncate" style={{ color: "var(--text-weak)", "font-size": "11px", "margin-left": "4px" }}>
            {props.eb.description}
          </span>
        </Show>
        <Show when={props.eb.supportsCondition}>
          <IconButton size="sm" variant="ghost" class="ml-auto shrink-0" onClick={() => setShowCondition(!showCondition())} title="Edit Condition">
            <Icon name="pencil" size={10} />
          </IconButton>
        </Show>
      </div>
      <Show when={showCondition()}>
        <div class="px-4 py-1">
          <input
            type="text"
            value={conditionValue()}
            onInput={(e) => setConditionValue(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitCondition(); if (e.key === "Escape") setShowCondition(false); }}
            onBlur={commitCondition}
            autofocus
            placeholder={props.eb.conditionDescription || "Condition..."}
            style={{
              width: "100%",
              background: "var(--cortex-bg-primary)",
              color: "var(--text-base)",
              border: "1px solid var(--cortex-accent-primary)",
              "border-radius": "2px",
              padding: "2px 6px",
              "font-size": "11px",
              outline: "none",
            }}
          />
        </div>
      </Show>
    </div>
  );
}

export function BreakpointPanel() {
  const debug = useDebug();
  const [collapsedFiles, setCollapsedFiles] = createSignal<Set<string>>(new Set());

  const groups = () => groupByFile(debug.state.breakpoints);
  const exceptionBps = () => debug.state.exceptionBreakpoints;

  const toggleFile = (file: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file); else next.add(file);
      return next;
    });
  };

  const handleNavigate = (path: string, line: number) => {
    window.dispatchEvent(new CustomEvent("editor:goto", { detail: { path, line, column: 1, focus: true } }));
  };

  return (
    <div class="flex flex-col h-full" style={{ background: "var(--cortex-bg-primary)", color: "var(--text-base)" }}>
      <div class="flex items-center justify-between px-2 shrink-0" style={{ height: "28px", "border-bottom": "1px solid var(--surface-border)" }}>
        <span style={{ "font-size": "11px", "font-weight": "600", "text-transform": "uppercase" }}>Breakpoints</span>
        <div class="flex gap-0.5">
          <IconButton size="sm" variant="ghost" onClick={() => debug.removeAllBreakpoints()} title="Remove All Breakpoints">
            <Icon name="trash-can" size={12} />
          </IconButton>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto">
        <Show when={exceptionBps().length > 0}>
          <div style={{ "border-bottom": "1px solid var(--surface-border)" }}>
            <For each={exceptionBps()}>
              {(eb) => <ExceptionBreakpointRow eb={eb} />}
            </For>
          </div>
        </Show>
        <For each={groups()}>
          {(group) => (
            <div>
              <div
                class="flex items-center gap-1 px-2 cursor-pointer hover:bg-[var(--surface-raised)]"
                style={{ height: "22px", "font-size": "12px", "font-weight": "500" }}
                onClick={() => toggleFile(group.file)}
              >
                <span style={{ color: "var(--text-weak)", width: "12px", "text-align": "center" }}>
                  {collapsedFiles().has(group.file) ? "▸" : "▾"}
                </span>
                <Icon name="file" size={12} color="var(--text-weak)" />
                <span class="truncate">{group.fileName}</span>
                <span style={{ color: "var(--text-weak)", "margin-left": "auto", "font-size": "11px" }}>
                  {group.breakpoints.length}
                </span>
              </div>
              <Show when={!collapsedFiles().has(group.file)}>
                <For each={group.breakpoints}>
                  {(bp) => <BreakpointRow bp={bp} onNavigate={handleNavigate} />}
                </For>
              </Show>
            </div>
          )}
        </For>
        <Show when={groups().length === 0 && exceptionBps().length === 0}>
          <div class="flex items-center justify-center p-4" style={{ color: "var(--text-weak)", "font-size": "12px" }}>
            No breakpoints set
          </div>
        </Show>
      </div>
    </div>
  );
}
