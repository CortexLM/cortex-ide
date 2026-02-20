import { JSX } from "solid-js";

export function AgentSkeleton() {
  const containerStyle: JSX.CSSProperties = {
    padding: "16px",
    display: "flex",
    "flex-direction": "column",
    gap: "12px",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    background: "var(--surface-base)",
  };

  // Text lines with configurable width and delay
  const lineStyle = (width: string, delay: string): JSX.CSSProperties => ({
    height: "14px",
    width,
    "border-radius": "var(--cortex-radius-sm)",
    background: "linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-highlight) 50%, var(--skeleton-base) 100%)",
    "background-size": "200% 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
    "animation-delay": delay,
  });

  // Small line style for labels
  const smallLineStyle = (width: string, delay: string): JSX.CSSProperties => ({
    ...lineStyle(width, delay),
    height: "10px",
  });

  // Large line style for content
  const largeLineStyle = (width: string, delay: string): JSX.CSSProperties => ({
    ...lineStyle(width, delay),
    height: "12px",
  });

  // Circle button style
  const circleButtonStyle = (delay: string): JSX.CSSProperties => ({
    width: "20px",
    height: "20px",
    "border-radius": "var(--cortex-radius-full)",
    background: "linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-highlight) 50%, var(--skeleton-base) 100%)",
    "background-size": "200% 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
    "animation-delay": delay,
  });

  // Message container styles
  const messageContainerStyle: JSX.CSSProperties = {
    padding: "12px",
    "border-radius": "var(--cortex-radius-md)",
    background: "var(--surface-card)",
    border: "1px solid var(--border-default)",
    width: "100%",
  };

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Messages */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
        {/* AI Message */}
        <div style={{ display: "flex", "flex-direction": "column", gap: "8px", "max-width": "85%", "align-self": "flex-start" }}>
          <div style={smallLineStyle("40%", "0s")} />
          <div style={messageContainerStyle}>
            <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
              <div style={largeLineStyle("100%", "0.05s")} />
              <div style={largeLineStyle("90%", "0.1s")} />
              <div style={largeLineStyle("75%", "0.15s")} />
            </div>
          </div>
        </div>

        {/* User Message */}
        <div style={{ display: "flex", "flex-direction": "column", gap: "8px", "max-width": "85%", "align-self": "flex-end" }}>
          <div style={{ ...smallLineStyle("30%", "0.2s"), "margin-left": "auto" }} />
          <div style={{ ...messageContainerStyle, background: "var(--surface-hover)" }}>
            <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
              <div style={largeLineStyle("100%", "0.25s")} />
              <div style={largeLineStyle("80%", "0.3s")} />
            </div>
          </div>
        </div>

        {/* AI Message with Tool Steps */}
        <div style={{ display: "flex", "flex-direction": "column", gap: "8px", "max-width": "85%", "align-self": "flex-start" }}>
          <div style={smallLineStyle("40%", "0.35s")} />
          <div style={messageContainerStyle}>
            <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
              <div style={largeLineStyle("90%", "0.4s")} />
              
              {/* Tool Result Skeleton */}
              <div style={{ border: "1px solid var(--border-default)", "border-radius": "var(--cortex-radius-md)", overflow: "hidden" }}>
                <div style={{ background: "var(--surface-active)", padding: "6px 8px", display: "flex", "align-items": "center", gap: "8px" }}>
                  <div style={circleButtonStyle("0.45s")} />
                  <div style={smallLineStyle("60px", "0.5s")} />
                </div>
                <div style={{ padding: "8px", display: "flex", "flex-direction": "column", gap: "6px" }}>
                  <div style={smallLineStyle("80%", "0.55s")} />
                  <div style={smallLineStyle("70%", "0.6s")} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Input Area at bottom */}
      <div style={{ "margin-top": "auto", "border-top": "1px solid var(--border-default)", "padding-top": "16px" }}>
        <div style={{ 
          "border-radius": "var(--cortex-radius-lg)", 
          border: "1px solid var(--border-default)", 
          padding: "12px", 
          background: "var(--surface-card)",
          display: "flex",
          "flex-direction": "column",
          gap: "8px",
        }}>
          <div style={smallLineStyle("30%", "0.65s")} />
          <div style={{ ...lineStyle("100%", "0.7s"), height: "24px" }} />
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-top": "8px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <div style={circleButtonStyle("0.75s")} />
              <div style={circleButtonStyle("0.8s")} />
            </div>
            <div style={{ ...lineStyle("60px", "0.85s"), height: "24px", "border-radius": "var(--cortex-radius-md)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentSkeleton;

