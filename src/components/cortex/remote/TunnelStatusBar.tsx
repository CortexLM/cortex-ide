import { Component, Show, For } from "solid-js";
import { useTunnel } from "@/context/TunnelContext";

interface TunnelStatusBarProps {
  onClick?: () => void;
}

export const TunnelStatusBar: Component<TunnelStatusBarProps> = (props) => {
  const tunnel = useTunnel();

  const hasActive = () => tunnel.activeTunnelCount() > 0;

  return (
    <div class="relative group">
      <button
        onClick={() => props.onClick?.()}
        class="flex items-center gap-1.5 h-7 px-2 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors"
        title={hasActive() ? `${tunnel.activeTunnelCount()} active tunnel(s)` : "No active tunnels"}
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a4 4 0 0 0-4 4v1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4zm2 5V5a2 2 0 1 0-4 0v1h4z" />
        </svg>
        <span
          class={`w-2 h-2 rounded-full ${hasActive() ? "bg-green-400" : "bg-gray-500"}`}
        />
        <Show when={hasActive()}>
          <span>{tunnel.activeTunnelCount()}</span>
        </Show>
      </button>

      {/* Tooltip on hover */}
      <Show when={tunnel.state.tunnels.length > 0}>
        <div class="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50">
          <div class="bg-[#2d2d2d] border border-white/10 rounded-lg shadow-lg p-2 min-w-[200px] max-w-[320px]">
            <div class="text-xs text-white/50 mb-1.5 font-medium">Tunnels</div>
            <For each={tunnel.state.tunnels}>
              {(t) => (
                <div class="flex items-center gap-2 py-1 text-xs">
                  <span
                    class={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      t.status === "active"
                        ? "bg-green-400"
                        : t.status === "connecting"
                          ? "bg-yellow-400"
                          : t.status === "error"
                            ? "bg-red-400"
                            : "bg-gray-500"
                    }`}
                  />
                  <span class="text-white/80 truncate">{t.url || `Port ${t.localPort}`}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default TunnelStatusBar;
