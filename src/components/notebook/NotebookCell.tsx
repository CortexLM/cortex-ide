import { Show, Switch, Match, createSignal } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import type { CellType, CellOutput as CellOutputType } from "@/context/NotebookContext";
import { CellToolbar } from "@/components/notebook/CellToolbar";
import { CellOutputArea } from "@/components/notebook/CellOutput";
import { CodeCell, CellStatusIndicator } from "@/components/notebook/CodeCell";
import { MarkdownCell } from "@/components/notebook/MarkdownCell";
import type { CellStatus } from "@/components/notebook/CodeCell";

export interface NotebookCellData {
  id: string;
  cell_type: CellType;
  source: string;
  outputs: CellOutputType[];
  execution_count: number | null;
  status: CellStatus;
  isEditing: boolean;
  isOutputCollapsed: boolean;
}

export interface NotebookCellProps {
  cell: NotebookCellData;
  index: number;
  totalCells: number;
  language: string;
  isActive: boolean;
  collapsed?: boolean;
  onUpdateSource: (source: string) => void;
  onRun: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChangeCellType: (type: CellType) => void;
  onToggleEdit: () => void;
  onToggleOutputCollapse: () => void;
  onFocus: () => void;
  onSplit?: () => void;
  onJoin?: () => void;
  onDuplicate?: () => void;
  onToggleCollapse?: () => void;
}

export function NotebookCell(props: NotebookCellProps) {
  const [copied, setCopied] = createSignal(false);
  const [isDragOver, setIsDragOver] = createSignal(false);
  const [isDragging, setIsDragging] = createSignal(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(props.cell.source);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDragStart = (e: DragEvent) => {
    if (!e.dataTransfer) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(props.index));
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const fromIndex = Number(e.dataTransfer?.getData("text/plain"));
    if (!isNaN(fromIndex) && fromIndex !== props.index) {
      if (fromIndex < props.index) {
        props.onMoveDown();
      } else {
        props.onMoveUp();
      }
    }
  };

  return (
    <div
      class="notebook-cell group relative"
      data-cell-id={props.cell.id}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        background: isDragOver()
          ? "var(--surface-hover)"
          : props.isActive
          ? "var(--surface-base)"
          : "transparent",
        "border-left": props.isActive
          ? "3px solid var(--accent)"
          : "3px solid transparent",
        "border-radius": "var(--cortex-radius-sm)",
        padding: "8px",
        "margin-bottom": "4px",
        transition: "all 0.15s ease",
        opacity: isDragging() ? "0.5" : "1",
      }}
      onClick={() => props.onFocus()}
    >
      <div class="flex items-center gap-2 mb-2">
        <Show when={props.cell.cell_type === "code"}>
          <CellStatusIndicator
            status={props.cell.status}
            executionCount={props.cell.execution_count}
          />
        </Show>

        <Show when={props.cell.cell_type !== "code"}>
          <div
            class="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
            style={{
              background: "var(--surface-raised)",
              color: "var(--text-weak)",
            }}
          >
            <Show
              when={props.cell.cell_type === "markdown"}
              fallback={<Icon name="font" class="w-3 h-3" />}
            >
              <Icon name="file-lines" class="w-3 h-3" />
            </Show>
            <span>
              {props.cell.cell_type === "markdown" ? "Markdown" : "Raw"}
            </span>
          </div>
        </Show>

        <CellToolbar
          cellType={props.cell.cell_type}
          isEditing={props.cell.isEditing}
          onRun={props.onRun}
          onDelete={props.onDelete}
          onMoveUp={props.onMoveUp}
          onMoveDown={props.onMoveDown}
          onChangeCellType={props.onChangeCellType}
          onToggleEdit={props.onToggleEdit}
          canMoveUp={props.index > 0}
          canMoveDown={props.index < props.totalCells - 1}
          onSplit={props.onSplit}
          onJoin={props.onJoin}
          onDuplicate={props.onDuplicate}
          onToggleCollapse={props.onToggleCollapse}
          isCollapsed={props.collapsed}
        />

        <button
          onClick={handleCopy}
          class="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-hover)] transition-all"
          title="Copy cell content"
        >
          <Show
            when={copied()}
            fallback={
              <Icon name="copy" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
            }
          >
            <Icon name="check" class="w-3.5 h-3.5" style={{ color: "var(--success)" }} />
          </Show>
        </button>
      </div>

      <Show when={!props.collapsed}>
        <div
          class="cell-content"
          style={{
            "margin-left": props.cell.cell_type === "code" ? "48px" : "0",
          }}
        >
          <Switch>
            <Match when={props.cell.cell_type === "code"}>
              <CodeCell
                source={props.cell.source}
                language={props.language}
                onChange={props.onUpdateSource}
                onRun={props.onRun}
                isFocused={props.isActive}
                onFocus={props.onFocus}
              />
            </Match>
            <Match when={props.cell.cell_type === "markdown"}>
              <MarkdownCell
                source={props.cell.source}
                isEditing={props.cell.isEditing}
                onChange={props.onUpdateSource}
                onToggleEdit={props.onToggleEdit}
              />
            </Match>
            <Match when={props.cell.cell_type === "raw"}>
              <textarea
                value={props.cell.source}
                onInput={(e) => props.onUpdateSource(e.currentTarget.value)}
                class="w-full resize-none outline-none font-mono text-sm p-3"
                style={{
                  background: "var(--surface-base)",
                  color: "var(--text-base)",
                  border: "1px solid var(--border-base)",
                  "border-radius": "var(--cortex-radius-sm)",
                  "min-height": "60px",
                }}
                placeholder="Raw cell content..."
                rows={2}
              />
            </Match>
          </Switch>

          <Show when={props.cell.cell_type === "code" && props.cell.outputs}>
            <CellOutputArea
              outputs={props.cell.outputs}
              isCollapsed={props.cell.isOutputCollapsed}
              onToggleCollapse={props.onToggleOutputCollapse}
            />
          </Show>
        </div>
      </Show>
    </div>
  );
}
