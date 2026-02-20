import { Component, createSignal, createMemo, For, Show, onMount, JSX } from "solid-js";
import { CortexButton } from "./primitives/CortexButton";
import { CortexIcon } from "./primitives/CortexIcon";
import { useMultiRepo, type GitFile } from "@/context/MultiRepoContext";
import { gitLog, type GitCommit } from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";

const STATUS_MAP: Record<string, { letter: string; color: string }> = {
  modified: { letter: "M", color: "var(--cortex-warning)" },
  added: { letter: "A", color: "var(--cortex-success)" },
  deleted: { letter: "D", color: "var(--cortex-error)" },
  renamed: { letter: "R", color: "var(--cortex-info)" },
  conflict: { letter: "U", color: "var(--cortex-warning)" },
  untracked: { letter: "?", color: "var(--cortex-text-inactive)" },
};

const PANEL: JSX.CSSProperties = {
  display: "flex", "flex-direction": "column", height: "100%",
  background: "var(--cortex-bg-secondary)", color: "var(--cortex-text-primary)",
  "font-family": "var(--cortex-font-sans)", "font-size": "13px",
};

const relDate = (d: string): string => {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
};

const getStatus = (f: GitFile) => STATUS_MAP[f.status] ?? { letter: "?", color: "var(--cortex-text-inactive)" };
const fname = (p: string) => p.split("/").pop() ?? p;
const dpath = (p: string) => { const s = p.split("/"); return s.length > 1 ? s.slice(0, -1).join("/") : ""; };

