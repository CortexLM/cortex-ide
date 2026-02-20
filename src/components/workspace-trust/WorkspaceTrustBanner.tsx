import { Component, JSX, Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { useWorkspaceTrust } from "@/context/WorkspaceTrustContext";

export interface WorkspaceTrustBannerProps {
  class?: string;
  style?: JSX.CSSProperties;
}

export const WorkspaceTrustBanner: Component<WorkspaceTrustBannerProps> = (props) => {
  const trust = useWorkspaceTrust();

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "12px",
    padding: "10px 16px",
    background: "var(--cortex-warning-bg, rgba(251, 191, 36, 0.15))",
    "border-bottom": "1px solid var(--cortex-warning, #fbbf24)",
    ...props.style,
  });

  const iconContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "32px",
    height: "32px",
    "border-radius": "var(--cortex-radius-full)",
    background: "var(--cortex-warning, #fbbf24)",
    "flex-shrink": "0",
  };

  const contentStyle: JSX.CSSProperties = {
    flex: "1",
    "min-width": "0",
  };

  const titleStyle: JSX.CSSProperties = {
    "font-size": "13px",
    "font-weight": "600",
    color: "var(--cortex-text-primary)",
    "margin-bottom": "2px",
  };

  const descriptionStyle: JSX.CSSProperties = {
    "font-size": "12px",
    color: "var(--cortex-text-muted)",
  };

  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "flex-shrink": "0",
  };

  const handleTrust = () => {
    trust.trustWorkspace();
  };

  const handleDismiss = () => {
    trust.dismissBanner();
  };

  const handleManage = () => {
    window.dispatchEvent(new CustomEvent("open-settings", { detail: { section: "workspace-trust" } }));
  };

  return (
    <Show when={trust.shouldShowBanner()}>
      <div class={props.class} style={containerStyle()} role="alert" aria-live="polite">
        <div style={iconContainerStyle}>
          <Icon name="shield-exclamation" size={18} style={{ color: "var(--cortex-bg-primary)" }} />
        </div>
        <div style={contentStyle}>
          <div style={titleStyle}>Restricted Mode</div>
          <div style={descriptionStyle}>
            Some features are disabled because this workspace is not trusted.
          </div>
        </div>
        <div style={actionsStyle}>
          <Button variant="ghost" size="sm" onClick={handleManage}>
            Manage
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Don't Trust
          </Button>
          <Button variant="primary" size="sm" onClick={handleTrust}>
            Trust Workspace
          </Button>
        </div>
      </div>
    </Show>
  );
};

export default WorkspaceTrustBanner;
