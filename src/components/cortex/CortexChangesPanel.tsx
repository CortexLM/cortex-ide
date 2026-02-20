/**
 * CortexChangesPanel - File changes panel for Vibe mode (right column inside right panel)
 * Figma: Tab bar (Changes/All Files), file list with diff stats, diff preview, terminal
 * Wired to git_status and git_diff backend commands
 */

import { Component, For, Show, createSignal, onMount, JSX } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { CortexIcon } from "./primitives/CortexIcon";
import { VibeTabBar, type VibeTab } from "./vibe/VibeTabBar";
import { FileChangeRow } from "./vibe/FileChangeRow";
import { DiffPreview, type DiffLine } from "./vibe/DiffPreview";
import { VibeTerminal } from "./vibe/VibeTerminal";

export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  status: "modified" | "added" | "deleted" | "renamed";
}

export interface CortexChangesPanelProps {
  changes: FileChange[];
  terminalOutput?: string[];
  branchName?: string;
  projectPath?: string;
  onFileClick?: (path: string) => void;
  onRunCommand?: (command: string) => void;
  onRun?: () => void;
  onAcceptFile?: (path: string) => void;
  onRejectFile?: (path: string) => void;
  class?: string;
  style?: JSX.CSSProperties;
}

const TABS: VibeTab[] = [
  { id: "changes", label: "Changes" },
  { id: "all_files", label: "All Files" },
];

function parseDiffText(diffText: string): DiffLine[] {
  const lines = diffText.split("\n");
  const result: DiffLine[] = [];
  let lineNum = 0;
  for (const line of lines) {
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
      if (match) lineNum = parseInt(match[1], 10) - 1;
      continue;
    }
    if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("diff ") || line.startsWith("index ")) continue;
    if (line.startsWith("+")) {
      lineNum++;
      result.push({ lineNumber: lineNum, content: line.slice(1), type: "addition" });
    } else if (line.startsWith("-")) {
      result.push({ content: line.slice(1), type: "deletion" });
    } else {
      lineNum++;
      result.push({ lineNumber: lineNum, content: line.startsWith(" ") ? line.slice(1) : line, type: "context" });
    }
  }
  return result;
}

