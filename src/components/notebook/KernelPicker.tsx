import { Show, For, createSignal } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { useNotebook } from "@/context/NotebookContext";
import type { KernelLanguage, KernelStatus } from "@/context/NotebookContext";

interface KernelOption {
  language: KernelLanguage;
  label: string;
  icon: string;
}

const KERNEL_OPTIONS: KernelOption[] = [
  { language: "python", label: "Python", icon: "code" },
  { language: "javascript", label: "JavaScript", icon: "code" },
  { language: "typescript", label: "TypeScript", icon: "code" },
];

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

export function KernelPicker() {
  const notebook = useNotebook();
  const [isOpen, setIsOpen] = createSignal(false);

  const currentStatus = (): KernelStatus => notebook.getKernelStatus();

  const currentLanguage = (): string => {
    const nb = notebook.getActiveNotebook();
    return nb?.notebook.metadata.kernelspec?.language || "python";
  };

  const currentLabel = (): string => {
    const lang = currentLanguage();
    const option = KERNEL_OPTIONS.find((o) => o.language === lang);
    return option?.label || lang.charAt(0).toUpperCase() + lang.slice(1);
  };

  const handleSelectKernel = async (language: KernelLanguage) => {
    setIsOpen(false);
    await notebook.changeKernel(language);
  };

  const handleRestart = async () => {
    await notebook.restartKernel();
  };

  const handleInterrupt = async () => {
    await notebook.interruptKernel();
  };

  const isConnected = () => currentStatus() !== "disconnected";
  const isBusy = () => currentStatus() === "busy";

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
            "min-width": "200px",
          }}
        >
          <div
            class="px-3 py-1.5 text-xs font-medium"
            style={{
              color: "var(--text-weak)",
              "border-bottom": "1px solid var(--border-weak)",
            }}
          >
            Select Kernel
          </div>
          <For each={KERNEL_OPTIONS}>
            {(option) => (
              <button
                onClick={() => handleSelectKernel(option.language)}
                class="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--surface-hover)] transition-colors"
                style={{
                  color:
                    currentLanguage() === option.language
                      ? "var(--accent)"
                      : "var(--text-base)",
                }}
              >
                <Icon name={option.icon} class="w-3.5 h-3.5" />
                <span>{option.label}</span>
                <Show when={currentLanguage() === option.language}>
                  <Icon name="check" class="w-3 h-3 ml-auto" style={{ color: "var(--accent)" }} />
                </Show>
              </button>
            )}
          </For>

          <Show when={isConnected()}>
            <div
              class="mt-1 pt-1"
              style={{ "border-top": "1px solid var(--border-weak)" }}
            >
              <button
                onClick={handleInterrupt}
                disabled={!isBusy()}
                class="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: "var(--text-base)" }}
              >
                <Icon name="stop" class="w-3.5 h-3.5" style={{ color: "var(--warning)" }} />
                <span>Interrupt Kernel</span>
              </button>
              <button
                onClick={handleRestart}
                class="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--surface-hover)] transition-colors"
                style={{ color: "var(--text-base)" }}
              >
                <Icon name="rotate-right" class="w-3.5 h-3.5" style={{ color: "var(--cortex-info)" }} />
                <span>Restart Kernel</span>
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
