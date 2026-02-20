import { Show, For, createSignal, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@/components/ui/Icon";
import { useNotebook } from "@/context/NotebookContext";
import type { KernelLanguage, KernelStatus } from "@/context/NotebookContext";

interface DetectedKernel {
  name: string;
  display_name: string;
  language: string;
  source: string;
  executable?: string;
}

function statusColor(status: KernelStatus): string {
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

function statusLabel(status: KernelStatus): string {
  switch (status) {
    case "idle":
      return "Idle";
    case "busy":
      return "Busy";
    case "starting":
      return "Starting";
    case "restarting":
      return "Restarting";
    case "error":
      return "Error";
    case "disconnected":
      return "Disconnected";
  }
}

function sourceLabel(source: string): string {
  switch (source) {
    case "jupyter":
      return "Jupyter";
    case "repl":
      return "Built-in";
    case "system":
      return "System";
    default:
      return source;
  }
}

export function KernelSelector() {
  const notebook = useNotebook();
  const [isOpen, setIsOpen] = createSignal(false);
  const [kernels, setKernels] = createSignal<DetectedKernel[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const detectKernels = async () => {
    setLoading(true);
    setError(null);
    try {
      const detected = await invoke<DetectedKernel[]>("notebook_detect_kernels");
      setKernels(detected);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    detectKernels();
  });

  const currentStatus = (): KernelStatus => notebook.getKernelStatus();

  const currentLanguage = (): string => {
    const nb = notebook.getActiveNotebook();
    return nb?.notebook.metadata.kernelspec?.language || "python";
  };

  const currentLabel = (): string => {
    const nb = notebook.getActiveNotebook();
    const displayName = nb?.notebook.metadata.kernelspec?.display_name;
    if (displayName) return displayName;
    const lang = currentLanguage();
    return lang.charAt(0).toUpperCase() + lang.slice(1);
  };

  const groupedKernels = () => {
    const groups: Record<string, DetectedKernel[]> = {};
    for (const kernel of kernels()) {
      const source = kernel.source || "other";
      if (!groups[source]) groups[source] = [];
      groups[source].push(kernel);
    }
    return groups;
  };

  const handleSelectKernel = async (kernel: DetectedKernel) => {
    setIsOpen(false);
    const language = kernel.language as KernelLanguage;
    await notebook.changeKernel(language);
  };

  return (
    <div class="relative">
      <button
        onClick={() => setIsOpen(!isOpen())}
        class="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors text-xs"
        style={{ color: "var(--text-base)" }}
      >
        <span
          class="inline-block w-2 h-2 rounded-full"
          style={{ background: statusColor(currentStatus()) }}
        />
        <span>{currentLabel()}</span>
        <span class="text-xs" style={{ color: "var(--text-weak)" }}>
          ({statusLabel(currentStatus())})
        </span>
        <Icon name="chevron-down" class="w-3 h-3" />
      </button>

      <Show when={isOpen()}>
        <div
          class="absolute top-full right-0 mt-1 py-1 rounded shadow-lg z-50"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-base)",
            "min-width": "240px",
            "max-height": "320px",
            "overflow-y": "auto",
          }}
        >
          <div
            class="flex items-center justify-between px-3 py-1.5"
            style={{
              "border-bottom": "1px solid var(--border-weak)",
            }}
          >
            <span class="text-xs font-medium" style={{ color: "var(--text-weak)" }}>
              Select Kernel
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                detectKernels();
              }}
              class="p-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
              style={{ color: "var(--text-weak)" }}
              title="Refresh kernels"
            >
              <Icon name="refresh" class={`w-3 h-3 ${loading() ? "animate-spin" : ""}`} />
            </button>
          </div>

          <Show when={error()}>
            <div class="px-3 py-2 text-xs" style={{ color: "var(--error)" }}>
              {error()}
            </div>
          </Show>

          <Show when={loading() && kernels().length === 0}>
            <div class="px-3 py-2 text-xs" style={{ color: "var(--text-weak)" }}>
              Detecting kernels...
            </div>
          </Show>

          <For each={Object.entries(groupedKernels())}>
            {([source, group]) => (
              <>
                <div
                  class="px-3 py-1 text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: "var(--text-weaker)" }}
                >
                  {sourceLabel(source)}
                </div>
                <For each={group}>
                  {(kernel) => (
                    <button
                      onClick={() => handleSelectKernel(kernel)}
                      class="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--surface-hover)] transition-colors"
                      style={{
                        color:
                          currentLanguage() === kernel.language
                            ? "var(--accent)"
                            : "var(--text-base)",
                      }}
                    >
                      <Icon name="code" class="w-3.5 h-3.5" />
                      <div class="flex-1 text-left">
                        <div>{kernel.display_name}</div>
                        <Show when={kernel.executable}>
                          <div class="text-[10px] truncate" style={{ color: "var(--text-weaker)" }}>
                            {kernel.executable}
                          </div>
                        </Show>
                      </div>
                      <Show when={currentLanguage() === kernel.language}>
                        <Icon name="check" class="w-3 h-3" style={{ color: "var(--accent)" }} />
                      </Show>
                    </button>
                  )}
                </For>
              </>
            )}
          </For>

          <Show when={!loading() && kernels().length === 0 && !error()}>
            <div class="px-3 py-2 text-xs" style={{ color: "var(--text-weak)" }}>
              No kernels detected
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
