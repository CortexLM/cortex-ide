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
        "min-width": "220px",
        "max-width": "280px",
        background: "var(--cortex-bg-secondary)",
        "border-radius": "var(--cortex-radius-md)",
        border: "1px solid var(--cortex-border-default)",
        padding: "var(--cortex-space-1) 0",
        "box-shadow": "var(--cortex-elevation-3)",
        "z-index": "var(--cortex-z-max)",
        "margin-top": "var(--cortex-space-1)",
      }}>
      <For each={props.items}>
        {(item) => (
          <Show
            when={!item.separator}
            fallback={
              <div style={{
                height: "1px",
                background: "var(--cortex-border-default)",
                margin: "var(--cortex-space-1) 0",
              }} />
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
    width: "calc(100% - var(--cortex-space-2))",
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "var(--cortex-space-1) var(--cortex-space-2)",
    background: hovered() ? "var(--cortex-bg-hover)" : "transparent",
    border: "none",
    cursor: "pointer",
    "font-size": "var(--cortex-text-sm)",
    "font-family": "var(--cortex-font-sans)",
    "font-weight": "var(--cortex-font-medium)",
    color: "var(--cortex-text-primary)",
    "text-align": "left",
    "border-radius": "var(--cortex-radius-xs)",
    margin: "0 var(--cortex-space-1)",
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
          color: "var(--cortex-text-secondary)",
          "font-size": "var(--cortex-text-xs)",
          "margin-left": "var(--cortex-space-6)",
        }}>
          {props.item.shortcut}
        </span>
      </Show>
    </button>
  );
};
