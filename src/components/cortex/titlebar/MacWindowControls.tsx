import { Component, JSX, createSignal } from "solid-js";
import { CortexTooltip } from "../primitives";

export const MacWindowControls: Component<{
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
}> = (props) => {
  const [hoveredGroup, setHoveredGroup] = createSignal(false);

  const circleStyle = (color: string): JSX.CSSProperties => ({
    width: "12px",
    height: "12px",
    "border-radius": "var(--cortex-radius-full)",
    background: hoveredGroup() ? color : "var(--cortex-text-secondary)",
    border: "none",
    cursor: "pointer",
    padding: "0",
    transition: "background var(--cortex-transition-fast)",
    "flex-shrink": "0",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
  });

  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        gap: "10px",
        padding: "16px",
      }}
      onMouseEnter={() => setHoveredGroup(true)}
      onMouseLeave={() => setHoveredGroup(false)}
    >
      <CortexTooltip content="Close" position="bottom">
        <button
          type="button"
          style={circleStyle("var(--cortex-window-close)")}
          onClick={props.onClose}
          aria-label="Close"
        />
      </CortexTooltip>
      <CortexTooltip content="Minimize" position="bottom">
        <button
          type="button"
          style={circleStyle("var(--cortex-window-minimize)")}
          onClick={props.onMinimize}
          aria-label="Minimize"
        />
      </CortexTooltip>
      <CortexTooltip content="Maximize" position="bottom">
        <button
          type="button"
          style={circleStyle("var(--cortex-window-maximize)")}
          onClick={props.onMaximize}
          aria-label="Maximize"
        />
      </CortexTooltip>
    </div>
  );
};
