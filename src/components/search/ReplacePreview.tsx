import { Component, For, Show, createSignal, createMemo } from "solid-js";
import { CortexButton, CortexIcon } from "@/components/cortex/primitives";
import type { ReplacePreviewEntry, ReplacePreviewLine } from "@/types/workspace";

export interface ReplacePreviewProps {
  entries: ReplacePreviewEntry[];
  totalFiles: number;
  totalReplacements: number;
  onApply: () => void;
  onCancel: () => void;
  class?: string;
}

function extractFileName(uri: string): string {
  const idx = Math.max(uri.lastIndexOf("/"), uri.lastIndexOf("\\"));
  return idx >= 0 ? uri.slice(idx + 1) : uri;
}

function extractDirPath(uri: string): string {
  const clean = uri.replace(/^file:\/\//, "");
  const idx = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"));
  return idx >= 0 ? clean.slice(0, idx) : "";
}

interface FileEntryProps {
  entry: ReplacePreviewEntry;
  collapsed: boolean;
  onToggle: () => void;
}

const FileEntry: Component<FileEntryProps> = (props) => {
  const name = createMemo(() => extractFileName(props.entry.uri));
  const dir = createMemo(() => extractDirPath(props.entry.uri));

  const badge = createMemo(() => {
    const n = props.entry.totalReplacements;
    return `${n} replacement${n !== 1 ? "s" : ""}`;
  });

  return (
    <div class="border-b border-[var(--border-primary,#313244)]">
      <button
        type="button"
        class="flex items-center gap-1.5 w-full px-3 py-1.5 text-left cursor-pointer select-none hover:bg-[var(--bg-hover,#262637)] transition-colors"
        onClick={props.onToggle}
      >
        <CortexIcon
          name={props.collapsed ? "chevron-right" : "chevron-down"}
          size={12}
          class="shrink-0 text-[var(--text-secondary,#a6adc8)]"
        />
        <CortexIcon
          name="file"
          size={14}
          class="shrink-0 text-[var(--text-secondary,#a6adc8)]"
        />
        <span class="text-[13px] font-semibold text-[var(--text-primary,#cdd6f4)] shrink-0">
          {name()}
        </span>
        <Show when={dir()}>
          <span class="text-xs text-[var(--text-tertiary,#6c7086)] truncate min-w-0 flex-1">
            {dir()}
          </span>
        </Show>
        <span class="ml-auto shrink-0 text-[11px] text-[var(--text-secondary,#a6adc8)] bg-[var(--bg-tertiary,#1e1e2e)] px-2 py-px rounded-full">
          {badge()}
        </span>
      </button>

      <Show when={!props.collapsed}>
        <div class="overflow-x-auto pb-1">
          <For each={props.entry.lines}>
            {(line: ReplacePreviewLine) => <DiffLine line={line} />}
          </For>
        </div>
      </Show>
    </div>
  );
};

interface DiffLineProps {
  line: ReplacePreviewLine;
}

const DiffLine: Component<DiffLineProps> = (props) => {
  return (
    <div class="font-mono text-xs leading-5">
      <div class="flex items-center bg-[rgba(244,63,94,0.12)] border-l-[3px] border-l-[rgba(244,63,94,0.6)] px-2 py-px">
        <span class="w-4 shrink-0 text-center font-bold text-[rgba(244,63,94,0.8)] select-none">
          −
        </span>
        <span class="w-12 shrink-0 text-right pr-3 text-[var(--text-tertiary,#6c7086)] select-none">
          {props.line.lineNumber}
        </span>
        <pre class="flex-1 whitespace-pre overflow-hidden text-ellipsis text-[rgba(244,63,94,0.9)] min-w-0">
          {props.line.original}
        </pre>
      </div>

      <div class="flex items-center bg-[rgba(74,222,128,0.12)] border-l-[3px] border-l-[rgba(74,222,128,0.6)] px-2 py-px">
        <span class="w-4 shrink-0 text-center font-bold text-[rgba(74,222,128,0.8)] select-none">
          +
        </span>
        <span class="w-12 shrink-0 text-right pr-3 text-[var(--text-tertiary,#6c7086)] select-none">
          {props.line.lineNumber}
        </span>
        <pre class="flex-1 whitespace-pre overflow-hidden text-ellipsis text-[rgba(74,222,128,0.9)] min-w-0">
          {props.line.replaced}
        </pre>
      </div>
    </div>
  );
};

export const ReplacePreview: Component<ReplacePreviewProps> = (props) => {
  const [collapsedFiles, setCollapsedFiles] = createSignal<Set<string>>(new Set());

  const isCollapsed = (uri: string): boolean => collapsedFiles().has(uri);

  const toggleFile = (uri: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  };

  const allCollapsed = createMemo(() => {
    if (props.entries.length === 0) return false;
    const collapsed = collapsedFiles();
    return props.entries.every((e) => collapsed.has(e.uri));
  });

  const collapseAll = () => {
    setCollapsedFiles(new Set<string>(props.entries.map((e) => e.uri)));
  };

  const expandAll = () => {
    setCollapsedFiles(new Set<string>());
  };

  const summary = createMemo(() => {
    const f = props.totalFiles;
    const r = props.totalReplacements;
    return `${r} replacement${r !== 1 ? "s" : ""} across ${f} file${f !== 1 ? "s" : ""}`;
  });

  return (
    <div class={`flex flex-col h-full bg-[var(--bg-primary,#11111b)] text-[var(--text-primary,#cdd6f4)] text-[13px] ${props.class ?? ""}`}>
      <div class="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-primary,#313244)] bg-[var(--bg-secondary,#181825)] shrink-0">
        <CortexIcon
          name="replace"
          size={16}
          class="shrink-0 text-[var(--text-secondary,#a6adc8)]"
        />
        <span class="flex-1 text-xs text-[var(--text-secondary,#a6adc8)]">
          {summary()}
        </span>
        <CortexButton
          variant="ghost"
          size="xs"
          onClick={allCollapsed() ? expandAll : collapseAll}
          icon={allCollapsed() ? "chevrons-down" : "chevrons-up"}
          title={allCollapsed() ? "Expand All" : "Collapse All"}
        />
        <CortexButton variant="ghost" size="xs" onClick={props.onCancel} title="Cancel">
          Cancel
        </CortexButton>
        <CortexButton
          variant="primary"
          size="xs"
          onClick={props.onApply}
          icon="check"
          title="Apply all replacements"
          disabled={props.entries.length === 0}
        >
          Apply All
        </CortexButton>
      </div>

      <div class="flex-1 overflow-y-auto">
        <Show
          when={props.entries.length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center gap-2 py-8 px-4 text-[var(--text-secondary,#a6adc8)]">
              <CortexIcon name="search" size={24} class="opacity-40" />
              <span class="text-[13px]">No replacements to preview</span>
            </div>
          }
        >
          <For each={props.entries}>
            {(entry) => (
              <FileEntry
                entry={entry}
                collapsed={isCollapsed(entry.uri)}
                onToggle={() => toggleFile(entry.uri)}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};

export default ReplacePreview;
