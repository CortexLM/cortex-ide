/**
 * CortexTooltip - Pixel-perfect tooltip component for Cortex UI Design System
 */

import { Component, JSX, splitProps, createSignal, Show, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";

export type CortexTooltipPosition = "top" | "bottom" | "left" | "right";

export interface CortexTooltipProps {
  content: string | JSX.Element;
  position?: CortexTooltipPosition;
  delay?: number;
  disabled?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
  children: JSX.Element;
}

export const CortexTooltip: Component<CortexTooltipProps> = (props) => {
  const [local, others] = splitProps(props, [
    "content",
    "position",
    "delay",
    "disabled",
    "class",
    "style",
    "children",
  ]);

  const [isVisible, setIsVisible] = createSignal(false);
  const [tooltipPos, setTooltipPos] = createSignal({ x: 0, y: 0 });
  let triggerRef: HTMLDivElement | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const position = () => local.position || "top";
  const delay = () => local.delay ?? 300;

  const tooltipStyle = (): JSX.CSSProperties => ({
    position: "fixed",
    left: `${tooltipPos().x}px`,
    top: `${tooltipPos().y}px`,
    "z-index": "var(--cortex-z-tooltip, 700)",
    padding: "6px 10px",
    background: "var(--cortex-tooltip-bg, var(--cortex-bg-elevated))",
    border: "1px solid var(--cortex-tooltip-border, rgba(255,255,255,0.1))",
    "border-radius": "var(--cortex-tooltip-radius, 4px)",
    "box-shadow": "var(--cortex-tooltip-shadow, 0 4px 6px rgba(0,0,0,0.3))",
    color: "var(--cortex-tooltip-text, var(--cortex-text-primary))",
    "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
    "font-size": "12px",
    "line-height": "1.4",
    "white-space": "nowrap",
    "pointer-events": "none",
    opacity: isVisible() ? "1" : "0",
    transform: isVisible() ? "translateY(0)" : "translateY(-4px)",
    transition: "opacity 150ms ease, transform 150ms ease",
    ...local.style,
  });

  const calculatePosition = () => {
    if (!triggerRef) return;

    const rect = triggerRef.getBoundingClientRect();
    const gap = 8;
    let x = 0;
    let y = 0;

    switch (position()) {
      case "top":
        x = rect.left + rect.width / 2;
        y = rect.top - gap;
        break;
      case "bottom":
        x = rect.left + rect.width / 2;
        y = rect.bottom + gap;
        break;
      case "left":
        x = rect.left - gap;
        y = rect.top + rect.height / 2;
        break;
      case "right":
        x = rect.right + gap;
        y = rect.top + rect.height / 2;
        break;
    }

    setTooltipPos({ x, y });
  };

  const handleMouseEnter = () => {
    if (local.disabled) return;
    
    timeoutId = setTimeout(() => {
      calculatePosition();
      setIsVisible(true);
    }, delay());
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    setIsVisible(false);
  };

  onCleanup(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });

  return (
    <>
      <div
        ref={triggerRef}
        class={local.class}
        style={{ display: "inline-flex" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...others}
      >
        {local.children}
      </div>

      <Show when={isVisible()}>
        <Portal>
          <div style={tooltipStyle()}>{local.content}</div>
        </Portal>
      </Show>
    </>
  );
};

export default CortexTooltip;


