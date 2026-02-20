import { Component, createSignal, onMount, onCleanup, Show, JSX } from "solid-js";
import { ScreencastMode as BaseScreencastMode } from "@/components/ScreencastMode";
import { useSettings } from "@/context/SettingsContext";

export interface ScreencastModeLayoutProps {
  class?: string;
  style?: JSX.CSSProperties;
}

export const ScreencastModeLayout: Component<ScreencastModeLayoutProps> = (props) => {
  const { effectiveSettings } = useSettings();
  const [isActive, setIsActive] = createSignal(false);

  const screencastEnabled = () => effectiveSettings().screencastMode?.enabled ?? false;

  onMount(() => {
    const handleToggle = () => setIsActive((prev) => !prev);
    const handleEnable = () => setIsActive(true);
    const handleDisable = () => setIsActive(false);

    window.addEventListener("screencast:toggle", handleToggle);
    window.addEventListener("screencast:enable", handleEnable);
    window.addEventListener("screencast:disable", handleDisable);

    if (screencastEnabled()) {
      setIsActive(true);
    }

    onCleanup(() => {
      window.removeEventListener("screencast:toggle", handleToggle);
      window.removeEventListener("screencast:enable", handleEnable);
      window.removeEventListener("screencast:disable", handleDisable);
    });
  });

  return (
    <div class={props.class} style={props.style}>
      <Show when={isActive() || screencastEnabled()}>
        <BaseScreencastMode />
      </Show>

      <Show when={isActive()}>
        <div
          style={{
            position: "fixed",
            top: "8px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "4px 12px",
            background: "rgba(220, 50, 50, 0.9)",
            color: "white",
            "border-radius": "var(--cortex-radius-sm, 4px)",
            "font-size": "11px",
            "font-weight": "600",
            "z-index": "99998",
            "pointer-events": "none",
            display: "flex",
            "align-items": "center",
            gap: "6px",
          }}
        >
          <span style={{
            width: "8px",
            height: "8px",
            "border-radius": "50%",
            background: "white",
            animation: "screencast-pulse 1.5s ease-in-out infinite",
          }} />
          Screencast Mode
        </div>

        <style>{`
          @keyframes screencast-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </Show>
    </div>
  );
};

export { BaseScreencastMode as ScreencastMode };
export default ScreencastModeLayout;
