import { createSignal, createEffect, For, Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { DiffHunkToolbar } from "./DiffHunkToolbar";
import {
  gitStageHunk, gitUnstageHunk, gitRevertHunk, gitGetHunks, gitDiffStaged,
  type StructuredDiff, type DiffHunkData, type DiffLine, type HunkNavigationData,
} from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";

type DiffViewMode = "unified" | "side-by-side";

interface WordChange { value: string; added?: boolean; removed?: boolean }

export interface InlineDiffEditorProps {
  filePath: string;
  staged?: boolean;
  onHunkAction?: () => void;
}

function computeWordDiff(oldLine: string, newLine: string) {
  const oldWords = oldLine.split(/(\s+)/);
  const newWords = newLine.split(/(\s+)/);
  const oldResult: WordChange[] = [];
  const newResult: WordChange[] = [];
  let i = 0, j = 0;
  while (i < oldWords.length || j < newWords.length) {
    if (i >= oldWords.length) { newResult.push({ value: newWords[j++], added: true }); }
    else if (j >= newWords.length) { oldResult.push({ value: oldWords[i++], removed: true }); }
    else if (oldWords[i] === newWords[j]) {
      oldResult.push({ value: oldWords[i] }); newResult.push({ value: newWords[j] }); i++; j++;
    } else {
      oldResult.push({ value: oldWords[i++], removed: true });
      newResult.push({ value: newWords[j++], added: true });
    }
  }
  return { old: oldResult, new: newResult };
}

function WordDiffSpans(p: { words: WordChange[]; type: "addition" | "deletion" }) {
  return (
    <For each={p.words}>
      {(word) => {
        const hl = p.type === "addition" ? word.added : word.removed;
        return <span style={{
          background: hl ? (p.type === "addition" ? "rgba(46,160,67,0.4)" : "rgba(248,81,73,0.4)") : "transparent",
          "border-radius": hl ? "2px" : "0",
        }}>{word.value}</span>;
      }}
    </For>
  );
}

const lineColor = (t: string) => t === "addition" ? "var(--cortex-success)" : t === "deletion" ? "var(--cortex-error)" : "var(--text-base)";
const lineClass = (t: string) => t === "addition" ? "bg-green-500/10" : t === "deletion" ? "bg-red-500/10" : "";
const linePrefix = (t: string) => t === "addition" ? "+" : t === "deletion" ? "-" : " ";

function wordDiffFor(line: DiffLine, lines: DiffLine[], idx: number) {
  if (line.changeType === "deletion" && lines[idx + 1]?.changeType === "addition")
    return computeWordDiff(line.content, lines[idx + 1].content);
  if (line.changeType === "addition" && idx > 0 && lines[idx - 1]?.changeType === "deletion")
    return computeWordDiff(lines[idx - 1].content, line.content);
  return null;
}

export function InlineDiffEditor(props: InlineDiffEditorProps) {
  const [viewMode, setViewMode] = createSignal<DiffViewMode>("unified");
  const [diffData, setDiffData] = createSignal<StructuredDiff | null>(null);
  const [hunkNav, setHunkNav] = createSignal<HunkNavigationData | null>(null);
  const [loading, setLoading] = createSignal(false);

  createEffect(() => { if (props.filePath) fetchDiff(); });

  const fetchDiff = async () => {
    setLoading(true);
    try {
      const pp = getProjectPath();
      const [diffs, hunks] = await Promise.all([
        props.staged ? gitDiffStaged(pp, props.filePath) : gitDiffStaged(pp, props.filePath).catch(() => [] as StructuredDiff[]),
        gitGetHunks(pp, props.filePath, props.staged),
      ]);
      setDiffData(diffs.find((d) => d.filePath === props.filePath) ?? diffs[0] ?? null);
      setHunkNav(hunks);
    } catch { setDiffData(null); setHunkNav(null); }
    finally { setLoading(false); }
  };

  const hunkAction = async (fn: (p: string, f: string, i: number) => Promise<void>, idx: number) => {
    try { await fn(getProjectPath(), props.filePath, idx); props.onHunkAction?.(); fetchDiff(); } catch { /* silent */ }
  };

  const navigateToHunk = (idx: number) => {
    const hunks = diffData()?.hunks;
    if (hunks && idx >= 0 && idx < hunks.length)
      document.getElementById(`hunk-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toolbar = (hunk: DiffHunkData, idx: number, total: number) => (
    <DiffHunkToolbar
      hunkIndex={idx} totalHunks={total}
      additions={hunk.lines.filter((l) => l.changeType === "addition").length}
      deletions={hunk.lines.filter((l) => l.changeType === "deletion").length}
      header={hunk.header}
      onStage={() => hunkAction(gitStageHunk, idx)}
      onUnstage={props.staged ? () => hunkAction(gitUnstageHunk, idx) : undefined}
      onRevert={() => hunkAction(gitRevertHunk, idx)}
      onNavigateNext={() => navigateToHunk(idx + 1)}
      onNavigatePrev={() => navigateToHunk(idx - 1)}
      showStage={!props.staged} showUnstage={props.staged}
    />
  );

  const cellStyle = { color: "var(--text-weaker)", "border-color": "var(--border-weak)" } as const;

  const renderUnified = (hunks: DiffHunkData[]) => (
    <For each={hunks}>
      {(hunk, hi) => (
        <div id={`hunk-${hi()}`}>
          {toolbar(hunk, hi(), hunks.length)}
          <table class="w-full font-mono text-xs border-collapse"><tbody>
            <For each={hunk.lines}>
              {(line, li) => {
                const wd = wordDiffFor(line, hunk.lines, li());
                return (
                  <tr class={lineClass(line.changeType)}>
                    <td class="w-12 px-2 text-right select-none border-r" style={cellStyle}>{line.oldLineNo ?? ""}</td>
                    <td class="w-12 px-2 text-right select-none border-r" style={cellStyle}>{line.newLineNo ?? ""}</td>
                    <td class="w-4 text-center select-none" style={{ color: lineColor(line.changeType) }}>{linePrefix(line.changeType)}</td>
                    <td class="px-2">
                      <pre class="whitespace-pre" style={{ color: lineColor(line.changeType) }}>
                        {wd ? <WordDiffSpans words={line.changeType === "deletion" ? wd.old : wd.new} type={line.changeType as "addition" | "deletion"} /> : line.content}
                      </pre>
                    </td>
                  </tr>
                );
              }}
            </For>
          </tbody></table>
        </div>
      )}
    </For>
  );

  const renderSideBySide = (hunks: DiffHunkData[]) => (
    <For each={hunks}>
      {(hunk, hi) => (
        <div id={`hunk-${hi()}`}>
          {toolbar(hunk, hi(), hunks.length)}
          <div class="flex">
            <div class="flex-1 overflow-auto border-r" style={{ "border-color": "var(--border-weak)" }}>
              <table class="w-full font-mono text-xs border-collapse"><tbody>
                <For each={hunk.lines.filter((l) => l.changeType !== "addition")}>
                  {(line) => (
                    <tr class={line.changeType === "deletion" ? "bg-red-500/10" : ""}>
                      <td class="w-12 px-2 text-right select-none" style={{ color: "var(--text-weaker)" }}>{line.oldLineNo ?? ""}</td>
                      <td class="px-2">
                        <pre class="whitespace-pre" style={{ color: line.changeType === "deletion" ? "var(--cortex-error)" : "var(--text-base)" }}>{line.content}</pre>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody></table>
            </div>
            <div class="flex-1 overflow-auto">
              <table class="w-full font-mono text-xs border-collapse"><tbody>
                <For each={hunk.lines.filter((l) => l.changeType !== "deletion")}>
                  {(line) => (
                    <tr class={line.changeType === "addition" ? "bg-green-500/10" : ""}>
                      <td class="w-12 px-2 text-right select-none" style={{ color: "var(--text-weaker)" }}>{line.newLineNo ?? ""}</td>
                      <td class="px-2">
                        <pre class="whitespace-pre" style={{ color: line.changeType === "addition" ? "var(--cortex-success)" : "var(--text-base)" }}>{line.content}</pre>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody></table>
            </div>
          </div>
        </div>
      )}
    </For>
  );

  return (
    <div class="h-full flex flex-col overflow-hidden" style={{ background: "var(--background-base)" }}>
      <div class="flex items-center justify-between px-3 py-2 border-b shrink-0" style={{ "border-color": "var(--border-weak)" }}>
        <div class="flex items-center gap-2">
          <Icon name="code-compare" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          <span class="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>{props.filePath}</span>
          <Show when={hunkNav()}>
            <span class="text-xs" style={{ color: "var(--cortex-success)" }}>+{hunkNav()!.totalAdditions}</span>
            <span class="text-xs" style={{ color: "var(--cortex-error)" }}>-{hunkNav()!.totalDeletions}</span>
          </Show>
        </div>
        <div class="flex items-center gap-1">
          <button class={`px-2 py-1 rounded text-xs ${viewMode() === "unified" ? "bg-white/10" : ""}`}
            style={{ color: "var(--text-weak)" }} onClick={() => setViewMode("unified")}>Unified</button>
          <button class={`px-2 py-1 rounded text-xs ${viewMode() === "side-by-side" ? "bg-white/10" : ""}`}
            style={{ color: "var(--text-weak)" }} onClick={() => setViewMode("side-by-side")}>Side by Side</button>
          <button class="p-1 rounded hover:bg-white/10 transition-colors" onClick={fetchDiff} disabled={loading()}>
            <Icon name="rotate" class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`} style={{ color: "var(--text-weak)" }} />
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-auto">
        <Show when={loading()}>
          <div class="flex items-center justify-center h-32">
            <span style={{ color: "var(--text-weak)" }}>Loading diff...</span>
          </div>
        </Show>
        <Show when={!loading() && diffData()}>
          {viewMode() === "unified" ? renderUnified(diffData()!.hunks) : renderSideBySide(diffData()!.hunks)}
        </Show>
        <Show when={!loading() && !diffData()}>
          <div class="flex items-center justify-center h-32">
            <span style={{ color: "var(--text-weak)" }}>No changes</span>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default InlineDiffEditor;
