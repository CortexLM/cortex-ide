import { Show, For, createEffect, onCleanup } from "solid-js";
import { useKeymap } from "@/context/keymap";
import type { Keystroke } from "@/context/keymap";
import { tokens } from "@/design-system/tokens";

export interface KeyRecorderProps {
  commandId: string;
  onSave: () => void;
  onCancel: () => void;
}

function formatKeystrokeDisplay(ks: Keystroke): string {
  const parts: string[] = [];
  if (ks.modifiers.ctrl) parts.push("Ctrl");
  if (ks.modifiers.alt) parts.push("Alt");
  if (ks.modifiers.shift) parts.push("Shift");
  if (ks.modifiers.meta) parts.push("Meta");
  const keyMap: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Escape: "Esc",
    Backspace: "⌫",
    Delete: "Del",
    Enter: "↵",
    Tab: "⇥",
    " ": "Space",
  };
  parts.push(keyMap[ks.key] ?? (ks.key.length === 1 ? ks.key.toUpperCase() : ks.key));
  return parts.join("+");
}

export function KeyRecorder(props: KeyRecorderProps) {
  const keymap = useKeymap();

  createEffect(() => {
    if (!keymap.isRecording()) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onCancel();
        return;
      }
      if (e.key === "Enter" && keymap.recordedKeystrokes().length > 0) {
        e.preventDefault();
        props.onSave();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  const hasKeystrokes = () => keymap.recordedKeystrokes().length > 0;

  return (
    <div
      class="flex flex-col gap-3 rounded-lg border p-4"
      style={{
        "background-color": tokens.colors.surface.elevated,
        "border-color": tokens.colors.accent.primary,
      }}
    >
      <div class="flex items-center gap-2">
        <div
          class="h-2 w-2 rounded-full animate-pulse"
          style={{ "background-color": tokens.colors.state.error }}
        />
        <span
          class="text-sm font-medium"
          style={{ color: tokens.colors.accent.primary }}
        >
          Recording keybinding…
        </span>
        <span class="text-xs" style={{ color: tokens.colors.text.muted }}>
          Press keys to record, Enter to save, Escape to cancel
        </span>
      </div>

      <div class="flex items-center gap-2 min-h-[32px]">
        <Show
          when={hasKeystrokes()}
          fallback={
            <span class="text-sm italic" style={{ color: tokens.colors.text.placeholder }}>
              Waiting for input…
            </span>
          }
        >
          <div class="flex items-center gap-1">
            <For each={keymap.recordedKeystrokes()}>
              {(ks, i) => (
                <>
                  <Show when={i() > 0}>
                    <span class="text-xs mx-0.5" style={{ color: tokens.colors.text.muted }}>
                      then
                    </span>
                  </Show>
                  <kbd
                    class="px-2 py-1 text-xs font-mono rounded border"
                    style={{
                      "background-color": tokens.colors.accent.muted,
                      "border-color": tokens.colors.accent.primary,
                      color: tokens.colors.text.primary,
                    }}
                  >
                    {formatKeystrokeDisplay(ks)}
                  </kbd>
                </>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div class="flex items-center gap-2">
        <button
          onClick={() => props.onSave()}
          disabled={!hasKeystrokes()}
          class="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40"
          style={{
            "background-color": tokens.colors.state.success,
            color: tokens.colors.text.inverse,
          }}
        >
          Save
        </button>
        <button
          onClick={() => props.onCancel()}
          class="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors"
          style={{
            "background-color": tokens.colors.surface.hover,
            color: tokens.colors.text.secondary,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
