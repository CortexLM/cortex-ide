import {
  Component,
  For,
  Show,
  createSignal,
  onMount,
  onCleanup,
  JSX,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { CortexButton } from "./primitives/CortexButton";
import { CortexIcon } from "./primitives/CortexIcon";

export interface FileModification {
  id: string;
  filePath: string;
  description: string;
  additions: number;
  deletions: number;
  diffLines: DiffLine[];
  status: "pending" | "accepted" | "rejected";
  newContent?: string;
  oldContent?: string;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumber: number;
}

interface ToolResultPayload {
  callId: string;
  toolName: string;
  output: string;
  success: boolean;
  filePath?: string;
  oldContent?: string;
  newContent?: string;
}

export interface CortexAIModificationsPanelProps {
  onReviewFile?: (filePath: string) => void;
  onClose?: () => void;
  class?: string;
  style?: JSX.CSSProperties;
}

const DIFF_COLORS = {
  added: { bg: "var(--cortex-diff-added-bg)", prefix: "+", text: "var(--cortex-diff-added-text)" },
  removed: { bg: "var(--cortex-diff-removed-bg)", prefix: "-", text: "var(--cortex-diff-removed-text)" },
  unchanged: { bg: "transparent", prefix: " ", text: "var(--cortex-text-primary)" },
} as const;

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];
  let lineNum = 1;
  let oi = 0;
  let ni = 0;
  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length) {
      if (oldLines[oi] === newLines[ni]) {
        result.push({ type: "unchanged", content: newLines[ni], lineNumber: lineNum++ });
        oi++; ni++;
      } else {
        let found = false;
        for (let k = 1; k <= 5; k++) {
          if (ni + k < newLines.length && oldLines[oi] === newLines[ni + k]) {
            for (let j = 0; j < k; j++) result.push({ type: "added", content: newLines[ni + j], lineNumber: lineNum++ });
            ni += k; found = true; break;
          }
          if (oi + k < oldLines.length && oldLines[oi + k] === newLines[ni]) {
            for (let j = 0; j < k; j++) result.push({ type: "removed", content: oldLines[oi + j], lineNumber: lineNum++ });
            oi += k; found = true; break;
          }
        }
        if (!found) {
          result.push({ type: "removed", content: oldLines[oi], lineNumber: lineNum++ });
          result.push({ type: "added", content: newLines[ni], lineNumber: lineNum++ });
          oi++; ni++;
        }
      }
    } else if (oi < oldLines.length) {
      result.push({ type: "removed", content: oldLines[oi++], lineNumber: lineNum++ });
    } else {
      result.push({ type: "added", content: newLines[ni++], lineNumber: lineNum++ });
    }
  }
  return result;
}

const ModDiffLine: Component<{ line: DiffLine }> = (props) => {
  const c = () => DIFF_COLORS[props.line.type];
  return (
    <div style={{ display: "flex", "min-height": "20px", background: c().bg, "font-family": "var(--cortex-font-mono)", "font-size": "12px", "line-height": "1.6" }}>
      <span style={{ width: "44px", "text-align": "right", padding: "0 8px", color: "var(--cortex-text-secondary)", "user-select": "none", "flex-shrink": "0" }}>{props.line.lineNumber}</span>
      <span style={{ width: "20px", "text-align": "center", color: c().text, "font-weight": "600", "user-select": "none", "flex-shrink": "0" }}>{c().prefix}</span>
      <span style={{ flex: "1", padding: "0 8px", "white-space": "pre", color: c().text, "tab-size": "4" }}>{props.line.content}</span>
    </div>
  );
};

