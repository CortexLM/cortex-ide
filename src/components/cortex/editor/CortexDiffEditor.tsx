/**
 * CortexDiffEditor - Diff editor wrapper with inline gutter actions
 * Wraps the base DiffEditor and adds hunk-level git operations
 */
import { createSignal, createEffect, createMemo, Show, onCleanup, type JSX } from "solid-js";
import { DiffEditor } from "@/components/editor/DiffEditor";
import { CortexButton, CortexTooltip } from "../primitives";
import {
  gitStageHunk, gitUnstageHunk, gitRevertHunk, gitGetHunks,
  type HunkNavigationData,
} from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";
import { createLogger } from "@/utils/logger";

const logger = createLogger("DiffEditor");

export interface CortexDiffEditorProps {
  originalContent: string;
  modifiedContent: string;
  language: string;
  originalPath?: string;
  modifiedPath?: string;
  filePath?: string;
  staged?: boolean;
  onModifiedChange?: (content: string) => void;
  readOnly?: boolean;
}

export function CortexDiffEditor(props: CortexDiffEditorProps) {
  const [loading, setLoading] = createSignal(false);
  const [activeHunkIndex, setActiveHunkIndex] = createSignal(0);
  const [hunkData, setHunkData] = createSignal<HunkNavigationData | null>(null);
  const [gutterHunkIndex, setGutterHunkIndex] = createSignal<number | null>(null);

  const totalHunks = createMemo(() => hunkData()?.hunks.length ?? 0);
  const canNavigatePrev = createMemo(() => activeHunkIndex() > 0);
  const canNavigateNext = createMemo(() => activeHunkIndex() < totalHunks() - 1);

  const fetchHunks = async () => {
    const filePath = props.filePath;
    if (!filePath) { setHunkData(null); return; }
    try {
      const projectPath = getProjectPath();
      if (!projectPath) return;
      setHunkData(await gitGetHunks(projectPath, filePath, props.staged));
    } catch (e) { logger.warn("Failed to fetch hunk data", e); setHunkData(null); }
  };

  createEffect(() => { if (props.filePath) fetchHunks(); });

  const dispatchRefresh = () => window.dispatchEvent(new CustomEvent("git:refresh"));

  const performHunkAction = async (
    action: (path: string, file: string, hunkIndex: number) => Promise<void>,
    hunkIndex: number,
  ) => {
    const filePath = props.filePath;
    if (!filePath || loading()) return;
    if (!Number.isInteger(hunkIndex) || hunkIndex < 0 || hunkIndex >= totalHunks()) return;
    const projectPath = getProjectPath();
    if (!projectPath) return;
    setLoading(true);
    try {
      await action(projectPath, filePath, hunkIndex);
      dispatchRefresh();
      await fetchHunks();
    } finally { setLoading(false); }
  };

  const stageHunk = (index: number) => performHunkAction(gitStageHunk, index);
  const unstageHunk = (index: number) => performHunkAction(gitUnstageHunk, index);
  const revertHunk = (index: number) => performHunkAction(gitRevertHunk, index);

  const bulkAction = async (
    action: (path: string, file: string, hunkIndex: number) => Promise<void>,
  ) => {
    const filePath = props.filePath;
    const count = totalHunks();
    if (!filePath || count === 0 || loading()) return;
    const projectPath = getProjectPath();
    if (!projectPath) return;
    setLoading(true);
    try {
      for (let i = count - 1; i >= 0; i--) await action(projectPath, filePath, i);
      dispatchRefresh();
      await fetchHunks();
    } finally { setLoading(false); }
  };

  const stageAll = () => bulkAction(gitStageHunk);
  const revertAll = () => bulkAction(gitRevertHunk);
  const unstageAll = () => bulkAction(gitUnstageHunk);

  const navigatePrev = () => { if (canNavigatePrev()) setActiveHunkIndex((i) => i - 1); };
  const navigateNext = () => { if (canNavigateNext()) setActiveHunkIndex((i) => i + 1); };

  const handleGutterLeave = () => setGutterHunkIndex(null);
  const onGlobalClick = () => setGutterHunkIndex(null);
  window.addEventListener("click", onGlobalClick);
  onCleanup(() => window.removeEventListener("click", onGlobalClick));

  const containerStyle: JSX.CSSProperties = {
    display: "flex", "flex-direction": "column",
    height: "100%", overflow: "hidden",
    background: "var(--cortex-bg-secondary)",
  };

  const toolbarStyle: JSX.CSSProperties = {
    display: "flex", "align-items": "center", "justify-content": "space-between",
    height: "36px", padding: "0 12px",
    "border-bottom": "1px solid var(--cortex-bg-hover, rgba(255,255,255,0.08))",
    "flex-shrink": "0", "font-family": "'Inter', -apple-system, sans-serif",
    "font-size": "13px", gap: "8px",
  };

  const navGroupStyle: JSX.CSSProperties = { display: "flex", "align-items": "center", gap: "4px" };
  const actionsGroupStyle: JSX.CSSProperties = { display: "flex", "align-items": "center", gap: "6px" };

  const hunkCountStyle: JSX.CSSProperties = {
    "font-size": "12px", color: "var(--cortex-text-inactive, rgba(255,255,255,0.5))",
    "font-variant-numeric": "tabular-nums", "white-space": "nowrap",
  };

  const filePathStyle: JSX.CSSProperties = {
    color: "var(--cortex-text-primary)", "font-weight": "500",
    "max-width": "200px", overflow: "hidden",
    "text-overflow": "ellipsis", "white-space": "nowrap",
  };

  const floatingToolbarStyle: JSX.CSSProperties = {
    position: "absolute", top: "8px", right: "24px",
    display: "flex", "align-items": "center", gap: "2px", padding: "4px 6px",
    background: "var(--cortex-bg-elevated, #2A2B2F)",
    border: "1px solid var(--cortex-bg-hover, rgba(255,255,255,0.1))",
    "border-radius": "var(--cortex-radius-md, 6px)",
    "box-shadow": "0 4px 12px rgba(0,0,0,0.4)", "z-index": "1000",
  };

  const editorWrapperStyle: JSX.CSSProperties = {
    flex: "1", position: "relative", overflow: "hidden",
  };

  return (
    <div style={containerStyle}>
      <div style={toolbarStyle}>
        <div style={navGroupStyle}>
          <Show when={props.filePath}>
            <span style={filePathStyle}>{props.filePath}</span>
          </Show>
          <Show when={totalHunks() > 0}>
            <span style={hunkCountStyle}>{activeHunkIndex() + 1}/{totalHunks()}</span>
            <CortexTooltip content="Previous change">
              <CortexButton variant="ghost" size="xs" icon="chevron-up"
                disabled={!canNavigatePrev() || loading()} onClick={navigatePrev} />
            </CortexTooltip>
            <CortexTooltip content="Next change">
              <CortexButton variant="ghost" size="xs" icon="chevron-down"
                disabled={!canNavigateNext() || loading()} onClick={navigateNext} />
            </CortexTooltip>
          </Show>
          <Show when={hunkData()}>
            <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-left": "8px" }}>
              <span style={{ "font-size": "12px", color: "var(--cortex-success, #4ADE80)" }}>
                +{hunkData()!.totalAdditions}
              </span>
              <span style={{ "font-size": "12px", color: "var(--cortex-error, #F87171)" }}>
                -{hunkData()!.totalDeletions}
              </span>
            </div>
          </Show>
        </div>
        <div style={actionsGroupStyle}>
          <Show when={!props.staged && totalHunks() > 0}>
            <CortexTooltip content="Stage all hunks">
              <CortexButton variant="ghost" size="xs" icon="plus"
                loading={loading()} onClick={stageAll}>Stage All</CortexButton>
            </CortexTooltip>
          </Show>
          <Show when={props.staged && totalHunks() > 0}>
            <CortexTooltip content="Unstage all hunks">
              <CortexButton variant="ghost" size="xs" icon="minus"
                loading={loading()} onClick={unstageAll}>Unstage All</CortexButton>
            </CortexTooltip>
          </Show>
          <Show when={totalHunks() > 0}>
            <CortexTooltip content="Revert all changes">
              <CortexButton variant="danger" size="xs" icon="rotate-left"
                loading={loading()} onClick={revertAll}>Revert All</CortexButton>
            </CortexTooltip>
          </Show>
        </div>
      </div>

      <div style={editorWrapperStyle} onMouseLeave={handleGutterLeave}>
        <DiffEditor
          originalContent={props.originalContent}
          modifiedContent={props.modifiedContent}
          language={props.language}
          originalPath={props.originalPath}
          modifiedPath={props.modifiedPath}
          onModifiedChange={props.onModifiedChange}
          readOnly={props.readOnly}
        />
        <Show when={gutterHunkIndex() !== null}>
          <div style={floatingToolbarStyle} onMouseLeave={handleGutterLeave}
            onClick={(e) => e.stopPropagation()}>
            <Show when={!props.staged}>
              <CortexTooltip content="Stage hunk" position="bottom">
                <CortexButton variant="ghost" size="xs" icon="plus"
                  loading={loading()} onClick={() => stageHunk(gutterHunkIndex()!)} title="Stage hunk" />
              </CortexTooltip>
            </Show>
            <Show when={props.staged}>
              <CortexTooltip content="Unstage hunk" position="bottom">
                <CortexButton variant="ghost" size="xs" icon="minus"
                  loading={loading()} onClick={() => unstageHunk(gutterHunkIndex()!)} title="Unstage hunk" />
              </CortexTooltip>
            </Show>
            <CortexTooltip content="Revert hunk" position="bottom">
              <CortexButton variant="ghost" size="xs" icon="rotate-left"
                loading={loading()} onClick={() => revertHunk(gutterHunkIndex()!)}
                title="Revert hunk" style={{ color: "var(--cortex-error, #F87171)" }} />
            </CortexTooltip>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default CortexDiffEditor;
