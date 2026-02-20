/**
 * InlineDiff - SolidJS component for inline diff display.
 *
 * Shows color-coded additions and deletions with character-level highlighting.
 * Uses Tauri IPC to compute diffs from the backend, with a local fallback.
 * Provides accept/reject actions for applying or discarding changes.
 */

import { createSignal, createEffect, Show, For, createMemo } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type { InlineDiffResult, InlineDiffLine, InlineDiffCharChange } from "@/sdk/ipc";
import { editorLogger } from "@/utils/logger";

// ============================================================================
// Types
// ============================================================================

type DiffLineWithType = {
  tag: "equal" | "insert" | "delete";
  content: string;
  originalLine: number | null;
  modifiedLine: number | null;
  charChanges?: Array<{ start: number; end: number }>;
};

export interface InlineDiffProps {
  original: string;
  modified: string;
  language?: string;
  onAccept?: () => void;
  onReject?: () => void;
}

// ============================================================================
// Diff Computation Fallback
// ============================================================================

function computeLocalDiff(original: string, modified: string): DiffLineWithType[] {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");
  const result: DiffLineWithType[] = [];

  const m = origLines.length;
  const n = modLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = origLines[i - 1] === modLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  let i = m;
  let j = n;
  const stack: DiffLineWithType[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === modLines[j - 1]) {
      stack.push({ tag: "equal", content: origLines[i - 1], originalLine: i, modifiedLine: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ tag: "insert", content: modLines[j - 1], originalLine: null, modifiedLine: j });
      j--;
    } else if (i > 0) {
      stack.push({ tag: "delete", content: origLines[i - 1], originalLine: i, modifiedLine: null });
      i--;
    }
  }

  while (stack.length > 0) {
    result.push(stack.pop()!);
  }

  return result;
}

function computeCharChanges(oldText: string, newText: string): Array<{ start: number; end: number }> {
  const changes: Array<{ start: number; end: number }> = [];
  const minLen = Math.min(oldText.length, newText.length);
  let start = -1;

  for (let i = 0; i < minLen; i++) {
    if (oldText[i] !== newText[i]) {
      if (start === -1) start = i;
    } else if (start !== -1) {
      changes.push({ start, end: i });
      start = -1;
    }
  }

  if (start !== -1 || oldText.length !== newText.length) {
    changes.push({ start: start === -1 ? minLen : start, end: Math.max(oldText.length, newText.length) });
  }

  return changes;
}

// ============================================================================
// Component
// ============================================================================

export function InlineDiff(props: InlineDiffProps) {
  const [diffLines, setDiffLines] = createSignal<DiffLineWithType[]>([]);
  const [loading, setLoading] = createSignal(false);

  const addedCount = createMemo(() => diffLines().filter((l) => l.tag === "insert").length);
  const deletedCount = createMemo(() => diffLines().filter((l) => l.tag === "delete").length);

  function mapBackendLine(line: InlineDiffLine): DiffLineWithType {
    return {
      tag: line.changeType,
      content: line.content,
      originalLine: line.oldLineNumber,
      modifiedLine: line.newLineNumber,
      charChanges: line.charChanges?.map((c: InlineDiffCharChange) => {
        return { start: 0, end: c.value.length };
      }),
    };
  }

  async function computeDiff() {
    if (!props.original && !props.modified) {
      setDiffLines([]);
      return;
    }

    setLoading(true);
    try {
      const result = await invoke<InlineDiffResult>("compute_inline_diff", {
        original: props.original,
        modified: props.modified,
      });
      const mapped = result.lines.map(mapBackendLine);
      setDiffLines(enrichWithCharChanges(mapped));
    } catch (error) {
      editorLogger.warn("[InlineDiff] Backend diff failed, using local fallback:", error);
      const lines = computeLocalDiff(props.original, props.modified);
      setDiffLines(enrichWithCharChanges(lines));
    } finally {
      setLoading(false);
    }
  }

  function enrichWithCharChanges(lines: DiffLineWithType[]): DiffLineWithType[] {
    const enriched: DiffLineWithType[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.tag === "delete" && i + 1 < lines.length && lines[i + 1].tag === "insert") {
        const next = lines[i + 1];
        const changes = computeCharChanges(line.content, next.content);
        enriched.push({ ...line, charChanges: changes });
        enriched.push({ ...next, charChanges: changes });
        i++;
      } else {
        enriched.push(line);
      }
    }

    return enriched;
  }

  createEffect(() => {
    void props.original;
    void props.modified;
    computeDiff();
  });

  return (
    <div class="overflow-hidden rounded border border-[var(--cortex-border,#333)] bg-[var(--cortex-bg-secondary,#252526)]">
      {/* Header */}
      <div class="flex h-7 items-center justify-between border-b border-[var(--cortex-border,#333)] bg-[var(--cortex-bg-primary,#1e1e1e)] px-3 text-xs">
        <div class="flex items-center gap-3">
          <span class="text-[var(--cortex-text-secondary,#ccc)]">Inline Diff</span>
          <Show when={!loading()}>
            <span class="text-green-400">+{addedCount()}</span>
            <span class="text-red-400">-{deletedCount()}</span>
          </Show>
        </div>
        <div class="flex items-center gap-1">
          <Show when={props.onAccept}>
            <button
              class="rounded px-2 py-0.5 text-green-400 hover:bg-green-400/10"
              onClick={() => props.onAccept?.()}
              title="Accept changes"
            >
              ✓ Accept
            </button>
          </Show>
          <Show when={props.onReject}>
            <button
              class="rounded px-2 py-0.5 text-red-400 hover:bg-red-400/10"
              onClick={() => props.onReject?.()}
              title="Reject changes"
            >
              ✕ Reject
            </button>
          </Show>
        </div>
      </div>

      {/* Diff Content */}
      <div class="max-h-[400px] overflow-auto font-mono text-xs">
        <Show when={loading()}>
          <div class="flex items-center justify-center p-4 text-[var(--cortex-text-inactive,#666)]">
            Computing diff...
          </div>
        </Show>
        <Show when={!loading()}>
          <For each={diffLines()}>
            {(line) => (
              <div
                class="flex whitespace-pre"
                classList={{
                  "bg-green-500/10": line.tag === "insert",
                  "bg-red-500/10": line.tag === "delete",
                }}
              >
                <span class="inline-block w-10 shrink-0 select-none pr-1 text-right tabular-nums text-[var(--cortex-text-inactive,#666)]">
                  {line.originalLine ?? ""}
                </span>
                <span class="inline-block w-10 shrink-0 select-none pr-1 text-right tabular-nums text-[var(--cortex-text-inactive,#666)]">
                  {line.modifiedLine ?? ""}
                </span>
                <span
                  class="inline-block w-4 shrink-0 select-none text-center"
                  classList={{
                    "text-green-400": line.tag === "insert",
                    "text-red-400": line.tag === "delete",
                    "text-[var(--cortex-text-inactive,#666)]": line.tag === "equal",
                  }}
                >
                  {line.tag === "insert" ? "+" : line.tag === "delete" ? "-" : " "}
                </span>
                <span class="text-[var(--cortex-text-primary,#d4d4d4)]">{line.content}</span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
