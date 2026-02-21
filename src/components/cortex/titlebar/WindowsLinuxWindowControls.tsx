import { Component, JSX, createSignal } from "solid-js";

export const WindowsLinuxWindowControls: Component<{
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
}> = (props) => {
  const buttonBase: JSX.CSSProperties = {
    width: "46px",
    height: "32px",
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "0",
    color: "var(--cortex-text-secondary)",
  };

  const [hoveredBtn, setHoveredBtn] = createSignal<string | null>(null);

  const btnStyle = (id: string, hoverBg: string): JSX.CSSProperties => ({
    ...buttonBase,
    background: hoveredBtn() === id ? hoverBg : "transparent",
    color: hoveredBtn() === id && id === "close" ? "#fff" : "var(--cortex-text-secondary)",
  });

  return (
    <div style={{ display: "flex", "align-items": "center" }}>
      <button
        type="button"
        style={btnStyle("min", "var(--cortex-bg-hover)")}
        onClick={props.onMinimize}
        onMouseEnter={() => setHoveredBtn("min")}
        onMouseLeave={() => setHoveredBtn(null)}
        aria-label="Minimize"
      >
        <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
          <rect width="10" height="1" />
        </svg>
      </button>
      <button
        type="button"
        style={btnStyle("max", "var(--cortex-bg-hover)")}
        onClick={props.onMaximize}
        onMouseEnter={() => setHoveredBtn("max")}
        onMouseLeave={() => setHoveredBtn(null)}
        aria-label="Maximize"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="0.5" y="0.5" width="9" height="9" />
        </svg>
      </button>
      <button
        type="button"
        style={btnStyle("close", "#c42b1c")}
        onClick={props.onClose}
        onMouseEnter={() => setHoveredBtn("close")}
        onMouseLeave={() => setHoveredBtn(null)}
        aria-label="Close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2">
          <line x1="0" y1="0" x2="10" y2="10" />
          <line x1="10" y1="0" x2="0" y2="10" />
        </svg>
      </button>
    </div>
  );
};
