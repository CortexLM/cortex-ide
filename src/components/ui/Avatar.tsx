import { JSX, splitProps, Show, createMemo } from "solid-js";

export interface AvatarProps {
  /** Image source URL */
  src?: string;
  /** Alt text for image */
  alt?: string;
  /** Name for initials fallback */
  name?: string;
  /** Avatar size */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Status indicator */
  status?: "online" | "offline" | "away" | "busy";
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export function Avatar(props: AvatarProps) {
  const [local] = splitProps(props, ["src", "alt", "name", "size", "status", "style"]);

  const size = () => local.size || "md";

  const sizeMap: Record<string, { container: string; font: string; status: string }> = {
    xs: { container: "20px", font: "9px", status: "6px" },
    sm: { container: "24px", font: "10px", status: "6px" },
    md: { container: "32px", font: "12px", status: "8px" },
    lg: { container: "40px", font: "14px", status: "10px" },
    xl: { container: "56px", font: "18px", status: "12px" },
  };

  const statusColorMap: Record<string, string> = {
    online: "var(--cortex-success)",
    offline: "var(--jb-text-muted-color)",
    away: "var(--cortex-warning)",
    busy: "var(--cortex-error)",
  };

  const initials = createMemo(() => {
    if (!local.name) return "";
    const parts = local.name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  });

  const bgColor = createMemo(() => {
    if (!local.name) return "var(--jb-surface-active)";
    // Generate consistent color from name
    let hash = 0;
    for (let i = 0; i < local.name.length; i++) {
      hash = local.name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      "rgba(99, 102, 241, 0.3)",  // Indigo
      "rgba(34, 197, 94, 0.3)",   // Green
      "rgba(245, 158, 11, 0.3)", // Amber
      "rgba(239, 68, 68, 0.3)",   // Red
      "rgba(168, 85, 247, 0.3)", // Purple
      "rgba(6, 182, 212, 0.3)",   // Cyan
    ];
    return colors[Math.abs(hash) % colors.length];
  });

  const containerStyle = (): JSX.CSSProperties => ({
    position: "relative",
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    width: sizeMap[size()].container,
    height: sizeMap[size()].container,
    "border-radius": "var(--cortex-radius-full)",
    background: local.src ? "transparent" : bgColor(),
    overflow: "hidden",
    "flex-shrink": "0",
    ...local.style,
  });

  const imageStyle: JSX.CSSProperties = {
    width: "100%",
    height: "100%",
    "object-fit": "cover",
    "border-radius": "var(--cortex-radius-full)",
  };

  const initialsStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": sizeMap[size()].font,
    "font-weight": "500",
    color: "var(--jb-text-body-color)",
    "text-transform": "uppercase",
    "user-select": "none",
  };

  const statusStyle: JSX.CSSProperties = {
    position: "absolute",
    bottom: "0",
    right: "0",
    width: sizeMap[size()].status,
    height: sizeMap[size()].status,
    "border-radius": "var(--cortex-radius-full)",
    background: statusColorMap[local.status || "offline"],
    border: "2px solid var(--jb-panel)",
    "box-sizing": "content-box",
  };

  return (
    <div style={containerStyle()}>
      <Show when={local.src} fallback={<span style={initialsStyle}>{initials()}</span>}>
        <img src={local.src} alt={local.alt || local.name || "Avatar"} style={imageStyle} />
      </Show>
      <Show when={local.status}>
        <span style={statusStyle} />
      </Show>
    </div>
  );
}

export interface AvatarGroupProps {
  /** Maximum avatars to show */
  max?: number;
  /** Avatar size */
  size?: AvatarProps["size"];
  /** Children Avatar components */
  children: JSX.Element;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export function AvatarGroup(props: AvatarGroupProps) {
  const [local] = splitProps(props, ["children", "style"]);

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    ...local.style,
  };

  return (
    <div style={containerStyle}>
      {local.children}
    </div>
  );
}

