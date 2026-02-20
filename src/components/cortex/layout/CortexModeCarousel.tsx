import { JSX, Show } from "solid-js";
import type { ViewMode } from "./types";

export interface CortexModeCarouselProps {
  mode: ViewMode;
  vibeContent: () => JSX.Element;
  ideContent: () => JSX.Element;
}

export function CortexModeCarousel(props: CortexModeCarouselProps) {
  const containerStyle = (): JSX.CSSProperties => ({
    flex: "1",
    display: "flex",
  });

  return (
    <div style={containerStyle()}>
      <Show when={props.mode === "vibe"}>
        <div style={{ width: "100%", height: "100%", display: "flex", gap: "var(--cortex-space-3)", padding: "0 var(--cortex-space-3)", background: "var(--cortex-bg-primary)" }}>
          {props.vibeContent()}
        </div>
      </Show>
      <Show when={props.mode === "ide"}>
        <div style={{ width: "100%", height: "100%", display: "flex", background: "var(--cortex-bg-primary)" }}>
          {props.ideContent()}
        </div>
      </Show>
    </div>
  );
}
