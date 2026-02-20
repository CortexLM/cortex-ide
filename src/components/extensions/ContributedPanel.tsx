import { Component, createSignal, onMount, onCleanup, Show } from "solid-js";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { SafeHTML, LoadingSpinner } from "@/components/ui";
import { extensionLogger } from "@/utils/logger";

interface ContributedPanelProps {
  panelId: string;
  extensionId: string;
  title: string;
  icon?: string;
  class?: string;
  onClose?: () => void;
}

const MIN_PANEL_HEIGHT = 80;
const MAX_PANEL_HEIGHT = 600;
const DEFAULT_PANEL_HEIGHT = 200;

export const ContributedPanel: Component<ContributedPanelProps> = (props) => {
  const [content, setContent] = createSignal("");
  const [isCollapsed, setIsCollapsed] = createSignal(false);
  const [height, setHeight] = createSignal(DEFAULT_PANEL_HEIGHT);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [resizing, setResizing] = createSignal(false);

  let unlisten: UnlistenFn | null = null;
  let mounted = true;
  let startY = 0;
  let startHeight = 0;

  const fetchContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<string>("execute_wasm_command", {
        extensionId: props.extensionId,
        command: `${props.panelId}.render`,
        args: [],
      });
      if (mounted) {
        setContent(result);
      }
    } catch (err) {
      if (mounted) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        extensionLogger.error(`Failed to render panel "${props.panelId}":`, message);
      }
    } finally {
      if (mounted) {
        setLoading(false);
      }
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    const delta = startY - e.clientY;
    const newHeight = Math.min(MAX_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, startHeight + delta));
    setHeight(newHeight);
  };

  const handleMouseUp = () => {
    setResizing(false);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const handleResizeStart = (e: MouseEvent) => {
    e.preventDefault();
    startY = e.clientY;
    startHeight = height();
    setResizing(true);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  onMount(() => {
    fetchContent();

    listen<string>(`plugin:panel-content-${props.panelId}`, (event) => {
      if (mounted) {
        setContent(event.payload);
        setLoading(false);
        setError(null);
      }
    })
      .then((unlistenFn) => {
        if (mounted) {
          unlisten = unlistenFn;
        } else {
          unlistenFn();
        }
      })
      .catch((err) => {
        extensionLogger.error(`Failed to listen for panel "${props.panelId}":`, err);
      });

    onCleanup(() => {
      mounted = false;
      if (unlisten) {
        unlisten();
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    });
  });

  return (
    <div
      class={`flex flex-col border-t border-[var(--jb-border)] bg-[var(--jb-surface)] ${props.class ?? ""}`}
      style={{ height: isCollapsed() ? "auto" : `${height()}px` }}
    >
      {/* Drag handle */}
      <div
        class="h-[3px] cursor-ns-resize flex-shrink-0 hover:bg-[var(--jb-accent,#2979ff)]"
        style={{
          "background-color": resizing() ? "var(--jb-accent, #2979ff)" : "transparent",
        }}
        onMouseDown={handleResizeStart}
      />

      {/* Tab header */}
      <div class="flex items-center h-[35px] px-2 gap-1 border-b border-[var(--jb-border)] flex-shrink-0">
        <button
          type="button"
          class="flex items-center gap-1.5 px-1.5 py-0.5 text-[11px] font-medium border-b-2 border-[var(--jb-accent,#2979ff)] text-[var(--jb-text)] bg-transparent cursor-pointer select-none"
          onClick={() => setIsCollapsed((prev) => !prev)}
        >
          <Show when={props.icon}>
            <span class="text-xs">{props.icon}</span>
          </Show>
          <span class="truncate max-w-[150px]">{props.title}</span>
        </button>

        <div class="flex-1" />

        <Show when={!isCollapsed()}>
          <button
            type="button"
            class="flex items-center justify-center w-5 h-5 rounded text-[var(--jb-text-muted)] hover:text-[var(--jb-text)] hover:bg-[var(--jb-surface-hover)] cursor-pointer"
            onClick={() => setIsCollapsed(true)}
            title="Minimize"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </Show>

        <Show when={props.onClose}>
          <button
            type="button"
            class="flex items-center justify-center w-5 h-5 rounded text-[var(--jb-text-muted)] hover:text-[var(--jb-text)] hover:bg-[var(--jb-surface-hover)] cursor-pointer"
            onClick={props.onClose}
            title="Close"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </Show>
      </div>

      {/* Content area */}
      <Show when={!isCollapsed()}>
        <div class="flex-1 overflow-auto min-h-0">
          <Show when={loading()}>
            <div class="flex flex-col items-center justify-center gap-2 py-8 text-[var(--jb-text-muted)]">
              <LoadingSpinner size="md" />
              <span class="text-xs">Loading panel…</span>
            </div>
          </Show>

          <Show when={!loading() && error()}>
            <div class="flex flex-col items-center justify-center gap-3 py-6 px-4 text-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--jb-error, #ef4444)"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span class="text-xs text-[var(--jb-error,#ef4444)]">{error()}</span>
              <button
                type="button"
                class="text-xs px-3 py-1 rounded border border-[var(--jb-border)] bg-[var(--jb-surface)] text-[var(--jb-text)] hover:bg-[var(--jb-surface-hover)] cursor-pointer"
                onClick={fetchContent}
              >
                Retry
              </button>
            </div>
          </Show>

          <Show when={!loading() && !error() && content()}>
            <SafeHTML html={content()} class="p-2 text-xs" />
          </Show>
        </div>
      </Show>
    </div>
  );
};
