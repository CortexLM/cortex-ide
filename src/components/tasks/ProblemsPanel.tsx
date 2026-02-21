import { Component, JSX, Show, For, createMemo, createSignal, onMount, onCleanup, createEffect } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

type TaskSeverity = "error" | "warning" | "info";

interface TaskDiagnosticPayload {
  taskId: string; file: string; line: number; column: number;
  severity: string; message: string; code: string | null; source: string;
}

interface TaskDiagnostic {
  id: string; taskId: string; file: string; line: number; column: number;
  severity: TaskSeverity; message: string; code: string | null; source: string;
}

export interface ProblemsPanelProps {
  class?: string;
  style?: JSX.CSSProperties;
}

const SEV_CFG: Record<TaskSeverity, { icon: string; color: string; label: string }> = {
  error: { icon: "circle-xmark", color: "var(--cortex-error)", label: "Error" },
  warning: { icon: "triangle-exclamation", color: "var(--cortex-warning)", label: "Warning" },
  info: { icon: "circle-info", color: "var(--cortex-info)", label: "Info" },
};
const SEV_ORDER: TaskSeverity[] = ["error", "warning", "info"];

function normSeverity(raw: string): TaskSeverity {
  const l = raw.toLowerCase();
  if (l === "error") return "error";
  if (l === "warning" || l === "warn") return "warning";
  return "info";
}

function shortPath(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/");
  return parts.slice(-2).join("/") || p;
}

function baseName(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || p;
}

