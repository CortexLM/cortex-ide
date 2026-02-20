import { Show, createSignal, createEffect } from "solid-js";
import { Icon } from "../ui/Icon";
import { useREPL, type Cell, type CellStatus } from "@/context/REPLContext";
import { REPLOutputList } from "./REPLOutput";

interface REPLCellProps {
  cell: Cell;
}

function ExecutionIndicator(props: { count: number | null; status: CellStatus }) {
  const indicatorColor = () => {
    switch (props.status) {
      case "running":
        return "var(--cortex-warning)";
      case "success":
        return "var(--cortex-success)";
      case "error":
        return "var(--cortex-error)";
      default:
        return "var(--text-muted)";
    }
  };

  return (
    <div
      class="flex items-center justify-center w-12 h-6 text-xs font-mono"
      style={{ color: indicatorColor() }}
    >
      <Show when={props.status === "running"} fallback={
        <Show when={props.count !== null} fallback="[ ]">
          [{props.count}]
        </Show>
      }>
        <span class="animate-pulse">[*]</span>
      </Show>
    </div>
  );
}

export function REPLCell(props: REPLCellProps) {
  const { updateCell, deleteCell, executeCell, clearCellOutput, setActiveCell, state, interruptKernel } = useREPL();
  const [isFocused, setIsFocused] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  let textareaRef: HTMLTextAreaElement | undefined;

  const isActive = () => state.activeCellId === props.cell.id;
  const isRunning = () => props.cell.status === "running";

  // Auto-resize textarea
  createEffect(() => {
    if (textareaRef) {
      textareaRef.style.height = "auto";
      textareaRef.style.height = textareaRef.scrollHeight + "px";
    }
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    // Shift+Enter to execute
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      executeCell(props.cell.id);
    }
    // Escape to unfocus
    if (e.key === "Escape") {
      textareaRef?.blur();
    }
  };

  const handleExecute = async () => {
    if (isRunning() && state.activeKernelId) {
      await interruptKernel(state.activeKernelId);
    } else {
      await executeCell(props.cell.id);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(props.cell.input);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      class="repl-cell group"
      style={{
        background: isActive() ? "var(--surface-hover)" : "transparent",
        "border-left": isActive() ? "2px solid var(--cortex-info)" : "2px solid transparent",
        "border-radius": "var(--cortex-radius-sm)",
        padding: "8px",
        "margin-bottom": "8px",
        transition: "all 0.15s ease",
      }}
      onClick={() => setActiveCell(props.cell.id)}
    >
      <div class="flex items-start gap-2">
        {/* Execution indicator */}
        <ExecutionIndicator count={props.cell.execution_count} status={props.cell.status} />

        {/* Input area */}
        <div class="flex-1 min-w-0">
          <div
            class="relative"
            style={{
              background: "var(--surface-base)",
              border: isFocused() ? "1px solid var(--cortex-info)" : "1px solid var(--border-base)",
              "border-radius": "var(--cortex-radius-sm)",
              overflow: "hidden",
            }}
          >
            <textarea
              ref={textareaRef}
              value={props.cell.input}
              onInput={(e) => updateCell(props.cell.id, { input: e.currentTarget.value })}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder="Enter code..."
              class="w-full resize-none outline-none font-mono text-sm p-3"
              style={{
                background: "transparent",
                color: "var(--text-base)",
                "min-height": "40px",
              }}
              rows={1}
            />
            
            {/* Language hint */}
            <div
              class="absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded"
              style={{
                background: "var(--surface-raised)",
                color: "var(--text-muted)",
              }}
            >
              {(() => {
                const kernel = state.kernels.find(k => k.id === state.activeKernelId);
                return kernel?.spec.language || "code";
              })()}
            </div>
          </div>

          {/* Outputs */}
          <REPLOutputList outputs={props.cell.outputs} />
        </div>

        {/* Actions */}
        <div
          class="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ "min-width": "28px" }}
        >
          <button
            onClick={handleExecute}
            class="p-1.5 rounded hover:bg-[var(--surface-hover)]"
            title={isRunning() ? "Interrupt (Shift+Enter)" : "Run (Shift+Enter)"}
          >
            <Show when={isRunning()} fallback={
              <Icon name="play" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />
            }>
              <Icon name="stop" class="w-4 h-4" style={{ color: "var(--cortex-error)" }} />
            </Show>
          </button>
          
          <button
            onClick={handleCopy}
            class="p-1.5 rounded hover:bg-[var(--surface-hover)]"
            title="Copy code"
          >
            <Show when={copied()} fallback={
              <Icon name="copy" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            }>
              <Icon name="check" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />
            </Show>
          </button>

          <Show when={props.cell.outputs.length > 0}>
            <button
              onClick={() => clearCellOutput(props.cell.id)}
              class="p-1.5 rounded hover:bg-[var(--surface-hover)]"
              title="Clear output"
            >
              <Icon name="trash" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
            </button>
          </Show>

          <button
            onClick={() => deleteCell(props.cell.id)}
            class="p-1.5 rounded hover:bg-[var(--surface-hover)]"
            title="Delete cell"
          >
            <Icon name="trash" class="w-4 h-4" style={{ color: "var(--cortex-error)" }} />
          </button>
        </div>
      </div>

      {/* Keyboard hint when focused */}
      <Show when={isFocused()}>
        <div class="flex items-center gap-4 mt-2 ml-14 text-xs" style={{ color: "var(--text-muted)" }}>
          <span><kbd class="px-1 py-0.5 rounded bg-[var(--surface-raised)]">Shift+Enter</kbd> to run</span>
          <span><kbd class="px-1 py-0.5 rounded bg-[var(--surface-raised)]">Esc</kbd> to unfocus</span>
        </div>
      </Show>
    </div>
  );
}

