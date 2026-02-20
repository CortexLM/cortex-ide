import { Show, For, createSignal } from "solid-js";
import { Icon } from "../ui/Icon";
import { useREPL, type KernelSpec, type KernelInfo, type KernelStatus } from "@/context/REPLContext";

function StatusBadge(props: { status: KernelStatus }) {
  const statusConfig = () => {
    switch (props.status) {
      case "idle":
        return { color: "var(--cortex-success)", bg: "var(--cortex-success)20", label: "Idle" };
      case "busy":
        return { color: "var(--cortex-warning)", bg: "var(--cortex-warning)20", label: "Busy" };
      case "starting":
        return { color: "var(--cortex-info)", bg: "var(--cortex-info)20", label: "Starting" };
      case "restarting":
        return { color: "var(--cortex-info)", bg: "var(--cortex-info)20", label: "Restarting" };
      case "shuttingdown":
        return { color: "var(--cortex-text-inactive)", bg: "var(--cortex-text-inactive)20", label: "Stopping" };
      case "shutdown":
        return { color: "var(--cortex-text-inactive)", bg: "var(--cortex-text-inactive)20", label: "Stopped" };
      case "error":
        return { color: "var(--cortex-error)", bg: "var(--cortex-error)20", label: "Error" };
      default:
        return { color: "var(--cortex-text-inactive)", bg: "var(--cortex-text-inactive)20", label: "Unknown" };
    }
  };

  return (
    <span
      class="px-2 py-0.5 rounded text-xs font-medium"
      style={{
        background: statusConfig().bg,
        color: statusConfig().color,
      }}
    >
      {statusConfig().label}
    </span>
  );
}

export function KernelSelector() {
  const { state, startKernel, stopKernel, restartKernel, setActiveKernel, loadKernelSpecs } = useREPL();
  const [isOpen, setIsOpen] = createSignal(false);
  const [isStarting, setIsStarting] = createSignal(false);

  const activeKernel = (): KernelInfo | undefined => {
    return state.kernels.find(k => k.id === state.activeKernelId);
  };

  const handleStartKernel = async (spec: KernelSpec) => {
    setIsStarting(true);
    try {
      await startKernel(spec.id);
      setIsOpen(false);
    } catch (e) {
      console.error("Failed to start kernel:", e);
    } finally {
      setIsStarting(false);
    }
  };

  const handleSelectKernel = (kernel: KernelInfo) => {
    setActiveKernel(kernel.id);
    setIsOpen(false);
  };

  const handleRestartKernel = async (e: Event) => {
    e.stopPropagation();
    const kernel = activeKernel();
    if (kernel) {
      await restartKernel(kernel.id);
    }
  };

  const handleStopKernel = async (e: Event) => {
    e.stopPropagation();
    const kernel = activeKernel();
    if (kernel) {
      await stopKernel(kernel.id);
    }
  };

  return (
    <div class="relative">
      <button
        onClick={() => {
          if (!isOpen()) {
            loadKernelSpecs();
          }
          setIsOpen(!isOpen());
        }}
        class="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-[var(--surface-hover)] transition-colors"
        style={{ border: "1px solid var(--border-base)" }}
      >
        <Icon name="microchip" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
        
        <Show when={activeKernel()} fallback={<span style={{ color: "var(--text-weak)" }}>No kernel</span>}>
          {(kernel) => (
            <>
              <span style={{ color: "var(--text-base)" }}>{kernel().spec.display_name}</span>
              <StatusBadge status={kernel().status} />
            </>
          )}
        </Show>
        
        <Icon name="chevron-down" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
      </button>

      <Show when={isOpen()}>
        <div
          class="absolute top-full left-0 mt-1 min-w-[280px] py-2 z-50"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-base)",
            "border-radius": "var(--cortex-radius-md)",
            "box-shadow": "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {/* Active kernel controls */}
          <Show when={activeKernel()}>
            {(kernel) => (
              <div
                class="px-3 py-2 mb-2"
                style={{ "border-bottom": "1px solid var(--border-base)" }}
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium" style={{ color: "var(--text-strong)" }}>
                    Active: {kernel().spec.display_name}
                  </span>
                  <StatusBadge status={kernel().status} />
                </div>
                <div class="flex gap-2">
                  <button
                    onClick={handleRestartKernel}
                    class="px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)]"
                    style={{ color: "var(--text-base)", border: "1px solid var(--border-base)" }}
                  >
                    Restart
                  </button>
                  <button
                    onClick={handleStopKernel}
                    class="px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)]"
                    style={{ color: "var(--cortex-error)", border: "1px solid var(--border-base)" }}
                  >
                    Stop
                  </button>
                </div>
              </div>
            )}
          </Show>

          {/* Running kernels */}
          <Show when={state.kernels.length > 0}>
            <div class="px-3 py-1">
              <span class="text-xs font-medium" style={{ color: "var(--text-weak)" }}>
                Running Kernels
              </span>
            </div>
            <For each={state.kernels}>
              {(kernel) => (
                <button
                  onClick={() => handleSelectKernel(kernel)}
                  class="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--surface-hover)]"
                >
                  <div class="flex items-center gap-2">
                    <Show when={kernel.id === state.activeKernelId}>
                      <Icon name="check" class="w-4 h-4" style={{ color: "var(--cortex-success)" }} />
                    </Show>
                    <span style={{ color: "var(--text-base)" }}>{kernel.spec.display_name}</span>
                  </div>
                  <StatusBadge status={kernel.status} />
                </button>
              )}
            </For>
            <div
              class="my-2 mx-3"
              style={{ height: "1px", background: "var(--border-base)" }}
            />
          </Show>

          {/* Available kernel specs */}
          <div class="px-3 py-1">
            <span class="text-xs font-medium" style={{ color: "var(--text-weak)" }}>
              Start New Kernel
            </span>
          </div>
          
          <Show
            when={!state.isLoading}
            fallback={
              <div class="flex items-center justify-center py-4">
                <Icon name="spinner" class="w-5 h-5 animate-spin" style={{ color: "var(--text-weak)" }} />
              </div>
            }
          >
            <Show
              when={state.kernelSpecs.length > 0}
              fallback={
                <div class="px-3 py-4 text-center">
                  <Icon name="circle-exclamation" class="w-6 h-6 mx-auto mb-2" style={{ color: "var(--text-weak)" }} />
                  <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                    No kernels available
                  </p>
                  <p class="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Install Python or Node.js to use REPL
                  </p>
                </div>
              }
            >
              <For each={state.kernelSpecs}>
                {(spec) => (
                  <button
                    onClick={() => handleStartKernel(spec)}
                    disabled={isStarting()}
                    class="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--surface-hover)] disabled:opacity-50"
                  >
                    <div
                      class="w-8 h-8 rounded flex items-center justify-center"
                      style={{
                        background: spec.language === "python" ? "var(--cortex-info)20" : "var(--cortex-warning)20",
                      }}
                    >
                      <span style={{ color: spec.language === "python" ? "var(--cortex-info)" : "var(--cortex-warning)" }}>
                        {spec.language === "python" ? "🐍" : "JS"}
                      </span>
                    </div>
                    <div class="text-left">
                      <div class="text-sm" style={{ color: "var(--text-base)" }}>
                        {spec.display_name}
                      </div>
                      <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                        {spec.language}
                      </div>
                    </div>
                  </button>
                )}
              </For>
            </Show>
          </Show>
        </div>
      </Show>

      {/* Click outside to close */}
      <Show when={isOpen()}>
        <div
          class="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      </Show>
    </div>
  );
}

