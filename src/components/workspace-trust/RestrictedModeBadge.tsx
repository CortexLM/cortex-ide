import { Component, JSX, Show, createMemo } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { useWorkspaceTrust, useTrustStatus } from "@/context/WorkspaceTrustContext";

export interface RestrictedModeBadgeProps {
  onClick?: () => void;
  showLabel?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
}

export const RestrictedModeBadge: Component<RestrictedModeBadgeProps> = (props) => {
  const trust = useWorkspaceTrust();
  const trustStatus = useTrustStatus();

  const showLabel = () => props.showLabel ?? true;

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "4px",
    padding: "2px 6px",
    "border-radius": "var(--cortex-radius-sm)",
    cursor: "pointer",
    "font-size": "11px",
    color: trustStatus().color,
    background: trust.isRestrictedMode() ? "rgba(245, 158, 11, 0.1)" : "transparent",
    transition: "all var(--cortex-transition-fast)",
    ...props.style,
  });

  const handleClick = () => {
    if (props.onClick) {
      props.onClick();
    } else {
      window.dispatchEvent(new CustomEvent("open-settings", { detail: { section: "workspace-trust" } }));
    }
  };

  const iconName = createMemo(() => {
    const level = trust.trustLevel();
    if (level === "trusted") return "shield-check";
    if (level === "restricted") return "shield-exclamation";
    return "shield";
  });

  return (
    <div
      class={props.class}
      style={containerStyle()}
      onClick={handleClick}
      role="button"
      aria-label={trustStatus().description}
      title={trustStatus().description}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <Icon name={iconName()} size={12} />
      <Show when={showLabel()}>
        <span>{trustStatus().label}</span>
      </Show>
    </div>
  );
};

export default RestrictedModeBadge;
