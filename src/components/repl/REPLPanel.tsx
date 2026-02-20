import { Show, For, createSignal } from "solid-js";
import { Icon } from "../ui/Icon";
import { useREPL } from "@/context/REPLContext";
import { KernelSelector } from "./KernelSelector";
import { REPLCell } from "./REPLCell";
import { VariableInspector } from "./VariableInspector";

export function REPLPanel() {
  const {
    state,
    closePanel,
    addCell,
    executeAllCells,
    clearAllOutputs,
    clearVariables,
    exportToNotebook,
    toggleVariableInspector,
    clearError,
  } = useREPL();
  
  const [isMaximized, setIsMaximized] = createSignal(false);
  const [isExporting, setIsExporting] = createSignal(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const notebook = await exportToNotebook();
      const blob = new Blob([notebook], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `notebook_${Date.now()}.ipynb`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to export notebook:", e);
    } finally {
      setIsExporting(false);
    }
  };

  const panelHeight = () => isMaximized() ? "90vh" : "50vh";

  return (
    <Show when={state.showPanel}>
      <div
        class="fixed bottom-0 left-0 right-0 z-40 flex flex-col"
        style={{
          height: panelHeight(),
          background: "var(--surface-base)",
          "border-top": "1px solid var(--border-base)",
          "box-shadow": "0 -4px 24px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div
          class="flex items-center justify-between px-4 py-2 shrink-0"
          style={{ "border-bottom": "1px solid var(--border-base)" }}
        >
          <div class="flex items-center gap-4">
            <h2 class="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
              REPL
            </h2>
            <KernelSelector />
          </div>

          <div class="flex items-center gap-1">
            {/* Add cell */}
            <button
              onClick={() => addCell()}
              class="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)]"
              style={{ color: "var(--text-base)" }}
              title="Add cell"
            >
              <Icon name="plus" class="w-4 h-4" />
              <span>Cell</span>
            </button>

            {/* Run all */}
            <button
              onClick={executeAllCells}
              disabled={state.cells.length === 0 || !state.activeKernelId}
              class="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)] disabled:opacity-50"
              style={{ color: "var(--cortex-success)" }}
              title="Run all cells"
            >
              <Icon name="play" class="w-4 h-4" />
              <span>Run All</span>
            </button>

            {/* Clear all outputs */}
            <button
              onClick={clearAllOutputs}
              disabled={state.cells.length === 0}
              class="p-1.5 rounded hover:bg-[var(--surface-hover)] disabled:opacity-50"
              style={{ color: "var(--text-weak)" }}
              title="Clear all outputs"
            >
              <Icon name="trash" class="w-4 h-4" />
            </button>

            {/* Clear variables */}
            <button
              onClick={clearVariables}
              disabled={state.variables.length === 0 && state.trackedVariables.length === 0}
              class="p-1.5 rounded hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: "var(--text-weak)" }}
              title="Clear all variables"
            >
              <Icon name="circle-xmark" class="w-4 h-4" />
            </button>

            {/* Variable inspector toggle */}
            <button
              onClick={toggleVariableInspector}
              class="p-1.5 rounded hover:bg-[var(--surface-hover)]"
              style={{ color: state.showVariableInspector ? "var(--cortex-info)" : "var(--text-weak)" }}
              title="Toggle variable inspector"
            >
              <Icon name="table" class="w-4 h-4" />
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={state.cells.length === 0 || isExporting()}
              class="p-1.5 rounded hover:bg-[var(--surface-hover)] disabled:opacity-50"
              style={{ color: "var(--text-weak)" }}
              title="Export as notebook"
            >
              <Show when={isExporting()} fallback={<Icon name="download" class="w-4 h-4" />}>
                <Icon name="spinner" class="w-4 h-4 animate-spin" />
              </Show>
            </button>

            {/* Maximize/minimize */}
            <button
              onClick={() => setIsMaximized(!isMaximized())}
              class="p-1.5 rounded hover:bg-[var(--surface-hover)]"
              style={{ color: "var(--text-weak)" }}
              title={isMaximized() ? "Minimize" : "Maximize"}
            >
              <Show when={isMaximized()} fallback={<Icon name="maximize" class="w-4 h-4" />}>
                <Icon name="minimize" class="w-4 h-4" />
              </Show>
            </button>

            {/* Close */}
            <button
              onClick={closePanel}
              class="p-1.5 rounded hover:bg-[var(--surface-hover)]"
              style={{ color: "var(--text-weak)" }}
              title="Close REPL"
            >
              <Icon name="xmark" class="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div class="flex-1 flex overflow-hidden">
          {/* Cells area */}
          <div
            class="flex-1 overflow-auto p-4"
            style={{
              background: "var(--surface-sunken)",
            }}
          >
            <Show
              when={state.cells.length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center h-full text-center">
                  <div
                    class="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ background: "var(--surface-raised)" }}
                  >
                    <Icon name="play" class="w-8 h-8" style={{ color: "var(--text-weak)" }} />
                  </div>
                  <h3 class="text-lg font-medium mb-2" style={{ color: "var(--text-strong)" }}>
                    No cells yet
                  </h3>
                  <p class="text-sm mb-4" style={{ color: "var(--text-weak)" }}>
                    <Show when={!state.activeKernelId} fallback="Add a cell to start coding">
                      Start a kernel and add a cell to begin
                    </Show>
                  </p>
                  <button
                    onClick={() => addCell()}
                    class="flex items-center gap-2 px-4 py-2 rounded-lg"
                    style={{
                      background: "var(--cortex-info)",
                      color: "white",
                    }}
                  >
                    <Icon name="plus" class="w-4 h-4" />
                    Add Cell
                  </button>
                </div>
              }
            >
              <For each={state.cells}>
                {(cell) => <REPLCell cell={cell} />}
              </For>

              {/* Add cell button at bottom */}
              <button
                onClick={() => addCell()}
                class="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed hover:bg-[var(--surface-hover)] transition-colors"
                style={{
                  "border-color": "var(--border-base)",
                  color: "var(--text-weak)",
                }}
              >
                <Icon name="plus" class="w-4 h-4" />
                <span class="text-sm">Add Cell</span>
              </button>
            </Show>
          </div>

          {/* Variable inspector sidebar */}
          <Show when={state.showVariableInspector}>
            <VariableInspector />
          </Show>
        </div>

        {/* Error banner */}
        <Show when={state.error}>
          <div
            class="flex items-center justify-between px-4 py-2"
            style={{
              background: "var(--cortex-error)20",
              "border-top": "1px solid var(--cortex-error)",
            }}
          >
            <span class="text-sm" style={{ color: "var(--cortex-error)" }}>
              {state.error}
            </span>
            <button
              onClick={clearError}
              class="text-xs underline"
              style={{ color: "var(--cortex-error)" }}
            >
              Dismiss
            </button>
          </div>
        </Show>
      </div>
    </Show>
  );
}

