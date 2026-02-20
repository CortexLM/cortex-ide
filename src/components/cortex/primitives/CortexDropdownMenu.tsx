/**
 * CortexDropdownMenu - Pixel-perfect dropdown menu container for Cortex UI Design System
 * Figma "Dropdown Menu": standalone container with dark bg and border
 */

import { Component, JSX, splitProps } from "solid-js";

export interface CortexDropdownMenuProps {
  children?: JSX.Element;
  width?: number;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CortexDropdownMenu: Component<CortexDropdownMenuProps> = (props) => {
  const [local, others] = splitProps(props, [
    "children",
    "width",
    "class",
    "style",
  ]);

  const menuWidth = () => local.width ?? 243;

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    position: "absolute",
    width: `${menuWidth()}px`,
    padding: "4px 0",
    background: "var(--cortex-dropdown-bg)",
    border: "1px solid var(--cortex-dropdown-border)",
    "border-radius": "8px",
    "z-index": "var(--cortex-z-dropdown, 600)",
    ...local.style,
  });

  return (
    <div
      class={local.class}
      style={containerStyle()}
      {...others}
    >
      {local.children}
    </div>
  );
};

export default CortexDropdownMenu;