const FileSection: Component<{
  title: string; files: GitFile[]; expanded: boolean;
  onToggle: () => void; actions?: JSX.Element;
}> = (props) => (
  <div style={{ "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
    <div onClick={props.onToggle} style={{ display: "flex", "align-items": "center", padding: "8px 16px", cursor: "pointer", "user-select": "none" }}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="var(--cortex-text-inactive)" style={{ transform: props.expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", "margin-right": "8px" }}>
        <path d="M6 4l4 4-4 4V4z"/>
      </svg>
      <span style={{ flex: 1, "font-size": "12px", "text-transform": "uppercase", color: "var(--cortex-text-inactive)" }}>{props.title}</span>
      <Show when={props.files.length > 0}>
        <span style={{ color: "var(--cortex-text-inactive)", "margin-right": "8px", "font-size": "12px" }}>{props.files.length}</span>
      </Show>
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: "2px" }}>{props.actions}</div>
    </div>
    <Show when={props.expanded}>
      <div style={{ "padding-bottom": "4px" }}>
        <For each={props.files}>
          {(file) => {
            const st = getStatus(file);
            return (
              <div style={{ display: "flex", "align-items": "center", padding: "4px 16px 4px 32px", cursor: "pointer", gap: "8px" }} class="sc-file-row">
                <span style={{ color: st.color, "font-weight": "600", "font-size": "11px", width: "14px", "text-align": "center" }}>{st.letter}</span>
                <span style={{ flex: 1, overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                  {fname(file.path)}
                  <Show when={dpath(file.path)}><span style={{ color: "var(--cortex-text-inactive)", "margin-left": "8px", "font-size": "12px" }}>{dpath(file.path)}</span></Show>
                </span>
              </div>
            );
          }}
        </For>
      </div>
    </Show>
  </div>
);

const iconBtn: JSX.CSSProperties = {
  background: "transparent", border: "none", color: "var(--cortex-text-inactive)",
  cursor: "pointer", padding: "4px", "border-radius": "var(--cortex-radius-sm)",
  display: "flex", "align-items": "center", "justify-content": "center",
};

export const CortexSourceControl: Component = () => {
  let multiRepo: ReturnType<typeof useMultiRepo> | null = null;
  try { multiRepo = useMultiRepo(); } catch { /* not available */ }

  const [commitMsg, setCommitMsg] = createSignal("");
  const [sections, setSections] = createSignal<Set<string>>(new Set(["staged", "changes"]));
  const [showCommits, setShowCommits] = createSignal(false);
  const [commits, setCommits] = createSignal<GitCommit[]>([]);

  const repo = () => multiRepo?.activeRepository() ?? null;
  const staged = () => repo()?.stagedFiles ?? [];
  const unstaged = () => repo()?.unstagedFiles ?? [];
  const branch = () => repo()?.branch ?? "main";
  const id = () => repo()?.id;
  const total = createMemo(() => staged().length + unstaged().length);

  const toggle = (s: string) => setSections(p => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; });

  const fetchCommits = async () => {
    const r = repo(); if (!r) return;
    try { setCommits(await gitLog(r.path, 5)); } catch { setCommits([]); }
  };

  onMount(() => { if (repo()) fetchCommits(); });

  const handleCommit = () => {
    const rid = id();
    if (commitMsg().trim() && rid && multiRepo?.commit) { multiRepo.commit(rid, commitMsg()); setCommitMsg(""); }
  };

  const handleInit = async () => {
    const p = getProjectPath();
    if (p && multiRepo?.gitInit) await multiRepo.gitInit(p);
  };

  const toggleCommits = () => { const n = !showCommits(); setShowCommits(n); if (n) fetchCommits(); };

  return (
    <div style={PANEL}>
      <Show when={repo()} fallback={
        <div style={{ display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", flex: 1, padding: "32px", gap: "16px", "text-align": "center" }}>
          <svg width="48" height="48" viewBox="0 0 16 16" fill="var(--cortex-text-inactive)">
            <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
          </svg>
          <span style={{ "font-size": "16px", "font-weight": "500" }}>No Source Control</span>
          <span style={{ "font-size": "12px", color: "var(--cortex-text-inactive)" }}>Open a folder with a Git repository or initialize one.</span>
          <div style={{ display: "flex", "flex-direction": "column", gap: "8px", width: "100%", "max-width": "200px" }}>
            <CortexButton variant="primary" fullWidth onClick={handleInit}>Initialize Repository</CortexButton>
            <CortexButton variant="secondary" fullWidth>Open Folder</CortexButton>
          </div>
        </div>
      }>
        <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", padding: "12px 16px", "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <span style={{ "font-weight": "500" }}>Source Control</span>
            <Show when={total() > 0}>
              <span style={{ background: "var(--cortex-accent-primary)", color: "var(--cortex-accent-text)", padding: "2px 6px", "border-radius": "var(--cortex-radius-lg)", "font-size": "11px", "font-weight": "600" }}>{total()}</span>
            </Show>
          </div>
          <button onClick={() => { const rid = id(); if (rid) multiRepo?.refreshRepository?.(rid); }} style={iconBtn} title="Refresh">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.5 2a.5.5 0 0 0-.5.5V5a5 5 0 1 0-1.07 5.5.5.5 0 0 0-.76-.65A4 4 0 1 1 12 5.5H9.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5z"/></svg>
          </button>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "8px", padding: "8px 16px", "border-bottom": "1px solid var(--cortex-bg-hover)", color: "var(--cortex-text-inactive)", "font-size": "12px" }}>
          <CortexIcon name="code-branch" size="sm" color="var(--cortex-text-inactive)" />
          <span>{branch()}</span>
        </div>

        <div style={{ padding: "12px 16px", "border-bottom": "1px solid var(--cortex-bg-hover)" }}>
          <textarea value={commitMsg()} onInput={(e) => setCommitMsg(e.currentTarget.value)}
            placeholder="Message (press Ctrl+Enter to commit)"
            onKeyDown={(e) => { if (e.ctrlKey && e.key === "Enter") handleCommit(); }}
            style={{ width: "100%", background: "var(--cortex-bg-primary)", border: "1px solid var(--cortex-bg-hover)", "border-radius": "var(--cortex-radius-sm)", color: "var(--cortex-text-primary)", padding: "8px", "font-size": "13px", resize: "vertical", "min-height": "60px", outline: "none", "font-family": "var(--cortex-font-sans)", "box-sizing": "border-box" }}
          />
          <CortexButton onClick={handleCommit} disabled={!commitMsg().trim() || staged().length === 0}
            variant={staged().length > 0 && commitMsg().trim() ? "primary" : "secondary"} fullWidth style={{ "margin-top": "8px" }}>
            Commit
          </CortexButton>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <FileSection title="Staged Changes" files={staged()} expanded={sections().has("staged")} onToggle={() => toggle("staged")}
            actions={<button onClick={() => { const rid = id(); if (rid) multiRepo?.unstageAll?.(rid); }} style={iconBtn} title="Unstage All">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 8h14v1H1z"/></svg>
            </button>} />
          <FileSection title="Changes" files={unstaged()} expanded={sections().has("changes")} onToggle={() => toggle("changes")}
            actions={<button onClick={() => { const rid = id(); if (rid) multiRepo?.stageAll?.(rid); }} style={iconBtn} title="Stage All">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z"/></svg>
            </button>} />
        </div>

        <div style={{ "border-top": "1px solid var(--cortex-bg-hover)" }}>
          <button onClick={toggleCommits} style={{ width: "100%", background: "transparent", border: "none", color: "var(--cortex-accent-primary)", cursor: "pointer", padding: "8px 16px", "font-size": "12px", "text-align": "left", "font-family": "var(--cortex-font-sans)" }}>
            {showCommits() ? "Hide Recent Commits" : "Show Recent Commits"}
          </button>
          <Show when={showCommits()}>
            <div style={{ padding: "0 16px 8px" }}>
              <For each={commits()} fallback={<span style={{ color: "var(--cortex-text-inactive)", "font-size": "12px" }}>No commits yet</span>}>
                {(c) => (
                  <div style={{ display: "flex", "align-items": "baseline", gap: "8px", padding: "4px 0", "font-size": "12px" }}>
                    <span style={{ color: "var(--cortex-accent-primary)", "font-family": "var(--cortex-font-mono)", "font-size": "11px", "flex-shrink": "0" }}>{c.shortHash}</span>
                    <span style={{ flex: 1, overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>{c.message.length > 50 ? c.message.slice(0, 47) + "..." : c.message}</span>
                    <span style={{ color: "var(--cortex-text-inactive)", "font-size": "11px", "flex-shrink": "0" }}>{relDate(c.date)}</span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        <style>{`.sc-file-row:hover { background: rgba(255,255,255,0.05); }`}</style>
      </Show>
    </div>
  );
};

export default CortexSourceControl;
