import { Show, createSignal } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import type { CellType } from "@/context/NotebookContext";

export interface CellToolbarProps {
  cellType: CellType;
  isEditing: boolean;
  onRun: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChangeCellType: (type: CellType) => void;
  onToggleEdit: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSplit?: () => void;
  onJoin?: () => void;
  onDuplicate?: () => void;
  onToggleCollapse?: () => void;
  isCollapsed?: boolean;
}

export function CellToolbar(props: CellToolbarProps) {
  const [showTypeMenu, setShowTypeMenu] = createSignal(false);

  const cellTypeLabel = () => {
    switch (props.cellType) {
      case "code":
        return "Code";
      case "markdown":
        return "Markdown";
      case "raw":
        return "Raw";
    }
  };

  const cellTypeIcon = () => {
    switch (props.cellType) {
      case "code":
        return <Icon name="code" class="w-3.5 h-3.5" />;
      case "markdown":
        return <Icon name="file-lines" class="w-3.5 h-3.5" />;
      case "raw":
        return <Icon name="font" class="w-3.5 h-3.5" />;
    }
  };

  const typeOptions: { type: CellType; label: string; icon: string }[] = [
    { type: "code", label: "Code", icon: "code" },
    { type: "markdown", label: "Markdown", icon: "file-lines" },
    { type: "raw", label: "Raw", icon: "font" },
  ];

  return (
    <div
      class="cell-toolbar flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ "min-height": "28px" }}
    >
      <Show when={props.cellType === "code"}>
        <button
          onClick={() => props.onRun()}
          class="p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
          title="Run cell (Shift+Enter)"
        >
          <Icon name="play" class="w-3.5 h-3.5" style={{ color: "var(--success)" }} />
        </button>
      </Show>

      <Show when={props.cellType === "markdown"}>
        <button
          onClick={() => props.onToggleEdit()}
          class="p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
          title={props.isEditing ? "Preview markdown" : "Edit markdown"}
        >
          <Show when={props.isEditing} fallback={<Icon name="pen" class="w-3.5 h-3.5" />}>
            <Icon name="eye" class="w-3.5 h-3.5" />
          </Show>
        </button>
      </Show>

      <div class="relative">
        <button
          onClick={() => setShowTypeMenu(!showTypeMenu())}
          class="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--surface-hover)] transition-colors text-xs"
          style={{ color: "var(--text-weak)" }}
        >
          {cellTypeIcon()}
          <span>{cellTypeLabel()}</span>
          <Icon name="chevron-down" class="w-3 h-3" />
        </button>

        <Show when={showTypeMenu()}>
          <div
            class="absolute top-full left-0 mt-1 py-1 rounded shadow-lg z-50"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-base)",
              "min-width": "120px",
            }}
          >
            {typeOptions.map((opt) => (
              <button
                onClick={() => {
                  props.onChangeCellType(opt.type);
                  setShowTypeMenu(false);
                }}
                class="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--surface-hover)] transition-colors"
                style={{
                  color: props.cellType === opt.type ? "var(--accent)" : "var(--text-base)",
                }}
              >
                <Icon name={opt.icon} class="w-3.5 h-3.5" />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </Show>
      </div>

      <Show when={props.onDuplicate}>
        <button
          onClick={() => props.onDuplicate?.()}
          class="p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
          title="Duplicate cell"
        >
          <Icon name="copy" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
        </button>
      </Show>

      <Show when={props.onSplit}>
        <button
          onClick={() => props.onSplit?.()}
          class="p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
          title="Split cell"
        >
          <Icon name="scissors" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
        </button>
      </Show>

      <Show when={props.onJoin}>
        <button
          onClick={() => props.onJoin?.()}
          class="p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
          title="Join with cell below"
        >
          <Icon name="link" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
        </button>
      </Show>

      <Show when={props.onToggleCollapse}>
        <button
          onClick={() => props.onToggleCollapse?.()}
          class="p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
          title={props.isCollapsed ? "Expand cell" : "Collapse cell"}
        >
          <Show
            when={props.isCollapsed}
            fallback={<Icon name="chevron-up" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />}
          >
            <Icon name="chevron-down" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
          </Show>
        </button>
      </Show>

      <div class="flex-1" />

      <button
        onClick={() => props.onMoveUp()}
        disabled={!props.canMoveUp}
        class="p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Move cell up"
      >
        <Icon name="chevron-up" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
      </button>
      <button
        onClick={() => props.onMoveDown()}
        disabled={!props.canMoveDown}
        class="p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Move cell down"
      >
        <Icon name="chevron-down" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
      </button>

      <button
        onClick={() => props.onDelete()}
        class="p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
        title="Delete cell"
      >
        <Icon name="trash" class="w-3.5 h-3.5" style={{ color: "var(--error)" }} />
      </button>
    </div>
  );
}