export const ProblemsPanel: Component<ProblemsPanelProps> = (props) => {
  const [diagnostics, setDiagnostics] = createSignal<TaskDiagnostic[]>([]);
  const [collapsed, setCollapsed] = createSignal<Set<string>>(new Set());
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [sevFilter, setSevFilter] = createSignal<Set<TaskSeverity>>(new Set(SEV_ORDER));

  let unlisten: UnlistenFn | undefined;

  onMount(async () => {
    unlisten = await listen<TaskDiagnosticPayload>("task:diagnostic", (ev) => {
      const p = ev.payload;
      const id = `${p.taskId}:${p.file}:${p.line}:${p.column}:${p.message}`;
      const diag: TaskDiagnostic = {
        id, taskId: p.taskId, file: p.file, line: p.line, column: p.column,
        severity: normSeverity(p.severity), message: p.message, code: p.code, source: p.source,
      };
      setDiagnostics((prev) => (prev.some((d) => d.id === id) ? prev : [...prev, diag]));
    });

    try {
      const existing = await invoke<TaskDiagnosticPayload[]>("tasks_get_problems");
      for (const p of existing) {
        const id = `${p.taskId}:${p.file}:${p.line}:${p.column}:${p.message}`;
        const diag: TaskDiagnostic = {
          id, taskId: p.taskId, file: p.file, line: p.line, column: p.column,
          severity: normSeverity(p.severity), message: p.message, code: p.code, source: p.source,
        };
        setDiagnostics((prev) => (prev.some((d) => d.id === id) ? prev : [...prev, diag]));
      }
    } catch {
      // Backend may not be available yet
    }
  });

  onCleanup(() => { unlisten?.(); });

  const toggleSev = (sev: TaskSeverity) => {
    setSevFilter((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) { if (next.size > 1) next.delete(sev); }
      else next.add(sev);
      return next;
    });
  };

  const filtered = createMemo(() => diagnostics().filter((d) => sevFilter().has(d.severity)));

  const counts = createMemo(() => {
    const all = diagnostics();
    return {
      total: all.length,
      error: all.filter((d) => d.severity === "error").length,
      warning: all.filter((d) => d.severity === "warning").length,
      info: all.filter((d) => d.severity === "info").length,
    };
  });

  createEffect(() => {
    const c = counts();
    window.dispatchEvent(
      new CustomEvent("problems:status-update", {
        detail: { total: c.total, error: c.error, warning: c.warning, info: c.info },
      })
    );
  });

  const grouped = createMemo(() => {
    const m = new Map<string, TaskDiagnostic[]>();
    for (const d of filtered()) {
      const g = m.get(d.file);
      if (g) g.push(d); else m.set(d.file, [d]);
    }
    return m;
  });

  const fileKeys = createMemo(() =>
    Array.from(grouped().keys()).sort((a, b) =>
      (grouped().get(b)?.length ?? 0) - (grouped().get(a)?.length ?? 0)
    )
  );

  const toggleGroup = (k: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const navigateTo = (d: TaskDiagnostic) => {
    setSelectedId(d.id);
    window.dispatchEvent(new CustomEvent("editor:navigate-to-location", {
      detail: { uri: `file://${d.file.replace(/\\/g, "/")}`, line: d.line, column: d.column },
    }));
  };

  const clearAll = () => { setDiagnostics([]); setSelectedId(null); };

  const clearFile = (file: string) => {
    setDiagnostics((prev) => prev.filter((d) => d.file !== file));
    setSelectedId(null);
  };

  const ctrStyle = (): JSX.CSSProperties => ({
    display: "flex", "flex-direction": "column", height: "100%",
    background: "var(--cortex-bg-primary)", ...props.style,
  });

  const hdrStyle: JSX.CSSProperties = {
    display: "flex", "align-items": "center", "justify-content": "space-between",
    padding: "8px 12px", "border-bottom": "1px solid var(--cortex-border-default)", "flex-shrink": "0",
  };

  const titleStyle: JSX.CSSProperties = {
    display: "flex", "align-items": "center", gap: "8px",
    "font-size": "13px", "font-weight": "600", color: "var(--cortex-text-primary)",
  };

  const filterStyle: JSX.CSSProperties = {
    display: "flex", "align-items": "center", gap: "6px",
    padding: "4px 12px", "border-bottom": "1px solid var(--cortex-border-default)", "flex-shrink": "0",
  };

  const grpHdrStyle: JSX.CSSProperties = {
    display: "flex", "align-items": "center", gap: "6px", padding: "6px 12px",
    cursor: "pointer", background: "var(--cortex-bg-secondary)",
    "border-bottom": "1px solid var(--cortex-border-default)", position: "sticky", top: "0", "z-index": "1",
  };

  const emptyStyle: JSX.CSSProperties = {
    display: "flex", "flex-direction": "column", "align-items": "center",
    "justify-content": "center", height: "100%", gap: "12px", color: "var(--cortex-text-muted)",
  };

  const fbStyle = (on: boolean): JSX.CSSProperties => ({
    display: "inline-flex", "align-items": "center", gap: "4px", padding: "2px 8px",
    "border-radius": "var(--cortex-radius-full)", "font-size": "11px", cursor: "pointer", border: "none",
    background: on ? "var(--cortex-bg-active)" : "transparent",
    color: on ? "var(--cortex-text-primary)" : "var(--cortex-text-muted)",
  });

  const rowStyle = (sel: boolean, clr: string): JSX.CSSProperties => ({
    display: "flex", "align-items": "flex-start", gap: "8px", padding: "6px 12px",
    cursor: "pointer", background: sel ? "var(--cortex-bg-active)" : "transparent",
    "border-left": `2px solid ${sel ? clr : "transparent"}`,
    transition: "background var(--cortex-transition-fast)",
  });

  return (
    <div class={props.class} style={ctrStyle()}>
      <div style={hdrStyle}>
        <div style={titleStyle}>
          <Icon name="clipboard-list" size={16} />
          <span>Task Problems</span>
          <Show when={counts().total > 0}>
            <Badge variant={counts().error > 0 ? "error" : counts().warning > 0 ? "warning" : "muted"}>
              {filtered().length}
            </Badge>
          </Show>
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
          <IconButton icon={<Icon name="trash" size={14} />} tooltip="Clear All" onClick={clearAll} size="sm" />
        </div>
      </div>

      <div style={filterStyle}>
        <For each={SEV_ORDER}>
          {(sev) => (
            <button style={fbStyle(sevFilter().has(sev))} onClick={() => toggleSev(sev)} title={`Toggle ${SEV_CFG[sev].label}`}>
              <Icon name={SEV_CFG[sev].icon} size={12} style={{ color: SEV_CFG[sev].color }} />
              <span>{counts()[sev]}</span>
            </button>
          )}
        </For>
      </div>

      <div style={{ flex: "1", overflow: "auto" }} role="list" aria-label="Task problems list">
        <Show when={filtered().length > 0} fallback={
          <div style={emptyStyle}>
            <Icon name="circle-check" size={32} style={{ color: "var(--cortex-success)" }} />
            <span>No task problems</span>
          </div>
        }>
          <For each={fileKeys()}>
            {(fk) => {
              const items = () => grouped().get(fk) || [];
              const isColl = () => collapsed().has(fk);
              return (
                <div>
                  <div class="group" style={grpHdrStyle} onClick={() => toggleGroup(fk)} role="button" aria-expanded={!isColl()}>
                    <Icon name={isColl() ? "chevron-right" : "chevron-down"} size={10} style={{ color: "var(--cortex-text-muted)" }} />
                    <Icon name="file-code" size={14} style={{ color: "var(--cortex-text-muted)" }} />
                    <span style={{
                      flex: "1", "font-size": "12px", "font-weight": "500", color: "var(--cortex-text-primary)",
                      overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap",
                    }}>{shortPath(fk)}</span>
                    <Badge variant="muted" size="sm">{items().length}</Badge>
                    <button
                      class="ml-1 p-0.5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); clearFile(fk); }}
                      title={`Clear problems for ${fk}`}
                    >
                      <Icon name="xmark" size={10} style={{ color: "var(--cortex-text-muted)" }} />
                    </button>
                  </div>
                  <Show when={!isColl()}>
                    <For each={items()}>
                      {(diag) => {
                        const c = SEV_CFG[diag.severity];
                        const sel = () => selectedId() === diag.id;
                        return (
                          <div
                            style={rowStyle(sel(), c.color)}
                            onClick={() => navigateTo(diag)}
                            onMouseEnter={(e) => { if (!sel()) (e.currentTarget as HTMLElement).style.background = "var(--cortex-bg-hover)"; }}
                            onMouseLeave={(e) => { if (!sel()) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                            role="listitem" aria-selected={sel()} tabIndex={0}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigateTo(diag); } }}
                          >
                            <Icon name={c.icon} size={14} style={{ color: c.color, "flex-shrink": "0", "margin-top": "2px" }} aria-label={c.label} />
                            <div style={{ flex: "1", "min-width": "0" }}>
                              <div style={{ "font-size": "12px", color: "var(--cortex-text-primary)", "word-break": "break-word" }}>
                                {diag.message}
                              </div>
                              <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-top": "2px", "font-size": "11px", color: "var(--cortex-text-muted)" }}>
                                <span style={{ "font-family": "var(--cortex-font-mono)" }}>{baseName(diag.file)}</span>
                                <span style={{ "font-family": "var(--cortex-font-mono)" }}>[Ln {diag.line}:{diag.column}]</span>
                                <Show when={diag.code}><span>{diag.code}</span></Show>
                                <span>{diag.source}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>
      </div>
    </div>
  );
};

export default ProblemsPanel;
