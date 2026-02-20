import {
  Component,
  ParentProps,
  Show,
  createSignal,
  onMount,
  onCleanup,
  JSX,
} from "solid-js";
import { useZenModeContext } from "@/context/ZenModeContext";
import { CortexIcon, CortexButton } from "@/components/cortex/primitives";

export interface ZenModeOverlayProps extends ParentProps {
  maxWidth?: string;
  centerLayout?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
}

export const ZenModeOverlay: Component<ZenModeOverlayProps> = (props) => {
  const zenMode = useZenModeContext();
  const [exitButtonVisible, setExitButtonVisible] = createSignal(true);
  const [exitButtonHovered, setExitButtonHovered] = createSignal(false);

  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  const resetHideTimer = () => {
    setExitButtonVisible(true);
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
    hideTimeout = setTimeout(() => {
      if (!exitButtonHovered()) {
        setExitButtonVisible(false);
      }
    }, 3000);
  };

  onMount(() => {
    resetHideTimer();

    const handleMouseMove = () => {
      resetHideTimer();
    };

    document.addEventListener("mousemove", handleMouseMove);

    onCleanup(() => {
      document.removeEventListener("mousemove", handleMouseMove);
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
    });
  });

  const shouldCenter = () => props.centerLayout ?? true;
  const maxWidth = () => props.maxWidth ?? "900px";

  const overlayStyle = (): JSX.CSSProperties => ({
    position: "fixed",
    inset: "0",
    "z-index": "9998",
    display: "flex",
    "flex-direction": "column",
    background: "var(--cortex-bg-primary)",
    ...props.style,
  });

  const exitButtonStyle = (): JSX.CSSProperties => ({
    position: "fixed",
    top: "16px",
    right: "16px",
    "z-index": "9999",
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "8px 12px",
    "border-radius": "8px",
    background: exitButtonHovered()
      ? "var(--cortex-bg-secondary)"
      : "rgba(0, 0, 0, 0.4)",
    color: exitButtonHovered()
      ? "var(--cortex-text-primary)"
      : "rgba(255, 255, 255, 0.8)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    "backdrop-filter": "blur(8px)",
    cursor: "pointer",
    opacity: exitButtonVisible() ? "1" : "0",
    transform: exitButtonVisible() ? "translateY(0)" : "translateY(-8px)",
    "pointer-events": exitButtonVisible() ? "auto" : "none",
    "box-shadow": "0 4px 12px rgba(0, 0, 0, 0.3)",
    transition: "all 300ms ease",
  });

  const contentContainerStyle = (): JSX.CSSProperties => ({
    flex: "1",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    "justify-content": shouldCenter() ? "center" : "flex-start",
    "align-items": shouldCenter() ? "center" : "stretch",
    padding: shouldCenter() ? "24px" : "0",
    transition: "all 300ms ease",
  });

  const contentStyle = (): JSX.CSSProperties => ({
    width: "100%",
    height: "100%",
    overflow: "hidden",
    "max-width": shouldCenter() ? maxWidth() : "100%",
  });

  return (
    <Show when={zenMode.isActive()}>
      <div class={props.class} style={overlayStyle()}>
        <button
          style={exitButtonStyle()}
          onClick={() => zenMode.actions.exit()}
          onMouseEnter={() => {
            setExitButtonHovered(true);
            setExitButtonVisible(true);
          }}
          onMouseLeave={() => {
            setExitButtonHovered(false);
            resetHideTimer();
          }}
          title="Exit Zen Mode (Escape twice)"
        >
          <CortexIcon name="x" size={16} />
          <span style={{ "font-size": "13px", "font-weight": "500" }}>
            Exit Zen Mode
          </span>
        </button>

        <div style={contentContainerStyle()}>
          <div style={contentStyle()}>{props.children}</div>
        </div>
      </div>
    </Show>
  );
};

export interface ZenModeToggleButtonProps {
  class?: string;
  style?: JSX.CSSProperties;
}

export const ZenModeToggleButton: Component<ZenModeToggleButtonProps> = (props) => {
  const zenMode = useZenModeContext();

  return (
    <CortexButton
      variant="ghost"
      size="sm"
      onClick={() => zenMode.actions.toggle()}
      class={props.class}
      style={props.style}
      title={zenMode.isActive() ? "Exit Zen Mode (Ctrl+K Z)" : "Enter Zen Mode (Ctrl+K Z)"}
    >
      <CortexIcon name={zenMode.isActive() ? "minimize" : "maximize"} size={16} />
    </CortexButton>
  );
};

export default ZenModeOverlay;
