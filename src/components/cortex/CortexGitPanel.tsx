import { Component, createSignal, createMemo, Show, For, JSX, onCleanup, onMount } from "solid-js";
import { useMultiRepo, type GitFile, type GitFileStatus } from "@/context/MultiRepoContext";
import { CortexIcon } from "./primitives/CortexIcon";
import { CortexIconButton } from "./primitives/CortexIconButton";
import { CortexDropdown } from "./primitives/CortexDropdown";
import { CortexDropdownMenu } from "./primitives/CortexDropdownMenu";
import { CortexDropdownItem } from "./primitives/CortexDropdownItem";
import { CortexTooltip } from "./primitives/CortexTooltip";
import { gitStashListEnhanced, gitStashCreate, gitStashPop, gitStashDrop, type StashEntry } from "@/utils/tauri-api";

const STATUS_LETTER: Record<GitFileStatus, string> = {
  modified: "M", added: "A", deleted: "D", renamed: "R", untracked: "?", conflict: "U",
};
const STATUS_COLOR: Record<string, string> = {
  M: "var(--cortex-git-modified)", A: "var(--cortex-git-added)", D: "var(--cortex-git-deleted)",
  R: "var(--cortex-git-renamed)", U: "var(--cortex-git-conflict)", "?": "var(--cortex-git-untracked)",
};

