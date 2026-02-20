import { Component, For, JSX } from "solid-js";

export interface VibeTab {
  id: string;
  label: string;
  icon?: string;
  count?: number;
}

export interface VibeTabBarProps {
  tabs: VibeTab[];
  activeId: string;
  onTabChange: (id: string) => void;
  trailing?: JSX.Element;
}

const tabStyle = (active: boolean): JSX.CSSProperties => ({
  display: "flex",
  "align-items": "center",
  gap: "4px",
  padding: "10px 20px",
  height: "48px",
  "font-family": "var(--cortex-font-sans)",
  "font-size": "var(--cortex-text-sm)",
  "font-weight": "var(--cortex-font-medium)",
  color: active ? "var(--cortex-text-on-surface)" : "var(--cortex-text-secondary)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  position: "relative",
  "box-sizing": "border-box",
  "flex-shrink": "0",
});

const indicatorStyle: JSX.CSSProperties = {
  position: "absolute",
  bottom: "0",
  left: "0",
  right: "0",
  height: "2.67px",
  background: "var(--cortex-text-on-surface)",
};

const dividerStyle: JSX.CSSProperties = {
  width: "1px",
  "align-self": "stretch",
  background: "var(--cortex-border-default)",
  "flex-shrink": "0",
};

export const VibeTabBar: Component<VibeTabBarProps> = (props) => {
  return (
    <div style={{
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      height: "48px",
      "border-bottom": "1px solid var(--cortex-border-default)",
      "flex-shrink": "0",
      padding: "0 8px 0 0",
    }}>
      <div style={{ display: "flex", "align-items": "stretch", height: "100%" }}>
        <For each={props.tabs}>
          {(tab, i) => (
            <>
              {i() > 0 && <div style={dividerStyle} />}
              <button
                style={tabStyle(props.activeId === tab.id)}
                onClick={() => props.onTabChange(tab.id)}
              >
                {tab.icon && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style={{ "flex-shrink": "0" }}>
                    {tab.icon === "clock" && <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>}
                    {tab.icon === "file" && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>}
                  </svg>
                )}
                {tab.label}
                {tab.count !== undefined && (
                  <span style={{ color: "var(--cortex-text-secondary)", "font-size": "var(--cortex-text-sm)" }}>{tab.count}</span>
                )}
                {props.activeId === tab.id && <div style={indicatorStyle} />}
              </button>
            </>
          )}
        </For>
      </div>
      {props.trailing}
    </div>
  );
};
