import { Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";

export interface DiffHunkToolbarProps {
  hunkIndex: number;
  totalHunks: number;
  additions: number;
  deletions: number;
  header: string;
  onStage?: () => void;
  onUnstage?: () => void;
  onRevert?: () => void;
  onNavigateNext?: () => void;
  onNavigatePrev?: () => void;
  showStage?: boolean;
  showUnstage?: boolean;
}

export function DiffHunkToolbar(props: DiffHunkToolbarProps) {
  const canNavigatePrev = () => props.hunkIndex > 0;
  const canNavigateNext = () => props.hunkIndex < props.totalHunks - 1;

  return (
    <div
      class="flex items-center gap-1 px-2 py-1 border-b"
      style={{
        background: "var(--surface-base)",
        "border-color": "var(--border-weak)",
      }}
    >
      <span
        class="text-xs font-mono flex-1 truncate"
        style={{ color: "var(--text-weak)" }}
      >
        {props.header}
      </span>

      <div class="flex items-center gap-1">
        <span
          class="text-xs tabular-nums"
          style={{ color: "var(--text-weak)" }}
        >
          {props.hunkIndex + 1}/{props.totalHunks}
        </span>

        <Show when={props.additions > 0}>
          <span class="text-xs" style={{ color: "var(--cortex-success)" }}>
            +{props.additions}
          </span>
        </Show>
        <Show when={props.deletions > 0}>
          <span class="text-xs" style={{ color: "var(--cortex-error)" }}>
            -{props.deletions}
          </span>
        </Show>
      </div>

      <div
        class="flex items-center gap-0.5 ml-2"
        style={{ "border-left": "1px solid var(--border-weak)", "padding-left": "6px" }}
      >
        <button
          class="p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-30"
          onClick={() => props.onNavigatePrev?.()}
          disabled={!canNavigatePrev()}
          title="Previous hunk"
        >
          <Icon name="chevron-up" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
        </button>
        <button
          class="p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-30"
          onClick={() => props.onNavigateNext?.()}
          disabled={!canNavigateNext()}
          title="Next hunk"
        >
          <Icon name="chevron-down" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
        </button>
      </div>

      <div
        class="flex items-center gap-0.5 ml-1"
        style={{ "border-left": "1px solid var(--border-weak)", "padding-left": "6px" }}
      >
        <Show when={props.showStage !== false}>
          <button
            class="p-1 rounded hover:bg-white/10 transition-colors"
            onClick={() => props.onStage?.()}
            title="Stage hunk"
          >
            <Icon name="plus" class="w-3.5 h-3.5" style={{ color: "var(--cortex-success)" }} />
          </button>
        </Show>
        <Show when={props.showUnstage}>
          <button
            class="p-1 rounded hover:bg-white/10 transition-colors"
            onClick={() => props.onUnstage?.()}
            title="Unstage hunk"
          >
            <Icon name="minus" class="w-3.5 h-3.5" style={{ color: "var(--cortex-warning)" }} />
          </button>
        </Show>
        <button
          class="p-1 rounded hover:bg-white/10 transition-colors"
          onClick={() => props.onRevert?.()}
          title="Revert hunk"
        >
          <Icon name="rotate-left" class="w-3.5 h-3.5" style={{ color: "var(--cortex-error)" }} />
        </button>
      </div>
    </div>
  );
}
