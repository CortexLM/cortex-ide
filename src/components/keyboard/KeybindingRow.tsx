import { Show, For, createMemo } from "solid-js";
import { useKeymap } from "@/context/keymap";
import type { CommandBinding, Keystroke } from "@/context/keymap";
import { ConflictIndicator } from "@/components/keyboard/ConflictIndicator";
import { tokens } from "@/design-system/tokens";

export interface KeybindingRowProps {
  binding: CommandBinding;
  isEditing: boolean;
  onStartEdit: () => void;
  onReset: () => void;
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

export function KeybindingRow(props: KeybindingRowProps) {
  const keymap = useKeymap();

  const effectiveBinding = createMemo(
    () => props.binding.customKeybinding ?? props.binding.defaultKeybinding
  );

  const isModified = () => !!props.binding.customKeybinding;

  const hasConflict = createMemo(() =>
    keymap.conflicts().some((c) => c.commands.includes(props.binding.commandId))
  );

  return (
    <div
      class="group flex items-center gap-4 px-4 py-2.5 border-b transition-colors hover:bg-[--hover-bg]"
      style={{
        "border-color": tokens.colors.border.default,
        "--hover-bg": tokens.colors.surface.hover,
        "background-color": props.isEditing
          ? tokens.colors.accent.muted
          : undefined,
      }}
    >
      <div class="flex-[2] min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="font-medium text-sm truncate"
            style={{ color: tokens.colors.text.primary }}
          >
            {props.binding.label}
          </span>
          <Show when={isModified()}>
            <span
              class="text-[10px] rounded-full px-1.5 py-0.5"
              style={{
                "background-color": tokens.colors.accent.muted,
                color: tokens.colors.accent.primary,
              }}
            >
              Modified
            </span>
          </Show>
          <Show when={hasConflict()}>
            <ConflictIndicator commandId={props.binding.commandId} />
          </Show>
        </div>
        <div
          class="text-xs truncate mt-0.5"
          style={{ color: tokens.colors.text.muted }}
        >
          <span style={{ color: tokens.colors.text.secondary }}>
            {props.binding.category}
          </span>
          <span class="mx-1">·</span>
          <span class="font-mono">{props.binding.commandId}</span>
        </div>
      </div>

      <div class="w-[200px] flex items-center">
        <Show
          when={effectiveBinding()}
          fallback={
            <button
              onClick={() => props.onStartEdit()}
              class="text-sm italic px-2 py-1 rounded border border-dashed transition-colors hover:border-[--accent] hover:text-[--accent]"
              style={{
                "border-color": tokens.colors.border.default,
                color: tokens.colors.text.muted,
                "--accent": tokens.colors.accent.primary,
              }}
            >
              Record shortcut
            </button>
          }
        >
          <button
            onClick={() => props.onStartEdit()}
            class="flex items-center gap-1 text-left"
            title="Click to change keybinding"
          >
            <For each={effectiveBinding()!.keystrokes}>
              {(ks, i) => (
                <>
                  <Show when={i() > 0}>
                    <span
                      class="text-xs mx-0.5"
                      style={{ color: tokens.colors.text.muted }}
                    >
                      then
                    </span>
                  </Show>
                  <kbd
                    class="px-2 py-0.5 text-xs font-mono rounded border transition-colors hover:border-[--accent]"
                    style={{
                      "background-color": tokens.colors.surface.hover,
                      "border-color": hasConflict()
                        ? tokens.colors.state.error
                        : tokens.colors.border.default,
                      color: tokens.colors.text.primary,
                      "--accent": tokens.colors.accent.primary,
                    }}
                  >
                    {formatKeystrokeDisplay(ks)}
                  </kbd>
                </>
              )}
            </For>
          </button>
        </Show>
      </div>

      <div class="w-[80px] flex items-center justify-end">
        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Show when={isModified()}>
            <button
              onClick={() => props.onReset()}
              class="p-1.5 rounded transition-colors hover:bg-[--hover-bg]"
              style={{
                color: tokens.colors.text.muted,
                "--hover-bg": tokens.colors.surface.hover,
              }}
              title="Reset to default"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39 5.5 5.5 0 01-.611 1.211zM4.688 8.576a5.5 5.5 0 019.201-2.466l.312.311H11.77a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V3.537a.75.75 0 00-1.5 0v2.033l-.312-.311A7 7 0 002.63 8.397a.75.75 0 001.449.39 5.5 5.5 0 01.609-1.211z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </Show>
          <Show when={effectiveBinding()}>
            <button
              onClick={() => keymap.setCustomBinding(props.binding.commandId, null)}
              class="p-1.5 rounded transition-colors"
              style={{
                color: tokens.colors.text.muted,
              }}
              title="Remove keybinding"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
