import { createSignal, createEffect, onCleanup, Show, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Icon } from "./ui/Icon";

/** CPU information */
interface CpuInfo {
  brand: string;
  core_count: number;
  usage: number;
  frequency: number;
}

/** Extension information */
interface ExtensionInfo {
  name: string;
  version: string;
  enabled: boolean;
}

/** Complete system specifications */
interface SystemSpecs {
  app_version: string;
  os_name: string;
  os_version: string;
  architecture: string;
  total_memory: number;
  used_memory: number;
  available_memory: number;
  cpu_info: CpuInfo;
  gpu_info: string | null;
  installed_extensions: ExtensionInfo[];
  build_type: string;
}

/** Live metrics for real-time updates */
interface LiveMetrics {
  cpu_usage: number;
  used_memory: number;
  available_memory: number;
  memory_percent: number;
}

/** Format bytes as human-readable string */
function formatBytes(bytes: number): string {
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  const TB = GB * 1024;

  if (bytes >= TB) {
    return `${(bytes / TB).toFixed(2)} TB`;
  } else if (bytes >= GB) {
    return `${(bytes / GB).toFixed(2)} GB`;
  } else if (bytes >= MB) {
    return `${(bytes / MB).toFixed(2)} MB`;
  } else if (bytes >= KB) {
    return `${(bytes / KB).toFixed(2)} KB`;
  } else {
    return `${bytes} B`;
  }
}

/** Format MHz as human-readable string */
function formatFrequency(mhz: number): string {
  if (mhz >= 1000) {
    return `${(mhz / 1000).toFixed(2)} GHz`;
  }
  return `${mhz} MHz`;
}

