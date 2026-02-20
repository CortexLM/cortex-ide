import { Component, JSX } from "solid-js";
import { CortexIcon } from "../primitives/CortexIcon";

export interface AgentItemProps {
  name: string;
  status: "idle" | "running" | "completed" | "error";
  isExpanded: boolean;
  onToggle: () => void;
}

const BotIcon: Component<{ size?: number }> = (props) => {
  const s = () => props.size ?? 16;
  return (
    <svg width={s()} height={s()} viewBox="0 0 24 24" fill="var(--cortex-text-on-surface)" style={{ "flex-shrink": "0" }}>
      <path d="M17.753 14a2.25 2.25 0 0 1 2.25 2.25v.904A3.75 3.75 0 0 1 18.696 20c-1.565 1.344-3.806 2-6.696 2s-5.128-.656-6.69-2a3.75 3.75 0 0 1-1.307-2.846v-.904A2.25 2.25 0 0 1 6.253 14h11.5ZM11.9 2.006L12 2a1 1 0 0 1 .993.883L13 3v1.104a5.002 5.002 0 0 1 3.994 4.472L17 8.72V10a1 1 0 0 1-.883.993L16 11H8a1 1 0 0 1-.993-.883L7 10V8.72a5.002 5.002 0 0 1 4-4.616V3a1 1 0 0 1 .9-.994ZM9.5 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
    </svg>
  );
};

const statusDot = (status: AgentItemProps["status"]): JSX.CSSProperties => {
  const colors: Record<string, string> = {
    idle: "var(--cortex-vibe-status-idle)",
    running: "var(--cortex-vibe-status-running)",
    completed: "var(--cortex-vibe-status-completed)",
    error: "var(--cortex-vibe-status-error)",
  };
  return {
    width: "6px",
    height: "6px",
    "border-radius": "50%",
    background: colors[status] || "var(--cortex-vibe-status-idle)",
    "flex-shrink": "0",
  };
};

export const AgentItem: Component<AgentItemProps> = (props) => {
  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        gap: "4px",
        cursor: "pointer",
      }}
      onClick={props.onToggle}
    >
      <div style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        transition: "transform 150ms ease",
        transform: props.isExpanded ? "rotate(90deg)" : "rotate(0deg)",
        "flex-shrink": "0",
      }}>
        <CortexIcon name="chevron-right" size={16} />
      </div>
      <div style={statusDot(props.status)} />
      <BotIcon size={16} />
      <span style={{
        flex: "1",
        "font-family": "var(--cortex-font-sans)",
        "font-size": "var(--cortex-text-sm)",
        "font-weight": "var(--cortex-font-medium)",
        color: "var(--cortex-text-on-surface)",
        overflow: "hidden",
        "text-overflow": "ellipsis",
        "white-space": "nowrap",
      }}>
        {props.name}
      </span>
    </div>
  );
};
