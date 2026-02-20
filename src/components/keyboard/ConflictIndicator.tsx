import { Show, For, createSignal, createMemo } from "solid-js";
import { useKeymap } from "@/context/keymap";
import type { KeybindingConflict } from "@/context/keymap";
import { tokens } from "@/design-system/tokens";

export interface ConflictIndicatorProps {
  commandId: string;
}

export function ConflictIndicator(props: ConflictIndicatorProps) {
  const keymap = useKeymap();
  const [showTooltip, setShowTooltip] = createSignal(false);

  const conflictsForCommand = createMemo(() => {
    return keymap.conflicts().filter(
      (c: KeybindingConflict) => c.commands.includes(props.commandId)
    );
  });

  const conflictingCommands = createMemo(() => {
    const commands = new Set<string>();
    for (const conflict of conflictsForCommand()) {
      for (const cmd of conflict.commands) {
        if (cmd !== props.commandId) {
          commands.add(cmd);
        }
      }
    }
    return Array.from(commands);
  });

  const hasConflicts = () => conflictsForCommand().length > 0;

  return (
    <Show when={hasConflicts()}>
      <div
        class="relative inline-flex items-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span
          class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium cursor-help"
          style={{
            "background-color": tokens.colors.state.errorBg,
            color: tokens.colors.state.error,
          }}
        >
          <svg
            class="h-3 w-3"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clip-rule="evenodd"
            />
          </svg>
          Conflict
        </span>

        <Show when={showTooltip()}>
          <div
            class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 min-w-[200px] max-w-[300px] rounded-lg border p-3 text-xs shadow-lg"
            style={{
              "background-color": tokens.colors.surface.elevated,
              "border-color": tokens.colors.border.default,
              color: tokens.colors.text.primary,
            }}
          >
            <div
              class="font-semibold mb-1"
              style={{ color: tokens.colors.state.error }}
            >
              Keybinding Conflict
            </div>
            <div style={{ color: tokens.colors.text.secondary }}>
              Conflicts with:
            </div>
            <ul class="mt-1 space-y-0.5">
              <For each={conflictingCommands()}>
                {(cmd) => (
                  <li class="font-mono truncate" style={{ color: tokens.colors.text.muted }}>
                    {cmd}
                  </li>
                )}
              </For>
            </ul>
            <div
              class="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 rotate-45 border-r border-b"
              style={{
                "background-color": tokens.colors.surface.elevated,
                "border-color": tokens.colors.border.default,
              }}
            />
          </div>
        </Show>
      </div>
    </Show>
  );
}