interface SystemSpecsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SystemSpecsDialog(props: SystemSpecsDialogProps) {
  const [specs, setSpecs] = createSignal<SystemSpecs | null>(null);
  const [liveMetrics, setLiveMetrics] = createSignal<LiveMetrics | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);
  const [liveUpdates, setLiveUpdates] = createSignal(true);

  let unlistenFn: UnlistenFn | null = null;

  const fetchSpecs = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<SystemSpecs>("get_system_specs");
      setSpecs(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const startLiveMetrics = async () => {
    try {
      // Listen for live metrics events
      unlistenFn = await listen<LiveMetrics>("system_specs:live_metrics", (event) => {
        setLiveMetrics(event.payload);
      });
      
      // Start the live metrics stream
      await invoke("start_live_metrics");
    } catch (e) {
      console.error("Failed to start live metrics:", e);
    }
  };

  const stopLiveMetrics = async () => {
    try {
      await invoke("stop_live_metrics");
      if (unlistenFn) {
        unlistenFn();
        unlistenFn = null;
      }
    } catch (e) {
      console.error("Failed to stop live metrics:", e);
    }
  };

  const copyToClipboard = async () => {
    try {
      const formatted = await invoke<string>("format_system_specs_for_clipboard");
      await writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy to clipboard:", e);
    }
  };

  createEffect(() => {
    if (props.open) {
      fetchSpecs();
      if (liveUpdates()) {
        startLiveMetrics();
      }
    } else {
      stopLiveMetrics();
    }
  });

  createEffect(() => {
    if (props.open && liveUpdates()) {
      startLiveMetrics();
    } else {
      stopLiveMetrics();
    }
  });

  onCleanup(() => {
    stopLiveMetrics();
  });

  const currentCpuUsage = () => liveMetrics()?.cpu_usage ?? specs()?.cpu_info.usage ?? 0;
  const currentMemoryUsed = () => liveMetrics()?.used_memory ?? specs()?.used_memory ?? 0;
  const currentMemoryPercent = () => liveMetrics()?.memory_percent ?? 
    (specs() ? (specs()!.used_memory / specs()!.total_memory) * 100 : 0);

  return (
    <Show when={props.open}>
      <div 
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0, 0, 0, 0.6)" }}
        onClick={(e) => e.target === e.currentTarget && props.onClose()}
      >
        <div 
          class="w-full max-w-lg mx-4 rounded-xl overflow-hidden"
          style={{
            background: "var(--ui-panel-bg)",
            border: "1px solid var(--cortex-bg-hover)",
            "box-shadow": "0 20px 50px rgba(0,0,0,0.5)",
          }}
        >
          {/* Header */}
          <div 
            class="flex items-center justify-between px-5 py-4"
            style={{ "border-bottom": "1px solid var(--cortex-bg-hover)" }}
          >
            <div class="flex items-center gap-3">
              <div 
                class="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--cortex-info), var(--cortex-info))" }}
              >
                <Icon name="circle-info" size={20} color="white" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-white">About Cortex Desktop</h2>
                <Show when={specs()}>
                  <p class="text-xs text-neutral-400">
                    v{specs()!.app_version} {specs()!.build_type !== "Release" && `(${specs()!.build_type})`}
                  </p>
                </Show>
              </div>
            </div>
            <button
              onClick={props.onClose}
              class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "var(--cortex-text-inactive)" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--ui-panel-bg-lighter)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div class="px-5 py-4 max-h-96 overflow-y-auto">
            <Show when={loading()}>
              <div class="flex items-center justify-center py-8">
                <Icon name="rotate" class="animate-spin text-neutral-400" size={24} />
              </div>
            </Show>

            <Show when={error()}>
              <div class="p-4 rounded-lg" style={{ background: "var(--cortex-error-bg)", border: "1px solid var(--cortex-error-bg)" }}>
                <p class="text-red-400 text-sm">{error()}</p>
              </div>
            </Show>

            <Show when={specs() && !loading()}>
              <div class="space-y-4">
                {/* System Info */}
                <div class="space-y-3">
                  {/* OS Info */}
                  <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--ui-panel-bg-lighter)" }}>
                      <Icon name="desktop" size={16} class="text-blue-400" />
                    </div>
                    <div>
                      <p class="text-xs text-neutral-500 uppercase tracking-wide">Operating System</p>
                      <p class="text-sm text-white">{specs()!.os_name} {specs()!.os_version}</p>
                      <p class="text-xs text-neutral-400">{specs()!.architecture}</p>
                    </div>
                  </div>

                  {/* CPU Info */}
                  <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--ui-panel-bg-lighter)" }}>
                      <Icon name="microchip" size={16} class="text-green-400" />
                    </div>
                    <div class="flex-1">
                      <p class="text-xs text-neutral-500 uppercase tracking-wide">Processor</p>
                      <p class="text-sm text-white">{specs()!.cpu_info.brand}</p>
                      <div class="flex items-center gap-4 mt-1">
                        <span class="text-xs text-neutral-400">{specs()!.cpu_info.core_count} cores</span>
                        <span class="text-xs text-neutral-400">{formatFrequency(specs()!.cpu_info.frequency)}</span>
                      </div>
                      <Show when={liveUpdates()}>
                        <div class="mt-2">
                          <div class="flex items-center justify-between text-xs mb-1">
                            <span class="text-neutral-400">Usage</span>
                            <span class="text-white">{currentCpuUsage().toFixed(1)}%</span>
                          </div>
                          <div class="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--ui-panel-bg-lighter)" }}>
                            <div 
                              class="h-full rounded-full transition-all duration-300"
                              style={{ 
                                width: `${Math.min(currentCpuUsage(), 100)}%`,
                                background: currentCpuUsage() > 80 ? "var(--cortex-error)" : currentCpuUsage() > 50 ? "var(--cortex-warning)" : "var(--cortex-success)"
                              }}
                            />
                          </div>
                        </div>
                      </Show>
                    </div>
                  </div>

                  {/* Memory Info */}
                  <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--ui-panel-bg-lighter)" }}>
                      <Icon name="hard-drive" size={16} class="text-purple-400" />
                    </div>
                    <div class="flex-1">
                      <p class="text-xs text-neutral-500 uppercase tracking-wide">Memory</p>
                      <p class="text-sm text-white">{formatBytes(specs()!.total_memory)} total</p>
                      <Show when={liveUpdates()}>
                        <div class="mt-2">
                          <div class="flex items-center justify-between text-xs mb-1">
                            <span class="text-neutral-400">Used: {formatBytes(currentMemoryUsed())}</span>
                            <span class="text-white">{currentMemoryPercent().toFixed(1)}%</span>
                          </div>
                          <div class="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--ui-panel-bg-lighter)" }}>
                            <div 
                              class="h-full rounded-full transition-all duration-300"
                              style={{ 
                                width: `${Math.min(currentMemoryPercent(), 100)}%`,
                                background: currentMemoryPercent() > 80 ? "var(--cortex-error)" : currentMemoryPercent() > 50 ? "var(--cortex-warning)" : "var(--cortex-success)"
                              }}
                            />
                          </div>
                        </div>
                      </Show>
                    </div>
                  </div>

                  {/* GPU Info */}
                  <Show when={specs()!.gpu_info}>
                    <div class="flex items-start gap-3">
                      <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--ui-panel-bg-lighter)" }}>
                        <Icon name="desktop" size={16} class="text-orange-400" />
                      </div>
                      <div>
                        <p class="text-xs text-neutral-500 uppercase tracking-wide">Graphics</p>
                        <p class="text-sm text-white">{specs()!.gpu_info}</p>
                      </div>
                    </div>
                  </Show>
                </div>

                {/* Extensions */}
                <Show when={specs()!.installed_extensions.length > 0}>
                  <div class="pt-3" style={{ "border-top": "1px solid var(--ui-panel-bg-lighter)" }}>
                    <div class="flex items-center gap-2 mb-2">
                      <Icon name="box" size={14} class="text-neutral-400" />
                      <p class="text-xs text-neutral-500 uppercase tracking-wide">
                        Installed Extensions ({specs()!.installed_extensions.length})
                      </p>
                    </div>
                    <div class="space-y-1 max-h-32 overflow-y-auto">
                      <For each={specs()!.installed_extensions}>
                        {(ext) => (
                          <div class="flex items-center justify-between py-1.5 px-2 rounded" style={{ background: "var(--ui-panel-bg-lighter)" }}>
                            <span class="text-sm text-white">{ext.name}</span>
                            <div class="flex items-center gap-2">
                              <span class="text-xs text-neutral-400">v{ext.version}</span>
                              <span 
                                class="text-xs px-1.5 py-0.5 rounded"
                                style={{ 
                                  background: ext.enabled ? "var(--cortex-success)20" : "var(--cortex-error)20",
                                  color: ext.enabled ? "var(--cortex-success)" : "var(--cortex-error)"
                                }}
                              >
                                {ext.enabled ? "enabled" : "disabled"}
                              </span>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div 
            class="flex items-center justify-between px-5 py-3"
            style={{ "border-top": "1px solid var(--cortex-bg-hover)", background: "var(--ui-panel-bg)" }}
          >
            <label class="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={liveUpdates()} 
                onChange={(e) => setLiveUpdates(e.currentTarget.checked)}
                class="w-4 h-4 rounded"
                style={{ 
                  "accent-color": "var(--cortex-info)"
                }}
              />
              <span class="text-xs text-neutral-400">Live updates</span>
            </label>
            
            <button
              onClick={copyToClipboard}
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ 
                background: copied() ? "var(--cortex-success)20" : "var(--ui-panel-bg-lighter)",
                color: copied() ? "var(--cortex-success)" : "#fff"
              }}
            >
              <Icon name="copy" size={14} />
              {copied() ? "Copied!" : "Copy for Bug Report"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

/** Hook to use system specs dialog */
export function useSystemSpecsDialog() {
  const [open, setOpen] = createSignal(false);
  
  return {
    open,
    show: () => setOpen(true),
    hide: () => setOpen(false),
    toggle: () => setOpen(prev => !prev),
    Dialog: () => <SystemSpecsDialog open={open()} onClose={() => setOpen(false)} />
  };
}

