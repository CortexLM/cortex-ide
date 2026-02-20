/**
 * CortexSeparator - Pixel-perfect dropdown divider for Cortex UI Design System
 * Dropdown divider: 1px solid line with padding
 */

import { Component, JSX, splitProps } from "solid-js";

export interface CortexSeparatorProps {
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexSeparator: Component<CortexSeparatorProps> = (props) => {
  const [local, others] = splitProps(props, [
    "class",
    "style",
  ]);

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    "align-self": "stretch",
    gap: "10px",
    padding: "4px 0",
    ...local.style,
  });

  const lineStyle = (): JSX.CSSProperties => ({
    width: "100%",
    height: "0",
    "border-bottom": "1px solid #2E2F31",
  });

  return (
    <div
      class={local.class}
      style={containerStyle()}
      role="separator"
      {...others}
    >
      <div style={lineStyle()} />
    </div>
  );
};

export default CortexSeparator;
