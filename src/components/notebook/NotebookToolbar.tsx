import { Show, createSignal } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { useNotebook } from "@/context/NotebookContext";
import type { KernelStatus } from "@/context/NotebookContext";
import { KernelPicker } from "@/components/notebook/KernelPicker";

function kernelStatusColor(status: KernelStatus): string {
  switch (status) {
    case "idle":
      return "var(--success)";
    case "busy":
      return "var(--warning)";
    case "starting":
    case "restarting":
      return "var(--cortex-info)";
    case "error":
      return "var(--error)";
    case "disconnected":
      return "var(--text-weaker)";
  }
}

interface ToolbarButtonProps {
  icon: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  iconColor?: string;
}

function ToolbarButton(props: ToolbarButtonProps) {
  return (
    <button
      onClick={() => props.onClick()}
      disabled={props.disabled}
      class="p-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      title={props.title}
    >
      <Icon
        name={props.icon}
        class="w-4 h-4"
        style={{ color: props.iconColor || "var(--text-weak)" }}
      />
    </button>
  );
}

function ToolbarSeparator() {
  return (
    <div
      class="mx-1"
      style={{ width: "1px", height: "20px", background: "var(--border-base)" }}
    />
  );
}

export function NotebookToolbar() {
  const notebook = useNotebook();
  const [showExportMenu, setShowExportMenu] = createSignal(false);

  const status = (): KernelStatus => notebook.getKernelStatus();
  const isRunning = () => notebook.isExecuting();
  const activeNotebook = () => notebook.getActiveNotebook();
  const cellCount = () => activeNotebook()?.notebook.cells.length || 0;

  const activeCellIndex = () => {
    const nb = activeNotebook();
    if (!nb) return -1;
    const activeId = notebook.state.activeCellId;
    return nb.notebook.cells.findIndex((c) => c.id === activeId);
  };

  const handleRunAll = async () => { await notebook.executeAllCells(); };
  const handleRunAbove = async () => {
    const idx = activeCellIndex();
    if (idx >= 0) await notebook.executeCellsAbove(idx);
  };
  const handleRunBelow = async () => {
    const idx = activeCellIndex();
    if (idx >= 0) await notebook.executeCellsBelow(idx);
  };
  const handleRestartKernel = async () => { await notebook.restartKernel(); };
  const handleRestartAndRunAll = async () => { await notebook.restartKernel(true); };
  const handleInterruptKernel = async () => { await notebook.interruptKernel(); };
  const handleClearOutputs = () => { notebook.clearOutputs(); };
  const handleSave = async () => { await notebook.saveNotebook(); };

  const handleExportHtml = async () => {
    setShowExportMenu(false);
    const html = await notebook.exportToHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (activeNotebook()?.name || "notebook").replace(/\.ipynb$/, ".html");
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPython = async () => {
    setShowExportMenu(false);
    const script = await notebook.exportToPython();
    const blob = new Blob([script], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (activeNotebook()?.name || "notebook").replace(/\.ipynb$/, ".py");
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    setShowExportMenu(false);
    const html = await notebook.exportToPdf();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) w.onload = () => w.print();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      class="notebook-toolbar flex items-center gap-1 px-3 py-1.5 shrink-0"
      style={{
        background: "var(--surface-base)",
        "border-bottom": "1px solid var(--border-base)",
      }}
    >
      <ToolbarButton icon="floppy-disk" title="Save notebook" onClick={handleSave} />

      <ToolbarSeparator />

      <ToolbarButton icon="play" title="Run all cells" onClick={handleRunAll} iconColor="var(--success)" />
      <ToolbarButton icon="backward-step" title="Run cells above" onClick={handleRunAbove} />
      <ToolbarButton icon="forward-step" title="Run cells below" onClick={handleRunBelow} />

      <ToolbarSeparator />

      <ToolbarButton
        icon="stop"
        title="Interrupt kernel"
        onClick={handleInterruptKernel}
        disabled={!isRunning()}
        iconColor="var(--warning)"
      />
      <ToolbarButton icon="rotate-right" title="Restart kernel" onClick={handleRestartKernel} />
      <ToolbarButton
        icon="rotate-right"
        title="Restart kernel and run all"
        onClick={handleRestartAndRunAll}
        iconColor="var(--success)"
      />

      <ToolbarSeparator />

      <ToolbarButton icon="eraser" title="Clear all outputs" onClick={handleClearOutputs} />

      <div class="relative">
        <ToolbarButton
          icon="file-export"
          title="Export notebook"
          onClick={() => setShowExportMenu(!showExportMenu())}
        />
        <Show when={showExportMenu()}>
          <div
            class="absolute top-full left-0 mt-1 py-1 rounded shadow-lg z-50"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-base)",
              "min-width": "160px",
            }}
          >
            <button
              onClick={handleExportHtml}
              class="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--surface-hover)] transition-colors"
              style={{ color: "var(--text-base)" }}
            >
              <Icon name="code" class="w-3.5 h-3.5" />
              <span>Export as HTML</span>
            </button>
            <button
              onClick={handleExportPython}
              class="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--surface-hover)] transition-colors"
              style={{ color: "var(--text-base)" }}
            >
              <Icon name="file-lines" class="w-3.5 h-3.5" />
              <span>Export as Python</span>
            </button>
            <button
              onClick={handleExportPdf}
              class="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--surface-hover)] transition-colors"
              style={{ color: "var(--text-base)" }}
            >
              <Icon name="file-pdf" class="w-3.5 h-3.5" />
              <span>Export as PDF</span>
            </button>
          </div>
        </Show>
      </div>

      <div class="flex-1" />

      <div class="text-xs mr-2" style={{ color: "var(--text-weak)" }}>
        {cellCount()} cell{cellCount() !== 1 ? "s" : ""}
      </div>

      <Show when={isRunning()}>
        <div class="flex items-center gap-1 mr-2">
          <Icon
            name="spinner"
            class="w-3 h-3 animate-spin"
            style={{ color: kernelStatusColor(status()) }}
          />
          <span class="text-xs" style={{ color: "var(--text-weak)" }}>
            Running
          </span>
        </div>
      </Show>

      <KernelPicker />
    </div>
  );
}
