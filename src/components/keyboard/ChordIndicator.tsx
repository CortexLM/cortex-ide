/**
 * ChordIndicator - Status bar indicator for chord keybinding mode.
 * Shows pending chord keystrokes and waiting message.
 */
import { Show, type Component } from "solid-js";
import { useKeymap } from "@/context/keymap";
import { tokens } from "@/design-system/tokens";

export interface ChordIndicatorProps {
  class?: string;
}

export const ChordIndicator: Component<ChordIndicatorProps> = (props) => {
  const keymap = useKeymap();

  return (
    <Show when={keymap.isChordModeActive()}>
      <div
        class={`flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium animate-pulse ${props.class ?? ""}`}
        style={{
          color: tokens.colors.accent.primary,
          background: tokens.colors.accent.muted,
          "border-radius": "var(--cortex-radius-sm)",
        }}
      >
        <kbd
          class="px-1.5 py-0.5 text-[10px] font-mono rounded border"
          style={{
            "background-color": tokens.colors.surface.hover,
            "border-color": tokens.colors.accent.primary,
            color: tokens.colors.text.primary,
          }}
        >
          {keymap.chordIndicator()}
        </kbd>
        <span style={{ color: tokens.colors.text.secondary }}>
          waiting for next key…
        </span>
      </div>
    </Show>
  );
};

export default ChordIndicator;
