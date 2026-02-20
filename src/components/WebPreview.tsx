import { Show, For, createSignal } from "solid-js";
import { usePreview } from "@/context/PreviewContext";
import { Icon } from "./ui/Icon";

export function WebPreview() {
  const { state, closePreview, refreshPreview, setActiveServer } = usePreview();
  const [isLoading, setIsLoading] = createSignal(true);
  const [showServerList, setShowServerList] = createSignal(false);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    refreshPreview();
  };

  const openExternal = () => {
    if (state.activeServer) {
      window.open(state.activeServer.url, "_blank");
    }
  };

  return (
    <Show when={state.showPreview && state.activeServer}>
      <div 
        class="h-full flex flex-col rounded-2xl overflow-hidden border"
        style={{ 
          background: "var(--background-base)",
          "border-color": "var(--border-weak)"
        }}
      >
        {/* Header */}
        <div 
          class="shrink-0 h-10 flex items-center justify-between px-3 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          {/* Server selector */}
          <div class="relative">
            <button
              onClick={() => setShowServerList(!showServerList())}
              class="flex items-center gap-2 px-2 py-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-base)" }}
            >
              <Icon name="globe" class="w-3.5 h-3.5" style={{ color: "var(--cortex-success)" }} />
              <span class="text-xs font-mono">{state.activeServer!.url}</span>
              <Show when={state.servers.length > 1}>
                <Icon name="chevron-down" class="w-3 h-3" style={{ color: "var(--text-weaker)" }} />
              </Show>
            </button>
            
            {/* Server dropdown */}
            <Show when={showServerList() && state.servers.length > 1}>
              <div 
                class="absolute top-full left-0 mt-1 py-1 rounded-lg border shadow-lg z-50 min-w-[200px]"
                style={{ 
                  background: "var(--surface-raised)",
                  "border-color": "var(--border-weak)"
                }}
              >
                <For each={state.servers}>
                  {(server) => (
                    <button
                      onClick={() => {
                        setActiveServer(server);
                        setShowServerList(false);
                        setIsLoading(true);
                      }}
                      class="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-[var(--surface-overlay)]"
                      style={{ 
                        color: server.port === state.activeServer?.port ? "var(--text-base)" : "var(--text-weak)"
                      }}
                    >
                      <Icon 
                        name="globe"
                        class="w-3.5 h-3.5" 
                        style={{ color: server.port === state.activeServer?.port ? "var(--cortex-success)" : "var(--text-weaker)" }} 
                      />
                      <span class="text-xs font-mono">{server.url}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Actions */}
          <div class="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title="Refresh"
            >
              <Icon name="rotate" class={`w-3.5 h-3.5 ${isLoading() ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={openExternal}
              class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title="Open in browser"
            >
              <Icon name="arrow-up-right-from-square" class="w-3.5 h-3.5" />
            </button>
            <button
              onClick={closePreview}
              class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title="Close preview"
            >
              <Icon name="xmark" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Iframe container */}
        <div class="flex-1 relative">
          {/* Loading overlay */}
          <Show when={isLoading()}>
            <div 
              class="absolute inset-0 flex items-center justify-center z-10"
              style={{ background: "var(--background-stronger)" }}
            >
              <div class="flex flex-col items-center gap-3">
                <div 
                  class="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ "border-color": "var(--border-weak)", "border-top-color": "transparent" }}
                />
                <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
                  Loading preview...
                </span>
              </div>
            </div>
          </Show>
          
          {/* Iframe - use Show with keyed to force re-render on refresh */}
          <Show when={`${state.activeServer!.url}-${state.refreshKey}`} keyed>
            <iframe
              src={state.activeServer!.url}
              class="w-full h-full border-0"
              style={{ background: "white" }}
              onLoad={handleIframeLoad}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              title="Web Preview"
            />
          </Show>
        </div>
      </div>
    </Show>
  );
}

