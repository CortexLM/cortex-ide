import { Component, JSX } from "solid-js";

export const StreamingCursor: Component = () => {
  const style: JSX.CSSProperties = {
    display: "inline-block",
    width: "2px",
    height: "1em",
    background: "var(--cortex-text-on-surface)",
    "margin-left": "2px",
    "vertical-align": "text-bottom",
    animation: "cursor-blink 1s step-end infinite",
  };

  return <span style={style} />;
};
