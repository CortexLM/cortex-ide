import { Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/design-system/tokens";

export interface DiffToolbarProps {
  filePath?: string;
  oldPath?: string;
  staged?: boolean;
  additions: number;
  deletions: number;
  viewMode: "unified" | "split";
  isFullscreen: boolean;
  editMode: boolean;
  editLoading: boolean;
  savingEdit: boolean;
  copied: boolean;
  onViewModeChange: (mode: "unified" | "split") => void;
  onToggleFullscreen: () => void;
  onCopyDiff: () => void;
  onEnterEditMode?: () => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  onClose?: () => void;
}

export function DiffToolbar(props: DiffToolbarProps) {
  return (
    <div
      class="flex items-center justify-between px-3 py-2 border-b shrink-0"
      style={{ "border-color": tokens.colors.border.divider }}
    >
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium" style={{ color: tokens.colors.text.primary }}>
          {props.filePath || "Diff View"}
        </span>
        <Show when={props.oldPath && props.oldPath !== props.filePath}>
          <span class="text-xs" style={{ color: tokens.colors.text.muted }}>← {props.oldPath}</span>
        </Show>
        <Show when={props.staged}>
          <span
            class="text-xs px-1.5 py-0.5 rounded"
            style={{ background: tokens.colors.semantic.primary, color: "white" }}
          >
            Staged
          </span>
        </Show>
        <div class="flex items-center gap-2 ml-2">
          <span class="text-xs text-green-400">+{props.additions}</span>
          <span class="text-xs text-red-400">-{props.deletions}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Show when={props.editMode}>
          <button
            class="flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors"
            style={{
              background: props.savingEdit
                ? `color-mix(in srgb, ${tokens.colors.semantic.success} 40%, transparent)`
                : `color-mix(in srgb, ${tokens.colors.semantic.success} 20%, transparent)`,
              color: tokens.colors.semantic.success,
              cursor: props.savingEdit ? "wait" : "pointer",
            }}
            onClick={() => props.onSaveEdit?.()}
            disabled={props.savingEdit}
            title="Save changes"
          >
            <Show when={props.savingEdit} fallback={<Icon name="floppy-disk" class="w-3.5 h-3.5" />}>
              <Icon name="spinner" class="w-3.5 h-3.5 animate-spin" />
            </Show>
            <span>Save</span>
          </button>
          <button
            class="flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors hover:bg-white/10"
            style={{ color: tokens.colors.text.muted }}
            onClick={() => props.onCancelEdit?.()}
            disabled={props.savingEdit}
            title="Cancel editing"
          >
            <Icon name="xmark" class="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
          <div class="w-px h-4" style={{ background: tokens.colors.border.divider }} />
        </Show>
        <Show when={!props.editMode && !props.staged && props.filePath}>
          <button
            class="flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors hover:bg-white/10"
            style={{ color: tokens.colors.text.muted, cursor: props.editLoading ? "wait" : "pointer" }}
            onClick={() => props.onEnterEditMode?.()}
            disabled={props.editLoading}
            title="Edit file inline"
          >
            <Show when={props.editLoading} fallback={<Icon name="pen" class="w-3.5 h-3.5" />}>
              <Icon name="spinner" class="w-3.5 h-3.5 animate-spin" />
            </Show>
            <span>Edit</span>
          </button>
        </Show>
        <button class="p-1.5 rounded hover:bg-white/10 transition-colors" onClick={props.onCopyDiff} title="Copy diff">
          {props.copied
            ? <Icon name="check" class="w-4 h-4 text-green-400" />
            : <Icon name="copy" class="w-4 h-4" style={{ color: tokens.colors.text.muted }} />}
        </button>
        <div class="flex rounded overflow-hidden" style={{ background: tokens.colors.interactive.hover }}>
          <button
            class="px-2 py-1 text-xs transition-colors"
            style={{
              background: props.viewMode === "unified" ? tokens.colors.semantic.primary : "transparent",
              color: props.viewMode === "unified" ? "white" : tokens.colors.text.muted,
            }}
            onClick={() => props.onViewModeChange("unified")}
          >
            Unified
          </button>
          <button
            class="px-2 py-1 text-xs transition-colors"
            style={{
              background: props.viewMode === "split" ? tokens.colors.semantic.primary : "transparent",
              color: props.viewMode === "split" ? "white" : tokens.colors.text.muted,
            }}
            onClick={() => props.onViewModeChange("split")}
          >
            Split
          </button>
        </div>
        <button
          class="p-1.5 rounded hover:bg-white/10 transition-colors"
          onClick={props.onToggleFullscreen}
          title={props.isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          <Icon
            name={props.isFullscreen ? "minimize" : "maximize"}
            class="w-4 h-4"
            style={{ color: tokens.colors.text.muted }}
          />
        </button>
        <Show when={props.onClose}>
          <button class="p-1 rounded hover:bg-white/10 transition-colors" onClick={props.onClose}>
            <Icon name="xmark" class="w-4 h-4" style={{ color: tokens.colors.text.muted }} />
          </button>
        </Show>
      </div>
    </div>
  );
}
