/**
 * CortexDropdownMenu - Pixel-perfect dropdown menu container for Cortex UI Design System
 * Figma "Dropdown Menu": standalone container with dark bg and border
 */

import { Component, JSX, splitProps, onMount, onCleanup } from "solid-js";

export interface CortexDropdownMenuProps {
  children?: JSX.Element;
  width?: number;
  class?: string;
  style?: JSX.CSSProperties;
  onClickOutside?: () => void;
}

export const CortexDropdownMenu: Component<CortexDropdownMenuProps> = (props) => {
  const [local, others] = splitProps(props, [
    "children",
    "width",
    "class",
    "style",
    "onClickOutside",
  ]);

  let menuRef: HTMLDivElement | undefined;

  const menuWidth = () => local.width ?? 243;

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    position: "absolute",
    width: `${menuWidth()}px`,
    padding: "4px",
    "box-shadow": "0 8px 16px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.4)",
    background: "var(--cortex-dropdown-bg)",
    border: "1px solid var(--cortex-dropdown-border)",
    "border-radius": "8px",
    "z-index": "var(--cortex-z-dropdown, 600)",
    ...local.style,
  });

  onMount(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef && !menuRef.contains(e.target as Node)) {
        local.onClickOutside?.();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    onCleanup(() => document.removeEventListener("mousedown", handleMouseDown));
  });

  return (
    <div
      ref={menuRef}
      role="menu"
      class={local.class}
      style={containerStyle()}
      {...others}
    >
      {local.children}
    </div>
  );
};

export default CortexDropdownMenu;
