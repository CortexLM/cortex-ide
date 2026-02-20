/**
 * Tooltip - Cortex UI Design System Tooltip Component
 * 
 * @deprecated Prefer importing CortexTooltip from "@/components/cortex/primitives" for new code.
 * This wrapper delegates to CortexTooltip while preserving the legacy API.
 */
import { JSX, splitProps } from "solid-js";
import { CortexTooltip } from "../cortex/primitives/CortexTooltip";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: JSX.Element | string;
  children: JSX.Element;
  position?: TooltipPosition;
  delay?: number;
  disabled?: boolean;
  maxWidth?: number;
  style?: JSX.CSSProperties;
}

export function Tooltip(props: TooltipProps) {
  const [local] = splitProps(props, [
    "content", "children", "position", "delay", "disabled", "maxWidth", "style"
  ]);

  return (
    <CortexTooltip
      content={local.content}
      position={local.position}
      delay={local.delay}
      disabled={local.disabled}
      style={local.style}
    >
      {local.children}
    </CortexTooltip>
  );
}

export interface SimpleTooltipProps {
  text: string;
  children: JSX.Element;
  position?: TooltipPosition;
  delay?: number;
  disabled?: boolean;
}

export function SimpleTooltip(props: SimpleTooltipProps) {
  return (
    <Tooltip
      content={props.text}
      position={props.position}
      delay={props.delay}
      disabled={props.disabled}
    >
      {props.children}
    </Tooltip>
  );
}
