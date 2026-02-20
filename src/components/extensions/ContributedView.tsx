import { Component, createSignal, onMount, onCleanup, Show } from "solid-js";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { SafeHTML, LoadingSpinner } from "@/components/ui";
import { extensionLogger } from "@/utils/logger";

interface ContributedViewProps {
  viewId: string;
  extensionId: string;
  title: string;
  icon?: string;
  class?: string;
}

export const ContributedView: Component<ContributedViewProps> = (props) => {
  const [content, setContent] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [collapsed, setCollapsed] = createSignal(false);

  let unlisten: UnlistenFn | null = null;
  let mounted = true;

  const fetchContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<string>("execute_wasm_command", {
        extensionId: props.extensionId,
        command: `${props.viewId}.render`,
        args: [],
      });
      if (mounted) {
        setContent(result);
      }
    } catch (err) {
      if (mounted) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        extensionLogger.error(`Failed to render view "${props.viewId}":`, message);
      }
    } finally {
      if (mounted) {
        setLoading(false);
      }
    }
  };

  onMount(() => {
    fetchContent();

    listen<string>(`plugin:view-content-${props.viewId}`, (event) => {
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
        extensionLogger.error(`Failed to listen for view "${props.viewId}":`, err);
      });

    onCleanup(() => {
      mounted = false;
      if (unlisten) {
        unlisten();
      }
    });
  });

  return (
    <div class={`flex flex-col overflow-hidden ${props.class ?? ""}`}>
      <button
        type="button"
        class="flex items-center gap-1.5 px-2 h-[22px] text-[11px] font-semibold uppercase tracking-wide cursor-pointer select-none border-b border-[var(--jb-border)] bg-[var(--jb-surface)] text-[var(--jb-text)] hover:bg-[var(--jb-surface-hover)] w-full text-left"
        onClick={() => setCollapsed((prev) => !prev)}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="flex-shrink-0 transition-transform"
          style={{ transform: collapsed() ? "rotate(-90deg)" : "rotate(0deg)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <Show when={props.icon}>
          <span class="flex-shrink-0 text-xs">{props.icon}</span>
        </Show>
        <span class="truncate">{props.title}</span>
      </button>

      <Show when={!collapsed()}>
        <div class="flex-1 overflow-auto">
          <Show when={loading()}>
            <div class="flex flex-col items-center justify-center gap-2 py-8 text-[var(--jb-text-muted)]">
              <LoadingSpinner size="md" />
              <span class="text-xs">Loading view…</span>
            </div>
          </Show>

          <Show when={!loading() && error()}>
            <div class="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center">
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