const FileSection: Component<{
  mod: FileModification;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onReview?: (path: string) => void;
}> = (props) => {
  const [expanded, setExpanded] = createSignal(true);
  const fileName = () => props.mod.filePath.replace(/\\/g, "/").split("/").pop() || props.mod.filePath;

  return (
    <div style={{ border: "1px solid var(--cortex-border-default)", "border-radius": "12px", overflow: "hidden", "margin-bottom": "8px" }}>
      <div
        style={{ display: "flex", "align-items": "center", gap: "8px", padding: "8px 12px", background: "var(--cortex-bg-secondary)", cursor: "pointer", "user-select": "none" }}
        onClick={() => setExpanded(!expanded())}
      >
        <CortexIcon name={expanded() ? "chevron-down" : "chevron-right"} size={12} color="var(--cortex-text-inactive)" />
        <Show when={props.mod.status !== "pending"}>
          <CortexIcon name="check" size={14} color={props.mod.status === "accepted" ? "var(--cortex-success)" : "var(--cortex-text-inactive)"} />
        </Show>
        <CortexIcon name="file" size={14} color="var(--cortex-text-secondary)" />
        <span style={{ flex: "1", "font-size": "13px", "font-weight": "500", color: "var(--cortex-text-primary)", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>{fileName()}</span>
        <span style={{ "font-size": "12px", color: "var(--cortex-diff-added-text)", "font-weight": "500" }}>+{props.mod.additions}</span>
        <span style={{ "font-size": "12px", color: "var(--cortex-diff-removed-text)", "font-weight": "500" }}>-{props.mod.deletions}</span>
      </div>
      <Show when={expanded()}>
        <div style={{ "border-top": "1px solid var(--cortex-border-default)", "max-height": "300px", "overflow-y": "auto" }}>
          <For each={props.mod.diffLines}>{(line) => <ModDiffLine line={line} />}</For>
        </div>
        <Show when={props.mod.status === "pending"}>
          <div style={{ display: "flex", "align-items": "center", "justify-content": "flex-end", gap: "8px", padding: "8px 12px", "border-top": "1px solid var(--cortex-border-default)", background: "var(--cortex-bg-secondary)" }}>
            <Show when={props.onReview}>
              <button onClick={(e) => { e.stopPropagation(); props.onReview?.(props.mod.filePath); }} style={{ background: "transparent", border: "none", color: "var(--cortex-text-secondary)", "font-size": "12px", cursor: "pointer", padding: "4px 8px", "margin-right": "auto" }}>Review</button>
            </Show>
            <CortexButton variant="secondary" size="xs" onClick={() => props.onReject(props.mod.id)}>Reject</CortexButton>
            <CortexButton variant="primary" size="xs" onClick={() => props.onAccept(props.mod.id)}>Accept</CortexButton>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export const CortexAIModificationsPanel: Component<CortexAIModificationsPanelProps> = (props) => {
  const [modifications, setModifications] = createStore<FileModification[]>([]);
  let unlistenFn: UnlistenFn | null = null;

  onMount(async () => {
    try {
      unlistenFn = await listen<ToolResultPayload>("ai:tool_result", (event) => {
        const { callId, toolName, filePath, oldContent, newContent, success } = event.payload;
        if (!success || !filePath || !toolName.includes("write")) return;
        const old = oldContent || "";
        const next = newContent || "";
        const diffLines = computeDiff(old, next);
        const additions = diffLines.filter((l) => l.type === "added").length;
        const deletions = diffLines.filter((l) => l.type === "removed").length;
        setModifications(produce((mods) => {
          const existing = mods.findIndex((m) => m.filePath === filePath);
          const mod: FileModification = { id: callId, filePath, description: `Modified ${filePath}`, additions, deletions, diffLines, status: "pending", newContent: next, oldContent: old };
          if (existing >= 0) mods[existing] = mod;
          else mods.push(mod);
        }));
      });
    } catch {
      // Not in Tauri context
    }
  });

  onCleanup(() => { unlistenFn?.(); });

  const pendingCount = () => modifications.filter((m) => m.status === "pending").length;
  const editedCount = () => modifications.length;

  const handleAccept = async (id: string) => {
    const mod = modifications.find((m) => m.id === id);
    if (!mod?.newContent) return;
    try {
      await invoke("fs_write_file", { path: mod.filePath, content: mod.newContent });
      setModifications(produce((mods) => { const m = mods.find((x) => x.id === id); if (m) m.status = "accepted"; }));
    } catch { /* noop */ }
  };

  const handleReject = (id: string) => {
    setModifications(produce((mods) => { const m = mods.find((x) => x.id === id); if (m) m.status = "rejected"; }));
  };

  const handleAcceptAll = async () => {
    for (const mod of modifications) {
      if (mod.status === "pending" && mod.newContent) {
        try {
          await invoke("fs_write_file", { path: mod.filePath, content: mod.newContent });
          setModifications(produce((mods) => { const m = mods.find((x) => x.id === mod.id); if (m) m.status = "accepted"; }));
        } catch { /* noop */ }
      }
    }
  };

  const handleUndoAll = () => {
    setModifications(produce((mods) => { for (const m of mods) if (m.status !== "rejected") m.status = "rejected"; }));
  };

  return (
    <div class={props.class} style={{ display: "flex", "flex-direction": "column", background: "var(--cortex-bg-primary)", color: "var(--cortex-text-primary)", "font-family": "var(--cortex-font-sans)", "border-radius": "var(--cortex-radius-lg)", border: "1px solid var(--cortex-border-default)", overflow: "hidden", ...props.style }}>
      <div style={{ display: "flex", "align-items": "center", gap: "12px", padding: "12px 16px", "border-bottom": "1px solid var(--cortex-border-default)", background: "var(--cortex-bg-secondary)" }}>
        <span style={{ "font-weight": "600", "font-size": "14px", flex: "1" }}>AI Modifications</span>
        <Show when={editedCount() > 0}>
          <button onClick={() => props.onReviewFile?.(modifications[0]?.filePath ?? "")} style={{ background: "transparent", border: "none", color: "var(--cortex-text-on-surface)", "font-size": "12px", cursor: "pointer", padding: "4px 8px", "text-decoration": "underline", "text-underline-offset": "2px" }}>
            Edited {editedCount()} file{editedCount() !== 1 ? "s" : ""}… Review
          </button>
        </Show>
        <button onClick={handleUndoAll} style={{ display: "inline-flex", "align-items": "center", gap: "4px", background: "transparent", border: "none", color: "var(--cortex-undo-color)", "font-size": "12px", "font-weight": "500", cursor: "pointer", padding: "4px 8px" }}>
          <CortexIcon name="corner-up-left" size={14} color="var(--cortex-undo-color)" />
          Undo Changes
        </button>
      </div>
      <div style={{ flex: "1", overflow: "auto", padding: "12px" }}>
        <For each={modifications}>{(mod) => <FileSection mod={mod} onAccept={handleAccept} onReject={handleReject} onReview={props.onReviewFile} />}</For>
        <Show when={modifications.length === 0}>
          <div style={{ padding: "24px", "text-align": "center", color: "var(--cortex-text-inactive)", "font-size": "13px" }}>No modifications yet</div>
        </Show>
      </div>
      <Show when={pendingCount() > 0}>
        <div style={{ display: "flex", "justify-content": "flex-end", gap: "8px", padding: "12px 16px", "border-top": "1px solid var(--cortex-border-default)", background: "var(--cortex-bg-secondary)" }}>
          <CortexButton variant="primary" size="sm" onClick={handleAcceptAll}>Accept All</CortexButton>
        </div>
      </Show>
    </div>
  );
};

export default CortexAIModificationsPanel;
