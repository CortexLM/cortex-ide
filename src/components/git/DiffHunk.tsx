import { Show, For } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/design-system/tokens";
import { DiffLine, computeWordDiff, getLineBackground, getLineColor } from "./DiffLine";

export interface DiffLineData {
  type: "context" | "addition" | "deletion" | "header";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunkData {
  header: string;
  lines: DiffLineData[];
  collapsed?: boolean;
}

export interface DiffHunkProps {
  hunk: DiffHunkData;
  index: number;
  staged?: boolean;
  viewMode: "unified" | "split";
  onStageHunk: (index: number) => void;
  onUnstageHunk: (index: number) => void;
  onRevertHunk: (index: number) => void;
  stagingHunk: number | null;
  hoveredHunk: number | null;
  onHoverHunk: (index: number | null) => void;
  stagedHunks: Set<number>;
}

function HunkActionButton(props: {
  label: string;
  icon: string;
  color: string;
  loading: boolean;
  onClick: (e: MouseEvent) => void;
}) {
  return (
    <button
      class="flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-all hover:scale-105"
      style={{
        background: props.loading
          ? `color-mix(in srgb, ${props.color} 40%, transparent)`
          : `color-mix(in srgb, ${props.color} 20%, transparent)`,
        color: props.color,
        cursor: props.loading ? "wait" : "pointer",
      }}
      onClick={props.onClick}
      disabled={props.loading}
    >
      <Show when={props.loading} fallback={<Icon name={props.icon} class="w-3 h-3" />}>
        <Icon name="spinner" class="w-3 h-3 animate-spin" />
      </Show>
      <span>{props.label}</span>
    </button>
  );
}

export function DiffHunk(props: DiffHunkProps) {
  const isHovered = () => props.hoveredHunk === props.index;
  const isStaging = () => props.stagingHunk === props.index;
  const isStaged = () => props.stagedHunks.has(props.index);

  return (
    <div
      class="mb-4"
      onMouseEnter={() => props.onHoverHunk(props.index)}
      onMouseLeave={() => props.onHoverHunk(null)}
    >
      <div
        class="flex items-center justify-between px-4 py-1 sticky top-0 transition-all"
        style={{
          background: isHovered()
            ? `color-mix(in srgb, ${tokens.colors.semantic.primary} 20%, transparent)`
            : isStaged()
            ? `color-mix(in srgb, ${tokens.colors.semantic.success} 15%, transparent)`
            : `color-mix(in srgb, ${tokens.colors.semantic.primary} 10%, transparent)`,
          color: tokens.colors.semantic.primary,
        }}
      >
        <span class="font-mono text-xs">{props.hunk.header}</span>
        <div class="flex items-center gap-2">
          <Show when={isStaged()}>
            <span
              class="text-xs px-1.5 py-0.5 rounded"
              style={{ background: `color-mix(in srgb, ${tokens.colors.semantic.success} 30%, transparent)`, color: tokens.colors.semantic.success }}
            >
              <Icon name="check" class="w-3 h-3 inline-block mr-1" />
              Staged
            </span>
          </Show>
          <Show when={isHovered() || isStaging()}>
            <Show
              when={props.staged}
              fallback={
                <HunkActionButton
                  label="Stage"
                  icon="plus"
                  color={tokens.colors.semantic.success}
                  loading={isStaging()}
                  onClick={(e) => { e.stopPropagation(); if (!isStaging()) props.onStageHunk(props.index); }}
                />
              }
            >
              <HunkActionButton
                label="Unstage"
                icon="minus"
                color={tokens.colors.semantic.error}
                loading={isStaging()}
                onClick={(e) => { e.stopPropagation(); if (!isStaging()) props.onUnstageHunk(props.index); }}
              />
            </Show>
            <Show when={!props.staged}>
              <HunkActionButton
                label="Revert"
                icon="rotate-left"
                color={tokens.colors.semantic.warning}
                loading={isStaging()}
                onClick={(e) => { e.stopPropagation(); if (!isStaging()) props.onRevertHunk(props.index); }}
              />
            </Show>
          </Show>
        </div>
      </div>

      <Show when={props.viewMode === "unified"}>
        <For each={props.hunk.lines}>
          {(line, lineIndex) => {
            const wordDiff = () => {
              if (line.type === "deletion" && props.hunk.lines[lineIndex() + 1]?.type === "addition") {
                return computeWordDiff(line.content, props.hunk.lines[lineIndex() + 1].content);
              }
              if (line.type === "addition" && lineIndex() > 0 && props.hunk.lines[lineIndex() - 1]?.type === "deletion") {
                return computeWordDiff(props.hunk.lines[lineIndex() - 1].content, line.content);
              }
              return null;
            };
            return (
              <DiffLine
                type={line.type}
                content={line.content}
                oldLineNumber={line.oldLineNumber}
                newLineNumber={line.newLineNumber}
                wordDiff={wordDiff()}
                viewMode="unified"
              />
            );
          }}
        </For>
      </Show>

      <Show when={props.viewMode === "split"}>
        <SplitHunkView hunk={props.hunk} />
      </Show>
    </div>
  );
}

function SplitHunkView(props: { hunk: DiffHunkData }) {
  const splitLines = () => {
    const left: (DiffLineData | null)[] = [];
    const right: (DiffLineData | null)[] = [];
    let i = 0;
    while (i < props.hunk.lines.length) {
      const line = props.hunk.lines[i];
      if (line.type === "context") {
        left.push(line); right.push(line); i++;
      } else if (line.type === "deletion") {
        const next = props.hunk.lines[i + 1];
        if (next && next.type === "addition") {
          left.push(line); right.push(next); i += 2;
        } else {
          left.push(line); right.push(null); i++;
        }
      } else if (line.type === "addition") {
        left.push(null); right.push(line); i++;
      } else { i++; }
    }
    return { left, right };
  };

  return (
    <div class="flex">
      <div class="flex-1 border-r" style={{ "border-color": tokens.colors.border.divider }}>
        <For each={splitLines().left}>
          {(line) => (
            <div class="flex" style={{ background: line ? getLineBackground(line.type === "context" ? "context" : "deletion") : "transparent" }}>
              <span class="w-10 shrink-0 text-right pr-2 select-none" style={{ color: tokens.colors.text.muted }}>
                {line?.oldLineNumber ?? ""}
              </span>
              <pre class="flex-1 px-2 py-0" style={{ color: line ? getLineColor(line.type === "context" ? "context" : "deletion") : "" }}>
                {line?.content ?? ""}
              </pre>
            </div>
          )}
        </For>
      </div>
      <div class="flex-1">
        <For each={splitLines().right}>
          {(line) => (
            <div class="flex" style={{ background: line ? getLineBackground(line.type === "context" ? "context" : "addition") : "transparent" }}>
              <span class="w-10 shrink-0 text-right pr-2 select-none" style={{ color: tokens.colors.text.muted }}>
                {line?.newLineNumber ?? ""}
              </span>
              <pre class="flex-1 px-2 py-0" style={{ color: line ? getLineColor(line.type === "context" ? "context" : "addition") : "" }}>
                {line?.content ?? ""}
              </pre>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
