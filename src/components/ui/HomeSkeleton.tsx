import { For, JSX } from "solid-js";

export function HomeSkeleton() {
  // Card skeleton
  const cardStyle: JSX.CSSProperties = {
    background: "var(--surface-card)",
    border: "1px solid var(--border-default)",
    "border-radius": "var(--cortex-radius-lg)",
    padding: "20px",
  };

  // Generic line skeleton with configurable size
  const lineStyle = (width: string, height: string, delay: string = "0s"): JSX.CSSProperties => ({
    height,
    width,
    "border-radius": "var(--cortex-radius-sm)",
    background: "linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-highlight) 50%, var(--skeleton-base) 100%)",
    "background-size": "200% 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
    "animation-delay": delay,
  });

  // Circle skeleton for avatars/icons
  const circleStyle = (size: string, delay: string = "0s"): JSX.CSSProperties => ({
    width: size,
    height: size,
    "border-radius": "var(--cortex-radius-full)",
    background: "linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-highlight) 50%, var(--skeleton-base) 100%)",
    "background-size": "200% 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
    "animation-delay": delay,
    "flex-shrink": "0",
  });

  // Action card style (larger cards with icon)
  const actionCardStyle: JSX.CSSProperties = {
    ...cardStyle,
    padding: "24px",
    display: "flex",
    "align-items": "center",
    gap: "16px",
  };

  // Project card style (smaller cards in grid)
  const projectCardStyle: JSX.CSSProperties = {
    background: "var(--surface-card)",
    border: "1px solid var(--border-default)",
    "border-radius": "var(--cortex-radius-md)",
    padding: "12px",
    display: "flex",
    "flex-direction": "column",
    gap: "8px",
  };

  return (
    <div style={{ 
      height: "100%", 
      display: "flex", 
      "flex-direction": "column", 
      overflow: "hidden", 
      background: "var(--surface-base)" 
    }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div style={{ 
        flex: "1", 
        display: "flex", 
        "align-items": "center", 
        "justify-content": "center", 
        overflow: "auto", 
        padding: "48px 24px" 
      }}>
        <div style={{ width: "100%", "max-width": "800px" }}>
          {/* Logo Skeleton */}
          <div style={{ 
            "margin-bottom": "64px", 
            "text-align": "center", 
            display: "flex", 
            "flex-direction": "column", 
            "align-items": "center" 
          }}>
            <div style={{ 
              ...lineStyle("300px", "100px", "0s"),
              "border-radius": "var(--cortex-radius-lg)",
              opacity: "0.3",
            }} />
            <div style={{ 
              ...lineStyle("150px", "16px", "0.1s"),
              "margin-top": "24px",
            }} />
          </div>

          {/* Action Cards Skeleton */}
          <div style={{ 
            display: "grid", 
            "grid-template-columns": "repeat(2, 1fr)", 
            gap: "16px", 
            "margin-bottom": "48px" 
          }}>
            <div style={actionCardStyle}>
              <div style={circleStyle("48px", "0.15s")} />
              <div style={{ flex: "1", display: "flex", "flex-direction": "column", gap: "8px" }}>
                <div style={lineStyle("60%", "16px", "0.2s")} />
                <div style={lineStyle("40%", "12px", "0.25s")} />
              </div>
            </div>
            <div style={actionCardStyle}>
              <div style={circleStyle("48px", "0.3s")} />
              <div style={{ flex: "1", display: "flex", "flex-direction": "column", gap: "8px" }}>
                <div style={lineStyle("60%", "16px", "0.35s")} />
                <div style={lineStyle("40%", "12px", "0.4s")} />
              </div>
            </div>
          </div>

          {/* Recent Projects Skeleton */}
          <div style={{ "margin-top": "32px" }}>
            <div style={{ ...lineStyle("120px", "14px", "0.45s"), "margin-bottom": "16px" }} />
            <div style={{ 
              display: "grid", 
              "grid-template-columns": "repeat(3, 1fr)", 
              gap: "12px" 
            }}>
              <For each={Array(6).fill(0)}>
                {(_, index) => (
                  <div style={projectCardStyle}>
                    <div style={lineStyle("80%", "14px", `${0.5 + index() * 0.05}s`)} />
                    <div style={lineStyle("100%", "10px", `${0.55 + index() * 0.05}s`)} />
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomeSkeleton;