const SectionHeader: Component<{
  title: string; count: number; expanded: boolean; onToggle: () => void; actions?: JSX.Element;
}> = (props) => (
  <div style={{ "border-bottom": "1px solid var(--cortex-border-default)" }}>
    <div onClick={props.onToggle} style={{ display: "flex", "align-items": "center", padding: "8px 12px", cursor: "pointer", "user-select": "none" }}>
      <CortexIcon name="chevron-right" size={12} style={{ transform: props.expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", "margin-right": "8px" }} color="var(--cortex-text-secondary)" />
      <span style={{ flex: 1, "font-size": "16px", color: "var(--cortex-text-on-surface)" }}>{props.title}</span>
      <Show when={props.count > 0}>
        <span style={{ background: "rgba(255,255,255,0.08)", color: "var(--cortex-text-on-surface)", padding: "2px 8px", "border-radius": "4px", "font-size": "14px", "margin-right": "8px" }}>{props.count}</span>
      </Show>
      <div onClick={(e: MouseEvent) => e.stopPropagation()} style={{ display: "flex", gap: "2px" }}>{props.actions}</div>
    </div>
  </div>
);

const FileRow: Component<{
  file: GitFile; isStaged: boolean; repoId: string | undefined;
  onStage: (p: string) => void; onUnstage: (p: string) => void; onDiscard: (p: string) => void;
}> = (props) => {
  const letter = () => STATUS_LETTER[props.file.status] ?? "?";
  const name = () => props.file.path.split("/").pop() ?? props.file.path;
  return (
    <div class="cortex-git-file-row" style={{ display: "flex", "align-items": "center", padding: "4px 12px 4px 36px", cursor: "pointer", gap: "8px" }}>
      <CortexIcon name="chevron-down" size={12} color="var(--cortex-text-secondary)" />
      <span style={{ flex: 1, overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", "font-size": "16px", color: "var(--cortex-text-on-surface)" }}>{name()}</span>
      <div class="cortex-git-file-actions" style={{ display: "flex", gap: "2px", opacity: 0 }}>
        <Show when={!props.isStaged}>
          <CortexTooltip content="Open Diff"><CortexIconButton icon="switch-horizontal-01" size={20} onClick={() => window.dispatchEvent(new CustomEvent("cortex:git:diff", { detail: { path: props.file.path, repoId: props.repoId } }))} /></CortexTooltip>
          <CortexTooltip content="Discard Changes"><CortexIconButton icon="reverse-left" size={20} onClick={() => props.onDiscard(props.file.path)} /></CortexTooltip>
          <CortexTooltip content="Stage"><CortexIconButton icon="plus" size={20} onClick={() => props.onStage(props.file.path)} /></CortexTooltip>
        </Show>
        <Show when={props.isStaged}>
          <CortexTooltip content="Open Diff"><CortexIconButton icon="switch-horizontal-01" size={20} onClick={() => window.dispatchEvent(new CustomEvent("cortex:git:diff", { detail: { path: props.file.path, repoId: props.repoId, staged: true } }))} /></CortexTooltip>
          <CortexTooltip content="Unstage"><CortexIconButton icon="minus" size={20} onClick={() => props.onUnstage(props.file.path)} /></CortexTooltip>
        </Show>
      </div>
      <span style={{ color: STATUS_COLOR[letter()], "font-weight": "600", "font-size": "12px", width: "16px", "text-align": "center" }}>{letter()}</span>
    </div>
  );
};

export const CortexGitPanel: Component = () => {
  let multiRepo: ReturnType<typeof useMultiRepo> | null = null;
  try { multiRepo = useMultiRepo(); } catch { /* context unavailable */ }

  const [commitMsg, setCommitMsg] = createSignal("");
  const [amend, setAmend] = createSignal(false);
  const [showDotsMenu, setShowDotsMenu] = createSignal(false);
  const [expandStaged, setExpandStaged] = createSignal(true);
  const [expandChanges, setExpandChanges] = createSignal(true);
  const [expandStash, setExpandStash] = createSignal(false);
  const [stashes, setStashes] = createSignal<StashEntry[]>([]);
  const [stashLoading, setStashLoading] = createSignal(false);
  let dotsRef: HTMLDivElement | undefined;

  const repo = () => multiRepo?.activeRepository() ?? null;
  const repoId = () => repo()?.id;
  const staged = () => repo()?.stagedFiles ?? [];
  const unstaged = () => repo()?.unstagedFiles ?? [];
  const currentBranch = () => repo()?.branch ?? "main";
  const totalChanges = createMemo(() => staged().length + unstaged().length);

  const branchOptions = createMemo(() =>
    (repo()?.branches ?? []).map((b) => ({ value: b.name, label: b.name, icon: "code-branch" }))
  );

  const onBranchChange = (branch: string) => { const id = repoId(); if (id) multiRepo?.checkout(id, branch); };

  const handleCommit = () => {
    const msg = commitMsg().trim();
    const id = repoId();
    if (msg && id && staged().length > 0) { multiRepo?.commit(id, msg); setCommitMsg(""); setAmend(false); }
  };

  const stageAll = () => { const id = repoId(); if (id) multiRepo?.stageAll(id); };
  const unstageAll = () => { const id = repoId(); if (id) multiRepo?.unstageAll(id); };
  const refresh = () => { const id = repoId(); if (id) multiRepo?.refreshRepository(id); };
  const stageFile = (p: string) => { const id = repoId(); if (id) multiRepo?.stageFiles(id, [p]); };
  const unstageFile = (p: string) => { const id = repoId(); if (id) multiRepo?.unstageFiles(id, [p]); };
  const discardFile = (p: string) => { const id = repoId(); if (id) multiRepo?.discardChanges(id, [p]); };
  const discardAll = () => { const id = repoId(); if (id) multiRepo?.discardChanges(id, unstaged().map((f) => f.path)); };

  const fetchStashes = async () => {
    const r = repo();
    if (!r) return;
    setStashLoading(true);
    try { setStashes(await gitStashListEnhanced(r.path)); } catch { setStashes([]); }
    setStashLoading(false);
  };

  const handleStashCreate = async () => {
    const r = repo();
    if (!r) return;
    try { await gitStashCreate(r.path, "", true); await fetchStashes(); refresh(); } catch { /* ignore */ }
  };

  const handleStashPop = async (index: number) => {
    const r = repo();
    if (!r) return;
    try { await gitStashPop(r.path, index); await fetchStashes(); refresh(); } catch { /* ignore */ }
  };

  const handleStashDrop = async (index: number) => {
    const r = repo();
    if (!r) return;
    try { await gitStashDrop(r.path, index); await fetchStashes(); } catch { /* ignore */ }
  };

  const dotsAction = (action: string) => {
    setShowDotsMenu(false);
    const id = repoId();
    if (!id) return;
    if (action === "pull") multiRepo?.pull(id);
    else if (action === "push") multiRepo?.push(id);
    else if (action === "fetch") multiRepo?.fetch(id);
    else if (action === "stash") handleStashCreate();
    else window.dispatchEvent(new CustomEvent("cortex:git:" + action, { detail: { repoId: id } }));
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (showDotsMenu() && dotsRef && !dotsRef.contains(e.target as Node)) setShowDotsMenu(false);
  };
  document.addEventListener("mousedown", handleClickOutside);
  onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));

  onMount(() => { if (repo()) fetchStashes(); });

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%", background: "var(--cortex-bg-primary)", color: "var(--cortex-text-on-surface)", "font-family": "var(--cortex-font-sans)", "font-size": "14px" }}>
      <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", padding: "12px 12px", "border-bottom": "1px solid var(--cortex-border-default)" }}>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <span style={{ "font-size": "16px", "font-weight": "500", color: "var(--cortex-text-on-surface)" }}>Source Control</span>
        </div>
        <div style={{ display: "flex", gap: "4px", "align-items": "center" }}>
          <CortexTooltip content="Refresh"><CortexIconButton icon="refresh" size={20} onClick={refresh} /></CortexTooltip>
          <CortexTooltip content="Stage All"><CortexIconButton icon="plus" size={20} onClick={stageAll} /></CortexTooltip>
          <div ref={dotsRef} style={{ position: "relative" }}>
            <CortexTooltip content="More Actions"><CortexIconButton icon="more" size={20} onClick={() => setShowDotsMenu((v) => !v)} /></CortexTooltip>
            <Show when={showDotsMenu()}>
              <CortexDropdownMenu width={180} style={{ position: "absolute", top: "28px", right: "0", "z-index": "100" }}>
                <CortexDropdownItem label="Pull" onClick={() => dotsAction("pull")} />
                <CortexDropdownItem label="Push" onClick={() => dotsAction("push")} />
                <CortexDropdownItem label="Fetch" onClick={() => dotsAction("fetch")} />
                <CortexDropdownItem label="Stash" onClick={() => dotsAction("stash")} />
                <CortexDropdownItem label="Show History" onClick={() => dotsAction("history")} />
              </CortexDropdownMenu>
            </Show>
          </div>
        </div>
      </div>

      <div style={{ padding: "12px", "border-bottom": "1px solid var(--cortex-border-default)", display: "flex", "flex-direction": "column", gap: "8px" }}>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <CortexIcon name="git-branch-01" size={16} color="var(--cortex-text-secondary)" />
          <CortexDropdown options={branchOptions()} value={currentBranch() ?? undefined} onChange={onBranchChange} placeholder="Select branch..." searchable fullWidth style={{ height: "28px", "font-size": "14px", flex: "1" }} />
        </div>
        <input
          value={commitMsg()}
          onInput={(e) => setCommitMsg(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.ctrlKey && e.key === "Enter") handleCommit(); }}
          placeholder={amend() ? "Amend commit message" : "✔ Commit message"}
          style={{ width: "100%", background: "var(--cortex-bg-secondary)", border: "1px solid var(--cortex-border-default)", "border-radius": "12px", color: "var(--cortex-text-on-surface)", padding: "10px 12px", "font-size": "14px", outline: "none", "box-sizing": "border-box", "font-family": "inherit" }}
        />
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <button
            onClick={handleCommit}
            disabled={!commitMsg().trim() || staged().length === 0}
            style={{ flex: 1, background: staged().length > 0 && commitMsg().trim() ? "var(--cortex-text-on-surface)" : "var(--cortex-border-default)", color: staged().length > 0 && commitMsg().trim() ? "var(--cortex-accent-text)" : "var(--cortex-text-secondary)", border: "none", "border-radius": "12px", padding: "10px 16px", "font-size": "16px", cursor: staged().length > 0 && commitMsg().trim() ? "pointer" : "default", display: "flex", "align-items": "center", "justify-content": "center", gap: "8px", "font-family": "inherit", opacity: !commitMsg().trim() || staged().length === 0 ? "0.5" : "1" }}
          >
            <span>{amend() ? "Amend" : "Commit"}</span>
            <span style={{ display: "flex", "align-items": "center", gap: "4px", "font-size": "12px" }}>
              <span style={{ background: "rgba(0,0,0,0.79)", color: "var(--cortex-text-on-surface)", padding: "2px 6px", "border-radius": "4px" }}>Ctrl</span>
              <span>+</span>
              <span style={{ background: "rgba(0,0,0,0.79)", color: "var(--cortex-text-on-surface)", padding: "2px 6px", "border-radius": "4px" }}>Enter</span>
            </span>
          </button>
        </div>
        <label style={{ display: "flex", "align-items": "center", gap: "6px", "font-size": "12px", color: "var(--cortex-text-secondary)", cursor: "pointer", "user-select": "none" }}>
          <input type="checkbox" checked={amend()} onChange={(e) => setAmend(e.currentTarget.checked)} style={{ margin: 0, "accent-color": "var(--cortex-accent-primary)" }} />
          Amend previous commit
        </label>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <SectionHeader title="Changes" count={unstaged().length} expanded={expandChanges()} onToggle={() => setExpandChanges((v) => !v)} actions={
          <>
            <CortexTooltip content="Stage All"><CortexIconButton icon="plus" size={20} onClick={stageAll} /></CortexTooltip>
            <CortexTooltip content="Discard All"><CortexIconButton icon="reverse-left" size={20} onClick={discardAll} /></CortexTooltip>
          </>
        } />
        <Show when={expandChanges()}>
          <For each={unstaged()}>{(file) =>
            <FileRow file={file} isStaged={false} repoId={repoId()} onStage={stageFile} onUnstage={unstageFile} onDiscard={discardFile} />
          }</For>
        </Show>

        <SectionHeader title="Staged Changes" count={staged().length} expanded={expandStaged()} onToggle={() => setExpandStaged((v) => !v)} actions={
          <CortexTooltip content="Unstage All"><CortexIconButton icon="minus" size={20} onClick={unstageAll} /></CortexTooltip>
        } />
        <Show when={expandStaged()}>
          <For each={staged()}>{(file) =>
            <FileRow file={file} isStaged={true} repoId={repoId()} onStage={stageFile} onUnstage={unstageFile} onDiscard={discardFile} />
          }</For>
        </Show>

        <SectionHeader title="Stashes" count={stashes().length} expanded={expandStash()} onToggle={() => { setExpandStash((v) => !v); if (!expandStash()) fetchStashes(); }} actions={
          <CortexTooltip content="Create Stash"><CortexIconButton icon="plus" size={20} onClick={handleStashCreate} /></CortexTooltip>
        } />
        <Show when={expandStash()}>
          <Show when={stashLoading()}>
            <div style={{ padding: "8px 36px", color: "var(--cortex-text-secondary)", "font-size": "12px" }}>Loading...</div>
          </Show>
          <Show when={!stashLoading() && stashes().length === 0}>
            <div style={{ padding: "8px 36px", color: "var(--cortex-text-secondary)", "font-size": "12px" }}>No stashes</div>
          </Show>
          <For each={stashes()}>{(stash) =>
            <div class="cortex-git-file-row" style={{ display: "flex", "align-items": "center", padding: "4px 12px 4px 36px", cursor: "pointer", gap: "8px" }}>
              <CortexIcon name="layers-three-01" size={12} color="var(--cortex-text-secondary)" />
              <span style={{ flex: 1, overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", "font-size": "13px", color: "var(--cortex-text-on-surface)" }}>
                stash@{`{${stash.index}}`}: {stash.message || "WIP"}
              </span>
              <div class="cortex-git-file-actions" style={{ display: "flex", gap: "2px", opacity: 0 }}>
                <CortexTooltip content="Pop Stash"><CortexIconButton icon="download-01" size={18} onClick={() => handleStashPop(stash.index)} /></CortexTooltip>
                <CortexTooltip content="Drop Stash"><CortexIconButton icon="trash-01" size={18} onClick={() => handleStashDrop(stash.index)} /></CortexTooltip>
              </div>
            </div>
          }</For>
        </Show>
      </div>

      <div style={{ padding: "8px 12px", "border-top": "1px solid var(--cortex-border-default)", display: "flex", "align-items": "center", gap: "8px", color: "var(--cortex-text-secondary)", "font-size": "14px" }}>
        <CortexIcon name="git-branch-01" size={14} color="var(--cortex-text-secondary)" />
        <span>{currentBranch()}</span>
        <Show when={totalChanges() > 0}>
          <span style={{ "margin-left": "auto", color: "var(--cortex-text-inactive)", "font-size": "12px" }}>Total Changes: {totalChanges()}</span>
        </Show>
      </div>

      <style>{`
        .cortex-git-file-row:hover { background: rgba(255,255,255,0.05); }
        .cortex-git-file-row:hover .cortex-git-file-actions { opacity: 1 !important; }
      `}</style>
    </div>
  );
};

export default CortexGitPanel;
