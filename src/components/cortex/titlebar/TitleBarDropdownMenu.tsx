/**
 * TitleBarDropdownMenu - Pixel-perfect dropdown menu for Cortex title bar
 * Figma "Dropdown Menu" (20:2841):
 *   Container: bg #1C1C1D, border 1px solid #2E2F31, border-radius 8px, padding 4px
 *   Width: 243px (min), column layout
 *   Shadow: elevation-3
 *
 * Figma "Dropdown Item" (20:2748 / 20:2832):
 *   Layout: row, space-between, center, gap 8px, padding 4px 8px
 *   Left frame: row, center, gap 8px (icon 14×14 + label)
 *   Label: Figtree 12px weight 400, color #FCFCFC
 *   Shortcut: Figtree 12px weight 400, color #8C8D8F
 *   Hover: bg #252628, border-radius 4px (fill_KPHMD8 = #2E2F31 per Figma hover variant)
 *
 * Divider (20:2794): padding 4px 0px, inner line 1px height, fill width
 */

import { Component, JSX, For, Show, createSignal } from "solid-js";
import type { MenuItem } from "./defaultMenus";

export interface TitleBarDropdownMenuProps {
  items: MenuItem[];
  onItemClick: (item: MenuItem) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const TitleBarDropdownMenu: Component<TitleBarDropdownMenuProps> = (props) => {
  return (
    <div
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
      style={{
        position: "absolute",
        top: "100%",
        left: "0",
        "min-width": "243px",
        "max-width": "280px",
        background: "#1C1C1D",
        "border-radius": "8px",
        border: "1px solid #2E2F31",
        padding: "4px",
        "box-shadow": "0 8px 16px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.4)",
        "z-index": "9999",
        "margin-top": "0",
      }}>
      <For each={props.items}>
        {(item) => (
          <Show
            when={!item.separator}
            fallback={
              <div style={{
                padding: "4px 0px",
                width: "100%",
              }}>
                <div style={{
                  height: "1px",
                  width: "100%",
                  background: "#2E2F31",
                }} />
              </div>
            }
          >
            <DropdownMenuItem item={item} onClick={() => props.onItemClick(item)} />
          </Show>
        )}
      </For>
    </div>
  );
};

const DropdownMenuItem: Component<{ item: MenuItem; onClick: () => void }> = (props) => {
  const [hovered, setHovered] = createSignal(false);

  const style = (): JSX.CSSProperties => ({
    width: "100%",
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    gap: "8px",
    padding: "4px 8px",
    background: hovered() ? "#252628" : "transparent",
    border: "none",
    cursor: "pointer",
    "font-family": "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    "font-size": "12px",
    "font-weight": "400",
    "line-height": "1.167em",
    color: "#FCFCFC",
    "text-align": "left",
    "border-radius": hovered() ? "4px" : "0",
    "box-sizing": "border-box",
  });

  return (
    <button
      onClick={props.onClick}
      style={style()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span>{props.item.label}</span>
      <Show when={props.item.shortcut}>
        <span style={{
          color: "#8C8D8F",
          "font-family": "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          "font-size": "12px",
          "font-weight": "400",
          "line-height": "1.167em",
          "white-space": "nowrap",
          "flex-shrink": "0",
        }}>
          {props.item.shortcut}
        </span>
      </Show>
    </button>
  );
};
