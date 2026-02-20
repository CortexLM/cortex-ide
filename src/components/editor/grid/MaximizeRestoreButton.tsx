/**
 * MaximizeRestoreButton - Toggle button for maximize/restore group functionality.
 * Shows expand icon when not maximized, compress icon when maximized.
 */
import { type Component, type JSX } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Types
// ============================================================================

export interface MaximizeRestoreButtonProps {
  groupId: string;
  isMaximized: boolean;
  onMaximize: () => void;
  onRestore: () => void;
}

// ============================================================================
// Styles
// ============================================================================

const buttonStyle = (isHovered: boolean): JSX.CSSProperties => ({
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  width: "22px",
  height: "22px",
  border: "none",
  background: isHovered ? tokens.colors.surface.hover : "transparent",
  "border-radius": tokens.radius.sm,
  cursor: "pointer",
  color: tokens.colors.text.muted,
  padding: "0",
  transition: "background 0.15s ease",
});

// ============================================================================
// Component
// ============================================================================

export const MaximizeRestoreButton: Component<MaximizeRestoreButtonProps> = (props) => {
  let isHovered = false;
  let buttonRef: HTMLButtonElement | undefined;

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (props.isMaximized) {
      props.onRestore();
    } else {
      props.onMaximize();
    }
  };

  const updateHover = (hover: boolean) => {
    isHovered = hover;
    if (buttonRef) {
      const style = buttonStyle(isHovered);
      buttonRef.style.background = style.background as string;
    }
  };

  return (
    <button
      ref={buttonRef}
      style={buttonStyle(false)}
      onClick={handleClick}
      onMouseEnter={() => updateHover(true)}
      onMouseLeave={() => updateHover(false)}
      title={props.isMaximized ? "Restore group size" : "Maximize group"}
      data-group-id={props.groupId}
    >
      <Icon
        name={props.isMaximized ? "compress" : "expand"}
        style={{ width: "14px", height: "14px" }}
      />
    </button>
  );
};

export default MaximizeRestoreButton;
