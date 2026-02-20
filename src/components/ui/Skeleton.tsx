import { JSX } from "solid-js";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  class?: string;
  count?: number;
  style?: JSX.CSSProperties;
  /** Variant type: text, circle, or rectangle */
  variant?: "text" | "circle" | "rectangle";
}

export function Skeleton(props: SkeletonProps) {
  const count = () => props.count ?? 1;
  
  const skeletons = Array.from({ length: count() }, (_, i) => i);

  // Base skeleton style with new palette shimmer
  const skeletonStyle: JSX.CSSProperties = {
    background: "linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-highlight) 50%, var(--skeleton-base) 100%)",
    "background-size": "200% 100%",
    animation: "shimmer 1.5s ease-in-out infinite",
    "border-radius": "var(--cortex-radius-sm)",
  };

  // Text skeleton variant
  const textStyle: JSX.CSSProperties = {
    height: "14px",
    "border-radius": "var(--cortex-radius-sm)",
  };

  // Circle skeleton variant (avatar)
  const circleStyle: JSX.CSSProperties = {
    "border-radius": "var(--cortex-radius-full)",
  };

  // Rectangle skeleton variant (card/image)
  const rectangleStyle: JSX.CSSProperties = {
    "border-radius": "var(--cortex-radius-md)",
  };

  // Get variant-specific styles
  const getVariantStyle = (): JSX.CSSProperties => {
    if (props.circle) return circleStyle;
    
    switch (props.variant) {
      case "circle": return circleStyle;
      case "rectangle": return rectangleStyle;
      case "text":
      default: return textStyle;
    }
  };

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        .skeleton-item {
          display: block;
          position: relative;
          overflow: hidden;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          -webkit-appearance: none;
          appearance: none;
        }
      `}</style>
      {skeletons.map((i) => (
        <div
          class={`skeleton-item ${props.class || ""}`}
          style={{
            ...skeletonStyle,
            ...getVariantStyle(),
            width: typeof props.width === "number" ? `${props.width}px` : props.width || "100%",
            height: typeof props.height === "number" ? `${props.height}px` : props.height || "14px",
            "animation-delay": `${i * 0.1}s`,
            "margin-bottom": i < count() - 1 ? "0.5rem" : "0",
            ...props.style,
          }}
        />
      ))}
    </>
  );
}

export default Skeleton;

