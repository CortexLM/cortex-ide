import {
  Component,
  For,
  Show,
  createSignal,
} from "solid-js";
import {
  CortexModal,
  CortexIcon,
} from "@/components/cortex/primitives";

export interface ReplacePreviewEntry {
  filePath: string;
  originalLines: string[];
  modifiedLines: string[];
  matchCount: number;
}

export interface SearchReplacePreviewProps {
  open: boolean;
  onClose: () => void;
  entries: ReplacePreviewEntry[];
  totalReplacements: number;
  totalFiles: number;
  replaceText: string;
  onConfirmReplace: () => void;
  class?: string;
}

export const SearchReplacePreview: Component<SearchReplacePreviewProps> = (props) => {
  const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(new Set());

  const toggleFile = (filePath: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const isExpanded = (filePath: string): boolean => {
    return expandedFiles().has(filePath);
  };

  const extractFileName = (filePath: string): string => {
    const parts = filePath.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || filePath;
  };

  return (
    <CortexModal
      open={props.open}
      onClose={props.onClose}
      title="Replace Preview"
      size="lg"
      closable
      closeOnOverlay
      closeOnEscape
      showFooter
      confirmText={`Replace ${props.totalReplacements} matches`}
      cancelText="Cancel"
      onConfirm={props.onConfirmReplace}
      onCancel={props.onClose}
    >
      <div class="flex flex-col gap-3 max-h-[60vh] overflow-auto">
        <div class="flex items-center gap-2 px-3 py-2 bg-[var(--cortex-bg-secondary)] rounded-lg text-sm">
          <CortexIcon name="info" size={16} />
          <span class="text-[var(--cortex-text-secondary)]">
            {props.totalReplacements} replacements across {props.totalFiles} files
          </span>
          <span class="text-[var(--cortex-text-muted)]">→</span>
          <span class="font-mono text-[var(--cortex-accent-primary)]">
            "{props.replaceText}"
          </span>
        </div>

        <For each={props.entries}>
          {(entry) => (
            <div class="border border-[var(--cortex-border-default)] rounded-lg overflow-hidden">
              <div
                class="flex items-center gap-2 px-3 py-2 cursor-pointer bg-[var(--cortex-bg-secondary)] hover:bg-[var(--cortex-bg-hover)]"
                onClick={() => toggleFile(entry.filePath)}
              >
                <span class="text-xs text-[var(--cortex-text-muted)]">
                  {isExpanded(entry.filePath) ? "▼" : "▶"}
                </span>
                <CortexIcon name="file" size={14} />
                <span class="text-[13px] font-medium text-[var(--cortex-text-primary)] truncate">
                  {extractFileName(entry.filePath)}
                </span>
                <span class="text-[11px] text-[var(--cortex-text-muted)] truncate flex-1">
                  {entry.filePath}
                </span>
                <span class="text-[10px] bg-[var(--cortex-accent-muted)] text-[var(--cortex-accent-primary)] px-1.5 py-0.5 rounded-full">
                  {entry.matchCount}
                </span>
              </div>

              <Show when={isExpanded(entry.filePath)}>
                <div class="font-mono text-[12px] leading-5">
                  <For each={entry.originalLines}>
                    {(line, idx) => {
                      const modifiedLine = () => entry.modifiedLines[idx()] || "";
                      const isChanged = () => line !== modifiedLine();

                      return (
                        <Show
                          when={isChanged()}
                          fallback={
                            <div class="px-3 py-0 text-[var(--cortex-text-secondary)] bg-transparent">
                              <span class="inline-block w-4 text-center text-[var(--cortex-text-muted)]"> </span>
                              {line}
                            </div>
                          }
                        >
                          <div class="px-3 py-0 bg-[rgba(239,68,68,0.1)] text-[var(--cortex-text-secondary)]">
                            <span class="inline-block w-4 text-center text-red-400">-</span>
                            {line}
                          </div>
                          <div class="px-3 py-0 bg-[rgba(34,197,94,0.1)] text-[var(--cortex-text-secondary)]">
                            <span class="inline-block w-4 text-center text-green-400">+</span>
                            {modifiedLine()}
                          </div>
                        </Show>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>
          )}
        </For>

        <Show when={props.entries.length === 0}>
          <div class="flex items-center justify-center p-8 text-[var(--cortex-text-muted)] text-sm">
            No changes to preview
          </div>
        </Show>
      </div>
    </CortexModal>
  );
};

export default SearchReplacePreview;
