import { Component, Show, JSX } from "solid-js";
import { CortexIcon } from "../primitives/CortexIcon";

export interface ConversationItemProps {
  title: string;
  changesCount?: number;
  isSelected: boolean;
  onClick: () => void;
}

export const ConversationItem: Component<ConversationItemProps> = (props) => {
  const style = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "padding-left": "32px",
    "padding-right": "0",
    "padding-top": "4px",
    "padding-bottom": "4px",
    cursor: "pointer",
    background: props.isSelected ? "var(--cortex-vibe-badge-bg)" : "transparent",
    "border-radius": "var(--cortex-radius-xs)",
    transition: "background 100ms ease",
  });

  return (
    <div
      style={style()}
      onClick={props.onClick}
      onMouseEnter={(e) => {
        if (!props.isSelected) (e.currentTarget as HTMLElement).style.background = "var(--cortex-vibe-hover-bg)";
      }}
      onMouseLeave={(e) => {
        if (!props.isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <CortexIcon name="message-square-01" size={16} color="var(--cortex-text-secondary)" />
      <span style={{
        flex: "1",
        "font-family": "var(--cortex-font-sans)",
        "font-size": "var(--cortex-text-base)",
        "font-weight": "var(--cortex-font-medium)",
        color: "var(--cortex-text-on-surface)",
        overflow: "hidden",
        "text-overflow": "ellipsis",
        "white-space": "nowrap",
      }}>
        {props.title}
      </span>
      <Show when={props.changesCount && props.changesCount > 0}>
        <span style={{
          "font-family": "var(--cortex-font-sans)",
          "font-size": "var(--cortex-text-sm)",
          color: "var(--cortex-text-on-surface)",
          background: "var(--cortex-vibe-badge-bg)",
          padding: "0 8px",
          height: "16px",
          "line-height": "16px",
          "border-radius": "var(--cortex-radius-xs)",
          "text-align": "center",
          "flex-shrink": "0",
        }}>
          {props.changesCount}
        </span>
      </Show>
    </div>
  );
};