export const CortexChangesPanel: Component<CortexChangesPanelProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<string>("changes");
  const [terminalHeight, setTerminalHeight] = createSignal(186);
  const [expandedFile, setExpandedFile] = createSignal<string | null>(null);
  const [diffLines, setDiffLines] = createSignal<DiffLine[]>([]);

  const totalAdd = () => props.changes.reduce((s, f) => s + f.additions, 0);
  const totalDel = () => props.changes.reduce((s, f) => s + f.deletions, 0);

  const tabs = (): VibeTab[] => {
    const count = props.changes.length;
    return count > 0
      ? [{ id: "changes", label: "Changes", count }, { id: "all_files", label: "All Files", icon: "file" }]
      : TABS;
  };

  const handleFileClick = async (path: string) => {
    if (expandedFile() === path) {
      setExpandedFile(null);
      setDiffLines([]);
      return;
    }
    setExpandedFile(path);
    props.onFileClick?.(path);
    try {
      const diff = await invoke("git_diff", {
        path: props.projectPath || ".",
        filePath: path,
      }) as string;
      setDiffLines(parseDiffText(diff));
    } catch {
      setDiffLines([{ content: "Unable to load diff", type: "context" }]);
    }
  };

  const handleDivider = (e: MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = terminalHeight();
    const onMove = (ev: MouseEvent) =>
      setTerminalHeight(Math.max(100, Math.min(400, startH + (startY - ev.clientY))));
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  onMount(async () => {
    if (props.changes.length === 0 && props.projectPath) {
      try {
        await invoke("git_status", { path: props.projectPath });
      } catch { /* not in tauri */ }
    }
  });

  const summaryBar = (
    <div style={{
      margin: "8px 12px",
      padding: "8px 16px",
      background: "var(--cortex-bg-elevated)",
      "border-radius": "var(--cortex-radius-md)",
      display: "flex",
      "align-items": "center",
      gap: "4px",
      "font-family": "var(--cortex-font-mono)",
      "font-size": "var(--cortex-text-xs)",
      "font-weight": "var(--cortex-font-regular)",
      "flex-shrink": "0",
    }}>
      <CortexIcon name="file-plus" size={16} color="var(--cortex-text-secondary)" />
      <Show when={totalDel() > 0}>
        <span style={{ color: "var(--cortex-vibe-status-error)", width: "30px", "text-align": "right" }}>-{totalDel()}</span>
      </Show>
      <Show when={totalAdd() > 0}>
        <span style={{ color: "var(--cortex-vibe-status-completed)", width: "30px", "text-align": "right" }}>+{totalAdd()}</span>
      </Show>
    </div>
  );

  return (
    <div class={props.class} style={{
      flex: "1", height: "100%",
      display: "flex", "flex-direction": "column", overflow: "hidden",
      "justify-content": "space-between",
      gap: "24px",
      padding: "0 0 12px",
      "min-width": "0",
      ...props.style,
    }}>
      <VibeTabBar tabs={tabs()} activeId={activeTab()} onTabChange={setActiveTab} />

      <Show when={props.changes.length > 0}>{summaryBar}</Show>

      {/* File list */}
      <div style={{ flex: "1", overflow: "auto", "min-height": "0", display: "flex", "flex-direction": "column", gap: "12px" }}>
        <For each={props.changes}>
          {(file) => (
            <div>
              <div style={{ display: "flex", "align-items": "center" }}>
                <div style={{ flex: "1" }}>
                  <FileChangeRow
                    path={file.path}
                    additions={file.additions}
                    deletions={file.deletions}
                    status={file.status}
                    isExpanded={expandedFile() === file.path}
                    onClick={() => handleFileClick(file.path)}
                  />
                </div>
                <Show when={props.onAcceptFile || props.onRejectFile}>
                  <div style={{ display: "flex", gap: "4px", padding: "0 8px", "flex-shrink": "0" }}>
                    <Show when={props.onAcceptFile}>
                      <button
                        onClick={() => props.onAcceptFile!(file.path)}
                        style={{ background: "var(--cortex-vibe-status-completed-bg)", border: "none", "border-radius": "var(--cortex-radius-xs)", padding: "2px 6px", cursor: "pointer", "font-size": "11px", color: "var(--cortex-vibe-status-completed)" }}
                      >✓</button>
                    </Show>
                    <Show when={props.onRejectFile}>
                      <button
                        onClick={() => props.onRejectFile!(file.path)}
                        style={{ background: "var(--cortex-vibe-status-error-bg)", border: "none", "border-radius": "var(--cortex-radius-xs)", padding: "2px 6px", cursor: "pointer", "font-size": "11px", color: "var(--cortex-vibe-status-error)" }}
                      >✕</button>
                    </Show>
                  </div>
                </Show>
              </div>
              <Show when={expandedFile() === file.path && diffLines().length > 0}>
                <div style={{ padding: "0 12px 8px" }}>
                  <DiffPreview fileName={file.path} lines={diffLines()} />
                </div>
              </Show>
            </div>
          )}
        </For>
        <Show when={props.changes.length === 0}>
          <div style={{ padding: "24px", "text-align": "center", color: "var(--cortex-text-secondary)", "font-family": "var(--cortex-font-sans)", "font-size": "var(--cortex-text-sm)" }}>
            No changes yet
          </div>
        </Show>
      </div>

      {/* Terminal */}
      <VibeTerminal
        output={props.terminalOutput || []}
        branchName={props.branchName}
        height={terminalHeight()}
        onRunCommand={(cmd) => props.onRunCommand?.(cmd)}
        onRun={() => props.onRun?.()}
        onDividerDrag={handleDivider}
      />
    </div>
  );
};

export default CortexChangesPanel;
