import { Component, For, Show, createSignal, JSX } from "solid-js";
import { CortexStartPause } from "../primitives/CortexStartPause";

export interface VibeTerminalProps {
  output: string[];
  branchName?: string;
  height: number;
  onRunCommand: (cmd: string) => void;
  onRun: () => void;
  onDividerDrag: (e: MouseEvent) => void;
}

export const VibeTerminal: Component<VibeTerminalProps> = (props) => {
  const [input, setInput] = createSignal("");

  const handleSubmit = (e: KeyboardEvent) => {
    if (e.key === "Enter" && input().trim()) {
      props.onRunCommand(input());
      setInput("");
    }
  };

  const mono14: JSX.CSSProperties = {
    "font-family": "var(--cortex-font-mono)",
    "font-size": "var(--cortex-text-sm)",
    "line-height": "1em",
    "font-weight": "400",
  };

  return (
    <>
      <div
        style={{ height: "4px", cursor: "row-resize", "flex-shrink": "0" }}
        onMouseDown={props.onDividerDrag}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--cortex-vibe-resize-hover)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      />
      <div style={{
        height: `${props.height}px`,
        background: "var(--cortex-border-default)",
        "border-radius": "var(--cortex-radius-xl)",
        display: "flex",
        "flex-direction": "column",
        "flex-shrink": "0",
        overflow: "hidden",
        margin: "0 8px 8px",
      }}>
        <div style={{
          display: "flex",
          "align-items": "center",
          padding: "16px",
          "flex-shrink": "0",
        }}>
          <span style={{
            "font-family": "var(--cortex-font-sans)",
            "font-size": "var(--cortex-text-sm)",
            "font-weight": "var(--cortex-font-medium)",
            color: "var(--cortex-text-on-surface)",
            flex: "1",
          }}>
            Terminal
          </span>
          <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
            <CortexStartPause state="start" onClick={props.onRun} />
            <span style={{
              "font-family": "var(--cortex-font-sans)",
              "font-size": "var(--cortex-text-sm)",
              "font-weight": "var(--cortex-font-medium)",
              color: "var(--cortex-text-on-surface)",
            }}>
              Run
            </span>
          </div>
        </div>

        <div style={{
          flex: "1",
          overflow: "auto",
          padding: "0 16px 16px",
          ...mono14,
          color: "var(--cortex-text-on-surface)",
          "min-height": "0",
        }}>
          <Show when={props.branchName}>
            <div>
              <span style={{ color: "var(--cortex-text-on-surface)" }}>cortex-app </span>
              <span style={{ color: "var(--cortex-vibe-text-subtle)" }}>git:(</span>
              <span style={{ color: "var(--cortex-text-on-surface)" }}>{props.branchName}</span>
              <span style={{ color: "var(--cortex-vibe-text-subtle)" }}>)</span>
            </div>
          </Show>
          <For each={props.output}>
            {(line) => (
              <div style={{
                color: line.startsWith("$") ? "var(--cortex-text-on-surface)"
                  : line.includes("✅") ? "var(--cortex-vibe-text-subtle)"
                    : line.includes("error") ? "var(--cortex-vibe-status-error)" : "var(--cortex-vibe-text-subtle)",
                "white-space": "pre-wrap",
                "word-break": "break-all",
              }}>
                {line}
              </div>
            )}
          </For>
        </div>

        <div style={{
          display: "flex",
          "align-items": "center",
          padding: "16px",
          "border-top": "1px solid var(--cortex-border-strong)",
          gap: "8px",
          "flex-shrink": "0",
        }}>
          <span style={{ "font-family": "var(--cortex-font-sans)", "font-size": "var(--cortex-text-sm)", "font-weight": "500", color: "var(--cortex-vibe-text-dim)" }}>$</span>
          <input
            type="text"
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={handleSubmit}
            placeholder="enter command..."
            style={{
              flex: "1",
              background: "transparent",
              border: "none",
              outline: "none",
              "font-family": "var(--cortex-font-sans)",
              "font-size": "var(--cortex-text-sm)",
              color: "var(--cortex-text-on-surface)",
              padding: "0",
            }}
          />
        </div>
      </div>
    </>
  );
};
