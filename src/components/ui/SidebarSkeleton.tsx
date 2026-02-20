import { For, JSX } from "solid-js";

export function SidebarSkeleton() {
  const items = [
    { depth: 0, width: "70%" },
    { depth: 1, width: "60%" },
    { depth: 1, width: "80%" },
    { depth: 2, width: "50%" },
    { depth: 2, width: "65%" },
    { depth: 1, width: "75%" },
    { depth: 0, width: "65%" },
    { depth: 1, width: "85%" },
    { depth: 1, width: "55%" },
    { depth: 0, width: "80%" },
    { depth: 1, width: "70%" },
    { depth: 1, width: "60%" },
  ];

  // Section header skeleton
  const headerStyle: JSX.CSSProperties = {
    height: "20px",
    width: "60%",
    "border-radius": "var(--cortex-radius-sm)",
    background: "linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-highlight) 50%, var(--skeleton-base) 100%)",
    "background-size": "200% 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
    "margin-bottom": "12px",
  };

  // List item skeletons container
  const itemStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "6px 12px",
  };

  // Icon skeleton
  const iconStyle: JSX.CSSProperties = {
    width: "16px",
    height: "16px",
    "border-radius": "var(--cortex-radius-sm)",
    background: "linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-highlight) 50%, var(--skeleton-base) 100%)",
    "background-size": "200% 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
    "flex-shrink": "0",
  };

  // Expand icon skeleton (smaller)
  const expandIconStyle: JSX.CSSProperties = {
    width: "12px",
    height: "12px",
    "border-radius": "var(--cortex-radius-sm)",
    background: "linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-highlight) 50%, var(--skeleton-base) 100%)",
    "background-size": "200% 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
    "flex-shrink": "0",
  };

  // Text skeleton
  const textStyle: JSX.CSSProperties = {
    height: "12px",
    flex: "1",
    "border-radius": "var(--cortex-radius-sm)",
    background: "linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-highlight) 50%, var(--skeleton-base) 100%)",
    "background-size": "200% 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
  };

  // Header action button skeleton
  const actionButtonStyle: JSX.CSSProperties = {
    width: "16px",
    height: "16px",
    "border-radius": "var(--cortex-radius-full)",
    background: "linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-highlight) 50%, var(--skeleton-base) 100%)",
    "background-size": "200% 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
  };

  return (
    <div style={{ 
      display: "flex", 
      "flex-direction": "column", 
      gap: "4px", 
      padding: "8px", 
      width: "100%", 
      height: "100%", 
      overflow: "hidden", 
      background: "var(--surface-base)" 
    }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Header */}
      <div style={{ 
        display: "flex", 
        "align-items": "center", 
        "justify-content": "space-between", 
        "margin-bottom": "16px", 
        padding: "0 8px" 
      }}>
        <div style={headerStyle} />
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={actionButtonStyle} />
          <div style={actionButtonStyle} />
        </div>
      </div>

      {/* File Tree Items */}
      <For each={items}>
        {(item, index) => (
          <div 
            style={{ 
              ...itemStyle, 
              "padding-left": `${item.depth * 12 + 4}px`,
            }}
          >
            <div style={{ ...expandIconStyle, "animation-delay": `${index() * 0.05}s` }} />
            <div style={{ ...iconStyle, "animation-delay": `${index() * 0.05 + 0.02}s` }} />
            <div style={{ 
              ...textStyle, 
              width: item.width,
              "animation-delay": `${index() * 0.05 + 0.04}s`,
            }} />
          </div>
        )}
      </For>
    </div>
  );
}

export default SidebarSkeleton;

