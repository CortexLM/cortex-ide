import { Component, createSignal, onMount, onCleanup, Show } from "solid-js";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { SimpleTooltip } from "@/components/ui";
import { extensionLogger } from "@/utils/logger";

interface ContributedStatusBarItemProps {
  itemId: string;
  extensionId: string;
  text: string;
  tooltip?: string;
  command?: string;
  priority?: number;
  alignment?: "left" | "right";
  class?: string;
}

interface StatusBarUpdatePayload {
  text?: string;
  tooltip?: string;
}

export const ContributedStatusBarItem: Component<ContributedStatusBarItemProps> = (props) => {
  const [currentText, setCurrentText] = createSignal(props.text);
  const [currentTooltip, setCurrentTooltip] = createSignal(props.tooltip ?? "");

  let unlisten: UnlistenFn | null = null;
  let mounted = true;

  const handleClick = async () => {
    if (!props.command) return;
    try {
      await invoke("execute_wasm_command", {
        extensionId: props.extensionId,
        command: props.command,
        args: [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      extensionLogger.error(`Failed to execute status bar command "${props.command}":`, message);
    }
  };

  onMount(() => {
    listen<StatusBarUpdatePayload>(`plugin:statusbar-update-${props.itemId}`, (event) => {
      if (!mounted) return;
      if (event.payload.text !== undefined) {
        setCurrentText(event.payload.text);
      }
      if (event.payload.tooltip !== undefined) {
        setCurrentTooltip(event.payload.tooltip);
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
        extensionLogger.error(`Failed to listen for status bar item "${props.itemId}":`, err);
      });

    onCleanup(() => {
      mounted = false;
      if (unlisten) {
        unlisten();
      }
    });
  });

  const itemElement = () => (
    <button
      type="button"
      class={`inline-flex items-center gap-1 px-1.5 h-full text-[11px] leading-[22px] whitespace-nowrap bg-transparent border-none text-[var(--jb-statusbar-text,var(--jb-text-muted))] hover:bg-[var(--jb-statusbar-hover,rgba(255,255,255,0.12))] transition-colors ${props.command ? "cursor-pointer" : "cursor-default"} ${props.class ?? ""}`}
      onClick={handleClick}
      style={{ order: props.priority ?? 0 }}
    >
      {currentText()}
    </button>
  );

  return (
    <Show when={currentTooltip()} fallback={itemElement()}>
      <SimpleTooltip text={currentTooltip()} position="top">
        {itemElement()}
      </SimpleTooltip>
    </Show>
  );
};
