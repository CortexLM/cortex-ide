import { Component, createSignal, lazy, Suspense, JSX } from "solid-js";
import { CortexIcon } from "./primitives/CortexIcon";
import { CortexIconButton } from "./primitives/CortexIconButton";

const AgentFactory = lazy(() => import("@/components/factory/AgentFactory").then(m => ({ default: m.AgentFactory })));

const HEADER: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "8px",
  padding: "12px 16px",
  "border-bottom": "1px solid var(--cortex-border-default)",
  "flex-shrink": "0",
};

const TITLE: JSX.CSSProperties = {
  flex: "1",
  "font-size": "16px",
  "font-weight": "500",
  color: "var(--cortex-text-primary)",
  overflow: "hidden",
  "text-overflow": "ellipsis",
  "white-space": "nowrap",
};

const TOOLBAR: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "4px",
};

export const CortexFactoryPanel: Component = () => {
  const [isFullscreen, setIsFullscreen] = createSignal(false);

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    background: "var(--cortex-bg-secondary)",
    color: "var(--cortex-text-primary)",
    "font-family": "var(--cortex-font-sans)",
    overflow: "hidden",
  });

  const contentStyle = (): JSX.CSSProperties => ({
    flex: "1",
    overflow: "hidden",
    position: "relative",
    display: "flex",
  });

  const skeletonStyle: JSX.CSSProperties = {
    flex: "1",
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    gap: "12px",
    color: "var(--cortex-text-inactive)",
  };

  return (
    <div style={containerStyle()}>
      <div style={HEADER}>
        <CortexIcon name="grid" size={16} color="var(--cortex-text-primary)" />
        <span style={TITLE}>Agent Factory</span>
        <div style={TOOLBAR}>
          <CortexIconButton
            icon="plus"
            size={16}
            onClick={() => window.dispatchEvent(new CustomEvent("factory:new-workflow"))}
            title="New Workflow"
          />
          <CortexIconButton
            icon="folder"
            size={16}
            onClick={() => window.dispatchEvent(new CustomEvent("factory:open-workflow"))}
            title="Open Workflow"
          />
          <CortexIconButton
            icon={isFullscreen() ? "collapse" : "expand"}
            size={16}
            onClick={() => setIsFullscreen(!isFullscreen())}
            title={isFullscreen() ? "Exit Fullscreen" : "Fullscreen"}
          />
        </div>
      </div>

      <div style={contentStyle()}>
        <Suspense fallback={
          <div style={skeletonStyle}>
            <div style={{
              width: "24px",
              height: "24px",
              border: "2px solid currentColor",
              "border-top-color": "transparent",
              "border-radius": "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            <span style={{ "font-size": "13px" }}>Loading Agent Factory...</span>
          </div>
        }>
          <AgentFactory
            style={{
              width: "100%",
              height: "100%",
              "border-radius": "0",
              border: "none",
            }}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default CortexFactoryPanel;
